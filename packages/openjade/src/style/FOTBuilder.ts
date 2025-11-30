// Copyright (c) 1996, 1997 James Clark
// See the file copying.txt for copying permission.

import { Char, StringC } from '@openjade-js/opensp';
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

// Symbol names matching the order in Symbol enum (starting at index 2)
const symbolNameTable: string[] = [
  'not-applicable', 'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed',
  'ultra-light', 'extra-light', 'light', 'semi-light', 'medium',
  'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded',
  'semi-bold', 'bold', 'extra-bold', 'ultra-bold',
  'upright', 'oblique', 'back-slanted-oblique', 'italic', 'back-slanted-italic',
  'start', 'end', 'center', 'justify',
  'spread-inside', 'spread-outside', 'page-inside', 'page-outside',
  'wrap', 'asis', 'asis-wrap', 'asis-truncate', 'none',
  'before', 'through', 'after',
  'top-to-bottom', 'left-to-right', 'bottom-to-top', 'right-to-left',
  'inside', 'outside', 'horizontal', 'vertical', 'escapement', 'line-progression',
  'math', 'ordinary', 'operator', 'binary', 'relation', 'opening', 'closing', 'punctuation', 'inner', 'space',
  'page', 'page-region', 'column-set', 'column', 'max', 'max-uniform',
  'miter', 'round', 'bevel', 'butt', 'square',
  'loose', 'normal', 'kern', 'tight', 'touch',
  'preserve', 'collapse', 'ignore',
  'relative', 'display', 'inline', 'border', 'background', 'both',
  'base', 'font', 'top', 'bottom', 'spread', 'solid', 'outline',
  'with', 'against', 'force', 'independent', 'pile', 'sup-out', 'sub-out',
  'lead-edge', 'trail-edge', 'explicit', 'row-major', 'column-major'
];

export function symbolName(sym: Symbol): string | null {
  if (sym < 2 || sym >= nSymbols) {
    return null;
  }
  return symbolNameTable[sym - 2];
}

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

// Grid NIC
export class GridNIC {
  nColumns: number = 1;
  nRows: number = 1;
}

// Grid cell NIC
export class GridCellNIC {
  columnNumber: number = 1;
  rowNumber: number = 1;
}

// Header/footer flags for simple page sequence
export enum HF {
  firstHF = 0o1,
  otherHF = 0,
  frontHF = 0o2,
  backHF = 0,
  headerHF = 0o4,
  footerHF = 0,
  leftHF = 0,
  centerHF = 0o10,
  rightHF = 0o20,
  nHF = 0o30
}

// Abstract FOTBuilder class
export abstract class FOTBuilder {
  asSaveFOTBuilder(): SaveFOTBuilder | null {
    return null;
  }

  // Default for compound flow objects
  start(): void {}
  end(): void {}
  flush(): void {}

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

  // Page number related
  currentNodePageNumber(_node: NodePtr): void {}
  pageNumber(): void {}

  // Node processing markers (for debugging/tracing)
  startNode(_node: NodePtr, _processingMode: StringC): void {}
  endNode(): void {}

  // Score flow objects
  startScoreChar(_c: Char): void {}
  startScoreLengthSpec(_ls: LengthSpec): void {}
  startScoreSymbol(_sym: Symbol): void {}
  endScore(): void {}

  // Leader flow object
  startLeader(_nic: LeaderNIC): void {}
  endLeader(): void {}

  // Sideline flow object
  startSideline(): void {}
  endSideline(): void {}

  // Entity flow object (for Transform backend output redirection)
  startEntity(_systemId: StringC): void {}
  endEntity(): void {}

  // Box flow object
  startBox(_nic: BoxNIC): void {}
  endBox(): void {}

  // Table flow objects
  startTable(_nic: TableNIC): void {}
  endTable(): void {}
  tableBeforeRowBorder(): void {}
  tableAfterRowBorder(): void {}
  tableBeforeColumnBorder(): void {}
  tableAfterColumnBorder(): void {}
  startTablePart(_nic: TablePartNIC, _header: { ref: FOTBuilder | null }, _footer: { ref: FOTBuilder | null }): void {}
  endTablePart(): void {}
  tableColumn(_nic: TableColumnNIC): void {}
  startTableRow(): void {}
  endTableRow(): void {}
  startTableCell(_nic: TableCellNIC): void {}
  endTableCell(): void {}
  tableCellBeforeRowBorder(): void {}
  tableCellAfterRowBorder(): void {}
  tableCellBeforeColumnBorder(): void {}
  tableCellAfterColumnBorder(): void {}

  // Math flow objects
  startMathSequence(): void {}
  endMathSequence(): void {}
  startFraction(_numerator: { ref: FOTBuilder | null }, _denominator: { ref: FOTBuilder | null }): void {}
  fractionBar(): void {}
  endFraction(): void {}
  startUnmath(): void {}
  endUnmath(): void {}
  startSuperscript(): void {}
  endSuperscript(): void {}
  startSubscript(): void {}
  endSubscript(): void {}
  startScript(
    _preSup: { ref: FOTBuilder | null },
    _preSub: { ref: FOTBuilder | null },
    _postSup: { ref: FOTBuilder | null },
    _postSub: { ref: FOTBuilder | null },
    _midSup: { ref: FOTBuilder | null },
    _midSub: { ref: FOTBuilder | null }
  ): void {}
  endScript(): void {}
  startMark(_overMark: { ref: FOTBuilder | null }, _underMark: { ref: FOTBuilder | null }): void {}
  endMark(): void {}
  startFence(_open: { ref: FOTBuilder | null }, _close: { ref: FOTBuilder | null }): void {}
  endFence(): void {}
  startRadical(_degree: { ref: FOTBuilder | null }): void {}
  radicalRadical(_nic: CharacterNIC): void {}
  radicalRadicalDefaulted(): void {}
  endRadical(): void {}
  startMathOperator(
    _oper: { ref: FOTBuilder | null },
    _lowerLimit: { ref: FOTBuilder | null },
    _upperLimit: { ref: FOTBuilder | null }
  ): void {}
  endMathOperator(): void {}

  // Grid flow objects
  startGrid(_nic: GridNIC): void {}
  endGrid(): void {}
  startGridCell(_nic: GridCellNIC): void {}
  endGridCell(): void {}

  // Simple page sequence
  startSimplePageSequence(_headerFooter: (FOTBuilder | null)[]): void {}
  endSimplePageSequenceHeaderFooter(): void {}
  endSimplePageSequence(): void {}

  // More inherited characteristic setters
  setMarginaliaSep(_sep: LengthSpec): void {}
  setBorderPresent(_present: boolean): void {}
  setLineThickness(_thickness: Length): void {}
  setCellBeforeRowMargin(_margin: Length): void {}
  setCellAfterRowMargin(_margin: Length): void {}
  setCellBeforeColumnMargin(_margin: Length): void {}
  setCellAfterColumnMargin(_margin: Length): void {}
  setLineSep(_sep: Length): void {}
  setBoxSizeBefore(_size: Length): void {}
  setBoxSizeAfter(_size: Length): void {}
  setPositionPointShift(_shift: LengthSpec): void {}
  setStartMargin(_margin: LengthSpec): void {}
  setEndMargin(_margin: LengthSpec): void {}
  setSidelineSep(_sep: LengthSpec): void {}
  setAsisWrapIndent(_indent: LengthSpec): void {}
  setLineNumberSep(_sep: LengthSpec): void {}
  setLastLineJustifyLimit(_limit: LengthSpec): void {}
  setJustifyGlyphSpaceMaxAdd(_add: LengthSpec): void {}
  setJustifyGlyphSpaceMaxRemove(_remove: LengthSpec): void {}
  setTableCornerRadius(_radius: LengthSpec): void {}
  setBoxCornerRadius(_radius: LengthSpec): void {}
  setMinPreLineSpacing(_spacing: OptLengthSpec): void {}
  setMinPostLineSpacing(_spacing: OptLengthSpec): void {}
  setMinLeading(_leading: OptLengthSpec): void {}
  setInhibitLineBreaks(_inhibit: boolean): void {}
  setHyphenate(_hyphenate: boolean): void {}
  setKern(_kern: boolean): void {}
  setLigature(_ligature: boolean): void {}
  setScoreSpaces(_score: boolean): void {}
  setFloatOutMarginalia(_float: boolean): void {}
  setFloatOutSidelines(_float: boolean): void {}
  setFloatOutLineNumbers(_float: boolean): void {}
  setCellBackground(_bg: boolean): void {}
  setSpanWeak(_weak: boolean): void {}
  setIgnoreRecordEnd(_ignore: boolean): void {}
  setNumberedLines(_numbered: boolean): void {}
  setHangingPunct(_hanging: boolean): void {}
  setBoxOpenEnd(_open: boolean): void {}
  setTruncateLeader(_truncate: boolean): void {}
  setAlignLeader(_align: boolean): void {}
  setTablePartOmitMiddleHeader(_omit: boolean): void {}
  setTablePartOmitMiddleFooter(_omit: boolean): void {}
  setBorderOmitAtBreak(_omit: boolean): void {}
  setPrincipalModeSimultaneous(_sim: boolean): void {}
  setMarginaliaKeepWithPrevious(_keep: boolean): void {}
  setGridEquidistantRows(_equi: boolean): void {}
  setGridEquidistantColumns(_equi: boolean): void {}
  setLineJoin(_join: Symbol): void {}
  setLineCap(_cap: Symbol): void {}
  setLineNumberSide(_side: Symbol): void {}
  setKernMode(_mode: Symbol): void {}
  setInputWhitespaceTreatment(_treatment: Symbol): void {}
  setFillingDirection(_dir: Symbol): void {}
  setLastLineQuadding(_quad: Symbol): void {}
  setMathDisplayMode(_mode: Symbol): void {}
  setScriptPreAlign(_align: Symbol): void {}
  setScriptPostAlign(_align: Symbol): void {}
  setScriptMidSupAlign(_align: Symbol): void {}
  setScriptMidSubAlign(_align: Symbol): void {}
  setNumeratorAlign(_align: Symbol): void {}
  setDenominatorAlign(_align: Symbol): void {}
  setGridPositionCellType(_type: Symbol): void {}
  setGridColumnAlignment(_align: Symbol): void {}
  setGridRowAlignment(_align: Symbol): void {}
  setBoxType(_type: Symbol): void {}
  setGlyphAlignmentMode(_mode: Symbol): void {}
  setBoxBorderAlignment(_align: Symbol): void {}
  setCellRowAlignment(_align: Symbol): void {}
  setBorderAlignment(_align: Symbol): void {}
  setSidelineSide(_side: Symbol): void {}
  setHyphenationKeep(_keep: Symbol): void {}
  setFontStructure(_structure: Symbol): void {}
  setFontProportionateWidth(_width: Symbol): void {}
  setCellCrossed(_crossed: Symbol): void {}
  setMarginaliaSide(_side: Symbol): void {}
  setLayer(_layer: number): void {}
  setBackgroundLayer(_layer: number): void {}
  setBorderPriority(_priority: number): void {}
  setLineRepeat(_repeat: number): void {}
  setSpan(_span: number): void {}
  setMinLeaderRepeat(_repeat: number): void {}
  setHyphenationRemainCharCount(_count: number): void {}
  setHyphenationPushCharCount(_count: number): void {}
  setWidowCount(_count: number): void {}
  setOrphanCount(_count: number): void {}
  setExpandTabs(_tabs: number): void {}
  setHyphenationLadderCount(_count: number): void {}
  setBackgroundTile(_pubid: PublicId): void {}
  setLineBreakingMethod(_pubid: PublicId): void {}
  setLineCompositionMethod(_pubid: PublicId): void {}
  setImplicitBidiMethod(_pubid: PublicId): void {}
  setGlyphSubstMethod(_pubid: PublicId): void {}
  setGlyphReorderMethod(_pubid: PublicId): void {}
  setHyphenationMethod(_pubid: PublicId): void {}
  setTableAutoWidthMethod(_pubid: PublicId): void {}
  setFontName(_pubid: PublicId): void {}
  setEscapementSpaceBefore(_space: InlineSpace): void {}
  setEscapementSpaceAfter(_space: InlineSpace): void {}
  setInlineSpaceSpace(_space: OptInlineSpace): void {}
  setPageWidth(_width: Length): void {}
  setPageHeight(_height: Length): void {}
  setLeftMargin(_margin: Length): void {}
  setRightMargin(_margin: Length): void {}
  setTopMargin(_margin: Length): void {}
  setBottomMargin(_margin: Length): void {}
  setHeaderMargin(_margin: Length): void {}
  setFooterMargin(_margin: Length): void {}
  setGlyphSubstTable(_table: GlyphSubstTable[]): void {}
}

// SaveFOTBuilder - for saving FOT to replay later
export abstract class SaveFOTBuilder extends FOTBuilder {
  abstract emit(_builder: FOTBuilder): void;
}

// Queued action types for ConcreteSaveFOTBuilder
enum SavedActionType {
  characters,
  charactersFromNode,
  character,
  paragraphBreak,
  externalGraphic,
  rule,
  alignmentPoint,
  formattingInstruction,
  startSequence,
  endSequence,
  startLineField,
  endLineField,
  startParagraph,
  endParagraph,
  startDisplayGroup,
  endDisplayGroup,
  startScroll,
  endScroll,
  startLink,
  endLink,
  startMarginalia,
  endMarginalia,
  startMultiMode,
  endMultiMode,
  // ... add more as needed
}

interface SavedAction {
  type: SavedActionType;
  data?: any;
}

// Concrete SaveFOTBuilder that queues actions for later replay
export class ConcreteSaveFOTBuilder extends SaveFOTBuilder {
  private actions_: SavedAction[] = [];

  emit(builder: FOTBuilder): void {
    for (const action of this.actions_) {
      switch (action.type) {
        case SavedActionType.characters:
          builder.characters(action.data.s, action.data.n);
          break;
        case SavedActionType.charactersFromNode:
          builder.charactersFromNode(action.data.node, action.data.s, action.data.n);
          break;
        case SavedActionType.startSequence:
          builder.startSequence();
          break;
        case SavedActionType.endSequence:
          builder.endSequence();
          break;
        case SavedActionType.startParagraph:
          builder.startParagraph(action.data);
          break;
        case SavedActionType.endParagraph:
          builder.endParagraph();
          break;
        case SavedActionType.startDisplayGroup:
          builder.startDisplayGroup(action.data);
          break;
        case SavedActionType.endDisplayGroup:
          builder.endDisplayGroup();
          break;
        case SavedActionType.startScroll:
          builder.startScroll();
          break;
        case SavedActionType.endScroll:
          builder.endScroll();
          break;
        case SavedActionType.startLink:
          builder.startLink(action.data);
          break;
        case SavedActionType.endLink:
          builder.endLink();
          break;
        case SavedActionType.startMarginalia:
          builder.startMarginalia();
          break;
        case SavedActionType.endMarginalia:
          builder.endMarginalia();
          break;
        case SavedActionType.startMultiMode:
          builder.startMultiMode(action.data);
          break;
        case SavedActionType.endMultiMode:
          builder.endMultiMode();
          break;
        case SavedActionType.character:
          builder.character(action.data);
          break;
        case SavedActionType.paragraphBreak:
          builder.paragraphBreak(action.data);
          break;
        case SavedActionType.externalGraphic:
          builder.externalGraphic(action.data);
          break;
        case SavedActionType.rule:
          builder.rule(action.data);
          break;
        case SavedActionType.alignmentPoint:
          builder.alignmentPoint();
          break;
        case SavedActionType.formattingInstruction:
          builder.formattingInstruction(action.data);
          break;
        case SavedActionType.startLineField:
          builder.startLineField(action.data);
          break;
        case SavedActionType.endLineField:
          builder.endLineField();
          break;
        // ... handle more actions as needed
      }
    }
    this.actions_ = [];
  }

  override characters(s: Uint32Array, n: number): void {
    this.actions_.push({ type: SavedActionType.characters, data: { s: new Uint32Array(s), n } });
  }

  override charactersFromNode(node: NodePtr, s: Uint32Array, n: number): void {
    this.actions_.push({ type: SavedActionType.charactersFromNode, data: { node, s: new Uint32Array(s), n } });
  }

  override character(nic: CharacterNIC): void {
    this.actions_.push({ type: SavedActionType.character, data: { ...nic } });
  }

  override paragraphBreak(nic: ParagraphNIC): void {
    this.actions_.push({ type: SavedActionType.paragraphBreak, data: { ...nic } });
  }

  override externalGraphic(nic: ExternalGraphicNIC): void {
    this.actions_.push({ type: SavedActionType.externalGraphic, data: { ...nic } });
  }

  override rule(nic: RuleNIC): void {
    this.actions_.push({ type: SavedActionType.rule, data: { ...nic } });
  }

  override alignmentPoint(): void {
    this.actions_.push({ type: SavedActionType.alignmentPoint });
  }

  override formattingInstruction(s: StyleString): void {
    this.actions_.push({ type: SavedActionType.formattingInstruction, data: s });
  }

  override startSequence(): void {
    this.actions_.push({ type: SavedActionType.startSequence });
  }

  override endSequence(): void {
    this.actions_.push({ type: SavedActionType.endSequence });
  }

  override startLineField(nic: LineFieldNIC): void {
    this.actions_.push({ type: SavedActionType.startLineField, data: { ...nic } });
  }

  override endLineField(): void {
    this.actions_.push({ type: SavedActionType.endLineField });
  }

  override startParagraph(nic: ParagraphNIC): void {
    this.actions_.push({ type: SavedActionType.startParagraph, data: { ...nic } });
  }

  override endParagraph(): void {
    this.actions_.push({ type: SavedActionType.endParagraph });
  }

  override startDisplayGroup(nic: DisplayGroupNIC): void {
    this.actions_.push({ type: SavedActionType.startDisplayGroup, data: { ...nic } });
  }

  override endDisplayGroup(): void {
    this.actions_.push({ type: SavedActionType.endDisplayGroup });
  }

  override startScroll(): void {
    this.actions_.push({ type: SavedActionType.startScroll });
  }

  override endScroll(): void {
    this.actions_.push({ type: SavedActionType.endScroll });
  }

  override startLink(addr: Address): void {
    this.actions_.push({ type: SavedActionType.startLink, data: addr });
  }

  override endLink(): void {
    this.actions_.push({ type: SavedActionType.endLink });
  }

  override startMarginalia(): void {
    this.actions_.push({ type: SavedActionType.startMarginalia });
  }

  override endMarginalia(): void {
    this.actions_.push({ type: SavedActionType.endMarginalia });
  }

  override startMultiMode(modes: MultiMode[]): void {
    this.actions_.push({ type: SavedActionType.startMultiMode, data: [...modes] });
  }

  override endMultiMode(): void {
    this.actions_.push({ type: SavedActionType.endMultiMode });
  }

  override asSaveFOTBuilder(): SaveFOTBuilder | null {
    return this;
  }
}

// SerialFOTBuilder - provides a serial view of multi-port objects
// This uses SaveFOTBuilder to serialize multi-port flow object content
export class SerialFOTBuilder extends FOTBuilder {
  protected save_: SaveFOTBuilder[] = [];
  protected multiModeStack_: MultiMode[][] = [];

  // Non-serial versions that delegate to serial methods
  // Simple page sequence has nHF header/footer ports
  override startSimplePageSequence(headerFooter: (FOTBuilder | null)[]): void {
    // Create nHF SaveFOTBuilders for header/footer collection
    for (let i = 0; i < HF.nHF; i++) {
      const save = new ConcreteSaveFOTBuilder();
      this.save_.push(save);
      headerFooter[HF.nHF - 1 - i] = save;
    }
    this.startSimplePageSequenceSerial();
  }

  override endSimplePageSequenceHeaderFooter(): void {
    // Collect all header/footer SaveFOTBuilders
    const hf: SaveFOTBuilder[] = [];
    for (let k = 0; k < HF.nHF; k++) {
      hf.push(this.save_.pop()!);
    }
    // Reverse to get correct order
    hf.reverse();

    // Output all header/footer parts (in same order as upstream for compatibility)
    for (let i = 0; i < (1 << 2); i++) {
      for (let j = 0; j < 6; j++) {
        const k = i | (j << 2);
        this.startSimplePageSequenceHeaderFooterSerial(k);
        hf[k].emit(this);
        this.endSimplePageSequenceHeaderFooterSerial(k);
      }
    }
    this.endAllSimplePageSequenceHeaderFooter();
  }

  override endSimplePageSequence(): void {
    this.endSimplePageSequenceSerial();
  }

  startTablePart(nic: TablePartNIC, header: { ref: FOTBuilder | null }, footer: { ref: FOTBuilder | null }): void {
    const headerSave = new ConcreteSaveFOTBuilder();
    const footerSave = new ConcreteSaveFOTBuilder();
    this.save_.push(headerSave);
    this.save_.push(footerSave);
    header.ref = headerSave;
    footer.ref = footerSave;
    this.startTablePartSerial(nic);
  }

  override endTablePart(): void {
    const footer = this.save_.pop()!;
    const header = this.save_.pop()!;
    this.startTablePartHeader();
    header.emit(this);
    this.endTablePartHeader();
    this.startTablePartFooter();
    footer.emit(this);
    this.endTablePartFooter();
    this.endTablePartSerial();
  }

  override startFraction(numerator: { ref: FOTBuilder | null }, denominator: { ref: FOTBuilder | null }): void {
    const numSave = new ConcreteSaveFOTBuilder();
    const denSave = new ConcreteSaveFOTBuilder();
    this.save_.push(numSave);
    this.save_.push(denSave);
    numerator.ref = numSave;
    denominator.ref = denSave;
    this.startFractionSerial();
  }

  override endFraction(): void {
    const denom = this.save_.pop()!;
    const numer = this.save_.pop()!;
    this.startFractionNumerator();
    numer.emit(this);
    this.endFractionNumerator();
    this.startFractionDenominator();
    denom.emit(this);
    this.endFractionDenominator();
    this.endFractionSerial();
  }

  override startScript(
    preSup: { ref: FOTBuilder | null },
    preSub: { ref: FOTBuilder | null },
    postSup: { ref: FOTBuilder | null },
    postSub: { ref: FOTBuilder | null },
    midSup: { ref: FOTBuilder | null },
    midSub: { ref: FOTBuilder | null }
  ): void {
    const saves: ConcreteSaveFOTBuilder[] = [];
    for (let i = 0; i < 6; i++) {
      const s = new ConcreteSaveFOTBuilder();
      saves.push(s);
      this.save_.push(s);
    }
    preSup.ref = saves[0];
    preSub.ref = saves[1];
    postSup.ref = saves[2];
    postSub.ref = saves[3];
    midSup.ref = saves[4];
    midSub.ref = saves[5];
    this.startScriptSerial();
  }

  override endScript(): void {
    const midSub = this.save_.pop()!;
    const midSup = this.save_.pop()!;
    const postSub = this.save_.pop()!;
    const postSup = this.save_.pop()!;
    const preSub = this.save_.pop()!;
    const preSup = this.save_.pop()!;
    this.startScriptPreSup();
    preSup.emit(this);
    this.endScriptPreSup();
    this.startScriptPreSub();
    preSub.emit(this);
    this.endScriptPreSub();
    this.startScriptPostSup();
    postSup.emit(this);
    this.endScriptPostSup();
    this.startScriptPostSub();
    postSub.emit(this);
    this.endScriptPostSub();
    this.startScriptMidSup();
    midSup.emit(this);
    this.endScriptMidSup();
    this.startScriptMidSub();
    midSub.emit(this);
    this.endScriptMidSub();
    this.endScriptSerial();
  }

  override startMark(overMark: { ref: FOTBuilder | null }, underMark: { ref: FOTBuilder | null }): void {
    const overSave = new ConcreteSaveFOTBuilder();
    const underSave = new ConcreteSaveFOTBuilder();
    this.save_.push(overSave);
    this.save_.push(underSave);
    overMark.ref = overSave;
    underMark.ref = underSave;
    this.startMarkSerial();
  }

  override endMark(): void {
    const under = this.save_.pop()!;
    const over = this.save_.pop()!;
    this.startMarkOver();
    over.emit(this);
    this.endMarkOver();
    this.startMarkUnder();
    under.emit(this);
    this.endMarkUnder();
    this.endMarkSerial();
  }

  override startFence(open: { ref: FOTBuilder | null }, close: { ref: FOTBuilder | null }): void {
    const openSave = new ConcreteSaveFOTBuilder();
    const closeSave = new ConcreteSaveFOTBuilder();
    this.save_.push(openSave);
    this.save_.push(closeSave);
    open.ref = openSave;
    close.ref = closeSave;
    this.startFenceSerial();
  }

  override endFence(): void {
    const close = this.save_.pop()!;
    const open = this.save_.pop()!;
    this.startFenceOpen();
    open.emit(this);
    this.endFenceOpen();
    this.startFenceClose();
    close.emit(this);
    this.endFenceClose();
    this.endFenceSerial();
  }

  override startRadical(degree: { ref: FOTBuilder | null }): void {
    const degreeSave = new ConcreteSaveFOTBuilder();
    this.save_.push(degreeSave);
    degree.ref = degreeSave;
    this.startRadicalSerial();
  }

  override endRadical(): void {
    const degree = this.save_.pop()!;
    this.startRadicalDegree();
    degree.emit(this);
    this.endRadicalDegree();
    this.endRadicalSerial();
  }

  override startMathOperator(
    oper: { ref: FOTBuilder | null },
    lowerLimit: { ref: FOTBuilder | null },
    upperLimit: { ref: FOTBuilder | null }
  ): void {
    const operSave = new ConcreteSaveFOTBuilder();
    const lowerSave = new ConcreteSaveFOTBuilder();
    const upperSave = new ConcreteSaveFOTBuilder();
    this.save_.push(operSave);
    this.save_.push(lowerSave);
    this.save_.push(upperSave);
    oper.ref = operSave;
    lowerLimit.ref = lowerSave;
    upperLimit.ref = upperSave;
    this.startMathOperatorSerial();
  }

  override endMathOperator(): void {
    const upper = this.save_.pop()!;
    const lower = this.save_.pop()!;
    const oper = this.save_.pop()!;
    this.startMathOperatorOperator();
    oper.emit(this);
    this.endMathOperatorOperator();
    this.startMathOperatorLowerLimit();
    lower.emit(this);
    this.endMathOperatorLowerLimit();
    this.startMathOperatorUpperLimit();
    upper.emit(this);
    this.endMathOperatorUpperLimit();
    this.endMathOperatorSerial();
  }

  // Serial methods to be overridden by subclasses
  startSimplePageSequenceSerial(): void {}
  endSimplePageSequenceSerial(): void {}
  startSimplePageSequenceHeaderFooterSerial(_flags: number): void {}
  endSimplePageSequenceHeaderFooterSerial(_flags: number): void {}
  endAllSimplePageSequenceHeaderFooter(): void {}

  startFractionSerial(): void {}
  endFractionSerial(): void {}
  startFractionNumerator(): void {}
  endFractionNumerator(): void {}
  startFractionDenominator(): void {}
  endFractionDenominator(): void {}

  startScriptSerial(): void {}
  endScriptSerial(): void {}
  startScriptPreSup(): void {}
  endScriptPreSup(): void {}
  startScriptPreSub(): void {}
  endScriptPreSub(): void {}
  startScriptPostSup(): void {}
  endScriptPostSup(): void {}
  startScriptPostSub(): void {}
  endScriptPostSub(): void {}
  startScriptMidSup(): void {}
  endScriptMidSup(): void {}
  startScriptMidSub(): void {}
  endScriptMidSub(): void {}

  startMarkSerial(): void {}
  endMarkSerial(): void {}
  startMarkOver(): void {}
  endMarkOver(): void {}
  startMarkUnder(): void {}
  endMarkUnder(): void {}

  startFenceSerial(): void {}
  endFenceSerial(): void {}
  startFenceOpen(): void {}
  endFenceOpen(): void {}
  startFenceClose(): void {}
  endFenceClose(): void {}

  startRadicalSerial(): void {}
  endRadicalSerial(): void {}
  startRadicalDegree(): void {}
  endRadicalDegree(): void {}

  startMathOperatorSerial(): void {}
  endMathOperatorSerial(): void {}
  startMathOperatorOperator(): void {}
  endMathOperatorOperator(): void {}
  startMathOperatorLowerLimit(): void {}
  endMathOperatorLowerLimit(): void {}
  startMathOperatorUpperLimit(): void {}
  endMathOperatorUpperLimit(): void {}

  startTablePartSerial(_nic: TablePartNIC): void {}
  endTablePartSerial(): void {}
  startTablePartHeader(): void {}
  endTablePartHeader(): void {}
  startTablePartFooter(): void {}
  endTablePartFooter(): void {}

  startMultiModeSerial(_mode: MultiMode | null): void {}
  endMultiModeSerial(): void {}
  startMultiModeMode(_mode: MultiMode): void {}
  endMultiModeMode(): void {}
}
