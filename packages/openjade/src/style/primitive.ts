// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, Char, StringC, String as StringOf } from '@openjade-js/opensp';
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
  FunctionObj,
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
import { AppendSosofoObj, EmptySosofoObj } from './SosofoObj';
import { InterpreterMessages, IdentifierImpl } from './Interpreter';
import { PrimitiveObj, EvalContext, VM, InsnPtr } from './Insn';
import { Interpreter } from './ELObj';
import { NodePtr } from '../grove/Node';

// Signature helper
function sig(nRequired: number, nOptional: number, restArg: boolean): Signature {
  return { nRequiredArgs: nRequired, nOptionalArgs: nOptional, restArg, nKeyArgs: 0, keys: [] };
}

// Error messages for argument errors
const ArgErrorMessages = {
  notAPair: 'notAPair',
  notAList: 'notAList',
  notANumber: 'notANumber',
  notAnExactInteger: 'notAnExactInteger',
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
  divisionByZero: 'divisionByZero'
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
export class IsStringEqualPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(2, 0, false);
  constructor() { super(IsStringEqualPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const sd1 = args[0].stringData();
    if (!sd1.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 0, args[0]);
    }
    const sd2 = args[1].stringData();
    if (!sd2.result) {
      return this.argError(interp, loc, ArgErrorMessages.notAString, 1, args[1]);
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
export class IsNodeListEmptyPrimitiveObj extends PrimitiveObjBase {
  static readonly signature_ = sig(1, 0, false);
  constructor() { super(IsNodeListEmptyPrimitiveObj.signature_); }
  primitiveCall(argc: number, args: ELObj[], context: EvalContext, interp: Interpreter, loc: Location): ELObj {
    const nl = args[0].asNodeList();
    if (!nl) {
      return this.argError(interp, loc, ArgErrorMessages.notANodeList, 0, args[0]);
    }
    const first = nl.nodeListFirst(context, interp);
    return first === null ? interp.makeTrue() : interp.makeFalse();
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
  ['address?', () => new IsAddressPrimitiveObj()],
  ['color?', () => new IsColorPrimitiveObj()],
  ['color-space?', () => new IsColorSpacePrimitiveObj()],
  ['glyph-id?', () => new IsGlyphIdPrimitiveObj()],
  ['language?', () => new IsLanguagePrimitiveObj()],
  ['empty-sosofo', () => new EmptySosofoPrimitiveObj()],
  ['sosofo-append', () => new SosofoAppendPrimitiveObj()],
  ['error', () => new ErrorPrimitiveObj()],
  ['external-procedure', () => new ExternalProcedurePrimitiveObj()]
]);
