// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, Char, StringC, String as StringOf, InputSource, Messenger, Message, Xchar } from '@openjade-js/opensp';
import { Interpreter, LexCategory, SyntacticKey, ProcessingMode, IdentifierImpl, Unit } from './Interpreter';
import { Expression, Environment } from './Interpreter';
import { ELObj, PairObj, SymbolObj, NilObj, CharObj, StringObj, IntegerObj, RealObj, VectorObj, LangObj } from './ELObj';
import { Pattern } from './Pattern';

// Default character for unmapped entities
const defaultChar: Char = 0xfffd;

// End of entity signal from InputSource
const eE = InputSource.eE;

// Token allows flags
const allowEndOfEntity = 0x001;
const allowFalse = 0x002;
const allowKeyword = 0x004;
const allowOpenParen = 0x008;
const allowCloseParen = 0x010;
const allowIdentifier = 0x020;
const allowPeriod = 0x040;
const allowOtherExpr = 0x080;  // number, character, glyph-id, quote, backquote
const allowExpressionKey = 0x100;
const allowKeyDefine = 0x200;
const allowKeyElse = 0x400;
const allowKeyArrow = 0x800; // =>
const allowString = 0x1000;
const allowHashOptional = 0x2000;
const allowHashKey = 0x4000;
const allowHashRest = 0x8000;
const allowUnquote = 0x10000;
const allowUnquoteSplicing = 0x20000;
const allowQuasiquoteKey = 0x40000;
const allowVector = 0x80000;
const allowHashContents = 0x100000;
const allowExpr = (allowFalse | allowKeyword | allowOpenParen | allowIdentifier
                   | allowString | allowHashOptional | allowHashKey | allowHashRest
                   | allowOtherExpr);

// Token types
enum Token {
  tokenEndOfEntity,
  tokenTrue,
  tokenFalse,
  tokenString,
  tokenIdentifier,
  tokenKeyword,
  tokenChar,
  tokenNumber,
  tokenGlyphId,
  tokenOpenParen,
  tokenCloseParen,
  tokenPeriod,
  tokenVector,
  tokenQuote,
  tokenQuasiquote,
  tokenUnquote,
  tokenUnquoteSplicing,
  tokenHashRest,
  tokenHashOptional,
  tokenHashKey,
  tokenHashContents,
  tokenVoid // #v for unspecified value
}

// GlyphIdObj for glyph identifiers
export class GlyphIdObj extends ELObj {
  private publicId_: string;
  private suffix_: number;

  constructor(publicId: string, suffix: number) {
    super();
    this.publicId_ = publicId;
    this.suffix_ = suffix;
  }

  publicId(): string { return this.publicId_; }
  suffix(): number { return this.suffix_; }
}

// Interpreter messages used by SchemeParser
const SchemeParserMessages = {
  badDeclaration: 'badDeclaration',
  invalidCharName: 'invalidCharName',
  invalidCharNumber: 'invalidCharNumber',
  unknownTopLevelForm: 'unknownTopLevelForm',
  badModeForm: 'badModeForm',
  notABuiltinInheritedC: 'notABuiltinInheritedC',
  duplicateCharacteristic: 'duplicateCharacteristic',
  duplicateFlowObjectClass: 'duplicateFlowObjectClass',
  duplicateDefinition: 'duplicateDefinition',
  duplicateUnitDefinition: 'duplicateUnitDefinition',
  syntacticKeywordAsVariable: 'syntacticKeywordAsVariable',
  invalidUnitName: 'invalidUnitName',
  unterminatedString: 'unterminatedString',
  invalidChar: 'invalidChar',
  unexpectedToken: 'unexpectedToken',
  unexpectedEof: 'unexpectedEof',
  missingCloseParen: 'missingCloseParen',
  expectedCloseParen: 'expectedCloseParen',
  expectedIdentifier: 'expectedIdentifier',
  missingExpression: 'missingExpression',
  badSpecialForm: 'badSpecialForm',
  unknownCharName: 'unknownCharName',
  unknownNamedConstant: 'unknownNamedConstant',
  unknownHash: 'unknownHash',
  invalidNumber: 'invalidNumber',
  invalidAfiiGlyphId: 'invalidAfiiGlyphId',
  invalidIdentifier: 'invalidIdentifier',
  caseElse: 'caseElse',
  badAddCharProperty: 'badAddCharProperty',
  duplicateDefLangDecl: 'duplicateDefLangDecl'
} as const;

// Processing mode rule types
export enum RuleType {
  constructionRule,
  styleRule
}

// Expression types (stubs - full implementations in Expression.ts)
export class ConstantExpression implements Expression {
  private obj_: ELObj;
  private loc_: Location;

  constructor(obj: ELObj, loc: Location) {
    this.obj_ = obj;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return this.obj_; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class VariableExpression implements Expression {
  private ident_: IdentifierImpl;
  private loc_: Location;

  constructor(ident: IdentifierImpl, loc: Location) {
    this.ident_ = ident;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class CallExpression implements Expression {
  private func_: Expression;
  private args_: Expression[];
  private loc_: Location;

  constructor(func: Expression, args: Expression[], loc: Location) {
    this.func_ = func;
    this.args_ = args;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class LambdaExpression implements Expression {
  private formals_: IdentifierImpl[];
  private inits_: Expression[];
  private nOptional_: number;
  private hasRest_: boolean;
  private nKey_: number;
  private body_: Expression;
  private loc_: Location;

  constructor(
    formals: IdentifierImpl[],
    inits: Expression[],
    nOptional: number,
    hasRest: boolean,
    nKey: number,
    body: Expression,
    loc: Location
  ) {
    this.formals_ = formals;
    this.inits_ = inits;
    this.nOptional_ = nOptional;
    this.hasRest_ = hasRest;
    this.nKey_ = nKey;
    this.body_ = body;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class IfExpression implements Expression {
  private test_: Expression;
  private consequent_: Expression;
  private alternate_: Expression | null;
  private loc_: Location;

  constructor(test: Expression, consequent: Expression, alternate: Expression | null, loc: Location) {
    this.test_ = test;
    this.consequent_ = consequent;
    this.alternate_ = alternate;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class CondExpression implements Expression {
  private clauses_: Array<{ test: Expression; consequent: Expression }>;
  private else_: Expression | null;
  private loc_: Location;

  constructor(clauses: Array<{ test: Expression; consequent: Expression }>, elseExpr: Expression | null, loc: Location) {
    this.clauses_ = clauses;
    this.else_ = elseExpr;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class SequenceExpression implements Expression {
  private exprs_: Expression[];
  private loc_: Location;

  constructor(exprs: Expression[], loc: Location) {
    this.exprs_ = exprs;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class StyleExpression implements Expression {
  private keys_: IdentifierImpl[];
  private exprs_: Expression[];
  private loc_: Location;

  constructor(keys: IdentifierImpl[], exprs: Expression[], loc: Location) {
    this.keys_ = keys;
    this.exprs_ = exprs;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class AssignmentExpression implements Expression {
  private var_: IdentifierImpl;
  private value_: Expression;
  private loc_: Location;

  constructor(varIdent: IdentifierImpl, value: Expression, loc: Location) {
    this.var_ = varIdent;
    this.value_ = value;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class WithModeExpression implements Expression {
  private mode_: ProcessingMode;
  private content_: Expression;
  private loc_: Location;

  constructor(mode: ProcessingMode, content: Expression, loc: Location) {
    this.mode_ = mode;
    this.content_ = content;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class MakeExpression implements Expression {
  private foc_: IdentifierImpl;
  private keys_: IdentifierImpl[];
  private exprs_: Expression[];
  private loc_: Location;

  constructor(foc: IdentifierImpl, keys: IdentifierImpl[], exprs: Expression[], loc: Location) {
    this.foc_ = foc;
    this.keys_ = keys;
    this.exprs_ = exprs;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class LetExpression implements Expression {
  private vars_: IdentifierImpl[];
  private inits_: Expression[];
  private body_: Expression;
  private loc_: Location;

  constructor(vars: IdentifierImpl[], inits: Expression[], body: Expression, loc: Location) {
    this.vars_ = vars;
    this.inits_ = inits;
    this.body_ = body;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class LetStarExpression implements Expression {
  private vars_: IdentifierImpl[];
  private inits_: Expression[];
  private body_: Expression;
  private loc_: Location;

  constructor(vars: IdentifierImpl[], inits: Expression[], body: Expression, loc: Location) {
    this.vars_ = vars;
    this.inits_ = inits;
    this.body_ = body;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class LetrecExpression implements Expression {
  private vars_: IdentifierImpl[];
  private inits_: Expression[];
  private body_: Expression;
  private loc_: Location;

  constructor(vars: IdentifierImpl[], inits: Expression[], body: Expression, loc: Location) {
    this.vars_ = vars;
    this.inits_ = inits;
    this.body_ = body;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class CaseExpression implements Expression {
  private keyExpr_: Expression;
  private cases_: Array<{ datums: ELObj[]; expr: Expression }>;
  private elseClause_: Expression | null;
  private loc_: Location;

  constructor(
    keyExpr: Expression,
    cases: Array<{ datums: ELObj[]; expr: Expression }>,
    elseClause: Expression | null,
    loc: Location
  ) {
    this.keyExpr_ = keyExpr;
    this.cases_ = cases;
    this.elseClause_ = elseClause;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class OrExpression implements Expression {
  private test1_: Expression;
  private test2_: Expression;
  private loc_: Location;

  constructor(test1: Expression, test2: Expression, loc: Location) {
    this.test1_ = test1;
    this.test2_ = test2;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export class CondFailExpression implements Expression {
  private loc_: Location;

  constructor(loc: Location) {
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

export enum QuasiquoteType {
  listType,
  vectorType,
  improperType
}

export class QuasiquoteExpression implements Expression {
  private exprs_: Expression[];
  private spliced_: boolean[];
  private type_: QuasiquoteType;
  private loc_: Location;

  constructor(exprs: Expression[], spliced: boolean[], type: QuasiquoteType, loc: Location) {
    this.exprs_ = exprs;
    this.spliced_ = spliced;
    this.type_ = type;
    this.loc_ = loc;
  }

  location(): Location { return this.loc_; }
  constantValue(): ELObj | null { return null; }
  canEval(_depth: number): boolean { return true; }
  optimize(_interp: Interpreter, _env: Environment, _owner: { expr: Expression }): void {}
  compile(_interp: Interpreter, _env: Environment, _depth: number, _next: any): any { return null; }
  keyword(): IdentifierImpl | null { return null; }
}

// Helper function to convert StringC to string
function stringCToString(sc: StringC): string {
  if (!sc.ptr_ || sc.length_ === 0) return '';
  let result = '';
  for (let i = 0; i < sc.length_; i++) {
    result += String.fromCharCode(sc.ptr_[i]);
  }
  return result;
}

// Helper to get character at index from StringC
function stringCCharAt(sc: StringC, index: number): number {
  if (!sc.ptr_ || index < 0 || index >= sc.length_) return 0;
  return sc.ptr_[index];
}

// Helper to create StringC from array of characters
function makeStringCFromArray(chars: Char[], start: number, length: number): StringC {
  const arr: Char[] = [];
  for (let i = 0; i < length; i++) {
    arr.push(chars[start + i]);
  }
  return new StringOf<Char>(arr, length);
}

// Helper to create StringC from Char array (no start offset)
function makeStringCFromChars(chars: Char[]): StringC {
  return new StringOf<Char>(chars, chars.length);
}

// Helper to check if StringC equals a JS string
function stringCEquals(sc: StringC, str: string): boolean {
  if (sc.length_ !== str.length) return false;
  for (let i = 0; i < sc.length_; i++) {
    if (stringCCharAt(sc, i) !== str.charCodeAt(i)) return false;
  }
  return true;
}

// Helper to check if StringC ends with a character code
function stringCEndsWith(sc: StringC, charCode: Char): boolean {
  if (sc.length_ === 0) return false;
  return stringCCharAt(sc, sc.length_ - 1) === charCode;
}

// Helper to get StringC without last character
function stringCDropLast(sc: StringC): StringC {
  if (sc.length_ <= 1) return Interpreter.makeStringC('');
  const arr: Char[] = [];
  for (let i = 0; i < sc.length_ - 1; i++) {
    arr.push(stringCCharAt(sc, i));
  }
  return makeStringCFromChars(arr);
}

// SchemeParser class - extends Messenger for InputSource tokenChar API
export class SchemeParser extends Messenger {
  private interp_: Interpreter;
  private in_: InputSource | null;
  private currentToken_: StringC;
  private defMode_: ProcessingMode;
  private afiiPublicId_: string;
  private dsssl2_: boolean;
  private lang_: LangObj | null = null;

  // Lookahead character for peek simulation (-2 means no lookahead)
  private lookahead_: Xchar = -2;

  constructor(interp: Interpreter, inputSource: InputSource | null) {
    super();
    this.interp_ = interp;
    this.in_ = inputSource;
    this.defMode_ = interp.initialProcessingMode();
    this.dsssl2_ = interp.dsssl2();
    this.currentToken_ = Interpreter.makeStringC('');
    this.afiiPublicId_ = 'ISO/IEC 10036/RA//Glyphs';
  }

  // Messenger interface implementation
  dispatchMessage(msg: Message): void {
    this.interp_.dispatchMessage(msg);
  }

  // Low-level character reading - delegates to InputSource with this as messenger
  private getChar(): Xchar {
    if (this.lookahead_ !== -2) {
      const c = this.lookahead_;
      this.lookahead_ = -2;
      return c;
    }
    if (!this.in_) return eE;
    return this.in_.tokenChar(this);
  }

  // Peek at next character without consuming
  private peekChar(): Xchar {
    if (this.lookahead_ !== -2) {
      return this.lookahead_;
    }
    if (!this.in_) return eE;
    this.lookahead_ = this.in_.tokenChar(this);
    return this.lookahead_;
  }

  // Extend token by reading identifier characters
  private extendToken(): void {
    if (!this.in_) return;
    for (;;) {
      const c = this.peekChar();
      if (c === eE) break;
      const cat = this.interp_.lexCategory(c);
      if (cat !== LexCategory.lexOther && cat !== LexCategory.lexLetter &&
          cat !== LexCategory.lexDigit && cat !== LexCategory.lexAddNameStart) {
        break;
      }
      this.getChar(); // consume
    }
  }

  // Build currentToken_ from InputSource buffer
  private setCurrentToken(): void {
    if (!this.in_) {
      this.currentToken_ = Interpreter.makeStringC('');
      return;
    }
    const start = this.in_.currentTokenStart();
    const startIdx = this.in_.currentTokenStartIndex();
    const length = this.in_.currentTokenLength();
    this.currentToken_ = makeStringCFromArray(start, startIdx, length);
  }

  // Helper methods
  private lookup(str: StringC): IdentifierImpl {
    return this.interp_.lookup(str);
  }

  private lookupProcessingMode(name: StringC): ProcessingMode {
    return this.interp_.lookupProcessingMode(name);
  }

  private dsssl2(): boolean {
    return this.dsssl2_;
  }

  private reportMessage(msgType: string, ...args: any[]): void {
    this.interp_.message(msgType, ...args);
  }

  private currentLocation(): Location {
    return this.in_?.currentLocation() ?? new Location();
  }

  // Main parsing methods

  parseStandardChars(): void {
    for (;;) {
      const tok = { value: Token.tokenVoid };
      if (!this.getToken(allowIdentifier | allowEndOfEntity, tok) ||
          tok.value === Token.tokenEndOfEntity) {
        break;
      }

      const name = this.currentToken_;

      if (!this.getToken(allowOtherExpr, tok) || tok.value !== Token.tokenNumber) {
        this.reportMessage(SchemeParserMessages.badDeclaration);
        break;
      }

      // Validate character name
      let valid = true;
      for (let i = 0; i < name.length_; i++) {
        const c = stringCCharAt(name, i);
        const cat = this.interp_.lexCategory(c);
        if (cat !== LexCategory.lexLetter &&
            (i === 0 || (cat !== LexCategory.lexDigit &&
                         c !== 0x2D && // '-'
                         c !== 0x2E))) { // '.'
          valid = false;
          break;
        }
      }
      if (!valid || name.length_ === 1) {
        this.reportMessage(SchemeParserMessages.invalidCharName, stringCToString(name));
        continue;
      }

      // Validate that currentToken_ is all digits
      let allDigits = true;
      for (let i = 0; i < this.currentToken_.length_; i++) {
        if (this.interp_.lexCategory(stringCCharAt(this.currentToken_, i)) !== LexCategory.lexDigit) {
          allDigits = false;
          break;
        }
      }

      if (!allDigits) {
        this.reportMessage(SchemeParserMessages.invalidCharNumber, stringCToString(this.currentToken_));
        continue;
      }

      // Parse the character code number
      const charCode = parseInt(stringCToString(this.currentToken_), 10);
      this.interp_.addStandardChar(name, charCode);
    }
  }

  parseNameChars(): void {
    for (;;) {
      const tok = { value: Token.tokenVoid };
      if (!this.getToken(allowIdentifier | allowEndOfEntity, tok) ||
          tok.value === Token.tokenEndOfEntity) {
        break;
      }
      // Parse the character code
      const charCode = parseInt(stringCToString(this.currentToken_), 10);
      this.interp_.addNameChar(this.currentToken_, charCode);
    }
  }

  parseSeparatorChars(): void {
    for (;;) {
      const tok = { value: Token.tokenVoid };
      if (!this.getToken(allowIdentifier | allowEndOfEntity, tok) ||
          tok.value === Token.tokenEndOfEntity) {
        break;
      }
      // Parse the character code
      const charCode = parseInt(stringCToString(this.currentToken_), 10);
      this.interp_.addSeparatorChar(this.currentToken_, charCode);
    }
  }

  parseMapSdataEntity(ename: StringC, etext: StringC): void {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier | allowEndOfEntity, tok) ||
        tok.value === Token.tokenEndOfEntity) {
      this.reportMessage(SchemeParserMessages.badDeclaration);
      return;
    }
    // Parse the character code
    const charCode = parseInt(stringCToString(this.currentToken_), 10);
    this.interp_.addSdataEntity(ename, etext, charCode);
  }

  parse(): void {
    let recovering = false;
    for (;;) {
      const tok = { value: Token.tokenVoid };
      if (!this.getToken(recovering ? ~0 : allowOpenParen | allowEndOfEntity, tok)) {
        recovering = true;
      } else {
        if (tok.value === Token.tokenEndOfEntity) {
          break;
        }
        if (tok.value !== Token.tokenOpenParen ||
            !this.getToken(recovering ? ~0 : allowIdentifier, tok) ||
            (tok.value as Token) !== Token.tokenIdentifier) {
          recovering = true;
        } else {
          const ident = this.lookup(this.currentToken_);
          const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
          if (!ident.syntacticKey(key)) {
            if (!recovering) {
              this.reportMessage(SchemeParserMessages.unknownTopLevelForm, this.currentToken_);
            }
            recovering = true;
          } else {
            switch (key.value) {
              case SyntacticKey.keyDefine:
                recovering = !this.doDefine();
                break;
              case SyntacticKey.keyDefineUnit:
                recovering = !this.doDefineUnit();
                break;
              case SyntacticKey.keyDefault:
                recovering = !this.doDefault();
                break;
              case SyntacticKey.keyElement:
                recovering = !this.doElement();
                break;
              case SyntacticKey.keyOrElement:
                recovering = !this.doOrElement();
                break;
              case SyntacticKey.keyRoot:
                recovering = !this.doRoot();
                break;
              case SyntacticKey.keyId:
                recovering = !this.doId();
                break;
              case SyntacticKey.keyMode:
                recovering = !this.doMode();
                break;
              case SyntacticKey.keyDeclareInitialValue:
                recovering = !this.doDeclareInitialValue();
                break;
              case SyntacticKey.keyDeclareCharacteristic:
                recovering = !this.doDeclareCharacteristic();
                break;
              case SyntacticKey.keyDeclareFlowObjectClass:
                recovering = !this.doDeclareFlowObjectClass();
                break;
              case SyntacticKey.keyDeclareClassAttribute:
                recovering = !this.doDeclareClassAttribute();
                break;
              case SyntacticKey.keyDeclareIdAttribute:
                recovering = !this.doDeclareIdAttribute();
                break;
              case SyntacticKey.keyDeclareFlowObjectMacro:
                recovering = !this.doDeclareFlowObjectMacro();
                break;
              case SyntacticKey.keyDeclareDefaultLanguage:
                recovering = !this.doDeclareDefaultLanguage();
                break;
              case SyntacticKey.keyDefineLanguage:
                recovering = !this.doDefineLanguage();
                break;
              case SyntacticKey.keyDeclareCharProperty:
                recovering = !this.doDeclareCharProperty();
                break;
              case SyntacticKey.keyAddCharProperties:
                recovering = !this.doAddCharProperties();
                break;
              case SyntacticKey.keyDeclareCharCharacteristicAndProperty:
                recovering = !this.doDeclareCharCharacteristicAndProperty();
                break;
              case SyntacticKey.keyDeclareReferenceValueType:
              case SyntacticKey.keyDefinePageModel:
              case SyntacticKey.keyDefineColumnSetModel:
                recovering = !this.skipForm();
                break;
              default:
                if (!recovering) {
                  this.reportMessage(SchemeParserMessages.unknownTopLevelForm, this.currentToken_);
                }
                recovering = true;
                break;
            }
          }
        }
      }
    }
  }

  parseExpression(expr: { value: Expression | null }): boolean {
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    const tok = { value: Token.tokenVoid };
    if (!this.parseExpressionFull(0, expr, key, tok)) {
      return false;
    }
    this.getToken(allowEndOfEntity, tok);
    return true;
  }

  private parseExpressionFull(
    allowed: number,
    expr: { value: Expression | null },
    key: { value: SyntacticKey },
    tok: { value: Token }
  ): boolean {
    expr.value = null;
    key.value = SyntacticKey.notKey;

    const obj = { value: null as ELObj | null };
    if (!this.parseSelfEvaluating(allowed, obj, tok)) {
      return false;
    }
    if (obj.value) {
      this.interp_.makePermanent(obj.value);
      expr.value = new ConstantExpression(obj.value, this.currentLocation());
      return true;
    }

    switch (tok.value) {
      case Token.tokenQuote: {
        const loc = { value: new Location() };
        const datum = { value: null as ELObj | null };
        if (!this.parseDatum(0, datum, loc, tok)) {
          return false;
        }
        this.interp_.makePermanent(datum.value!);
        expr.value = new ConstantExpression(datum.value!, loc.value);
        break;
      }

      case Token.tokenQuasiquote: {
        const spliced = { value: false };
        return this.parseQuasiquoteTemplate(0, 0, expr, key, tok, spliced);
      }

      case Token.tokenOpenParen: {
        const loc = this.currentLocation();
        if (!this.parseExpressionFull(allowExpressionKey, expr, key, tok)) {
          return false;
        }
        if (expr.value) {
          const args: Expression[] = [];
          for (;;) {
            const argExpr = { value: null as Expression | null };
            if (!this.parseExpressionFull(allowCloseParen, argExpr, key, tok)) {
              return false;
            }
            if (!argExpr.value) {
              break;
            }
            args.push(argExpr.value);
          }
          expr.value = new CallExpression(expr.value, args, loc);
        } else {
          // Type assertion needed because TS narrows key.value after assignment
          switch (key.value as SyntacticKey) {
            case SyntacticKey.keyQuote:
              return this.parseQuote(expr);
            case SyntacticKey.keyLambda:
              return this.parseLambda(expr);
            case SyntacticKey.keyIf:
              return this.parseIf(expr);
            case SyntacticKey.keyCond:
              return this.parseCond(expr);
            case SyntacticKey.keyAnd:
              return this.parseAnd(expr);
            case SyntacticKey.keyOr:
              return this.parseOr(expr);
            case SyntacticKey.keyCase:
              return this.parseCase(expr);
            case SyntacticKey.keyLet:
              return this.parseLet(expr);
            case SyntacticKey.keyLetStar:
              return this.parseLetStar(expr);
            case SyntacticKey.keyLetrec:
              return this.parseLetrec(expr);
            case SyntacticKey.keyThereExists:
              return this.parseSpecialQuery(expr, 'node-list-some?');
            case SyntacticKey.keyForAll:
              return this.parseSpecialQuery(expr, 'node-list-every?');
            case SyntacticKey.keySelectEach:
              return this.parseSpecialQuery(expr, 'node-list-filter');
            case SyntacticKey.keyUnionForEach:
              return this.parseSpecialQuery(expr, 'node-list-union-map');
            case SyntacticKey.keyMake:
              return this.parseMake(expr);
            case SyntacticKey.keyStyle:
              return this.parseStyle(expr);
            case SyntacticKey.keyWithMode:
              return this.parseWithMode(expr);
            case SyntacticKey.keyQuasiquote:
              return this.parseQuasiquote(expr);
            case SyntacticKey.keySet:
              return this.parseSet(expr);
            case SyntacticKey.keyBegin:
              return this.parseBegin(expr);
            default:
              throw new Error('CANNOT_HAPPEN');
          }
        }
        break;
      }

      case Token.tokenIdentifier: {
        const ident = this.lookup(this.currentToken_);
        if (ident.syntacticKey(key) && key.value <= SyntacticKey.keyWithMode) {
          // Type assertion needed because TS narrows key.value after assignment
          switch (key.value as SyntacticKey) {
            case SyntacticKey.keyDefine:
              if (allowed & allowKeyDefine) return true;
              break;
            case SyntacticKey.keyArrow:
              if (allowed & allowKeyArrow) return true;
              break;
            case SyntacticKey.keyElse:
              if (allowed & allowKeyElse) return true;
              break;
            case SyntacticKey.keyUnquote:
            case SyntacticKey.keyUnquoteSplicing:
              break;
            default:
              if (allowed & allowExpressionKey) return true;
              break;
          }
          this.reportMessage(SchemeParserMessages.syntacticKeywordAsVariable, this.currentToken_);
        }
        expr.value = new VariableExpression(ident, this.currentLocation());
        break;
      }
    }
    return true;
  }

  // Declaration handlers

  private doDefine(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowOpenParen | allowIdentifier, tok)) {
      return false;
    }

    const formals: IdentifierImpl[] = [];
    let isProcedure = false;

    if (tok.value === Token.tokenOpenParen) {
      if (!this.getToken(allowIdentifier, tok)) {
        return false;
      }
      isProcedure = true;
    }

    const ident = this.lookup(this.currentToken_);
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(key) && key.value <= SyntacticKey.keyWithMode) {
      this.reportMessage(SchemeParserMessages.syntacticKeywordAsVariable, this.currentToken_);
    }

    const inits: Expression[] = [];
    let nOptional = 0;
    let nKey = 0;
    let hasRest = false;

    if (isProcedure) {
      const result = this.parseFormals(formals, inits);
      if (!result.success) return false;
      nOptional = result.nOptional;
      hasRest = result.hasRest;
      nKey = result.nKey;
    }

    const expr = { value: null as Expression | null };
    if (isProcedure) {
      if (!this.parseBegin(expr)) {
        return false;
      }
    } else {
      if (!this.parseExpressionFull(0, expr, key, tok)) {
        return false;
      }
      if (!this.getToken(allowCloseParen, tok)) {
        return false;
      }
    }

    if (isProcedure && expr.value) {
      expr.value = new LambdaExpression(formals, inits, nOptional, hasRest, nKey, expr.value, loc);
    }

    const defLoc = { value: null as Location | null };
    const defPart = { value: 0 };
    if (ident.defined(defPart, defLoc) && defPart.value <= this.interp_.currentPartIndex()) {
      if (defPart.value === this.interp_.currentPartIndex()) {
        this.reportMessage(SchemeParserMessages.duplicateDefinition, ident.name(), defLoc.value);
      }
    } else if (expr.value) {
      ident.setDefinition(expr.value, this.interp_.currentPartIndex(), loc);
    }
    return true;
  }

  private doDefineUnit(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }

    // Validate unit name - must be all letters and not just 'e'
    let valid = true;
    for (let i = 0; i < this.currentToken_.length_; i++) {
      if (this.interp_.lexCategory(stringCCharAt(this.currentToken_, i)) !== LexCategory.lexLetter) {
        valid = false;
        break;
      }
    }
    if (!valid || (this.currentToken_.length_ === 1 && stringCCharAt(this.currentToken_, 0) === 0x65)) { // 'e'
      this.reportMessage(SchemeParserMessages.invalidUnitName, this.currentToken_);
      return false;
    }

    const unit = this.interp_.lookupUnit(this.currentToken_);
    const expr = { value: null as Expression | null };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (!this.parseExpressionFull(0, expr, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }

    const defLoc = { value: null as Location | null };
    const defPart = { value: 0 };
    if (unit.defined(defPart, defLoc) && defPart.value <= this.interp_.currentPartIndex()) {
      if (defPart.value === this.interp_.currentPartIndex()) {
        this.reportMessage(SchemeParserMessages.duplicateUnitDefinition, unit.name(), defLoc.value);
      }
    } else if (expr.value) {
      unit.setDefinition(expr.value, this.interp_.currentPartIndex(), loc);
    }
    return true;
  }

  private doMode(): boolean {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    this.defMode_ = this.lookupProcessingMode(this.currentToken_);
    this.defMode_.setDefined();

    for (;;) {
      if (!this.getToken(allowOpenParen | allowCloseParen, tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      if (!this.getToken(allowIdentifier, tok)) {
        return false;
      }
      const ident = this.lookup(this.currentToken_);
      const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
      if (!ident.syntacticKey(key)) {
        this.reportMessage(SchemeParserMessages.badModeForm, this.currentToken_);
        return false;
      }

      switch (key.value) {
        case SyntacticKey.keyDefault:
          if (!this.doDefault()) return false;
          break;
        case SyntacticKey.keyElement:
          if (!this.doElement()) return false;
          break;
        case SyntacticKey.keyOrElement:
          if (!this.doOrElement()) return false;
          break;
        case SyntacticKey.keyRoot:
          if (!this.doRoot()) return false;
          break;
        case SyntacticKey.keyId:
          if (!this.doId()) return false;
          break;
        default:
          this.reportMessage(SchemeParserMessages.badModeForm, this.currentToken_);
          return false;
      }
    }
    this.defMode_ = this.interp_.initialProcessingMode();
    return true;
  }

  private doElement(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    const obj = { value: null as ELObj | null };
    const datumLoc = { value: new Location() };
    if (!this.parseDatum(0, obj, datumLoc, tok)) {
      return false;
    }

    const patterns: Pattern[] = [];
    const expr = { value: null as Expression | null };
    const ruleType = { value: RuleType.constructionRule };

    const pattern = { value: new Pattern() };
    if (this.interp_.convertToPattern(obj.value!, loc, pattern)) {
      patterns.push(pattern.value);
      if (!this.parseRuleBody(expr, ruleType)) {
        return false;
      }
      // this.defMode_.addRule(false, patterns, expr.value!, ruleType.value, loc, this.interp_);
    } else if (!this.parseRuleBody(expr, ruleType)) {
      return false;
    }
    return true;
  }

  private doOrElement(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowOpenParen, tok)) {
      return false;
    }

    const patterns: Pattern[] = [];
    let allowed = 0;
    let ok = true;

    for (;;) {
      const obj = { value: null as ELObj | null };
      const datumLoc = { value: new Location() };
      if (!this.parseDatum(allowed, obj, datumLoc, tok)) {
        return false;
      }
      if (!obj.value) {
        break;
      }
      allowed = allowCloseParen;
      if (ok) {
        const pattern = { value: new Pattern() };
        if (!this.interp_.convertToPattern(obj.value, loc, pattern)) {
          ok = false;
        } else {
          patterns.push(pattern.value);
        }
      }
    }

    const expr = { value: null as Expression | null };
    const ruleType = { value: RuleType.constructionRule };
    if (!this.parseRuleBody(expr, ruleType)) {
      return false;
    }

    // if (ok) {
    //   this.defMode_.addRule(false, patterns, expr.value!, ruleType.value, loc, this.interp_);
    // }
    return true;
  }

  private doDefault(): boolean {
    const loc = this.currentLocation();
    const expr = { value: null as Expression | null };
    const ruleType = { value: RuleType.constructionRule };
    if (!this.parseRuleBody(expr, ruleType)) {
      return false;
    }
    // Create default pattern and add rule
    return true;
  }

  private doRoot(): boolean {
    const loc = this.currentLocation();
    const expr = { value: null as Expression | null };
    const ruleType = { value: RuleType.constructionRule };
    if (!this.parseRuleBody(expr, ruleType)) {
      return false;
    }
    // Add root rule
    return true;
  }

  private doId(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowString | allowIdentifier, tok)) {
      return false;
    }
    const id = this.currentToken_;
    const expr = { value: null as Expression | null };
    const ruleType = { value: RuleType.constructionRule };
    if (!this.parseRuleBody(expr, ruleType)) {
      return false;
    }
    // Create id pattern and add rule
    return true;
  }

  private doDeclareInitialValue(): boolean {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const ident = this.lookup(this.currentToken_);
    if (!ident.inheritedC()) {
      this.reportMessage(SchemeParserMessages.notABuiltinInheritedC, ident.name());
    }
    const expr = { value: null as Expression | null };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (!this.parseExpressionFull(0, expr, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    if (!ident.inheritedC()) {
      return true;
    }
    if (expr.value) {
      this.interp_.installInitialValue(ident, expr.value);
    }
    return true;
  }

  private doDeclareCharacteristic(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const ident = this.lookup(this.currentToken_);
    if (!this.getToken(allowString | (this.dsssl2() ? allowFalse : 0), tok)) {
      return false;
    }
    let pubid = '';
    if (tok.value === Token.tokenString) {
      pubid = stringCToString(this.currentToken_);
    }
    const expr = { value: null as Expression | null };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (!this.parseExpressionFull(0, expr, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    // Handle characteristic declaration
    return true;
  }

  private doDeclareCharCharacteristicAndProperty(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const ident = this.lookup(this.currentToken_);
    if (!this.getToken(allowString | (this.dsssl2() ? allowFalse : 0), tok)) {
      return false;
    }
    let pubid: StringC = new StringOf<Char>();
    if (tok.value === Token.tokenString) {
      pubid = this.currentToken_;
    }
    const expr = { value: null as Expression | null };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (!this.parseExpressionFull(0, expr, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    // Handle char characteristic and property declaration
    if (expr.value) {
      this.interp_.installExtensionCharNIC(ident, pubid, loc);
      this.interp_.addCharProperty(ident, expr.value);
    }
    return true;
  }

  private doDeclareFlowObjectClass(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const ident = this.lookup(this.currentToken_);
    if (!this.getToken(allowString, tok)) {
      return false;
    }
    // Handle flow object class declaration
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    return true;
  }

  private doDeclareFlowObjectMacro(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const ident = this.lookup(this.currentToken_);
    if (!this.getToken(allowOpenParen, tok)) {
      return false;
    }

    const nics: IdentifierImpl[] = [];
    const inits: Expression[] = [];
    let contentsId: IdentifierImpl | null = null;
    let allowed = allowOpenParen | allowCloseParen | allowIdentifier | allowHashContents;

    for (;;) {
      if (!this.getToken(allowed, tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      switch (tok.value) {
        case Token.tokenHashContents:
          if (!this.getToken(allowIdentifier, tok)) {
            return false;
          }
          contentsId = this.lookup(this.currentToken_);
          allowed = allowCloseParen;
          break;
        case Token.tokenIdentifier:
          nics.push(this.lookup(this.currentToken_));
          break;
        case Token.tokenOpenParen: {
          if (!this.getToken(allowIdentifier, tok)) {
            return false;
          }
          nics.push(this.lookup(this.currentToken_));
          const initExpr = { value: null as Expression | null };
          const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
          if (!this.parseExpressionFull(0, initExpr, key, tok)) {
            return false;
          }
          if (initExpr.value) {
            inits.push(initExpr.value);
          }
          if (!this.getToken(allowCloseParen, tok)) {
            return false;
          }
          break;
        }
      }
    }

    const body = { value: null as Expression | null };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (!this.parseExpressionFull(0, body, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    // Create and install macro flow object
    return true;
  }

  private doDeclareClassAttribute(): boolean {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowString | allowIdentifier, tok)) {
      return false;
    }
    this.interp_.addClassAttributeName(this.currentToken_);
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    return true;
  }

  private doDeclareIdAttribute(): boolean {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowString | allowIdentifier, tok)) {
      return false;
    }
    this.interp_.addIdAttributeName(this.currentToken_);
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    return true;
  }

  private doDeclareDefaultLanguage(): boolean {
    const loc = this.currentLocation();
    const expr = { value: null as Expression | null };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    const tok = { value: Token.tokenVoid };
    if (!this.parseExpressionFull(0, expr, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    if (expr.value) {
      this.interp_.setDefaultLanguage(expr.value, this.interp_.currentPartIndex(), loc);
    }
    return true;
  }

  private doDefineLanguage(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }

    const ident = this.lookup(this.currentToken_);
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(key) && key.value <= SyntacticKey.keyWithMode) {
      this.reportMessage(SchemeParserMessages.syntacticKeywordAsVariable, this.currentToken_);
    }

    const defLoc = { value: null as Location | null };
    const defPart = { value: 0 };
    if (ident.defined(defPart, defLoc) && defPart.value <= this.interp_.currentPartIndex()) {
      if (defPart.value === this.interp_.currentPartIndex()) {
        this.reportMessage(SchemeParserMessages.duplicateDefinition, ident.name(), defLoc.value);
        return false;
      }
    }

    this.lang_ = this.interp_.makeLangObj();

    for (;;) {
      if (!this.getToken(allowOpenParen | allowCloseParen, tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      if (!this.getToken(allowIdentifier, tok)) {
        return false;
      }
      const formIdent = this.lookup(this.currentToken_);
      const formKey = { value: SyntacticKey.notKey };
      if (!formIdent.syntacticKey(formKey)) {
        return false;
      }
      switch (formKey.value) {
        case SyntacticKey.keyCollate:
          if (!this.doCollate()) return false;
          break;
        case SyntacticKey.keyToupper:
          if (!this.doToupper()) return false;
          break;
        case SyntacticKey.keyTolower:
          if (!this.doTolower()) return false;
          break;
        default:
          return false;
      }
    }

    if (!this.lang_.compile()) {
      return false;
    }
    this.interp_.makePermanent(this.lang_);
    const expr = new ConstantExpression(this.lang_, this.currentLocation());
    this.lang_ = null;
    ident.setDefinition(expr, this.interp_.currentPartIndex(), loc);
    return true;
  }

  private doCollate(): boolean {
    const tok = { value: Token.tokenVoid };
    for (;;) {
      if (!this.getToken(allowOpenParen | allowCloseParen, tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      if (!this.getToken(allowIdentifier, tok)) {
        return false;
      }
      const ident = this.lookup(this.currentToken_);
      const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
      if (!ident.syntacticKey(key)) {
        return false;
      }
      switch (key.value) {
        case SyntacticKey.keyElement:
          if (!this.doMultiCollatingElement()) return false;
          break;
        case SyntacticKey.keySymbol:
          if (!this.doCollatingSymbol()) return false;
          break;
        case SyntacticKey.keyOrder:
          if (!this.doCollatingOrder()) return false;
          break;
        default:
          return false;
      }
    }
    return true;
  }

  private doMultiCollatingElement(): boolean {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const sym = stringCToString(this.currentToken_);
    if (!this.getToken(allowString, tok)) {
      return false;
    }
    const str = stringCToString(this.currentToken_);
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    this.lang_?.addMultiCollatingElement(sym, str);
    return true;
  }

  private doCollatingSymbol(): boolean {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const sym = stringCToString(this.currentToken_);
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    this.lang_?.addCollatingSymbol(sym);
    return true;
  }

  private doCollatingOrder(): boolean {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowOpenParen, tok)) {
      return false;
    }

    let nested = 0;
    let sort = { forward: false, backward: false, position: false };

    for (;;) {
      if (!this.getToken((nested === 0 ? allowOpenParen : 0) | allowCloseParen | allowIdentifier, tok)) {
        return false;
      }
      if (tok.value === Token.tokenOpenParen) {
        nested++;
      } else if (tok.value === Token.tokenCloseParen) {
        nested--;
      } else {
        const ident = this.lookup(this.currentToken_);
        const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
        if (!ident.syntacticKey(key)) {
          return false;
        }
        switch (key.value) {
          case SyntacticKey.keyForward:
            if (sort.backward) return false;
            sort.forward = true;
            break;
          case SyntacticKey.keyBackward:
            if (sort.forward) return false;
            sort.backward = true;
            break;
          case SyntacticKey.keyPosition:
            sort.position = true;
            break;
          default:
            return false;
        }
      }
      if (nested < 0) {
        break;
      }
      if (nested === 0) {
        if (!sort.backward) {
          sort.forward = true;
        }
        this.lang_?.addLevel(sort);
        sort = { forward: false, backward: false, position: false };
      }
    }

    for (;;) {
      if (!this.getToken(allowOpenParen | allowCloseParen | allowIdentifier | allowOtherExpr, tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      const empty = '';
      switch (tok.value) {
        case Token.tokenTrue:
          this.lang_?.addDefaultPos();
          for (let i = 0; i < (this.lang_?.levels() ?? 0); i++) {
            this.lang_?.addLevelWeight(i, empty);
          }
          break;
        case Token.tokenIdentifier:
        case Token.tokenChar:
          if (!this.lang_?.addCollatingPos(stringCToString(this.currentToken_))) {
            return false;
          }
          for (let i = 0; i < (this.lang_?.levels() ?? 0); i++) {
            this.lang_?.addLevelWeight(i, stringCToString(this.currentToken_));
          }
          break;
        case Token.tokenOpenParen:
          if (!this.doWeights()) {
            return false;
          }
          break;
        default:
          return false;
      }
    }
    return true;
  }

  private doWeights(): boolean {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier | allowOtherExpr, tok)) {
      return false;
    }
    const sym = stringCToString(this.currentToken_);
    if (!this.lang_?.addCollatingPos(sym)) {
      return false;
    }

    let nested = 0;
    let level = 0;

    for (;;) {
      if (!this.getToken((nested ? 0 : allowOpenParen) | allowCloseParen | allowIdentifier | allowOtherExpr | allowString, tok)) {
        return false;
      }
      if (tok.value === Token.tokenOpenParen) {
        nested++;
      } else if (tok.value === Token.tokenCloseParen) {
        nested--;
      } else {
        switch (tok.value as Token) {
          case Token.tokenString:
            for (let i = 0; i < this.currentToken_.length_; i++) {
              const ctok = String.fromCharCode(stringCCharAt(this.currentToken_, i));
              if (!this.lang_?.addLevelWeight(level, ctok)) {
                return false;
              }
            }
            break;
          case Token.tokenIdentifier:
          case Token.tokenChar:
            if (!this.lang_?.addLevelWeight(level, stringCToString(this.currentToken_))) {
              return false;
            }
            break;
          default:
            return false;
        }
      }
      if (nested < 0) {
        break;
      }
      if (nested === 0) {
        level++;
      }
    }
    return true;
  }

  private doToupper(): boolean {
    const tok = { value: Token.tokenVoid };
    for (;;) {
      if (!this.getToken(allowOpenParen | allowCloseParen, tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      if (!this.getToken(allowOtherExpr, tok) || tok.value !== Token.tokenChar) {
        return false;
      }
      const lc = stringCCharAt(this.currentToken_, 0);
      if (!this.getToken(allowOtherExpr, tok) || tok.value !== Token.tokenChar) {
        return false;
      }
      const uc = stringCCharAt(this.currentToken_, 0);
      if (!this.getToken(allowCloseParen, tok)) {
        return false;
      }
      this.lang_?.addToupper(lc, uc);
    }
    return true;
  }

  private doTolower(): boolean {
    const tok = { value: Token.tokenVoid };
    for (;;) {
      if (!this.getToken(allowOpenParen | allowCloseParen, tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      if (!this.getToken(allowOtherExpr, tok) || tok.value !== Token.tokenChar) {
        return false;
      }
      const uc = stringCCharAt(this.currentToken_, 0);
      if (!this.getToken(allowOtherExpr, tok) || tok.value !== Token.tokenChar) {
        return false;
      }
      const lc = stringCCharAt(this.currentToken_, 0);
      if (!this.getToken(allowCloseParen, tok)) {
        return false;
      }
      this.lang_?.addTolower(uc, lc);
    }
    return true;
  }

  private doDeclareCharProperty(): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const ident = this.lookup(this.currentToken_);
    const expr = { value: null as Expression | null };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (!this.parseExpressionFull(0, expr, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    if (expr.value) {
      this.interp_.addCharProperty(ident, expr.value);
    }
    return true;
  }

  private doAddCharProperties(): boolean {
    const exprs: Expression[] = [];
    const keys: IdentifierImpl[] = [];
    const tok = { value: Token.tokenVoid };

    for (;;) {
      if (!this.getToken(allowKeyword | allowOtherExpr, tok)) {
        return false;
      }
      if (tok.value !== Token.tokenKeyword) {
        break;
      }
      keys.push(this.lookup(this.currentToken_));
      const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
      const initExpr = { value: null as Expression | null };
      if (!this.parseExpressionFull(0, initExpr, key, tok)) {
        return false;
      }
      if (initExpr.value) {
        exprs.push(initExpr.value);
      }
    }

    for (;;) {
      if (tok.value !== Token.tokenChar) {
        this.reportMessage(SchemeParserMessages.badDeclaration);
        return false;
      }
      const ch = stringCCharAt(this.currentToken_, 0);
      for (let j = 0; j < keys.length; j++) {
        this.interp_.setCharProperty(keys[j], ch, exprs[j]);
      }
      if (!this.getToken(allowOtherExpr | allowCloseParen, tok)) {
        return false;
      }
      if ((tok.value as Token) === Token.tokenCloseParen) {
        break;
      }
    }
    return true;
  }

  private skipForm(): boolean {
    const allow = ~allowEndOfEntity;
    let level = 0;
    for (;;) {
      const tok = { value: Token.tokenVoid };
      if (!this.getToken(allow, tok)) {
        break;
      }
      switch (tok.value) {
        case Token.tokenOpenParen:
          level++;
          break;
        case Token.tokenCloseParen:
          if (level === 0) {
            return true;
          }
          level--;
          break;
      }
    }
    return false;
  }

  private parseRuleBody(
    expr: { value: Expression | null },
    ruleType: { value: RuleType }
  ): boolean {
    const tok = { value: Token.tokenVoid };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (!this.parseExpressionFull(0, expr, key, tok)) {
      return false;
    }
    // Check if this is a style rule (has keyword)
    ruleType.value = RuleType.constructionRule;
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    return true;
  }

  // Expression parsing helpers

  private parseQuote(expr: { value: Expression | null }): boolean {
    const tok = { value: Token.tokenVoid };
    const loc = { value: new Location() };
    const obj = { value: null as ELObj | null };
    if (!this.parseDatum(0, obj, loc, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    if (obj.value) {
      this.interp_.makePermanent(obj.value);
      expr.value = new ConstantExpression(obj.value, loc.value);
    }
    return true;
  }

  private parseLambda(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const formals: IdentifierImpl[] = [];
    const inits: Expression[] = [];
    const result = this.parseFormals(formals, inits);
    if (!result.success) {
      return false;
    }
    const body = { value: null as Expression | null };
    if (!this.parseBegin(body)) {
      return false;
    }
    if (body.value) {
      expr.value = new LambdaExpression(
        formals, inits, result.nOptional, result.hasRest, result.nKey, body.value, loc
      );
    }
    return true;
  }

  private parseFormals(
    formals: IdentifierImpl[],
    inits: Expression[]
  ): { success: boolean; nOptional: number; hasRest: boolean; nKey: number } {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowOpenParen, tok)) {
      return { success: false, nOptional: 0, hasRest: false, nKey: 0 };
    }

    let nOptional = 0;
    let hasRest = false;
    let nKey = 0;
    let inOptional = false;
    let inKey = false;

    for (;;) {
      let allowed = allowIdentifier | allowCloseParen | allowHashOptional | allowHashKey | allowHashRest;
      if (!this.getToken(allowed, tok)) {
        return { success: false, nOptional, hasRest, nKey };
      }

      if (tok.value === Token.tokenCloseParen) {
        break;
      }

      switch (tok.value) {
        case Token.tokenHashOptional:
          inOptional = true;
          inKey = false;
          break;
        case Token.tokenHashKey:
          inKey = true;
          inOptional = false;
          break;
        case Token.tokenHashRest:
          if (!this.getToken(allowIdentifier, tok)) {
            return { success: false, nOptional, hasRest, nKey };
          }
          formals.push(this.lookup(this.currentToken_));
          hasRest = true;
          break;
        case Token.tokenIdentifier:
          formals.push(this.lookup(this.currentToken_));
          if (inOptional) {
            nOptional++;
          } else if (inKey) {
            nKey++;
          }
          break;
        case Token.tokenOpenParen:
          // (name default)
          if (!this.getToken(allowIdentifier, tok)) {
            return { success: false, nOptional, hasRest, nKey };
          }
          formals.push(this.lookup(this.currentToken_));
          const initExpr = { value: null as Expression | null };
          const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
          if (!this.parseExpressionFull(0, initExpr, key, tok)) {
            return { success: false, nOptional, hasRest, nKey };
          }
          if (initExpr.value) {
            inits.push(initExpr.value);
          }
          if (!this.getToken(allowCloseParen, tok)) {
            return { success: false, nOptional, hasRest, nKey };
          }
          if (inOptional) {
            nOptional++;
          } else if (inKey) {
            nKey++;
          }
          break;
      }
    }
    return { success: true, nOptional, hasRest, nKey };
  }

  private parseIf(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };

    const test = { value: null as Expression | null };
    if (!this.parseExpressionFull(0, test, key, tok)) {
      return false;
    }

    const consequent = { value: null as Expression | null };
    if (!this.parseExpressionFull(0, consequent, key, tok)) {
      return false;
    }

    const alternate = { value: null as Expression | null };
    if (!this.parseExpressionFull(allowCloseParen, alternate, key, tok)) {
      return false;
    }

    if (!alternate.value) {
      // No alternate - already consumed close paren
    } else {
      if (!this.getToken(allowCloseParen, tok)) {
        return false;
      }
    }

    if (test.value && consequent.value) {
      expr.value = new IfExpression(test.value, consequent.value, alternate.value, loc);
    }
    return true;
  }

  private parseCond(expr: { value: Expression | null }, opt: boolean = false): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };

    if (!this.getToken(allowOpenParen | (opt ? allowCloseParen : 0), tok)) {
      return false;
    }
    if (tok.value === Token.tokenCloseParen) {
      if (this.dsssl2()) {
        expr.value = new ConstantExpression(this.interp_.makeUnspecified(), loc);
      } else {
        expr.value = new CondFailExpression(loc);
      }
      return true;
    }

    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    const testExpr = { value: null as Expression | null };
    if (!this.parseExpressionFull(allowKeyElse, testExpr, key, tok)) {
      return false;
    }

    if (!testExpr.value) {
      // else clause
      const elseBody = { value: null as Expression | null };
      if (!this.parseBegin(elseBody)) {
        return false;
      }
      expr.value = elseBody.value;
      return this.getToken(allowCloseParen, tok);
    }

    // Parse consequent expressions
    const valExprs: Expression[] = [];
    for (;;) {
      const tem = { value: null as Expression | null };
      if (!this.parseExpressionFull(allowCloseParen, tem, key, tok)) {
        return false;
      }
      if (!tem.value) {
        break;
      }
      valExprs.push(tem.value);
    }

    let valExpr: Expression | null = null;
    if (valExprs.length === 1) {
      valExpr = valExprs[0];
    } else if (valExprs.length > 1) {
      valExpr = new SequenceExpression(valExprs, valExprs[0].location());
    }

    const elseExpr = { value: null as Expression | null };
    if (!this.parseCond(elseExpr, true)) {
      return false;
    }

    if (valExpr) {
      expr.value = new IfExpression(testExpr.value, valExpr, elseExpr.value, loc);
    } else {
      expr.value = new OrExpression(testExpr.value, elseExpr.value!, loc);
    }
    return true;
  }

  private parseCase(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };

    const keyExpr = { value: null as Expression | null };
    if (!this.parseExpressionFull(0, keyExpr, key, tok)) {
      return false;
    }

    const cases: Array<{ datums: ELObj[]; expr: Expression }> = [];
    let elseClause: Expression | null = null;

    for (;;) {
      if (!this.getToken(allowOpenParen | (cases.length > 0 ? allowCloseParen : 0), tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      if (!this.getToken(allowOpenParen | allowIdentifier, tok)) {
        return false;
      }
      if (tok.value === Token.tokenOpenParen) {
        // Data clause
        const datums: ELObj[] = [];
        const datumLoc = { value: new Location() };
        for (;;) {
          const obj = { value: null as ELObj | null };
          if (!this.parseDatum(allowCloseParen, obj, datumLoc, tok)) {
            return false;
          }
          if ((tok.value as Token) === Token.tokenCloseParen) {
            break;
          }
          if (obj.value) {
            this.interp_.makePermanent(obj.value);
            datums.push(obj.value);
          }
        }
        const caseExpr = { value: null as Expression | null };
        if (!this.parseBegin(caseExpr)) {
          return false;
        }
        if (caseExpr.value) {
          cases.push({ datums, expr: caseExpr.value });
        }
      } else {
        // Check if it's else
        const ident = this.lookup(this.currentToken_);
        const identKey = { value: SyntacticKey.notKey };
        if (ident.syntacticKey(identKey) && identKey.value === SyntacticKey.keyElse) {
          if (!this.parseBegin({ value: elseClause })) {
            return false;
          }
          const elseExpr = { value: null as Expression | null };
          if (!this.parseBegin(elseExpr)) {
            return false;
          }
          elseClause = elseExpr.value;
          if (!this.getToken(allowCloseParen, tok)) {
            return false;
          }
          break;
        } else {
          this.reportMessage(SchemeParserMessages.badSpecialForm, this.currentToken_);
          return false;
        }
      }
    }

    if (this.dsssl2() && !elseClause) {
      elseClause = new ConstantExpression(this.interp_.makeUnspecified(), loc);
    }
    if (keyExpr.value) {
      expr.value = new CaseExpression(keyExpr.value, cases, elseClause, loc);
    }
    return true;
  }

  private parseAnd(expr: { value: Expression | null }, opt: boolean = false): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };

    const testExpr = { value: null as Expression | null };
    if (!this.parseExpressionFull(allowCloseParen, testExpr, key, tok)) {
      return false;
    }
    if (!testExpr.value) {
      if (!opt) {
        expr.value = new ConstantExpression(this.interp_.makeTrue(), loc);
      }
      return true;
    }

    const restExpr = { value: null as Expression | null };
    if (!this.parseAnd(restExpr, true)) {
      return false;
    }

    if (!restExpr.value) {
      expr.value = testExpr.value;
    } else {
      // This relies on the fact that #f is the only false value
      const falseExpr = new ConstantExpression(this.interp_.makeFalse(), loc);
      expr.value = new IfExpression(testExpr.value, restExpr.value, falseExpr, loc);
    }
    return true;
  }

  private parseOr(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };

    const test1Expr = { value: null as Expression | null };
    if (!this.parseExpressionFull(allowCloseParen, test1Expr, key, tok)) {
      return false;
    }
    if (!test1Expr.value) {
      expr.value = new ConstantExpression(this.interp_.makeFalse(), loc);
      return true;
    }

    const test2Expr = { value: null as Expression | null };
    if (!this.parseOr(test2Expr)) {
      return false;
    }
    expr.value = new OrExpression(test1Expr.value, test2Expr.value!, loc);
    return true;
  }

  private parseLet(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowOpenParen | allowIdentifier, tok)) {
      return false;
    }

    const vars: IdentifierImpl[] = [];
    const inits: Expression[] = [];
    const body = { value: null as Expression | null };
    let name: IdentifierImpl | null = null;

    if (tok.value === Token.tokenOpenParen) {
      // Regular let
      if (!this.parseBindingsAndBody1(vars, inits, body)) {
        return false;
      }
    } else {
      // Named let
      name = this.lookup(this.currentToken_);
      if (!this.parseBindingsAndBody(vars, inits, body)) {
        return false;
      }
    }

    if (name && body.value) {
      // Named let: (let name ((var init) ...) body)
      // -> (letrec ((name (lambda (vars) body))) (name inits))
      const loopInit: Expression[] = [];
      const argsInit: Expression[] = [];
      loopInit.push(new LambdaExpression(vars, argsInit, 0, false, 0, body.value, loc));
      const loopFormal: IdentifierImpl[] = [name];
      const varExpr = new VariableExpression(name, loc);
      const letrecExpr = new LetrecExpression(loopFormal, loopInit, varExpr, loc);
      expr.value = new CallExpression(letrecExpr, inits, loc);
    } else if (body.value) {
      expr.value = new LetExpression(vars, inits, body.value, loc);
    }
    return true;
  }

  private parseLetStar(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const vars: IdentifierImpl[] = [];
    const inits: Expression[] = [];
    const body = { value: null as Expression | null };
    if (!this.parseBindingsAndBody(vars, inits, body)) {
      return false;
    }
    if (body.value) {
      expr.value = new LetStarExpression(vars, inits, body.value, loc);
    }
    return true;
  }

  private parseLetrec(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const vars: IdentifierImpl[] = [];
    const inits: Expression[] = [];
    const body = { value: null as Expression | null };
    if (!this.parseBindingsAndBody(vars, inits, body)) {
      return false;
    }
    if (body.value) {
      expr.value = new LetrecExpression(vars, inits, body.value, loc);
    }
    return true;
  }

  private parseBindingsAndBody(
    vars: IdentifierImpl[],
    inits: Expression[],
    body: { value: Expression | null }
  ): boolean {
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowOpenParen, tok)) {
      return false;
    }
    return this.parseBindingsAndBody1(vars, inits, body);
  }

  private parseBindingsAndBody1(
    vars: IdentifierImpl[],
    inits: Expression[],
    body: { value: Expression | null }
  ): boolean {
    const tok = { value: Token.tokenVoid };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };

    for (;;) {
      if (!this.getToken(allowCloseParen | allowOpenParen, tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      if (!this.getToken(allowIdentifier, tok)) {
        return false;
      }
      vars.push(this.lookup(this.currentToken_));
      const initExpr = { value: null as Expression | null };
      if (!this.parseExpressionFull(0, initExpr, key, tok)) {
        return false;
      }
      if (initExpr.value) {
        inits.push(initExpr.value);
      }
      if (!this.getToken(allowCloseParen, tok)) {
        return false;
      }
    }
    return this.parseBegin(body);
  }

  private parseBegin(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    const exprs: Expression[] = [];

    for (;;) {
      const subExpr = { value: null as Expression | null };
      if (!this.parseExpressionFull(allowCloseParen, subExpr, key, tok)) {
        return false;
      }
      if (!subExpr.value) {
        break;
      }
      exprs.push(subExpr.value);
    }

    if (exprs.length === 0) {
      expr.value = new ConstantExpression(this.interp_.makeUnspecified(), loc);
    } else if (exprs.length === 1) {
      expr.value = exprs[0];
    } else {
      expr.value = new SequenceExpression(exprs, loc);
    }
    return true;
  }

  private parseSet(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const varIdent = this.lookup(this.currentToken_);
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    const value = { value: null as Expression | null };
    if (!this.parseExpressionFull(0, value, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    if (value.value) {
      expr.value = new AssignmentExpression(varIdent, value.value, loc);
    }
    return true;
  }

  private parseMake(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }
    const foc = this.lookup(this.currentToken_);
    const exprs: Expression[] = [];
    const keys: IdentifierImpl[] = [];

    for (;;) {
      const tem = { value: null as Expression | null };
      const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
      if (!this.parseExpressionFull(allowCloseParen, tem, key, tok)) {
        return false;
      }
      if (!tem.value) {
        break;
      }
      if (keys.length === exprs.length) {
        const k = tem.value.keyword?.();
        if (k) {
          tem.value = null;
          if (!this.parseExpressionFull(0, tem, key, tok)) {
            return false;
          }
          // Check for duplicate key
          let found = false;
          for (let i = 0; i < keys.length; i++) {
            if (keys[i].name() === k.name()) {
              found = true;
              break;
            }
          }
          if (found) {
            continue;
          }
          keys.push(k);
        }
      }
      if (tem.value) {
        exprs.push(tem.value);
      }
    }
    expr.value = new MakeExpression(foc, keys, exprs, loc);
    return true;
  }

  private parseStyle(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const exprs: Expression[] = [];
    const keys: IdentifierImpl[] = [];

    for (;;) {
      const tok = { value: Token.tokenVoid };
      if (!this.getToken(allowKeyword | allowCloseParen, tok)) {
        return false;
      }
      if (tok.value === Token.tokenCloseParen) {
        break;
      }
      keys.push(this.lookup(this.currentToken_));
      const valExpr = { value: null as Expression | null };
      const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
      if (!this.parseExpressionFull(0, valExpr, key, tok)) {
        return false;
      }
      if (valExpr.value) {
        exprs.push(valExpr.value);
      }
    }
    expr.value = new StyleExpression(keys, exprs, loc);
    return true;
  }

  private parseWithMode(expr: { value: Expression | null }): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier | allowFalse, tok)) {
      return false;
    }
    let mode: ProcessingMode;
    if (tok.value === Token.tokenFalse) {
      mode = this.interp_.initialProcessingMode();
    } else {
      mode = this.interp_.lookupProcessingMode(this.currentToken_);
    }
    const content = { value: null as Expression | null };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (!this.parseExpressionFull(0, content, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }
    if (content.value) {
      expr.value = new WithModeExpression(mode, content.value, loc);
    }
    return true;
  }

  private parseQuasiquote(expr: { value: Expression | null }): boolean {
    const spliced = { value: false };
    const tok = { value: Token.tokenVoid };
    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (!this.parseQuasiquoteTemplate(0, 0, expr, key, tok, spliced)) {
      return false;
    }
    return this.getToken(allowCloseParen, tok);
  }

  private parseQuasiquoteTemplate(
    level: number,
    allowed: number,
    expr: { value: Expression | null },
    key: { value: SyntacticKey },
    tok: { value: Token },
    spliced: { value: boolean }
  ): boolean {
    key.value = SyntacticKey.notKey;
    spliced.value = false;

    const obj = { value: null as ELObj | null };
    if (!this.parseSelfEvaluating(allowed | allowUnquote | allowVector, obj, tok)) {
      return false;
    }

    switch (tok.value) {
      case Token.tokenQuasiquote: {
        if (!this.parseQuasiquoteTemplate(level + 1, 0, expr, key, tok, spliced)) {
          return false;
        }
        this.createQuasiquoteAbbreviation('quasiquote', expr);
        break;
      }
      case Token.tokenQuote: {
        if (!this.parseQuasiquoteTemplate(level, 0, expr, key, tok, spliced)) {
          return false;
        }
        this.createQuasiquoteAbbreviation('quote', expr);
        break;
      }
      case Token.tokenUnquote:
      case Token.tokenUnquoteSplicing: {
        if (level === 0) {
          spliced.value = (tok.value === Token.tokenUnquoteSplicing);
          if (!this.parseExpressionFull(0, expr, key, tok)) {
            return false;
          }
        } else {
          const tem = { value: Token.tokenVoid };
          const temSpliced = { value: false };
          if (!this.parseQuasiquoteTemplate(level - 1, 0, expr, key, tem, temSpliced)) {
            return false;
          }
          this.createQuasiquoteAbbreviation(
            tok.value === Token.tokenUnquote ? 'unquote' : 'unquote-splicing',
            expr
          );
        }
        break;
      }
      case Token.tokenOpenParen:
      case Token.tokenVector: {
        const type = tok.value === Token.tokenVector
          ? QuasiquoteType.vectorType
          : QuasiquoteType.listType;
        const loc = this.currentLocation();
        const exprs: Expression[] = [];
        const exprsSpliced: boolean[] = [];
        let temSpliced = { value: false };

        const firstExpr = { value: null as Expression | null };
        if (!this.parseQuasiquoteTemplate(
          level,
          allowCloseParen | allowQuasiquoteKey | allowUnquoteSplicing,
          firstExpr, key, tok, temSpliced
        )) {
          return false;
        }

        if (!firstExpr.value) {
          switch (key.value as SyntacticKey) {
            case SyntacticKey.keyQuasiquote: {
              if (!this.parseQuasiquoteTemplate(level + 1, 0, expr, key, tok, spliced)) {
                return false;
              }
              this.createQuasiquoteAbbreviation('quasiquote', expr);
              break;
            }
            case SyntacticKey.keyUnquoteSplicing:
              spliced.value = true;
              // fall through
            case SyntacticKey.keyUnquote: {
              if (level === 0) {
                if (!this.parseExpressionFull(0, expr, key, tok)) {
                  return false;
                }
              } else {
                if (!this.parseQuasiquoteTemplate(level - 1, 0, expr, key, tok, temSpliced)) {
                  return false;
                }
                this.createQuasiquoteAbbreviation(
                  spliced.value ? 'unquote-splicing' : 'unquote',
                  expr
                );
                spliced.value = false;
              }
              break;
            }
            default:
              expr.value = new ConstantExpression(this.interp_.makeNil(), loc);
              return true;
          }
          return this.getToken(allowCloseParen, tok);
        }

        exprs.push(firstExpr.value);
        exprsSpliced.push(temSpliced.value);

        let currentType = type;
        for (;;) {
          const tem = { value: null as Expression | null };
          temSpliced = { value: false };
          if (!this.parseQuasiquoteTemplate(
            level,
            allowCloseParen | allowUnquoteSplicing |
            (currentType === QuasiquoteType.vectorType ? 0 : allowPeriod),
            tem, key, tok, temSpliced
          )) {
            return false;
          }
          if (!tem.value) {
            if ((tok.value as Token) === Token.tokenCloseParen) {
              break;
            }
            // Period - improper list
            currentType = QuasiquoteType.improperType;
            if (!this.parseQuasiquoteTemplate(level, 0, tem, key, tok, temSpliced)) {
              return false;
            }
            if (!this.getToken(allowCloseParen, tok)) {
              return false;
            }
            exprs.push(tem.value!);
            exprsSpliced.push(false);
            break;
          }
          exprs.push(tem.value);
          exprsSpliced.push(temSpliced.value);
        }
        expr.value = new QuasiquoteExpression(exprs, exprsSpliced, currentType, loc);
        break;
      }
      case Token.tokenIdentifier: {
        if (allowed & allowQuasiquoteKey) {
          const ident = this.lookup(this.currentToken_);
          if (ident.syntacticKey(key)) {
            switch (key.value as SyntacticKey) {
              case SyntacticKey.keyUnquoteSplicing:
              case SyntacticKey.keyUnquote:
              case SyntacticKey.keyQuasiquote:
                return true;
              default:
                break;
            }
          }
        }
        obj.value = this.interp_.makeSymbol(this.currentToken_);
        // fall through
      }
      default: {
        if (obj.value) {
          this.interp_.makePermanent(obj.value);
          expr.value = new ConstantExpression(obj.value, this.currentLocation());
        }
        break;
      }
    }
    return true;
  }

  private createQuasiquoteAbbreviation(sym: string, expr: { value: Expression | null }): void {
    if (!expr.value) return;
    const loc = expr.value.location();
    const exprs: Expression[] = [];
    exprs.push(new ConstantExpression(
      this.interp_.makeSymbol(Interpreter.makeStringC(sym)),
      loc
    ));
    exprs.push(expr.value);
    const spliced = [false, false];
    expr.value = new QuasiquoteExpression(exprs, spliced, QuasiquoteType.listType, loc);
  }

  private parseSpecialQuery(expr: { value: Expression | null }, query: string): boolean {
    const loc = this.currentLocation();
    const tok = { value: Token.tokenVoid };
    if (!this.getToken(allowIdentifier, tok)) {
      return false;
    }

    const vars: IdentifierImpl[] = [];
    vars.push(this.lookup(this.currentToken_));

    const key: { value: SyntacticKey } = { value: SyntacticKey.notKey };
    if (vars[0].syntacticKey(key) && key.value <= SyntacticKey.keyWithMode) {
      this.reportMessage(SchemeParserMessages.syntacticKeywordAsVariable, this.currentToken_);
    }

    // Create the operator expression - lookup the query function
    const queryIdent = this.interp_.lookup(Interpreter.makeStringC(query));
    const opExpr = new ConstantExpression(
      queryIdent.computeBuiltinValue(true, this.interp_),
      loc
    );

    const args: Expression[] = [];
    args.push(null as any); // placeholder for lambda
    const nodeListExpr = { value: null as Expression | null };
    if (!this.parseExpressionFull(0, nodeListExpr, key, tok)) {
      return false;
    }
    args.push(nodeListExpr.value!);

    const bodyExpr = { value: null as Expression | null };
    if (!this.parseExpressionFull(0, bodyExpr, key, tok)) {
      return false;
    }
    if (!this.getToken(allowCloseParen, tok)) {
      return false;
    }

    // Create lambda: (lambda (var) body)
    const inits: Expression[] = [];
    args[0] = new LambdaExpression(vars, inits, 0, false, 0, bodyExpr.value!, loc);

    expr.value = new CallExpression(opExpr, args, loc);
    return true;
  }

  // Token handling

  private getToken(allowed: number, tok: { value: Token }): boolean {
    if (!this.in_) {
      tok.value = Token.tokenEndOfEntity;
      return true;
    }

    // Skip whitespace and comments
    this.skipWhitespace();

    // Start a new token
    this.in_.startToken();

    const c = this.getChar();
    if (c === eE) {
      tok.value = Token.tokenEndOfEntity;
      return (allowed & allowEndOfEntity) !== 0;
    }

    switch (c) {
      case 0x28: // '('
        tok.value = Token.tokenOpenParen;
        return (allowed & allowOpenParen) !== 0;

      case 0x29: // ')'
        tok.value = Token.tokenCloseParen;
        return (allowed & allowCloseParen) !== 0;

      case 0x27: // '\''
        tok.value = Token.tokenQuote;
        return (allowed & allowOtherExpr) !== 0;

      case 0x60: // '`'
        tok.value = Token.tokenQuasiquote;
        return (allowed & allowOtherExpr) !== 0;

      case 0x2C: // ','
        if (this.peekChar() === 0x40) { // '@'
          this.getChar();
          tok.value = Token.tokenUnquoteSplicing;
          return (allowed & allowUnquoteSplicing) !== 0;
        }
        tok.value = Token.tokenUnquote;
        return (allowed & allowUnquote) !== 0;

      case 0x22: // '"'
        return this.scanString(allowed, tok);

      case 0x23: // '#'
        return this.handleHash(allowed, tok);

      case 0x2E: // '.'
        tok.value = Token.tokenPeriod;
        return (allowed & allowPeriod) !== 0;

      default:
        return this.handleIdentifierOrNumber(allowed, tok, c);
    }
  }

  private skipWhitespace(): void {
    if (!this.in_) return;
    for (;;) {
      const c = this.peekChar();
      if (c === eE) return;

      const cat = this.interp_.lexCategory(c);
      if (cat === LexCategory.lexWhiteSpace || cat === LexCategory.lexAddWhiteSpace) {
        this.getChar();
        continue;
      }
      if (c === 0x3B) { // ';'
        this.skipComment();
        continue;
      }
      break;
    }
  }

  private skipComment(): void {
    this.getChar(); // consume ';'
    for (;;) {
      const c = this.getChar();
      if (c === eE || c === 0x0A || c === 0x0D) { // end or newline
        break;
      }
    }
  }

  private scanString(allowed: number, tok: { value: Token }): boolean {
    const chars: Char[] = [];
    for (;;) {
      const c = this.getChar();
      if (c === eE) {
        this.reportMessage(SchemeParserMessages.unterminatedString);
        return false;
      }
      if (c === 0x22) { // '"'
        this.currentToken_ = makeStringCFromChars(chars);
        tok.value = Token.tokenString;
        return (allowed & allowString) !== 0;
      }
      if (c === 0x5C) { // '\\'
        const esc = this.getChar();
        if (esc === eE) {
          this.reportMessage(SchemeParserMessages.unterminatedString);
          return false;
        }
        // Handle escape sequences
        switch (esc) {
          case 0x6E: // 'n'
            chars.push(0x0A);
            break;
          case 0x74: // 't'
            chars.push(0x09);
            break;
          case 0x72: // 'r'
            chars.push(0x0D);
            break;
          default:
            chars.push(esc);
            break;
        }
      } else {
        chars.push(c);
      }
    }
  }

  private handleHash(allowed: number, tok: { value: Token }): boolean {
    const c = this.peekChar();
    switch (c) {
      case 0x74: // 't'
        this.getChar();
        tok.value = Token.tokenTrue;
        return (allowed & allowOtherExpr) !== 0;

      case 0x66: // 'f'
        this.getChar();
        tok.value = Token.tokenFalse;
        return (allowed & allowFalse) !== 0;

      case 0x5C: // '\\'
        this.getChar();
        return this.handleCharLiteral(allowed, tok);

      case 0x28: // '('
        if (this.dsssl2()) {
          this.getChar();
          tok.value = Token.tokenVector;
          return (allowed & allowVector) !== 0;
        }
        // fall through
        break;

      case 0x21: // '!'
        this.getChar();
        return this.handleHashBang(allowed, tok);

      case 0x76: // 'v'
        if (this.dsssl2()) {
          this.getChar();
          tok.value = Token.tokenVoid;
          return (allowed & allowOtherExpr) !== 0;
        }
        break;

      case 0x62: // 'b' - binary
      case 0x6F: // 'o' - octal
      case 0x78: // 'x' - hex
      case 0x64: // 'd' - decimal
        this.getChar();
        this.currentToken_ = makeStringCFromChars([0x23, c]); // '#' + radix char
        this.extendTokenChars();
        tok.value = Token.tokenNumber;
        return (allowed & allowOtherExpr) !== 0;

      case 0x41: // 'A' - AFII glyph ID
        this.getChar();
        this.currentToken_ = Interpreter.makeStringC('');
        this.extendTokenChars();
        tok.value = Token.tokenGlyphId;
        return (allowed & allowOtherExpr) !== 0;

      default:
        break;
    }

    // Could be #optional, #key, #rest, #contents or unknown
    if (c === eE) {
      this.reportMessage(SchemeParserMessages.unexpectedEof);
      if (allowed & allowEndOfEntity) {
        tok.value = Token.tokenEndOfEntity;
        return true;
      }
      return false;
    }

    this.currentToken_ = makeStringCFromChars([0x23]); // '#'
    return this.extendIdentifier(allowed, tok);
  }

  private handleCharLiteral(allowed: number, tok: { value: Token }): boolean {
    const c = this.getChar();
    if (c === eE) {
      this.reportMessage(SchemeParserMessages.unexpectedEof);
      if (allowed & allowEndOfEntity) {
        tok.value = Token.tokenEndOfEntity;
        return true;
      }
      return false;
    }

    // Check for named character - collect chars into array
    const chars: Char[] = [c];
    this.extendTokenCharsInto(chars);
    this.currentToken_ = makeStringCFromChars(chars);

    if (this.currentToken_.length_ === 1) {
      // Single character
      tok.value = Token.tokenChar;
      return (allowed & allowOtherExpr) !== 0;
    }

    // Named character
    const result = this.interp_.convertCharName(this.currentToken_);
    if (!result.found) {
      this.reportMessage(SchemeParserMessages.unknownCharName, stringCToString(this.currentToken_));
      this.currentToken_ = makeStringCFromChars([defaultChar]);
    } else {
      this.currentToken_ = makeStringCFromChars([result.c]);
    }
    tok.value = Token.tokenChar;
    return (allowed & allowOtherExpr) !== 0;
  }

  // Extend token characters and store in currentToken_
  private extendTokenChars(): void {
    const chars: Char[] = [];
    // Copy existing currentToken_ chars
    for (let i = 0; i < this.currentToken_.length_; i++) {
      chars.push(stringCCharAt(this.currentToken_, i));
    }
    this.extendTokenCharsInto(chars);
    this.currentToken_ = makeStringCFromChars(chars);
  }

  // Extend token characters into provided array
  private extendTokenCharsInto(chars: Char[]): void {
    while (true) {
      const c = this.peekChar();
      if (c === eE) break;
      const cat = this.interp_.lexCategory(c);
      if (cat > LexCategory.lexOther) {
        break;
      }
      chars.push(this.getChar());
    }
  }

  private handleHashBang(allowed: number, tok: { value: Token }): boolean {
    // #!optional, #!key, #!rest, #!contents
    const chars: Char[] = [];
    while (true) {
      const c = this.peekChar();
      if (c === eE) break;
      const cat = this.interp_.lexCategory(c);
      if (cat === LexCategory.lexLetter || cat === LexCategory.lexDigit ||
          cat === LexCategory.lexOtherNameStart || cat === LexCategory.lexAddNameStart) {
        chars.push(this.getChar());
      } else {
        break;
      }
    }
    this.currentToken_ = makeStringCFromChars(chars);

    if (stringCEquals(this.currentToken_, 'optional')) {
      tok.value = Token.tokenHashOptional;
      return (allowed & allowHashOptional) !== 0;
    }
    if (stringCEquals(this.currentToken_, 'key')) {
      tok.value = Token.tokenHashKey;
      return (allowed & allowHashKey) !== 0;
    }
    if (stringCEquals(this.currentToken_, 'rest')) {
      tok.value = Token.tokenHashRest;
      return (allowed & allowHashRest) !== 0;
    }
    if (stringCEquals(this.currentToken_, 'contents')) {
      tok.value = Token.tokenHashContents;
      return (allowed & allowHashContents) !== 0;
    }
    this.reportMessage(SchemeParserMessages.unknownNamedConstant, stringCToString(this.currentToken_));
    return false;
  }

  private handleIdentifierOrNumber(allowed: number, tok: { value: Token }, firstChar: number): boolean {
    // Start with the first character that was already consumed
    const chars: Char[] = [firstChar];
    // Add any existing currentToken_ chars (usually empty at this point)
    for (let i = 0; i < this.currentToken_.length_; i++) {
      chars.push(stringCCharAt(this.currentToken_, i));
    }
    while (true) {
      const c = this.peekChar();
      if (c === eE) break;
      const cat = this.interp_.lexCategory(c);
      if (cat === LexCategory.lexLetter || cat === LexCategory.lexDigit ||
          cat === LexCategory.lexOtherNameStart || cat === LexCategory.lexAddNameStart ||
          c === 0x2D || c === 0x2B || c === 0x2E) { // '-', '+', '.'
        chars.push(this.getChar());
      } else {
        break;
      }
    }
    this.currentToken_ = makeStringCFromChars(chars);

    // Try to parse as number
    const num = this.interp_.convertNumber(this.currentToken_);
    if (num) {
      tok.value = Token.tokenNumber;
      return (allowed & allowOtherExpr) !== 0;
    }

    // Check if it's a keyword (ends with ':')
    if (stringCEndsWith(this.currentToken_, 0x3A)) { // ':'
      tok.value = Token.tokenKeyword;
      this.currentToken_ = stringCDropLast(this.currentToken_);
      return (allowed & allowKeyword) !== 0;
    }

    // It's an identifier
    tok.value = Token.tokenIdentifier;
    return (allowed & allowIdentifier) !== 0;
  }

  private extendIdentifier(allowed: number, tok: { value: Token }): boolean {
    const chars: Char[] = [];
    // Copy existing currentToken_ chars
    for (let i = 0; i < this.currentToken_.length_; i++) {
      chars.push(stringCCharAt(this.currentToken_, i));
    }
    while (true) {
      const c = this.peekChar();
      if (c === eE) break;
      const cat = this.interp_.lexCategory(c);
      if (cat === LexCategory.lexLetter || cat === LexCategory.lexDigit ||
          cat === LexCategory.lexOtherNameStart || cat === LexCategory.lexAddNameStart ||
          c === 0x2D || c === 0x2B || c === 0x2E) { // '-', '+', '.'
        chars.push(this.getChar());
      } else {
        break;
      }
    }
    this.currentToken_ = makeStringCFromChars(chars);

    // Check for special hash identifiers
    if (stringCEquals(this.currentToken_, '#optional')) {
      tok.value = Token.tokenHashOptional;
      return (allowed & allowHashOptional) !== 0;
    }
    if (stringCEquals(this.currentToken_, '#key')) {
      tok.value = Token.tokenHashKey;
      return (allowed & allowHashKey) !== 0;
    }
    if (stringCEquals(this.currentToken_, '#rest')) {
      tok.value = Token.tokenHashRest;
      return (allowed & allowHashRest) !== 0;
    }
    if (stringCEquals(this.currentToken_, '#contents')) {
      tok.value = Token.tokenHashContents;
      return (allowed & allowHashContents) !== 0;
    }
    tok.value = Token.tokenIdentifier;
    return (allowed & allowIdentifier) !== 0;
  }

  // Datum parsing

  private parseDatum(
    otherAllowed: number,
    obj: { value: ELObj | null },
    loc: { value: Location },
    tok: { value: Token }
  ): boolean {
    loc.value = this.currentLocation();
    if (!this.parseSelfEvaluating(otherAllowed, obj, tok)) {
      return false;
    }
    if (obj.value) {
      return true;
    }

    switch (tok.value) {
      case Token.tokenQuote:
        return this.parseAbbreviation('quote', obj);
      case Token.tokenQuasiquote:
        return this.parseAbbreviation('quasiquote', obj);
      case Token.tokenUnquote:
        return this.parseAbbreviation('unquote', obj);
      case Token.tokenUnquoteSplicing:
        return this.parseAbbreviation('unquote-splicing', obj);

      case Token.tokenOpenParen: {
        // List
        const head = this.interp_.makePair(this.interp_.makeNil(), this.interp_.makeNil());
        let tail = head;
        for (;;) {
          const elem = { value: null as ELObj | null };
          const elemLoc = { value: new Location() };
          if (!this.parseDatum(allowCloseParen | allowPeriod, elem, elemLoc, tok)) {
            return false;
          }
          if (!elem.value) {
            if ((tok.value as Token) === Token.tokenCloseParen) {
              obj.value = head.cdr();
              return true;
            }
            if ((tok.value as Token) === Token.tokenPeriod) {
              // Improper list
              const last = { value: null as ELObj | null };
              if (!this.parseDatum(0, last, elemLoc, tok)) {
                return false;
              }
              tail.setCdr(last.value ?? this.interp_.makeNil());
              if (!this.getToken(allowCloseParen, tok)) {
                return false;
              }
              obj.value = head.cdr();
              return true;
            }
          }
          const newTail = this.interp_.makePair(elem.value ?? this.interp_.makeNil(), this.interp_.makeNil());
          tail.setCdr(newTail);
          tail = newTail;
        }
      }

      case Token.tokenVector: {
        // Vector
        const elems: ELObj[] = [];
        for (;;) {
          const elem = { value: null as ELObj | null };
          const elemLoc = { value: new Location() };
          if (!this.parseDatum(allowCloseParen, elem, elemLoc, tok)) {
            return false;
          }
          if (!elem.value) {
            break;
          }
          elems.push(elem.value);
        }
        obj.value = new VectorObj(elems);
        return true;
      }

      case Token.tokenIdentifier:
        obj.value = this.interp_.makeSymbol(this.currentToken_);
        return true;

      default:
        return true;
    }
  }

  private parseSelfEvaluating(
    otherAllowed: number,
    obj: { value: ELObj | null },
    tok: { value: Token }
  ): boolean {
    if (!this.getToken(allowExpr | otherAllowed, tok)) {
      return false;
    }

    switch (tok.value) {
      case Token.tokenTrue:
        obj.value = this.interp_.makeTrue();
        return true;
      case Token.tokenFalse:
        obj.value = this.interp_.makeFalse();
        return true;
      case Token.tokenVoid:
        obj.value = this.interp_.makeUnspecified();
        return true;
      case Token.tokenString:
        obj.value = new StringObj(stringCToString(this.currentToken_));
        return true;
      case Token.tokenKeyword:
        obj.value = this.interp_.makeKeyword(this.currentToken_);
        return true;
      case Token.tokenChar:
        obj.value = this.interp_.makeChar(stringCCharAt(this.currentToken_, 0));
        return true;
      case Token.tokenNumber: {
        const result = this.interp_.convertNumber(this.currentToken_);
        if (!result) {
          this.reportMessage(SchemeParserMessages.invalidNumber, this.currentToken_);
          obj.value = this.interp_.makeError();
        } else {
          obj.value = result;
        }
        return true;
      }
      case Token.tokenGlyphId:
        obj.value = this.convertAfiiGlyphId(stringCToString(this.currentToken_));
        return true;
      default:
        obj.value = null;
        return true;
    }
  }

  private convertAfiiGlyphId(str: string): ELObj | null {
    let n = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c < 0x30 || c > 0x39) { // '0'-'9'
        n = 0;
        break;
      }
      // FIXME: check for overflow
      n = n * 10 + (c - 0x30);
    }
    if (n === 0) {
      this.reportMessage(SchemeParserMessages.invalidAfiiGlyphId, str);
      return null;
    }
    return new GlyphIdObj(this.afiiPublicId_, n);
  }

  private parseAbbreviation(name: string, obj: { value: ELObj | null }): boolean {
    const tok = { value: Token.tokenVoid };
    const loc = { value: new Location() };
    const datum = { value: null as ELObj | null };
    if (!this.parseDatum(0, datum, loc, tok)) {
      return false;
    }
    const sym = this.interp_.makeSymbol(Interpreter.makeStringC(name));
    obj.value = this.interp_.makePair(
      sym,
      this.interp_.makePair(datum.value ?? this.interp_.makeNil(), this.interp_.makeNil())
    );
    return true;
  }
}
