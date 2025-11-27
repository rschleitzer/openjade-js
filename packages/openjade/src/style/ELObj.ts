// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Char, Location, StringC } from '@openjade-js/opensp';
import { GroveString, NodePtr } from '../grove/Node';
import { Collector, CollectorObject } from './Collector';
import {
  Symbol as FOTSymbol,
  StyleString,
  GlyphId,
  GlyphSubstTable,
  LengthSpec as FOTLengthSpec,
  TableLengthSpec,
  DisplaySpace,
  InlineSpace,
  Address,
  FOTBuilder
} from './FOTBuilder';

// Import Identifier for local use and re-export for other modules
import { Identifier, SyntacticKey } from './Identifier';
export { Identifier, SyntacticKey };

// Forward declaration for Insn and InsnPtr
export interface Insn {
  execute(vm: unknown): Insn | null;
  isReturn(nArgs: { value: number }): boolean;
  isPopBindings(n: { value: number }, next: { insn: Insn | null }): boolean;
}

export type InsnPtr = Insn | null;

// Forward declaration for VM (defined in Insn.ts)
export interface VM {
  sp: number;
  interp: Interpreter;
  closure: ELObj[] | null;
  protectClosure: ELObj | null;
  frame: number;
  nActualArgs: number;
  closureLoc: Location;
  modeStack: any[];
  processingMode: any;
  overridingStyle: any;
  currentNode: any;
  actualDependencies: any[];
  stkRef(i: number): ELObj;
  stkSet(i: number, obj: ELObj): void;
  stackGet(index: number): ELObj;
  stackSet(index: number, val: ELObj): void;
  needStack(n: number): void;
  push(val: ELObj): void;
  pop(): ELObj;
  top(): ELObj;
  setTop(val: ELObj): void;
  pushFrame(next: Insn | null, argsPushed: number): void;
  popFrame(): Insn | null;
  setClosureArgToCC(): void;
  arg(i: number, sp?: number): ELObj;
  returnFromPrimitive(n: number, obj: ELObj | null): void;
  initStack(): void;
  eval(insn: Insn | null, display?: ELObj[] | null, arg?: ELObj | null): ELObj;
}

// Forward declaration for Interpreter - equivalent to C++ "class Interpreter;"
// Forward declaration for ProcessingMode - implemented in Interpreter.ts
export interface ProcessingModeRef {
  defined(): boolean;
  name(): StringC;
}

// Forward declaration for StyleObj - implemented in Style.ts
export interface StyleObjRef {
  // Style object interface
}

// This interface defines the minimal API needed by other modules.
// The full implementation is in Interpreter.ts
export interface Interpreter {
  // Core methods needed by ELObj and other modules
  setNextLocation(loc: Location): void;
  setNodeLocation(node: NodePtrLike): void;
  message(msgType: string, ...args: unknown[]): void;
  debugMode(): boolean;
  makePermanent(obj: ELObj): void;
  makeReadOnly(obj: ELObj): void;
  makeNil(): ELObj;
  makeFalse(): ELObj;
  makeTrue(): ELObj;
  makeError(): ELObj;
  makePair(car: ELObj, cdr: ELObj): PairObj;
  isError(obj: ELObj): boolean;
  lookup(name: any): any;
  // Additional methods used by primitives
  makeInteger(n: number): ELObj;
  makeReal(n: number): ELObj;
  makeChar(ch: number): ELObj;
  makeSymbol(name: any): ELObj;
  makeKeyword(name: any): ELObj;
  makeString(chars: number[] | any): ELObj;
  makeLength(val: number, dim: number): ELObj;
  makeUnspecified(): ELObj;
  makeEmptyNodeList(): ELObj;
  // Character mapping methods used by SchemeParser
  addStandardChar(name: any, ch: number): void;
  addNameChar(name: any, ch: number): void;
  addSeparatorChar(name: any, ch: number): void;
  addSdataEntity(name: any, text: any, ch: number): void;
  // Processing context methods
  initialStyle(): StyleObjRef | null;
  initialProcessingMode(): ProcessingModeRef;
  charProperty(prop: StringC, c: Char, loc: Location, def: ELObj | null): ELObj;
  // External procedure lookup
  lookupExternalProc(pubid: StringC): FunctionObj | null;
  // Grove utilities
  childNumber(node: any): { result: boolean; value: number };
}

// Forward type for node pointer
interface NodePtrLike {
  toBoolean(): boolean;
}

export class EvalContext {
  // Placeholder - will be fully implemented
}

export class Unit {
  // Placeholder for unit definition
}

// Forward declaration for InheritedC
export interface InheritedC {
  make(val: ELObj, loc: Location, interp: Interpreter): InheritedC | null;
}

// Forward declaration for FlowObj
export interface FlowObj {
  hasNonInheritedC(ident: Identifier): boolean;
  hasPseudoNonInheritedC(ident: Identifier): boolean;
  asCompoundFlowObj(): FlowObj | null;
  copy(interp: Interpreter): FlowObj;
  setNonInheritedC(ident: Identifier, val: ELObj, loc: Location, interp: Interpreter): void;
  isCharacter(): boolean;
}

// Output stream interface for printing
export interface OutputCharStream {
  put(ch: Char): void;
  write(s: string): void;
}

// Quantity type enum
export enum QuantityType {
  noQuantity = 0,
  longQuantity = 1,
  doubleQuantity = 2
}

// Base class for all DSSSL expression language objects
export abstract class ELObj extends CollectorObject {
  constructor() {
    super();
  }

  isNil(): boolean { return false; }
  isList(): boolean { return false; }
  isTrue(): boolean { return true; }

  // Type coercion methods - return null if not the type
  asPair(): PairObj | null { return null; }
  asSymbol(): SymbolObj | null { return null; }
  asKeyword(): KeywordObj | null { return null; }
  asFunction(): FunctionObj | null { return null; }
  asSosofo(): SosofoObj | null { return null; }
  asAppendSosofo(): AppendSosofoObj | null { return null; }
  asColor(): ColorObj | null { return null; }
  asColorSpace(): ColorSpaceObj | null { return null; }
  asStyle(): StyleObj | null { return null; }
  asAddress(): AddressObj | null { return null; }
  asDisplaySpace(): DisplaySpaceObj | null { return null; }
  asInlineSpace(): InlineSpaceObj | null { return null; }
  asGlyphSubstTable(): GlyphSubstTableObj | null { return null; }
  asNodeList(): NodeListObj | null { return null; }
  asNamedNodeList(): NamedNodeListObj | null { return null; }
  convertToString(): StringObj | null { return null; }
  asString(): StringObj | null { return null; }
  asBox(): BoxObj | null { return null; }
  asVector(): VectorObj | null { return null; }
  asLanguage(): LanguageObj | null { return null; }
  asReal(): number | null { return null; }
  asInteger(): number | null { return null; }
  asChar(): Char | null { return null; }

  // Value extraction methods
  charValue(): { result: boolean; ch: Char } {
    return { result: false, ch: 0 };
  }

  stringData(): { result: boolean; data: Uint32Array; length: number } {
    return { result: false, data: new Uint32Array(0), length: 0 };
  }

  print(_interp: Interpreter, _out: OutputCharStream): void {
    // Default print - subclasses override
  }

  printWithRadix(_interp: Interpreter, _out: OutputCharStream, _radix: number): void {
    this.print(_interp, _out);
  }

  exactIntegerValue(): { result: boolean; value: number } {
    return { result: false, value: 0 };
  }

  realValue(): { result: boolean; value: number } {
    return { result: false, value: 0 };
  }

  inexactRealValue(): { result: boolean; value: number } {
    return { result: false, value: 0 };
  }

  lengthValue(): { result: boolean; value: number } {
    return { result: false, value: 0 };
  }

  glyphId(): GlyphId | null {
    return null;
  }

  lengthSpec(): LengthSpec | null {
    return null;
  }

  quantityValue(): { type: QuantityType; longVal: number; doubleVal: number; dim: number } {
    return { type: QuantityType.noQuantity, longVal: 0, doubleVal: 0, dim: 0 };
  }

  resolveQuantities(_force: boolean, _interp: Interpreter, _loc: Location): ELObj {
    return this;
  }

  optSingletonNodeList(_ctx: EvalContext, _interp: Interpreter): { result: boolean; node: NodePtr } {
    return { result: false, node: new NodePtr() };
  }

  // Equality checking
  static equal(obj1: ELObj, obj2: ELObj): boolean {
    return obj1 === obj2 || obj1.isEqual(obj2);
  }

  static eqv(obj1: ELObj, obj2: ELObj): boolean {
    return obj1 === obj2 || obj1.isEquiv(obj2);
  }

  // Protected equality methods - check distinct objects
  protected isEqual(_other: ELObj): boolean {
    return false;
  }

  protected isEquiv(_other: ELObj): boolean {
    return false;
  }
}

// Error object
export class ErrorObj extends ELObj {
  constructor() {
    super();
  }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.write('#<error>');
  }
}

// Unspecified value object
export class UnspecifiedObj extends ELObj {
  constructor() {
    super();
  }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.write('#<unspecified>');
  }
}

// Nil (empty list) object
export class NilObj extends ELObj {
  constructor() {
    super();
  }

  override isNil(): boolean { return true; }
  override isList(): boolean { return true; }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.write('()');
  }
}

// True object
export class TrueObj extends ELObj {
  constructor() {
    super();
  }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.write('#t');
  }
}

// False object
export class FalseObj extends ELObj {
  constructor() {
    super();
  }

  override isTrue(): boolean { return false; }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.write('#f');
  }
}

// Symbol object
export class SymbolObj extends ELObj {
  private name_: StringObj;
  private cValue_: FOTSymbol;

  constructor(name: StringObj) {
    super();
    this.hasSubObjects_ = true;
    this.name_ = name;
    this.cValue_ = FOTSymbol.symbolFalse;
  }

  override asSymbol(): SymbolObj { return this; }

  override convertToString(): StringObj {
    return this.name_;
  }

  name(): StringObj { return this.name_; }

  cValue(): FOTSymbol { return this.cValue_; }
  setCValue(sym: FOTSymbol): void { this.cValue_ = sym; }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.name_);
  }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    const data = this.name_.stringData();
    if (data.result) {
      for (let i = 0; i < data.length; i++) {
        out.put(data.data[i]);
      }
    }
  }

  static key(sym: SymbolObj): StyleString {
    return sym.name_.toStyleString();
  }
}

// Keyword object (like :keyword)
export class KeywordObj extends ELObj {
  private ident_: Identifier;

  constructor(ident: Identifier) {
    super();
    this.ident_ = ident;
  }

  override asKeyword(): KeywordObj { return this; }

  identifier(): Identifier { return this.ident_; }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    const name = this.ident_.name();
    out.put(0x3A); // ':'
    for (let i = 0; i < name.length_; i++) {
      out.put(name.ptr_ ? name.ptr_[i] : 0);
    }
  }

  override isEqual(other: ELObj): boolean {
    const kw = other.asKeyword();
    return kw !== null && this.ident_ === kw.ident_;
  }
}

// Pair (cons cell) object
export class PairObj extends ELObj {
  private car_: ELObj;
  private cdr_: ELObj;

  constructor(car: ELObj, cdr: ELObj) {
    super();
    this.hasSubObjects_ = true;
    this.car_ = car;
    this.cdr_ = cdr;
  }

  car(): ELObj { return this.car_; }
  cdr(): ELObj { return this.cdr_; }
  setCar(car: ELObj): void { this.car_ = car; }
  setCdr(cdr: ELObj): void { this.cdr_ = cdr; }

  override asPair(): PairObj { return this; }
  override isList(): boolean { return true; }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.car_);
    collector.trace(this.cdr_);
  }

  override print(interp: Interpreter, out: OutputCharStream): void {
    out.put(0x28); // '('
    let obj: ELObj = this;
    while (true) {
      const pair = obj.asPair();
      if (!pair) break;
      pair.car_.print(interp, out);
      obj = pair.cdr_;
      if (!obj.isNil()) {
        out.put(0x20); // ' '
        if (!obj.asPair()) {
          out.write('. ');
          obj.print(interp, out);
          break;
        }
      } else {
        break;
      }
    }
    out.put(0x29); // ')'
  }

  override resolveQuantities(force: boolean, interp: Interpreter, loc: Location): ELObj {
    const newCar = this.car_.resolveQuantities(force, interp, loc);
    const newCdr = this.cdr_.resolveQuantities(force, interp, loc);
    if (newCar === this.car_ && newCdr === this.cdr_) {
      return this;
    }
    return new PairObj(newCar, newCdr);
  }

  override isEqual(other: ELObj): boolean {
    const pair = other.asPair();
    if (!pair) return false;
    return ELObj.equal(this.car_, pair.car_) && ELObj.equal(this.cdr_, pair.cdr_);
  }

  override isEquiv(other: ELObj): boolean {
    return this.isEqual(other);
  }
}

// Vector object
export class VectorObj extends ELObj {
  private elements_: ELObj[] = [];

  constructor(elements?: ELObj[]) {
    super();
    this.hasSubObjects_ = true;
    if (elements) {
      this.elements_ = [...elements];
    }
  }

  override asVector(): VectorObj { return this; }

  size(): number { return this.elements_.length; }
  get(index: number): ELObj | undefined { return this.elements_[index]; }
  ref(index: number): ELObj | undefined { return this.elements_[index]; }
  set(index: number, val: ELObj): void { this.elements_[index] = val; }
  push(val: ELObj): void { this.elements_.push(val); }

  override traceSubObjects(collector: Collector): void {
    for (const elem of this.elements_) {
      collector.trace(elem);
    }
  }

  override print(interp: Interpreter, out: OutputCharStream): void {
    out.write('#(');
    for (let i = 0; i < this.elements_.length; i++) {
      if (i > 0) out.put(0x20); // ' '
      this.elements_[i].print(interp, out);
    }
    out.put(0x29); // ')'
  }

  override resolveQuantities(force: boolean, interp: Interpreter, loc: Location): ELObj {
    let changed = false;
    const newElements: ELObj[] = [];
    for (const elem of this.elements_) {
      const resolved = elem.resolveQuantities(force, interp, loc);
      if (resolved !== elem) changed = true;
      newElements.push(resolved);
    }
    if (!changed) return this;
    return new VectorObj(newElements);
  }

  override isEqual(other: ELObj): boolean {
    const vec = other.asVector();
    if (!vec || vec.size() !== this.size()) return false;
    for (let i = 0; i < this.size(); i++) {
      if (!ELObj.equal(this.elements_[i], vec.elements_[i])) return false;
    }
    return true;
  }

  override isEquiv(other: ELObj): boolean {
    const vec = other.asVector();
    if (!vec || vec.size() !== this.size()) return false;
    for (let i = 0; i < this.size(); i++) {
      if (!ELObj.eqv(this.elements_[i], vec.elements_[i])) return false;
    }
    return true;
  }
}

// Character object
export class CharObj extends ELObj {
  private ch_: Char;

  constructor(ch: Char) {
    super();
    this.ch_ = ch;
  }

  ch(): Char { return this.ch_; }

  override charValue(): { result: boolean; ch: Char } {
    return { result: true, ch: this.ch_ };
  }

  override asChar(): Char { return this.ch_; }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.write('#\\');
    // Could add named characters here
    out.put(this.ch_);
  }

  display(_interp: Interpreter, out: OutputCharStream): void {
    out.put(this.ch_);
  }

  override isEqual(other: ELObj): boolean {
    const charRes = other.charValue();
    return charRes.result && charRes.ch === this.ch_;
  }
}

// String object
export class StringObj extends ELObj {
  private data_: Uint32Array;

  constructor(str?: StyleString | Uint32Array | { data: Uint32Array; length: number }) {
    super();
    if (!str) {
      this.data_ = new Uint32Array(0);
    } else if (typeof str === 'string') {
      this.data_ = new Uint32Array(str.length);
      for (let i = 0; i < str.length; i++) {
        this.data_[i] = str.charCodeAt(i);
      }
    } else if (str instanceof Uint32Array) {
      this.data_ = new Uint32Array(str);
    } else {
      this.data_ = new Uint32Array(str.length);
      for (let i = 0; i < str.length; i++) {
        this.data_[i] = str.data[i];
      }
    }
  }

  override convertToString(): StringObj { return this; }
  override asString(): StringObj { return this; }

  override stringData(): { result: boolean; data: Uint32Array; length: number } {
    return { result: true, data: this.data_, length: this.data_.length };
  }

  size(): number { return this.data_.length; }
  at(index: number): Char { return this.data_[index]; }

  toStyleString(): StyleString {
    let result = '';
    for (let i = 0; i < this.data_.length; i++) {
      result += String.fromCharCode(this.data_[i]);
    }
    return result;
  }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.put(0x22); // '"'
    for (let i = 0; i < this.data_.length; i++) {
      const ch = this.data_[i];
      if (ch === 0x22 || ch === 0x5C) { // '"' or '\\'
        out.put(0x5C); // '\\'
      }
      out.put(ch);
    }
    out.put(0x22); // '"'
  }

  override isEqual(other: ELObj): boolean {
    const strData = other.stringData();
    if (!strData.result || strData.length !== this.data_.length) return false;
    for (let i = 0; i < this.data_.length; i++) {
      if (this.data_[i] !== strData.data[i]) return false;
    }
    return true;
  }
}

// Integer object
export class IntegerObj extends ELObj {
  private n_: number;

  constructor(n: number = 0) {
    super();
    this.n_ = Math.trunc(n);
  }

  override exactIntegerValue(): { result: boolean; value: number } {
    return { result: true, value: this.n_ };
  }

  override realValue(): { result: boolean; value: number } {
    return { result: true, value: this.n_ };
  }

  override quantityValue(): { type: QuantityType; longVal: number; doubleVal: number; dim: number } {
    return { type: QuantityType.longQuantity, longVal: this.n_, doubleVal: 0, dim: 0 };
  }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.write(String(this.n_));
  }

  override printWithRadix(_interp: Interpreter, out: OutputCharStream, radix: number): void {
    out.write(this.n_.toString(radix));
  }

  override isEqual(other: ELObj): boolean {
    const intVal = other.exactIntegerValue();
    return intVal.result && intVal.value === this.n_;
  }

  override asInteger(): number { return this.n_; }
  override asReal(): number { return this.n_; }
}

// Real (floating-point) object
export class RealObj extends ELObj {
  private n_: number;

  constructor(n: number) {
    super();
    this.n_ = n;
  }

  override realValue(): { result: boolean; value: number } {
    return { result: true, value: this.n_ };
  }

  override inexactRealValue(): { result: boolean; value: number } {
    return { result: true, value: this.n_ };
  }

  override quantityValue(): { type: QuantityType; longVal: number; doubleVal: number; dim: number } {
    return { type: QuantityType.doubleQuantity, longVal: 0, doubleVal: this.n_, dim: 0 };
  }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.write(String(this.n_));
  }

  override isEqual(other: ELObj): boolean {
    const realVal = other.realValue();
    return realVal.result && realVal.value === this.n_;
  }

  override asReal(): number { return this.n_; }
}

// Length object (in units)
export class LengthObj extends ELObj {
  private n_: number;

  constructor(units: number) {
    super();
    this.n_ = units;
  }

  override lengthValue(): { result: boolean; value: number } {
    return { result: true, value: this.n_ };
  }

  override quantityValue(): { type: QuantityType; longVal: number; doubleVal: number; dim: number } {
    return { type: QuantityType.longQuantity, longVal: this.n_, doubleVal: 0, dim: 1 };
  }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    // Print in points
    const pts = this.n_ / 1000; // Assuming units are millipoints
    out.write(String(pts) + 'pt');
  }

  override isEqual(other: ELObj): boolean {
    const lenVal = other.lengthValue();
    return lenVal.result && lenVal.value === this.n_;
  }
}

// Quantity object (value with dimension)
export class QuantityObj extends ELObj {
  private val_: number;
  private dim_: number;

  constructor(val: number, dim: number) {
    super();
    this.val_ = val;
    this.dim_ = dim;
  }

  override quantityValue(): { type: QuantityType; longVal: number; doubleVal: number; dim: number } {
    return { type: QuantityType.doubleQuantity, longVal: 0, doubleVal: this.val_, dim: this.dim_ };
  }

  override realValue(): { result: boolean; value: number } {
    return { result: true, value: this.val_ };
  }

  override inexactRealValue(): { result: boolean; value: number } {
    return { result: true, value: this.val_ };
  }

  override print(_interp: Interpreter, out: OutputCharStream): void {
    out.write(String(this.val_));
    if (this.dim_ !== 0) {
      out.write('^' + String(this.dim_));
    }
  }

  override isEqual(other: ELObj): boolean {
    const q = other.quantityValue();
    return q.type !== QuantityType.noQuantity &&
           q.doubleVal === this.val_ && q.dim === this.dim_;
  }
}

// Length specification (with display size factor)
export class LengthSpec {
  static readonly Unknown = {
    displaySize: 1,
    tableUnit: 2
  } as const;

  private val_: [number, number, number] = [0, 0, 0];

  constructor(val?: number | { unknown: number; factor: number } | LengthSpec) {
    if (val instanceof LengthSpec) {
      // Copy constructor
      this.val_ = [...val.val_] as [number, number, number];
    } else if (typeof val === 'number') {
      this.val_[0] = val;
    } else if (val) {
      this.val_[val.unknown] = val.factor;
    }
  }

  clone(): LengthSpec {
    return new LengthSpec(this);
  }

  negate(): void {
    for (let i = 0; i < 3; i++) {
      this.val_[i] = -this.val_[i];
    }
  }

  add(other: LengthSpec): void {
    for (let i = 0; i < 3; i++) {
      this.val_[i] += other.val_[i];
    }
  }

  addScalar(d: number): void {
    this.val_[0] += d;
  }

  subtract(other: LengthSpec): void {
    for (let i = 0; i < 3; i++) {
      this.val_[i] -= other.val_[i];
    }
  }

  subtractScalar(d: number): void {
    this.val_[0] -= d;
  }

  multiply(d: number): void {
    for (let i = 0; i < 3; i++) {
      this.val_[i] *= d;
    }
  }

  divide(d: number): void {
    for (let i = 0; i < 3; i++) {
      this.val_[i] /= d;
    }
  }

  convert(): { result: boolean; spec: FOTLengthSpec } {
    if (this.val_[2] !== 0) {
      return { result: false, spec: new FOTLengthSpec() };
    }
    const spec = new FOTLengthSpec(Math.round(this.val_[0]), this.val_[1]);
    return { result: true, spec };
  }

  convertTable(): { result: boolean; spec: TableLengthSpec } {
    const spec = new TableLengthSpec();
    spec.length = Math.round(this.val_[0]);
    spec.displaySizeFactor = this.val_[1];
    spec.tableUnitFactor = this.val_[2];
    return { result: true, spec };
  }
}

// Length spec object
export class LengthSpecObj extends ELObj {
  private lengthSpec_: LengthSpec;

  constructor(spec: LengthSpec) {
    super();
    this.lengthSpec_ = spec;
  }

  override lengthSpec(): LengthSpec {
    return this.lengthSpec_;
  }
}

// Display space object
export class DisplaySpaceObj extends ELObj {
  private displaySpace_: DisplaySpace;

  constructor(space: DisplaySpace) {
    super();
    this.displaySpace_ = space;
  }

  override asDisplaySpace(): DisplaySpaceObj { return this; }

  displaySpace(): DisplaySpace {
    return this.displaySpace_;
  }
}

// Inline space object
export class InlineSpaceObj extends ELObj {
  private inlineSpace_: InlineSpace;

  constructor(space: InlineSpace) {
    super();
    this.inlineSpace_ = space;
  }

  override asInlineSpace(): InlineSpaceObj { return this; }

  inlineSpace(): InlineSpace {
    return this.inlineSpace_;
  }
}

// Unresolved quantity object
export class UnresolvedQuantityObj extends ELObj {
  private val_: number;
  private unit_: Unit;
  private unitExp_: number;

  constructor(val: number, unit: Unit, unitExp: number) {
    super();
    this.val_ = val;
    this.unit_ = unit;
    this.unitExp_ = unitExp;
  }

  override resolveQuantities(_force: boolean, _interp: Interpreter, _loc: Location): ELObj {
    // TODO: Implement unit resolution
    return this;
  }
}

// Unresolved length object
export class UnresolvedLengthObj extends ELObj {
  private val_: number;
  private unit_: Unit;
  private valExp_: number;

  constructor(val: number, valExp: number, unit: Unit) {
    super();
    this.val_ = val;
    this.unit_ = unit;
    this.valExp_ = valExp;
  }

  override resolveQuantities(_force: boolean, _interp: Interpreter, _loc: Location): ELObj {
    // TODO: Implement unit resolution
    return this;
  }
}

// Glyph ID object
export class GlyphIdObj extends ELObj {
  private glyphId_: GlyphId;

  constructor(glyphId: GlyphId) {
    super();
    this.glyphId_ = glyphId;
  }

  override glyphId(): GlyphId {
    return this.glyphId_;
  }

  override isEqual(other: ELObj): boolean {
    const otherId = other.glyphId();
    if (!otherId) return false;
    return this.glyphId_.publicId === otherId.publicId &&
           this.glyphId_.suffix === otherId.suffix;
  }
}

// Glyph substitution table object
export class GlyphSubstTableObj extends ELObj {
  private table_: GlyphSubstTable;

  constructor(table: GlyphSubstTable) {
    super();
    this.table_ = table;
  }

  override asGlyphSubstTable(): GlyphSubstTableObj { return this; }

  glyphSubstTable(): GlyphSubstTable {
    return this.table_;
  }
}

// Address object
export class AddressObj extends ELObj {
  private address_: Address;

  constructor(
    type: number = Address.Type.none,
    node?: NodePtr | null,
    param0?: StyleString,
    param1?: StyleString,
    param2?: StyleString
  ) {
    super();
    this.address_ = new Address(type, node ?? null, param0 ?? '', param1 ?? '', param2 ?? '');
  }

  override asAddress(): AddressObj { return this; }

  address(): Address {
    return this.address_;
  }
}

// Abstract node list object
export abstract class NodeListObj extends ELObj {
  override asNodeList(): NodeListObj { return this; }

  override optSingletonNodeList(ctx: EvalContext, interp: Interpreter): { result: boolean; node: NodePtr } {
    const first = this.nodeListFirst(ctx, interp);
    if (!first.node()) {
      return { result: false, node: new NodePtr() };
    }
    const rest = this.nodeListRest(ctx, interp);
    const restFirst = rest.nodeListFirst(ctx, interp);
    if (restFirst.node()) {
      return { result: false, node: new NodePtr() };
    }
    return { result: true, node: first };
  }

  abstract nodeListFirst(ctx: EvalContext, interp: Interpreter): NodePtr;
  abstract nodeListRest(ctx: EvalContext, interp: Interpreter): NodeListObj;

  nodeListNoOrder(_collector: Collector): NodeListObj {
    return this;
  }

  nodeListChunkRest(ctx: EvalContext, interp: Interpreter): { list: NodeListObj; chunk: boolean } {
    return { list: this.nodeListRest(ctx, interp), chunk: false };
  }

  nodeListRef(_index: number, _ctx: EvalContext, _interp: Interpreter): NodePtr {
    return new NodePtr();
  }

  nodeListReverse(_ctx: EvalContext, _interp: Interpreter): NodeListObj {
    return this; // Default - subclasses can implement reversal
  }

  nodeListLength(_ctx: EvalContext, _interp: Interpreter): number {
    return 0;
  }

  suppressError(): boolean {
    return false;
  }
}

// Abstract named node list object
export abstract class NamedNodeListObj extends NodeListObj {
  override asNamedNodeList(): NamedNodeListObj { return this; }

  abstract namedNode(name: Uint32Array, len: number): NodePtr;
  abstract nodeName(node: NodePtr): { result: boolean; name: GroveString };
  abstract normalize(chars: Uint32Array, len: number): number;
}

// Node pointer node list
export class NodePtrNodeListObj extends NodeListObj {
  private node_: NodePtr;

  constructor(node?: NodePtr) {
    super();
    this.node_ = node ?? new NodePtr();
  }

  override nodeListFirst(_ctx: EvalContext, _interp: Interpreter): NodePtr {
    return this.node_;
  }

  override nodeListRest(_ctx: EvalContext, _interp: Interpreter): NodeListObj {
    return new EmptyNodeListObj();
  }

  override optSingletonNodeList(_ctx: EvalContext, _interp: Interpreter): { result: boolean; node: NodePtr } {
    if (this.node_.node()) {
      return { result: true, node: this.node_ };
    }
    return { result: false, node: new NodePtr() };
  }

  chunkComplete(): boolean {
    return true;
  }
}

// Empty node list object
export class EmptyNodeListObj extends NodeListObj {
  override nodeListFirst(_ctx: EvalContext, _interp: Interpreter): NodePtr {
    return new NodePtr();
  }

  override nodeListRest(_ctx: EvalContext, _interp: Interpreter): NodeListObj {
    return this;
  }
}

// Pair node list object
export class PairNodeListObj extends NodeListObj {
  private head_: NodeListObj | null;
  private tail_: NodeListObj;

  constructor(head: NodeListObj | null, tail: NodeListObj) {
    super();
    this.hasSubObjects_ = true;
    this.head_ = head;
    this.tail_ = tail;
  }

  override nodeListFirst(ctx: EvalContext, interp: Interpreter): NodePtr {
    if (this.head_) {
      return this.head_.nodeListFirst(ctx, interp);
    }
    return this.tail_.nodeListFirst(ctx, interp);
  }

  override nodeListRest(ctx: EvalContext, interp: Interpreter): NodeListObj {
    if (this.head_) {
      const rest = this.head_.nodeListRest(ctx, interp);
      const first = rest.nodeListFirst(ctx, interp);
      if (first.node()) {
        return new PairNodeListObj(rest, this.tail_);
      }
    }
    return this.tail_.nodeListRest(ctx, interp);
  }

  override traceSubObjects(collector: Collector): void {
    if (this.head_) collector.trace(this.head_);
    collector.trace(this.tail_);
  }
}

// Function signature
export interface Signature {
  nRequiredArgs: number;
  nOptionalArgs: number;
  restArg: boolean;
  nKeyArgs: number;
  keys: (Identifier | null)[];
}

// Abstract function object
export abstract class FunctionObj extends ELObj {
  protected sig_: Signature;

  constructor(sig: Signature) {
    super();
    this.sig_ = sig;
  }

  override asFunction(): FunctionObj { return this; }

  signature(): Signature {
    return this.sig_;
  }

  nRequiredArgs(): number {
    return this.sig_.nRequiredArgs;
  }

  nOptionalArgs(): number {
    return this.sig_.nOptionalArgs;
  }

  nKeyArgs(): number {
    return this.sig_.nKeyArgs;
  }

  restArg(): boolean {
    return this.sig_.restArg;
  }

  totalArgs(): number {
    return this.sig_.nRequiredArgs + this.sig_.nOptionalArgs + this.sig_.nKeyArgs + (this.sig_.restArg ? 1 : 0);
  }

  makeCallInsn(_nArgs: number, _interp: Interpreter, _loc: Location, next: InsnPtr): InsnPtr {
    return next;
  }

  makeTailCallInsn(_nArgs: number, _interp: Interpreter, _loc: Location, _nCallerArgs: number): InsnPtr {
    return null;
  }

  // Call the function with arguments on the VM stack
  // Override in subclasses - base implementation returns null
  call(_vm: VM, _loc: Location, _next: InsnPtr): InsnPtr {
    return null;
  }

  // Tail call the function with arguments on the VM stack
  // Override in subclasses - base implementation returns null
  tailCall(_vm: VM, _loc: Location, _nCallerArgs: number): InsnPtr {
    return null;
  }

  // Set an argument position to a continuation
  setArgToCC(_vm: VM): void {
    // Override in subclasses that support continuations
  }
}

// Abstract SOSOFO object - stub for type compatibility
// Real implementation is in SosofoObj.ts
export abstract class SosofoObj extends ELObj {
  override asSosofo(): SosofoObj { return this; }
  abstract process(context: any): void;
  tableBorderStyle(_style: { obj: StyleObj | null }): boolean { return false; }
  ruleStyle(_context: any, _style: { obj: StyleObj | null }): boolean { return false; }
  isRule(): boolean { return false; }
  characterStyle(_context: any, _style: { obj: StyleObj | null }, _nic: any): boolean { return false; }
  isCharacter(): boolean { return false; }
}

// Append SOSOFO object - stub for type compatibility
export class AppendSosofoObj extends SosofoObj {
  override asAppendSosofo(): AppendSosofoObj { return this; }
  process(_context: any): void { }
  append(_obj: SosofoObj): void { }
}

// Abstract color object
export abstract class ColorObj extends ELObj {
  override asColor(): ColorObj { return this; }
  abstract set(fotb: FOTBuilder): void;
  abstract setBackground(fotb: FOTBuilder): void;
}

// Abstract color space object
export abstract class ColorSpaceObj extends ELObj {
  override asColorSpace(): ColorSpaceObj { return this; }
}

// Abstract style object
export abstract class StyleObj extends ELObj {
  override asStyle(): StyleObj { return this; }
}

// Abstract box object
export abstract class BoxObj extends ELObj {
  override asBox(): BoxObj { return this; }
  abstract get value(): ELObj | null;
  abstract set value(obj: ELObj | null);
}

// Mutable box object - holds a mutable reference to an ELObj
export class MutableBoxObj extends BoxObj {
  private value_: ELObj | null;

  constructor(obj?: ELObj | null) {
    super();
    this.hasSubObjects_ = true;
    this.value_ = obj ?? null;
  }

  override get value(): ELObj | null {
    return this.value_;
  }

  override set value(obj: ELObj | null) {
    this.value_ = obj;
  }

  override traceSubObjects(collector: Collector): void {
    if (this.value_) collector.trace(this.value_);
  }
}

// Abstract language object
export abstract class LanguageObj extends ELObj {
  override asLanguage(): LanguageObj { return this; }
}

// Dynamic root for protecting objects during evaluation
export class ELObjDynamicRoot {
  private obj_: ELObj | null;
  private interp_: Interpreter;

  constructor(interp: Interpreter, obj: ELObj | null = null) {
    this.interp_ = interp;
    this.obj_ = obj;
  }

  set(obj: ELObj | null): void {
    this.obj_ = obj;
  }

  get(): ELObj | null {
    return this.obj_;
  }
}

// Concrete language object with collation support
export class LangObj extends LanguageObj {
  private multiCollatingElements_: Map<string, string> = new Map();
  private collatingSymbols_: Set<string> = new Set();
  private levels_: Array<{ forward: boolean; backward: boolean; position: boolean }> = [];
  private collatingOrder_: string[] = [];
  private levelWeights_: Map<number, string[]> = new Map();
  private toupperMap_: Map<number, number> = new Map();
  private tolowerMap_: Map<number, number> = new Map();
  private hasDefaultPos_ = false;

  constructor() {
    super();
  }

  addMultiCollatingElement(sym: string, str: string): void {
    this.multiCollatingElements_.set(sym, str);
  }

  addCollatingSymbol(sym: string): void {
    this.collatingSymbols_.add(sym);
  }

  addLevel(sort: { forward: boolean; backward: boolean; position: boolean }): void {
    this.levels_.push({ ...sort });
    this.levelWeights_.set(this.levels_.length - 1, []);
  }

  levels(): number {
    return this.levels_.length;
  }

  addCollatingPos(sym: string): boolean {
    this.collatingOrder_.push(sym);
    return true;
  }

  addDefaultPos(): void {
    this.hasDefaultPos_ = true;
  }

  addLevelWeight(level: number, weight: string): boolean {
    const weights = this.levelWeights_.get(level);
    if (weights) {
      weights.push(weight);
      return true;
    }
    return false;
  }

  addToupper(lower: number, upper: number): void {
    this.toupperMap_.set(lower, upper);
  }

  addTolower(upper: number, lower: number): void {
    this.tolowerMap_.set(upper, lower);
  }

  compile(): boolean {
    // Validate and compile the language definition
    return true;
  }

  toupper(ch: number): number {
    return this.toupperMap_.get(ch) ?? ch;
  }

  tolower(ch: number): number {
    return this.tolowerMap_.get(ch) ?? ch;
  }
}
