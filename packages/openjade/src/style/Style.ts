// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, StringC, Messenger } from '@openjade-js/opensp';
import { ELObj, FunctionObj, Identifier } from './ELObj';
import { Collector } from './Collector';
import { NodePtr } from '../grove/Node';
import { FOTBuilder } from './FOTBuilder';
import { InsnPtr, VM } from './Insn';

// Forward declarations
export interface ProcessingModeRule {
  // Rule from a processing mode
}

// InheritedC represents the specification of a value
// of an inherited characteristic.
export abstract class InheritedC {
  private ident_: Identifier | null;
  private index_: number;

  constructor(ident: Identifier | null, index: number) {
    this.ident_ = ident;
    this.index_ = index;
  }

  abstract set(
    vm: VM,
    style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    dependencies: number[]
  ): void;

  abstract value(
    vm: VM,
    style: VarStyleObj | null,
    dependencies: number[]
  ): ELObj | null;

  abstract make(
    obj: ELObj,
    loc: Location,
    interp: any // Interpreter - avoiding circular import
  ): InheritedC | null;

  index(): number { return this.index_; }

  identifier(): Identifier | null { return this.ident_; }

  setIdentifier(ident: Identifier): void { this.ident_ = ident; }

  protected invalidValue(_loc: Location, _interp: any): void {
    // Report invalid value error
  }
}

// Variable inherited characteristic
export class VarInheritedC extends InheritedC {
  private inheritedC_: InheritedC;
  private code_: InsnPtr;
  private loc_: Location;

  constructor(inheritedC: InheritedC, code: InsnPtr, loc: Location) {
    super(inheritedC.identifier(), inheritedC.index());
    this.inheritedC_ = inheritedC;
    this.code_ = code;
    this.loc_ = loc;
  }

  set(
    vm: VM,
    style: VarStyleObj | null,
    fotb: FOTBuilder,
    value: { obj: ELObj | null },
    dependencies: number[]
  ): void {
    // Port of VarInheritedC::set from Style.cxx
    // If no cached value, evaluate the code to get the value
    if (!value.obj) {
      // Set the current node context and evaluate with display from style
      const prevNode = vm.currentNode;
      if (style) {
        vm.currentNode = style.node();
      }
      // Pass the style's display as the closure for variable lookup
      const display = style?.display() || null;
      value.obj = vm.eval(this.code_, display);
      vm.currentNode = prevNode;
    }
    // If not an error, create a new InheritedC with the evaluated value and call set on it
    const interp = (vm as any).interp;
    if (value.obj && (!interp || !interp.isError(value.obj))) {
      const newIC = this.inheritedC_.make(value.obj, this.loc_, interp);
      if (newIC) {
        newIC.set(vm, null, fotb, value, dependencies);
      }
    }
  }

  value(
    vm: VM,
    style: VarStyleObj | null,
    _dependencies: number[]
  ): ELObj | null {
    // Port of VarInheritedC::value from Style.cxx
    // Evaluate the code to get the value
    const prevNode = vm.currentNode;
    if (style) {
      vm.currentNode = style.node();
    }
    // Pass the style's display as the closure for variable lookup
    const display = style?.display() || null;
    const result = vm.eval(this.code_, display);
    vm.currentNode = prevNode;
    return result;
  }

  make(
    obj: ELObj,
    loc: Location,
    interp: any
  ): InheritedC | null {
    return this.inheritedC_.make(obj, loc, interp);
  }
}

// Style object iterator
export class StyleObjIter {
  private i_: number = 0;
  private vi_: number = 0;
  private styleVec_: VarStyleObj[] = [];
  private vecs_: InheritedC[][] = [];

  constructor() {}

  append(specs: InheritedC[], style: VarStyleObj): void {
    this.vecs_.push(specs);
    this.styleVec_.push(style);
  }

  next(style: { obj: VarStyleObj | null }): InheritedC | null {
    while (this.vi_ < this.vecs_.length) {
      if (this.i_ < this.vecs_[this.vi_].length) {
        style.obj = this.styleVec_[this.vi_];
        return this.vecs_[this.vi_][this.i_++];
      }
      this.vi_++;
      this.i_ = 0;
    }
    style.obj = null;
    return null;
  }
}

// Base style object
export abstract class StyleObj extends ELObj {
  override asStyle(): StyleObj { return this; }
  abstract appendIter(iter: StyleObjIter): void;
}

// Style specification resource
export class StyleSpec {
  forceSpecs: InheritedC[] = [];
  specs: InheritedC[] = [];

  constructor(forceSpecs: InheritedC[], specs: InheritedC[]) {
    this.forceSpecs = forceSpecs;
    this.specs = specs;
  }
}

// Basic style object with force/normal separation
export abstract class BasicStyleObj extends StyleObj {
  abstract appendIterForce(iter: StyleObjIter): void;
  abstract appendIterNormal(iter: StyleObjIter): void;
}

// Variable style object
export class VarStyleObj extends BasicStyleObj {
  private styleSpec_: StyleSpec | null;
  private use_: StyleObj | null;
  private display_: ELObj[] | null;
  private node_: NodePtr;

  constructor(
    styleSpec: StyleSpec | null,
    use: StyleObj | null,
    display: ELObj[] | null,
    node: NodePtr
  ) {
    super();
    this.styleSpec_ = styleSpec;
    this.use_ = use;
    this.display_ = display;
    this.node_ = node;
    this.hasSubObjects_ = true;
  }

  appendIter(iter: StyleObjIter): void {
    this.appendIterForce(iter);
    this.appendIterNormal(iter);
  }

  appendIterForce(iter: StyleObjIter): void {
    if (this.use_) {
      const basicUse = this.use_ as BasicStyleObj;
      if (basicUse.appendIterForce) {
        basicUse.appendIterForce(iter);
      }
    }
    if (this.styleSpec_) {
      iter.append(this.styleSpec_.forceSpecs, this);
    }
  }

  appendIterNormal(iter: StyleObjIter): void {
    if (this.styleSpec_) {
      iter.append(this.styleSpec_.specs, this);
    }
    if (this.use_) {
      const basicUse = this.use_ as BasicStyleObj;
      if (basicUse.appendIterNormal) {
        basicUse.appendIterNormal(iter);
      }
    }
  }

  node(): NodePtr { return this.node_; }

  display(): ELObj[] | null { return this.display_; }

  override traceSubObjects(collector: Collector): void {
    if (this.use_) collector.trace(this.use_);
    if (this.display_) {
      for (const obj of this.display_) {
        collector.trace(obj);
      }
    }
  }
}

// Overridden style object
export class OverriddenStyleObj extends StyleObj {
  private basic_: BasicStyleObj;
  private override_: StyleObj;

  constructor(basic: BasicStyleObj, override: StyleObj) {
    super();
    this.basic_ = basic;
    this.override_ = override;
    this.hasSubObjects_ = true;
  }

  appendIter(iter: StyleObjIter): void {
    this.override_.appendIter(iter);
    this.basic_.appendIterNormal(iter);
  }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.basic_);
    collector.trace(this.override_);
  }
}

// Merge style object
export class MergeStyleObj extends StyleObj {
  private styles_: StyleObj[] = [];

  constructor() {
    super();
    this.hasSubObjects_ = true;
  }

  append(style: StyleObj): void {
    this.styles_.push(style);
  }

  appendIter(iter: StyleObjIter): void {
    for (const style of this.styles_) {
      style.appendIter(iter);
    }
  }

  override traceSubObjects(collector: Collector): void {
    for (const style of this.styles_) {
      collector.trace(style);
    }
  }
}

// Base color object
export abstract class ColorObj extends ELObj {
  override asColor(): ColorObj { return this; }
  abstract set(fotb: FOTBuilder): void;
  abstract setBackground(fotb: FOTBuilder): void;
}

// Device RGB color
export class DeviceRGBColorObj extends ColorObj {
  private r_: number;
  private g_: number;
  private b_: number;

  constructor(r: number, g: number, b: number) {
    super();
    this.r_ = r;
    this.g_ = g;
    this.b_ = b;
  }

  set(fotb: FOTBuilder): void {
    fotb.setColor({ red: this.r_, green: this.g_, blue: this.b_ });
  }

  setBackground(fotb: FOTBuilder): void {
    fotb.setBackgroundColor({ red: this.r_, green: this.g_, blue: this.b_ });
  }
}

// Base color space object
export abstract class ColorSpaceObj extends ELObj {
  override asColorSpace(): ColorSpaceObj { return this; }
  abstract makeColor(argc: number, argv: ELObj[], interp: any, loc: Location): ELObj | null;
}

// Device RGB color space
export class DeviceRGBColorSpaceObj extends ColorSpaceObj {
  makeColor(argc: number, argv: ELObj[], interp: any, loc: Location): ELObj | null {
    if (argc !== 3) return null;
    const r = argv[0].asReal();
    const g = argv[1].asReal();
    const b = argv[2].asReal();
    if (r === null || g === null || b === null) return null;
    return new DeviceRGBColorObj(
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255)
    );
  }
}

// Device gray color space
export class DeviceGrayColorSpaceObj extends ColorSpaceObj {
  makeColor(argc: number, argv: ELObj[], interp: any, loc: Location): ELObj | null {
    if (argc !== 1) return null;
    const gray = argv[0].asReal();
    if (gray === null) return null;
    const val = Math.round(gray * 255);
    return new DeviceRGBColorObj(val, val, val);
  }
}

// Device CMYK color space
export class DeviceCMYKColorSpaceObj extends ColorSpaceObj {
  makeColor(argc: number, argv: ELObj[], interp: any, loc: Location): ELObj | null {
    if (argc !== 4) return null;
    const c = argv[0].asReal();
    const m = argv[1].asReal();
    const y = argv[2].asReal();
    const k = argv[3].asReal();
    if (c === null || m === null || y === null || k === null) return null;
    // Convert CMYK to RGB
    const r = Math.round(255 * (1 - c) * (1 - k));
    const g = Math.round(255 * (1 - m) * (1 - k));
    const b = Math.round(255 * (1 - y) * (1 - k));
    return new DeviceRGBColorObj(r, g, b);
  }
}

// Inherited characteristic info for style stack
export class InheritedCInfo {
  spec: InheritedC;
  prev: InheritedCInfo | null;
  valLevel: number;
  specLevel: number;
  rule: ProcessingModeRule | null;
  cachedValue: ELObj | null = null;
  style: VarStyleObj | null;
  dependencies: number[] = [];

  constructor(
    spec: InheritedC,
    style: VarStyleObj | null,
    valLevel: number,
    specLevel: number,
    rule: ProcessingModeRule | null,
    prev: InheritedCInfo | null
  ) {
    this.spec = spec;
    this.style = style;
    this.valLevel = valLevel;
    this.specLevel = specLevel;
    this.rule = rule;
    this.prev = prev;
  }
}

// Pop list for style stack
export class PopList {
  list: number[] = [];
  dependingList: number[] = [];
  prev: PopList | null;

  constructor(prev: PopList | null) {
    this.prev = prev;
  }
}

// Style stack for managing inherited characteristics
export class StyleStack {
  private inheritedCInfo_: (InheritedCInfo | null)[] = [];
  private level_: number = 0;
  private popList_: PopList | null = null;

  constructor() {}

  actual(
    ic: InheritedC,
    loc: Location,
    interp: any,
    dependencies: number[]
  ): ELObj | null {
    // Following upstream StyleStack::actual in Style.cxx
    const ind = ic.index();

    // Check for circular dependency
    for (let i = 0; i < dependencies.length; i++) {
      if (dependencies[i] === ind) {
        interp.setNextLocation(loc);
        interp.message('actualLoop', ic.identifier()?.name());
        return interp.makeError();
      }
    }
    dependencies.push(ind);

    let spec: InheritedC = ic;
    let style: VarStyleObj | null = null;

    if (ind < this.inheritedCInfo_.length) {
      const p = this.inheritedCInfo_[ind];
      if (!p) {
        spec = ic;
      } else if (p.cachedValue) {
        dependencies.push(...p.dependencies);
        return p.cachedValue;
      } else {
        style = p.style;
        spec = p.spec || ic;
      }
    }

    // Create VM for value computation - following upstream pattern
    const vm = { interp, styleStack: this, specLevel: this.level_ } as any;
    return spec.value(vm, style, dependencies);
  }

  inherited(
    ic: InheritedC,
    specLevel: number,
    interp: any,
    dependencies: number[]
  ): ELObj | null {
    // Following upstream StyleStack::inherited in Style.cxx
    const ind = ic.index();
    let spec: InheritedC = ic;
    let style: VarStyleObj | null = null;
    let newSpecLevel = -1;

    if (ind < this.inheritedCInfo_.length) {
      let p = this.inheritedCInfo_[ind];
      while (p !== null) {
        if (p.specLevel < specLevel) {
          break;
        }
        p = p.prev;
      }
      if (!p) {
        spec = ic;
      } else {
        if (p.cachedValue) {
          // Check if cache is still valid - following upstream cache validation
          let cacheOk = true;
          for (let i = 0; i < p.dependencies.length; i++) {
            const d = p.dependencies[i];
            if (d < this.inheritedCInfo_.length) {
              const depInfo = this.inheritedCInfo_[d];
              if (depInfo && depInfo.valLevel > p.valLevel) {
                cacheOk = false;
                break;
              }
            }
          }
          if (cacheOk) {
            return p.cachedValue;
          }
        }
        style = p.style;
        spec = p.spec || ic;
        newSpecLevel = p.specLevel;
      }
    }

    // Create VM for value computation - following upstream pattern
    const vm = { interp, styleStack: this, specLevel: newSpecLevel } as any;
    return spec.value(vm, style, dependencies);
  }

  push(style: StyleObj, vm: VM, fotb: FOTBuilder): void {
    this.pushStart();
    this.pushContinue(style, null, null, null);
    this.pushEnd(vm, fotb);
  }

  pushStart(): void {
    this.level_++;
    this.popList_ = new PopList(this.popList_);
  }

  pushContinue(
    style: StyleObj | null,
    rule: ProcessingModeRule | null,
    node: NodePtr | null,
    messenger: Messenger | null
  ): void {
    if (!style) return;

    const iter = new StyleObjIter();
    style.appendIter(iter);

    const styleRef = { obj: null as VarStyleObj | null };
    let spec = iter.next(styleRef);
    while (spec) {
      const index = spec.index();
      // Ensure array is large enough
      while (this.inheritedCInfo_.length <= index) {
        this.inheritedCInfo_.push(null);
      }
      const newInfo = new InheritedCInfo(
        spec,
        styleRef.obj,
        this.level_,
        this.level_,
        rule,
        this.inheritedCInfo_[index]
      );
      this.inheritedCInfo_[index] = newInfo;
      if (this.popList_) {
        this.popList_.list.push(index);
      }
      spec = iter.next(styleRef);
    }
  }

  pushEnd(vm: VM, fotb: FOTBuilder): void {
    // Compute values for all pushed specs
    if (!this.popList_) return;
    for (const index of this.popList_.list) {
      const info = this.inheritedCInfo_[index];
      if (info && !info.cachedValue) {
        const value = { obj: null as ELObj | null };
        info.spec.set(vm, info.style, fotb, value, info.dependencies);
        info.cachedValue = value.obj;
      }
    }
  }

  pop(): void {
    if (!this.popList_) return;
    for (const index of this.popList_.list) {
      const info = this.inheritedCInfo_[index];
      if (info) {
        this.inheritedCInfo_[index] = info.prev;
      }
    }
    this.popList_ = this.popList_.prev;
    this.level_--;
  }

  pushEmpty(): void { this.level_++; }
  popEmpty(): void { this.level_--; }

  level(): number { return this.level_; }

  // Clone the style stack for use in a new connection
  clone(): StyleStack {
    const copy = new StyleStack();
    copy.level_ = this.level_;
    copy.inheritedCInfo_ = [...this.inheritedCInfo_];
    // Note: popList_ is not cloned - new connections start fresh
    return copy;
  }

  trace(collector: Collector): void {
    for (const info of this.inheritedCInfo_) {
      let current = info;
      while (current) {
        if (current.style) collector.trace(current.style);
        if (current.cachedValue) collector.trace(current.cachedValue);
        current = current.prev;
      }
    }
  }
}
