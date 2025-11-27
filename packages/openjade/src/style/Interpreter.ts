// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, Char, StringC, String as StringOf, XcharMap, Messenger, Message, MessageType, MessageType1, MessageType2, MessageType3 } from '@openjade-js/opensp';
import {
  ELObj,
  NilObj,
  TrueObj,
  FalseObj,
  ErrorObj,
  UnspecifiedObj,
  SymbolObj,
  KeywordObj,
  PairObj,
  IntegerObj,
  RealObj,
  CharObj,
  StringObj,
  LengthObj,
  QuantityObj,
  LengthSpec,
  LengthSpecObj,
  VectorObj,
  NodeListObj,
  NodePtrNodeListObj,
  EmptyNodeListObj,
  AddressObj,
  GlyphIdObj,
  FunctionObj,
  Signature,
  LanguageObj,
  LangObj
} from './ELObj';
import { Identifier, SyntacticKey, InterpreterLike } from './Identifier';
import {
  VM,
  PrimitiveObj,
  InsnPtr,
  BoxObj,
  ProcessingMode as ProcessingModeInterface,
  CheckSosofoInsn,
  ApplyPrimitiveObj
} from './Insn';
// Note: Collector import removed - JS has native GC, we don't need custom memory management
import {
  Symbol as FOTSymbol,
  GlyphId,
  LengthSpec as FOTLengthSpec,
  Address
} from './FOTBuilder';
import { NodePtr, GroveString, AccessResult } from '../grove/Node';
import { Environment } from './Expression';
import { Pattern, MatchContext, Element } from './Pattern';
import { StyleObj, VarStyleObj, StyleSpec, InheritedC, VarInheritedC } from './Style';
import { FlowObj, SosofoObj, AppendSosofoObj, EmptySosofoObj } from './SosofoObj';
import { FormattingInstructionFlowObj, UnknownFlowObj, createFlowObj } from './FlowObj';
import { primitives, SosofoAppendPrimitiveObj, EmptySosofoPrimitiveObj } from './primitive';

// Default character for unmapped SDATA entities
const defaultChar: Char = 0xfffd;

// Helper functions for StringC <-> JavaScript string conversion
function stringCToString(sc: StringC): string {
  if (!sc.ptr_ || sc.length_ === 0) return '';
  let result = '';
  for (let i = 0; i < sc.length_; i++) {
    result += String.fromCharCode(sc.ptr_[i]);
  }
  return result;
}

function stringToStringC(s: string): StringC {
  const chars: Char[] = [];
  for (let i = 0; i < s.length; i++) {
    chars.push(s.charCodeAt(i));
  }
  return new StringOf<Char>(chars, chars.length);
}

function stringCLength(sc: StringC): number {
  return sc.length_;
}

function stringCCharAt(sc: StringC, index: number): Char {
  if (!sc.ptr_ || index < 0 || index >= sc.length_) return 0;
  return sc.ptr_[index];
}

function stringCEndsWith(sc: StringC, suffix: string): boolean {
  const scLen = sc.length_;
  const suffixLen = suffix.length;
  if (suffixLen > scLen) return false;
  if (!sc.ptr_) return suffixLen === 0;
  for (let i = 0; i < suffixLen; i++) {
    if (sc.ptr_[scLen - suffixLen + i] !== suffix.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

function stringCSlice(sc: StringC, start: number, end?: number): StringC {
  const len = sc.length_;
  if (start < 0) start = Math.max(0, len + start);
  if (end === undefined) end = len;
  else if (end < 0) end = Math.max(0, len + end);
  if (start >= end || !sc.ptr_) {
    return new StringOf<Char>(null, 0);
  }
  const newChars = sc.ptr_.slice(start, end);
  return new StringOf<Char>(newChars, newChars.length);
}

function stringCToLowerCase(sc: StringC): string {
  return stringCToString(sc).toLowerCase();
}

function groveStringToString(gs: GroveString): string {
  if (!gs || gs.size() === 0) return '';
  let result = '';
  for (let i = 0; i < gs.size(); i++) {
    result += String.fromCharCode(gs.get(i));
  }
  return result;
}

// Character part for named character mapping
interface CharPart {
  c: Char;
  defPart: number;
}

// ELObj with definition part info
interface ELObjPart {
  obj: ELObj | null;
  defPart: number;
}

// Character property definition
interface CharProp {
  map: Map<Char, ELObjPart>;
  def: ELObjPart;
  loc: Location;
}

// Unit class for measurement units
export class Unit {
  private name_: StringC;
  private defPart_: number = 0;
  private defLoc_: Location = new Location();
  private def_: Expression | null = null;
  private insn_: InsnPtr = null;
  private computed_: 'notComputed' | 'beingComputed' | 'computedExact' | 'computedInexact' | 'computedError' = 'notComputed';
  private exact_: number = 0;
  private inexact_: number = 0;
  private dim_: number = 0;

  constructor(name: StringC) {
    this.name_ = name;
  }

  name(): StringC {
    return this.name_;
  }

  setValue(n: number, isDouble: boolean = false): void {
    if (isDouble) {
      this.computed_ = 'computedInexact';
      this.inexact_ = n;
    } else {
      this.computed_ = 'computedExact';
      this.exact_ = Math.trunc(n);
    }
    this.dim_ = 1;
    this.defPart_ = 0xFFFFFFFF; // unsigned(-1)
  }

  defined(part: { value: number }, loc: { value: Location | null }): boolean {
    if (!this.def_ && this.computed_ === 'notComputed') {
      return false;
    }
    part.value = this.defPart_;
    loc.value = this.defLoc_;
    return true;
  }

  setDefinition(expr: Expression, part: number, loc: Location): void {
    this.def_ = expr;
    this.defPart_ = part;
    this.defLoc_ = loc;
    this.computed_ = 'notComputed';
  }

  private tryCompute(force: boolean, interp: Interpreter): void {
    if (this.computed_ === 'notComputed') {
      this.computed_ = 'beingComputed';
      if (this.insn_ === null && this.def_) {
        this.insn_ = Expression.optimizeCompile(this.def_, interp, new Environment(), 0, null);
      }
      if (force || (this.def_ && this.def_.canEval(false))) {
        const vm = new VM(interp);
        const v = vm.eval(this.insn_);
        const q = v.quantityValue();
        switch (q.type) {
          case 0: // noQuantity
            if (!interp.isError(v)) {
              interp.setNextLocation(this.defLoc_);
              interp.message(InterpreterMessages.badUnitDefinition, this.name_);
            }
            this.computed_ = 'computedError';
            break;
          case 1: // longQuantity
            this.exact_ = q.longVal;
            this.dim_ = q.dim;
            this.computed_ = 'computedExact';
            break;
          case 2: // doubleQuantity
            this.inexact_ = q.doubleVal;
            this.dim_ = q.dim;
            this.computed_ = 'computedInexact';
            break;
        }
      }
      if (this.computed_ === 'beingComputed') {
        this.computed_ = 'notComputed';
      }
    } else if (this.computed_ === 'beingComputed') {
      interp.setNextLocation(this.defLoc_);
      interp.message(InterpreterMessages.unitLoop, this.name_);
      this.computed_ = 'computedError';
    }
  }

  resolveQuantity(force: boolean, interp: Interpreter, val: number, valExp: number): ELObj | null {
    this.tryCompute(force, interp);
    let result: number;
    if (this.computed_ === 'computedExact' && this.scale(val, valExp, this.exact_, { value: result = 0 })) {
      return new LengthObj(result);
    }
    let x = val;
    while (valExp > 0) {
      x *= 10.0;
      valExp--;
    }
    while (valExp < 0) {
      x /= 10.0;
      valExp++;
    }
    return this.resolveQuantityDouble(force, interp, x, 1);
  }

  private scale(val: number, valExp: number, factor: number, result: { value: number }): boolean {
    if (factor <= 0) return false;
    let f = factor;
    while (valExp > 0) {
      if (f > Number.MAX_SAFE_INTEGER / 10) return false;
      valExp--;
      f *= 10;
    }
    const r = val * f;
    while (valExp < 0) {
      result.value = Math.trunc(r / 10);
      valExp++;
    }
    result.value = r;
    return true;
  }

  resolveQuantityDouble(force: boolean, interp: Interpreter, val: number, unitExp: number): ELObj | null {
    this.tryCompute(force, interp);
    let factor: number;
    switch (this.computed_) {
      case 'computedExact':
        factor = this.exact_;
        break;
      case 'computedInexact':
        factor = this.inexact_;
        break;
      case 'computedError':
        return interp.makeError();
      default:
        return null;
    }
    let resultDim = 0;
    let resultVal = val;
    while (unitExp > 0) {
      resultDim += this.dim_;
      resultVal *= factor;
      unitExp--;
    }
    while (unitExp < 0) {
      resultDim -= this.dim_;
      resultVal /= factor;
      unitExp++;
    }
    if (resultDim === 0) {
      return new RealObj(resultVal);
    }
    return new QuantityObj(resultVal, resultDim);
  }
}

// Forward declaration for Expression - matches Expression.ts
export interface Expression {
  location(): Location;
  constantValue(): ELObj | null;
  canEval(maybeCall: boolean): boolean;
  optimize(interp: Interpreter, env: Environment, owner: { value: Expression | null }): void;
  compile(interp: Interpreter, env: Environment, stackPos: number, next: InsnPtr): InsnPtr;
  keyword?(): Identifier | null; // Optional - only some expressions have this
}

export namespace Expression {
  export function optimizeCompile(
    expr: Expression | { value: Expression | null },
    interp: Interpreter,
    env: Environment,
    depth: number,
    next: InsnPtr
  ): InsnPtr {
    // Handle Owner<Expression> pattern
    if ('value' in expr) {
      const owner = expr as { value: Expression | null };
      if (owner.value) {
        owner.value.optimize(interp, env, owner);
        if (owner.value) {
          return owner.value.compile(interp, env, depth, next);
        }
      }
      return next;
    }
    const e = expr as Expression;
    const owner = { value: e as Expression | null };
    e.optimize(interp, env, owner);
    if (owner.value) {
      return owner.value.compile(interp, env, depth, next);
    }
    return next;
  }
}

// Re-export Environment from Expression.ts
export { Environment };

// Lexical categories for parsing
export enum LexCategory {
  lexLetter = 0,        // a - z A - Z
  lexOtherNameStart = 1, // !$%&*/<=>?~_^:
  lexAddNameStart = 2,
  lexDigit = 3,         // 0-9
  lexOtherNumberStart = 4, // -+.
  lexOther = 5,
  lexDelimiter = 6,     // ;()"
  lexWhiteSpace = 7,
  lexAddWhiteSpace = 8
}

// Port names enum
export enum PortName {
  portNumerator = 0,
  portDenominator = 1,
  portPreSup = 2,
  portPreSub = 3,
  portPostSup = 4,
  portPostSub = 5,
  portMidSup = 6,
  portMidSub = 7,
  portOverMark = 8,
  portUnderMark = 9,
  portOpen = 10,
  portClose = 11,
  portDegree = 12,
  portOperator = 13,
  portLowerLimit = 14,
  portUpperLimit = 15,
  portHeader = 16,
  portFooter = 17
}
export const nPortNames = 18;

// Interpreter messages
export const InterpreterMessages = {
  badUnitDefinition: 'badUnitDefinition',
  unitLoop: 'unitLoop',
  identifierLoop: 'identifierLoop',
  invalidCharacteristicValue: 'invalidCharacteristicValue',
  duplicateInitialValue: 'duplicateInitialValue',
  invalidPublicIdChar: 'invalidPublicIdChar',
  patternEmptyGi: 'patternEmptyGi',
  patternNotList: 'patternNotList',
  patternBadGi: 'patternBadGi',
  patternBadAttributeQualifier: 'patternBadAttributeQualifier',
  patternBadMember: 'patternBadMember',
  patternMissingQualifierValue: 'patternMissingQualifierValue',
  patternUnknownQualifier: 'patternUnknownQualifier',
  patternBadQualifierValue: 'patternBadQualifierValue',
  patternChildRepeat: 'patternChildRepeat',
  unsupportedCharRepertoire: 'unsupportedCharRepertoire',
  invalidCharNumber: 'invalidCharNumber',
  duplicateCharName: 'duplicateCharName',
  badCharName: 'badCharName',
  badDeclaration: 'badDeclaration',
  duplicateSdataEntityName: 'duplicateSdataEntityName',
  duplicateSdataEntityText: 'duplicateSdataEntityText',
  unknownCharProperty: 'unknownCharProperty',
  varCharPropertyExprUnsupported: 'varCharPropertyExprUnsupported',
  duplicateCharPropertyDecl: 'duplicateCharPropertyDecl',
  duplicateAddCharProperty: 'duplicateAddCharProperty',
  defLangDeclRequiresLanguage: 'defLangDeclRequiresLanguage',
  duplicateRootRule: 'duplicateRootRule',
  ambiguousMatch: 'ambiguousMatch',
  // From Insn.ts
  stackTrace: 'stackTrace',
  stackTraceEllipsis: 'stackTraceEllipsis'
} as const;

// Re-export SyntacticKey from Identifier.ts for convenience
export { SyntacticKey } from './Identifier';

// Backward compatibility aliases
export { Rule as ProcessingModeRule };
export { Specificity as ProcessingModeSpecificity };
export { MatchContext as ProcessingModeMatchContext };

// Grove manager interface
export interface GroveManager {
  mapSysid(sysid: StringC): void;
  readEntity(sysid: StringC, src: { value: StringC }): boolean;
}

// Rule type enum
export enum RuleType {
  styleRule = 0,
  constructionRule = 1
}
export const nRuleType = 2;

// Processing mode specificity
export class Specificity {
  toInitial_: boolean = false;  // 1 if the match fell through from a named processing mode to initial
  ruleType_: RuleType = RuleType.styleRule;
  nextRuleIndex_: number = 0;

  isStyle(): boolean {
    return this.ruleType_ === RuleType.styleRule;
  }

  clone(): Specificity {
    const s = new Specificity();
    s.toInitial_ = this.toInitial_;
    s.ruleType_ = this.ruleType_;
    s.nextRuleIndex_ = this.nextRuleIndex_;
    return s;
  }
}

// Processing mode action
export class Action {
  private defLoc_: Location;
  private expr_: Expression;
  private insn_: InsnPtr = null;
  private sosofo_: SosofoObj | null = null;
  private partIndex_: number;

  constructor(partIndex: number, expr: Expression, loc: Location) {
    this.partIndex_ = partIndex;
    this.expr_ = expr;
    this.defLoc_ = loc;
  }

  compile(interp: Interpreter, ruleType: RuleType): void {
    const owner = { value: this.expr_ as Expression | null };
    this.expr_.optimize(interp, new Environment(), owner);
    this.expr_ = owner.value!;
    const tem = this.expr_.constantValue();
    if (tem) {
      if (ruleType === RuleType.constructionRule) {
        this.sosofo_ = tem.asSosofo();
        if (this.sosofo_) {
          return;
        }
      }
    }
    let check: InsnPtr = null;
    if (ruleType === RuleType.constructionRule) {
      check = new CheckSosofoInsn(this.defLoc_, check);
    }
    this.insn_ = this.expr_.compile(interp, new Environment(), 0, check);
  }

  get(result: { insn: InsnPtr; sosofo: SosofoObj | null }): void {
    result.insn = this.insn_;
    result.sosofo = this.sosofo_;
  }

  location(): Location {
    return this.defLoc_;
  }

  partIndex(): number {
    return this.partIndex_;
  }
}

// Processing mode rule
export class Rule {
  protected action_: Action | null = null;

  constructor(action?: Action) {
    this.action_ = action ?? null;
  }

  action(): Action {
    return this.action_!;
  }

  compareSpecificity(r: Rule): number {
    const i1 = this.action().partIndex();
    const i2 = r.action().partIndex();
    if (i1 === i2) return 0;
    return i1 < i2 ? -1 : 1;
  }

  location(): Location {
    return this.action_!.location();
  }

  swap(r: Rule): void {
    const temp = this.action_;
    this.action_ = r.action_;
    r.action_ = temp;
  }
}

// Element rule - combines Rule and Pattern
export class ElementRule extends Rule {
  private pattern_: Pattern;

  constructor(action: Action, pattern: Pattern) {
    super(action);
    this.pattern_ = new Pattern();
    pattern.swap(this.pattern_);
  }

  override compareSpecificity(r: Rule): number {
    const result = super.compareSpecificity(r);
    if (result) return result;
    return Pattern.compareSpecificity(this.pattern_, (r as ElementRule).pattern_);
  }

  mustHaveGi(gi: { value: StringC }): boolean {
    return this.pattern_.mustHaveGi(gi);
  }

  trivial(): boolean {
    return this.pattern_.trivial();
  }

  matches(node: NodePtr, context: MatchContext): boolean {
    return this.pattern_.matches(node, context);
  }
}

// Element rules - named table entry
export class ElementRules {
  private name_: StringC;
  rules: (ElementRule | null)[][] = [[], []];  // [nRuleType]

  constructor(name: StringC) {
    this.name_ = name;
  }

  name(): StringC {
    return this.name_;
  }
}

// Grove rules - cached element rule lookups
export class GroveRules {
  built: boolean = false;
  elementTable: Map<string, ElementRules> = new Map();
  otherRules: (ElementRule | null)[][] = [[], []];  // [nRuleType]

  build(lists: ElementRule[][], node: NodePtr, _mgr: Messenger | null): void {
    this.built = true;
    for (let ruleType = 0; ruleType < nRuleType; ruleType++) {
      for (const rule of lists[ruleType]) {
        const gi: { value: StringC } = { value: stringToStringC('') };
        if (rule.mustHaveGi(gi)) {
          Interpreter.normalizeGeneralName(node, gi.value);
          const giKey = stringCToString(gi.value);
          let p = this.elementTable.get(giKey);
          if (!p) {
            p = new ElementRules(gi.value);
            this.elementTable.set(giKey, p);
          }
          p.rules[ruleType].push(rule);
        } else {
          this.otherRules[ruleType].push(rule);
        }
      }
    }
    for (let ruleType = 0; ruleType < nRuleType; ruleType++) {
      for (const [, p] of this.elementTable) {
        // Append otherRules to element-specific rules
        for (const r of this.otherRules[ruleType]) {
          p.rules[ruleType].push(r);
        }
        GroveRules.sortRules(p.rules[ruleType]);
      }
      GroveRules.sortRules(this.otherRules[ruleType]);
    }
  }

  static sortRules(v: (ElementRule | null)[]): void {
    v.sort((a, b) => {
      if (!a || !b) return 0;
      return a.compareSpecificity(b);
    });
  }
}

// Processing mode implementation
export class ProcessingMode implements ProcessingModeInterface {
  private name_: StringC;
  private defined_: boolean = false;
  private initial_: ProcessingMode | null = null;
  private rootRules_: Rule[][] = [[], []];  // [nRuleType]
  private elementRules_: ElementRule[][] = [[], []];  // [nRuleType]
  private groveRules_: GroveRules[] = [];

  constructor(name?: StringC, initial?: ProcessingMode) {
    this.name_ = name ?? stringToStringC('');
    this.initial_ = initial ?? null;
  }

  defined(): boolean {
    return this.defined_;
  }

  setDefined(): void {
    this.defined_ = true;
  }

  name(): StringC {
    return this.name_;
  }

  addRule(
    root: boolean,
    patterns: Pattern[],
    expr: Expression,
    ruleType: RuleType,
    loc: Location,
    interp: Interpreter
  ): void {
    const action = new Action(interp.currentPartIndex(), expr, loc);
    for (const pattern of patterns) {
      this.elementRules_[ruleType].push(new ElementRule(action, pattern));
    }
    if (!root) return;
    const rules = this.rootRules_[ruleType];
    rules.push(new Rule(action));
    // Insert in sorted order
    for (let i = rules.length - 1; i > 0; i--) {
      const cmp = rules[i - 1].compareSpecificity(rules[i]);
      if (cmp <= 0) {
        if (cmp === 0 && ruleType === RuleType.constructionRule) {
          interp.setNextLocation(loc);
          interp.message(InterpreterMessages.duplicateRootRule, rules[i - 1].location());
        }
        break;
      }
      rules[i - 1].swap(rules[i]);
    }
  }

  // Find matching rule for a node
  findMatch(
    node: NodePtr,
    context: MatchContext,
    mgr: Messenger | null,
    specificity: Specificity
  ): Rule | null {
    const gi = node.getGi();
    if (gi) {
      const giStr: StringC = stringToStringC(groveStringToString(gi));
      // Normalize the GI for rule lookup (SGML element names are case-insensitive)
      Interpreter.normalizeGeneralName(node, giStr);
      return this.findElementMatch(giStr, node, context, mgr, specificity);
    }
    // Check if node has no origin (is a root node)
    const tem = new NodePtr();
    const originResult = node.assignOrigin();
    if (originResult !== AccessResult.accessOK) {
      return this.findRootMatch(node, context, mgr, specificity);
    }
    return null;
  }

  private findElementMatch(
    gi: StringC,
    node: NodePtr,
    context: MatchContext,
    mgr: Messenger | null,
    specificity: Specificity
  ): Rule | null {
    let vecP: (ElementRule | null)[] | null = null;

    for (;;) {
      for (;;) {
        const mode: ProcessingMode = (this.initial_ && specificity.toInitial_) ? this.initial_ : this;
        if (!vecP) {
          const gr = mode.groveRules(node, mgr);
          const giKey = stringCToString(gi);
          const er = gr.elementTable.get(giKey);
          vecP = er ? er.rules[specificity.ruleType_] : gr.otherRules[specificity.ruleType_];
        }
        const vec = vecP;
        for (; specificity.nextRuleIndex_ < vec.length; ) {
          const rule = vec[specificity.nextRuleIndex_];
          if (rule && (rule.trivial() || rule.matches(node, context))) {
            this.elementRuleAdvance(node, context, mgr, specificity, vec);
            return rule;
          }
          specificity.nextRuleIndex_++;
        }
        if (!this.initial_) break;
        vecP = null;
        if (specificity.toInitial_) break;
        specificity.nextRuleIndex_ = 0;
        specificity.toInitial_ = true;
      }
      if (specificity.ruleType_ === RuleType.constructionRule) break;
      specificity.ruleType_ = RuleType.constructionRule;
      specificity.nextRuleIndex_ = 0;
      specificity.toInitial_ = false;
      vecP = null;  // Reset to get rules for new ruleType
    }
    return null;
  }

  private findRootMatch(
    _node: NodePtr,
    _context: MatchContext,
    _mgr: Messenger | null,
    specificity: Specificity
  ): Rule | null {
    for (;;) {
      for (;;) {
        const mode: ProcessingMode = (this.initial_ && specificity.toInitial_) ? this.initial_ : this;
        const rules = mode.rootRules_[specificity.ruleType_];
        if (specificity.nextRuleIndex_ < rules.length) {
          return rules[specificity.nextRuleIndex_++];
        }
        if (!this.initial_ || specificity.toInitial_) break;
        specificity.nextRuleIndex_ = 0;
        specificity.toInitial_ = true;
      }
      if (specificity.ruleType_ === RuleType.constructionRule) break;
      specificity.ruleType_ = RuleType.constructionRule;
      specificity.nextRuleIndex_ = 0;
      specificity.toInitial_ = false;
    }
    return null;
  }

  private groveRules(node: NodePtr, mgr: Messenger | null): GroveRules {
    const n = node.groveIndex();
    if (n >= this.groveRules_.length) {
      // Extend array
      while (this.groveRules_.length <= n) {
        this.groveRules_.push(new GroveRules());
      }
    }
    if (!this.groveRules_[n].built) {
      this.groveRules_[n].build(this.elementRules_, node, mgr);
    }
    return this.groveRules_[n];
  }

  private elementRuleAdvance(
    node: NodePtr,
    context: MatchContext,
    mgr: Messenger | null,
    specificity: Specificity,
    vec: (ElementRule | null)[]
  ): void {
    if (specificity.ruleType_ !== RuleType.constructionRule) {
      specificity.nextRuleIndex_++;
      return;
    }
    const hit = specificity.nextRuleIndex_;
    do {
      specificity.nextRuleIndex_++;
      if (specificity.nextRuleIndex_ >= vec.length) return;
      const hitRule = vec[hit];
      const nextRule = vec[specificity.nextRuleIndex_];
      if (!hitRule || !nextRule) return;
      if (hitRule.compareSpecificity(nextRule) !== 0) return;
    } while (!(vec[specificity.nextRuleIndex_]?.trivial() || vec[specificity.nextRuleIndex_]?.matches(node, context)));

    // Ambiguous match warning
    // Note: In C++ this is mgr.message(InterpreterMessages::ambiguousMatch)
    // For now, we skip the message as it requires proper MessageType integration
    do {
      specificity.nextRuleIndex_++;
      const hitRule = vec[hit];
      const nextRule = vec[specificity.nextRuleIndex_];
      if (!hitRule || !nextRule) return;
    } while (specificity.nextRuleIndex_ < vec.length && vec[hit]?.compareSpecificity(vec[specificity.nextRuleIndex_]!) === 0);
  }

  compile(interp: Interpreter): void {
    for (let i = 0; i < nRuleType; i++) {
      for (const rule of this.rootRules_[i]) {
        rule.action().compile(interp, i as RuleType);
      }
      for (const rule of this.elementRules_[i]) {
        rule.action().compile(interp, i as RuleType);
      }
    }
  }
}

// Identifier class - enhanced version from ELObj.ts
// Implements the Identifier interface which serves as a forward declaration
export class IdentifierImpl implements Identifier {
  private name_: StringC;
  private syntacticKey_: SyntacticKey = SyntacticKey.notKey;
  private defPart_: number = 0;
  private def_: Expression | null = null;
  private insn_: InsnPtr = null;
  private value_: ELObj | null = null;
  private flowObj_: FlowObj | null = null;
  private flowObjPart_: number = 0;
  private flowObjLoc_: Location = new Location();
  private defLoc_: Location = new Location();
  private beingComputed_: boolean = false;
  private charNIC_: boolean = false;
  private inheritedC_: InheritedC | null = null;
  private inheritedCPart_: number = 0;
  private inheritedCLoc_: Location = new Location();
  private builtin_: IdentifierImpl | null = null;
  private static preferBuiltin_: boolean = false;

  constructor(name: StringC) {
    this.name_ = name;
  }

  name(): StringC {
    return this.name_;
  }

  syntacticKey(key: { value: SyntacticKey }): boolean {
    if (this.syntacticKey_ === SyntacticKey.notKey) {
      return false;
    }
    key.value = this.syntacticKey_;
    return true;
  }

  setSyntacticKey(key: SyntacticKey): void {
    this.syntacticKey_ = key;
  }

  defined(part: { value: number }, loc: { value: Location | null }): boolean {
    if (!this.def_ && !this.value_) {
      return false;
    }
    part.value = this.defPart_;
    loc.value = this.defLoc_;
    return true;
  }

  private maybeSaveBuiltin(): void {
    if (this.defPart_ === 0xFFFFFFFF && !this.builtin_) {
      this.builtin_ = new IdentifierImpl(this.name_);
      if (this.value_) {
        this.builtin_.setValue(this.value_, this.defPart_);
      } else if (this.def_) {
        this.builtin_.setDefinition(this.def_, this.defPart_, this.defLoc_);
      }
    }
  }

  setDefinition(expr: Expression, part: number, loc: Location): void {
    this.maybeSaveBuiltin();
    this.def_ = expr;
    this.defPart_ = part;
    this.defLoc_ = loc;
    this.value_ = null;
  }

  setValue(value: ELObj, partIndex: number = 0xFFFFFFFF): void {
    this.maybeSaveBuiltin();
    this.value_ = value;
    this.defPart_ = partIndex;
  }

  evaluated(): boolean {
    return this.value_ !== null;
  }

  computeValue(force: boolean, interp: Interpreter): ELObj | null {
    if (this.builtin_ && IdentifierImpl.preferBuiltin_) {
      return this.builtin_.computeValue(force, interp);
    }
    if (this.value_) {
      return this.value_;
    }
    let preferred = false;
    if (this.defPart_ === 0xFFFFFFFF && !IdentifierImpl.preferBuiltin_) {
      IdentifierImpl.preferBuiltin_ = true;
      preferred = true;
    }
    if (!this.def_) {
      throw new Error('ASSERT: def_');
    }
    if (this.beingComputed_) {
      if (force) {
        interp.setNextLocation(this.defLoc_);
        interp.message(InterpreterMessages.identifierLoop, this.name_);
        this.value_ = interp.makeError();
      }
    } else {
      this.beingComputed_ = true;
      if (this.insn_ === null) {
        this.insn_ = Expression.optimizeCompile(
          { value: this.def_ },
          interp,
          new Environment(),
          0,
          null
        );
      }
      if (force || this.def_.canEval(false)) {
        const vm = new VM(interp);
        const v = vm.eval(this.insn_);
        interp.makePermanent(v);
        this.value_ = v;
      }
      this.beingComputed_ = false;
    }
    if (preferred) {
      IdentifierImpl.preferBuiltin_ = false;
    }
    return this.value_;
  }

  computeBuiltinValue(force: boolean, interp: Interpreter): ELObj | null {
    IdentifierImpl.preferBuiltin_ = true;
    const res = this.computeValue(force, interp);
    IdentifierImpl.preferBuiltin_ = false;
    return res;
  }

  inheritedC(): InheritedC | null {
    return this.inheritedC_;
  }

  inheritedCDefined(part: { value: number }, loc: { value: Location | null }): boolean {
    if (!this.inheritedC_) {
      return false;
    }
    part.value = this.inheritedCPart_;
    loc.value = this.inheritedCLoc_;
    return true;
  }

  charNICDefined(part: { value: number }, loc: { value: Location | null }): boolean {
    if (!this.charNIC_) {
      return false;
    }
    part.value = this.inheritedCPart_;
    loc.value = this.inheritedCLoc_;
    return true;
  }

  setCharNIC(part: number, loc: Location): void {
    this.charNIC_ = true;
    this.inheritedC_ = null;
    this.inheritedCPart_ = part;
    this.inheritedCLoc_ = loc;
  }

  setInheritedC(ic: InheritedC | null, part?: number, loc?: Location): void {
    this.inheritedC_ = ic;
    if (part !== undefined && loc !== undefined) {
      this.inheritedCPart_ = part;
      this.inheritedCLoc_ = loc;
    } else {
      this.inheritedCPart_ = 0xFFFFFFFF;
      this.inheritedCLoc_ = new Location();
    }
  }

  flowObj(): FlowObj | null {
    return this.flowObj_;
  }

  flowObjDefined(part: { value: number }, loc: { value: Location | null }): boolean {
    if (!this.flowObj_) {
      return false;
    }
    part.value = this.flowObjPart_;
    loc.value = this.flowObjLoc_;
    return true;
  }

  setFlowObj(fo: FlowObj | null, part?: number, loc?: Location): void {
    this.flowObj_ = fo;
    if (part !== undefined && loc !== undefined) {
      this.flowObjPart_ = part;
      this.flowObjLoc_ = loc;
    } else {
      this.flowObjPart_ = 0xFFFFFFFF;
    }
  }
}

// Main Interpreter class
export class Interpreter {
  private theNilObj_: NilObj;
  private theTrueObj_: TrueObj;
  private theFalseObj_: FalseObj;
  private theErrorObj_: ErrorObj;
  private theUnspecifiedObj_: UnspecifiedObj;
  private symbolTable_: Map<string, SymbolObj> = new Map();
  private identTable_: Map<string, IdentifierImpl> = new Map();
  private unitTable_: Map<string, Unit> = new Map();
  private externalProcTable_: Map<string, FunctionObj> = new Map();
  private messenger_: Messenger | null = null;
  private extensionTable_: any = null;
  private partIndex_: number = 0;
  private dPartIndex_: number = 1;
  private unitsPerInch_: number;
  private nInheritedC_: number = 0;
  private groveManager_: GroveManager | null = null;
  private initialProcessingMode_: ProcessingMode;
  private processingModeTable_: Map<string, ProcessingMode> = new Map();
  private portNames_: SymbolObj[] = new Array(nPortNames);
  private cValueSymbols_: ELObj[] = [];
  private namedCharTable_: Map<string, CharPart> = new Map();
  private sdataEntityNameTable_: Map<string, CharPart> = new Map();
  private sdataEntityTextTable_: Map<string, CharPart> = new Map();
  private initialValueNames_: IdentifierImpl[] = [];
  private initialValueValues_: Expression[] = [];
  private currentPartFirstInitialValue_: number = 0;
  private initialStyle_: StyleObj | null = null;
  private borderTrueStyle_: StyleObj | null = null;
  private borderFalseStyle_: StyleObj | null = null;
  private tableBorderC_: InheritedC | null = null;
  private cellBeforeRowBorderC_: InheritedC | null = null;
  private cellAfterRowBorderC_: InheritedC | null = null;
  private cellBeforeColumnBorderC_: InheritedC | null = null;
  private cellAfterColumnBorderC_: InheritedC | null = null;
  private fractionBarC_: InheritedC | null = null;
  private publicIds_: Set<string> = new Set();
  private nextGlyphSubstTableUniqueId_: number = 0;
  private addressNoneObj_: AddressObj;
  private emptyNodeListObj_: NodeListObj;
  private nodePropertyTable_: Map<string, number> = new Map();
  private debugMode_: boolean = false;
  private dsssl2_: boolean = false;
  private strictMode_: boolean = false;
  private defaultLanguage_: ELObj;
  private defaultLanguageDef_: Expression | null = null;
  private defaultLanguageDefPart_: number = 0;
  private defaultLanguageDefLoc_: Location = new Location();
  private charProperties_: Map<string, CharProp> = new Map();
  private classAttributeNames_: StringC[] = [];
  private idAttributeNames_: StringC[] = [];
  private nextLocation_: Location = new Location();

  // Lexical category map
  lexCategory_: number[] = new Array(65536).fill(LexCategory.lexOther);

  constructor(
    groveManager: GroveManager | null,
    messenger: Messenger | null,
    unitsPerInch: number,
    debugMode: boolean,
    dsssl2: boolean,
    strictMode: boolean,
    extensionTable: any
  ) {
    this.groveManager_ = groveManager;
    this.messenger_ = messenger;
    this.extensionTable_ = extensionTable;
    this.unitsPerInch_ = unitsPerInch;
    this.debugMode_ = debugMode;
    this.dsssl2_ = dsssl2;
    this.strictMode_ = strictMode;

    // Initialize singleton objects
    this.theNilObj_ = new NilObj();
    this.makePermanent(this.theNilObj_);
    this.theFalseObj_ = new FalseObj();
    this.makePermanent(this.theFalseObj_);
    this.theTrueObj_ = new TrueObj();
    this.makePermanent(this.theTrueObj_);
    this.theErrorObj_ = new ErrorObj();
    this.makePermanent(this.theErrorObj_);
    this.theUnspecifiedObj_ = new UnspecifiedObj();
    this.makePermanent(this.theUnspecifiedObj_);
    this.addressNoneObj_ = new AddressObj(Address.Type.none);
    this.makePermanent(this.addressNoneObj_);
    this.emptyNodeListObj_ = new NodePtrNodeListObj();
    this.makePermanent(this.emptyNodeListObj_);

    this.defaultLanguage_ = this.theFalseObj_;
    this.initialProcessingMode_ = new ProcessingMode();

    this.installSyntacticKeys();
    this.installCValueSymbols();
    this.installPortNames();
    this.installPrimitives();
    this.installUnits();
    if (!strictMode) {
      this.installCharNames();
      this.installSdata();
    }
    this.installFlowObjs();
    this.installInheritedCs();
    this.installNodeProperties();

    // Initialize lexical categories
    const lexCategories = [
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      '!$%&*/<=>?~_^:',
      '',
      '0123456789',
      '-+.',
      '',
      '();\"',
      ' \t\r\n\f',
      ''
    ];

    // Set default to delimiter for special characters
    this.lexCategory_[0xFFFF] = LexCategory.lexDelimiter; // End of entity

    for (let i = 0; i < lexCategories.length; i++) {
      for (const ch of lexCategories[i]) {
        this.lexCategory_[ch.charCodeAt(0)] = i;
      }
    }

    if (!strictMode) {
      for (let i = 127; i < 0x10000; i++) {
        this.lexCategory_[i] = LexCategory.lexAddNameStart;
      }
    }

    this.initialProcessingMode_.setDefined();
    this.installBuiltins();
    this.installCharProperties();
  }

  // Object creation methods
  makeNil(): NilObj {
    return this.theNilObj_;
  }

  makeTrue(): TrueObj {
    return this.theTrueObj_;
  }

  makeFalse(): FalseObj {
    return this.theFalseObj_;
  }

  makeError(): ErrorObj {
    return this.theErrorObj_;
  }

  makeUnspecified(): UnspecifiedObj {
    return this.theUnspecifiedObj_;
  }

  makeInteger(n: number): IntegerObj {
    return new IntegerObj(n);
  }

  makeReal(n: number): RealObj {
    return new RealObj(n);
  }

  makeChar(c: Char): CharObj {
    return new CharObj(c);
  }

  makeString(chars: number[] | string): StringObj {
    if (typeof chars === 'string') {
      return new StringObj(chars);
    }
    // Convert array of char codes to string
    return new StringObj(String.fromCharCode(...chars));
  }

  makeLength(val: number, _dim?: number): LengthObj {
    // LengthObj constructor only takes units (dim is implicitly 1)
    return new LengthObj(val);
  }

  makePair(car: ELObj, cdr: ELObj): PairObj {
    return new PairObj(car, cdr);
  }

  makeAddressNone(): AddressObj {
    return this.addressNoneObj_;
  }

  makeEmptyNodeList(): NodeListObj {
    return this.emptyNodeListObj_;
  }

  makeSymbol(str: StringC): SymbolObj {
    const strKey = stringCToString(str);
    let sym = this.symbolTable_.get(strKey);
    if (!sym) {
      const strObj = new StringObj(strKey);
      this.makePermanent(strObj);
      sym = new SymbolObj(strObj);
      this.makePermanent(sym);
      this.symbolTable_.set(strKey, sym);
    }
    return sym;
  }

  makeKeyword(str: StringC): KeywordObj {
    const ident = this.lookup(str);
    return new KeywordObj(ident);  // Use the IdentifierImpl from lookup
  }

  makeLangObj(): LangObj {
    return new LangObj();
  }

  // Convert a JavaScript string character name to a character code
  convertCharNameStr(name: string, ch: { value: number }): boolean {
    // Standard Scheme character names
    const charNames: Record<string, number> = {
      'space': 0x20,
      'newline': 0x0A,
      'tab': 0x09,
      'return': 0x0D,
      'backspace': 0x08,
      'delete': 0x7F,
      'escape': 0x1B,
      'null': 0x00,
      'alarm': 0x07,
      'formfeed': 0x0C,
      'linefeed': 0x0A,
      'vtab': 0x0B,
      'page': 0x0C,
      // Common Unicode names
      'nbsp': 0xA0,
      'en-space': 0x2002,
      'em-space': 0x2003,
      'thin-space': 0x2009,
      'zero-width-space': 0x200B,
      'hyphen': 0x2010,
      'non-breaking-hyphen': 0x2011,
      'figure-dash': 0x2012,
      'en-dash': 0x2013,
      'em-dash': 0x2014,
    };

    // Check for standard name
    const lower = name.toLowerCase();
    if (lower in charNames) {
      ch.value = charNames[lower];
      return true;
    }

    // Check for hex char (U+XXXX or x followed by hex digits)
    if (lower.startsWith('u+') || lower.startsWith('x')) {
      const hexPart = lower.startsWith('u+') ? name.slice(2) : name.slice(1);
      const code = parseInt(hexPart, 16);
      if (!isNaN(code) && code >= 0 && code <= 0x10FFFF) {
        ch.value = code;
        return true;
      }
    }

    // Check for decimal number
    const decimal = parseInt(name, 10);
    if (!isNaN(decimal) && decimal >= 0 && decimal <= 0x10FFFF && /^\d+$/.test(name)) {
      ch.value = decimal;
      return true;
    }

    return false;
  }

  isError(obj: ELObj): boolean {
    return obj === this.theErrorObj_;
  }

  isUnspecified(obj: ELObj): boolean {
    return obj === this.theUnspecifiedObj_;
  }

  // Identifier lookup
  lookup(str: StringC): IdentifierImpl {
    const strKey = stringCToString(str);
    let ident = this.identTable_.get(strKey);
    if (!ident) {
      ident = new IdentifierImpl(str);
      this.identTable_.set(strKey, ident);
    }
    return ident;
  }

  lookupUnit(str: StringC): Unit {
    const strKey = stringCToString(str);
    let unit = this.unitTable_.get(strKey);
    if (!unit) {
      unit = new Unit(str);
      this.unitTable_.set(strKey, unit);
    }
    return unit;
  }

  lookupProcessingMode(str: StringC): ProcessingMode {
    const strKey = stringCToString(str);
    let mode = this.processingModeTable_.get(strKey);
    if (!mode) {
      mode = new ProcessingMode(str, this.initialProcessingMode_);
      this.processingModeTable_.set(strKey, mode);
    }
    return mode;
  }

  lookupExternalProc(pubid: StringC): FunctionObj | null {
    return this.externalProcTable_.get(stringCToString(pubid)) ?? null;
  }

  // Property accessors
  unitsPerInch(): number {
    return this.unitsPerInch_;
  }

  currentPartIndex(): number {
    return this.partIndex_;
  }

  debugMode(): boolean {
    return this.debugMode_;
  }

  dsssl2(): boolean {
    return this.dsssl2_;
  }

  strictMode(): boolean {
    return this.strictMode_;
  }

  groveManager(): GroveManager | null {
    return this.groveManager_;
  }

  initialStyle(): StyleObj | null {
    return this.initialStyle_;
  }

  borderTrueStyle(): StyleObj | null {
    return this.borderTrueStyle_;
  }

  borderFalseStyle(): StyleObj | null {
    return this.borderFalseStyle_;
  }

  initialProcessingMode(): ProcessingMode {
    return this.initialProcessingMode_;
  }

  portName(i: PortName): SymbolObj {
    return this.portNames_[i];
  }

  cValueSymbol(sym: FOTSymbol): ELObj {
    return this.cValueSymbols_[sym] ?? this.theFalseObj_;
  }

  tableBorderC(): InheritedC | null {
    return this.tableBorderC_;
  }

  cellBeforeRowBorderC(): InheritedC | null {
    return this.cellBeforeRowBorderC_;
  }

  cellAfterRowBorderC(): InheritedC | null {
    return this.cellAfterRowBorderC_;
  }

  cellBeforeColumnBorderC(): InheritedC | null {
    return this.cellBeforeColumnBorderC_;
  }

  cellAfterColumnBorderC(): InheritedC | null {
    return this.cellAfterColumnBorderC_;
  }

  fractionBarC(): InheritedC | null {
    return this.fractionBarC_;
  }

  allocGlyphSubstTableUniqueId(): number {
    return this.nextGlyphSubstTableUniqueId_++;
  }

  defaultLanguage(): ELObj {
    return this.defaultLanguage_;
  }

  // Message handling
  setNextLocation(loc: Location): void {
    this.nextLocation_ = loc;
  }

  message(msgType: string, ...args: any[]): void {
    if (this.messenger_) {
      // In TypeScript, we'd need to implement proper message handling
      // For now, just log to console
      console.error(`[${msgType}]`, ...args);
    }
  }

  dispatchMessage(msg: Message): void {
    if (this.messenger_) {
      this.messenger_.dispatchMessage(msg);
    }
  }

  // String conversion utility
  static makeStringC(s: string | null): StringC {
    return stringToStringC(s ?? '');
  }

  // Normalize a general name using grove's normalization (usually case-folding)
  static normalizeGeneralName(node: NodePtr, gi: StringC): void {
    // In SGML, general names (element/attribute names) are typically normalized
    // using the general substitution table from the SGML declaration.
    // This converts names to a canonical form (typically lowercase).

    // Get the general substitution table from the grove root
    const nodeObj = node.node();
    if (!nodeObj) {
      // Fall back to lowercase
      Interpreter.lowercaseStringC(gi);
      return;
    }
    const tem = new NodePtr();
    const rootResult = nodeObj.getGroveRoot(tem);
    if (rootResult !== AccessResult.accessOK || !tem.node()) {
      // Fall back to lowercase
      Interpreter.lowercaseStringC(gi);
      return;
    }
    const sdResult = tem.node()!.queryInterface('SdNode');
    if (!sdResult.result || !sdResult.ptr) {
      // Fall back to lowercase
      Interpreter.lowercaseStringC(gi);
      return;
    }
    const sdNode = sdResult.ptr as any;
    const sd = sdNode.getSd();
    if (sd.result !== AccessResult.accessOK || !sd.prologSyntax) {
      // Fall back to lowercase
      Interpreter.lowercaseStringC(gi);
      return;
    }
    const substTable = sd.prologSyntax.generalSubstTable();
    if (!substTable) {
      // Fall back to lowercase
      Interpreter.lowercaseStringC(gi);
      return;
    }
    substTable.subst(gi);
  }

  // Fall back for case-folding when SD info isn't available
  private static lowercaseStringC(str: StringC): void {
    if (!str.ptr_) return;
    for (let i = 0; i < str.length_; i++) {
      const c = str.ptr_[i];
      // ASCII uppercase A-Z to lowercase a-z
      if (c >= 0x41 && c <= 0x5A) {
        str.ptr_[i] = c + 0x20;
      }
    }
  }

  // Lexical category lookup
  lexCategory(c: number): LexCategory {
    if (c < 0 || c >= this.lexCategory_.length) {
      return LexCategory.lexOther;
    }
    return this.lexCategory_[c];
  }

  // End of part/declaration
  endPart(): void {
    this.currentPartFirstInitialValue_ = this.initialValueNames_.length;
    this.partIndex_++;
  }

  dEndPart(): void {
    this.dPartIndex_++;
  }

  // Installation methods (to be filled in)
  private installSyntacticKeys(): void {
    // Install syntactic keywords - matches upstream Interpreter.cxx
    const keys: [string, SyntacticKey][] = [
      ['quote', SyntacticKey.keyQuote],
      ['lambda', SyntacticKey.keyLambda],
      ['if', SyntacticKey.keyIf],
      ['cond', SyntacticKey.keyCond],
      ['and', SyntacticKey.keyAnd],
      ['or', SyntacticKey.keyOr],
      ['case', SyntacticKey.keyCase],
      ['let', SyntacticKey.keyLet],
      ['let*', SyntacticKey.keyLetStar],
      ['letrec', SyntacticKey.keyLetrec],
      ['quasiquote', SyntacticKey.keyQuasiquote],
      ['unquote', SyntacticKey.keyUnquote],
      ['unquote-splicing', SyntacticKey.keyUnquoteSplicing],
      ['define', SyntacticKey.keyDefine],
      ['else', SyntacticKey.keyElse],
      ['=>', SyntacticKey.keyArrow],
      ['make', SyntacticKey.keyMake],
      ['style', SyntacticKey.keyStyle],
      ['with-mode', SyntacticKey.keyWithMode],
      ['define-unit', SyntacticKey.keyDefineUnit],
      ['element', SyntacticKey.keyElement],
      ['default', SyntacticKey.keyDefault],
      ['root', SyntacticKey.keyRoot],
      ['id', SyntacticKey.keyId],
      ['mode', SyntacticKey.keyMode],
      ['declare-initial-value', SyntacticKey.keyDeclareInitialValue],
      ['declare-characteristic', SyntacticKey.keyDeclareCharacteristic],
      ['declare-flow-object-class', SyntacticKey.keyDeclareFlowObjectClass],
      ['declare-default-language', SyntacticKey.keyDeclareDefaultLanguage],
      ['declare-char-property', SyntacticKey.keyDeclareCharProperty],
      ['define-language', SyntacticKey.keyDefineLanguage],
      ['add-char-properties', SyntacticKey.keyAddCharProperties],
      ['use', SyntacticKey.keyUse],
      ['label', SyntacticKey.keyLabel],
      ['content-map', SyntacticKey.keyContentMap],
      ['data', SyntacticKey.keyData]
    ];

    for (const [name, key] of keys) {
      const tem = Interpreter.makeStringC(name);
      this.lookup(tem).setSyntacticKey(key);
      // DSSSL2 allows question marks at end to be optional
      if (this.dsssl2() && stringCEndsWith(tem, '?')) {
        this.lookup(stringCSlice(tem, 0, -1)).setSyntacticKey(key);
      }
    }

    if (this.dsssl2()) {
      const keys2: [string, SyntacticKey][] = [
        ['set!', SyntacticKey.keySet],
        ['begin', SyntacticKey.keyBegin],
        ['declare-class-attribute', SyntacticKey.keyDeclareClassAttribute],
        ['declare-id-attribute', SyntacticKey.keyDeclareIdAttribute],
        ['declare-flow-object-macro', SyntacticKey.keyDeclareFlowObjectMacro],
        ['or-element', SyntacticKey.keyOrElement]
      ];
      for (const [name, key] of keys2) {
        this.lookup(Interpreter.makeStringC(name)).setSyntacticKey(key);
      }
    }
  }

  private installCValueSymbols(): void {
    this.cValueSymbols_[0] = this.makeFalse();
    this.cValueSymbols_[1] = this.makeTrue();
    // TODO: Install other FOTBuilder symbols
  }

  private installPortNames(): void {
    const names = [
      'numerator', 'denominator', 'pre-sup', 'pre-sub',
      'post-sup', 'post-sub', 'mid-sup', 'mid-sub',
      'over-mark', 'under-mark', 'open', 'close',
      'degree', 'operator', 'lower-limit', 'upper-limit',
      'header', 'footer'
    ];
    for (let i = 0; i < names.length; i++) {
      this.portNames_[i] = this.makeSymbol(Interpreter.makeStringC(names[i]));
    }
  }

  private installPrimitives(): void {
    // Install all primitive procedures from primitive.ts
    for (const [name, factory] of primitives) {
      this.installPrimitive(name, factory());
    }
    // Install special primitives not in the primitives map
    const apply = new ApplyPrimitiveObj();
    this.makePermanent(apply);
    this.lookup(Interpreter.makeStringC('apply')).setValue(apply);
  }

  private installPrimitive(name: string, value: PrimitiveObj): void {
    this.makePermanent(value);
    const ident = this.lookup(Interpreter.makeStringC(name));
    ident.setValue(value);
    value.setIdentifier(ident);
  }

  // Install extension flow object class
  installExtensionFlowObjectClass(ident: IdentifierImpl, pubid: StringC, loc: Location): void {
    const pubidStr = stringCToString(pubid);
    let flowObj: FlowObj | null = null;

    // Check for known flow object classes
    if (pubidStr === 'UNREGISTERED::James Clark//Flow Object Class::formatting-instruction') {
      flowObj = new FormattingInstructionFlowObj();
    } else {
      // Create unknown flow object for unrecognized classes
      flowObj = new UnknownFlowObj(pubidStr);
    }

    this.makePermanent(flowObj);
    ident.setFlowObj(flowObj, this.currentPartIndex(), loc);
  }

  private installUnits(): void {
    const units: [string, number, number][] = [
      ['m', 5000, 127],
      ['cm', 50, 127],
      ['mm', 5, 127],
      ['in', 1, 1],
      ['pt', 1, 72],
      ['pica', 1, 6],
      ['pc', 1, 6]
    ];

    const nUnits = this.dsssl2() ? units.length : units.length - 1;
    for (let i = 0; i < nUnits; i++) {
      const [name, numer, denom] = units[i];
      const unit = this.lookupUnit(Interpreter.makeStringC(name));
      const n = this.unitsPerInch_ * numer;
      if (n % denom === 0) {
        unit.setValue(n / denom);
      } else {
        unit.setValue(n / denom, true);
      }
    }
  }

  private installCharNames(): void {
    // Install named characters from charNames.h
    // Unicode code point to character name mappings
    const charNames: [number, string][] = [
      [0x000a, 'line-feed'],
      [0x000d, 'carriage-return'],
      [0x0020, 'space'],
      [0x0021, 'exclamation-mark'],
      [0x0022, 'quotation-mark'],
      [0x0023, 'number-sign'],
      [0x0024, 'dollar-sign'],
      [0x0025, 'percent-sign'],
      [0x0026, 'ampersand'],
      [0x0027, 'apostrophe'],
      [0x0028, 'left-parenthesis'],
      [0x0029, 'right-parenthesis'],
      [0x002a, 'asterisk'],
      [0x002b, 'plus-sign'],
      [0x002c, 'comma'],
      [0x002d, 'hyphen-minus'],
      [0x002e, 'full-stop'],
      [0x002f, 'solidus'],
      [0x0030, 'digit-zero'],
      [0x0031, 'digit-one'],
      [0x0032, 'digit-two'],
      [0x0033, 'digit-three'],
      [0x0034, 'digit-four'],
      [0x0035, 'digit-five'],
      [0x0036, 'digit-six'],
      [0x0037, 'digit-seven'],
      [0x0038, 'digit-eight'],
      [0x0039, 'digit-nine'],
      [0x003a, 'colon'],
      [0x003b, 'semicolon'],
      [0x003c, 'less-than-sign'],
      [0x003d, 'equals-sign'],
      [0x003e, 'greater-than-sign'],
      [0x003f, 'question-mark'],
      [0x0040, 'commercial-at'],
      [0x0041, 'latin-capital-letter-a'],
      [0x0042, 'latin-capital-letter-b'],
      [0x0043, 'latin-capital-letter-c'],
      [0x0044, 'latin-capital-letter-d'],
      [0x0045, 'latin-capital-letter-e'],
      [0x0046, 'latin-capital-letter-f'],
      [0x0047, 'latin-capital-letter-g'],
      [0x0048, 'latin-capital-letter-h'],
      [0x0049, 'latin-capital-letter-i'],
      [0x004a, 'latin-capital-letter-j'],
      [0x004b, 'latin-capital-letter-k'],
      [0x004c, 'latin-capital-letter-l'],
      [0x004d, 'latin-capital-letter-m'],
      [0x004e, 'latin-capital-letter-n'],
      [0x004f, 'latin-capital-letter-o'],
      [0x0050, 'latin-capital-letter-p'],
      [0x0051, 'latin-capital-letter-q'],
      [0x0052, 'latin-capital-letter-r'],
      [0x0053, 'latin-capital-letter-s'],
      [0x0054, 'latin-capital-letter-t'],
      [0x0055, 'latin-capital-letter-u'],
      [0x0056, 'latin-capital-letter-v'],
      [0x0057, 'latin-capital-letter-w'],
      [0x0058, 'latin-capital-letter-x'],
      [0x0059, 'latin-capital-letter-y'],
      [0x005a, 'latin-capital-letter-z'],
      [0x005b, 'left-square-bracket'],
      [0x005c, 'reverse-solidus'],
      [0x005d, 'right-square-bracket'],
      [0x005e, 'circumflex-accent'],
      [0x005f, 'low-line'],
      [0x0060, 'grave-accent'],
      [0x0061, 'latin-small-letter-a'],
      [0x0062, 'latin-small-letter-b'],
      [0x0063, 'latin-small-letter-c'],
      [0x0064, 'latin-small-letter-d'],
      [0x0065, 'latin-small-letter-e'],
      [0x0066, 'latin-small-letter-f'],
      [0x0067, 'latin-small-letter-g'],
      [0x0068, 'latin-small-letter-h'],
      [0x0069, 'latin-small-letter-i'],
      [0x006a, 'latin-small-letter-j'],
      [0x006b, 'latin-small-letter-k'],
      [0x006c, 'latin-small-letter-l'],
      [0x006d, 'latin-small-letter-m'],
      [0x006e, 'latin-small-letter-n'],
      [0x006f, 'latin-small-letter-o'],
      [0x0070, 'latin-small-letter-p'],
      [0x0071, 'latin-small-letter-q'],
      [0x0072, 'latin-small-letter-r'],
      [0x0073, 'latin-small-letter-s'],
      [0x0074, 'latin-small-letter-t'],
      [0x0075, 'latin-small-letter-u'],
      [0x0076, 'latin-small-letter-v'],
      [0x0077, 'latin-small-letter-w'],
      [0x0078, 'latin-small-letter-x'],
      [0x0079, 'latin-small-letter-y'],
      [0x007a, 'latin-small-letter-z'],
      [0x007b, 'left-curly-bracket'],
      [0x007c, 'vertical-line'],
      [0x007d, 'right-curly-bracket'],
      [0x007e, 'tilde'],
      [0x00a0, 'no-break-space'],
    ];

    for (const [code, name] of charNames) {
      this.namedCharTable_.set(name, { c: code, defPart: 0 });
    }
  }

  private installSdata(): void {
    // Install SDATA entity mappings - would include sdata.h content
  }

  private installFlowObjs(): void {
    // Install flow object classes
    const flowObjNames = [
      'sequence',
      'display-group',
      'paragraph',
      'paragraph-break',
      'line-field',
      'score',
      'external-graphic',
      'rule',
      'leader',
      'character',
      'box',
      'alignment-point',
      'sideline',
      // simple-page
      'simple-page-sequence',
      // tables
      'table',
      'table-part',
      'table-column',
      'table-row',
      'table-cell',
      'table-border',
      // online
      'link',
      'scroll',
      'marginalia',
      'multi-mode',
      // math
      'math-sequence',
      'fraction',
      'unmath',
      'superscript',
      'subscript',
      'script',
      'mark',
      'fence',
      'radical',
      'math-operator',
      'grid',
      'grid-cell'
    ];

    for (const name of flowObjNames) {
      const flowObj = createFlowObj(name);
      if (flowObj) {
        const ident = this.lookup(Interpreter.makeStringC(name));
        ident.setFlowObj(flowObj);
        this.makePermanent(flowObj);
      }
    }
  }

  private installInheritedCs(): void {
    // Install inherited characteristics
  }

  private installNodeProperties(): void {
    // Install node property names
  }

  private installBuiltins(): void {
    // Install built-in Scheme definitions
  }

  private installCharProperties(): void {
    // Install character properties
  }

  // Compilation
  compile(): void {
    this.compileInitialValues();
    this.initialProcessingMode_.compile(this);

    for (const mode of this.processingModeTable_.values()) {
      mode.compile(this);
    }

    this.compileCharProperties();
    this.compileDefaultLanguage();
  }

  private compileInitialValues(): void {
    const ics: InheritedC[] = [];
    for (let i = 0; i < this.initialValueNames_.length; i++) {
      const ident = this.initialValueNames_[i];
      const expr = this.initialValueValues_[i];
      const ic = ident.inheritedC();
      if (!ic) continue;

      const owner = { value: expr as Expression | null };
      expr.optimize(this, new Environment(), owner);
      const val = owner.value?.constantValue();

      if (val) {
        const tem = ic.make(val, owner.value!.location(), this);
        if (tem) {
          ics.push(tem);
        }
      } else {
        ics.push(new VarInheritedC(
          ic,
          owner.value!.compile(this, new Environment(), 0, null),
          owner.value!.location()
        ));
      }
    }

    if (ics.length > 0) {
      const forceIcs: InheritedC[] = [];
      this.initialStyle_ = new VarStyleObj(
        new StyleSpec(forceIcs, ics),
        null,
        null,
        new NodePtr()
      );
      this.makePermanent(this.initialStyle_);
    }
  }

  installInitialValue(ident: IdentifierImpl, expr: Expression): void {
    for (let i = 0; i < this.initialValueNames_.length; i++) {
      if (ident === this.initialValueNames_[i]) {
        if (i >= this.currentPartFirstInitialValue_) {
          this.setNextLocation(expr.location());
          this.message(
            InterpreterMessages.duplicateInitialValue,
            ident.name(),
            this.initialValueValues_[i].location()
          );
        }
        return;
      }
    }
    this.initialValueValues_.push(expr);
    this.initialValueNames_.push(ident);
  }

  private compileCharProperties(): void {
    for (const [key, val] of this.charProperties_) {
      if (!val.def.obj) {
        this.setNextLocation(val.loc);
        this.message(InterpreterMessages.unknownCharProperty, key);
        val.def = { obj: this.makeError(), defPart: 0 };
      }
    }
  }

  setDefaultLanguage(expr: Expression, part: number, loc: Location): void {
    this.defaultLanguageDef_ = expr;
    this.defaultLanguageDefPart_ = part;
    this.defaultLanguageDefLoc_ = loc;
  }

  defaultLanguageSet(part: { value: number }, loc: { value: Location | null }): boolean {
    if (this.defaultLanguageDef_) {
      part.value = this.defaultLanguageDefPart_;
      loc.value = this.defaultLanguageDefLoc_;
      return true;
    }
    return false;
  }

  private compileDefaultLanguage(): void {
    if (this.defaultLanguageDef_) {
      const insn = Expression.optimizeCompile(
        this.defaultLanguageDef_,
        this,
        new Environment(),
        0,
        null
      );
      const vm = new VM(this);
      const obj = vm.eval(insn);
      if (!obj.asLanguage()) {
        if (!this.isError(obj)) {
          this.setNextLocation(this.defaultLanguageDefLoc_);
          this.message(InterpreterMessages.defLangDeclRequiresLanguage, obj);
        }
        return;
      }
      this.makePermanent(obj);
      this.defaultLanguage_ = obj;
    }
  }

  // Object management - simplified from C++ Collector (JS has native GC)
  makePermanent(obj: ELObj): void {
    obj.setPermanent(true);
  }

  // Read-only support
  makeReadOnly(obj: ELObj): void {
    if (this.dsssl2()) {
      obj.setReadOnly(true);
    }
  }

  // Character property methods
  charProperty(prop: StringC, c: Char, loc: Location, def: ELObj | null): ELObj {
    const propKey = stringCToString(prop);
    const cp = this.charProperties_.get(propKey);
    if (!cp) {
      this.setNextLocation(loc);
      this.message(InterpreterMessages.unknownCharProperty, propKey);
      return this.makeError();
    }

    const entry = cp.map.get(c);
    if (entry?.obj) {
      return entry.obj;
    } else if (def) {
      return def;
    } else {
      return cp.def.obj ?? this.makeFalse();
    }
  }

  addCharProperty(prop: IdentifierImpl, defval: Expression): void {
    const owner = { value: defval as Expression | null };
    defval.optimize(this, new Environment(), owner);
    if (!owner.value?.constantValue()) {
      this.setNextLocation(owner.value!.location());
      this.message(InterpreterMessages.varCharPropertyExprUnsupported);
      return;
    }
    this.makePermanent(owner.value.constantValue()!);
    const val: ELObjPart = { obj: owner.value.constantValue(), defPart: this.partIndex_ };
    const propKey = stringCToString(prop.name());
    const cp = this.charProperties_.get(propKey);

    if (cp) {
      if (this.partIndex_ < cp.def.defPart) {
        cp.def = val;
      } else if (this.partIndex_ === cp.def.defPart &&
                 cp.def.obj && val.obj &&
                 !ELObj.eqv(val.obj, cp.def.obj)) {
        this.setNextLocation(owner.value.location());
        this.message(
          InterpreterMessages.duplicateCharPropertyDecl,
          propKey,
          cp.loc
        );
      }
    } else {
      this.charProperties_.set(propKey, {
        map: new Map(),
        def: val,
        loc: owner.value.location()
      });
    }
  }

  setCharProperty(prop: IdentifierImpl, c: Char, val: Expression): void {
    const owner = { value: val };
    val.optimize(this, new Environment(), owner);
    if (!owner.value.constantValue()) {
      this.setNextLocation(owner.value.location());
      this.message(InterpreterMessages.varCharPropertyExprUnsupported);
      return;
    }
    this.makePermanent(owner.value.constantValue()!);

    const propKey = stringCToString(prop.name());
    let cp = this.charProperties_.get(propKey);
    if (!cp) {
      cp = {
        map: new Map(),
        def: { obj: null, defPart: 0xFFFFFFFF },
        loc: owner.value.location()
      };
      this.charProperties_.set(propKey, cp);
    }

    const obj: ELObjPart = { obj: owner.value.constantValue(), defPart: this.partIndex_ };
    const existing = cp.map.get(c);

    if (existing?.obj) {
      if (this.partIndex_ < existing.defPart) {
        cp.map.set(c, obj);
      } else if (this.partIndex_ === existing.defPart &&
                 !ELObj.eqv(obj.obj!, existing.obj)) {
        this.setNextLocation(owner.value.location());
        this.message(
          InterpreterMessages.duplicateAddCharProperty,
          propKey,
          String.fromCharCode(c)
        );
      }
    } else {
      cp.map.set(c, obj);
    }
  }

  // Node property lookup
  lookupNodeProperty(str: StringC): { found: boolean; id: number } {
    const strKey = stringCToString(str);
    const val = this.nodePropertyTable_.get(strKey);
    if (val !== undefined) {
      return { found: true, id: val };
    }
    // Try lowercase
    const tem = strKey.toLowerCase();
    const val2 = this.nodePropertyTable_.get(tem);
    if (val2 !== undefined) {
      return { found: true, id: val2 };
    }
    return { found: false, id: 0 };
  }

  // Add class/id attribute names
  addClassAttributeName(name: StringC): void {
    this.classAttributeNames_.push(name);
  }

  addIdAttributeName(name: StringC): void {
    this.idAttributeNames_.push(name);
  }

  // Convert number from string
  convertNumber(sc: StringC, radix: number = 10): ELObj | null {
    const str = stringCToString(sc);
    if (str.length === 0) {
      return null;
    }

    let i = 0;
    if (str[0] === '#') {
      if (str.length < 2) return null;
      switch (str[1]) {
        case 'd': radix = 10; break;
        case 'x': radix = 16; break;
        case 'o': radix = 8; break;
        case 'b': radix = 2; break;
        default: return null;
      }
      i += 2;
    }

    if (i >= str.length) return null;

    let negative = false;
    if (str[i] === '-') {
      negative = true;
      i++;
    } else if (str[i] === '+') {
      i++;
    }

    let hadDecimalPoint = false;
    let hadDigit = false;
    let n = 0;
    let exp = 0;

    for (; i < str.length; i++) {
      const c = str.charCodeAt(i);
      let weight = -1;

      if (c >= 0x30 && c <= 0x39) { // 0-9
        weight = c - 0x30;
      } else if (c >= 0x61 && c <= 0x66) { // a-f
        weight = 10 + (c - 0x61);
      } else if (c >= 0x41 && c <= 0x46) { // A-F
        weight = 10 + (c - 0x41);
      }

      if (weight >= 0 && weight < radix) {
        hadDigit = true;
        if (negative) {
          n = n * radix - weight;
        } else {
          n = n * radix + weight;
        }
        if (hadDecimalPoint) {
          exp--;
        }
      } else if (c === 0x2E && radix === 10) { // '.'
        if (hadDecimalPoint) return null;
        hadDecimalPoint = true;
      } else {
        break;
      }
    }

    if (!hadDigit || (radix !== 10 && i < str.length)) {
      return null;
    }

    // Handle exponent
    if (i + 1 < str.length && str[i] === 'e') {
      hadDecimalPoint = true;
      i++;
      const expResult = this.scanSignDigitsStr(str, i);
      if (!expResult.success) return null;
      exp += expResult.value;
      i = expResult.newIndex;
    }

    // Handle unit
    if (i < str.length) {
      const unitResult = this.scanUnitStr(str, i);
      if (!unitResult) return null;
      // Return unresolved quantity with unit
      // TODO: Implement UnresolvedLengthObj/UnresolvedQuantityObj
      return this.convertNumberFloatStr(str);
    }

    if (hadDecimalPoint) {
      return this.convertNumberFloatStr(str);
    }

    return this.makeInteger(n);
  }

  private scanSignDigitsStr(str: string, i: number): { success: boolean; value: number; newIndex: number } {
    let negative = false;
    if (i < str.length) {
      if (str[i] === '-') {
        i++;
        negative = true;
      } else if (str[i] === '+') {
        i++;
      }
    }

    const j = i;
    let n = 0;
    while (i < str.length && str[i] >= '0' && str[i] <= '9') {
      if (negative) {
        n = n * 10 - (str.charCodeAt(i) - 0x30);
      } else {
        n = n * 10 + (str.charCodeAt(i) - 0x30);
      }
      i++;
    }

    if (i === j) {
      return { success: false, value: 0, newIndex: i };
    }

    return { success: true, value: n, newIndex: i };
  }

  private scanUnitStr(str: string, i: number): { unit: Unit; exp: number } | null {
    let unitName = '';
    while (i < str.length) {
      const c = str[i];
      if (c === '-' || c === '+' || (c >= '0' && c <= '9')) {
        break;
      }
      unitName += c;
      i++;
    }

    let unitExp = 1;
    if (i < str.length) {
      unitExp = 0;
      let neg = false;
      if (str[i] === '-' || str[i] === '+') {
        if (str[i] === '-') neg = true;
        i++;
        if (i >= str.length) return null;
      }
      while (i < str.length) {
        if (str[i] < '0' || str[i] > '9') return null;
        unitExp *= 10;
        if (neg) {
          unitExp -= (str.charCodeAt(i) - 0x30);
        } else {
          unitExp += (str.charCodeAt(i) - 0x30);
        }
        i++;
      }
    }

    return { unit: this.lookupUnit(stringToStringC(unitName)), exp: unitExp };
  }

  private convertNumberFloatStr(str: string): ELObj | null {
    // Skip optional radix prefix
    let i0 = 0;
    if (str.length > 1 && str[0] === '#' && str[1] === 'd') {
      i0 = 2;
    }

    let buf = '';
    for (let i = i0; i < str.length; i++) {
      if (str[i] === 'E') break; // E is not valid for us
      buf += str[i];
    }

    const val = parseFloat(buf);
    if (isNaN(val)) return null;

    if (buf.length === str.length - i0) {
      return new RealObj(val);
    }

    // Has unit suffix - need to parse and resolve
    return new RealObj(val); // Simplified for now
  }

  // Glyph ID conversion
  convertGlyphId(str: Uint32Array, len: number, loc: Location): ELObj {
    let n = 0;
    let publicId: string | null = null;

    for (let i = len; i > 1; --i) {
      if (str[i - 1] === 0x3A && str[i - 2] === 0x3A && i < len && str[i] !== 0x30) { // '::'
        for (let j = i; j < len; j++) {
          n = n * 10 + (str[j] - 0x30);
        }
        publicId = this.storePublicId(str, i - 2, loc);
        break;
      }
      if (str[i - 1] < 0x30 || str[i - 1] > 0x39) { // not digit
        break;
      }
    }

    if (!publicId) {
      publicId = this.storePublicId(str, len, loc);
    }

    return new GlyphIdObj({ publicId, suffix: n });
  }

  private storePublicId(s: Uint32Array, n: number, loc: Location): string {
    let buf = '';
    for (let i = 0; i < n; i++) {
      if (s[i] >= 128) {
        this.setNextLocation(loc);
        this.message(InterpreterMessages.invalidPublicIdChar, String.fromCharCode(s[i]));
      } else {
        buf += String.fromCharCode(s[i]);
      }
    }
    this.publicIds_.add(buf);
    return buf;
  }

  // Character name conversion
  convertCharName(str: StringC): { found: boolean; c: Char } {
    const strKey = stringCToString(str);
    const cp = this.namedCharTable_.get(strKey);
    if (cp) {
      return { found: true, c: cp.c };
    }
    return Interpreter.convertUnicodeCharName(str);
  }

  private static convertUnicodeCharName(str: StringC): { found: boolean; c: Char } {
    if (str.length_ !== 6) {
      return { found: false, c: 0 };
    }
    if (!str.ptr_ || str.ptr_[0] !== 0x55 || str.ptr_[1] !== 0x2D) { // 'U' and '-'
      return { found: false, c: 0 };
    }

    let value = 0;
    for (let i = 2; i < 6; i++) {
      value <<= 4;
      const c = str.ptr_[i];
      if (c >= 0x30 && c <= 0x39) { // 0-9
        value |= c - 0x30;
      } else if (c >= 0x41 && c <= 0x46) { // A-F
        value |= 10 + (c - 0x41);
      } else {
        return { found: false, c: 0 };
      }
    }

    return { found: true, c: value };
  }

  // Characteristic conversion methods
  convertBooleanC(obj: ELObj, ident: IdentifierImpl, loc: Location, result: { value: boolean }): boolean {
    obj = this.convertFromString(obj, ConvertFlags.convertAllowBoolean, loc);
    if (obj === this.makeFalse()) {
      result.value = false;
      return true;
    }
    if (obj === this.makeTrue()) {
      result.value = true;
      return true;
    }
    this.invalidCharacteristicValue(ident, loc);
    return false;
  }

  convertLengthC(obj: ELObj, ident: IdentifierImpl, loc: Location, n: { value: number }): boolean {
    obj = this.convertFromString(obj, ConvertFlags.convertAllowNumber, loc);
    const q = obj.quantityValue();
    switch (q.type) {
      case 1: // longQuantity
        if (q.dim === 1) {
          n.value = q.longVal;
          return true;
        }
        break;
      case 2: // doubleQuantity
        if (q.dim === 1) {
          n.value = Math.trunc(q.doubleVal);
          return true;
        }
        break;
    }
    this.invalidCharacteristicValue(ident, loc);
    return false;
  }

  convertLengthSpec(obj: ELObj, result: FOTLengthSpec): boolean {
    const q = obj.quantityValue();
    switch (q.type) {
      case 1: // longQuantity
        if (q.dim === 1) {
          result.length = q.longVal;
          return true;
        }
        break;
      case 2: // doubleQuantity
        if (q.dim === 1) {
          result.length = Math.trunc(q.doubleVal + (q.doubleVal < 0 ? -0.5 : 0.5));
          return true;
        }
        break;
      default:
        const ls = obj.lengthSpec();
        if (ls) {
          const conv = ls.convert();
          if (conv.result) {
            result.length = conv.spec.length;
            result.displaySizeFactor = conv.spec.displaySizeFactor;
            return true;
          }
        }
    }
    return false;
  }

  convertRealC(obj: ELObj, ident: IdentifierImpl, loc: Location, result: { value: number }): boolean {
    obj = this.convertFromString(obj, ConvertFlags.convertAllowNumber, loc);
    const rv = obj.realValue();
    if (rv.result) {
      result.value = rv.value;
      return true;
    }
    this.invalidCharacteristicValue(ident, loc);
    return false;
  }

  convertIntegerC(obj: ELObj, ident: IdentifierImpl, loc: Location, result: { value: number }): boolean {
    obj = this.convertFromString(obj, ConvertFlags.convertAllowNumber, loc);
    const iv = obj.exactIntegerValue();
    if (iv.result) {
      result.value = iv.value;
      return true;
    }
    this.invalidCharacteristicValue(ident, loc);
    return false;
  }

  convertStringC(obj: ELObj, ident: IdentifierImpl, loc: Location, result: { value: StringC }): boolean {
    const sd = obj.stringData();
    if (sd.result) {
      // Convert string data to StringC
      const chars: Char[] = [];
      for (let i = 0; i < sd.length; i++) {
        chars.push(sd.data[i]);
      }
      result.value = new StringOf<Char>(chars, chars.length);
      return true;
    }
    this.invalidCharacteristicValue(ident, loc);
    return false;
  }

  invalidCharacteristicValue(ident: IdentifierImpl, loc: Location): void {
    this.setNextLocation(loc);
    this.message(InterpreterMessages.invalidCharacteristicValue, ident.name());
  }

  private convertFromString(obj: ELObj, hints: number, loc: Location): ELObj {
    const sd = obj.stringData();
    if (!this.dsssl2() || !sd.result) {
      return obj;
    }

    let str = '';
    for (let i = 0; i < sd.length; i++) {
      str += String.fromCharCode(sd.data[i]);
    }

    if (hints & ConvertFlags.convertAllowNumber) {
      const tem = this.convertNumber(stringToStringC(str));
      if (tem) {
        return tem.resolveQuantities(true, this, loc);
      }
    }

    if (hints & ConvertFlags.convertAllowSymbol) {
      const sym = this.symbolTable_.get(str);
      if (sym && sym.cValue() !== FOTSymbol.symbolFalse) {
        return sym;
      }
    }

    if (hints & ConvertFlags.convertAllowBoolean) {
      switch (str.length) {
        case 2:
          if (str === 'no') return this.makeFalse();
          break;
        case 3:
          if (str === 'yes') return this.makeTrue();
          break;
        case 4:
          if (str === 'true') return this.makeTrue();
          break;
        case 5:
          if (str === 'false') return this.makeFalse();
          break;
      }
    }

    return obj;
  }

  // LengthSpec creation
  makeLengthSpec(ls: FOTLengthSpec): ELObj {
    if (ls.displaySizeFactor !== 0.0) {
      const result = new LengthSpec({ unknown: LengthSpec.Unknown.displaySize, factor: ls.displaySizeFactor });
      result.addScalar(ls.length);
      return new LengthSpecObj(result);
    }
    return new LengthObj(ls.length);
  }

  // Node location setting
  setNodeLocation(nd: NodePtr): void {
    // TODO: Implement using LocNode
  }

  // Pattern conversion
  // Converts a DSSSL pattern expression (e.g., element name symbol) to a Pattern object
  convertToPattern(obj: ELObj, loc: Location, pattern: { value: Pattern }): boolean {
    // Simple case: symbol representing element name (e.g., "p" in "(element p ...)")
    if (obj instanceof SymbolObj) {
      const nameObj = obj.name();
      const gi = stringToStringC(nameObj.toStyleString());
      const elem = new Element(gi);
      pattern.value = new Pattern([elem]);
      return true;
    }
    // TODO: Handle more complex patterns (lists, qualifiers, etc.)
    return false;
  }

  // Extension installation
  installExtensionCharNIC(ident: IdentifierImpl, pubid: StringC, loc: Location): void {
    ident.setCharNIC(this.currentPartIndex(), loc);
  }

  // Character mapping methods - used by SchemeParser
  private standardChars_: Map<string, number> = new Map();
  private nameChars_: Map<string, number> = new Map();
  private separatorChars_: Map<string, number> = new Map();
  private sdataEntities_: Map<string, { text: string; ch: number }> = new Map();

  addStandardChar(name: StringC | string, ch: number): void {
    const key = typeof name === 'string' ? name : stringCToString(name);
    this.standardChars_.set(key, ch);
  }

  addNameChar(name: StringC | string, ch: number): void {
    const key = typeof name === 'string' ? name : stringCToString(name);
    this.nameChars_.set(key, ch);
  }

  addSeparatorChar(name: StringC | string, ch: number): void {
    const key = typeof name === 'string' ? name : stringCToString(name);
    this.separatorChars_.set(key, ch);
  }

  addSdataEntity(name: StringC | string, text: StringC | string, ch: number): void {
    const key = typeof name === 'string' ? name : stringCToString(name);
    const textStr = typeof text === 'string' ? text : stringCToString(text);
    this.sdataEntities_.set(key, { text: textStr, ch });
  }
}

// Conversion flags
const ConvertFlags = {
  convertAllowBoolean: 0x01,
  convertAllowSymbol: 0x02,
  convertAllowNumber: 0x04
} as const;

// ELObjDynamicRoot - simplified since JS has native GC (no manual tracing needed)
export class ELObjDynamicRoot {
  private obj_: ELObj | null;

  constructor(_interp?: Interpreter, obj: ELObj | null = null) {
    this.obj_ = obj;
  }

  set(obj: ELObj | null): void {
    this.obj_ = obj;
  }

  get(): ELObj | null {
    return this.obj_;
  }
}

// String comparison helper
export function stringCEquals(s: StringC, p: string): boolean {
  if (s.length_ !== p.length) return false;
  if (!s.ptr_) return p.length === 0;
  for (let i = 0; i < s.length_; i++) {
    if (s.ptr_[i] !== p.charCodeAt(i)) return false;
  }
  return true;
}
