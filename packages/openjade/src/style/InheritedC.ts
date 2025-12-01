// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, StringC, Char } from '@openjade-js/opensp';
import { ELObj, IntegerObj, StringObj, LengthObj, LengthSpecObj, SymbolObj, LengthSpec, ColorObj } from './ELObj';
import { VM } from './Insn';
import { InheritedC, VarStyleObj } from './Style';
import { FOTBuilder, Symbol, Length, LengthSpec as FOTLengthSpec, OptLengthSpec as FOTOptLengthSpec, DeviceRGBColor, Letter2 } from './FOTBuilder';
import { Identifier, SyntacticKey } from './Identifier';
import type { Interpreter } from './Interpreter';

// Helper function to convert StringObj to JavaScript string
function stringObjToString(strObj: StringObj): string {
  const data = strObj.stringData();
  if (!data.result) return '';
  // Use loop instead of spread to avoid stack overflow with large strings
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.data[i]);
  }
  return result;
}

// Helper to convert Uint32Array to JS string without spread operator
function uint32ArrayToString(data: Uint32Array, length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(data[i]);
  }
  return result;
}

// Boolean inherited characteristic
export class BoolInheritedC extends InheritedC {
  protected value_: boolean;

  constructor(ident: Identifier | null, index: number, value: boolean) {
    super(ident, index);
    this.value_ = value;
  }

  value(vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    if (this.value_) {
      return vm.interp.makeTrue();
    } else {
      return vm.interp.makeFalse();
    }
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    // Subclasses should override to set FOTBuilder properties
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    // For booleans, isTrue() returns true for TrueObj and false for FalseObj
    // All ELObj have isTrue() - TrueObj returns true, FalseObj returns false
    return new BoolInheritedC(this.identifier(), this.index(), obj.isTrue());
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// Integer inherited characteristic
export class IntegerInheritedC extends InheritedC {
  protected n_: number;

  constructor(ident: Identifier | null, index: number, n: number) {
    super(ident, index);
    this.n_ = n;
  }

  value(vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    return vm.interp.makeInteger(this.n_);
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    _fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const n = obj.asInteger();
    if (n !== null) {
      return new IntegerInheritedC(this.identifier(), this.index(), n);
    }
    this.invalidValue(loc, interp);
    return null;
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// Length inherited characteristic
export class LengthInheritedC extends InheritedC {
  protected size_: Length;

  constructor(ident: Identifier | null, index: number, size: Length) {
    super(ident, index);
    this.size_ = size;
  }

  value(vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    return vm.interp.makeLength(this.size_, 1);
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    _fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const q = obj.quantityValue();
    if (q.type !== 0 && q.dim === 1) {
      const length = q.type === 1 ? q.longVal : Math.trunc(q.doubleVal);
      return new LengthInheritedC(this.identifier(), this.index(), length);
    }
    this.invalidValue(loc, interp);
    return null;
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// Symbol inherited characteristic
export class SymbolInheritedC extends InheritedC {
  protected sym_: Symbol;

  constructor(ident: Identifier | null, index: number, sym: Symbol) {
    super(ident, index);
    this.sym_ = sym;
  }

  value(vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    // Return the symbol value
    return vm.interp.makeSymbol(this.sym_);
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    _fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const sym = obj.asSymbol();
    if (sym) {
      // TODO: Convert symbol to FOTBuilder.Symbol
      return new SymbolInheritedC(this.identifier(), this.index(), this.sym_);
    }
    this.invalidValue(loc, interp);
    return null;
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// Length spec inherited characteristic
export class LengthSpecInheritedC extends InheritedC {
  protected spec_: LengthSpec;

  constructor(ident: Identifier | null, index: number, spec?: LengthSpec) {
    super(ident, index);
    this.spec_ = spec ?? new LengthSpec();
  }

  // Getter for subclasses to access spec_
  getSpec(): LengthSpec {
    return this.spec_;
  }

  value(vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    return new LengthSpecObj(this.spec_);
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    _fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    // Don't report error for ErrorObj - error was already reported elsewhere
    if (interp.isError(obj)) {
      return null;
    }
    const lengthSpec = obj.lengthSpec();
    if (lengthSpec) {
      return new LengthSpecInheritedC(this.identifier(), this.index(), lengthSpec.clone());
    }
    // Also accept plain lengths
    const q = obj.quantityValue();
    if (q.type !== 0 && q.dim === 1) {
      const spec = new LengthSpec();
      spec.addScalar(q.type === 1 ? q.longVal : Math.round(q.doubleVal));
      return new LengthSpecInheritedC(this.identifier(), this.index(), spec);
    }
    this.invalidValue(loc, interp);
    return null;
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// String inherited characteristic
export class StringInheritedC extends InheritedC {
  protected str_: string;

  constructor(ident: Identifier | null, index: number, str: string = '') {
    super(ident, index);
    this.str_ = str;
  }

  value(vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    return vm.interp.makeString(this.str_);
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    _fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const strData = obj.stringData();
    if (strData.result) {
      const str = uint32ArrayToString(strData.data, strData.length);
      return new StringInheritedC(this.identifier(), this.index(), str);
    }
    this.invalidValue(loc, interp);
    return null;
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// Font size inherited characteristic
export class FontSizeC extends LengthInheritedC {
  constructor(ident: Identifier | null, index: number, size: Length = 10 * 72000) {
    super(ident, index, size);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    fotb.setFontSize(this.size_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const q = obj.quantityValue();
    if (q.type !== 0 && q.dim === 1) {
      const length = q.type === 1 ? q.longVal : Math.trunc(q.doubleVal);
      return new FontSizeC(this.identifier(), this.index(), length);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Font family name inherited characteristic
export class FontFamilyNameC extends StringInheritedC {
  constructor(ident: Identifier | null, index: number, name: string = '') {
    super(ident, index, name);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    fotb.setFontFamilyName(this.str_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const strData = obj.stringData();
    if (strData.result) {
      const str = uint32ArrayToString(strData.data, strData.length);
      return new FontFamilyNameC(this.identifier(), this.index(), str);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Color inherited characteristic
export class ColorC extends InheritedC {
  private color_: ColorObj | null;

  constructor(ident: Identifier | null, index: number, color: ColorObj | null = null) {
    super(ident, index);
    this.color_ = color;
  }

  value(_vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    return this.color_;
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    if (this.color_) {
      this.color_.set(fotb);
    }
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const color = obj.asColor();
    if (color) {
      return new ColorC(this.identifier(), this.index(), color);
    }
    // Check for #f (false) meaning no color
    if (!obj.isTrue()) {
      return new ColorC(this.identifier(), this.index(), null);
    }
    this.invalidValue(loc, interp);
    return null;
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// Background color inherited characteristic
export class BackgroundColorC extends InheritedC {
  private color_: ColorObj | null;

  constructor(ident: Identifier | null, index: number, color: ColorObj | null = null) {
    super(ident, index);
    this.color_ = color;
  }

  value(_vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    return this.color_;
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    if (this.color_) {
      this.color_.setBackground(fotb);
    }
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const color = obj.asColor();
    if (color) {
      return new BackgroundColorC(this.identifier(), this.index(), color);
    }
    // Check for #f (false) meaning no background color
    if (!obj.isTrue()) {
      return new BackgroundColorC(this.identifier(), this.index(), null);
    }
    this.invalidValue(loc, interp);
    return null;
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// Start indent inherited characteristic
export class StartIndentC extends LengthSpecInheritedC {
  constructor(ident: Identifier | null, index: number, spec?: LengthSpec) {
    super(ident, index, spec);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    const converted = this.spec_.convert();
    if (converted.result) {
      fotb.setStartIndent(converted.spec);
    }
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const result = super.make(obj, loc, interp) as LengthSpecInheritedC | null;
    if (result) {
      return new StartIndentC(this.identifier(), this.index(), result.getSpec());
    }
    return null;
  }
}

// End indent inherited characteristic
export class EndIndentC extends LengthSpecInheritedC {
  constructor(ident: Identifier | null, index: number, spec?: LengthSpec) {
    super(ident, index, spec);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    const converted = this.spec_.convert();
    if (converted.result) {
      fotb.setEndIndent(converted.spec);
    }
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const result = super.make(obj, loc, interp) as LengthSpecInheritedC | null;
    if (result) {
      return new EndIndentC(this.identifier(), this.index(), result.getSpec());
    }
    return null;
  }
}

// First line start indent inherited characteristic
export class FirstLineStartIndentC extends LengthSpecInheritedC {
  constructor(ident: Identifier | null, index: number, spec?: LengthSpec) {
    super(ident, index, spec);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    const converted = this.spec_.convert();
    if (converted.result) {
      fotb.setFirstLineStartIndent(converted.spec);
    }
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const result = super.make(obj, loc, interp) as LengthSpecInheritedC | null;
    if (result) {
      return new FirstLineStartIndentC(this.identifier(), this.index(), result.getSpec());
    }
    return null;
  }
}

// Line spacing inherited characteristic
export class LineSpacingC extends LengthSpecInheritedC {
  constructor(ident: Identifier | null, index: number, spec?: LengthSpec) {
    super(ident, index, spec);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    const converted = this.spec_.convert();
    if (converted.result) {
      fotb.setLineSpacing(converted.spec);
    }
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const result = super.make(obj, loc, interp) as LengthSpecInheritedC | null;
    if (result) {
      return new LineSpacingC(this.identifier(), this.index(), result.getSpec());
    }
    return null;
  }
}

// Field width inherited characteristic
export class FieldWidthC extends LengthSpecInheritedC {
  constructor(ident: Identifier | null, index: number, spec?: LengthSpec) {
    super(ident, index, spec);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    const converted = this.spec_.convert();
    if (converted.result) {
      fotb.setFieldWidth(converted.spec);
    }
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const result = super.make(obj, loc, interp) as LengthSpecInheritedC | null;
    if (result) {
      return new FieldWidthC(this.identifier(), this.index(), result.getSpec());
    }
    return null;
  }
}

// Quadding inherited characteristic
export class QuaddingC extends SymbolInheritedC {
  constructor(ident: Identifier | null, index: number, sym: Symbol = Symbol.symbolStart) {
    super(ident, index, sym);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    fotb.setQuadding(this.sym_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const sym = obj.asSymbol();
    if (sym) {
      // Map symbol name to FOTBuilder.Symbol
      const name = stringObjToString(sym.name());
      let fotSym = Symbol.symbolStart;
      if (name === 'start') fotSym = Symbol.symbolStart;
      else if (name === 'end') fotSym = Symbol.symbolEnd;
      else if (name === 'center') fotSym = Symbol.symbolCenter;
      else if (name === 'justify') fotSym = Symbol.symbolJustify;
      return new QuaddingC(this.identifier(), this.index(), fotSym);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Display alignment inherited characteristic
export class DisplayAlignmentC extends SymbolInheritedC {
  constructor(ident: Identifier | null, index: number, sym: Symbol = Symbol.symbolStart) {
    super(ident, index, sym);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    fotb.setDisplayAlignment(this.sym_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const sym = obj.asSymbol();
    if (sym) {
      const name = stringObjToString(sym.name());
      let fotSym = Symbol.symbolStart;
      if (name === 'start') fotSym = Symbol.symbolStart;
      else if (name === 'end') fotSym = Symbol.symbolEnd;
      else if (name === 'center') fotSym = Symbol.symbolCenter;
      return new DisplayAlignmentC(this.identifier(), this.index(), fotSym);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Font weight inherited characteristic
export class FontWeightC extends SymbolInheritedC {
  constructor(ident: Identifier | null, index: number, sym: Symbol = Symbol.symbolMedium) {
    super(ident, index, sym);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    fotb.setFontWeight(this.sym_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const sym = obj.asSymbol();
    if (sym) {
      const name = stringObjToString(sym.name());
      let fotSym = Symbol.symbolMedium;
      if (name === 'ultra-light') fotSym = Symbol.symbolUltraLight;
      else if (name === 'extra-light') fotSym = Symbol.symbolExtraLight;
      else if (name === 'light') fotSym = Symbol.symbolLight;
      else if (name === 'semi-light') fotSym = Symbol.symbolSemiLight;
      else if (name === 'medium') fotSym = Symbol.symbolMedium;
      else if (name === 'semi-bold') fotSym = Symbol.symbolSemiBold;
      else if (name === 'bold') fotSym = Symbol.symbolBold;
      else if (name === 'extra-bold') fotSym = Symbol.symbolExtraBold;
      else if (name === 'ultra-bold') fotSym = Symbol.symbolUltraBold;
      return new FontWeightC(this.identifier(), this.index(), fotSym);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Font posture inherited characteristic
export class FontPostureC extends SymbolInheritedC {
  constructor(ident: Identifier | null, index: number, sym: Symbol = Symbol.symbolUpright) {
    super(ident, index, sym);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    fotb.setFontPosture(this.sym_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const sym = obj.asSymbol();
    if (sym) {
      const name = stringObjToString(sym.name());
      let fotSym = Symbol.symbolUpright;
      if (name === 'upright') fotSym = Symbol.symbolUpright;
      else if (name === 'italic') fotSym = Symbol.symbolItalic;
      else if (name === 'oblique') fotSym = Symbol.symbolOblique;
      return new FontPostureC(this.identifier(), this.index(), fotSym);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Lines inherited characteristic (for underline/overline/etc)
export class LinesC extends SymbolInheritedC {
  constructor(ident: Identifier | null, index: number, sym: Symbol = Symbol.symbolFalse) {
    super(ident, index, sym);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    fotb.setLines(this.sym_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    // Check for #f (false) first
    if (!obj.isTrue() && !obj.asSymbol()) {
      return new LinesC(this.identifier(), this.index(), Symbol.symbolFalse);
    }
    const sym = obj.asSymbol();
    if (sym) {
      const name = stringObjToString(sym.name());
      let fotSym = Symbol.symbolFalse;
      if (name === 'wrap') fotSym = Symbol.symbolWrap;
      else if (name === 'asis') fotSym = Symbol.symbolAsis;
      else if (name === 'asis-wrap') fotSym = Symbol.symbolAsisWrap;
      else if (name === 'asis-truncate') fotSym = Symbol.symbolAsisTruncate;
      else if (name === 'none') fotSym = Symbol.symbolNone;
      return new LinesC(this.identifier(), this.index(), fotSym);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Writing mode inherited characteristic
export class WritingModeC extends SymbolInheritedC {
  constructor(ident: Identifier | null, index: number, sym: Symbol = Symbol.symbolLeftToRight) {
    super(ident, index, sym);
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    fotb.setWritingMode(this.sym_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const sym = obj.asSymbol();
    if (sym) {
      const name = stringObjToString(sym.name());
      let fotSym = Symbol.symbolLeftToRight;
      if (name === 'left-to-right') fotSym = Symbol.symbolLeftToRight;
      else if (name === 'right-to-left') fotSym = Symbol.symbolRightToLeft;
      else if (name === 'top-to-bottom') fotSym = Symbol.symbolTopToBottom;
      else if (name === 'bottom-to-top') fotSym = Symbol.symbolBottomToTop;
      return new WritingModeC(this.identifier(), this.index(), fotSym);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Ignored inherited characteristic - accepts any value but does nothing
export class IgnoredInheritedC extends InheritedC {
  constructor(ident: Identifier | null, index: number) {
    super(ident, index);
  }

  value(vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    return vm.interp.makeFalse();  // Return default value
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    _fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    // Ignored - do nothing
    value.obj = null;
  }

  make(obj: ELObj, _loc: Location, _interp: Interpreter): InheritedC | null {
    // Accept any value, create new ignored characteristic
    return new IgnoredInheritedC(this.identifier(), this.index());
  }
}

// Generic boolean inherited characteristic - uses setter callback
export type BoolSetter = (fotb: FOTBuilder, value: boolean) => void;

export class GenericBoolInheritedC extends BoolInheritedC {
  private setter_: BoolSetter;

  constructor(ident: Identifier | null, index: number, setter: BoolSetter, defaultValue: boolean = false) {
    super(ident, index, defaultValue);
    this.setter_ = setter;
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    this.setter_(fotb, this.value_);
    value.obj = null;
  }

  override make(obj: ELObj, _loc: Location, _interp: Interpreter): InheritedC | null {
    return new GenericBoolInheritedC(this.identifier(), this.index(), this.setter_, obj.isTrue());
  }
}

// Generic length inherited characteristic - uses setter callback
export type LengthSetter = (fotb: FOTBuilder, value: Length) => void;

export class GenericLengthInheritedC extends LengthInheritedC {
  private setter_: LengthSetter;

  constructor(ident: Identifier | null, index: number, setter: LengthSetter, defaultValue: Length = 0) {
    super(ident, index, defaultValue);
    this.setter_ = setter;
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    this.setter_(fotb, this.size_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const q = obj.quantityValue();
    if (q.type !== 0 && q.dim === 1) {
      const length = q.type === 1 ? q.longVal : Math.trunc(q.doubleVal);
      return new GenericLengthInheritedC(this.identifier(), this.index(), this.setter_, length);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Generic length spec inherited characteristic - uses setter callback
export type LengthSpecSetter = (fotb: FOTBuilder, value: FOTLengthSpec) => void;

export class GenericLengthSpecInheritedC extends LengthSpecInheritedC {
  private setter_: LengthSpecSetter;

  constructor(ident: Identifier | null, index: number, setter: LengthSpecSetter, defaultSpec?: LengthSpec) {
    super(ident, index, defaultSpec);
    this.setter_ = setter;
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    // Convert ELObj LengthSpec to FOTBuilder LengthSpec
    const converted = this.spec_.convert();
    if (converted.result) {
      this.setter_(fotb, converted.spec);
    }
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    // Don't report error for ErrorObj - error was already reported elsewhere
    if (interp.isError(obj)) {
      return null;
    }
    const lengthSpec = obj.lengthSpec();
    if (lengthSpec) {
      return new GenericLengthSpecInheritedC(this.identifier(), this.index(), this.setter_, lengthSpec.clone());
    }
    // Also accept plain lengths
    const q = obj.quantityValue();
    if (q.type !== 0 && q.dim === 1) {
      const spec = new LengthSpec();
      spec.addScalar(q.type === 1 ? q.longVal : Math.round(q.doubleVal));
      return new GenericLengthSpecInheritedC(this.identifier(), this.index(), this.setter_, spec);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Generic optional length spec inherited characteristic - uses setter callback
// This is for characteristics that can be #f (no value) or a length-spec
export type OptLengthSpecSetter = (fotb: FOTBuilder, value: FOTOptLengthSpec) => void;

export class GenericOptLengthSpecInheritedC extends InheritedC {
  private setter_: OptLengthSpecSetter;
  private value_: FOTOptLengthSpec;

  constructor(ident: Identifier | null, index: number, setter: OptLengthSpecSetter) {
    super(ident, index);
    this.setter_ = setter;
    this.value_ = new FOTOptLengthSpec();
  }

  value(vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    if (!this.value_.hasLength) {
      return vm.interp.makeFalse();
    }
    // Return a LengthSpecObj - need to convert from FOT LengthSpec to ELObj LengthSpec
    const spec = new LengthSpec();
    spec.addScalar(this.value_.length.length);
    return new LengthSpecObj(spec);
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    this.setter_(fotb, this.value_);
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const copy = new GenericOptLengthSpecInheritedC(this.identifier(), this.index(), this.setter_);

    // Check for #f (false) - means no length
    if (!obj.isTrue()) {
      copy.value_.hasLength = false;
      return copy;
    }

    // Try to get length spec
    const lengthSpec = obj.lengthSpec();
    if (lengthSpec) {
      const converted = lengthSpec.convert();
      if (converted.result) {
        copy.value_.hasLength = true;
        copy.value_.length = converted.spec;
        return copy;
      }
    }

    // Also accept plain lengths
    const q = obj.quantityValue();
    if (q.type !== 0 && q.dim === 1) {
      copy.value_.hasLength = true;
      copy.value_.length.length = q.type === 1 ? q.longVal : Math.round(q.doubleVal);
      return copy;
    }

    this.invalidValue(loc, interp);
    return null;
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// Generic symbol inherited characteristic - uses setter callback
export type SymbolSetter = (fotb: FOTBuilder, value: Symbol) => void;

export class GenericSymbolInheritedC extends SymbolInheritedC {
  private setter_: SymbolSetter;

  constructor(ident: Identifier | null, index: number, setter: SymbolSetter, defaultValue: Symbol = Symbol.symbolFalse) {
    super(ident, index, defaultValue);
    this.setter_ = setter;
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    this.setter_(fotb, this.sym_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    // Handle boolean false
    if (obj === interp.makeFalse()) {
      return new GenericSymbolInheritedC(this.identifier(), this.index(), this.setter_, Symbol.symbolFalse);
    }
    // Handle symbol
    const symObj = obj.asSymbol();
    if (symObj) {
      const fotSym = symObj.cValue();
      if (fotSym !== Symbol.symbolFalse) {
        return new GenericSymbolInheritedC(this.identifier(), this.index(), this.setter_, fotSym);
      }
    }
    // Handle boolean true
    if (obj === interp.makeTrue()) {
      return new GenericSymbolInheritedC(this.identifier(), this.index(), this.setter_, Symbol.symbolTrue);
    }
    this.invalidValue(loc, interp);
    return null;
  }
}

// Letter2 inherited characteristic (2-letter language/country code)
export class Letter2InheritedC extends InheritedC {
  protected code_: Letter2;

  constructor(ident: Identifier | null, index: number, code: Letter2 = 0) {
    super(ident, index);
    this.code_ = code;
  }

  value(vm: VM, _style: VarStyleObj | null, _dependencies: number[]): ELObj | null {
    if (this.code_) {
      // Convert Letter2 back to 2-character string
      const char1 = String.fromCharCode((this.code_ >> 8) & 0xff);
      const char2 = String.fromCharCode(this.code_ & 0xff);
      return vm.interp.makeString(char1 + char2);
    }
    return vm.interp.makeFalse();
  }

  set(
    _vm: VM,
    _style: VarStyleObj | null,
    _fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    value.obj = null;
  }

  make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const code = this.convertLetter2(obj, loc, interp);
    if (code !== null) {
      return new Letter2InheritedC(this.identifier(), this.index(), code);
    }
    return null;
  }

  // Convert ELObj to Letter2 code
  protected convertLetter2(obj: ELObj, loc: Location, interp: Interpreter): Letter2 | null {
    const strObj = obj.convertToString();
    if (strObj) {
      const data = strObj.stringData();
      if (data.length === 2 &&
          data.data[0] >= 0x41 && data.data[0] <= 0x5A &&  // A-Z
          data.data[1] >= 0x41 && data.data[1] <= 0x5A) {  // A-Z
        return (data.data[0] << 8) | data.data[1];
      }
      if (data.length === 0) {
        return 0;
      }
    }
    if (obj === interp.makeFalse()) {
      return 0;
    }
    this.invalidValue(loc, interp);
    return null;
  }

  protected invalidValue(loc: Location, interp: Interpreter): void {
    interp.setNextLocation(loc);
    interp.message('invalidCharacteristicValue', this.identifier()?.name());
  }
}

// Generic Letter2 inherited characteristic - uses setter callback
export type Letter2Setter = (fotb: FOTBuilder, value: Letter2) => void;

export class GenericLetter2InheritedC extends Letter2InheritedC {
  private setter_: Letter2Setter;

  constructor(ident: Identifier | null, index: number, setter: Letter2Setter, defaultValue: Letter2 = 0) {
    super(ident, index, defaultValue);
    this.setter_ = setter;
  }

  override set(
    _vm: VM,
    _style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    _dependencies: number[]
  ): void {
    this.setter_(fotb, this.code_);
    value.obj = null;
  }

  override make(obj: ELObj, loc: Location, interp: Interpreter): InheritedC | null {
    const code = this.convertLetter2(obj, loc, interp);
    if (code !== null) {
      return new GenericLetter2InheritedC(this.identifier(), this.index(), this.setter_, code);
    }
    return null;
  }
}

// Factory to create inherited characteristics by name
export function createInheritedC(name: string, index: number, ident: Identifier | null): InheritedC | null {
  switch (name) {
    case 'font-size':
      return new FontSizeC(ident, index);
    case 'font-family-name':
      return new FontFamilyNameC(ident, index);
    case 'font-weight':
      return new FontWeightC(ident, index);
    case 'font-posture':
      return new FontPostureC(ident, index);
    case 'start-indent':
      return new StartIndentC(ident, index);
    case 'end-indent':
      return new EndIndentC(ident, index);
    case 'first-line-start-indent':
      return new FirstLineStartIndentC(ident, index);
    case 'line-spacing':
      return new LineSpacingC(ident, index);
    case 'field-width':
      return new FieldWidthC(ident, index);
    case 'quadding':
      return new QuaddingC(ident, index);
    case 'display-alignment':
      return new DisplayAlignmentC(ident, index);
    case 'color':
      return new ColorC(ident, index);
    case 'background-color':
      return new BackgroundColorC(ident, index);
    case 'lines':
      return new LinesC(ident, index);
    case 'writing-mode':
      return new WritingModeC(ident, index);
    default:
      return null;
  }
}
