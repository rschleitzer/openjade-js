// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, StringC, Char } from '@openjade-js/opensp';
import { ELObj, SymbolObj } from './ELObj';
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
  DisplaySpace
} from './FOTBuilder';
import { StyleObj } from './Style';
import { FlowObj, CompoundFlowObj, SosofoObj, ProcessContext } from './SosofoObj';
import { Identifier, SyntacticKey } from './Identifier';
import type { Interpreter } from './Interpreter';

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
      case SyntacticKey.keyBreakBefore:
        // TODO: Convert enum value
        return true;
      case SyntacticKey.keyBreakAfter:
        // TODO: Convert enum value
        return true;
      case SyntacticKey.keyIsMayViolateKeepBefore:
        nic.mayViolateKeepBefore = obj.isTrue();
        return true;
      case SyntacticKey.keyIsMayViolateKeepAfter:
        nic.mayViolateKeepAfter = obj.isTrue();
        return true;
      case SyntacticKey.keySpaceBefore:
      case SyntacticKey.keySpaceAfter:
        // TODO: Convert display space
        return true;
      default:
        break;
    }
  }
  return false;
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
        this.nic_.coalesceId = String.fromCharCode(...strData.data.slice(0, strData.length));
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
                this.nic_.entitySystemId = String.fromCharCode(...strData.data.slice(0, strData.length));
              }
            }
            break;
          case SyntacticKey.keyNotationSystemId:
            {
              const strData = obj.stringData();
              if (strData) {
                this.nic_.notationSystemId = String.fromCharCode(...strData.data.slice(0, strData.length));
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
        case SyntacticKey.keyWidth:
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
          case SyntacticKey.keyWidth:
            // TODO: Parse width specification
            break;
          default:
            break;
        }
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
        case SyntacticKey.keyNColumnsSpanned:
        case SyntacticKey.keyNRowsSpanned:
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
          this.nic_.columnIndex = obj.asInteger() ?? 0;
          break;
        case SyntacticKey.keyNColumnsSpanned:
          this.nic_.nColumnsSpanned = obj.asInteger() ?? 1;
          break;
        case SyntacticKey.keyNRowsSpanned:
          this.nic_.nRowsSpanned = obj.asInteger() ?? 1;
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
      if (strData) {
        this.instruction_ = String.fromCharCode(...strData.data.slice(0, strData.length));
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

// Flow object factory - creates flow objects by name
export function createFlowObj(name: string): FlowObj | null {
  switch (name) {
    case 'display-group':
      return new DisplayGroupFlowObj();
    case 'paragraph':
      return new ParagraphFlowObj();
    case 'paragraph-break':
      return new ParagraphBreakFlowObj();
    case 'external-graphic':
      return new ExternalGraphicFlowObj();
    case 'rule':
      return new RuleFlowObj();
    case 'alignment-point':
      return new AlignmentPointFlowObj();
    case 'line-field':
      return new LineFieldFlowObj();
    case 'link':
      return new LinkFlowObj();
    case 'scroll':
      return new ScrollFlowObj();
    case 'marginalia':
      return new MarginaliaFlowObj();
    case 'multi-mode':
      return new MultiModeFlowObj();
    case 'box':
      return new BoxFlowObj();
    case 'leader':
      return new LeaderFlowObj();
    case 'character':
      return new CharacterFlowObj();
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
    case 'formatting-instruction':
      return new FormattingInstructionFlowObj();
    default:
      return null;
  }
}
