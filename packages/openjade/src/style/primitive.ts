// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, Char, StringC, String as StringOf, String as StringClass } from '@openjade-js/opensp';
import {
  ELObj,
  PairObj,
  NilObj,
  SymbolObj,
  KeywordObj,
  CharObj,
  StringObj,
  IntegerObj,
  RealObj,
  LengthObj,
  QuantityObj,
  LengthSpec,
  LengthSpecObj,
  VectorObj,
  NodeListObj,
  NodePtrNodeListObj,
  EmptyNodeListObj,
  PairNodeListObj,
  FunctionObj,
  InsnPtr as ELObjInsnPtr,
  Signature,
  GlyphIdObj,
  AddressObj,
  ColorObj,
  ColorSpaceObj,
  DisplaySpaceObj,
  InlineSpaceObj,
  GlyphSubstTableObj,
  SosofoObj,
  StyleObj,
  LanguageObj
} from './ELObj';
import { AppendSosofoObj, EmptySosofoObj, LiteralSosofoObj, ProcessChildrenSosofoObj, ProcessChildrenTrimSosofoObj, ProcessNodeListSosofoObj, NextMatchSosofoObj } from './SosofoObj';
import { Address } from './FOTBuilder';
import { InterpreterMessages, IdentifierImpl, ProcessingMode } from './Interpreter';
import { InheritedC, StyleObj as StyleStyleObj } from './Style';
import { PrimitiveObj, EvalContext, VM, InsnPtr, InterpreterMessages as InsnMessages } from './Insn';
import { Interpreter } from './ELObj';
import { NodePtr, NodeListPtr, NamedNodeListPtr, GroveString, AccessResult, SdataMapper, PropertyValue, ComponentName } from '../grove/Node';

// Signature helper
function sig(nRequired: number, nOptional: number, restArg: boolean): Signature {
  return { nRequiredArgs: nRequired, nOptionalArgs: nOptional, restArg, nKeyArgs: 0, keys: [] };
}

// Helper to convert stringData result to JavaScript string
function stringDataToString(sd: { result: boolean; data: Uint32Array | null; length: number }): string {
  if (!sd.result || !sd.data) return '';
  let result = '';
  for (let i = 0; i < sd.length; i++) {
    result += String.fromCharCode(sd.data[i]);
  }
  return result;
}

// Error messages for argument errors
const ArgErrorMessages = {
  notAPair: 'notAPair',
  notAList: 'notAList',
  notANumber: 'notANumber',
  notAnExactInteger: 'notAnExactInteger',
  notAnExactNonNegativeInteger: 'notAnExactNonNegativeInteger',
  notAChar: 'notAChar',
  notAString: 'notAString',
  notASymbol: 'notASymbol',
  notAKeyword: 'notAKeyword',
  notAQuantity: 'notAQuantity',
  notAQuantityOrLengthSpec: 'notAQuantityOrLengthSpec',
  notANodeList: 'notANodeList',
  notASosofo: 'notASosofo',
  notAStyle: 'notAStyle',
  notAColor: 'notAColor',
  notAColorSpace: 'notAColorSpace',
  notAnAddress: 'notAnAddress',
  notAVector: 'notAVector',
  notABoolean: 'notABoolean',
  notAGlyphId: 'notAGlyphId',
  notAProcedure: 'notAProcedure',
  notALanguage: 'notALanguage',
  outOfRange: 'outOfRange',
  incompatibleDimensions: 'incompatibleDimensions',
  divisionByZero: 'divisionByZero',
  notASingletonNode: 'notASingletonNode',
  notAnOptSingletonNode: 'notAnOptSingletonNode',
  invalidRadix: 'invalidRadix'
} as const;

// Base class that handles common arg error pattern
abstract class PrimitiveObjBase extends PrimitiveObj {
  protected argError(
    interp: Interpreter,
    loc: Location,
    msg: string,
    index: number,
    obj: ELObj
  ): ELObj {
    const nl = obj.asNodeList();
    if (!nl || !nl.suppressError()) {
      interp.setNextLocation(loc);
      // TODO: Proper message formatting with ident name
      interp.message(msg, index + 1, obj);
    }
    return interp.makeError();
  }
}

// ============ List Operations ============

// cons
export class ConsPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(ConsPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return interp.makePair(args[0], args[1]);
  }
}

// list
export class ListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(ListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc === 0) return interp.makeNil();
    const head = interp.makePair(args[0], interp.makeNil());
    let tail = head;
    for (let i = 1; i < argc; i++) {
      const tem = interp.makePair(args[i], interp.makeNil());
      tail.setCdr(tem);
      tail = tem;
    }
    tail.setCdr(interp.makeNil());
    return head;
  }
}

// null?
export class IsNullPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsNullPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].isNil() ? interp.makeTrue() : interp.makeFalse();
  }
}

// list?
export class IsListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let obj = args[0];
    for (;;) {
      const pair = obj.asPair();
      if (pair) {
        obj = pair.cdr();
      } else if (obj.isNil()) {
        return interp.makeTrue();
      } else {
        break;
      }
    }
    return interp.makeFalse();
  }
}

// equal?
export class IsEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(IsEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return ELObj.equal(args[0], args[1]) ? interp.makeTrue() : interp.makeFalse();
  }
}

// eqv?
export class IsEqvPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(IsEqvPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return ELObj.eqv(args[0], args[1]) ? interp.makeTrue() : interp.makeFalse();
  }
}

// car
export class CarPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(CarPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const pair = args[0].asPair();
    if (!pair) {
      return this.argError(interp, loc, ArgErrorMessages.notAPair, 0, args[0]);
    }
    return pair.car();
  }
}

// cdr
export class CdrPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(CdrPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const pair = args[0].asPair();
    if (!pair) {
      return this.argError(interp, loc, ArgErrorMessages.notAPair, 0, args[0]);
    }
    return pair.cdr();
  }
}

// pair?
export class IsPairPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsPairPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asPair() ? interp.makeTrue() : interp.makeFalse();
  }
}

// length
export class LengthPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(LengthPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let obj = args[0];
    let n = 0;
    for (;;) {
      const pair = obj.asPair();
      if (pair) {
        n++;
        obj = pair.cdr();
      } else if (obj.isNil()) {
        break;
      } else if (interp.isError(obj)) {
        return obj;
      } else {
        return this.argError(interp, loc, ArgErrorMessages.notAList, 0, obj);
      }
    }
    return interp.makeInteger(n);
  }
}

// append
export class AppendPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(AppendPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc === 0) return interp.makeNil();
    const tail = interp.makePair(interp.makeNil(), interp.makeNil());
    let head = tail;
    for (let i = 0; i < argc - 1; i++) {
      for (let p = args[i]; !p.isNil();) {
        const tem = p.asPair();
        if (!tem) {
          return this.argError(interp, loc, ArgErrorMessages.notAList, i, p);
        }
        const newTail = interp.makePair(tem.car(), interp.makeNil());
        tail.setCdr(newTail);
        p = tem.cdr();
      }
    }
    tail.setCdr(args[argc - 1]);
    return head.cdr();
  }
}

// reverse
export class ReversePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(ReversePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let result: ELObj = interp.makeNil();
    let p = args[0];
    while (!p.isNil()) {
      const tem = p.asPair();
      if (!tem) {
        return this.argError(interp, loc, ArgErrorMessages.notAList, 0, args[0]);
      }
      result = interp.makePair(tem.car(), result);
      p = tem.cdr();
    }
    return result;
  }
}

// list-tail
export class ListTailPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(ListTailPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const kRes = args[1].exactIntegerValue();
    if (!kRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
    }
    let k = kRes.value;
    if (k < 0) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.outOfRange);
      return interp.makeError();
    }
    let p = args[0];
    for (; k > 0; k--) {
      const tem = p.asPair();
      if (!tem) {
        if (p.isNil()) {
          interp.setNextLocation(loc);
          interp.message(ArgErrorMessages.outOfRange);
          return interp.makeError();
        }
        return this.argError(interp, loc, ArgErrorMessages.notAList, 0, args[0]);
      }
      p = tem.cdr();
    }
    return p;
  }
}

// list-ref
export class ListRefPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(ListRefPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const kRes = args[1].exactIntegerValue();
    if (!kRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
    }
    let k = kRes.value;
    if (k < 0) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.outOfRange);
      return interp.makeError();
    }
    let p = args[0];
    for (;;) {
      const tem = p.asPair();
      if (!tem) break;
      if (k === 0) return tem.car();
      --k;
      p = tem.cdr();
    }
    if (p.isNil()) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.outOfRange);
      return interp.makeError();
    }
    return this.argError(interp, loc, ArgErrorMessages.notAList, 0, args[0]);
  }
}

// member
export class MemberPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(MemberPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let p = args[1];
    while (!p.isNil()) {
      const tem = p.asPair();
      if (!tem) {
        return this.argError(interp, loc, ArgErrorMessages.notAList, 1, args[1]);
      }
      if (ELObj.equal(args[0], tem.car())) {
        return p;
      }
      p = tem.cdr();
    }
    return interp.makeFalse();
  }
}

// memv
export class MemvPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(MemvPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let p = args[1];
    while (!p.isNil()) {
      const tem = p.asPair();
      if (!tem) {
        return this.argError(interp, loc, ArgErrorMessages.notAList, 1, args[1]);
      }
      if (ELObj.eqv(args[0], tem.car())) {
        return p;
      }
      p = tem.cdr();
    }
    return interp.makeFalse();
  }
}

// assoc
export class AssocPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(AssocPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let p = args[1];
    while (!p.isNil()) {
      const tem = p.asPair();
      if (!tem) {
        return this.argError(interp, loc, ArgErrorMessages.notAList, 1, args[1]);
      }
      const entry = tem.car().asPair();
      if (entry && ELObj.equal(args[0], entry.car())) {
        return tem.car();
      }
      p = tem.cdr();
    }
    return interp.makeFalse();
  }
}

// ============ Boolean Operations ============

// not
export class NotPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(NotPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].isTrue() ? interp.makeFalse() : interp.makeTrue();
  }
}

// boolean?
export class IsBooleanPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsBooleanPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (args[0] === interp.makeTrue()) {
      return args[0];
    } else if (args[0] === interp.makeFalse()) {
      return interp.makeTrue();
    }
    return interp.makeFalse();
  }
}

// ============ Symbol/Keyword Operations ============

// symbol?
export class IsSymbolPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsSymbolPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asSymbol() ? interp.makeTrue() : interp.makeFalse();
  }
}

// keyword?
export class IsKeywordPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsKeywordPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asKeyword() ? interp.makeTrue() : interp.makeFalse();
  }
}

// symbol->string
export class SymbolToStringPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(SymbolToStringPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const obj = args[0].asSymbol();
    if (!obj) {
      return this.argError(interp, loc, ArgErrorMessages.notASymbol, 0, args[0]);
    }
    return obj.name();
  }
}

// string->symbol
export class StringToSymbolPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(StringToSymbolPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    let str = '';
    for (let i = 0; i < sd.length; i++) {
      str += String.fromCharCode(sd.data[i]);
    }
    return interp.makeSymbol(str);
  }
}

// keyword->string
export class KeywordToStringPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(KeywordToStringPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const kw = args[0].asKeyword();
    if (!kw) {
      return this.argError(interp, loc, ArgErrorMessages.notAKeyword, 0, args[0]);
    }
    const name = kw.identifier().name();
    // Convert StringC to format StringObj accepts
    const data = new Uint32Array(name.length_);
    if (name.ptr_) {
      for (let i = 0; i < name.length_; i++) {
        data[i] = name.ptr_[i];
      }
    }
    return new StringObj(data);
  }
}

// string->keyword
export class StringToKeywordPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(StringToKeywordPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    let str = '';
    for (let i = 0; i < sd.length; i++) {
      str += String.fromCharCode(sd.data[i]);
    }
    return interp.makeKeyword(str);
  }
}

// ============ Character Operations ============

// char?
export class IsCharPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsCharPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv = args[0].charValue();
    return cv.result ? interp.makeTrue() : interp.makeFalse();
  }
}

// char=?
export class IsCharEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(IsCharEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return cv1.ch === cv2.ch ? interp.makeTrue() : interp.makeFalse();
  }
}

// char<?
export class CharLessPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(CharLessPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return cv1.ch < cv2.ch ? interp.makeTrue() : interp.makeFalse();
  }
}

// char<=?
export class CharLessOrEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(CharLessOrEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return cv1.ch <= cv2.ch ? interp.makeTrue() : interp.makeFalse();
  }
}

// char>?
export class CharGreaterPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(CharGreaterPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return cv1.ch > cv2.ch ? interp.makeTrue() : interp.makeFalse();
  }
}

// char>=?
export class CharGreaterOrEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(CharGreaterOrEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return cv1.ch >= cv2.ch ? interp.makeTrue() : interp.makeFalse();
  }
}

// Helper for case-insensitive comparison
function charTolower(c: number): number {
  if (c >= 0x41 && c <= 0x5a) return c + 0x20;  // A-Z -> a-z
  return c;
}

// char-ci=?
export class CharCiEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(CharCiEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return charTolower(cv1.ch) === charTolower(cv2.ch) ? interp.makeTrue() : interp.makeFalse();
  }
}

// char-ci<?
export class CharCiLessPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(CharCiLessPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return charTolower(cv1.ch) < charTolower(cv2.ch) ? interp.makeTrue() : interp.makeFalse();
  }
}

// char-ci<=?
export class CharCiLessOrEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(CharCiLessOrEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return charTolower(cv1.ch) <= charTolower(cv2.ch) ? interp.makeTrue() : interp.makeFalse();
  }
}

// char-ci>?
export class CharCiGreaterPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(CharCiGreaterPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return charTolower(cv1.ch) > charTolower(cv2.ch) ? interp.makeTrue() : interp.makeFalse();
  }
}

// char-ci>=?
export class CharCiGreaterOrEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(CharCiGreaterOrEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv1 = args[0].charValue();
    if (!cv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const cv2 = args[1].charValue();
    if (!cv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 1, args[1]);
    }
    return charTolower(cv1.ch) >= charTolower(cv2.ch) ? interp.makeTrue() : interp.makeFalse();
  }
}

// char-upcase
export class CharUpcasePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(CharUpcasePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv = args[0].charValue();
    if (!cv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const c = cv.ch;
    if (c >= 0x61 && c <= 0x7a) { // a-z
      return interp.makeChar(c - 0x20);
    }
    return interp.makeChar(c);
  }
}

// char-downcase
export class CharDowncasePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(CharDowncasePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const cv = args[0].charValue();
    if (!cv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAChar, 0, args[0]);
    }
    const c = cv.ch;
    if (c >= 0x41 && c <= 0x5a) { // A-Z
      return interp.makeChar(c + 0x20);
    }
    return interp.makeChar(c);
  }
}

// ============ String Operations ============

// string
export class StringPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(StringPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let str = '';
    for (let i = 0; i < argc; i++) {
      const cv = args[i].charValue();
      if (!cv.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAChar, i, args[i]);
      }
      str += String.fromCharCode(cv.ch);
    }
    return new StringObj(str);
  }
}

// string?
export class IsStringPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsStringPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    return sd.result ? interp.makeTrue() : interp.makeFalse();
  }
}

// string-length
export class StringLengthPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(StringLengthPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    return interp.makeInteger(sd.length);
  }
}

// string=?
// Note: Unlike strict Scheme, we return #f when comparing to non-strings
// to support common DSSSL pattern of (string=? "foo" (attribute-string ...))
// where attribute-string returns #f for missing attributes.
export class IsStringEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(IsStringEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd1 = args[0].stringData();
    if (!sd1.result) {
      // If first arg is not a string, return #f (graceful handling)
      return interp.makeFalse();
    }
    const sd2 = args[1].stringData();
    if (!sd2.result) {
      // If second arg is not a string, return #f (graceful handling)
      return interp.makeFalse();
    }
    if (sd1.length !== sd2.length) {
      return interp.makeFalse();
    }
    for (let i = 0; i < sd1.length; i++) {
      if (sd1.data[i] !== sd2.data[i]) {
        return interp.makeFalse();
      }
    }
    return interp.makeTrue();
  }
}

// string-append
export class StringAppendPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(StringAppendPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let result = '';
    for (let i = 0; i < argc; i++) {
      const sd = args[i].stringData();
      if (!sd.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAString, i, args[i]);
      }
      for (let j = 0; j < sd.length; j++) {
        result += String.fromCharCode(sd.data[j]);
      }
    }
    return new StringObj(result);
  }
}

// string-ref
export class StringRefPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(StringRefPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    const kRes = args[1].exactIntegerValue();
    if (!kRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
    }
    const k = kRes.value;
    if (k < 0 || k >= sd.length) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.outOfRange);
      return interp.makeError();
    }
    return interp.makeChar(sd.data[k]);
  }
}

// substring
export class SubstringPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(3, 0, false);
  constructor() { super(SubstringPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    const startRes = args[1].exactIntegerValue();
    if (!startRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
    }
    const endRes = args[2].exactIntegerValue();
    if (!endRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 2, args[2]);
    }
    const start = startRes.value;
    const end = endRes.value;
    if (start < 0 || end > sd.length || start > end) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.outOfRange);
      return interp.makeError();
    }
    let result = '';
    for (let i = start; i < end; i++) {
      result += String.fromCharCode(sd.data[i]);
    }
    return new StringObj(result);
  }
}

// string->list
export class StringToListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(StringToListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    if (sd.length === 0) {
      return interp.makeNil();
    }
    const head = interp.makePair(interp.makeChar(sd.data[0]), interp.makeNil());
    let tail = head;
    for (let i = 1; i < sd.length; i++) {
      const tem = interp.makePair(interp.makeChar(sd.data[i]), interp.makeNil());
      tail.setCdr(tem);
      tail = tem;
    }
    return head;
  }
}

// list->string
export class ListToStringPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(ListToStringPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let result = '';
    let p = args[0];
    while (!p.isNil()) {
      const pair = p.asPair();
      if (!pair) {
        return this.argError(interp, loc, ArgErrorMessages.notAList, 0, args[0]);
      }
      const cv = pair.car().charValue();
      if (!cv.result) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.notAChar);
        return interp.makeError();
      }
      result += String.fromCharCode(cv.ch);
      p = pair.cdr();
    }
    return new StringObj(result);
  }
}

// ============ Number Operations ============

// integer?
export class IsIntegerPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsIntegerPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const iv = args[0].exactIntegerValue();
    if (iv.result) return interp.makeTrue();
    const rv = args[0].realValue();
    if (rv.result && Math.trunc(rv.value) === rv.value) {
      return interp.makeTrue();
    }
    return interp.makeFalse();
  }
}

// real?
export class IsRealPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsRealPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    return rv.result ? interp.makeTrue() : interp.makeFalse();
  }
}

// number?
export class IsNumberPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsNumberPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    return rv.result ? interp.makeTrue() : interp.makeFalse();
  }
}

// quantity?
export class IsQuantityPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsQuantityPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const qv = args[0].quantityValue();
    return qv.type !== 0 ? interp.makeTrue() : interp.makeFalse();
  }
}

// procedure?
export class IsProcedurePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsProcedurePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asFunction() ? interp.makeTrue() : interp.makeFalse();
  }
}

// =
export class EqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(EqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc === 0) return interp.makeTrue();
    const q0 = args[0].quantityValue();
    if (q0.type === 0) {
      return this.argError(interp, loc, ArgErrorMessages.notAQuantity, 0, args[0]);
    }
    const dim = q0.dim;
    const val0 = q0.type === 1 ? q0.longVal : q0.doubleVal;
    for (let i = 1; i < argc; i++) {
      const qi = args[i].quantityValue();
      if (qi.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
      }
      const vali = qi.type === 1 ? qi.longVal : qi.doubleVal;
      if (vali !== val0 || qi.dim !== dim) {
        return interp.makeFalse();
      }
    }
    return interp.makeTrue();
  }
}

// +
export class PlusPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(PlusPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc === 0) return interp.makeInteger(0);

    // Check if any arg is a LengthSpec
    let hasLengthSpec = false;
    for (let i = 0; i < argc; i++) {
      if (args[i].lengthSpec()) {
        hasLengthSpec = true;
        break;
      }
      const q = args[i].quantityValue();
      if (q.type === 0) hasLengthSpec = true;
    }

    if (hasLengthSpec) {
      const ls = new LengthSpec();
      for (let i = 0; i < argc; i++) {
        const lsp = args[i].lengthSpec();
        if (lsp) {
          ls.add(lsp);
        } else {
          const q = args[i].quantityValue();
          if (q.type === 0) {
            return this.argError(interp, loc, ArgErrorMessages.notAQuantityOrLengthSpec, i, args[i]);
          }
          const d = q.type === 1 ? q.longVal : q.doubleVal;
          if (q.dim !== 1) {
            interp.setNextLocation(loc);
            interp.message(ArgErrorMessages.incompatibleDimensions);
            return interp.makeError();
          }
          ls.addScalar(d);
        }
      }
      return new LengthSpecObj(ls);
    }

    const q0 = args[0].quantityValue();
    if (q0.type === 0) {
      return this.argError(interp, loc, ArgErrorMessages.notAQuantity, 0, args[0]);
    }

    let dim = q0.dim;
    let usingDouble = q0.type === 2;
    let lResult = q0.longVal;
    let dResult = q0.doubleVal;

    for (let i = 1; i < argc; i++) {
      const qi = args[i].quantityValue();
      if (qi.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
      }
      if (qi.dim !== dim) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.incompatibleDimensions);
        return interp.makeError();
      }
      if (qi.type === 2 || usingDouble) {
        if (!usingDouble) {
          dResult = lResult;
          usingDouble = true;
        }
        dResult += qi.type === 1 ? qi.longVal : qi.doubleVal;
      } else {
        lResult += qi.longVal;
      }
    }

    if (!usingDouble) {
      if (dim === 0) return interp.makeInteger(lResult);
      if (dim === 1) return new LengthObj(lResult);
      dResult = lResult;
    }
    if (dim === 0) return new RealObj(dResult);
    return new QuantityObj(dResult, dim);
  }
}

// -
export class MinusPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, true);
  constructor() { super(MinusPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const q0 = args[0].quantityValue();
    if (q0.type === 0) {
      const ls = args[0].lengthSpec();
      if (!ls) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, 0, args[0]);
      }
      // Handle LengthSpec subtraction
      const result = new LengthSpec(ls);
      if (argc === 1) {
        result.negate();
        return new LengthSpecObj(result);
      }
      for (let i = 1; i < argc; i++) {
        const lsi = args[i].lengthSpec();
        if (lsi) {
          result.subtract(lsi);
        } else {
          const qi = args[i].quantityValue();
          if (qi.type === 0) {
            return this.argError(interp, loc, ArgErrorMessages.notAQuantityOrLengthSpec, i, args[i]);
          }
          const d = qi.type === 1 ? qi.longVal : qi.doubleVal;
          if (qi.dim !== 1) {
            interp.setNextLocation(loc);
            interp.message(ArgErrorMessages.incompatibleDimensions);
            return interp.makeError();
          }
          result.addScalar(-d);
        }
      }
      return new LengthSpecObj(result);
    }

    let dim = q0.dim;
    let usingDouble = q0.type === 2;
    let lResult = q0.longVal;
    let dResult = q0.doubleVal;

    if (argc === 1) {
      if (usingDouble) {
        dResult = -dResult;
      } else {
        lResult = -lResult;
      }
    } else {
      for (let i = 1; i < argc; i++) {
        const qi = args[i].quantityValue();
        if (qi.type === 0) {
          return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
        }
        if (qi.dim !== dim) {
          interp.setNextLocation(loc);
          interp.message(ArgErrorMessages.incompatibleDimensions);
          return interp.makeError();
        }
        if (qi.type === 2 || usingDouble) {
          if (!usingDouble) {
            dResult = lResult;
            usingDouble = true;
          }
          dResult -= qi.type === 1 ? qi.longVal : qi.doubleVal;
        } else {
          lResult -= qi.longVal;
        }
      }
    }

    if (!usingDouble) {
      if (dim === 0) return interp.makeInteger(lResult);
      if (dim === 1) return new LengthObj(lResult);
      dResult = lResult;
    }
    if (dim === 0) return new RealObj(dResult);
    return new QuantityObj(dResult, dim);
  }
}

// *
export class MultiplyPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(MultiplyPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc === 0) return interp.makeInteger(1);

    const q0 = args[0].quantityValue();
    if (q0.type === 0) {
      const ls = args[0].lengthSpec();
      if (ls) {
        const result = new LengthSpec(ls);
        for (let i = 1; i < argc; i++) {
          const rv = args[i].realValue();
          if (!rv.result) {
            return this.argError(interp, loc, ArgErrorMessages.notANumber, i, args[i]);
          }
          result.multiply(rv.value);
        }
        return new LengthSpecObj(result);
      }
      return this.argError(interp, loc, ArgErrorMessages.notAQuantity, 0, args[0]);
    }

    let dim = q0.dim;
    let usingDouble = q0.type === 2;
    let lResult = q0.longVal;
    let dResult = q0.doubleVal;

    for (let i = 1; i < argc; i++) {
      const qi = args[i].quantityValue();
      if (qi.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
      }
      dim += qi.dim;
      if (qi.type === 2 || usingDouble || dim > 1) {
        if (!usingDouble) {
          dResult = lResult;
          usingDouble = true;
        }
        dResult *= qi.type === 1 ? qi.longVal : qi.doubleVal;
      } else {
        lResult *= qi.longVal;
      }
    }

    if (!usingDouble) {
      if (dim === 0) return interp.makeInteger(lResult);
      return new LengthObj(lResult);
    }
    if (dim === 0) return new RealObj(dResult);
    return new QuantityObj(dResult, dim);
  }
}

// /
export class DividePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, true);
  constructor() { super(DividePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const q0 = args[0].quantityValue();
    if (q0.type === 0) {
      return this.argError(interp, loc, ArgErrorMessages.notAQuantity, 0, args[0]);
    }

    let dim = q0.dim;
    let dResult = q0.type === 1 ? q0.longVal : q0.doubleVal;

    if (argc === 1) {
      if (dResult === 0) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.divisionByZero);
        return interp.makeError();
      }
      dResult = 1.0 / dResult;
      dim = -dim;
    } else {
      for (let i = 1; i < argc; i++) {
        const qi = args[i].quantityValue();
        if (qi.type === 0) {
          return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
        }
        const divisor = qi.type === 1 ? qi.longVal : qi.doubleVal;
        if (divisor === 0) {
          interp.setNextLocation(loc);
          interp.message(ArgErrorMessages.divisionByZero);
          return interp.makeError();
        }
        dResult /= divisor;
        dim -= qi.dim;
      }
    }

    if (dim === 0) return new RealObj(dResult);
    return new QuantityObj(dResult, dim);
  }
}

// quotient
export class QuotientPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(QuotientPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const iv1 = args[0].exactIntegerValue();
    if (!iv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 0, args[0]);
    }
    const iv2 = args[1].exactIntegerValue();
    if (!iv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
    }
    if (iv2.value === 0) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.divisionByZero);
      return interp.makeError();
    }
    return interp.makeInteger(Math.trunc(iv1.value / iv2.value));
  }
}

// remainder
export class RemainderPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(RemainderPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const iv1 = args[0].exactIntegerValue();
    if (!iv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 0, args[0]);
    }
    const iv2 = args[1].exactIntegerValue();
    if (!iv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
    }
    if (iv2.value === 0) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.divisionByZero);
      return interp.makeError();
    }
    return interp.makeInteger(iv1.value % iv2.value);
  }
}

// modulo
export class ModuloPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(ModuloPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const iv1 = args[0].exactIntegerValue();
    if (!iv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 0, args[0]);
    }
    const iv2 = args[1].exactIntegerValue();
    if (!iv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
    }
    if (iv2.value === 0) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.divisionByZero);
      return interp.makeError();
    }
    let r = iv1.value % iv2.value;
    // Modulo always returns result with same sign as divisor
    if (r !== 0 && (r < 0) !== (iv2.value < 0)) {
      r += iv2.value;
    }
    return interp.makeInteger(r);
  }
}

// <
export class LessPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(LessPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc < 2) return interp.makeTrue();
    for (let i = 0; i < argc - 1; i++) {
      const q1 = args[i].quantityValue();
      const q2 = args[i + 1].quantityValue();
      if (q1.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
      }
      if (q2.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i + 1, args[i + 1]);
      }
      if (q1.dim !== q2.dim) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.incompatibleDimensions);
        return interp.makeError();
      }
      const v1 = q1.type === 1 ? q1.longVal : q1.doubleVal;
      const v2 = q2.type === 1 ? q2.longVal : q2.doubleVal;
      if (!(v1 < v2)) return interp.makeFalse();
    }
    return interp.makeTrue();
  }
}

// >
export class GreaterPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(GreaterPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc < 2) return interp.makeTrue();
    for (let i = 0; i < argc - 1; i++) {
      const q1 = args[i].quantityValue();
      const q2 = args[i + 1].quantityValue();
      if (q1.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
      }
      if (q2.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i + 1, args[i + 1]);
      }
      if (q1.dim !== q2.dim) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.incompatibleDimensions);
        return interp.makeError();
      }
      const v1 = q1.type === 1 ? q1.longVal : q1.doubleVal;
      const v2 = q2.type === 1 ? q2.longVal : q2.doubleVal;
      if (!(v1 > v2)) return interp.makeFalse();
    }
    return interp.makeTrue();
  }
}

// <=
export class LessEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(LessEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc < 2) return interp.makeTrue();
    for (let i = 0; i < argc - 1; i++) {
      const q1 = args[i].quantityValue();
      const q2 = args[i + 1].quantityValue();
      if (q1.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
      }
      if (q2.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i + 1, args[i + 1]);
      }
      if (q1.dim !== q2.dim) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.incompatibleDimensions);
        return interp.makeError();
      }
      const v1 = q1.type === 1 ? q1.longVal : q1.doubleVal;
      const v2 = q2.type === 1 ? q2.longVal : q2.doubleVal;
      if (!(v1 <= v2)) return interp.makeFalse();
    }
    return interp.makeTrue();
  }
}

// >=
export class GreaterEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(GreaterEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc < 2) return interp.makeTrue();
    for (let i = 0; i < argc - 1; i++) {
      const q1 = args[i].quantityValue();
      const q2 = args[i + 1].quantityValue();
      if (q1.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
      }
      if (q2.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i + 1, args[i + 1]);
      }
      if (q1.dim !== q2.dim) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.incompatibleDimensions);
        return interp.makeError();
      }
      const v1 = q1.type === 1 ? q1.longVal : q1.doubleVal;
      const v2 = q2.type === 1 ? q2.longVal : q2.doubleVal;
      if (!(v1 >= v2)) return interp.makeFalse();
    }
    return interp.makeTrue();
  }
}

// min
export class MinPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, true);
  constructor() { super(MinPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const q0 = args[0].quantityValue();
    if (q0.type === 0) {
      return this.argError(interp, loc, ArgErrorMessages.notAQuantity, 0, args[0]);
    }
    let minVal = q0.type === 1 ? q0.longVal : q0.doubleVal;
    let minIdx = 0;
    const dim = q0.dim;

    for (let i = 1; i < argc; i++) {
      const qi = args[i].quantityValue();
      if (qi.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
      }
      if (qi.dim !== dim) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.incompatibleDimensions);
        return interp.makeError();
      }
      const val = qi.type === 1 ? qi.longVal : qi.doubleVal;
      if (val < minVal) {
        minVal = val;
        minIdx = i;
      }
    }
    return args[minIdx];
  }
}

// max
export class MaxPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, true);
  constructor() { super(MaxPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const q0 = args[0].quantityValue();
    if (q0.type === 0) {
      return this.argError(interp, loc, ArgErrorMessages.notAQuantity, 0, args[0]);
    }
    let maxVal = q0.type === 1 ? q0.longVal : q0.doubleVal;
    let maxIdx = 0;
    const dim = q0.dim;

    for (let i = 1; i < argc; i++) {
      const qi = args[i].quantityValue();
      if (qi.type === 0) {
        return this.argError(interp, loc, ArgErrorMessages.notAQuantity, i, args[i]);
      }
      if (qi.dim !== dim) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.incompatibleDimensions);
        return interp.makeError();
      }
      const val = qi.type === 1 ? qi.longVal : qi.doubleVal;
      if (val > maxVal) {
        maxVal = val;
        maxIdx = i;
      }
    }
    return args[maxIdx];
  }
}

// abs
export class AbsPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(AbsPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const q = args[0].quantityValue();
    if (q.type === 0) {
      return this.argError(interp, loc, ArgErrorMessages.notAQuantity, 0, args[0]);
    }
    if (q.type === 1) {
      const n = q.longVal;
      if (n < 0) {
        if (q.dim === 0) return interp.makeInteger(-n);
        return new LengthObj(-n);
      }
      return args[0];
    }
    const d = q.doubleVal;
    if (d < 0) {
      if (q.dim === 0) return new RealObj(-d);
      return new QuantityObj(-d, q.dim);
    }
    return args[0];
  }
}

// floor
export class FloorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(FloorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.floor(rv.value));
  }
}

// ceiling
export class CeilingPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(CeilingPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.ceil(rv.value));
  }
}

// truncate
export class TruncatePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(TruncatePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.trunc(rv.value));
  }
}

// round
export class RoundPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(RoundPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.round(rv.value));
  }
}

// sqrt
export class SqrtPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(SqrtPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.sqrt(rv.value));
  }
}

// exp
export class ExpPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(ExpPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.exp(rv.value));
  }
}

// log
export class LogPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(LogPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.log(rv.value));
  }
}

// sin
export class SinPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(SinPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.sin(rv.value));
  }
}

// cos
export class CosPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(CosPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.cos(rv.value));
  }
}

// tan
export class TanPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(TanPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.tan(rv.value));
  }
}

// asin
export class AsinPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(AsinPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.asin(rv.value));
  }
}

// acos
export class AcosPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(AcosPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(Math.acos(rv.value));
  }
}

// atan (1 or 2 args)
export class AtanPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);
  constructor() { super(AtanPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv1 = args[0].realValue();
    if (!rv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    if (argc === 1) {
      return new RealObj(Math.atan(rv1.value));
    }
    const rv2 = args[1].realValue();
    if (!rv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 1, args[1]);
    }
    return new RealObj(Math.atan2(rv1.value, rv2.value));
  }
}

// expt
export class ExptPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(ExptPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv1 = args[0].realValue();
    if (!rv1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    const rv2 = args[1].realValue();
    if (!rv2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 1, args[1]);
    }
    return new RealObj(Math.pow(rv1.value, rv2.value));
  }
}

// exact->inexact
export class ExactToInexactPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(ExactToInexactPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return new RealObj(rv.value);
  }
}

// inexact->exact
export class InexactToExactPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(InexactToExactPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return interp.makeInteger(Math.trunc(rv.value));
  }
}

// zero?
export class IsZeroPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsZeroPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return rv.value === 0 ? interp.makeTrue() : interp.makeFalse();
  }
}

// positive?
export class IsPositivePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsPositivePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return rv.value > 0 ? interp.makeTrue() : interp.makeFalse();
  }
}

// negative?
export class IsNegativePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsNegativePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }
    return rv.value < 0 ? interp.makeTrue() : interp.makeFalse();
  }
}

// odd?
export class IsOddPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsOddPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const iv = args[0].exactIntegerValue();
    if (!iv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 0, args[0]);
    }
    return (iv.value & 1) !== 0 ? interp.makeTrue() : interp.makeFalse();
  }
}

// even?
export class IsEvenPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsEvenPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const iv = args[0].exactIntegerValue();
    if (!iv.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 0, args[0]);
    }
    return (iv.value & 1) === 0 ? interp.makeTrue() : interp.makeFalse();
  }
}

// exact?
export class IsExactPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsExactPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const iv = args[0].exactIntegerValue();
    return iv.result ? interp.makeTrue() : interp.makeFalse();
  }
}

// inexact?
export class IsInexactPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsInexactPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) return interp.makeFalse();
    const iv = args[0].exactIntegerValue();
    return iv.result ? interp.makeFalse() : interp.makeTrue();
  }
}

// ============ Vector Operations ============

// vector?
export class IsVectorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsVectorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asVector() ? interp.makeTrue() : interp.makeFalse();
  }
}

// vector
export class VectorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);
  constructor() { super(VectorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return new VectorObj(args.slice(0, argc));
  }
}

// make-vector
export class MakeVectorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);
  constructor() { super(MakeVectorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const kRes = args[0].exactIntegerValue();
    if (!kRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 0, args[0]);
    }
    const k = kRes.value;
    if (k < 0) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.outOfRange);
      return interp.makeError();
    }
    const fill = argc > 1 ? args[1] : interp.makeUnspecified();
    const v: ELObj[] = new Array(k);
    for (let i = 0; i < k; i++) {
      v[i] = fill;
    }
    return new VectorObj(v);
  }
}

// vector-length
export class VectorLengthPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(VectorLengthPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const vec = args[0].asVector();
    if (!vec) {
      return this.argError(interp, loc, ArgErrorMessages.notAVector, 0, args[0]);
    }
    return interp.makeInteger(vec.size());
  }
}

// vector-ref
export class VectorRefPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(VectorRefPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const vec = args[0].asVector();
    if (!vec) {
      return this.argError(interp, loc, ArgErrorMessages.notAVector, 0, args[0]);
    }
    const kRes = args[1].exactIntegerValue();
    if (!kRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
    }
    const k = kRes.value;
    if (k < 0 || k >= vec.size()) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.outOfRange);
      return interp.makeError();
    }
    return vec.ref(k);
  }
}

// vector-set!
export class VectorSetPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(3, 0, false);
  constructor() { super(VectorSetPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const vec = args[0].asVector();
    if (!vec) {
      return this.argError(interp, loc, ArgErrorMessages.notAVector, 0, args[0]);
    }
    const kRes = args[1].exactIntegerValue();
    if (!kRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
    }
    const k = kRes.value;
    if (k < 0 || k >= vec.size()) {
      interp.setNextLocation(loc);
      interp.message(ArgErrorMessages.outOfRange);
      return interp.makeError();
    }
    vec.set(k, args[2]);
    return interp.makeUnspecified();
  }
}

// vector->list
export class VectorToListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(VectorToListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const vec = args[0].asVector();
    if (!vec) {
      return this.argError(interp, loc, ArgErrorMessages.notAVector, 0, args[0]);
    }
    const n = vec.size();
    if (n === 0) return interp.makeNil();
    const head = interp.makePair(vec.ref(0), interp.makeNil());
    let tail = head;
    for (let i = 1; i < n; i++) {
      const tem = interp.makePair(vec.ref(i), interp.makeNil());
      tail.setCdr(tem);
      tail = tem;
    }
    return head;
  }
}

// list->vector
export class ListToVectorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(ListToVectorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const v: ELObj[] = [];
    let p = args[0];
    while (!p.isNil()) {
      const pair = p.asPair();
      if (!pair) {
        return this.argError(interp, loc, ArgErrorMessages.notAList, 0, args[0]);
      }
      v.push(pair.car());
      p = pair.cdr();
    }
    return new VectorObj(v);
  }
}

// ============ Type Predicates ============

// sosofo?
export class IsSosofoPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsSosofoPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asSosofo() ? interp.makeTrue() : interp.makeFalse();
  }
}

// style?
export class IsStylePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsStylePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asStyle() ? interp.makeTrue() : interp.makeFalse();
  }
}

// node-list?
export class IsNodeListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsNodeListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asNodeList() ? interp.makeTrue() : interp.makeFalse();
  }
}

// address?
export class IsAddressPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsAddressPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asAddress() ? interp.makeTrue() : interp.makeFalse();
  }
}

// color?
export class IsColorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsColorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asColor() ? interp.makeTrue() : interp.makeFalse();
  }
}

// color-space?
export class IsColorSpacePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsColorSpacePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asColorSpace() ? interp.makeTrue() : interp.makeFalse();
  }
}

// glyph-id?
export class IsGlyphIdPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsGlyphIdPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].glyphId() ? interp.makeTrue() : interp.makeFalse();
  }
}

// language?
export class IsLanguagePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsLanguagePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return args[0].asLanguage() ? interp.makeTrue() : interp.makeFalse();
  }
}

// ============ Node List Operations ============

// node-list-empty?
let nodeListEmptyCallCount = 0;
export class IsNodeListEmptyPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsNodeListEmptyPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    nodeListEmptyCallCount++;
    if (nodeListEmptyCallCount <= 20) {
    }
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    const first = nl.nodeListFirst(context, interp);
    // An empty node list has nodeListFirst return a NodePtr with null node, not null
    const isEmpty = !first || !first.node();
    if (nodeListEmptyCallCount <= 20) {
    }
    return isEmpty ? interp.makeTrue() : interp.makeFalse();
  }
}

// empty-node-list
export class EmptyNodeListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, false);
  constructor() { super(EmptyNodeListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return interp.makeEmptyNodeList();
  }
}

// node-list-error - reports an error with a message and node list
// Following upstream DEFPRIMITIVE(NodeListError) in primitive.cxx
export class NodeListErrorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(NodeListErrorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    if (!args[1].asNodeList()) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 1, args[1]);
    }
    interp.setNextLocation(loc);
    const msg = stringDataToString(sd);
    interp.message('errorProc', msg);
    return interp.makeError();
  }
}

// general-name-normalize - normalize a general name using SGML declaration
// Following upstream DEFPRIMITIVE(GeneralNameNormalize) in primitive.cxx
export class GeneralNameNormalizePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);
  constructor() { super(GeneralNameNormalizePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    // For now, just return the string as-is since we don't have full SGML normalization
    // A proper implementation would normalize using the grove's SGML declaration
    return interp.makeString(stringDataToString(sd));
  }
}

// node-list-first - returns the first node in a node list as a singleton node-list
export class NodeListFirstPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(NodeListFirstPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    const first = nl.nodeListFirst(context, interp);
    if (!first || !first.node()) {
      return interp.makeEmptyNodeList();
    }
    return new NodePtrNodeListObj(first);
  }
}

// node-list-rest - returns all but the first node in a node list
export class NodeListRestPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(NodeListRestPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    return nl.nodeListRest(context, interp);
  }
}

// node-list-length - returns the number of nodes in a node list
export class NodeListLengthPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(NodeListLengthPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    // Use the nodeListLength method which properly iterates through the list
    const count = nl.nodeListLength(context, interp);
    return new IntegerObj(count);
  }
}

// MapNodeListObj - lazy node list that maps a function over nodes
// Following upstream class MapNodeListObj in primitive.cxx
class MapNodeListObj extends NodeListObj {
  private func_: FunctionObj | null;
  private nl_: NodeListObj;
  private mapped_: NodeListObj | null = null;
  private context_: EvalContext;
  private loc_: Location;

  constructor(func: FunctionObj, nl: NodeListObj, context: EvalContext, loc: Location) {
    super();
    this.func_ = func;
    this.nl_ = nl;
    this.context_ = context;
    this.loc_ = loc;
  }

  private mapNext(context: EvalContext, interp: Interpreter): void {
    if (!this.func_) return;

    const nd = this.nl_.nodeListFirst(context, interp);
    if (!nd.node()) return;

    // Create VM to call the function
    const vm = new VM(interp, this.context_);
    const insn = this.func_.makeCallInsn(1, interp, this.loc_, null);

    // Call the function with the node as argument
    const ret = vm.eval(insn, null, new NodePtrNodeListObj(nd));
    if (interp.isError(ret)) {
      this.func_ = null;
      return;
    }

    this.mapped_ = ret.asNodeList();
    if (!this.mapped_) {
      interp.setNextLocation(this.loc_);
      interp.message('returnNotNodeList');
      this.func_ = null;
      return;
    }

    this.nl_ = this.nl_.nodeListRest(context, interp);
  }

  override nodeListFirst(context: EvalContext, interp: Interpreter): NodePtr {
    for (;;) {
      if (!this.mapped_) {
        this.mapNext(context, interp);
        if (!this.mapped_) break;
      }
      const nd = this.mapped_.nodeListFirst(context, interp);
      if (nd.node()) return nd;
      this.mapped_ = null;
    }
    return new NodePtr();
  }

  override nodeListRest(context: EvalContext, interp: Interpreter): NodeListObj {
    for (;;) {
      if (!this.mapped_) {
        this.mapNext(context, interp);
        if (!this.mapped_) break;
      }
      const nd = this.mapped_.nodeListFirst(context, interp);
      if (nd.node()) {
        const rest = this.mapped_.nodeListRest(context, interp);
        if (rest.nodeListFirst(context, interp).node()) {
          return new PairNodeListObj(rest, new MapNodeListObj(this.func_!, this.nl_, this.context_, this.loc_));
        }
        return new MapNodeListObj(this.func_!, this.nl_, this.context_, this.loc_);
      }
      this.mapped_ = null;
    }
    return new EmptyNodeListObj();
  }

  override suppressError(): boolean {
    return this.func_ === null;
  }
}

// node-list-map - map a function over a node list
// Following upstream DEFPRIMITIVE(NodeListMap) in primitive.cxx
export class NodeListMapPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(NodeListMapPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const func = args[0].asFunction();
    if (!func) {
      return this.argError(interp, loc, ArgErrorMessages.notAProcedure, 0, args[0]);
    }
    if (func.nRequiredArgs() > 1) {
      interp.setNextLocation(loc);
      interp.message(InsnMessages.missingArg);
      return interp.makeError();
    }
    if (func.nRequiredArgs() + func.nOptionalArgs() + (func.restArg() ? 1 : 0) === 0) {
      interp.setNextLocation(loc);
      interp.message(InsnMessages.tooManyArgs);
      return interp.makeError();
    }
    interp.makeReadOnly(func);
    const nl = args[1].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 1, args[1]);
    }
    return new MapNodeListObj(func, nl, context, loc);
  }
}

// DescendantsNodeListObj - lazy node list of all descendants of a node
// Following upstream class DescendantsNodeListObj in primitive.cxx
class DescendantsNodeListObj extends NodeListObj {
  private start_: NodePtr;
  private depth_: number;

  constructor(start: NodePtr, depth: number = 0) {
    super();
    this.start_ = new NodePtr(start.node());
    this.depth_ = depth;

    // If depth is 0, we need to move to first child to start
    if (depth === 0 && start.node()) {
      const child = new NodePtr();
      if (start.node()!.firstChild(child) === AccessResult.accessOK) {
        this.start_ = child;
        this.depth_ = 1;
      } else {
        this.start_ = new NodePtr(); // empty
      }
    }
  }

  private static advance(nd: NodePtr, depthRef: { value: number }): void {
    if (!nd.node()) return;

    // Try to go to first child
    const child = new NodePtr();
    if (nd.node()!.firstChild(child) === AccessResult.accessOK) {
      nd.assign(child.node());
      depthRef.value++;
      return;
    }

    if (depthRef.value === 0) {
      nd.clear();
      return;
    }

    // Try to go to next sibling, or parent's next sibling
    while (nd.assignNextSibling() !== AccessResult.accessOK) {
      if (depthRef.value === 1 || nd.assignOrigin() !== AccessResult.accessOK) {
        nd.clear();
        return;
      }
      depthRef.value--;
    }
  }

  override nodeListFirst(_context: EvalContext, _interp: Interpreter): NodePtr {
    return this.start_;
  }

  override nodeListRest(context: EvalContext, interp: Interpreter): NodeListObj {
    if (!this.start_.node()) {
      return new EmptyNodeListObj();
    }
    const newStart = new NodePtr(this.start_.node());
    const depthRef = { value: this.depth_ };
    DescendantsNodeListObj.advance(newStart, depthRef);
    if (!newStart.node()) {
      return new EmptyNodeListObj();
    }
    const result = new DescendantsNodeListObj(newStart, depthRef.value);
    result.start_ = newStart;
    result.depth_ = depthRef.value;
    return result;
  }
}

// descendants - get all descendants of a node
// Following upstream DEFPRIMITIVE(Descendants) in primitive.cxx
export class DescendantsPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(DescendantsPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nodeRes = args[0].optSingletonNodeList(context, interp);
    if (!nodeRes.result) {
      // Not an optional singleton - try as node list to map over
      const nl = args[0].asNodeList();
      if (nl) {
        // Return a map that applies descendants to each node
        // For simplicity, collect all descendants eagerly
        const allDescendants: NodePtr[] = [];
        let current: NodeListObj | null = nl;
        while (current) {
          const first = current.nodeListFirst(context, interp);
          if (!first.node()) break;
          // Collect descendants of this node
          const desc = new DescendantsNodeListObj(first, 0);
          let descCur: NodeListObj | null = desc;
          while (descCur) {
            const descFirst = descCur.nodeListFirst(context, interp);
            if (!descFirst.node()) break;
            allDescendants.push(descFirst);
            descCur = descCur.nodeListRest(context, interp);
          }
          current = current.nodeListRest(context, interp);
        }
        if (allDescendants.length === 0) {
          return interp.makeEmptyNodeList();
        }
        let result: NodeListObj = new NodePtrNodeListObj(allDescendants[allDescendants.length - 1]);
        for (let i = allDescendants.length - 2; i >= 0; i--) {
          result = new PairNodeListObj(new NodePtrNodeListObj(allDescendants[i]), result);
        }
        return result;
      }
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    if (!nodeRes.node.node()) {
      return interp.makeEmptyNodeList();
    }
    return new DescendantsNodeListObj(nodeRes.node, 0);
  }
}

// node-list-reverse - reverse a node list
// Following upstream DEFPRIMITIVE(NodeListReverse) in primitive.cxx
export class NodeListReversePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(NodeListReversePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    // Collect all nodes in the list
    const nodes: NodePtr[] = [];
    let current: NodeListObj | null = nl;
    while (current) {
      const first = current.nodeListFirst(context, interp);
      if (!first || !first.node()) break;
      nodes.push(first);
      current = current.nodeListRest(context, interp);
    }
    if (nodes.length === 0) {
      return interp.makeEmptyNodeList();
    }
    // Build reversed list
    let result: NodeListObj = new NodePtrNodeListObj(nodes[0]);
    for (let i = 1; i < nodes.length; i++) {
      result = new PairNodeListObj(new NodePtrNodeListObj(nodes[i]), result);
    }
    return result;
  }
}

// node-list-ref - returns the nth node in a node list (0-indexed)
export class NodeListRefPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(NodeListRefPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    const indexData = args[1].exactIntegerValue();
    if (!indexData.result || indexData.value < 0) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactNonNegativeInteger, 1, args[1]);
    }
    let index = indexData.value;
    let current: NodeListObj | null = nl;
    while (current && index > 0) {
      const first = current.nodeListFirst(context, interp);
      if (!first || !first.node()) {
        return interp.makeEmptyNodeList();
      }
      current = current.nodeListRest(context, interp);
      index--;
    }
    if (!current) {
      return interp.makeEmptyNodeList();
    }
    const first = current.nodeListFirst(context, interp);
    if (!first || !first.node()) {
      return interp.makeEmptyNodeList();
    }
    return new NodePtrNodeListObj(first);
  }
}

// node-list - constructs a node list from singleton node-lists
export class NodeListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);  // rest arguments
  constructor() { super(NodeListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (argc === 0) {
      return interp.makeEmptyNodeList();
    }
    if (argc === 1) {
      const nl = args[0].asNodeList();
      if (!nl) {
        return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
      }
      return nl;
    }
    // Multiple arguments - build up using PairNodeListObj (right-associative)
    let result: NodeListObj = interp.makeEmptyNodeList() as NodeListObj;
    for (let i = argc - 1; i >= 0; i--) {
      const nl = args[i].asNodeList();
      if (!nl) {
        return this.argError(interp, loc, ArgErrorMessages.notANodeList, i, args[i]);
      }
      result = new PairNodeListObj(nl, result);
    }
    return result;
  }
}

// ============ Sosofo Operations ============

// sosofo-append
export class SosofoAppendPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, true);  // 0 required, 0 optional, rest = true
  constructor() { super(SosofoAppendPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    // If no arguments, return empty sosofo
    if (argc === 0) {
      return new EmptySosofoObj();
    }
    // If one argument, return it if it's a sosofo
    if (argc === 1) {
      const sosofo = args[0].asSosofo();
      if (!sosofo) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.notASosofo, interp.makeInteger(0), args[0]);
        return interp.makeError();
      }
      return sosofo;
    }
    // Create append sosofo for multiple arguments
    const result = new AppendSosofoObj();
    for (let i = 0; i < argc; i++) {
      const sosofo = args[i].asSosofo();
      if (!sosofo) {
        interp.setNextLocation(loc);
        interp.message(ArgErrorMessages.notASosofo, interp.makeInteger(i), args[i]);
        return interp.makeError();
      }
      result.append(sosofo);
    }
    return result;
  }
}

// empty-sosofo
export class EmptySosofoPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, false);
  constructor() { super(EmptySosofoPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    return new EmptySosofoObj();
  }
}

// process-children - process children of current node
// Following upstream DEFPRIMITIVE(ProcessChildren) in primitive.cxx
export class ProcessChildrenPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, false);
  constructor() { super(ProcessChildrenPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (!context.processingMode) {
      interp.setNextLocation(loc);
      interp.message(InterpreterMessages.noCurrentProcessingMode);
      return interp.makeError();
    }
    return new ProcessChildrenSosofoObj(context.processingMode as ProcessingMode);
  }
}

// process-children-trim - process children of current node, trimming whitespace
// Following upstream DEFPRIMITIVE(ProcessChildrenTrim) in primitive.cxx
export class ProcessChildrenTrimPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, false);
  constructor() { super(ProcessChildrenTrimPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (!context.processingMode) {
      interp.setNextLocation(loc);
      interp.message(InterpreterMessages.noCurrentProcessingMode);
      return interp.makeError();
    }
    return new ProcessChildrenTrimSosofoObj(context.processingMode as ProcessingMode);
  }
}

// process-node-list - process a node list
// Following upstream DEFPRIMITIVE(ProcessNodeList) in primitive.cxx
export class ProcessNodeListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(ProcessNodeListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (!context.processingMode) {
      interp.setNextLocation(loc);
      interp.message(InterpreterMessages.noCurrentProcessingMode);
      return interp.makeError();
    }
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    return new ProcessNodeListSosofoObj(nl, context.processingMode as ProcessingMode);
  }
}

// ============ Misc ============

// external-procedure - lookup an external procedure by name
export class ExternalProcedurePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(ExternalProcedurePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    // Create StringC from the string data - matches upstream: StringC tem(s, n);
    // Convert Uint32Array to number[] for StringOf constructor
    const chars: Char[] = [];
    for (let i = 0; i < sd.length; i++) {
      chars.push(sd.data[i]);
    }
    const tem = new StringOf<Char>(chars, sd.length);
    const func = interp.lookupExternalProc(tem);
    if (func) {
      return func;
    }
    return interp.makeFalse();
  }
}

// ============ Literal ============

// literal - creates a literal sosofo from a string
export class LiteralPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, true);  // Takes at least one string, rest are optional
  constructor() { super(LiteralPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    // Concatenate all string arguments
    const resultChars: Char[] = [];
    for (let i = 0; i < argc; i++) {
      const sd = args[i].stringData();
      if (!sd.result) {
        interp.setNextLocation(loc);
        interp.message('notAString');
        return interp.makeError();
      }
      for (let j = 0; j < sd.length; j++) {
        resultChars.push(sd.data[j]);
      }
    }
    const strObj = new StringObj(new Uint32Array(resultChars));
    return new LiteralSosofoObj(strObj);
  }
}

// ============ Error ============

// error
export class ErrorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(ErrorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (sd.result) {
      let msg = '';
      for (let i = 0; i < sd.length; i++) {
        msg += String.fromCharCode(sd.data[i]);
      }
      interp.setNextLocation(loc);
      interp.message('userError', msg);
    }
    return interp.makeError();
  }
}

// ============ Grove Access Primitives ============

// number->string
// Following upstream: returns error if argument is not a number
export class NumberToStringPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);
  constructor() { super(NumberToStringPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const rv = args[0].realValue();
    if (!rv.result) {
      // Following upstream: error if not a number
      return this.argError(interp, loc, ArgErrorMessages.notANumber, 0, args[0]);
    }

    let radix = 10;
    if (argc > 1) {
      const rRes = args[1].exactIntegerValue();
      if (!rRes.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
      }
      switch (rRes.value) {
        case 2:
        case 8:
        case 10:
        case 16:
          radix = rRes.value;
          break;
        default:
          interp.setNextLocation(loc);
          interp.message(ArgErrorMessages.invalidRadix);
          radix = 10;
          break;
      }
    }

    // Format number to string with radix
    let str: string;
    const iv = args[0].exactIntegerValue();
    if (iv.result) {
      str = iv.value.toString(radix);
    } else {
      if (radix !== 10) {
        // Non-integer with non-10 radix: convert to integer first
        str = Math.round(rv.value).toString(radix);
      } else {
        str = rv.value.toString();
      }
    }

    // Convert to StringObj
    const chars = new Uint32Array(str.length);
    for (let i = 0; i < str.length; i++) {
      chars[i] = str.charCodeAt(i);
    }
    return new StringObj(chars);
  }
}

// ============ Number Formatting Primitives ============

// Helper function to format a number as letters (a, b, c, ... z, aa, ab, ...)
// Following upstream formatNumberLetter in primitive.cxx
function formatNumberLetter(n: number, letters: string): string {
  if (n === 0) return '0';

  let neg = false;
  if (n < 0) {
    n = -n;
    neg = true;
  }

  let result = '';
  do {
    n--;
    const r = n % 26;
    n = Math.floor((n - r) / 26);
    result = letters.charAt(r) + result;
  } while (n > 0);

  if (neg) result = '-' + result;
  return result;
}

// Helper function to format a number as decimal with optional padding
// Following upstream formatNumberDecimal in primitive.cxx
function formatNumberDecimal(n: number, minWidth: number): string {
  const str = n.toString();
  const neg = n < 0;
  const digits = neg ? str.slice(1) : str;

  if (digits.length >= minWidth) {
    return str;
  }

  const padding = '0'.repeat(minWidth - digits.length);
  return neg ? '-' + padding + digits : padding + digits;
}

// Helper function to format a number as Roman numerals
// Following upstream formatNumberRoman in primitive.cxx
function formatNumberRoman(n: number, letters: string): string {
  if (n > 5000 || n < -5000 || n === 0) {
    return formatNumberDecimal(n, 1);
  }

  let result = '';
  if (n < 0) {
    n = -n;
    result = '-';
  }

  // M = letters[0], D = letters[1], C = letters[2], L = letters[3], X = letters[4], V = letters[5], I = letters[6]
  while (n >= 1000) {
    result += letters.charAt(0);
    n -= 1000;
  }

  // Process hundreds, tens, ones
  // letters offset: 0=M, 2=C, 4=X, 6=I (using pairs CD, LX, VI for subtraction)
  let letterIdx = 0;
  for (let i = 100; i > 0; i = Math.floor(i / 10)) {
    letterIdx += 2;
    const q = Math.floor(n / i);
    n -= q * i;
    switch (q) {
      case 1:
        result += letters.charAt(letterIdx);
        break;
      case 2:
        result += letters.charAt(letterIdx) + letters.charAt(letterIdx);
        break;
      case 3:
        result += letters.charAt(letterIdx) + letters.charAt(letterIdx) + letters.charAt(letterIdx);
        break;
      case 4:
        result += letters.charAt(letterIdx) + letters.charAt(letterIdx - 1);
        break;
      case 5:
        result += letters.charAt(letterIdx - 1);
        break;
      case 6:
        result += letters.charAt(letterIdx - 1) + letters.charAt(letterIdx);
        break;
      case 7:
        result += letters.charAt(letterIdx - 1) + letters.charAt(letterIdx) + letters.charAt(letterIdx);
        break;
      case 8:
        result += letters.charAt(letterIdx - 1) + letters.charAt(letterIdx) + letters.charAt(letterIdx) + letters.charAt(letterIdx);
        break;
      case 9:
        result += letters.charAt(letterIdx) + letters.charAt(letterIdx - 2);
        break;
    }
  }
  return result;
}

// Main format-number helper - formats a single number according to format spec
// Following upstream formatNumber in primitive.cxx
function formatNumber(n: number, format: Uint32Array | null, len: number, result: string[]): boolean {
  if (len > 0 && format) {
    const lastChar = format[len - 1];
    switch (lastChar) {
      case 0x61: // 'a'
        result.push(formatNumberLetter(n, 'abcdefghijklmnopqrstuvwxyz'));
        return true;
      case 0x41: // 'A'
        result.push(formatNumberLetter(n, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
        return true;
      case 0x69: // 'i'
        result.push(formatNumberRoman(n, 'mdclxvi'));
        return true;
      case 0x49: // 'I'
        result.push(formatNumberRoman(n, 'MDCLXVI'));
        return true;
      case 0x31: // '1'
        result.push(formatNumberDecimal(n, len));
        return true;
    }
  }
  result.push(formatNumberDecimal(n, 1));
  return false;
}

// format-number - format an integer according to a format string
// Following upstream DEFPRIMITIVE(FormatNumber) in primitive.cxx
export class FormatNumberPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);  // 2 required (number, format)
  constructor() { super(FormatNumberPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    // Get the number
    const nRes = args[0].exactIntegerValue();
    if (!nRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 0, args[0]);
    }

    // Get the format string
    const sd = args[1].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 1, args[1]);
    }

    // Format the number
    const result: string[] = [];
    const validFormat = formatNumber(nRes.value, sd.data, sd.length, result);

    if (!validFormat) {
      // Invalid format - still return result but could warn
      interp.setNextLocation(loc);
      // interp.message('invalidNumberFormat'); // TODO: add this message
    }

    // Convert to StringObj
    const str = result.join('');
    const chars = new Uint32Array(str.length);
    for (let i = 0; i < str.length; i++) {
      chars[i] = str.charCodeAt(i);
    }
    return new StringObj(chars);
  }
}

// format-number-list - format a list of numbers with format strings and separators
// Following upstream DEFPRIMITIVE(FormatNumberList) in primitive.cxx
export class FormatNumberListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(3, 0, false);  // 3 required (numbers, formats, separators)
  constructor() { super(FormatNumberListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let numbers: ELObj = args[0];
    let formats: ELObj = args[1];
    let seps: ELObj = args[2];
    const result: string[] = [];
    let isFirst = true;

    while (!numbers.isNil()) {
      // Add separator (except before first number)
      if (!isFirst) {
        const sepSd = seps.stringData();
        if (sepSd.result) {
          // seps is a string - use it for all separators
          result.push(stringDataToString(sepSd));
        } else {
          // seps should be a list of strings
          const sepPair = seps.asPair();
          if (!sepPair) {
            return this.argError(interp, loc, ArgErrorMessages.notAList, 2, args[2]);
          }
          const carSd = sepPair.car().stringData();
          if (!carSd.result) {
            return this.argError(interp, loc, ArgErrorMessages.notAString, 2, sepPair.car());
          }
          result.push(stringDataToString(carSd));
          seps = sepPair.cdr();
        }
      }

      // Get current number
      const numPair = numbers.asPair();
      if (!numPair) {
        return this.argError(interp, loc, ArgErrorMessages.notAList, 0, args[0]);
      }

      const numRes = numPair.car().exactIntegerValue();
      if (!numRes.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 0, numPair.car());
      }
      numbers = numPair.cdr();

      // Get format
      let format: Uint32Array | null = null;
      let formatLen = 0;
      const formatSd = formats.stringData();
      if (formatSd.result) {
        // formats is a string - use it for all numbers
        format = formatSd.data;
        formatLen = formatSd.length;
      } else {
        // formats should be a list of strings
        const formatPair = formats.asPair();
        if (!formatPair) {
          return this.argError(interp, loc, ArgErrorMessages.notAList, 1, args[1]);
        }
        const carSd = formatPair.car().stringData();
        if (!carSd.result) {
          return this.argError(interp, loc, ArgErrorMessages.notAString, 1, formatPair.car());
        }
        format = carSd.data;
        formatLen = carSd.length;
        formats = formatPair.cdr();
      }

      // Format the number
      formatNumber(numRes.value, format, formatLen, result);
      isFirst = false;
    }

    // Convert to StringObj
    const str = result.join('');
    const chars = new Uint32Array(str.length);
    for (let i = 0; i < str.length; i++) {
      chars[i] = str.charCodeAt(i);
    }
    return new StringObj(chars);
  }
}

// Default SdataMapper for grove operations
const defaultSdataMapper = new SdataMapper();

// Helper function for attribute-string: get attribute string from node
function nodeAttributeString(
  node: NodePtr,
  attrName: Uint32Array,
  attrNameLen: number,
  _interp: Interpreter,
  value: { str: string }
): boolean {
  const nd = node.node();
  if (!nd) return false;

  // Get attr name as string for debug
  let attrNameStr = '';
  for (let i = 0; i < attrNameLen; i++) {
    attrNameStr += String.fromCharCode(attrName[i]);
  }

  const attsResult = nd.getAttributes();
  if (attsResult.result !== AccessResult.accessOK || !attsResult.atts) {
    return false;
  }

  // Create GroveString from attr name
  const name = new GroveString(attrName, attrNameLen);

  const attPtr = new NodePtr();
  const namedResult = attsResult.atts.namedNode(name, attPtr);
  if (namedResult !== AccessResult.accessOK) {
    return false;
  }

  const attNode = attPtr.node();
  if (!attNode) return false;

  // Check if attribute is implied
  const impliedResult = attNode.getImplied();
  if (impliedResult.result === AccessResult.accessOK && impliedResult.implied) {
    return false;
  }

  // Try to get tokens (for tokenized attributes)
  const tokResult = attNode.tokens();
  if (tokResult.result === AccessResult.accessOK) {
    const gs = tokResult.str;
    let str = '';
    const data = gs.data();
    if (data) {
      for (let i = 0; i < gs.size(); i++) {
        str += String.fromCharCode(data[i]);
      }
    }
    value.str = str;
    return true;
  }

  // Fall back to getting child content
  const firstPtr = new NodePtr();
  if (attNode.firstChild(firstPtr) === AccessResult.accessOK) {
    let str = '';
    let tem = firstPtr;
    do {
      const temNode = tem.node();
      if (!temNode) break;
      const chunkResult = temNode.charChunk(defaultSdataMapper);
      if (chunkResult.result === AccessResult.accessOK) {
        const gs = chunkResult.str;
        const data = gs.data();
        if (data) {
          for (let i = 0; i < gs.size(); i++) {
            str += String.fromCharCode(data[i]);
          }
        }
      }
      // Move to next chunk sibling
      const nextPtr = new NodePtr();
      if (temNode.nextChunkSibling(nextPtr) !== AccessResult.accessOK) {
        break;
      }
      tem = nextPtr;
    } while (tem.node());
    value.str = str;
    return true;
  }

  value.str = '';
  return true;
}

// attribute-string
export class AttributeStringPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);
  constructor() { super(AttributeStringPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 1) {
      const nodeRes = args[1].optSingletonNodeList(context, interp);
      if (!nodeRes.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAnOptSingletonNode, 1, args[1]);
      }
      if (!nodeRes.node.node()) {
        return interp.makeFalse();
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    const value = { str: '' };
    if (nodeAttributeString(node, sd.data, sd.length, interp, value)) {
      // Return attribute value as-is - only attribute NAMES are normalized, not values
      const chars = new Uint32Array(value.str.length);
      for (let i = 0; i < value.str.length; i++) {
        chars[i] = value.str.charCodeAt(i);
      }
      return new StringObj(chars);
    }
    return interp.makeFalse();
  }
}

// child-number
export class ChildNumberPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);
  constructor() { super(ChildNumberPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 0) {
      const nodeRes = args[0].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 0, args[0]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    // Count position among siblings
    const numRes = interp.childNumber(node);
    if (!numRes.result) {
      return interp.makeFalse();
    }
    // DSSSL child-number is 1-based
    return interp.makeInteger(numRes.value + 1);
  }
}

// current-node
export class CurrentNodePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, false);
  constructor() { super(CurrentNodePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (!context.currentNode) {
      return this.noCurrentNodeError(interp, loc);
    }
    return new NodePtrNodeListObj(context.currentNode);
  }
}

// parent - get parent node
// Following upstream DEFPRIMITIVE(Parent) in primitive.cxx
export class ParentPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);  // 0 required, 1 optional
  constructor() { super(ParentPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 0) {
      const nodeRes = args[0].optSingletonNodeList(context, interp);
      if (!nodeRes.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAnOptSingletonNode, 0, args[0]);
      }
      if (!nodeRes.node.node()) {
        return args[0];  // Return the original node list if empty
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    const parentPtr = new NodePtr();
    if (node.node()!.getParent(parentPtr) !== AccessResult.accessOK) {
      return interp.makeEmptyNodeList();
    }
    return new NodePtrNodeListObj(parentPtr);
  }
}

// ancestor - find ancestor with given GI (element name)
// Following upstream DEFPRIMITIVE(Ancestor) in primitive.cxx
export class AncestorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);  // 1 required (gi), 1 optional (node)
  constructor() { super(AncestorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 1) {
      const nodeRes = args[1].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 1, args[1]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    // Get the GI to search for
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    // Build the GI string for comparison
    let giStr = '';
    for (let i = 0; i < sd.length; i++) {
      giStr += String.fromCharCode(sd.data[i]);
    }
    // Normalize to lowercase for case-insensitive comparison
    const giLower = giStr.toLowerCase();

    // Traverse ancestors looking for matching GI
    const current = new NodePtr(node.node());
    while (current.node()!.getParent(current) === AccessResult.accessOK) {
      const giResult = current.node()!.getGi();
      if (giResult.result === AccessResult.accessOK) {
        const gs = giResult.str;
        const data = gs.data();
        if (data) {
          let nodeGi = '';
          for (let i = 0; i < gs.size(); i++) {
            nodeGi += String.fromCharCode(data[i]);
          }
          if (nodeGi.toLowerCase() === giLower) {
            return new NodePtrNodeListObj(current);
          }
        }
      }
    }
    return interp.makeEmptyNodeList();
  }
}

// first-sibling? - test if node is the first sibling of its type
// Following upstream DEFPRIMITIVE(IsFirstSibling) in primitive.cxx
export class IsFirstSiblingPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);
  constructor() { super(IsFirstSiblingPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let nd: NodePtr;
    if (argc > 0) {
      const nodeRes = args[0].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 0, args[0]);
      }
      nd = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      nd = context.currentNode;
    }

    // Get the GI (generic identifier/element name) of this node
    const giResult = nd.node()!.getGi();
    if (giResult.result !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const gi = giResult.str;

    // Get first sibling
    const p = new NodePtr();
    if (nd.node()!.firstSibling(p) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }

    // Iterate through siblings to check if any earlier sibling has same GI
    while (p.node() && !p.sameNode(nd)) {
      const temResult = p.node()!.getGi();
      if (temResult.result === AccessResult.accessOK && temResult.str.equals(gi)) {
        return interp.makeFalse();  // Found an earlier sibling with same GI
      }
      if (p.assignNextChunkSibling() !== AccessResult.accessOK) {
        break;
      }
    }
    return interp.makeTrue();
  }
}

// last-sibling? - test if node is the last sibling of its type
// Following upstream DEFPRIMITIVE(IsLastSibling) in primitive.cxx
export class IsLastSiblingPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);
  constructor() { super(IsLastSiblingPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let nd: NodePtr;
    if (argc > 0) {
      const nodeRes = args[0].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 0, args[0]);
      }
      nd = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      nd = context.currentNode;
    }

    // Get the GI (generic identifier/element name) of this node
    const giResult = nd.node()!.getGi();
    if (giResult.result !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const gi = giResult.str;

    // Check following siblings for same GI
    const ndCopy = new NodePtr(nd.node());
    while (ndCopy.assignNextChunkSibling() === AccessResult.accessOK) {
      const temResult = ndCopy.node()!.getGi();
      if (temResult.result === AccessResult.accessOK && temResult.str.equals(gi)) {
        return interp.makeFalse();  // Found a later sibling with same GI
      }
    }
    return interp.makeTrue();
  }
}

// Helper function to extract data from a node (following upstream nodeData in primitive.cxx)
function nodeData(nd: NodePtr, mapper: SdataMapper, chunk: boolean, chars: Char[]): void {
  // Try charChunk first - gets character data from data nodes
  const chunkResult = nd.node()!.charChunk(mapper);
  if (chunkResult.result === AccessResult.accessOK) {
    const str = chunkResult.str;
    const data = str.data();
    if (data) {
      const len = chunk ? str.size() : 1;
      for (let i = 0; i < len; i++) {
        chars.push(data[i]);
      }
    }
    return;
  }

  // Try tokens - gets attribute value tokens
  const tokensResult = nd.node()!.tokens();
  if (tokensResult.result === AccessResult.accessOK) {
    const str = tokensResult.str;
    const data = str.data();
    if (data) {
      for (let i = 0; i < str.size(); i++) {
        chars.push(data[i]);
      }
    }
    return;
  }

  // Recursively process children
  const cnd = new NodePtr();
  if (nd.node()!.firstChild(cnd) === AccessResult.accessOK) {
    do {
      nodeData(cnd, mapper, true, chars);
    } while (cnd.assignNextChunkSibling() === AccessResult.accessOK);
    return;
  }

  // Last resort: try getToken - for attribute value nodes
  const tokenResult = nd.node()!.getToken();
  if (tokenResult.result === AccessResult.accessOK) {
    const str = tokenResult.str;
    const data = str.data();
    if (data) {
      for (let i = 0; i < str.size(); i++) {
        chars.push(data[i]);
      }
    }
  }
}

// data - extract string data from a node list
// Following upstream DEFPRIMITIVE(Data) in primitive.cxx
export class DataPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(DataPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }

    const chars: Char[] = [];

    // Iterate through all nodes in the node list
    for (;;) {
      const nd = nl.nodeListFirst(context, interp);
      if (!nd.node()) {
        break;
      }

      // Get the rest of the node list and chunk flag
      const chunkRestResult = nl.nodeListChunkRest(context, interp);
      const chunk = chunkRestResult.chunk;
      nl = chunkRestResult.list;

      nodeData(nd, defaultSdataMapper, chunk, chars);
    }

    return new StringObj(new Uint32Array(chars));
  }
}

// gi - get generic identifier (element name)
export class GiPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);
  constructor() { super(GiPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 0) {
      const nodeRes = args[0].optSingletonNodeList(context, interp);
      if (!nodeRes.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAnOptSingletonNode, 0, args[0]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    if (!node.node()) {
      return interp.makeFalse();
    }

    const giResult = node.node()!.getGi();
    if (giResult.result === AccessResult.accessOK) {
      const gs = giResult.str;
      const data = gs.data();
      if (data) {
        const chars = new Uint32Array(gs.size());
        for (let i = 0; i < gs.size(); i++) {
          // Convert to lowercase - SGML GIs are case-insensitive
          const c = data[i];
          chars[i] = (c >= 65 && c <= 90) ? c + 32 : c;
        }
        return new StringObj(chars);
      }
    }
    return interp.makeFalse();
  }
}

// NodeListPtrNodeListObj - wraps a grove NodeListPtr as an ELObj NodeListObj
class NodeListPtrNodeListObj extends NodeListObj {
  private listPtr_: NodeListPtr;

  constructor(listPtr: NodeListPtr) {
    super();
    this.listPtr_ = listPtr;
  }

  override nodeListFirst(_ctx: EvalContext, _interp: Interpreter): NodePtr {
    const list = this.listPtr_.list();
    if (!list) return new NodePtr();
    const nodePtr = new NodePtr();
    if (list.first(nodePtr) !== AccessResult.accessOK) {
      return new NodePtr();
    }
    return nodePtr;
  }

  override nodeListRest(_ctx: EvalContext, _interp: Interpreter): NodeListObj {
    const list = this.listPtr_.list();
    if (!list) return new EmptyNodeListObj();
    const restPtr = new NodeListPtr();
    if (list.rest(restPtr) !== AccessResult.accessOK) {
      return new EmptyNodeListObj();
    }
    if (!restPtr.list()) return new EmptyNodeListObj();
    return new NodeListPtrNodeListObj(restPtr);
  }

  override nodeListChunkRest(_ctx: EvalContext, _interp: Interpreter): { list: NodeListObj; chunk: boolean } {
    const list = this.listPtr_.list();
    if (!list) return { list: new EmptyNodeListObj(), chunk: false };
    const restPtr = new NodeListPtr();
    if (list.chunkRest(restPtr) !== AccessResult.accessOK) {
      return { list: new EmptyNodeListObj(), chunk: false };
    }
    if (!restPtr.list()) return { list: new EmptyNodeListObj(), chunk: false };
    return { list: new NodeListPtrNodeListObj(restPtr), chunk: true };
  }
}

// ChildrenMapNodeListObj - lazy node list that maps children over nodes
// Following upstream pattern where primitives support mapping over node lists
class ChildrenMapNodeListObj extends NodeListObj {
  private nl_: NodeListObj;
  private children_: NodeListObj | null = null;

  constructor(nl: NodeListObj) {
    super();
    this.nl_ = nl;
  }

  private getNextChildren(context: EvalContext, interp: Interpreter): void {
    const nd = this.nl_.nodeListFirst(context, interp);
    if (!nd.node()) return;

    const childrenListPtr = new NodeListPtr();
    if (nd.node()!.children(childrenListPtr) === AccessResult.accessOK) {
      this.children_ = new NodeListPtrNodeListObj(childrenListPtr);
    } else {
      this.children_ = new EmptyNodeListObj();
    }
    this.nl_ = this.nl_.nodeListRest(context, interp);
  }

  override nodeListFirst(context: EvalContext, interp: Interpreter): NodePtr {
    for (;;) {
      if (!this.children_) {
        this.getNextChildren(context, interp);
        if (!this.children_) break;
      }
      const nd = this.children_.nodeListFirst(context, interp);
      if (nd.node()) return nd;
      this.children_ = null;
    }
    return new NodePtr();
  }

  override nodeListRest(context: EvalContext, interp: Interpreter): NodeListObj {
    for (;;) {
      if (!this.children_) {
        this.getNextChildren(context, interp);
        if (!this.children_) break;
      }
      const nd = this.children_.nodeListFirst(context, interp);
      if (nd.node()) {
        const rest = this.children_.nodeListRest(context, interp);
        if (rest.nodeListFirst(context, interp).node()) {
          return new PairNodeListObj(rest, new ChildrenMapNodeListObj(this.nl_));
        }
        return new ChildrenMapNodeListObj(this.nl_);
      }
      this.children_ = null;
    }
    return new EmptyNodeListObj();
  }
}

// children - get children of a node as node list
export class ChildrenPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(ChildrenPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nodeRes = args[0].optSingletonNodeList(context, interp);
    if (!nodeRes.result) {
      // Check if it's a node list (for mapping children over each node)
      const nl = args[0].asNodeList();
      if (nl) {
        return new ChildrenMapNodeListObj(nl);
      }
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }

    if (!nodeRes.node.node()) {
      return args[0];
    }

    const nd = nodeRes.node.node()!;
    const childrenListPtr = new NodeListPtr();
    if (nd.children(childrenListPtr) !== AccessResult.accessOK) {
      return interp.makeEmptyNodeList();
    }

    return new NodeListPtrNodeListObj(childrenListPtr);
  }
}

// node-list->list - convert node list to Scheme list
export class NodeListToListPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(NodeListToListPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }

    // Build a list from the node list
    let result: ELObj = interp.makeNil();
    const nodes: ELObj[] = [];

    // Collect all nodes first
    let current: NodeListObj | null = nl;
    let iterations = 0;
    while (current) {
      iterations++;
      const first = current.nodeListFirst(context, interp);
      if (!first.node()) break;
      nodes.push(new NodePtrNodeListObj(first));
      current = current.nodeListRest(context, interp);
    }


    // Build list from end to beginning
    for (let i = nodes.length - 1; i >= 0; i--) {
      result = interp.makePair(nodes[i], result);
    }

    return result;
  }
}

// id - get ID attribute value of current node
export class IdPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);
  constructor() { super(IdPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 0) {
      const nodeRes = args[0].optSingletonNodeList(context, interp);
      if (!nodeRes.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAnOptSingletonNode, 0, args[0]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    if (!node.node()) {
      return interp.makeFalse();
    }

    // Look for ID attribute - try lowercase first
    const idAttr = new Uint32Array([0x69, 0x64]); // "id"
    const value = { str: '' };
    if (nodeAttributeString(node, idAttr, 2, interp, value)) {
      const chars = new Uint32Array(value.str.length);
      for (let i = 0; i < value.str.length; i++) {
        chars[i] = value.str.charCodeAt(i);
      }
      return new StringObj(chars);
    }

    // Try uppercase "ID"
    const idAttrUpper = new Uint32Array([0x49, 0x44]); // "ID"
    if (nodeAttributeString(node, idAttrUpper, 2, interp, value)) {
      const chars = new Uint32Array(value.str.length);
      for (let i = 0; i < value.str.length; i++) {
        chars[i] = value.str.charCodeAt(i);
      }
      return new StringObj(chars);
    }

    return interp.makeFalse();
  }
}

// select-elements - filter node list to elements with given gi
export class SelectElementsPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(SelectElementsPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }

    // Get the gi to match - can be string or list of strings
    const giList: string[] = [];
    const sd = args[1].stringData();
    if (sd.result) {
      let giStr = '';
      for (let i = 0; i < sd.length; i++) {
        giStr += String.fromCharCode(sd.data[i]);
      }
      giList.push(giStr);
    } else {
      // Try as a list
      let p = args[1];
      while (!p.isNil()) {
        const pair = p.asPair();
        if (!pair) break;
        const elemSd = pair.car().stringData();
        if (elemSd.result) {
          let giStr = '';
          for (let i = 0; i < elemSd.length; i++) {
            giStr += String.fromCharCode(elemSd.data[i]);
          }
          giList.push(giStr);
        }
        p = pair.cdr();
      }
    }

    if (giList.length === 0) {
      return interp.makeEmptyNodeList();
    }

    // Filter the node list
    const matchingNodes: NodePtr[] = [];
    let current: NodeListObj | null = nl;
    while (current) {
      const first = current.nodeListFirst(context, interp);
      if (!first.node()) break;

      const nd = first.node()!;
      const giResult = nd.getGi();
      if (giResult.result === AccessResult.accessOK) {
        const gs = giResult.str;
        const data = gs.data();
        if (data) {
          let nodeGi = '';
          for (let i = 0; i < gs.size(); i++) {
            nodeGi += String.fromCharCode(data[i]);
          }
          if (giList.includes(nodeGi) || giList.includes(nodeGi.toUpperCase()) || giList.includes(nodeGi.toLowerCase())) {
            matchingNodes.push(first);
          }
        }
      }

      current = current.nodeListRest(context, interp);
    }

    // Build result as a pair node list
    if (matchingNodes.length === 0) {
      return interp.makeEmptyNodeList();
    }

    let result: NodeListObj = new NodePtrNodeListObj(matchingNodes[matchingNodes.length - 1]);
    for (let i = matchingNodes.length - 2; i >= 0; i--) {
      result = new PairNodeListObj(new NodePtrNodeListObj(matchingNodes[i]), result);
    }
    return result;
  }
}

// node-list-filter is defined in builtins.dsl using node-list-reduce
// No primitive needed - the DSSSL implementation handles it correctly

// node-list=? - test if node lists are equal (same nodes in same order)
// Following upstream DEFPRIMITIVE(IsNodeListEqual) in primitive.cxx
export class IsNodeListEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(IsNodeListEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let nl1 = args[0].asNodeList();
    const nl2Arg = args[1].asNodeList();
    if (!nl1) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    // Quick identity check
    if (nl1 === args[1]) {
      return interp.makeTrue();
    }
    let nl2 = nl2Arg;
    if (!nl2) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 1, args[1]);
    }

    // Compare all nodes in both lists
    for (;;) {
      const nd1 = nl1.nodeListFirst(context, interp);
      const nd2 = nl2.nodeListFirst(context, interp);

      if (!nd1.node()) {
        if (nd2.node()) {
          return interp.makeFalse();
        } else {
          break; // Both empty, lists are equal
        }
      } else if (!nd2.node()) {
        return interp.makeFalse();
      } else if (!nd1.sameNode(nd2)) {
        // Compare nodes - using sameNode for proper comparison
        return interp.makeFalse();
      }

      nl1 = nl1.nodeListRest(context, interp);
      nl2 = nl2.nodeListRest(context, interp);
    }
    return interp.makeTrue();
  }
}

// node-list-last - get last node from node list
export class NodeListLastPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(NodeListLastPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }

    let lastNode: NodePtr | null = null;
    let current: NodeListObj | null = nl;
    while (current) {
      const first = current.nodeListFirst(context, interp);
      if (!first.node()) break;
      lastNode = first;
      current = current.nodeListRest(context, interp);
    }

    if (lastNode) {
      return new NodePtrNodeListObj(lastNode);
    }
    return interp.makeEmptyNodeList();
  }
}

// element-with-id - find element by ID in grove
// (matching upstream DEFPRIMITIVE(ElementWithId) in primitive.cxx)
export class ElementWithIdPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);
  constructor() { super(ElementWithIdPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    // Get starting node
    let node: NodePtr;
    if (argc > 1) {
      const nodeRes = args[1].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 1, args[1]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return interp.makeEmptyNodeList();
      }
      node = new NodePtr(context.currentNode.node());
    }

    // Navigate to grove root (matching upstream node->getGroveRoot(node))
    if (node.node()!.getGroveRoot(node) !== AccessResult.accessOK) {
      return interp.makeEmptyNodeList();
    }

    // Get elements NamedNodeList (matching upstream node->getElements(elements))
    const groveRoot = node.node();
    if (!groveRoot) {
      return interp.makeEmptyNodeList();
    }

    const elemsResult = groveRoot.getElements();
    if (elemsResult.result !== AccessResult.accessOK || !elemsResult.elements) {
      return interp.makeEmptyNodeList();
    }

    // Build GroveString from the ID
    const idChars = new Uint32Array(sd.length);
    for (let i = 0; i < sd.length; i++) {
      idChars[i] = sd.data[i];
    }
    const idStr = new GroveString();
    idStr.assign(idChars, sd.length);

    // Look up element by ID (matching upstream elements->namedNode(...))
    const resultPtr = new NodePtr();
    if (elemsResult.elements.namedNode(idStr, resultPtr) === AccessResult.accessOK) {
      return new NodePtrNodeListObj(resultPtr);
    }

    return interp.makeEmptyNodeList();
  }
}

// NamedNodeListPtrNodeListObj - wraps a NamedNodeListPtr as a NodeListObj
// Following upstream pattern
class NamedNodeListPtrNodeListObj extends NodeListObj {
  private nnlPtr_: NamedNodeListPtr;
  private nodeListPtr_: NodeListPtr | null = null;

  constructor(nnlPtr: NamedNodeListPtr) {
    super();
    this.nnlPtr_ = nnlPtr;
    // Get the node list from the named node list
    const nnl = nnlPtr.list();
    if (nnl) {
      this.nodeListPtr_ = nnl.nodeList();
    }
  }

  override nodeListFirst(_ctx: EvalContext, _interp: Interpreter): NodePtr {
    if (!this.nodeListPtr_) return new NodePtr();
    const list = this.nodeListPtr_.list();
    if (!list) return new NodePtr();
    const nodePtr = new NodePtr();
    if (list.first(nodePtr) !== AccessResult.accessOK) {
      return new NodePtr();
    }
    return nodePtr;
  }

  override nodeListRest(_ctx: EvalContext, _interp: Interpreter): NodeListObj {
    if (!this.nodeListPtr_) return new EmptyNodeListObj();
    const list = this.nodeListPtr_.list();
    if (!list) return new EmptyNodeListObj();
    const restPtr = new NodeListPtr();
    if (list.rest(restPtr) !== AccessResult.accessOK) {
      return new EmptyNodeListObj();
    }
    return new NodeListPtrNodeListObj(restPtr);
  }
}

// ELObjPropertyValue - visitor for converting grove property values to ELObj
// Following upstream class ELObjPropertyValue in ELObjPropVal.h
class ELObjPropertyValue extends PropertyValue {
  private interp_: Interpreter;
  private rcs_: boolean;
  public obj: ELObj | null = null;

  constructor(interp: Interpreter, rcs: boolean) {
    super();
    this.interp_ = interp;
    this.rcs_ = rcs;
  }

  setNode(value: NodePtr): void {
    this.obj = new NodePtrNodeListObj(value);
  }

  setNodeList(value: NodeListPtr): void {
    this.obj = new NodeListPtrNodeListObj(value);
  }

  setNamedNodeList(value: NamedNodeListPtr): void {
    this.obj = new NamedNodeListPtrNodeListObj(value);
  }

  setBoolean(value: boolean): void {
    if (value) {
      this.obj = this.interp_.makeTrue();
    } else {
      this.obj = this.interp_.makeFalse();
    }
  }

  setChar(value: number): void {
    this.obj = this.interp_.makeChar(value);
  }

  setString(value: GroveString): void {
    const data = value.data();
    if (data) {
      this.obj = new StringObj(data);
    } else {
      this.obj = new StringObj(new Uint32Array(0));
    }
  }

  setComponentNameId(value: ComponentName.Id): void {
    // Convert component name to symbol - choose rcsName or sdqlName based on rcs_
    const name = this.rcs_ ? ComponentName.rcsName(value) : ComponentName.sdqlName(value);
    if (name) {
      this.obj = this.interp_.makeSymbol(name);
    } else {
      this.obj = this.interp_.makeFalse();
    }
  }

  setStringList(_value: any): void {
    // Not commonly used - return nil for now
    this.obj = this.interp_.makeNil();
  }

  setComponentNameIdList(_value: ComponentName.Id[]): void {
    // Not commonly used - return nil for now
    this.obj = this.interp_.makeNil();
  }

  setLong(value: number): void {
    this.obj = this.interp_.makeInteger(value);
  }
}

// node-property - get a node property by name
// Following upstream DEFPRIMITIVE(NodeProperty) in primitive.cxx
export class NodePropertyPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, true);  // 2 required, rest for keyword args
  constructor() { super(NodePropertyPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    // arg[0] is property name (string or symbol)
    const str = args[0].convertToString();
    if (!str) {
      return this.argError(interp, loc, 'notAStringOrSymbol', 0, args[0]);
    }

    // arg[1] is the node
    const nodeRes = args[1].optSingletonNodeList(context, interp);
    if (!nodeRes.result || !nodeRes.node.node()) {
      return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 1, args[1]);
    }
    const node = nodeRes.node;

    // Parse keyword arguments (default:, null:, is-rcs:)
    let defaultValue: ELObj | null = null;
    let nullValue: ELObj | null = null;
    let isRcs = false;

    // Process keyword args (argc - 2 remaining args after first 2)
    for (let i = 2; i < argc; i += 2) {
      if (i + 1 >= argc) break;
      const keyObj = args[i].asKeyword();
      if (!keyObj) {
        interp.setNextLocation(loc);
        interp.message('keyArgsNotKey');
        return interp.makeError();
      }
      const keyName = keyObj.identifier().name().toString();
      if (keyName === 'default') {
        defaultValue = args[i + 1];
      } else if (keyName === 'null') {
        nullValue = args[i + 1];
      } else if (keyName === 'is-rcs') {
        isRcs = args[i + 1] !== interp.makeFalse();
      }
    }

    // Look up property ID
    const propStr = str.stringData();
    // Create StringC for the property name and a human-readable string version
    const propChars: number[] = [];
    let propNameStr = '';
    if (propStr.data) {
      for (let i = 0; i < propStr.length; i++) {
        propChars.push(propStr.data[i]);
        propNameStr += String.fromCharCode(propStr.data[i]);
      }
    }
    const propName = new StringClass<number>(propChars, propChars.length);

    // Debug logging
    // console.log('[node-property] Looking up property:', propNameStr);

    // Special case for 'tokens' property on model-group nodes
    // Following upstream hack for duplicate rcsname
    let id = ComponentName.Id.noId;
    const clsResult = node.node()!.getClassName();
    if (propStr.data && stringDataEquals(propStr, 'tokens') &&
        clsResult.result === AccessResult.accessOK &&
        clsResult.name === ComponentName.Id.idModelGroup) {
      id = ComponentName.Id.idContentTokens;
    } else {
      const lookupResult = interp.lookupNodeProperty(propName);
      if (lookupResult.found) {
        id = lookupResult.id;
      }
    }

    if (id !== ComponentName.Id.noId) {
      const propValue = new ELObjPropertyValue(interp, isRcs);
      // The property method expects an SdataMapper - use the interpreter which should implement it
      const ret = node.node()!.property(id, interp as unknown as SdataMapper, propValue);
      if (ret === AccessResult.accessOK && propValue.obj) {
        return propValue.obj;
      }
      if (ret === AccessResult.accessNull && nullValue !== null) {
        return nullValue;
      }
    }

    if (defaultValue === null) {
      interp.setNextLocation(loc);
      interp.message('noNodePropertyValue', propNameStr);
      return interp.makeError();
    }
    return defaultValue;
  }
}

// Helper function to compare stringData with a string
function stringDataEquals(sd: { data: Uint32Array | null; length: number; result: boolean }, str: string): boolean {
  if (!sd.data || sd.length !== str.length) return false;
  for (let i = 0; i < str.length; i++) {
    if (sd.data[i] !== str.charCodeAt(i)) return false;
  }
  return true;
}

// ============ InheritedC Primitives ============

// InheritedCPrimitiveObj - returns the inherited value of a characteristic
// Following upstream InheritedCPrimitiveObj in InheritedC.cxx
export class InheritedCPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, false);
  private inheritedC_: InheritedC;

  constructor(ic: InheritedC) {
    super(InheritedCPrimitiveObj.signature_);
    this.inheritedC_ = ic;
  }

  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (!context.styleStack) {
      interp.setNextLocation(loc);
      interp.message(InterpreterMessages.notInCharacteristicValue);
      return interp.makeError();
    }
    const deps: number[] = [];
    const obj = context.styleStack.inherited(this.inheritedC_, context.specLevel || 0, interp, deps);
    if (!obj) {
      return interp.makeError();
    }
    return obj;
  }
}

// ActualCPrimitiveObj - returns the actual value of a characteristic
// Following upstream ActualCPrimitiveObj in InheritedC.cxx
export class ActualCPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 0, false);
  private inheritedC_: InheritedC;

  constructor(ic: InheritedC) {
    super(ActualCPrimitiveObj.signature_);
    this.inheritedC_ = ic;
  }

  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (!context.styleStack) {
      interp.setNextLocation(loc);
      interp.message(InterpreterMessages.notInCharacteristicValue);
      return interp.makeError();
    }
    const deps: number[] = [];
    const obj = context.styleStack.actual(this.inheritedC_, loc, interp, deps);
    if (!obj) {
      return interp.makeError();
    }
    return obj;
  }
}

// ============ Ancestor/Hierarchical Primitives ============

// Helper function to convert a string to a normalized general name
// Following upstream convertGeneralName in primitive.cxx
// In SGML, general names (element names) are case-insensitive
function convertGeneralName(obj: ELObj, node: NodePtr, result: { value: string }): boolean {
  const sd = obj.stringData();
  if (!sd.result || !sd.data) return false;

  // Get the string and normalize to lowercase for case-insensitive comparison
  let str = '';
  for (let i = 0; i < sd.length; i++) {
    str += String.fromCharCode(sd.data[i]);
  }
  result.value = str.toLowerCase();
  return true;
}

// Helper function to match a list of GIs against ancestors
// Following upstream matchAncestors in primitive.cxx
// Returns true if the list matches, with unmatched set to the remaining unmatched portion
function matchAncestors(obj: ELObj, node: NodePtr, result: { unmatched: ELObj }): boolean {
  // Get parent
  const parentPtr = new NodePtr();
  if (node.node()!.getParent(parentPtr) !== AccessResult.accessOK) {
    result.unmatched = obj;
    return true;
  }

  // Recursively match ancestors first
  if (!matchAncestors(obj, parentPtr, result)) {
    return false;
  }

  // If nothing left to match, we're done
  if (result.unmatched.isNil()) {
    return true;
  }

  // Check if current unmatched is a pair
  const pair = result.unmatched.asPair();
  if (!pair) {
    return false;
  }

  // Get the GI to match
  const giResult: { value: string } = { value: '' };
  if (!convertGeneralName(pair.car(), node, giResult)) {
    return false;
  }

  // Check if parent's GI matches
  const parentGiResult = parentPtr.node()!.getGi();
  if (parentGiResult.result === AccessResult.accessOK) {
    const gs = parentGiResult.str;
    const data = gs.data();
    if (data) {
      let parentGi = '';
      for (let i = 0; i < gs.size(); i++) {
        parentGi += String.fromCharCode(data[i]);
      }
      if (parentGi.toLowerCase() === giResult.value.toLowerCase()) {
        result.unmatched = pair.cdr();
      }
    }
  }

  return true;
}

// have-ancestor? - check if a node has an ancestor with given GI or matching a list of GIs
// Following upstream DEFPRIMITIVE(IsHaveAncestor) in primitive.cxx
export class IsHaveAncestorPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);  // 1 required (gi/list), 1 optional (node)
  constructor() { super(IsHaveAncestorPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 1) {
      const nodeRes = args[1].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 1, args[1]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    // Try to convert as a simple string (single GI)
    const giResult: { value: string } = { value: '' };
    if (convertGeneralName(args[0], node, giResult)) {
      // Simple string case - search ancestors for matching GI
      const current = new NodePtr(node.node());
      while (current.node()!.getParent(current) === AccessResult.accessOK) {
        const nodeGiResult = current.node()!.getGi();
        if (nodeGiResult.result === AccessResult.accessOK) {
          const gs = nodeGiResult.str;
          const data = gs.data();
          if (data) {
            let nodeGi = '';
            for (let i = 0; i < gs.size(); i++) {
              nodeGi += String.fromCharCode(data[i]);
            }
            if (nodeGi.toLowerCase() === giResult.value.toLowerCase()) {
              return interp.makeTrue();
            }
          }
        }
      }
      return interp.makeFalse();
    }

    // List case - match list of GIs against ancestors
    const matchResult: { unmatched: ELObj } = { unmatched: interp.makeNil() };
    if (!matchAncestors(args[0], node, matchResult)) {
      return this.argError(interp, loc, ArgErrorMessages.notAList, 0, args[0]);
    }

    if (matchResult.unmatched.isNil()) {
      return interp.makeTrue();
    }
    return interp.makeFalse();
  }
}

// hierarchical-number-recursive - returns list of child numbers of matching ancestors
// Following upstream DEFPRIMITIVE(HierarchicalNumberRecursive) in primitive.cxx
export class HierarchicalNumberRecursivePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);  // 1 required (gi), 1 optional (node)
  constructor() { super(HierarchicalNumberRecursivePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 1) {
      const nodeRes = args[1].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 1, args[1]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    // Get GI to search for
    const giResult: { value: string } = { value: '' };
    if (!convertGeneralName(args[0], node, giResult)) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    // Walk up the tree, collecting child numbers of matching ancestors
    let result: ELObj = interp.makeNil();
    const current = new NodePtr(node.node());
    while (current.node()!.getParent(current) === AccessResult.accessOK) {
      const nodeGiResult = current.node()!.getGi();
      if (nodeGiResult.result === AccessResult.accessOK) {
        const gs = nodeGiResult.str;
        const data = gs.data();
        if (data) {
          let nodeGi = '';
          for (let i = 0; i < gs.size(); i++) {
            nodeGi += String.fromCharCode(data[i]);
          }
          if (nodeGi.toLowerCase() === giResult.value.toLowerCase()) {
            // Found a matching ancestor - get its child number
            const numRes = interp.childNumber(current);
            if (numRes.result) {
              // Build list in reverse (cons at front)
              const pair = new PairObj(interp.makeInteger(numRes.value + 1), result);
              result = pair;
            }
          }
        }
      }
    }

    return result;
  }
}

// inherited-attribute-string - get attribute value from node or ancestor
// Following upstream DEFPRIMITIVE(InheritedAttributeString) in primitive.cxx
export class InheritedAttributeStringPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);  // 1 required (attr name), 1 optional (node)
  constructor() { super(InheritedAttributeStringPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 1) {
      const nodeRes = args[1].optSingletonNodeList(context, interp);
      if (!nodeRes.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAnOptSingletonNode, 1, args[1]);
      }
      if (!nodeRes.node.node()) {
        return interp.makeFalse();
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    // Get attribute name
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    // Search node and ancestors for the attribute
    const current = new NodePtr(node.node());
    do {
      const value = { str: '' };
      if (nodeAttributeString(current, sd.data, sd.length, interp, value)) {
        // Found the attribute - return its value
        const chars = new Uint32Array(value.str.length);
        for (let i = 0; i < value.str.length; i++) {
          chars[i] = value.str.charCodeAt(i);
        }
        return new StringObj(chars);
      }
    } while (current.node()!.getParent(current) === AccessResult.accessOK);

    return interp.makeFalse();
  }
}

// absolute-first-sibling? - test if node is the first sibling among ALL siblings (not just same GI)
// Following upstream DEFPRIMITIVE(IsAbsoluteFirstSibling) in primitive.cxx
export class IsAbsoluteFirstSiblingPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);
  constructor() { super(IsAbsoluteFirstSiblingPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let nd: NodePtr;
    if (argc > 0) {
      const nodeRes = args[0].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 0, args[0]);
      }
      nd = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      nd = context.currentNode;
    }

    // Get first sibling
    const p = new NodePtr();
    if (nd.node()!.firstSibling(p) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }

    // Check if any earlier sibling is an element (has a GI)
    while (!p.sameNode(nd)) {
      const temResult = p.node()!.getGi();
      if (temResult.result === AccessResult.accessOK) {
        return interp.makeFalse();  // Found an earlier element sibling
      }
      if (p.assignNextChunkSibling() !== AccessResult.accessOK) {
        break;
      }
    }
    return interp.makeTrue();
  }
}

// absolute-last-sibling? - test if node is the last sibling among ALL siblings (not just same GI)
// Following upstream DEFPRIMITIVE(IsAbsoluteLastSibling) in primitive.cxx
export class IsAbsoluteLastSiblingPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);
  constructor() { super(IsAbsoluteLastSiblingPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let nd: NodePtr;
    if (argc > 0) {
      const nodeRes = args[0].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 0, args[0]);
      }
      nd = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      nd = context.currentNode;
    }

    // Check following siblings for any elements
    const ndCopy = new NodePtr(nd.node());
    while (ndCopy.assignNextChunkSibling() === AccessResult.accessOK) {
      const temResult = ndCopy.node()!.getGi();
      if (temResult.result === AccessResult.accessOK) {
        return interp.makeFalse();  // Found a later element sibling
      }
    }
    return interp.makeTrue();
  }
}

// node-list-address - return an address object for a node
// Following upstream DEFPRIMITIVE(NodeListAddress) in primitive.cxx
export class NodeListAddressPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);  // 1 required (node)
  constructor() { super(NodeListAddressPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nodeRes = args[0].optSingletonNodeList(context, interp);
    if (!nodeRes.result || !nodeRes.node.node()) {
      return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 0, args[0]);
    }

    // Return an address object for the resolved node
    return new AddressObj(Address.Type.resolvedNode, nodeRes.node);
  }
}

// string->number - convert a string to a number
// Following upstream DEFPRIMITIVE(StringToNumber) in primitive.cxx
export class StringToNumberPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);  // 1 required (string), 1 optional (radix)
  constructor() { super(StringToNumberPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    let radix = 10;
    if (argc > 1) {
      const rRes = args[1].exactIntegerValue();
      if (!rRes.result) {
        return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 1, args[1]);
      }
      switch (rRes.value) {
        case 2:
        case 8:
        case 10:
        case 16:
          radix = rRes.value;
          break;
        default:
          interp.setNextLocation(loc);
          interp.message(ArgErrorMessages.invalidRadix);
          radix = 10;
          break;
      }
    }

    // Convert string to number
    const str = stringDataToString(sd);
    const num = parseInt(str, radix);
    if (isNaN(num)) {
      // Try parsing as a float
      const floatNum = parseFloat(str);
      if (isNaN(floatNum)) {
        return interp.makeFalse();
      }
      return new RealObj(floatNum);
    }
    return interp.makeInteger(num);
  }
}

// entity-generated-system-id - get an entity's generated system ID
// Following upstream DEFPRIMITIVE(EntityGeneratedSystemId) in primitive.cxx
export class EntityGeneratedSystemIdPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);  // 1 required (entity name), 1 optional (node)
  constructor() { super(EntityGeneratedSystemIdPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    let node: NodePtr;
    if (argc > 1) {
      const nodeRes = args[1].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 1, args[1]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    // Get grove root and entities
    const rootPtr = new NodePtr();
    if (node.node()!.getGroveRoot(rootPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const entitiesResult = rootPtr.node()!.getEntities();
    if (entitiesResult.result !== AccessResult.accessOK || !entitiesResult.entities) {
      return interp.makeFalse();
    }

    // Look up entity by name
    const entityPtr = new NodePtr();
    const nameStr = new GroveString(sd.data!, sd.length);
    if (entitiesResult.entities.namedNode(nameStr, entityPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }

    // Get external ID and generated system ID
    const extIdPtr = new NodePtr();
    if (entityPtr.node()!.getExternalId(extIdPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const gsidResult = extIdPtr.node()!.getGeneratedSystemId();
    if (gsidResult.result !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const gsData = gsidResult.str.data();
    if (!gsData) return interp.makeFalse();
    return new StringObj(gsData);
  }
}

// entity-public-id - get an entity's public ID
// Following upstream DEFPRIMITIVE(EntityPublicId) in primitive.cxx
export class EntityPublicIdPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);  // 1 required (entity name), 1 optional (node)
  constructor() { super(EntityPublicIdPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    let node: NodePtr;
    if (argc > 1) {
      const nodeRes = args[1].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 1, args[1]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    // Get grove root and entities
    const rootPtr = new NodePtr();
    if (node.node()!.getGroveRoot(rootPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const entitiesResult = rootPtr.node()!.getEntities();
    if (entitiesResult.result !== AccessResult.accessOK || !entitiesResult.entities) {
      return interp.makeFalse();
    }

    // Look up entity by name
    const entityPtr = new NodePtr();
    const nameStr = new GroveString(sd.data!, sd.length);
    if (entitiesResult.entities.namedNode(nameStr, entityPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }

    // Get external ID and public ID
    const extIdPtr = new NodePtr();
    if (entityPtr.node()!.getExternalId(extIdPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const pubIdResult = extIdPtr.node()!.getPublicId();
    if (pubIdResult.result !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const pubData = pubIdResult.str.data();
    if (!pubData) return interp.makeFalse();
    return new StringObj(pubData);
  }
}

// entity-notation - get an entity's notation name
// Following upstream DEFPRIMITIVE(EntityNotation) in primitive.cxx
export class EntityNotationPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 1, false);  // 1 required (entity name), 1 optional (node)
  constructor() { super(EntityNotationPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    let node: NodePtr;
    if (argc > 1) {
      const nodeRes = args[1].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 1, args[1]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    // Get grove root and entities
    const rootPtr = new NodePtr();
    if (node.node()!.getGroveRoot(rootPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const entitiesResult = rootPtr.node()!.getEntities();
    if (entitiesResult.result !== AccessResult.accessOK || !entitiesResult.entities) {
      return interp.makeFalse();
    }

    // Look up entity by name
    const entityPtr = new NodePtr();
    const nameStr = new GroveString(sd.data!, sd.length);
    if (entitiesResult.entities.namedNode(nameStr, entityPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }

    // Get notation and its name
    const notationPtr = new NodePtr();
    if (entityPtr.node()!.getNotation(notationPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const nameResult = notationPtr.node()!.getName();
    if (nameResult.result !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const nameData = nameResult.str.data();
    if (!nameData) return interp.makeFalse();
    return new StringObj(nameData);
  }
}

// process-element-with-id - process an element by its ID
// Following upstream DEFPRIMITIVE(ProcessElementWithId) in primitive.cxx
export class ProcessElementWithIdPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);  // 1 required (id string)
  constructor() { super(ProcessElementWithIdPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd = args[0].stringData();
    if (!sd.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }

    if (!context.currentNode) {
      return this.noCurrentNodeError(interp, loc);
    }

    if (!context.processingMode) {
      interp.setNextLocation(loc);
      interp.message(InterpreterMessages.noCurrentProcessingMode);
      return interp.makeError();
    }

    // Get grove root and elements
    const rootPtr = new NodePtr();
    if (context.currentNode.node()!.getGroveRoot(rootPtr) !== AccessResult.accessOK) {
      return new EmptySosofoObj();
    }
    const elementsResult = rootPtr.node()!.getElements();
    if (elementsResult.result !== AccessResult.accessOK || !elementsResult.elements) {
      return new EmptySosofoObj();
    }

    // Look up element by ID
    const elementPtr = new NodePtr();
    const idStr = new GroveString(sd.data!, sd.length);
    if (elementsResult.elements.namedNode(idStr, elementPtr) !== AccessResult.accessOK) {
      return new EmptySosofoObj();
    }

    // Return a ProcessNodeSosofoObj - but we don't have that yet, use ProcessNodeListSosofoObj
    const nl = new NodePtrNodeListObj(elementPtr);
    return new ProcessNodeListSosofoObj(nl, context.processingMode as ProcessingMode);
  }
}

// sgml-parse - stub for SGML parsing (complex - just return empty for now)
// Following upstream DEFPRIMITIVE(SgmlParse) in primitive.cxx
export class SgmlParsePrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, true);  // 1 required (system-id), rest args for options
  constructor() { super(SgmlParsePrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    // SGML parsing is a complex operation that requires a full parser
    // For now, return false to indicate failure
    // A full implementation would parse the document and return a grove
    return interp.makeFalse();
  }
}

// element-number - count elements with same GI up to and including this node
// Following upstream DEFPRIMITIVE(ElementNumber) in primitive.cxx
export class ElementNumberPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);  // 0 required, 1 optional (node)
  constructor() { super(ElementNumberPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    let node: NodePtr;
    if (argc > 0) {
      const nodeRes = args[0].optSingletonNodeList(context, interp);
      if (!nodeRes.result || !nodeRes.node.node()) {
        return this.argError(interp, loc, ArgErrorMessages.notASingletonNode, 0, args[0]);
      }
      node = nodeRes.node;
    } else {
      if (!context.currentNode) {
        return this.noCurrentNodeError(interp, loc);
      }
      node = context.currentNode;
    }

    // Get this node's GI
    const giResult = node.node()!.getGi();
    if (giResult.result !== AccessResult.accessOK) {
      return interp.makeFalse();
    }
    const gi = giResult.str;

    // Count elements with same GI in document order up to this node
    // For simplicity, we traverse from the document root and count
    const rootPtr = new NodePtr();
    if (node.node()!.getGroveRoot(rootPtr) !== AccessResult.accessOK) {
      return interp.makeFalse();
    }

    let count = 0;
    const countElements = (nd: NodePtr): boolean => {
      // Check if this is an element with matching GI
      const ndGiResult = nd.node()!.getGi();
      if (ndGiResult.result === AccessResult.accessOK && ndGiResult.str.equals(gi)) {
        count++;
        if (nd.sameNode(node)) {
          return true; // Found our target node
        }
      }

      // Recursively check children
      const childPtr = new NodePtr();
      if (nd.node()!.firstChild(childPtr) === AccessResult.accessOK) {
        do {
          if (countElements(childPtr)) {
            return true;
          }
        } while (childPtr.assignNextChunkSibling() === AccessResult.accessOK);
      }
      return false;
    };

    // Start counting from root's first child (document element)
    const docElemPtr = new NodePtr();
    if (rootPtr.node()!.firstChild(docElemPtr) === AccessResult.accessOK) {
      do {
        if (countElements(docElemPtr)) {
          break;
        }
      } while (docElemPtr.assignNextChunkSibling() === AccessResult.accessOK);
    }

    return interp.makeInteger(count);
  }
}

// table-unit - create a length spec with table unit factor
// Following upstream DEFPRIMITIVE(TableUnit) in primitive.cxx
export class TableUnitPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);  // 1 required (number)
  constructor() { super(TableUnitPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const kRes = args[0].exactIntegerValue();
    if (!kRes.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAnExactInteger, 0, args[0]);
    }

    // Create a LengthSpec with tableUnit factor
    const spec = new LengthSpec({ unknown: LengthSpec.Unknown.tableUnit, factor: kRes.value });
    return new LengthSpecObj(spec);
  }
}

// next-match - continue processing with next matching rule
// Following upstream DEFPRIMITIVE(NextMatch) in primitive.cxx
export class NextMatchPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(0, 1, false);  // 0 required, 1 optional (style)
  constructor() { super(NextMatchPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    if (!context.processingMode) {
      interp.setNextLocation(loc);
      interp.message(InterpreterMessages.noCurrentProcessingMode);
      return interp.makeError();
    }

    let style: StyleStyleObj | null = null;
    if (argc > 0) {
      const styleObj = args[0].asStyle();
      if (!styleObj) {
        return this.argError(interp, loc, ArgErrorMessages.notAStyle, 0, args[0]);
      }
      // Cast to Style.StyleObj which has the appendIter method
      style = styleObj as StyleStyleObj;
    }

    return new NextMatchSosofoObj(style);
  }
}

// preced - return preceding siblings
// Following upstream DEFPRIMITIVE(Preced) in primitive.cxx
export class PrecedPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);  // 1 required (node or node-list)
  constructor() { super(PrecedPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nodeRes = args[0].optSingletonNodeList(context, interp);
    if (!nodeRes.result) {
      // Could be a node list for mapping, but for now just handle single node
      const nl = args[0].asNodeList();
      if (nl) {
        // For simplicity, just return empty for now
        // Full implementation would use MapNodeListObj
        return interp.makeEmptyNodeList();
      }
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }

    // Get first sibling
    if (!nodeRes.node.node()) {
      return interp.makeEmptyNodeList();
    }

    const first = new NodePtr();
    if (nodeRes.node.node()!.firstSibling(first) !== AccessResult.accessOK) {
      return interp.makeEmptyNodeList();
    }

    // Build a list of preceding siblings
    const nodes: NodePtr[] = [];
    const current = first;
    while (!current.sameNode(nodeRes.node)) {
      nodes.push(new NodePtr(current.node()));
      if (current.assignNextChunkSibling() !== AccessResult.accessOK) {
        break;
      }
    }

    if (nodes.length === 0) {
      return interp.makeEmptyNodeList();
    }

    // Return as a node list using PairNodeListObj
    let result: NodeListObj = new NodePtrNodeListObj(nodes[nodes.length - 1]);
    for (let i = nodes.length - 2; i >= 0; i--) {
      result = new PairNodeListObj(new NodePtrNodeListObj(nodes[i]), result);
    }
    return result;
  }
}

// ============ Map of all primitives ============
export const primitives: Map<string, () => PrimitiveObj> = new Map([
  ['cons', () => new ConsPrimitiveObj()],
  ['list', () => new ListPrimitiveObj()],
  ['null?', () => new IsNullPrimitiveObj()],
  ['list?', () => new IsListPrimitiveObj()],
  ['equal?', () => new IsEqualPrimitiveObj()],
  ['eqv?', () => new IsEqvPrimitiveObj()],
  ['car', () => new CarPrimitiveObj()],
  ['cdr', () => new CdrPrimitiveObj()],
  ['pair?', () => new IsPairPrimitiveObj()],
  ['length', () => new LengthPrimitiveObj()],
  ['append', () => new AppendPrimitiveObj()],
  ['reverse', () => new ReversePrimitiveObj()],
  ['list-tail', () => new ListTailPrimitiveObj()],
  ['list-ref', () => new ListRefPrimitiveObj()],
  ['member', () => new MemberPrimitiveObj()],
  ['memv', () => new MemvPrimitiveObj()],
  ['assoc', () => new AssocPrimitiveObj()],
  ['not', () => new NotPrimitiveObj()],
  ['boolean?', () => new IsBooleanPrimitiveObj()],
  ['symbol?', () => new IsSymbolPrimitiveObj()],
  ['keyword?', () => new IsKeywordPrimitiveObj()],
  ['symbol->string', () => new SymbolToStringPrimitiveObj()],
  ['string->symbol', () => new StringToSymbolPrimitiveObj()],
  ['keyword->string', () => new KeywordToStringPrimitiveObj()],
  ['string->keyword', () => new StringToKeywordPrimitiveObj()],
  ['char?', () => new IsCharPrimitiveObj()],
  ['char=?', () => new IsCharEqualPrimitiveObj()],
  ['char<?', () => new CharLessPrimitiveObj()],
  ['char<=?', () => new CharLessOrEqualPrimitiveObj()],
  ['char>?', () => new CharGreaterPrimitiveObj()],
  ['char>=?', () => new CharGreaterOrEqualPrimitiveObj()],
  ['char-ci=?', () => new CharCiEqualPrimitiveObj()],
  ['char-ci<?', () => new CharCiLessPrimitiveObj()],
  ['char-ci<=?', () => new CharCiLessOrEqualPrimitiveObj()],
  ['char-ci>?', () => new CharCiGreaterPrimitiveObj()],
  ['char-ci>=?', () => new CharCiGreaterOrEqualPrimitiveObj()],
  ['char-upcase', () => new CharUpcasePrimitiveObj()],
  ['char-downcase', () => new CharDowncasePrimitiveObj()],
  ['string', () => new StringPrimitiveObj()],
  ['string?', () => new IsStringPrimitiveObj()],
  ['string-length', () => new StringLengthPrimitiveObj()],
  ['string=?', () => new IsStringEqualPrimitiveObj()],
  ['string-append', () => new StringAppendPrimitiveObj()],
  ['string-ref', () => new StringRefPrimitiveObj()],
  ['substring', () => new SubstringPrimitiveObj()],
  ['string->list', () => new StringToListPrimitiveObj()],
  ['list->string', () => new ListToStringPrimitiveObj()],
  ['integer?', () => new IsIntegerPrimitiveObj()],
  ['real?', () => new IsRealPrimitiveObj()],
  ['number?', () => new IsNumberPrimitiveObj()],
  ['quantity?', () => new IsQuantityPrimitiveObj()],
  ['procedure?', () => new IsProcedurePrimitiveObj()],
  ['=', () => new EqualPrimitiveObj()],
  ['+', () => new PlusPrimitiveObj()],
  ['-', () => new MinusPrimitiveObj()],
  ['*', () => new MultiplyPrimitiveObj()],
  ['/', () => new DividePrimitiveObj()],
  ['quotient', () => new QuotientPrimitiveObj()],
  ['remainder', () => new RemainderPrimitiveObj()],
  ['modulo', () => new ModuloPrimitiveObj()],
  ['<', () => new LessPrimitiveObj()],
  ['>', () => new GreaterPrimitiveObj()],
  ['<=', () => new LessEqualPrimitiveObj()],
  ['>=', () => new GreaterEqualPrimitiveObj()],
  ['min', () => new MinPrimitiveObj()],
  ['max', () => new MaxPrimitiveObj()],
  ['abs', () => new AbsPrimitiveObj()],
  ['floor', () => new FloorPrimitiveObj()],
  ['ceiling', () => new CeilingPrimitiveObj()],
  ['truncate', () => new TruncatePrimitiveObj()],
  ['round', () => new RoundPrimitiveObj()],
  ['sqrt', () => new SqrtPrimitiveObj()],
  ['exp', () => new ExpPrimitiveObj()],
  ['log', () => new LogPrimitiveObj()],
  ['sin', () => new SinPrimitiveObj()],
  ['cos', () => new CosPrimitiveObj()],
  ['tan', () => new TanPrimitiveObj()],
  ['asin', () => new AsinPrimitiveObj()],
  ['acos', () => new AcosPrimitiveObj()],
  ['atan', () => new AtanPrimitiveObj()],
  ['expt', () => new ExptPrimitiveObj()],
  ['exact->inexact', () => new ExactToInexactPrimitiveObj()],
  ['inexact->exact', () => new InexactToExactPrimitiveObj()],
  ['zero?', () => new IsZeroPrimitiveObj()],
  ['positive?', () => new IsPositivePrimitiveObj()],
  ['negative?', () => new IsNegativePrimitiveObj()],
  ['odd?', () => new IsOddPrimitiveObj()],
  ['even?', () => new IsEvenPrimitiveObj()],
  ['exact?', () => new IsExactPrimitiveObj()],
  ['inexact?', () => new IsInexactPrimitiveObj()],
  ['vector?', () => new IsVectorPrimitiveObj()],
  ['vector', () => new VectorPrimitiveObj()],
  ['make-vector', () => new MakeVectorPrimitiveObj()],
  ['vector-ref', () => new VectorRefPrimitiveObj()],
  ['vector-set!', () => new VectorSetPrimitiveObj()],
  ['vector->list', () => new VectorToListPrimitiveObj()],
  ['list->vector', () => new ListToVectorPrimitiveObj()],
  ['sosofo?', () => new IsSosofoPrimitiveObj()],
  ['style?', () => new IsStylePrimitiveObj()],
  ['node-list?', () => new IsNodeListPrimitiveObj()],
  ['node-list-empty?', () => new IsNodeListEmptyPrimitiveObj()],
  ['empty-node-list', () => new EmptyNodeListPrimitiveObj()],
  ['node-list-error', () => new NodeListErrorPrimitiveObj()],
  ['general-name-normalize', () => new GeneralNameNormalizePrimitiveObj()],
  ['node-list-first', () => new NodeListFirstPrimitiveObj()],
  ['node-list-rest', () => new NodeListRestPrimitiveObj()],
  ['node-list-length', () => new NodeListLengthPrimitiveObj()],
  ['node-list-ref', () => new NodeListRefPrimitiveObj()],
  ['node-list', () => new NodeListPrimitiveObj()],
  ['address?', () => new IsAddressPrimitiveObj()],
  ['color?', () => new IsColorPrimitiveObj()],
  ['color-space?', () => new IsColorSpacePrimitiveObj()],
  ['glyph-id?', () => new IsGlyphIdPrimitiveObj()],
  ['language?', () => new IsLanguagePrimitiveObj()],
  ['empty-sosofo', () => new EmptySosofoPrimitiveObj()],
  ['sosofo-append', () => new SosofoAppendPrimitiveObj()],
  ['error', () => new ErrorPrimitiveObj()],
  ['external-procedure', () => new ExternalProcedurePrimitiveObj()],
  ['literal', () => new LiteralPrimitiveObj()],
  ['number->string', () => new NumberToStringPrimitiveObj()],
  ['format-number', () => new FormatNumberPrimitiveObj()],
  ['format-number-list', () => new FormatNumberListPrimitiveObj()],
  ['attribute-string', () => new AttributeStringPrimitiveObj()],
  ['child-number', () => new ChildNumberPrimitiveObj()],
  ['current-node', () => new CurrentNodePrimitiveObj()],
  ['gi', () => new GiPrimitiveObj()],
  ['children', () => new ChildrenPrimitiveObj()],
  ['node-list->list', () => new NodeListToListPrimitiveObj()],
  ['id', () => new IdPrimitiveObj()],
  ['select-elements', () => new SelectElementsPrimitiveObj()],
  // node-list-filter is defined in builtins.dsl, not as a primitive
  ['node-list=?', () => new IsNodeListEqualPrimitiveObj()],
  ['node-list-last', () => new NodeListLastPrimitiveObj()],
  ['element-with-id', () => new ElementWithIdPrimitiveObj()],
  ['node-property', () => new NodePropertyPrimitiveObj()],
  // Process children and process-children-trim
  ['process-children', () => new ProcessChildrenPrimitiveObj()],
  ['process-children-trim', () => new ProcessChildrenTrimPrimitiveObj()],
  ['process-node-list', () => new ProcessNodeListPrimitiveObj()],
  // Node navigation primitives
  ['parent', () => new ParentPrimitiveObj()],
  ['ancestor', () => new AncestorPrimitiveObj()],
  ['first-sibling?', () => new IsFirstSiblingPrimitiveObj()],
  ['last-sibling?', () => new IsLastSiblingPrimitiveObj()],
  ['data', () => new DataPrimitiveObj()],
  ['node-list-reverse', () => new NodeListReversePrimitiveObj()],
  ['node-list-map', () => new NodeListMapPrimitiveObj()],
  ['descendants', () => new DescendantsPrimitiveObj()],
  // Ancestor/hierarchical primitives
  ['have-ancestor?', () => new IsHaveAncestorPrimitiveObj()],
  ['hierarchical-number-recursive', () => new HierarchicalNumberRecursivePrimitiveObj()],
  ['inherited-attribute-string', () => new InheritedAttributeStringPrimitiveObj()],
  // Sibling and address primitives
  ['absolute-first-sibling?', () => new IsAbsoluteFirstSiblingPrimitiveObj()],
  ['absolute-last-sibling?', () => new IsAbsoluteLastSiblingPrimitiveObj()],
  ['node-list-address', () => new NodeListAddressPrimitiveObj()],
  ['preced', () => new PrecedPrimitiveObj()],
  // Number and string conversion
  ['string->number', () => new StringToNumberPrimitiveObj()],
  // Entity primitives
  ['entity-generated-system-id', () => new EntityGeneratedSystemIdPrimitiveObj()],
  ['entity-public-id', () => new EntityPublicIdPrimitiveObj()],
  ['entity-notation', () => new EntityNotationPrimitiveObj()],
  // Processing primitives
  ['process-element-with-id', () => new ProcessElementWithIdPrimitiveObj()],
  ['sgml-parse', () => new SgmlParsePrimitiveObj()],
  // Additional primitives
  ['element-number', () => new ElementNumberPrimitiveObj()],
  ['table-unit', () => new TableUnitPrimitiveObj()],
  ['next-match', () => new NextMatchPrimitiveObj()]
]);
