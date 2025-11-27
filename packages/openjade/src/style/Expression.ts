// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, StringC, String as StringOf, Char } from '@openjade-js/opensp';
import {
  ELObj,
  FunctionObj,
  Identifier,
  SyntacticKey,
  KeywordObj,
  Insn as ELObjInsn,
  InsnPtr as ELObjInsnPtr,
  Signature
} from './ELObj';
import { FlowObj, SequenceFlowObj, CompoundFlowObj } from './SosofoObj';
import type { Interpreter } from './Interpreter';
import {
  ProcessingMode,
  StyleSpec,
  InheritedC,
  FlowObj as InsnFlowObj,
  CompoundFlowObj as InsnCompoundFlowObj,
  createErrorInsn,
  createConstantInsn,
  createResolveQuantitiesInsn,
  createTestInsn,
  createAndInsn,
  createOrInsn,
  createCondFailInsn,
  createCaseFailInsn,
  createCaseInsn,
  createPopInsn,
  createApplyInsn,
  createTailApplyInsn,
  createFrameRefInsn,
  createClosureRefInsn,
  createStackRefInsn,
  createCheckInitInsn,
  createUnboxInsn,
  createTopRefInsn,
  createPopBindingsInsn,
  createBoxInsn,
  createBoxArgInsn,
  createBoxStackInsn,
  createSetKeyArgInsn,
  createTestNullInsn,
  createReturnInsn,
  createClosureInsn,
  createVarargsInsn,
  createSetBoxInsn,
  createSetImmediateInsn,
  createVectorInsn,
  createListToVectorInsn,
  createConsInsn,
  createAppendInsn,
  createStackSetBoxInsn,
  createStackSetInsn,
  createClosureSetBoxInsn,
  createPushModeInsn,
  createPopModeInsn,
  createVarStyleInsn,
  createMaybeOverrideStyleInsn,
  createCheckStyleInsn,
  createSetStyleInsn,
  createSetNonInheritedCInsn,
  createSetPseudoNonInheritedCInsn,
  createSetNonInheritedCsSosofoInsn,
  createSetImplicitCharInsn,
  createCopyFlowObjInsn,
  createSetContentInsn,
  createSetDefaultContentInsn,
  createMakeDefaultContentInsn,
  createLabelSosofoInsn,
  createContentMapSosofoInsn,
  createCheckSosofoInsn,
  createSosofoAppendInsn
} from './Insn';

// Helper to convert StringC to JS string
function stringCToString(sc: StringC): string {
  if (!sc.ptr_ || sc.length_ === 0) return '';
  let result = '';
  for (let i = 0; i < sc.length_; i++) {
    result += String.fromCharCode(sc.ptr_[i]);
  }
  return result;
}

// Helper to convert JS string to StringC
function stringToStringC(s: string): StringC {
  const arr: Char[] = [];
  for (let i = 0; i < s.length; i++) {
    arr.push(s.charCodeAt(i));
  }
  return new StringOf<Char>(arr, arr.length);
}

// Re-export Insn interface from ELObj
export type Insn = ELObjInsn;
export type InsnPtr = ELObjInsnPtr;

// Forward declaration for VM
export interface VM {
  // VM interface - will be defined in VM.ts
}

// CompoundFlowObj re-exported from SosofoObj
export { CompoundFlowObj } from './SosofoObj';

// Re-export types from Insn
export { ProcessingMode, InheritedC, StyleSpec } from './Insn';

// Packed boolean type
export type PackedBoolean = boolean;

// BoundVar structure - represents a bound variable
export interface BoundVar {
  ident: Identifier | null;
  flags: number;
  reboundCount: number;
}

export namespace BoundVar {
  export const usedFlag = 0o01;
  export const assignedFlag = 0o02;
  export const sharedFlag = 0o04;
  export const uninitFlag = 0o10;
  export const boxedFlags = assignedFlag | sharedFlag;

  export function flagsBoxed(f: number): boolean {
    return (f & boxedFlags) === boxedFlags;
  }

  export function boxed(bv: BoundVar): boolean {
    return flagsBoxed(bv.flags);
  }
}

// BoundVarList - a list of bound variables
export class BoundVarList extends Array<BoundVar> {
  constructor(idents?: (Identifier | null)[], n?: number, flags?: number) {
    super();
    if (idents) {
      const size = n !== undefined ? n : idents.length;
      for (let i = 0; i < size; i++) {
        const bv: BoundVar = {
          ident: idents[i],
          reboundCount: 0,
          flags: (flags !== undefined ? (flags & ~BoundVar.usedFlag) : 0)
        };
        this.push(bv);
      }
    }
  }

  append(id: Identifier | null, flags: number): void {
    const bv: BoundVar = {
      ident: id,
      flags: flags & ~BoundVar.usedFlag,
      reboundCount: 0
    };
    this.push(bv);
  }

  mark(ident: Identifier | null, flags: number): void {
    const bv = this.findVar(ident);
    if (bv && !bv.reboundCount) {
      bv.flags |= flags;
    }
  }

  removeUnused(): void {
    let j = 0;
    for (let i = 0; i < this.length; i++) {
      if (this[i].flags & BoundVar.usedFlag) {
        if (j !== i) {
          this[j] = this[i];
        }
        j++;
      }
    }
    this.length = j;
  }

  remove(idents: (Identifier | null)[]): void {
    let j = 0;
    for (let i = 0; i < this.length; i++) {
      const ident = this[i].ident;
      let found = false;
      for (const id of idents) {
        if (id === ident) {
          found = true;
          break;
        }
      }
      if (!found) {
        if (j !== i) {
          this[j] = this[i];
        }
        j++;
      }
    }
    this.length = j;
  }

  rebind(idents: (Identifier | null)[]): void {
    for (const id of idents) {
      const bv = this.findVar(id);
      if (bv) {
        bv.reboundCount += 1;
      }
    }
  }

  unbind(idents: (Identifier | null)[]): void {
    for (const id of idents) {
      const bv = this.findVar(id);
      if (bv) {
        bv.reboundCount -= 1;
      }
    }
  }

  findVar(ident: Identifier | null): BoundVar | null {
    for (let i = 0; i < this.length; i++) {
      if (this[i].ident === ident) {
        return this[i];
      }
    }
    return null;
  }
}

// FrameVarList - linked list of frame variable lists
class FrameVarList {
  stackPos: number = 0;
  vars: BoundVarList | null = null;
  next: FrameVarList | null = null;
}

// Environment - compilation environment for expressions
export class Environment {
  private frameVarList_: FrameVarList | null = null;
  private closureVars_: BoundVarList | null = null;

  constructor(frameVars?: BoundVarList, closureVars?: BoundVarList) {
    if (frameVars && closureVars) {
      this.closureVars_ = closureVars;
      const tem = new FrameVarList();
      this.frameVarList_ = tem;
      tem.vars = frameVars;
      tem.stackPos = 0;
    }
  }

  // Create a copy of this environment for further augmentation
  copy(): Environment {
    const result = new Environment();
    result.frameVarList_ = this.frameVarList_;
    result.closureVars_ = this.closureVars_;
    return result;
  }

  boundVars(result: BoundVarList): void {
    if (this.closureVars_) {
      for (let i = 0; i < this.closureVars_.length; i++) {
        result.append(this.closureVars_[i].ident, this.closureVars_[i].flags);
      }
    }
    for (let f = this.frameVarList_; f; f = f.next) {
      if (f.vars) {
        for (let i = 0; i < f.vars.length; i++) {
          result.append(f.vars[i].ident, f.vars[i].flags);
        }
      }
    }
  }

  lookup(
    ident: Identifier | null,
    result: { isFrame: boolean; index: number; flags: number }
  ): boolean {
    for (let p = this.frameVarList_; p; p = p.next) {
      if (p.vars) {
        for (let i = 0; i < p.vars.length; i++) {
          if (p.vars[i].ident === ident) {
            result.isFrame = true;
            result.index = i + p.stackPos;
            result.flags = p.vars[i].flags;
            return true;
          }
        }
      }
    }
    if (this.closureVars_) {
      for (let i = 0; i < this.closureVars_.length; i++) {
        if (this.closureVars_[i].ident === ident) {
          result.isFrame = false;
          result.index = i;
          result.flags = this.closureVars_[i].flags;
          return true;
        }
      }
    }
    return false;
  }

  augmentFrame(vars: BoundVarList, stackPos: number): void {
    const tem = new FrameVarList();
    tem.stackPos = stackPos;
    tem.vars = vars;
    tem.next = this.frameVarList_;
    this.frameVarList_ = tem;
  }
}

// Signature is imported from ELObj

// Helper to copy an Environment
function copyEnvironment(env: Environment): Environment {
  return env.copy();
}

// Owner<T> - ownership wrapper (in TS we just use T | null with manual swap)
export type Owner<T> = { value: T | null };

// Abstract base class for all expressions
export abstract class Expression {
  protected loc_: Location;

  constructor(loc: Location) {
    this.loc_ = loc;
  }

  abstract compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr;

  abstract canEval(maybeCall: boolean): boolean;

  markBoundVars(_vars: BoundVarList, _shared: boolean): void {
    // Default: no bound variables to mark
  }

  optimize(_interp: Interpreter, _env: Environment, _expr: Owner<Expression>): void {
    // Default: no optimization
  }

  constantValue(): ELObj | null {
    return null;
  }

  keyword(): Identifier | null {
    return null;
  }

  location(): Location {
    return this.loc_;
  }

  static optimizeCompile(
    expr: Owner<Expression>,
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    if (expr.value) {
      expr.value.optimize(interp, env, expr);
      return expr.value!.compile(interp, env, stackPos, next);
    }
    return next;
  }

  protected static compilePushVars(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    vars: BoundVarList,
    varIndex: number,
    next: InsnPtr
  ): InsnPtr {
    if (varIndex >= vars.length) {
      return next;
    }
    const result = { isFrame: false, index: 0, flags: 0 };
    if (!env.lookup(vars[varIndex].ident, result)) {
      throw new Error('CANNOT_HAPPEN: variable not found in environment');
    }
    if (result.isFrame) {
      return createFrameRefInsn(
        result.index,
        Expression.compilePushVars(interp, env, stackPos + 1, vars, varIndex + 1, next)
      );
    } else {
      return createClosureRefInsn(
        result.index,
        Expression.compilePushVars(interp, env, stackPos + 1, vars, varIndex + 1, next)
      );
    }
  }
}

// ConstantExpression - expression that evaluates to a constant
export class ConstantExpression extends Expression {
  private obj_: ELObj; // must be permanent

  constructor(obj: ELObj, loc: Location) {
    super(loc);
    this.obj_ = obj;
  }

  compile(
    _interp: Interpreter,
    _env: Environment,
    _stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    return createConstantInsn(
      this.obj_,
      createResolveQuantitiesInsn(this.location(), next)
    );
  }

  override optimize(interp: Interpreter, _env: Environment, expr: Owner<Expression>): void {
    const tem = this.obj_.resolveQuantities(false, interp, this.location());
    if (tem !== this.obj_) {
      interp.makePermanent(tem);
      expr.value = new ResolvedConstantExpression(tem, this.location());
    }
  }

  canEval(_maybeCall: boolean): boolean {
    return false;
  }

  override keyword(): Identifier | null {
    const k = this.obj_.asKeyword();
    if (k) {
      return k.identifier();
    }
    return null;
  }
}

// ResolvedConstantExpression - constant with resolved quantities
export class ResolvedConstantExpression extends Expression {
  private obj_: ELObj;

  constructor(obj: ELObj, loc: Location) {
    super(loc);
    this.obj_ = obj;
  }

  compile(
    _interp: Interpreter,
    _env: Environment,
    _stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    return createConstantInsn(this.obj_, next);
  }

  override constantValue(): ELObj | null {
    return this.obj_;
  }

  canEval(_maybeCall: boolean): boolean {
    return true;
  }
}

// CallExpression - function call expression
export class CallExpression extends Expression {
  private op_: Owner<Expression> = { value: null };
  private args_: Owner<Expression>[] = [];

  constructor(
    op: Expression | null,
    args: Expression[],
    loc: Location
  ) {
    super(loc);
    this.op_.value = op;
    this.args_ = args.map(a => ({ value: a }));
  }

  canEval(maybeCall: boolean): boolean {
    if (!this.op_.value || !this.op_.value.canEval(true)) {
      return false;
    }
    for (const arg of this.args_) {
      if (!arg.value || !arg.value.canEval(true)) {
        return false;
      }
    }
    return true;
  }

  nArgs(): number {
    return this.args_.length;
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    if (this.op_.value) {
      this.op_.value.optimize(interp, env, this.op_);
    }
    const value = this.op_.value?.constantValue();
    let result: InsnPtr;

    if (value) {
      const func = value.asFunction();
      if (!func) {
        interp.setNextLocation(this.location());
        interp.message(InterpreterMessages.callNonFunction, value);
        return createErrorInsn();
      }
      if (this.nArgs() < func.nRequiredArgs()) {
        interp.setNextLocation(this.location());
        interp.message(InterpreterMessages.missingArg);
        return createErrorInsn();
      }
      if (this.nArgs() - func.nRequiredArgs() > func.nOptionalArgs()) {
        if (func.nKeyArgs()) {
          if ((this.nArgs() - func.nRequiredArgs() - func.nOptionalArgs()) & 1) {
            interp.setNextLocation(this.location());
            interp.message(InterpreterMessages.oddKeyArgs);
            this.args_.length = func.nRequiredArgs() + func.nOptionalArgs();
          }
        } else if (!func.restArg()) {
          interp.setNextLocation(this.location());
          interp.message(InterpreterMessages.tooManyArgs);
          this.args_.length = func.nRequiredArgs() + func.nOptionalArgs();
        }
      }

      const callerArgs = { value: 0 };
      if (next && next.isReturn(callerArgs) && !interp.debugMode()) {
        result = func.makeTailCallInsn(this.nArgs(), interp, this.location(), callerArgs.value);
      } else {
        result = func.makeCallInsn(this.nArgs(), interp, this.location(), next);
      }
    } else {
      const n = this.nArgs();
      const callerArgs = { value: 0 };
      if (next && next.isReturn(callerArgs) && !interp.debugMode()) {
        result = createTailApplyInsn(callerArgs.value, n, this.location());
      } else {
        result = createApplyInsn(n, this.location(), next);
      }
      result = this.op_.value!.compile(interp, env, stackPos + n, result);
    }

    for (let i = this.args_.length; i > 0; i--) {
      result = Expression.optimizeCompile(
        this.args_[i - 1],
        interp,
        env,
        stackPos + i - 1,
        result
      );
    }
    return result;
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    if (this.op_.value) {
      this.op_.value.markBoundVars(vars, shared);
    }
    for (const arg of this.args_) {
      if (arg.value) {
        arg.value.markBoundVars(vars, shared);
      }
    }
  }
}

// VariableExpression - variable reference expression
export class VariableExpression extends Expression {
  private ident_: Identifier;
  private isTop_: boolean = false;

  constructor(ident: Identifier, loc: Location) {
    super(loc);
    this.ident_ = ident;
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    const result = { isFrame: false, index: 0, flags: 0 };
    if (env.lookup(this.ident_, result)) {
      const boxed = BoundVar.flagsBoxed(result.flags);
      let tem: InsnPtr;
      const popResult = { value: 0 };
      const temInsn = { insn: null as InsnPtr };

      if (
        result.isFrame &&
        next &&
        next.isPopBindings(popResult, temInsn) &&
        popResult.value === 1 &&
        result.index - stackPos === -1
      ) {
        if (result.flags & BoundVar.uninitFlag) {
          tem = createCheckInitInsn(this.ident_, this.location(), temInsn.insn);
        } else {
          tem = temInsn.insn;
        }
        // This happens with named let.
        if (boxed) {
          return createUnboxInsn(tem);
        } else {
          return tem;
        }
      }

      if (result.flags & BoundVar.uninitFlag) {
        tem = createCheckInitInsn(this.ident_, this.location(), next);
      } else {
        tem = next;
      }
      if (boxed) {
        tem = createUnboxInsn(tem);
      }
      if (result.isFrame) {
        return createStackRefInsn(result.index - stackPos, result.index, tem);
      } else {
        return createClosureRefInsn(result.index, tem);
      }
    }

    this.isTop_ = true;
    const loc: { value: Location | null } = { value: null };
    const part: { value: number } = { value: 0 };
    if (!this.ident_.defined(part, loc)) {
      interp.setNextLocation(this.location());
      interp.message(
        InterpreterMessages.undefinedVariableReference,
        this.ident_.name()
      );
      return createErrorInsn();
    }
    const val = this.ident_.computeValue(false, interp);
    if (!val) {
      return createTopRefInsn(this.ident_, next);
    }
    if (interp.isError(val)) {
      return createErrorInsn();
    }
    return createConstantInsn(val, next);
  }

  override optimize(interp: Interpreter, env: Environment, expr: Owner<Expression>): void {
    const result = { isFrame: false, index: 0, flags: 0 };
    if (env.lookup(this.ident_, result)) {
      return;
    }
    this.isTop_ = true;
    const loc: { value: Location | null } = { value: null };
    const part: { value: number } = { value: 0 };
    if (this.ident_.defined(part, loc)) {
      const obj = this.ident_.computeValue(false, interp);
      if (obj && !interp.isError(obj)) {
        interp.makePermanent(obj);
        expr.value = new ConstantExpression(obj, this.location());
        expr.value.optimize(interp, env, expr);
      }
    }
  }

  canEval(_maybeCall: boolean): boolean {
    return !this.isTop_ || this.ident_.evaluated();
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    vars.mark(this.ident_, BoundVar.usedFlag | (shared ? BoundVar.sharedFlag : 0));
  }
}

// IfExpression - conditional expression
export class IfExpression extends Expression {
  private test_: Owner<Expression> = { value: null };
  private consequent_: Owner<Expression> = { value: null };
  private alternate_: Owner<Expression> = { value: null };

  constructor(
    test: Expression | null,
    consequent: Expression | null,
    alternate: Expression | null,
    loc: Location
  ) {
    super(loc);
    this.test_.value = test;
    this.consequent_.value = consequent;
    this.alternate_.value = alternate;
  }

  canEval(maybeCall: boolean): boolean {
    return (
      (this.test_.value?.canEval(maybeCall) ?? false) &&
      (this.consequent_.value?.canEval(maybeCall) ?? false) &&
      (this.alternate_.value?.canEval(maybeCall) ?? false)
    );
  }

  override optimize(interp: Interpreter, env: Environment, expr: Owner<Expression>): void {
    if (this.test_.value) {
      this.test_.value.optimize(interp, env, this.test_);
    }
    const obj = this.test_.value?.constantValue();
    if (obj) {
      if (obj.isTrue()) {
        expr.value = this.consequent_.value;
        this.consequent_.value = null;
        expr.value?.optimize(interp, env, expr);
      } else {
        expr.value = this.alternate_.value;
        this.alternate_.value = null;
        expr.value?.optimize(interp, env, expr);
      }
    }
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    if (this.alternate_.value) {
      this.alternate_.value.optimize(interp, env, this.alternate_);
    }
    if (this.alternate_.value?.constantValue() === interp.makeFalse()) {
      return this.test_.value!.compile(
        interp,
        env,
        stackPos,
        createAndInsn(
          Expression.optimizeCompile(this.consequent_, interp, env, stackPos, next),
          next
        )
      );
    } else {
      return this.test_.value!.compile(
        interp,
        env,
        stackPos,
        createTestInsn(
          Expression.optimizeCompile(this.consequent_, interp, env, stackPos, next),
          this.alternate_.value!.compile(interp, env, stackPos, next)
        )
      );
    }
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    this.test_.value?.markBoundVars(vars, shared);
    this.consequent_.value?.markBoundVars(vars, shared);
    this.alternate_.value?.markBoundVars(vars, shared);
  }
}

// OrExpression - or expression
export class OrExpression extends Expression {
  private test1_: Owner<Expression> = { value: null };
  private test2_: Owner<Expression> = { value: null };

  constructor(
    test1: Expression | null,
    test2: Expression | null,
    loc: Location
  ) {
    super(loc);
    this.test1_.value = test1;
    this.test2_.value = test2;
  }

  canEval(maybeCall: boolean): boolean {
    return (
      (this.test1_.value?.canEval(maybeCall) ?? false) &&
      (this.test2_.value?.canEval(maybeCall) ?? false)
    );
  }

  override optimize(interp: Interpreter, env: Environment, expr: Owner<Expression>): void {
    if (this.test1_.value) {
      this.test1_.value.optimize(interp, env, this.test1_);
    }
    const obj = this.test1_.value?.constantValue();
    if (obj) {
      if (obj.isTrue()) {
        expr.value = this.test1_.value;
        this.test1_.value = null;
      } else {
        expr.value = this.test2_.value;
        this.test2_.value = null;
        expr.value?.optimize(interp, env, expr);
      }
    }
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    return this.test1_.value!.compile(
      interp,
      env,
      stackPos,
      createOrInsn(
        Expression.optimizeCompile(this.test2_, interp, env, stackPos, next),
        next
      )
    );
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    this.test1_.value?.markBoundVars(vars, shared);
    this.test2_.value?.markBoundVars(vars, shared);
  }
}

// CondFailExpression - cond failure expression
export class CondFailExpression extends Expression {
  constructor(loc: Location) {
    super(loc);
  }

  compile(
    _interp: Interpreter,
    _env: Environment,
    _stackPos: number,
    _next: InsnPtr
  ): InsnPtr {
    return createCondFailInsn(this.location());
  }

  canEval(_maybeCall: boolean): boolean {
    return true;
  }
}

// Case structure for CaseExpression
export interface Case {
  datums: ELObj[];
  expr: Owner<Expression>;
}

// Input format for Case constructor parameter
export interface CaseInput {
  datums: ELObj[];
  expr: Expression;
}

// CaseExpression - case expression
export class CaseExpression extends Expression {
  private key_: Owner<Expression> = { value: null };
  private cases_: Case[] = [];
  private nResolved_: number[] = [];
  private else_: Owner<Expression> = { value: null };

  constructor(
    key: Expression | null,
    cases: CaseInput[],
    elseClause: Expression | null,
    loc: Location
  ) {
    super(loc);
    this.key_.value = key;
    this.cases_ = cases.map(c => ({ datums: c.datums, expr: { value: c.expr } }));
    this.else_.value = elseClause;
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    let finish: InsnPtr;
    if (this.else_.value) {
      finish = createPopInsn(this.else_.value.compile(interp, env, stackPos, next));
    } else {
      finish = createCaseFailInsn(this.location());
    }
    for (let i = 0; i < this.cases_.length; i++) {
      const match = this.cases_[i].expr.value!.compile(interp, env, stackPos, next);
      for (let j = 0; j < this.nResolved_[i]; j++) {
        finish = createCaseInsn(this.cases_[i].datums[j], match, finish);
      }
    }
    // FIXME handle unresolved quantities
    return this.key_.value!.compile(interp, env, stackPos, finish);
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    this.key_.value?.markBoundVars(vars, shared);
    for (const c of this.cases_) {
      c.expr.value?.markBoundVars(vars, shared);
    }
    this.else_.value?.markBoundVars(vars, shared);
  }

  canEval(maybeCall: boolean): boolean {
    if (!this.key_.value?.canEval(maybeCall)) {
      return false;
    }
    if (this.else_.value && !this.else_.value.canEval(maybeCall)) {
      return false;
    }
    for (let i = 0; i < this.cases_.length; i++) {
      if (!this.cases_[i].expr.value?.canEval(maybeCall)) {
        return false;
      }
      if (this.nResolved_[i] === this.cases_[i].datums.length) {
        return false;
      }
    }
    return true;
  }

  override optimize(interp: Interpreter, env: Environment, expr: Owner<Expression>): void {
    if (this.key_.value) {
      this.key_.value.optimize(interp, env, this.key_);
    }
    const k = this.key_.value?.constantValue();
    this.nResolved_ = new Array(this.cases_.length).fill(0);
    let unresolved = false;

    for (let i = 0; i < this.cases_.length; i++) {
      if (this.cases_[i].expr.value) {
        this.cases_[i].expr.value!.optimize(interp, env, this.cases_[i].expr);
      }
      let nResolved = 0;
      for (let j = 0; j < this.cases_[i].datums.length; j++) {
        const tem = this.cases_[i].datums[j].resolveQuantities(false, interp, this.location());
        if (tem !== this.cases_[i].datums[j]) {
          if (k && ELObj.eqv(k, tem)) {
            expr.value = this.cases_[i].expr.value;
            this.cases_[i].expr.value = null;
            return;
          }
          if (j !== nResolved) {
            this.cases_[i].datums[j] = this.cases_[i].datums[nResolved];
          }
          this.cases_[i].datums[nResolved++] = tem;
        } else {
          unresolved = true;
        }
      }
      this.nResolved_[i] = nResolved;
    }

    if (this.else_.value) {
      this.else_.value.optimize(interp, env, this.else_);
      if (k && !unresolved) {
        expr.value = this.else_.value;
        this.else_.value = null;
      }
    } else if (k && !unresolved) {
      interp.setNextLocation(this.location());
      interp.message(InterpreterMessages.caseFail, k);
    }
    if (unresolved) {
      interp.setNextLocation(this.location());
      interp.message(InterpreterMessages.caseUnresolvedQuantities);
    }
  }
}

// LambdaExpression - lambda expression
export class LambdaExpression extends Expression {
  private formals_: (Identifier | null)[] = [];
  private inits_: Owner<Expression>[] = [];
  private sig_: Signature;
  private body_: Owner<Expression> = { value: null };

  constructor(
    formals: (Identifier | null)[],
    inits: Expression[],
    nOptional: number,
    hasRest: boolean | number,
    nKey: number,
    body: Expression | null,
    loc: Location
  ) {
    super(loc);
    this.formals_ = [...formals];
    this.inits_ = inits.map(i => ({ value: i }));
    this.body_.value = body;

    const hasRestBool = typeof hasRest === 'boolean' ? hasRest : hasRest !== 0;
    this.sig_ = {
      nRequiredArgs: formals.length - nOptional - nKey - (hasRestBool ? 1 : 0),
      nOptionalArgs: nOptional,
      restArg: hasRestBool,
      nKeyArgs: nKey,
      keys: formals.slice(formals.length - nKey)
    };
  }

  canEval(maybeCall: boolean): boolean {
    if (!maybeCall) {
      return true;
    }
    if (!this.body_.value?.canEval(true)) {
      return false;
    }
    for (const init of this.inits_) {
      if (init.value && !init.value.canEval(true)) {
        return false;
      }
    }
    return true;
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    const boundVars = new BoundVarList();
    env.boundVars(boundVars);
    this.markBoundVars(boundVars, false);
    boundVars.removeUnused();

    const formalVars = new BoundVarList(this.formals_, this.sig_.nRequiredArgs);
    for (let i = 0; i < this.sig_.nOptionalArgs + this.sig_.nKeyArgs; i++) {
      if (this.inits_[i].value) {
        this.inits_[i].value!.markBoundVars(formalVars, false);
      }
      formalVars.append(this.formals_[this.sig_.nRequiredArgs + i], 0);
    }
    if (this.sig_.restArg) {
      formalVars.append(this.formals_[this.formals_.length - 1], 0);
    }

    if (formalVars.length !== this.formals_.length) {
      throw new Error('ASSERT failed: formalVars.size() == formals_.size()');
    }

    this.body_.value?.markBoundVars(formalVars, false);

    let code = Expression.optimizeCompile(
      this.body_,
      interp,
      new Environment(formalVars, boundVars),
      this.formals_.length,
      createReturnInsn(this.formals_.length)
    );

    if (this.sig_.nOptionalArgs || this.sig_.restArg || this.sig_.nKeyArgs) {
      const entryPoints: InsnPtr[] = new Array(
        this.sig_.nOptionalArgs + (this.sig_.restArg || this.sig_.nKeyArgs ? 1 : 0) + 1
      );

      entryPoints[entryPoints.length - 1] = code;

      // Box the rest arg if necessary
      if (this.sig_.restArg && formalVars[formalVars.length - 1] && BoundVar.boxed(formalVars[formalVars.length - 1])) {
        entryPoints[entryPoints.length - 1] = createBoxStackInsn(
          -1 - this.sig_.nKeyArgs,
          entryPoints[entryPoints.length - 1]
        );
      }

      if (this.sig_.nKeyArgs) {
        // For each keyword argument test whether it is 0, and if so initialize it.
        for (let i = this.sig_.nOptionalArgs + this.sig_.nKeyArgs - 1; i >= this.sig_.nOptionalArgs; i--) {
          const offset = i - (this.sig_.nOptionalArgs + this.sig_.nKeyArgs);
          let set: InsnPtr = createSetKeyArgInsn(offset, entryPoints[entryPoints.length - 1]);
          if (BoundVar.boxed(formalVars[this.sig_.nRequiredArgs + i])) {
            set = createBoxInsn(set);
          }
          if (this.inits_[i].value) {
            const f = new BoundVarList(
              formalVars.map(v => v.ident),
              this.sig_.nRequiredArgs + i + (this.sig_.restArg ? 1 : 0)
            );
            set = Expression.optimizeCompile(
              this.inits_[i],
              interp,
              new Environment(f, boundVars),
              this.formals_.length,
              set
            );
          } else {
            set = createConstantInsn(interp.makeFalse(), set);
          }
          entryPoints[entryPoints.length - 1] = createTestNullInsn(
            offset,
            set,
            entryPoints[entryPoints.length - 1]
          );
        }
      }

      if (this.sig_.restArg || this.sig_.nKeyArgs) {
        for (let i = this.sig_.nOptionalArgs + this.sig_.nKeyArgs - 1; i >= this.sig_.nOptionalArgs; i--) {
          if (BoundVar.boxed(formalVars[this.sig_.nRequiredArgs + i])) {
            code = createBoxInsn(code);
          }
          if (this.inits_[i].value) {
            const f = new BoundVarList(
              formalVars.map(v => v.ident),
              this.sig_.nRequiredArgs + i + (this.sig_.restArg ? 1 : 0)
            );
            code = Expression.optimizeCompile(
              this.inits_[i],
              interp,
              new Environment(f, boundVars),
              f.length,
              code
            );
          } else {
            code = createConstantInsn(interp.makeFalse(), code);
          }
        }
        if (this.sig_.restArg) {
          if (BoundVar.boxed(formalVars[formalVars.length - 1])) {
            code = createBoxInsn(code);
          }
          code = createConstantInsn(interp.makeNil(), code);
        }
        entryPoints[this.sig_.nOptionalArgs] = code;
      }

      for (let i = this.sig_.nOptionalArgs - 1; i >= 0; i--) {
        let tem = entryPoints[i + 1];
        if (BoundVar.boxed(formalVars[this.sig_.nRequiredArgs + i])) {
          tem = createBoxInsn(tem);
        }
        if (this.inits_[i].value) {
          const f = new BoundVarList(formalVars.map(v => v.ident), this.sig_.nRequiredArgs + i);
          entryPoints[i] = Expression.optimizeCompile(
            this.inits_[i],
            interp,
            new Environment(f, boundVars),
            f.length,
            tem
          );
        } else {
          entryPoints[i] = createConstantInsn(interp.makeFalse(), tem);
        }
      }

      for (let i = 0; i < this.sig_.nOptionalArgs; i++) {
        if (BoundVar.boxed(formalVars[this.sig_.nRequiredArgs + i])) {
          for (let j = i; j < this.sig_.nOptionalArgs; j++) {
            entryPoints[j + 1] = createBoxArgInsn(i + this.sig_.nRequiredArgs, entryPoints[j + 1]);
          }
          if (this.sig_.nKeyArgs || this.sig_.restArg) {
            entryPoints[entryPoints.length - 1] = createBoxStackInsn(
              i - this.sig_.nKeyArgs - (this.sig_.restArg ? 1 : 0) - this.sig_.nOptionalArgs,
              entryPoints[entryPoints.length - 1]
            );
          }
        }
      }

      code = createVarargsInsn(this.sig_, entryPoints, this.location());
    }

    for (let i = 0; i < this.sig_.nRequiredArgs; i++) {
      if (BoundVar.boxed(formalVars[i])) {
        code = createBoxArgInsn(i, code);
      }
    }

    return Expression.compilePushVars(
      interp,
      env,
      stackPos,
      boundVars,
      0,
      createClosureInsn(this.sig_, code, boundVars.length, next)
    );
  }

  override markBoundVars(vars: BoundVarList, _shared: boolean): void {
    for (let i = 0; i < this.sig_.nOptionalArgs + this.sig_.nKeyArgs; i++) {
      if (this.inits_[i].value) {
        const f = this.formals_.slice(
          0,
          this.sig_.nRequiredArgs + i + (this.sig_.restArg && i >= this.sig_.nOptionalArgs ? 1 : 0)
        );
        vars.rebind(f);
        this.inits_[i].value!.markBoundVars(vars, true);
        vars.unbind(f);
      }
    }
    vars.rebind(this.formals_);
    this.body_.value?.markBoundVars(vars, true);
    vars.unbind(this.formals_);
  }
}

// LetExpression - let expression
export class LetExpression extends Expression {
  protected vars_: (Identifier | null)[] = [];
  protected inits_: Owner<Expression>[] = [];
  protected body_: Owner<Expression> = { value: null };

  constructor(
    vars: (Identifier | null)[],
    inits: Expression[],
    body: Expression | null,
    loc: Location
  ) {
    super(loc);
    this.vars_ = [...vars];
    this.inits_ = inits.map(i => ({ value: i }));
    this.body_.value = body;
  }

  canEval(maybeCall: boolean): boolean {
    if (!this.body_.value?.canEval(maybeCall)) {
      return false;
    }
    for (const init of this.inits_) {
      if (!init.value?.canEval(true)) {
        return false;
      }
    }
    return true;
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    const nVars = this.vars_.length;
    const bodyEnv = copyEnvironment(env);

    const boundVars = new BoundVarList(this.vars_);
    this.body_.value?.markBoundVars(boundVars, false);
    bodyEnv.augmentFrame(boundVars, stackPos);

    return this.compileInits(
      interp,
      env,
      boundVars,
      0,
      stackPos,
      Expression.optimizeCompile(
        this.body_,
        interp,
        bodyEnv,
        stackPos + nVars,
        createPopBindingsInsn(nVars, next)
      )
    );
  }

  protected compileInits(
    interp: Interpreter,
    env: Environment,
    initVars: BoundVarList,
    initIndex: number,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    if (initIndex >= this.inits_.length) {
      return next;
    }
    let tem = this.compileInits(interp, env, initVars, initIndex + 1, stackPos + 1, next);
    if (BoundVar.boxed(initVars[initIndex])) {
      tem = createBoxInsn(tem);
    }
    return Expression.optimizeCompile(this.inits_[initIndex], interp, env, stackPos, tem);
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    for (const init of this.inits_) {
      init.value?.markBoundVars(vars, shared);
    }
    vars.rebind(this.vars_);
    this.body_.value?.markBoundVars(vars, shared);
    vars.unbind(this.vars_);
  }
}

// LetStarExpression - let* expression
export class LetStarExpression extends LetExpression {
  constructor(
    vars: (Identifier | null)[],
    inits: Expression[],
    body: Expression | null,
    loc: Location
  ) {
    super(vars, inits, body, loc);
  }

  override compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    const nVars = this.vars_.length;
    const bodyEnv = copyEnvironment(env);

    const vars = new BoundVarList();
    for (let i = 0; i < nVars; i++) {
      if (i > 0) {
        this.inits_[i].value?.markBoundVars(vars, false);
      }
      vars.append(this.vars_[i], 0);
    }
    this.body_.value?.markBoundVars(vars, false);
    bodyEnv.augmentFrame(vars, stackPos);

    return this.compileInitsLetStar(
      interp,
      env,
      vars,
      0,
      stackPos,
      Expression.optimizeCompile(
        this.body_,
        interp,
        bodyEnv,
        stackPos + this.vars_.length,
        createPopBindingsInsn(nVars, next)
      )
    );
  }

  private compileInitsLetStar(
    interp: Interpreter,
    env: Environment,
    initVars: BoundVarList,
    initIndex: number,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    if (initIndex >= this.inits_.length) {
      return next;
    }
    const nextEnv = copyEnvironment(env);

    const vars = new BoundVarList();
    vars.append(initVars[initIndex].ident, initVars[initIndex].flags);
    nextEnv.augmentFrame(vars, stackPos);

    let tem = this.compileInitsLetStar(interp, nextEnv, initVars, initIndex + 1, stackPos + 1, next);
    if (BoundVar.boxed(initVars[initIndex])) {
      tem = createBoxInsn(tem);
    }
    return Expression.optimizeCompile(this.inits_[initIndex], interp, env, stackPos, tem);
  }
}

// LetrecExpression - letrec expression
export class LetrecExpression extends Expression {
  private vars_: (Identifier | null)[] = [];
  private inits_: Owner<Expression>[] = [];
  private body_: Owner<Expression> = { value: null };

  constructor(
    vars: (Identifier | null)[],
    inits: Expression[],
    body: Expression | null,
    loc: Location
  ) {
    super(loc);
    this.vars_ = [...vars];
    this.inits_ = inits.map(i => ({ value: i }));
    this.body_.value = body;
  }

  canEval(maybeCall: boolean): boolean {
    if (!this.body_.value?.canEval(maybeCall)) {
      return false;
    }
    for (const init of this.inits_) {
      if (!init.value?.canEval(true)) {
        return false;
      }
    }
    return true;
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    const nVars = this.vars_.length;
    const vars = new BoundVarList(this.vars_, nVars, BoundVar.assignedFlag);

    const bodyEnv = copyEnvironment(env);

    for (let i = 0; i < nVars; i++) {
      this.inits_[i].value?.markBoundVars(vars, false);
    }
    this.body_.value?.markBoundVars(vars, false);
    bodyEnv.augmentFrame(vars, stackPos);

    let tem = Expression.optimizeCompile(
      this.body_,
      interp,
      bodyEnv,
      stackPos + nVars,
      createPopBindingsInsn(nVars, next)
    );

    for (let i = 0; i < nVars; i++) {
      vars[i].flags |= BoundVar.uninitFlag;
    }

    for (let i = 0; i < nVars; i++) {
      if (BoundVar.boxed(vars[i])) {
        tem = createSetBoxInsn(nVars, tem);
      } else {
        tem = createSetImmediateInsn(nVars, tem);
      }
    }

    tem = this.compileInits(interp, bodyEnv, 0, stackPos + nVars, tem);

    for (let i = nVars; i > 0; --i) {
      if (BoundVar.boxed(vars[i - 1])) {
        tem = createBoxInsn(tem);
      }
      tem = createConstantInsn(null as unknown as ELObj, tem);
    }

    return tem;
  }

  private compileInits(
    interp: Interpreter,
    env: Environment,
    initIndex: number,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    if (initIndex >= this.inits_.length) {
      return next;
    }
    return Expression.optimizeCompile(
      this.inits_[initIndex],
      interp,
      env,
      stackPos,
      this.compileInits(interp, env, initIndex + 1, stackPos + 1, next)
    );
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    vars.rebind(this.vars_);
    for (const init of this.inits_) {
      init.value?.markBoundVars(vars, shared);
    }
    this.body_.value?.markBoundVars(vars, shared);
    vars.unbind(this.vars_);
  }
}

// QuasiquoteExpression type enum
export enum QuasiquoteType {
  listType,
  improperType,
  vectorType
}

// QuasiquoteExpression - quasiquote expression
export class QuasiquoteExpression extends Expression {
  private members_: Owner<Expression>[] = [];
  private spliced_: PackedBoolean[] = [];
  private type_: QuasiquoteType;

  constructor(
    members: Expression[],
    spliced: PackedBoolean[],
    type: QuasiquoteType,
    loc: Location
  ) {
    super(loc);
    this.members_ = members.map(m => ({ value: m }));
    this.spliced_ = [...spliced];
    this.type_ = type;
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    let tem: InsnPtr = next;
    let n = this.members_.length;

    if (this.type_ === QuasiquoteType.vectorType) {
      let splicy = false;
      for (let i = 0; i < n; i++) {
        if (this.spliced_[i]) {
          splicy = true;
          break;
        }
      }
      if (!splicy) {
        tem = createVectorInsn(n, tem);
        for (let i = n; i > 0; i--) {
          tem = this.members_[i - 1].value!.compile(interp, env, stackPos + (i - 1), tem);
        }
        return tem;
      }
      tem = createListToVectorInsn(tem);
    } else if (this.type_ === QuasiquoteType.improperType) {
      n--;
    }

    for (let i = 0; i < n; i++) {
      if (this.spliced_[i]) {
        tem = createAppendInsn(this.location(), tem);
      } else {
        tem = createConsInsn(tem);
      }
      tem = this.members_[i].value!.compile(interp, env, stackPos + 1, tem);
    }

    if (this.type_ === QuasiquoteType.improperType) {
      tem = this.members_[this.members_.length - 1].value!.compile(interp, env, stackPos, tem);
    } else {
      tem = createConstantInsn(interp.makeNil(), tem);
    }

    return tem;
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    for (const member of this.members_) {
      member.value?.markBoundVars(vars, shared);
    }
  }

  canEval(maybeCall: boolean): boolean {
    for (const member of this.members_) {
      if (!member.value?.canEval(maybeCall)) {
        return false;
      }
    }
    return true;
  }

  override optimize(interp: Interpreter, env: Environment, expr: Owner<Expression>): void {
    for (const member of this.members_) {
      if (member.value) {
        member.value.optimize(interp, env, member);
      }
    }

    if (this.type_ === QuasiquoteType.vectorType) {
      return;
    }

    if (this.members_.length === 0) {
      expr.value = new ResolvedConstantExpression(interp.makeNil(), this.location());
      return;
    }

    let tail = this.members_[this.members_.length - 1].value?.constantValue();
    if (!tail) {
      return;
    }

    if (this.type_ !== QuasiquoteType.improperType && !this.spliced_[this.spliced_.length - 1]) {
      tail = interp.makePair(tail, interp.makeNil());
      interp.makePermanent(tail);
    }

    for (let i = this.members_.length - 1; i-- > 0; ) {
      const tem = this.members_[i].value?.constantValue();
      // FIXME optimize splice as well
      if (!tem || this.spliced_[i]) {
        this.members_.length = i + 2;
        this.type_ = QuasiquoteType.improperType;
        this.members_[i + 1] = { value: new ResolvedConstantExpression(tail, this.location()) };
        return;
      }
      tail = interp.makePair(tem, tail);
      interp.makePermanent(tail);
    }

    expr.value = new ResolvedConstantExpression(tail, this.location());
  }
}

// SequenceExpression - sequence expression (begin)
export class SequenceExpression extends Expression {
  private sequence_: Owner<Expression>[] = [];

  constructor(sequence: Expression[], loc: Location) {
    super(loc);
    if (sequence.length === 0) {
      throw new Error('ASSERT: sequence.size() > 0');
    }
    this.sequence_ = sequence.map(s => ({ value: s }));
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    // FIXME optimize this
    let result = this.sequence_[this.sequence_.length - 1].value!.compile(interp, env, stackPos, next);
    for (let i = this.sequence_.length - 1; i > 0; i--) {
      result = this.sequence_[i - 1].value!.compile(interp, env, stackPos, createPopInsn(result));
    }
    return result;
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    for (const expr of this.sequence_) {
      expr.value?.markBoundVars(vars, shared);
    }
  }

  canEval(maybeCall: boolean): boolean {
    for (const expr of this.sequence_) {
      if (!expr.value?.canEval(maybeCall)) {
        return false;
      }
    }
    return true;
  }

  override optimize(interp: Interpreter, env: Environment, expr: Owner<Expression>): void {
    let j = 0;
    for (let i = 0; ; i++) {
      if (j !== i) {
        const tmp = this.sequence_[j].value;
        this.sequence_[j].value = this.sequence_[i].value;
        this.sequence_[i].value = tmp;
      }
      if (this.sequence_[j].value) {
        this.sequence_[j].value!.optimize(interp, env, this.sequence_[j]);
      }
      if (i === this.sequence_.length - 1) {
        break;
      }
      if (!this.sequence_[j].value?.constantValue()) {
        j++;
      }
    }
    if (j === 0) {
      expr.value = this.sequence_[0].value;
      this.sequence_[0].value = null;
    } else {
      this.sequence_.length = j + 1;
    }
  }
}

// AssignmentExpression - set! expression
export class AssignmentExpression extends Expression {
  private var_: Identifier;
  private value_: Owner<Expression> = { value: null };

  constructor(
    varIdent: Identifier,
    value: Expression | null,
    loc: Location
  ) {
    super(loc);
    this.var_ = varIdent;
    this.value_.value = value;
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    const result = { isFrame: false, index: 0, flags: 0 };
    if (!env.lookup(this.var_, result)) {
      interp.setNextLocation(this.location());
      const part: { value: number } = { value: 0 };
      const loc: { value: Location | null } = { value: null };
      if (this.var_.defined(part, loc)) {
        interp.message(InterpreterMessages.topLevelAssignment, this.var_.name());
      } else {
        interp.message(InterpreterMessages.undefinedVariableReference, this.var_.name());
      }
      return createErrorInsn();
    }

    let resultInsn: InsnPtr;
    if (result.flags & BoundVar.uninitFlag) {
      resultInsn = createCheckInitInsn(this.var_, this.location(), next);
    } else {
      resultInsn = next;
    }

    if (result.isFrame) {
      if (BoundVar.flagsBoxed(result.flags)) {
        resultInsn = createStackSetBoxInsn(
          result.index - (stackPos + 1),
          result.index,
          this.location(),
          resultInsn
        );
      } else {
        resultInsn = createStackSetInsn(result.index - (stackPos + 1), result.index, resultInsn);
      }
    } else {
      if (!BoundVar.flagsBoxed(result.flags)) {
        throw new Error('ASSERT: BoundVar::flagsBoxed(flags)');
      }
      resultInsn = createClosureSetBoxInsn(result.index, this.location(), resultInsn);
    }

    return Expression.optimizeCompile(this.value_, interp, env, stackPos, resultInsn);
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    vars.mark(
      this.var_,
      BoundVar.usedFlag | BoundVar.assignedFlag | (shared ? BoundVar.sharedFlag : 0)
    );
    this.value_.value?.markBoundVars(vars, shared);
  }

  canEval(maybeCall: boolean): boolean {
    return this.value_.value?.canEval(maybeCall) ?? false;
  }
}

// WithModeExpression - with-mode expression
export class WithModeExpression extends Expression {
  private mode_: ProcessingMode;
  private expr_: Owner<Expression> = { value: null };

  constructor(
    mode: ProcessingMode,
    expr: Expression | null,
    loc: Location
  ) {
    super(loc);
    this.mode_ = mode;
    this.expr_.value = expr;
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    if (!this.mode_.defined()) {
      interp.setNextLocation(this.location());
      interp.message(InterpreterMessages.undefinedMode, this.mode_.name());
    }
    return createPushModeInsn(
      this.mode_,
      Expression.optimizeCompile(this.expr_, interp, env, stackPos, createPopModeInsn(next))
    );
  }

  override markBoundVars(vars: BoundVarList, shared: boolean): void {
    this.expr_.value?.markBoundVars(vars, shared);
  }

  canEval(maybeCall: boolean): boolean {
    return this.expr_.value?.canEval(maybeCall) ?? false;
  }
}

// StyleExpression - style expression
export class StyleExpression extends Expression {
  protected keys_: (Identifier | null)[] = [];
  protected exprs_: Owner<Expression>[] = [];

  constructor(
    keys: (Identifier | null)[],
    exprs: Expression[],
    loc: Location
  ) {
    super(loc);
    this.keys_ = [...keys];
    this.exprs_ = exprs.map(e => ({ value: e }));
  }

  compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    const ics: (InheritedC | null)[] = [];
    const forceIcs: (InheritedC | null)[] = [];
    const forceKeys: (Identifier | null)[] = new Array(this.keys_.length).fill(null);

    for (let i = 0; i < this.keys_.length; i++) {
      const key = this.keys_[i];
      if (key) {
        const nameStr = stringCToString(key.name());
        if (nameStr.length > 6) {
          const prefix = nameStr.substring(0, 6);
          if (prefix === 'force!') {
            const forceName = nameStr.substring(6);
            forceKeys[i] = interp.lookup(stringToStringC(forceName));
          }
        }
      }
    }

    let hasUse = false;
    let useIndex = 0;
    const boundVars = new BoundVarList();
    env.boundVars(boundVars);

    for (let i = 0; i < this.keys_.length; i++) {
      let sk: { value: number } = { value: 0 };
      if (
        forceKeys[i] &&
        this.maybeStyleKeyword(forceKeys[i]!) &&
        forceKeys[i]!.inheritedC()
      ) {
        forceIcs.push(null);
        this.exprs_[i].value?.markBoundVars(boundVars, false);
      } else if (
        this.maybeStyleKeyword(this.keys_[i]!) &&
        !(this.keys_[i]!.syntacticKey(sk) && sk.value === SyntacticKey.keyUse) &&
        this.keys_[i]!.inheritedC()
      ) {
        ics.push(null);
        this.exprs_[i].value?.markBoundVars(boundVars, false);
      }
    }

    // FIXME optimize case where ics.size() == 0
    boundVars.removeUnused();
    const noVars = new BoundVarList();
    const newEnv = new Environment(noVars, boundVars);

    let j = 0;
    let k = 0;
    for (let i = 0; i < this.keys_.length; i++) {
      let sk: { value: number } = { value: 0 };
      if (
        forceKeys[i] &&
        this.maybeStyleKeyword(forceKeys[i]!) &&
        forceKeys[i]!.inheritedC()
      ) {
        if (this.exprs_[i].value) {
          this.exprs_[i].value!.optimize(interp, newEnv, this.exprs_[i]);
        }
        const val = this.exprs_[i].value?.constantValue();
        if (val) {
          interp.makePermanent(val);
          const ic = forceKeys[i]!.inheritedC()!.make(val, this.exprs_[i].value!.location(), interp);
          if (!ic) {
            forceIcs.length--;
          } else {
            forceIcs[k++] = ic;
          }
        } else {
          forceIcs[k++] = createVarInheritedC(
            forceKeys[i]!.inheritedC()!,
            this.exprs_[i].value!.compile(interp, newEnv, 0, null),
            this.exprs_[i].value!.location()
          );
        }
      } else if (!this.maybeStyleKeyword(this.keys_[i]!)) {
        // Skip
      } else if (this.keys_[i]!.syntacticKey(sk) && sk.value === SyntacticKey.keyUse) {
        if (!hasUse) {
          hasUse = true;
          useIndex = i;
        }
      } else if (this.keys_[i]!.inheritedC()) {
        if (this.exprs_[i].value) {
          this.exprs_[i].value!.optimize(interp, newEnv, this.exprs_[i]);
        }
        const val = this.exprs_[i].value?.constantValue();
        if (val) {
          interp.makePermanent(val);
          const ic = this.keys_[i]!.inheritedC()!.make(val, this.exprs_[i].value!.location(), interp);
          if (!ic) {
            ics.length--;
          } else {
            ics[j++] = ic;
          }
        } else {
          ics[j++] = createVarInheritedC(
            this.keys_[i]!.inheritedC()!,
            this.exprs_[i].value!.compile(interp, newEnv, 0, null),
            this.exprs_[i].value!.location()
          );
        }
      } else {
        this.unknownStyleKeyword(this.keys_[i]!, interp, this.location());
      }
    }

    let result = Expression.compilePushVars(
      interp,
      env,
      stackPos + (hasUse ? 1 : 0),
      boundVars,
      0,
      createVarStyleInsn(
        createStyleSpec(forceIcs, ics),
        boundVars.length,
        hasUse,
        createMaybeOverrideStyleInsn(next)
      )
    );

    if (!hasUse) {
      return result;
    } else {
      result = createCheckStyleInsn(this.location(), result);
      return Expression.optimizeCompile(this.exprs_[useIndex], interp, env, stackPos, result);
    }
  }

  override markBoundVars(vars: BoundVarList, _shared: boolean): void {
    for (const expr of this.exprs_) {
      expr.value?.markBoundVars(vars, true);
    }
  }

  canEval(maybeCall: boolean): boolean {
    for (const expr of this.exprs_) {
      if (!expr.value?.canEval(maybeCall)) {
        return false;
      }
    }
    return true;
  }

  protected unknownStyleKeyword(ident: Identifier, interp: Interpreter, loc: Location): void {
    interp.setNextLocation(loc);
    const tem = ident.name() + ':';
    interp.message(InterpreterMessages.invalidStyleKeyword, tem);
  }

  protected maybeStyleKeyword(_ident: Identifier): boolean {
    return true;
  }
}

// MakeExpression - make expression (flow object creation)
export class MakeExpression extends StyleExpression {
  private foc_: Identifier;

  constructor(
    foc: Identifier,
    keys: (Identifier | null)[],
    exprs: Expression[],
    loc: Location
  ) {
    super(keys, exprs, loc);
    this.foc_ = foc;
  }

  override compile(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    let flowObj = this.foc_.flowObj();
    if (!flowObj) {
      interp.setNextLocation(this.location());
      interp.message(InterpreterMessages.unknownFlowObjectClass, this.foc_.name());
      flowObj = createSequenceFlowObj(interp);
      interp.makePermanent(flowObj as unknown as ELObj);
    }

    let contentMapExpr: Owner<Expression> | null = null;
    let rest: InsnPtr = next;

    for (let i = 0; i < this.keys_.length; i++) {
      let syn: { value: number } = { value: 0 };
      if (!flowObj.hasNonInheritedC(this.keys_[i]!) && this.keys_[i]!.syntacticKey(syn)) {
        if (syn.value === SyntacticKey.keyLabel) {
          rest = Expression.optimizeCompile(
            this.exprs_[i],
            interp,
            env,
            stackPos + 1,
            createLabelSosofoInsn(this.exprs_[i].value!.location(), rest)
          );
        } else if (syn.value === SyntacticKey.keyContentMap) {
          contentMapExpr = this.exprs_[i];
        }
      }
    }

    flowObj = this.applyConstNonInheritedCs(flowObj, interp, env);
    let nContent = this.exprs_.length - this.keys_.length;
    const cFlowObj = flowObj.asCompoundFlowObj();

    if (!cFlowObj && nContent > 0) {
      interp.setNextLocation(this.location());
      interp.message(InterpreterMessages.atomicContent, this.foc_.name());
      nContent = 0;
    }

    rest = this.compileNonInheritedCs(interp, env, stackPos + 1, rest);

    for (let i = 0; i < this.keys_.length; i++) {
      if (
        flowObj.hasPseudoNonInheritedC(this.keys_[i]!) &&
        !this.exprs_[i].value?.constantValue()
      ) {
        rest = this.exprs_[i].value!.compile(
          interp,
          env,
          stackPos + 1,
          createSetPseudoNonInheritedCInsn(this.keys_[i]!, this.exprs_[i].value!.location(), rest)
        );
      }
    }

    // FIXME optimize case where there are no non-inherited styles.
    rest = super.compile(interp, env, stackPos + 1, createSetStyleInsn(rest));

    if (nContent === 0 && !contentMapExpr) {
      if (cFlowObj) {
        return createSetDefaultContentInsn(cFlowObj, this.location(), rest);
      } else {
        return createCopyFlowObjInsn(flowObj, rest);
      }
    }

    rest = createSetContentInsn(cFlowObj!, rest);

    if (contentMapExpr) {
      rest = Expression.optimizeCompile(
        contentMapExpr,
        interp,
        env,
        stackPos + 1,
        createContentMapSosofoInsn(contentMapExpr.value!.location(), rest)
      );
      if (nContent === 0) {
        return createMakeDefaultContentInsn(this.location(), rest);
      }
    }

    // FIXME get rid of CheckSosofoInsn if we can guarantee result is a SosofoObj.
    if (nContent === 1) {
      return Expression.optimizeCompile(
        this.exprs_[this.exprs_.length - 1],
        interp,
        env,
        stackPos,
        createCheckSosofoInsn(this.exprs_[this.exprs_.length - 1].value!.location(), rest)
      );
    }

    rest = createSosofoAppendInsn(nContent, rest);
    for (let i = 1; i <= nContent; i++) {
      rest = Expression.optimizeCompile(
        this.exprs_[this.exprs_.length - i],
        interp,
        env,
        stackPos + nContent - i,
        createCheckSosofoInsn(this.exprs_[this.exprs_.length - i].value!.location(), rest)
      );
    }
    return rest;
  }

  private applyConstNonInheritedCs(
    flowObj: FlowObj,
    interp: Interpreter,
    env: Environment
  ): FlowObj {
    let result = flowObj;
    for (let i = 0; i < this.keys_.length; i++) {
      if (
        flowObj.hasNonInheritedC(this.keys_[i]!) ||
        flowObj.hasPseudoNonInheritedC(this.keys_[i]!)
      ) {
        if (this.exprs_[i].value) {
          this.exprs_[i].value!.optimize(interp, env, this.exprs_[i]);
        }
        const val = this.exprs_[i].value?.constantValue();
        if (val) {
          if (result === flowObj) {
            result = flowObj.copy(interp);
            interp.makePermanent(result as unknown as ELObj);
          }
          result.setNonInheritedC(this.keys_[i]!, val, this.exprs_[i].value!.location(), interp);
        }
      }
    }
    return result;
  }

  private compileNonInheritedCs(
    interp: Interpreter,
    env: Environment,
    stackPos: number,
    next: InsnPtr
  ): InsnPtr {
    const flowObj = this.foc_.flowObj();
    if (!flowObj) {
      return next;
    }

    let gotOne = flowObj.isCharacter();
    const boundVars = new BoundVarList();
    env.boundVars(boundVars);

    for (let i = 0; i < this.keys_.length; i++) {
      if (flowObj.hasNonInheritedC(this.keys_[i]!) && !this.exprs_[i].value?.constantValue()) {
        this.exprs_[i].value?.markBoundVars(boundVars, false);
        gotOne = true;
      }
    }

    if (!gotOne) {
      return next;
    }

    boundVars.removeUnused();
    const noVars = new BoundVarList();
    const newEnv = new Environment(noVars, boundVars);

    let code: InsnPtr = null;
    for (let i = 0; i < this.keys_.length; i++) {
      if (flowObj.hasNonInheritedC(this.keys_[i]!) && !this.exprs_[i].value?.constantValue()) {
        code = this.exprs_[i].value!.compile(
          interp,
          newEnv,
          1,
          createSetNonInheritedCInsn(this.keys_[i]!, this.exprs_[i].value!.location(), code)
        );
      }
    }

    let rest = createSetNonInheritedCsSosofoInsn(code, boundVars.length, next);
    if (flowObj.isCharacter()) {
      rest = createSetImplicitCharInsn(new Location(), rest);
    }
    return Expression.compilePushVars(interp, env, stackPos, boundVars, 0, rest);
  }

  protected override unknownStyleKeyword(
    ident: Identifier,
    interp: Interpreter,
    loc: Location
  ): void {
    const flowObj = this.foc_.flowObj();
    if (!flowObj) {
      return;
    }

    let key: { value: number } = { value: 0 };
    if (ident.syntacticKey(key)) {
      switch (key.value) {
        case SyntacticKey.keyLabel:
        case SyntacticKey.keyContentMap:
          return;
        default:
          break;
      }
    }

    if (flowObj.hasNonInheritedC(ident) || flowObj.hasPseudoNonInheritedC(ident)) {
      return;
    }

    interp.setNextLocation(loc);
    const tem = stringCToString(ident.name()) + ':';
    interp.message(InterpreterMessages.invalidMakeKeyword, tem, stringCToString(this.foc_.name()));
  }

  protected override maybeStyleKeyword(ident: Identifier): boolean {
    const flowObj = this.foc_.flowObj();
    if (!flowObj) {
      return true;
    }
    return !flowObj.hasNonInheritedC(ident) && !flowObj.hasPseudoNonInheritedC(ident);
  }
}

// Interpreter message types - these will be defined properly in InterpreterMessages.ts
export const InterpreterMessages = {
  callNonFunction: 'callNonFunction',
  missingArg: 'missingArg',
  oddKeyArgs: 'oddKeyArgs',
  tooManyArgs: 'tooManyArgs',
  undefinedVariableReference: 'undefinedVariableReference',
  topLevelAssignment: 'topLevelAssignment',
  caseFail: 'caseFail',
  caseUnresolvedQuantities: 'caseUnresolvedQuantities',
  undefinedMode: 'undefinedMode',
  invalidStyleKeyword: 'invalidStyleKeyword',
  invalidMakeKeyword: 'invalidMakeKeyword',
  unknownFlowObjectClass: 'unknownFlowObjectClass',
  atomicContent: 'atomicContent'
} as const;

// Helper functions for StyleExpression and MakeExpression

function createVarInheritedC(
  _inheritedC: InheritedC,
  _code: InsnPtr,
  _loc: Location
): InheritedC {
  return {
    make: () => null
  };
}

function createStyleSpec(
  _forceIcs: (InheritedC | null)[],
  _ics: (InheritedC | null)[]
): StyleSpec {
  return {};
}

function createSequenceFlowObj(_interp: Interpreter): FlowObj {
  return new SequenceFlowObj();
}
