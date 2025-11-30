// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, StringC, Char, String as StringOf } from '@openjade-js/opensp';
import { ELObj, SymbolObj, QuantityType, StringObj } from './ELObj';
import { Collector } from './Collector';
import { NodePtr } from '../grove/Node';
import {
  FOTBuilder,
  DisplayNIC,
  DisplayGroupNIC,
  ParagraphNIC,
  ExternalGraphicNIC,
  RuleNIC,
  BoxNIC,
  LeaderNIC,
  CharacterNIC,
  TableNIC,
  TablePartNIC,
  TableColumnNIC,
  TableCellNIC,
  InlineNIC,
  LineFieldNIC,
  Address,
  MultiMode,
  Symbol,
  LengthSpec,
  DisplaySpace,
  GridNIC,
  GridCellNIC,
  HF
} from './FOTBuilder';
import { StyleObj } from './Style';
import { FlowObj, CompoundFlowObj, SosofoObj, ProcessContext } from './SosofoObj';
import { Identifier, SyntacticKey } from './Identifier';
import type { Interpreter } from './Interpreter';

// Helper to convert StringC to JS string
function stringCToString(sc: StringC): string {
  if (!sc || !sc.ptr_ || sc.length_ === 0) return '';
  let result = '';
  for (let i = 0; i < sc.length_; i++) {
    result += String.fromCharCode(sc.ptr_[i]);
  }
  return result;
}

// Helper to convert Uint32Array (or number array) to JS string without spread operator
// This avoids stack overflow for large arrays that occur with String.fromCharCode(...)
function uint32ArrayToString(data: Uint32Array | number[], length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(data[i]);
  }
  return result;
}

// Helper to check if identifier matches a display NIC property
function isDisplayNIC(ident: Identifier): boolean {
  const keyRef = { value: SyntacticKey.notKey };
  if (ident.syntacticKey(keyRef)) {
    switch (keyRef.value) {
      case SyntacticKey.keyPositionPreference:
      case SyntacticKey.keyIsKeepWithPrevious:
      case SyntacticKey.keyIsKeepWithNext:
      case SyntacticKey.keyKeep:
      case SyntacticKey.keyBreakBefore:
      case SyntacticKey.keyBreakAfter:
      case SyntacticKey.keyIsMayViolateKeepBefore:
      case SyntacticKey.keyIsMayViolateKeepAfter:
      case SyntacticKey.keySpaceBefore:
      case SyntacticKey.keySpaceAfter:
        return true;
      default:
        break;
    }
  }
  return false;
}

// Helper to set display NIC properties
function setDisplayNIC(
  nic: DisplayNIC,
  ident: Identifier,
  obj: ELObj,
  _loc: Location,
  _interp: Interpreter
): boolean {
  const keyRef = { value: SyntacticKey.notKey };
  if (ident.syntacticKey(keyRef)) {
    switch (keyRef.value) {
      case SyntacticKey.keyPositionPreference:
        // TODO: Convert enum value
        return true;
      case SyntacticKey.keyIsKeepWithPrevious:
        nic.keepWithPrevious = obj.isTrue();
        return true;
      case SyntacticKey.keyIsKeepWithNext:
        nic.keepWithNext = obj.isTrue();
        return true;
      case SyntacticKey.keyKeep:
        // TODO: Convert enum value
        return true;
      case SyntacticKey.keyBreakBefore: {
        const sym = obj.asSymbol();
        if (sym) {
          nic.breakBefore = sym.cValue();
        }
        return true;
      }
      case SyntacticKey.keyBreakAfter: {
        const sym = obj.asSymbol();
        if (sym) {
          nic.breakAfter = sym.cValue();
        }
        return true;
      }
      case SyntacticKey.keyIsMayViolateKeepBefore:
        nic.mayViolateKeepBefore = obj.isTrue();
        return true;
      case SyntacticKey.keyIsMayViolateKeepAfter:
        nic.mayViolateKeepAfter = obj.isTrue();
        return true;
      case SyntacticKey.keySpaceBefore:
      case SyntacticKey.keySpaceAfter: {
        // Get reference to the appropriate DisplaySpace
        const ds = keyRef.value === SyntacticKey.keySpaceBefore
          ? nic.spaceBefore
          : nic.spaceAfter;
        // Try as DisplaySpaceObj first
        const dso = obj.asDisplaySpace();
        if (dso) {
          // Copy all fields from the DisplaySpace object
          const srcDs = dso.displaySpace();
          ds.nominal.length = srcDs.nominal.length;
          ds.nominal.displaySizeFactor = srcDs.nominal.displaySizeFactor;
          ds.min.length = srcDs.min.length;
          ds.min.displaySizeFactor = srcDs.min.displaySizeFactor;
          ds.max.length = srcDs.max.length;
          ds.max.displaySizeFactor = srcDs.max.displaySizeFactor;
          ds.priority = srcDs.priority;
          ds.conditional = srcDs.conditional;
          ds.force = srcDs.force;
        } else {
          // Try to convert to LengthSpec
          const ls = obj.lengthSpec();
          if (ls) {
            const converted = ls.convert();
            if (converted.result) {
              ds.nominal.length = converted.spec.length;
              ds.nominal.displaySizeFactor = converted.spec.displaySizeFactor;
              ds.min.length = converted.spec.length;
              ds.min.displaySizeFactor = converted.spec.displaySizeFactor;
              ds.max.length = converted.spec.length;
              ds.max.displaySizeFactor = converted.spec.displaySizeFactor;
            }
          } else {
            // Also try quantityValue for plain lengths
            const q = obj.quantityValue();
            if (q.type !== 0 && q.dim === 1) {
              const length = q.type === 1 ? q.longVal : Math.round(q.doubleVal);
              ds.nominal.length = length;
              ds.min.length = length;
              ds.max.length = length;
            }
          }
        }
        return true;
      }
      default:
        break;
    }
  }
  return false;
}

// Sequence flow object - the most basic compound flow object
export class SequenceFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startSequence();
    super.processInner(context);
    fotb.endSequence();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new SequenceFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Display group flow object
export class DisplayGroupFlowObj extends CompoundFlowObj {
  private nic_: DisplayGroupNIC;

  constructor() {
    super();
    this.nic_ = new DisplayGroupNIC();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startDisplayGroup(this.nic_);
    super.processInner(context);
    fotb.endDisplayGroup();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef) && keyRef.value === SyntacticKey.keyCoalesceId) {
      return true;
    }
    return isDisplayNIC(ident);
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, loc: Location, interp: Interpreter): void {
    if (!setDisplayNIC(this.nic_, ident, obj, loc, interp)) {
      const strData = obj.stringData();
      if (strData) {
        this.nic_.hasCoalesceId = true;
        this.nic_.coalesceId = uint32ArrayToString(strData.data, strData.length);
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new DisplayGroupFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Paragraph flow object
export class ParagraphFlowObj extends CompoundFlowObj {
  private nic_: ParagraphNIC;

  constructor() {
    super();
    this.nic_ = new DisplayNIC();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startParagraph(this.nic_);
    super.processInner(context);
    fotb.endParagraph();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    return isDisplayNIC(ident);
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, loc: Location, interp: Interpreter): void {
    setDisplayNIC(this.nic_, ident, obj, loc, interp);
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new ParagraphFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Paragraph break flow object (atomic)
export class ParagraphBreakFlowObj extends FlowObj {
  private nic_: ParagraphNIC;

  constructor() {
    super();
    this.nic_ = new DisplayNIC();
  }

  processInner(context: ProcessContext): void {
    context.fotBuilder().paragraphBreak(this.nic_);
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    return isDisplayNIC(ident);
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, loc: Location, interp: Interpreter): void {
    setDisplayNIC(this.nic_, ident, obj, loc, interp);
  }

  copy(_interp: Interpreter): FlowObj {
    const copy = new ParagraphBreakFlowObj();
    copy.style_ = this.style_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// External graphic flow object
export class ExternalGraphicFlowObj extends FlowObj {
  private nic_: ExternalGraphicNIC;

  constructor() {
    super();
    this.nic_ = new ExternalGraphicNIC();
  }

  processInner(context: ProcessContext): void {
    context.fotBuilder().externalGraphic(this.nic_);
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyIsDisplay:
        case SyntacticKey.keyScaleType:
        case SyntacticKey.keyScale:
        case SyntacticKey.keyEntitySystemId:
        case SyntacticKey.keyNotationSystemId:
        case SyntacticKey.keyMaxWidth:
        case SyntacticKey.keyMaxHeight:
        case SyntacticKey.keyEscapementDirection:
        case SyntacticKey.keyPositionPointX:
        case SyntacticKey.keyPositionPointY:
        case SyntacticKey.keyBreakBeforePriority:
        case SyntacticKey.keyBreakAfterPriority:
          return true;
        default:
          break;
      }
    }
    return isDisplayNIC(ident);
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, loc: Location, interp: Interpreter): void {
    if (!setDisplayNIC(this.nic_, ident, obj, loc, interp)) {
      const keyRef = { value: SyntacticKey.notKey };
      if (ident.syntacticKey(keyRef)) {
        switch (keyRef.value) {
          case SyntacticKey.keyIsDisplay:
            this.nic_.isDisplay = obj.isTrue();
            break;
          case SyntacticKey.keyEntitySystemId:
            {
              const strData = obj.stringData();
              if (strData) {
                this.nic_.entitySystemId = uint32ArrayToString(strData.data, strData.length);
              }
            }
            break;
          case SyntacticKey.keyNotationSystemId:
            {
              const strData = obj.stringData();
              if (strData) {
                this.nic_.notationSystemId = uint32ArrayToString(strData.data, strData.length);
              }
            }
            break;
          default:
            break;
        }
      }
    }
  }

  copy(_interp: Interpreter): FlowObj {
    const copy = new ExternalGraphicFlowObj();
    copy.style_ = this.style_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Rule flow object
export class RuleFlowObj extends FlowObj {
  private nic_: RuleNIC;

  constructor() {
    super();
    this.nic_ = new RuleNIC();
  }

  processInner(context: ProcessContext): void {
    context.fotBuilder().rule(this.nic_);
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyOrientation:
        case SyntacticKey.keyLength:
        case SyntacticKey.keyBreakBeforePriority:
        case SyntacticKey.keyBreakAfterPriority:
          return true;
        default:
          break;
      }
    }
    return isDisplayNIC(ident);
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, loc: Location, interp: Interpreter): void {
    if (!setDisplayNIC(this.nic_, ident, obj, loc, interp)) {
      const keyRef = { value: SyntacticKey.notKey };
      if (ident.syntacticKey(keyRef)) {
        switch (keyRef.value) {
          case SyntacticKey.keyOrientation:
            // TODO: Convert enum
            break;
          case SyntacticKey.keyLength:
            // TODO: Convert length spec
            this.nic_.hasLength = true;
            break;
          default:
            break;
        }
      }
    }
  }

  copy(_interp: Interpreter): FlowObj {
    const copy = new RuleFlowObj();
    copy.style_ = this.style_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Alignment point flow object
export class AlignmentPointFlowObj extends FlowObj {
  constructor() {
    super();
  }

  processInner(context: ProcessContext): void {
    context.fotBuilder().alignmentPoint();
  }

  copy(_interp: Interpreter): FlowObj {
    const copy = new AlignmentPointFlowObj();
    copy.style_ = this.style_;
    return copy;
  }
}

// Line field flow object
export class LineFieldFlowObj extends CompoundFlowObj {
  private nic_: LineFieldNIC;

  constructor() {
    super();
    this.nic_ = new InlineNIC();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startLineField(this.nic_);
    super.processInner(context);
    fotb.endLineField();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyBreakBeforePriority:
        case SyntacticKey.keyBreakAfterPriority:
          return true;
        default:
          break;
      }
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyBreakBeforePriority:
          this.nic_.breakBeforePriority = obj.asInteger() ?? 0;
          break;
        case SyntacticKey.keyBreakAfterPriority:
          this.nic_.breakAfterPriority = obj.asInteger() ?? 0;
          break;
        default:
          break;
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new LineFieldFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Link flow object
export class LinkFlowObj extends CompoundFlowObj {
  private address_: Address;

  constructor() {
    super();
    this.address_ = new Address();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startLink(this.address_);
    super.processInner(context);
    fotb.endLink();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef) && keyRef.value === SyntacticKey.keyDestination) {
      return true;
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef) && keyRef.value === SyntacticKey.keyDestination) {
      const addrObj = obj.asAddress();
      if (addrObj) {
        this.address_ = addrObj.address();
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new LinkFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    copy.address_ = { ...this.address_ };
    return copy;
  }
}

// Scroll flow object
export class ScrollFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startScroll();
    super.processInner(context);
    fotb.endScroll();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new ScrollFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Marginalia flow object
export class MarginaliaFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startMarginalia();
    super.processInner(context);
    fotb.endMarginalia();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new MarginaliaFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Multi-mode flow object
export class MultiModeFlowObj extends CompoundFlowObj {
  private modes_: MultiMode[] = [];
  private principalMode_: SosofoObj | null = null;

  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startMultiMode(this.modes_);
    if (this.principalMode_) {
      this.principalMode_.process(context);
    } else {
      super.processInner(context);
    }
    fotb.endMultiMode();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyNamedModes:
        case SyntacticKey.keyPrincipalMode:
          return true;
        default:
          break;
      }
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyPrincipalMode:
          this.principalMode_ = obj.asSosofo() as SosofoObj | null;
          break;
        case SyntacticKey.keyNamedModes:
          // TODO: Parse named modes list
          break;
        default:
          break;
      }
    }
  }

  override traceSubObjects(collector: Collector): void {
    super.traceSubObjects(collector);
    if (this.principalMode_) collector.trace(this.principalMode_);
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new MultiModeFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    copy.modes_ = [...this.modes_];
    copy.principalMode_ = this.principalMode_;
    return copy;
  }
}

// Box flow object
export class BoxFlowObj extends CompoundFlowObj {
  private nic_: BoxNIC;

  constructor() {
    super();
    this.nic_ = new BoxNIC();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    // Box uses DisplayGroupNIC base properties
    const displayNic = new DisplayGroupNIC();
    Object.assign(displayNic, this.nic_);
    fotb.startDisplayGroup(displayNic);
    super.processInner(context);
    fotb.endDisplayGroup();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyIsDisplay:
        case SyntacticKey.keyBreakBeforePriority:
        case SyntacticKey.keyBreakAfterPriority:
          return true;
        default:
          break;
      }
    }
    return isDisplayNIC(ident);
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, loc: Location, interp: Interpreter): void {
    if (!setDisplayNIC(this.nic_, ident, obj, loc, interp)) {
      const keyRef = { value: SyntacticKey.notKey };
      if (ident.syntacticKey(keyRef)) {
        switch (keyRef.value) {
          case SyntacticKey.keyIsDisplay:
            this.nic_.isDisplay = obj.isTrue();
            break;
          default:
            break;
        }
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new BoxFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Leader flow object
export class LeaderFlowObj extends CompoundFlowObj {
  private nic_: LeaderNIC;

  constructor() {
    super();
    this.nic_ = new LeaderNIC();
  }

  override processInner(context: ProcessContext): void {
    // Leader is processed differently - the content defines the pattern
    const fotb = context.fotBuilder();
    // TODO: Implement leader processing with pattern
    super.processInner(context);
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyLength:
        case SyntacticKey.keyBreakBeforePriority:
        case SyntacticKey.keyBreakAfterPriority:
          return true;
        default:
          break;
      }
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyLength:
          this.nic_.hasLength = true;
          // TODO: Convert length spec
          break;
        case SyntacticKey.keyBreakBeforePriority:
          this.nic_.breakBeforePriority = obj.asInteger() ?? 0;
          break;
        case SyntacticKey.keyBreakAfterPriority:
          this.nic_.breakAfterPriority = obj.asInteger() ?? 0;
          break;
        default:
          break;
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new LeaderFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Character flow object
export class CharacterFlowObj extends FlowObj {
  private nic_: CharacterNIC;

  constructor() {
    super();
    this.nic_ = new CharacterNIC();
  }

  processInner(context: ProcessContext): void {
    if (this.nic_.valid) {
      context.fotBuilder().character(this.nic_);
    }
  }

  override isCharacter(): boolean {
    return true;
  }

  override setImplicitChar(obj: ELObj, _loc: Location, _interp: Interpreter): boolean {
    const ch = obj.asChar();
    if (ch !== null) {
      this.nic_.ch = ch;
      this.nic_.valid = true;
      return true;
    }
    return false;
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyChar:
        case SyntacticKey.keyGlyphId:
        case SyntacticKey.keyIsDropAfterLineBreak:
        case SyntacticKey.keyIsDropUnlessBeforeLineBreak:
        case SyntacticKey.keyIsPunct:
        case SyntacticKey.keyIsInputWhitespace:
        case SyntacticKey.keyIsInputTab:
        case SyntacticKey.keyIsRecordEnd:
        case SyntacticKey.keyIsSpace:
        case SyntacticKey.keyScript:
        case SyntacticKey.keyMathClass:
        case SyntacticKey.keyMathFontPosture:
        case SyntacticKey.keyBreakBeforePriority:
        case SyntacticKey.keyBreakAfterPriority:
        case SyntacticKey.keyStretchFactor:
          return true;
        default:
          break;
      }
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyChar:
          {
            const ch = obj.asChar();
            if (ch !== null) {
              this.nic_.ch = ch;
              this.nic_.valid = true;
              this.nic_.specifiedC |= (1 << CharacterNIC.cChar);
            }
          }
          break;
        case SyntacticKey.keyIsDropAfterLineBreak:
          this.nic_.isDropAfterLineBreak = obj.isTrue();
          this.nic_.specifiedC |= (1 << CharacterNIC.cIsDropAfterLineBreak);
          break;
        case SyntacticKey.keyIsDropUnlessBeforeLineBreak:
          this.nic_.isDropUnlessBeforeLineBreak = obj.isTrue();
          this.nic_.specifiedC |= (1 << CharacterNIC.cIsDropUnlessBeforeLineBreak);
          break;
        case SyntacticKey.keyIsPunct:
          this.nic_.isPunct = obj.isTrue();
          this.nic_.specifiedC |= (1 << CharacterNIC.cIsPunct);
          break;
        case SyntacticKey.keyIsInputWhitespace:
          this.nic_.isInputWhitespace = obj.isTrue();
          this.nic_.specifiedC |= (1 << CharacterNIC.cIsInputWhitespace);
          break;
        case SyntacticKey.keyIsInputTab:
          this.nic_.isInputTab = obj.isTrue();
          this.nic_.specifiedC |= (1 << CharacterNIC.cIsInputTab);
          break;
        case SyntacticKey.keyIsRecordEnd:
          this.nic_.isRecordEnd = obj.isTrue();
          this.nic_.specifiedC |= (1 << CharacterNIC.cIsRecordEnd);
          break;
        case SyntacticKey.keyIsSpace:
          this.nic_.isSpace = obj.isTrue();
          this.nic_.specifiedC |= (1 << CharacterNIC.cIsSpace);
          break;
        case SyntacticKey.keyBreakBeforePriority:
          this.nic_.breakBeforePriority = obj.asInteger() ?? 0;
          this.nic_.specifiedC |= (1 << CharacterNIC.cBreakBeforePriority);
          break;
        case SyntacticKey.keyBreakAfterPriority:
          this.nic_.breakAfterPriority = obj.asInteger() ?? 0;
          this.nic_.specifiedC |= (1 << CharacterNIC.cBreakAfterPriority);
          break;
        case SyntacticKey.keyStretchFactor:
          {
            const real = obj.asReal();
            if (real !== null) {
              this.nic_.stretchFactor = real;
            }
          }
          break;
        default:
          break;
      }
    }
  }

  copy(_interp: Interpreter): FlowObj {
    const copy = new CharacterFlowObj();
    copy.style_ = this.style_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Table flow object
export class TableFlowObj extends CompoundFlowObj {
  private nic_: TableNIC;

  constructor() {
    super();
    this.nic_ = new TableNIC();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    // TODO: fotb.startTable(this.nic_);
    context.startTable();
    super.processInner(context);
    context.endTable();
    // TODO: fotb.endTable();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyBeforeRowBorder:
        case SyntacticKey.keyAfterRowBorder:
        case SyntacticKey.keyBeforeColumnBorder:
        case SyntacticKey.keyAfterColumnBorder:
        case SyntacticKey.keyTableWidth:
          return true;
        default:
          break;
      }
    }
    return isDisplayNIC(ident);
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, loc: Location, interp: Interpreter): void {
    if (setDisplayNIC(this.nic_, ident, obj, loc, interp)) {
      return;
    }
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyTableWidth:
          if (obj === interp.makeFalse()) {
            this.nic_.widthType = TableNIC.widthMinimum;
          } else {
            // TODO: Parse width specification
            this.nic_.widthType = TableNIC.widthExplicit;
          }
          break;
        case SyntacticKey.keyBeforeRowBorder:
        case SyntacticKey.keyAfterRowBorder:
        case SyntacticKey.keyBeforeColumnBorder:
        case SyntacticKey.keyAfterColumnBorder:
          // TODO: Store border styles for processing
          break;
        default:
          break;
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new TableFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Table part flow object
export class TablePartFlowObj extends CompoundFlowObj {
  private nic_: TablePartNIC;

  constructor() {
    super();
    this.nic_ = new DisplayNIC();
  }

  override processInner(context: ProcessContext): void {
    context.startTablePart();
    super.processInner(context);
    context.endTablePart();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    return isDisplayNIC(ident);
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, loc: Location, interp: Interpreter): void {
    setDisplayNIC(this.nic_, ident, obj, loc, interp);
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new TablePartFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Table column flow object
export class TableColumnFlowObj extends FlowObj {
  private nic_: TableColumnNIC;
  private hasNColumnsSpanned_: boolean = false;

  constructor() {
    super();
    this.nic_ = new TableColumnNIC();
  }

  processInner(context: ProcessContext): void {
    // Register this column with the table context
    context.addTableColumn(this.nic_.columnIndex, this.nic_.nColumnsSpanned, this.style_);
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyColumnIndex:
        case SyntacticKey.keyColumnNumber:
        case SyntacticKey.keyNColumnsSpanned:
        case SyntacticKey.keyWidth:
          return true;
        default:
          break;
      }
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyColumnIndex:
        case SyntacticKey.keyColumnNumber:
          this.nic_.columnIndex = obj.asInteger() ?? 0;
          break;
        case SyntacticKey.keyNColumnsSpanned:
          this.nic_.nColumnsSpanned = obj.asInteger() ?? 1;
          this.hasNColumnsSpanned_ = true;
          break;
        case SyntacticKey.keyWidth:
          this.nic_.hasWidth = true;
          // TODO: Parse width
          break;
        default:
          break;
      }
    }
  }

  copy(_interp: Interpreter): FlowObj {
    const copy = new TableColumnFlowObj();
    copy.style_ = this.style_;
    Object.assign(copy.nic_, this.nic_);
    copy.hasNColumnsSpanned_ = this.hasNColumnsSpanned_;
    return copy;
  }
}

// Table row flow object
export class TableRowFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    context.startTableRow(this.style_);
    super.processInner(context);
    context.endTableRow();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new TableRowFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Table cell flow object
export class TableCellFlowObj extends CompoundFlowObj {
  private nic_: TableCellNIC;

  constructor() {
    super();
    this.nic_ = new TableCellNIC();
  }

  override processInner(context: ProcessContext): void {
    // Get column index from context if not specified
    if (this.nic_.columnIndex === 0) {
      this.nic_.columnIndex = context.currentTableColumn();
    }
    context.noteTableCell(this.nic_.columnIndex, this.nic_.nColumnsSpanned, this.nic_.nRowsSpanned);
    // TODO: fotb.startTableCell(this.nic_);
    super.processInner(context);
    // TODO: fotb.endTableCell();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyColumnIndex:
        case SyntacticKey.keyColumnNumber:
        case SyntacticKey.keyRowNumber:
        case SyntacticKey.keyNColumnsSpanned:
        case SyntacticKey.keyNRowsSpanned:
        case SyntacticKey.keyIsStartsRow:
        case SyntacticKey.keyIsEndsRow:
          return true;
        default:
          break;
      }
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyColumnIndex:
        case SyntacticKey.keyColumnNumber:
          this.nic_.columnIndex = obj.asInteger() ?? 0;
          break;
        case SyntacticKey.keyRowNumber:
          // Row number - currently not stored but accepted
          break;
        case SyntacticKey.keyNColumnsSpanned:
          this.nic_.nColumnsSpanned = obj.asInteger() ?? 1;
          break;
        case SyntacticKey.keyNRowsSpanned:
          this.nic_.nRowsSpanned = obj.asInteger() ?? 1;
          break;
        case SyntacticKey.keyIsStartsRow:
        case SyntacticKey.keyIsEndsRow:
          // Boolean flags - currently not stored but accepted
          break;
        default:
          break;
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new TableCellFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Sideline flow object
export class SidelineFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startSideline();
    super.processInner(context);
    fotb.endSideline();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new SidelineFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Score flow object - for underlines, overlines, strikethrough
export class ScoreFlowObj extends CompoundFlowObj {
  private type_: { kind: 'symbol'; value: Symbol } | { kind: 'length'; value: LengthSpec } | { kind: 'char'; value: Char } | null = null;

  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    if (this.type_) {
      switch (this.type_.kind) {
        case 'symbol':
          fotb.startScoreSymbol(this.type_.value);
          break;
        case 'length':
          fotb.startScoreLengthSpec(this.type_.value);
          break;
        case 'char':
          fotb.startScoreChar(this.type_.value);
          break;
      }
    } else {
      fotb.startSequence();
    }
    super.processInner(context);
    if (this.type_) {
      fotb.endScore();
    } else {
      fotb.endSequence();
    }
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    return ident.syntacticKey(keyRef) && keyRef.value === SyntacticKey.keyType;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    // Try char value first
    const charVal = obj.charValue();
    if (charVal.result) {
      this.type_ = { kind: 'char', value: charVal.ch };
      return;
    }
    // Try as length
    const quantVal = obj.quantityValue();
    if (quantVal.type !== QuantityType.noQuantity && quantVal.dim === 1) {
      const n = quantVal.type === QuantityType.longQuantity ? quantVal.longVal : Math.floor(quantVal.doubleVal);
      this.type_ = { kind: 'length', value: new LengthSpec(n) };
      return;
    }
    // Try as symbol (before/through/after)
    const sym = obj.asSymbol();
    if (sym) {
      const nameStr = sym.name().toStyleString();
      if (nameStr === 'before') {
        this.type_ = { kind: 'symbol', value: Symbol.symbolBefore };
      } else if (nameStr === 'through') {
        this.type_ = { kind: 'symbol', value: Symbol.symbolThrough };
      } else if (nameStr === 'after') {
        this.type_ = { kind: 'symbol', value: Symbol.symbolAfter };
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new ScoreFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    copy.type_ = this.type_;
    return copy;
  }
}

// Table border flow object - provides style for table borders
export class TableBorderFlowObj extends FlowObj {
  constructor() {
    super();
  }

  process(_context: ProcessContext): void {
    // Table border flow object does nothing in process
  }

  processInner(_context: ProcessContext): void {
    // Table border flow object does nothing in processInner
  }

  override tableBorderStyle(style: { obj: StyleObj | null }): boolean {
    style.obj = this.style_;
    return true;
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new TableBorderFlowObj();
    copy.style_ = this.style_;
    return copy;
  }
}

// Simple page sequence flow object
export class SimplePageSequenceFlowObj extends CompoundFlowObj {
  private static readonly nParts = 6;
  private static readonly nPageTypeBits = 2;
  private hf_: (SosofoObj | null)[];

  constructor() {
    super();
    this.hasSubObjects_ = true;
    this.hf_ = new Array(SimplePageSequenceFlowObj.nParts).fill(null);
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    const hfFotb: (FOTBuilder | null)[] = new Array(HF.nHF).fill(null);
    fotb.startSimplePageSequence(hfFotb);
    // TODO: Implement full header/footer processing with page types
    // For now, just end header/footer and process main content
    fotb.endSimplePageSequenceHeaderFooter();
    super.processInner(context);
    fotb.endSimplePageSequence();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyLeftHeader:
        case SyntacticKey.keyCenterHeader:
        case SyntacticKey.keyRightHeader:
        case SyntacticKey.keyLeftFooter:
        case SyntacticKey.keyCenterFooter:
        case SyntacticKey.keyRightFooter:
          return true;
        default:
          break;
      }
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const sosofo = obj.asSosofo();
    if (!sosofo) return;
    const nPageTypeBits = SimplePageSequenceFlowObj.nPageTypeBits;
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyLeftHeader:
          this.hf_[(HF.leftHF | HF.headerHF) >> nPageTypeBits] = sosofo;
          break;
        case SyntacticKey.keyCenterHeader:
          this.hf_[(HF.centerHF | HF.headerHF) >> nPageTypeBits] = sosofo;
          break;
        case SyntacticKey.keyRightHeader:
          this.hf_[(HF.rightHF | HF.headerHF) >> nPageTypeBits] = sosofo;
          break;
        case SyntacticKey.keyLeftFooter:
          this.hf_[(HF.leftHF | HF.footerHF) >> nPageTypeBits] = sosofo;
          break;
        case SyntacticKey.keyCenterFooter:
          this.hf_[(HF.centerHF | HF.footerHF) >> nPageTypeBits] = sosofo;
          break;
        case SyntacticKey.keyRightFooter:
          this.hf_[(HF.rightHF | HF.footerHF) >> nPageTypeBits] = sosofo;
          break;
        default:
          break;
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new SimplePageSequenceFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    copy.hf_ = [...this.hf_];
    return copy;
  }
}

// Math sequence flow object
export class MathSequenceFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startMathSequence();
    super.processInner(context);
    fotb.endMathSequence();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new MathSequenceFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Fraction flow object
export class FractionFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    const numerator = { ref: null as FOTBuilder | null };
    const denominator = { ref: null as FOTBuilder | null };
    fotb.startFraction(numerator, denominator);
    // TODO: handle fractionBarStyle
    fotb.fractionBar();
    // Process content with ports for numerator/denominator
    super.processInner(context);
    fotb.endFraction();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new FractionFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Unmath flow object - for non-math content within math
export class UnmathFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startUnmath();
    super.processInner(context);
    fotb.endUnmath();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new UnmathFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Superscript flow object
export class SuperscriptFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startSuperscript();
    super.processInner(context);
    fotb.endSuperscript();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new SuperscriptFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Subscript flow object
export class SubscriptFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startSubscript();
    super.processInner(context);
    fotb.endSubscript();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new SubscriptFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Script flow object - for complex scripts with pre/post/mid super/subscripts
export class ScriptFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    const preSup = { ref: null as FOTBuilder | null };
    const preSub = { ref: null as FOTBuilder | null };
    const postSup = { ref: null as FOTBuilder | null };
    const postSub = { ref: null as FOTBuilder | null };
    const midSup = { ref: null as FOTBuilder | null };
    const midSub = { ref: null as FOTBuilder | null };
    fotb.startScript(preSup, preSub, postSup, postSub, midSup, midSub);
    // TODO: proper port handling
    super.processInner(context);
    fotb.endScript();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new ScriptFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Mark flow object - for over/under marks
export class MarkFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    const overMark = { ref: null as FOTBuilder | null };
    const underMark = { ref: null as FOTBuilder | null };
    fotb.startMark(overMark, underMark);
    // TODO: proper port handling
    super.processInner(context);
    fotb.endMark();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new MarkFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Fence flow object - for delimiters (parentheses, brackets, etc.)
export class FenceFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    const open = { ref: null as FOTBuilder | null };
    const close = { ref: null as FOTBuilder | null };
    fotb.startFence(open, close);
    // TODO: proper port handling
    super.processInner(context);
    fotb.endFence();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new FenceFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Radical flow object - for square roots and nth roots
export class RadicalFlowObj extends CompoundFlowObj {
  private radical_: SosofoObj | null = null;

  constructor() {
    super();
    this.hasSubObjects_ = true;
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    const degree = { ref: null as FOTBuilder | null };
    fotb.startRadical(degree);
    // TODO: handle radical_ characteristic
    fotb.radicalRadicalDefaulted();
    // TODO: proper port handling for degree
    super.processInner(context);
    fotb.endRadical();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    return ident.syntacticKey(keyRef) && keyRef.value === SyntacticKey.keyRadical;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef) && keyRef.value === SyntacticKey.keyRadical) {
      this.radical_ = obj.asSosofo();
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new RadicalFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    copy.radical_ = this.radical_;
    return copy;
  }
}

// Math operator flow object - for integrals, summations, etc.
export class MathOperatorFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    const oper = { ref: null as FOTBuilder | null };
    const lowerLimit = { ref: null as FOTBuilder | null };
    const upperLimit = { ref: null as FOTBuilder | null };
    fotb.startMathOperator(oper, lowerLimit, upperLimit);
    // TODO: proper port handling
    super.processInner(context);
    fotb.endMathOperator();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new MathOperatorFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Grid flow object
export class GridFlowObj extends CompoundFlowObj {
  private nic_: GridNIC;

  constructor() {
    super();
    this.nic_ = new GridNIC();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startGrid(this.nic_);
    super.processInner(context);
    fotb.endGrid();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyGridNColumns:
        case SyntacticKey.keyGridNRows:
          return true;
        default:
          break;
      }
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const quantVal = obj.quantityValue();
    if (quantVal.type !== QuantityType.longQuantity) return;
    const n = quantVal.longVal;
    if (n <= 0) return;
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyGridNColumns:
          this.nic_.nColumns = n;
          break;
        case SyntacticKey.keyGridNRows:
          this.nic_.nRows = n;
          break;
        default:
          break;
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new GridFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Grid cell flow object
export class GridCellFlowObj extends CompoundFlowObj {
  private nic_: GridCellNIC;

  constructor() {
    super();
    this.nic_ = new GridCellNIC();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startGridCell(this.nic_);
    super.processInner(context);
    fotb.endGridCell();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyColumnNumber:
        case SyntacticKey.keyRowNumber:
          return true;
        default:
          break;
      }
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const quantVal = obj.quantityValue();
    if (quantVal.type !== QuantityType.longQuantity) return;
    const n = quantVal.longVal;
    if (n <= 0) return;
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef)) {
      switch (keyRef.value) {
        case SyntacticKey.keyColumnNumber:
          this.nic_.columnNumber = n;
          break;
        case SyntacticKey.keyRowNumber:
          this.nic_.rowNumber = n;
          break;
        default:
          break;
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new GridCellFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    Object.assign(copy.nic_, this.nic_);
    return copy;
  }
}

// Formatting instruction flow object (for backend-specific instructions)
export class FormattingInstructionFlowObj extends FlowObj {
  private instruction_: string = '';

  constructor() {
    super();
  }

  processInner(context: ProcessContext): void {
    context.fotBuilder().formattingInstruction(this.instruction_);
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef) && keyRef.value === SyntacticKey.keyData) {
      return true;
    }
    return false;
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const keyRef = { value: SyntacticKey.notKey };
    if (ident.syntacticKey(keyRef) && keyRef.value === SyntacticKey.keyData) {
      const strData = obj.stringData();
      if (strData.result) {
        this.instruction_ = uint32ArrayToString(strData.data, strData.length);
      }
    }
  }

  copy(_interp: Interpreter): FlowObj {
    const copy = new FormattingInstructionFlowObj();
    copy.style_ = this.style_;
    copy.instruction_ = this.instruction_;
    return copy;
  }
}

// Entity flow object - for Transform backend output file redirection
// This is an extension flow object from UNREGISTERED::James Clark//Flow Object Class::entity
export class EntityFlowObj extends CompoundFlowObj {
  private systemId_: StringC;

  constructor() {
    super();
    this.systemId_ = new StringOf<Char>(null, 0);
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startEntity(this.systemId_);
    super.processInner(context);
    fotb.endEntity();
  }

  override hasNonInheritedC(ident: Identifier): boolean {
    // Check if the identifier name is "system-id"
    const nameStr = stringCToString(ident.name());
    return nameStr === 'system-id';
  }

  override setNonInheritedC(ident: Identifier, obj: ELObj, _loc: Location, _interp: Interpreter): void {
    const nameStr = stringCToString(ident.name());
    if (nameStr === 'system-id') {
      const strData = obj.stringData();
      if (strData.result) {
        // Convert Uint32Array to Char[] for StringOf constructor
        const chars: Char[] = [];
        for (let i = 0; i < strData.length; i++) {
          chars.push(strData.data[i]);
        }
        this.systemId_ = new StringOf<Char>(chars, chars.length);
      }
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new EntityFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    // Copy the systemId_
    const ptr = this.systemId_.ptr_;
    const len = this.systemId_.size();
    if (ptr && len > 0) {
      const chars: Char[] = [];
      for (let i = 0; i < len; i++) {
        chars.push(ptr[i]);
      }
      copy.systemId_ = new StringOf<Char>(chars, chars.length);
    }
    return copy;
  }
}

// UnknownFlowObj - placeholder for undeclared or unimplemented flow object classes
// Extends CompoundFlowObj to support content (most extension flow objects have content)
export class UnknownFlowObj extends CompoundFlowObj {
  private name_: string = '';

  constructor(name?: string) {
    super();
    if (name) this.name_ = name;
  }

  override processInner(context: ProcessContext): void {
    // Unknown flow objects - process their content as a sequence
    const content = this.getContent();
    if (content) {
      context.fotBuilder().startSequence();
      content.process(context);
      context.fotBuilder().endSequence();
    }
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new UnknownFlowObj(this.name_);
    copy.style_ = this.style_;
    return copy;
  }

  override setNonInheritedC(_nic: any, _obj: ELObj, _loc: Location, _interp: Interpreter): void {
    // Silently ignore characteristics on unknown flow objects
  }
}

// Flow object factory - creates flow objects by name
export function createFlowObj(name: string): FlowObj | null {
  switch (name) {
    case 'sequence':
      return new SequenceFlowObj();
    case 'display-group':
      return new DisplayGroupFlowObj();
    case 'paragraph':
      return new ParagraphFlowObj();
    case 'paragraph-break':
      return new ParagraphBreakFlowObj();
    case 'line-field':
      return new LineFieldFlowObj();
    case 'score':
      return new ScoreFlowObj();
    case 'external-graphic':
      return new ExternalGraphicFlowObj();
    case 'rule':
      return new RuleFlowObj();
    case 'leader':
      return new LeaderFlowObj();
    case 'character':
      return new CharacterFlowObj();
    case 'box':
      return new BoxFlowObj();
    case 'alignment-point':
      return new AlignmentPointFlowObj();
    case 'sideline':
      return new SidelineFlowObj();
    case 'simple-page-sequence':
      return new SimplePageSequenceFlowObj();
    case 'table':
      return new TableFlowObj();
    case 'table-part':
      return new TablePartFlowObj();
    case 'table-column':
      return new TableColumnFlowObj();
    case 'table-row':
      return new TableRowFlowObj();
    case 'table-cell':
      return new TableCellFlowObj();
    case 'table-border':
      return new TableBorderFlowObj();
    case 'link':
      return new LinkFlowObj();
    case 'scroll':
      return new ScrollFlowObj();
    case 'marginalia':
      return new MarginaliaFlowObj();
    case 'multi-mode':
      return new MultiModeFlowObj();
    case 'math-sequence':
      return new MathSequenceFlowObj();
    case 'fraction':
      return new FractionFlowObj();
    case 'unmath':
      return new UnmathFlowObj();
    case 'superscript':
      return new SuperscriptFlowObj();
    case 'subscript':
      return new SubscriptFlowObj();
    case 'script':
      return new ScriptFlowObj();
    case 'mark':
      return new MarkFlowObj();
    case 'fence':
      return new FenceFlowObj();
    case 'radical':
      return new RadicalFlowObj();
    case 'math-operator':
      return new MathOperatorFlowObj();
    case 'grid':
      return new GridFlowObj();
    case 'grid-cell':
      return new GridCellFlowObj();
    case 'formatting-instruction':
      return new FormattingInstructionFlowObj();
    default:
      return null;
  }
}
