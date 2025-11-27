// Copyright (c) 1996, 1997 James Clark
// See the file copying.txt for copying permission.

import { Char } from '@openjade-js/opensp';
import { GroveString, NodePtr } from '../grove/Node';

// Simple string type for style module - uses native JavaScript strings where possible
// and Uint32Array for character data
export type StyleString = string;

// FOTBuilder Symbol enum - formatting object tree symbols
export enum Symbol {
  symbolFalse = 0,
  symbolTrue,
  symbolNotApplicable,
  // Font weight/expansion (in increasing order)
  symbolUltraCondensed,
  symbolExtraCondensed,
  symbolCondensed,
  symbolSemiCondensed,
  symbolUltraLight,
  symbolExtraLight,
  symbolLight,
  symbolSemiLight,
  symbolMedium,
  symbolSemiExpanded,
  symbolExpanded,
  symbolExtraExpanded,
  symbolUltraExpanded,
  symbolSemiBold,
  symbolBold,
  symbolExtraBold,
  symbolUltraBold,
  // Font posture
  symbolUpright,
  symbolOblique,
  symbolBackSlantedOblique,
  symbolItalic,
  symbolBackSlantedItalic,
  // Alignment
  symbolStart,
  symbolEnd,
  symbolCenter,
  symbolJustify,
  symbolSpreadInside,
  symbolSpreadOutside,
  symbolPageInside,
  symbolPageOutside,
  // Line breaking
  symbolWrap,
  symbolAsis,
  symbolAsisWrap,
  symbolAsisTruncate,
  symbolNone,
  // Position
  symbolBefore,
  symbolThrough,
  symbolAfter,
  // Direction
  symbolTopToBottom,
  symbolLeftToRight,
  symbolBottomToTop,
  symbolRightToLeft,
  symbolInside,
  symbolOutside,
  symbolHorizontal,
  symbolVertical,
  symbolEscapement,
  symbolLineProgression,
  // Math
  symbolMath,
  symbolOrdinary,
  symbolOperator,
  symbolBinary,
  symbolRelation,
  symbolOpening,
  symbolClosing,
  symbolPunctuation,
  symbolInner,
  symbolSpace,
  // Page regions
  symbolPage,
  symbolPageRegion,
  symbolColumnSet,
  symbolColumn,
  // Size
  symbolMax,
  symbolMaxUniform,
  // Line join/cap
  symbolMiter,
  symbolRound,
  symbolBevel,
  symbolButt,
  symbolSquare,
  // Spacing
  symbolLoose,
  symbolNormal,
  symbolKern,
  symbolTight,
  symbolTouch,
  // Whitespace
  symbolPreserve,
  symbolCollapse,
  symbolIgnore,
  // Display mode
  symbolRelative,
  symbolDisplay,
  symbolInline,
  symbolBorder,
  symbolBackground,
  symbolBoth,
  symbolBase,
  symbolFont,
  symbolTop,
  symbolBottom,
  symbolSpread,
  symbolSolid,
  symbolOutline,
  symbolWith,
  symbolAgainst,
  symbolForce,
  symbolIndependent,
  symbolPile,
  symbolSupOut,
  symbolSubOut,
  symbolLeadEdge,
  symbolTrailEdge,
  symbolExplicit,
  symbolRowMajor,
  symbolColumnMajor
}

export const nSymbols = Symbol.symbolColumnMajor + 1;

export type PublicId = string | null;
export type Letter2 = number;
export type Length = number;

// Glyph identifier
export class GlyphId {
  publicId: PublicId;
  suffix: number;

  constructor(publicId: PublicId = null, suffix: number = 0) {
    this.publicId = publicId;
    this.suffix = suffix;
  }
}

// Glyph substitution table
export class GlyphSubstTable {
  uniqueId: number = 0;
  pairs: GlyphId[] = [];

  subst(glyph: GlyphId): GlyphId {
    // Find substitution in pairs
    for (let i = 0; i < this.pairs.length - 1; i += 2) {
      const from = this.pairs[i];
      const to = this.pairs[i + 1];
      if (from.publicId === glyph.publicId && from.suffix === glyph.suffix) {
        return to;
      }
    }
    return glyph;
  }
}

// Length specification with display size factor
export class LengthSpec {
  length: Length;
  displaySizeFactor: number;

  constructor(len: Length = 0, displaySizeFactor: number = 0.0) {
    this.length = len;
    this.displaySizeFactor = displaySizeFactor;
  }

  toBoolean(): boolean {
    return this.length !== 0 || this.displaySizeFactor !== 0.0;
  }
}

// Table length specification with table unit factor
export class TableLengthSpec extends LengthSpec {
  tableUnitFactor: number = 0.0;

  constructor() {
    super();
  }
}

// Optional length specification
export class OptLengthSpec {
  hasLength: boolean = false;
  length: LengthSpec = new LengthSpec();
}

// Display space specification
export class DisplaySpace {
  nominal: LengthSpec = new LengthSpec();
  min: LengthSpec = new LengthSpec();
  max: LengthSpec = new LengthSpec();
  priority: number = 0;
  conditional: boolean = true;
  force: boolean = false;
}

// Inline space specification
export class InlineSpace {
  nominal: LengthSpec = new LengthSpec();
  min: LengthSpec = new LengthSpec();
  max: LengthSpec = new LengthSpec();
}

// Optional inline space
export class OptInlineSpace {
  hasSpace: boolean = false;
  space: InlineSpace = new InlineSpace();
}

// Non-inherited characteristics for displayed flow objects
export class DisplayNIC {
  spaceBefore: DisplaySpace = new DisplaySpace();
  spaceAfter: DisplaySpace = new DisplaySpace();
  positionPreference: Symbol = Symbol.symbolFalse;
  keep: Symbol = Symbol.symbolFalse;
  breakBefore: Symbol = Symbol.symbolFalse;
  breakAfter: Symbol = Symbol.symbolFalse;
  keepWithPrevious: boolean = false;
  keepWithNext: boolean = false;
  mayViolateKeepBefore: boolean = false;
  mayViolateKeepAfter: boolean = false;
}

// Inline non-inherited characteristics
export class InlineNIC {
  breakBeforePriority: number = 0;
  breakAfterPriority: number = 0;
}

// Display group NIC
export class DisplayGroupNIC extends DisplayNIC {
  hasCoalesceId: boolean = false;
  coalesceId: StyleString = '';
}

// External graphic NIC
export class ExternalGraphicNIC extends DisplayNIC {
  isDisplay: boolean = false;
  scaleType: Symbol = Symbol.symbolFalse;
  scale: [number, number] = [1.0, 1.0];
  entitySystemId: StyleString = '';
  notationSystemId: StyleString = '';
  hasMaxWidth: boolean = false;
  maxWidth: LengthSpec = new LengthSpec();
  hasMaxHeight: boolean = false;
  maxHeight: LengthSpec = new LengthSpec();
  escapementDirection: Symbol = Symbol.symbolFalse;
  positionPointX: LengthSpec = new LengthSpec();
  positionPointY: LengthSpec = new LengthSpec();
  breakBeforePriority: number = 0;
  breakAfterPriority: number = 0;
}

// Box NIC
export class BoxNIC extends DisplayNIC {
  isDisplay: boolean = false;
  breakBeforePriority: number = 0;
  breakAfterPriority: number = 0;
}

// Rule NIC
export class RuleNIC extends DisplayNIC {
  orientation: Symbol = Symbol.symbolHorizontal;
  hasLength: boolean = false;
  length: LengthSpec = new LengthSpec();
  breakBeforePriority: number = 0;
  breakAfterPriority: number = 0;
}

// Leader NIC
export class LeaderNIC extends InlineNIC {
  hasLength: boolean = false;
  length: LengthSpec = new LengthSpec();
}

// Paragraph NIC (same as DisplayNIC)
export type ParagraphNIC = DisplayNIC;

// Character NIC
export class CharacterNIC {
  static readonly cIsDropAfterLineBreak = 0;
  static readonly cIsDropUnlessBeforeLineBreak = 1;
  static readonly cIsPunct = 2;
  static readonly cIsInputWhitespace = 3;
  static readonly cIsInputTab = 4;
  static readonly cIsRecordEnd = 5;
  static readonly cIsSpace = 6;
  static readonly cChar = 7;
  static readonly cGlyphId = 8;
  static readonly cScript = 9;
  static readonly cMathClass = 10;
  static readonly cMathFontPosture = 11;
  static readonly cBreakBeforePriority = 12;
  static readonly cBreakAfterPriority = 13;

  valid: boolean = false;
  specifiedC: number = 0;
  ch: Char = 0;
  glyphId: GlyphId = new GlyphId();
  breakBeforePriority: number = 0;
  breakAfterPriority: number = 0;
  mathClass: Symbol = Symbol.symbolOrdinary;
  mathFontPosture: Symbol = Symbol.symbolFalse;
  script: PublicId = null;
  isDropAfterLineBreak: boolean = false;
  isDropUnlessBeforeLineBreak: boolean = false;
  isPunct: boolean = false;
  isInputWhitespace: boolean = false;
  isInputTab: boolean = false;
  isRecordEnd: boolean = false;
  isSpace: boolean = false;
  stretchFactor: number = 1.0;
}

// Line field NIC (same as InlineNIC)
export type LineFieldNIC = InlineNIC;

// Table NIC
export class TableNIC extends DisplayNIC {
  static readonly widthFull = 0;
  static readonly widthMinimum = 1;
  static readonly widthExplicit = 2;

  widthType: number = TableNIC.widthFull;
  width: LengthSpec = new LengthSpec();
}

// Table part NIC (same as DisplayNIC)
export type TablePartNIC = DisplayNIC;

// Table column NIC
export class TableColumnNIC {
  columnIndex: number = 0;
  nColumnsSpanned: number = 1;
  hasWidth: boolean = false;
  width: TableLengthSpec = new TableLengthSpec();
}

// Table cell NIC
export class TableCellNIC {
  missing: boolean = false;
  columnIndex: number = 0;
  nColumnsSpanned: number = 1;
  nRowsSpanned: number = 1;
}

// Device RGB color
export class DeviceRGBColor {
  red: number = 0;
  green: number = 0;
  blue: number = 0;
}

// Multi-mode specification
export class MultiMode {
  hasDesc: boolean = false;
  name: StyleString = '';
  desc: StyleString = '';
}

// Address for links
export class Address {
  static readonly Type = {
    none: 0,
    resolvedNode: 1,
    idref: 2,
    entity: 3,
    sgmlDocument: 4,
    hytimeLinkend: 5,
    tei: 6,
    html: 7
  } as const;

  type: number;
  node: NodePtr | null;
  params: [StyleString, StyleString, StyleString];

  constructor(
    type: number = Address.Type.none,
    node: NodePtr | null = null,
    param0: StyleString = '',
    param1: StyleString = '',
    param2: StyleString = ''
  ) {
    this.type = type;
    this.node = node;
    this.params = [param0, param1, param2];
  }
}

// Abstract FOTBuilder class
export abstract class FOTBuilder {
  asSaveFOTBuilder(): SaveFOTBuilder | null {
    return null;
  }

  // Default for compound flow objects
  start(): void {}
  end(): void {}

  // Default for atomic flow objects
  atomic(): void {
    this.start();
    this.end();
  }

  // Atomic flow objects
  characters(_s: Uint32Array, _n: number): void {}
  charactersFromNode(_node: NodePtr, s: Uint32Array, n: number): void {
    this.characters(s, n);
  }
  character(_nic: CharacterNIC): void {}
  paragraphBreak(_nic: ParagraphNIC): void {}
  externalGraphic(_nic: ExternalGraphicNIC): void {}
  rule(_nic: RuleNIC): void {}
  alignmentPoint(): void {}
  formattingInstruction(_s: StyleString): void {}

  // Non-atomic flow objects
  startSequence(): void {}
  endSequence(): void {}
  startLineField(_nic: LineFieldNIC): void {}
  endLineField(): void {}
  startParagraph(_nic: ParagraphNIC): void {}
  endParagraph(): void {}
  startDisplayGroup(_nic: DisplayGroupNIC): void {}
  endDisplayGroup(): void {}
  startScroll(): void {}
  endScroll(): void {}
  startLink(_addr: Address): void {}
  endLink(): void {}
  startMarginalia(): void {}
  endMarginalia(): void {}
  startMultiMode(_modes: MultiMode[]): void {}
  endMultiMode(): void {}

  // Inherited characteristics setters (to be extended)
  setFontSize(_size: Length): void {}
  setFontFamilyName(_name: StyleString): void {}
  setFontWeight(_weight: Symbol): void {}
  setFontPosture(_posture: Symbol): void {}
  setStartIndent(_indent: LengthSpec): void {}
  setEndIndent(_indent: LengthSpec): void {}
  setFirstLineStartIndent(_indent: LengthSpec): void {}
  setLastLineEndIndent(_indent: LengthSpec): void {}
  setLineSpacing(_spacing: LengthSpec): void {}
  setFieldWidth(_width: LengthSpec): void {}
  setQuadding(_quad: Symbol): void {}
  setDisplayAlignment(_align: Symbol): void {}
  setFieldAlign(_align: Symbol): void {}
  setColor(_color: DeviceRGBColor): void {}
  setBackgroundColor(_color: DeviceRGBColor): void {}
  setLines(_lines: Symbol): void {}
  setWritingMode(_mode: Symbol): void {}
  setLanguage(_lang: Letter2): void {}
  setCountry(_country: Letter2): void {}
}

// SaveFOTBuilder - for saving FOT to replay later
export abstract class SaveFOTBuilder extends FOTBuilder {
  abstract emit(_builder: FOTBuilder): void;
}
