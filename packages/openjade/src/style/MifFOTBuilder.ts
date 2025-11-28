// MifFOTBuilder.ts: FrameMaker MIF backend for Jade
// Ported from upstream OpenJade MifFOTBuilder.cxx
// Original: Copyright (c) 1998 ISOGEN International Corp.
// Created by Kathleen Marszalek and Paul Prescod.

import { Char, StringC } from '@openjade-js/opensp';
import { NodePtr } from '../grove/Node';
import {
  FOTBuilder,
  SerialFOTBuilder,
  Symbol,
  Length,
  LengthSpec,
  OptLengthSpec,
  DeviceRGBColor,
  DisplayNIC,
  DisplaySpace,
  ParagraphNIC,
  DisplayGroupNIC,
  BoxNIC,
  RuleNIC,
  ExternalGraphicNIC,
  LeaderNIC,
  LineFieldNIC,
  TableNIC,
  TablePartNIC,
  TableColumnNIC,
  TableCellNIC,
  CharacterNIC,
  Address,
  TableLengthSpec,
  HF
} from './FOTBuilder';
import { FOTBuilderExtension } from './StyleEngine';

// MIF dimension type (in millipoints, 1/72000 inch)
type MifDimension = number;

// MIF string constants
const MIF_TAB = '\\t';
const MIF_HARD_SPACE = '\\x11 ';
const MIF_HARD_RETURN = '\\x04 ';

// Font constants
const MIF_REGULAR = 'Regular';
const MIF_BOLD = 'Bold';
const MIF_ITALIC = 'Italic';
const MIF_TIMES_NEW_ROMAN = 'Times New Roman';

// Color constants
const MIF_WHITE = 'White';
const MIF_BLACK = 'Black';

// Underlining constants
const MIF_NO_UNDERLINING = 'FNoUnderlining';
const MIF_SINGLE = 'FSingle';
const MIF_DOUBLE = 'FDouble';

// Position constants
const MIF_NORMAL = 'FNormal';
const MIF_SUPERSCRIPT = 'FSuperscript';
const MIF_SUBSCRIPT = 'FSubscript';

// Case constants
const MIF_AS_TYPED = 'FAsTyped';
const MIF_SMALL_CAPS = 'FSmallCaps';

// Alignment constants
const MIF_LEFT = 'Left';
const MIF_RIGHT = 'Right';
const MIF_CENTER = 'Center';
const MIF_LEFT_RIGHT = 'LeftRight';

// Placement constants
const MIF_ANYWHERE = 'Anywhere';
const MIF_COLUMN_TOP = 'ColumnTop';
const MIF_PAGE_TOP = 'PageTop';

// Line spacing
const MIF_FIXED = 'Fixed';
const MIF_PROPORTIONAL = 'Proportional';

// Placement style
const MIF_PLACEMENT_NORMAL = 'Normal';
const MIF_STRADDLE = 'Straddle';

const INITIAL_PAGE_SIZE = 72000 * 8;
const INITIAL_PAGE_HEIGHT = (72000 * 23) / 2;

// Convert millipoints to points string
// Following upstream MifFOTBuilder.cxx operator<<(T_dimension):
// Strip trailing zeros and decimal point if no fractional part
function toPoints(mp: number): string {
  const whole = Math.floor(Math.abs(mp) / 1000);
  const frac = Math.abs(mp) % 1000;
  const sign = mp < 0 ? '-' : '';

  if (frac === 0) {
    return `${sign}${whole}pt`;
  }

  // Format with 3 decimal places, then strip trailing zeros
  let fracStr = frac.toString().padStart(3, '0');
  // Strip trailing zeros
  while (fracStr.endsWith('0')) {
    fracStr = fracStr.slice(0, -1);
  }

  return `${sign}${whole}.${fracStr}pt`;
}

// MIF output stream with indentation support
class MifOutputStream {
  private content_: string = '';
  private indent_: number = 0;

  write(s: string): void {
    this.content_ += s;
  }

  writeLine(s: string): void {
    this.content_ += '\n' + '  '.repeat(this.indent_) + s;
  }

  indent(): void {
    this.indent_++;
  }

  outdent(): void {
    if (this.indent_ > 0) this.indent_--;
  }

  getContent(): string {
    return this.content_;
  }
}

// Font format structure
interface FontFormat {
  FFamily: string;
  FAngle: string;
  FWeight: string;
  FVar: string;
  FSize: MifDimension;
  FColor: string;
  FUnderlining: string;
  FOverline: boolean;
  FStrike: boolean;
  FPosition: string;
  FPairKern: boolean;
  FCase: string;
  FDX: number;
  FDY: number;
  FDW: number;
}

function makeDefaultFontFormat(): FontFormat {
  return {
    FFamily: MIF_TIMES_NEW_ROMAN,
    FAngle: MIF_REGULAR,
    FWeight: MIF_REGULAR,
    FVar: MIF_REGULAR,
    FSize: 10000,
    FColor: MIF_BLACK,
    FUnderlining: MIF_NO_UNDERLINING,
    FOverline: false,
    FStrike: false,
    FPosition: MIF_NORMAL,
    FPairKern: false,
    FCase: MIF_AS_TYPED,
    FDX: 0,
    FDY: 0,
    FDW: 0
  };
}

// Paragraph format structure
interface ParagraphFormat extends FontFormat {
  PgfTag: string;
  PgfLanguage: string;
  PgfFIndent: MifDimension;
  PgfLIndent: MifDimension;
  PgfRIndent: MifDimension;
  PgfAlignment: string;
  PgfSpBefore: MifDimension;
  PgfSpAfter: MifDimension;
  PgfLineSpacing: string;
  PgfLeading: MifDimension;
  PgfPlacement: string;
  PgfPlacementStyle: string;
  PgfWithPrev: boolean;
  PgfWithNext: boolean;
  PgfHyphenate: boolean;
}

function makeDefaultParagraphFormat(): ParagraphFormat {
  return {
    ...makeDefaultFontFormat(),
    PgfTag: 'Default Pgf Format',
    PgfLanguage: 'NoLanguage',
    PgfFIndent: 0,
    PgfLIndent: 0,
    PgfRIndent: 0,
    PgfAlignment: MIF_LEFT,
    PgfSpBefore: 0,
    PgfSpAfter: 0,
    PgfLineSpacing: MIF_FIXED,
    PgfLeading: 0,
    PgfPlacement: MIF_ANYWHERE,
    PgfPlacementStyle: MIF_PLACEMENT_NORMAL,
    PgfWithPrev: false,
    PgfWithNext: false,
    PgfHyphenate: false
  };
}

// Format state for FOT
interface Format extends ParagraphFormat {
  FotLineSpacingSpec: LengthSpec;
  FotFirstLineStartIndentSpec: LengthSpec;
  FotStartIndentSpec: LengthSpec;
  FotEndIndentSpec: LengthSpec;
  FotCurDisplaySize: number;
  FotLineThickness: Length;
  FotBorderPresent: boolean;
  FotLineRepeat: number;
  FotLineSep: Length;
  FotBorderPriority: number;
  FotDisplayAlignment: Symbol;
  FotLeftMargin: Length;
  FotRightMargin: Length;
  FotTopMargin: Length;
  FotBottomMargin: Length;
  FotHeaderMargin: Length;
  FotFooterMargin: Length;
  FotPageWidth: Length;
  FotPageHeight: Length;
  FotLineCap: Symbol;
  FotPositionPointShiftSpec: LengthSpec;
  FotMinLeading: OptLengthSpec;
  FotFieldAlign: Symbol;
  FotFieldWidth: LengthSpec;
  FotLines: Symbol;
  FotInputWhitespaceTreatment: Symbol;
  FotPageNColumns: number;
  FotPageColumnSep: Length;
  FotSpan: number;
  FotPageBalanceColumns: boolean;
  FotCellBackground: boolean;
  FotBackgroundColor: string;
}

function makeFormat(): Format {
  return {
    ...makeDefaultParagraphFormat(),
    FotLineSpacingSpec: new LengthSpec(12000),
    FotFirstLineStartIndentSpec: new LengthSpec(),
    FotStartIndentSpec: new LengthSpec(),
    FotEndIndentSpec: new LengthSpec(),
    FotCurDisplaySize: INITIAL_PAGE_SIZE,
    FotLineThickness: 1000,
    FotBorderPresent: true,
    FotLineRepeat: 1,
    FotLineSep: 1000,
    FotBorderPriority: 0,
    FotDisplayAlignment: Symbol.symbolStart,
    FotLeftMargin: 1,
    FotRightMargin: 1,
    FotTopMargin: 0,
    FotBottomMargin: 0,
    FotHeaderMargin: 0,
    FotFooterMargin: 0,
    FotPageWidth: INITIAL_PAGE_SIZE,
    FotPageHeight: INITIAL_PAGE_HEIGHT,
    FotLineCap: Symbol.symbolButt,
    FotPositionPointShiftSpec: new LengthSpec(),
    FotMinLeading: new OptLengthSpec(),
    FotFieldAlign: Symbol.symbolStart,
    FotFieldWidth: new LengthSpec(),
    FotLines: Symbol.symbolWrap,
    FotInputWhitespaceTreatment: Symbol.symbolPreserve,
    FotPageNColumns: 1,
    FotPageColumnSep: 72000 / 2,
    FotSpan: 1,
    FotPageBalanceColumns: false,
    FotCellBackground: false,
    FotBackgroundColor: ''
  };
}

// Display info for tracking display context
interface DisplayInfo {
  spaceBefore: DisplaySpace | null;
  spaceAfter: DisplaySpace | null;
  keep: Symbol;
  breakBefore: Symbol;
  breakAfter: Symbol;
  keepWithPrevious: boolean;
  keepWithNext: boolean;
  mayViolateKeepBefore: boolean;
  mayViolateKeepAfter: boolean;
  isParagraph: boolean;
  firstParaOutputed: boolean;
  paragraphClosedInMif: boolean;
  keepWithinPageInEffect: boolean;
}

function makeDisplayInfo(nic: DisplayNIC, parent: DisplayInfo | null): DisplayInfo {
  return {
    spaceBefore: nic.spaceBefore,
    spaceAfter: nic.spaceAfter,
    keep: nic.keep,
    breakBefore: nic.breakBefore,
    breakAfter: nic.breakAfter,
    keepWithPrevious: nic.keepWithPrevious,
    keepWithNext: nic.keepWithNext,
    mayViolateKeepBefore: nic.mayViolateKeepBefore,
    mayViolateKeepAfter: nic.mayViolateKeepAfter,
    isParagraph: false,
    firstParaOutputed: false,
    paragraphClosedInMif: false,
    keepWithinPageInEffect: nic.keep === Symbol.symbolPage
      ? true
      : (parent ? parent.keepWithinPageInEffect : false)
  };
}

// Column info for tables
interface Column {
  hasWidth: boolean;
  width: TableLengthSpec;
}

// Cell info for tables
interface Cell {
  missing: boolean;
  nColumnsSpanned: number;
  nRowsSpanned: number;
  content: string;
}

// Row info for tables
interface Row {
  cells: Cell[];
}

// Table part info
interface TablePart {
  columns: Column[];
  header: Row[];
  body: Row[];
  footer: Row[];
}

// Table info
interface Table {
  parts: TablePart[];
  tableWidth: Length;
  displayAlignment: Symbol;
  startIndent: Length;
}

function makeTable(): Table {
  return {
    parts: [],
    tableWidth: 0,
    displayAlignment: Symbol.symbolStart,
    startIndent: 0
  };
}

// ============================================================================
// MIF Page/TextRect/TextFlow structures following upstream
// ============================================================================

// Page type keywords (following upstream MifDoc)
const sBodyPage = 'BodyPage';
const sOtherMasterPage = 'OtherMasterPage';
const sRightMasterPage = 'RightMasterPage';
const sLeftMasterPage = 'LeftMasterPage';

// Page tag keywords
const sFirst = 'First';
const sRight = 'Right';
const sLeft = 'Left';

// TextRect with ID (following upstream MifDoc::TextRect)
interface TextRect {
  id: number;
  shapeRect: { l: number; t: number; w: number; h: number };
  numColumns: number;
  columnGap: number;
  columnBalance: boolean;
}

// Global ID counter for MIF objects (following upstream Object::IDCnt)
let mifObjectIdCnt = 0;

function makeTextRect(
  shapeRect: { l: number; t: number; w: number; h: number },
  numColumns: number = 1,
  columnGap: number = 0,
  columnBalance: boolean = false
): TextRect {
  return {
    id: ++mifObjectIdCnt,
    shapeRect,
    numColumns,
    columnGap,
    columnBalance
  };
}

// Page structure (following upstream MifDoc::Page)
interface Page {
  pageType: string;
  pageTag: string;
  pageBackground: string;
  textRects: TextRect[];
}

function makePage(pageType: string, pageTag: string, pageBackground: string = ''): Page {
  return {
    pageType,
    pageTag,
    pageBackground,
    textRects: []
  };
}

// Text flow with TextRect reference (following upstream MifDoc::TextFlow)
interface MifTextFlow {
  textRectId: number;
  tag: string;
  autoConnect: boolean;
  isBody: boolean;
  content: string;
}

function makeMifTextFlow(
  textRect: TextRect,
  isBody: boolean,
  tag: string
): MifTextFlow {
  return {
    textRectId: textRect.id,
    tag,
    autoConnect: isBody, // Only body flows have TFAutoConnect (following upstream)
    isBody,
    content: ''
  };
}

// Simple page sequence state
interface SimplePageSequence {
  // Pages
  bodyPage: Page | null;
  firstMasterPage: Page | null;
  rightMasterPage: Page | null;
  leftMasterPage: Page | null;

  // TextRects
  bodyTextRect: TextRect | null;
  firstBodyTextRect: TextRect | null;
  rightBodyTextRect: TextRect | null;
  leftBodyTextRect: TextRect | null;
  firstHeaderTextRect: TextRect | null;
  firstFooterTextRect: TextRect | null;
  rightHeaderTextRect: TextRect | null;
  rightFooterTextRect: TextRect | null;
  leftHeaderTextRect: TextRect | null;
  leftFooterTextRect: TextRect | null;

  // TextFlows
  bodyTextFlow: MifTextFlow | null;
  firstHeaderTextFlow: MifTextFlow | null;
  firstFooterTextFlow: MifTextFlow | null;
  leftHeaderTextFlow: MifTextFlow | null;
  leftFooterTextFlow: MifTextFlow | null;
  rightHeaderTextFlow: MifTextFlow | null;
  rightFooterTextFlow: MifTextFlow | null;

  // Empty text flows for master page body areas
  firstBodyEmptyFlow: MifTextFlow | null;
  leftBodyEmptyFlow: MifTextFlow | null;
  rightBodyEmptyFlow: MifTextFlow | null;
}

function makeSimplePageSequence(): SimplePageSequence {
  return {
    bodyPage: null,
    firstMasterPage: null,
    rightMasterPage: null,
    leftMasterPage: null,

    bodyTextRect: null,
    firstBodyTextRect: null,
    rightBodyTextRect: null,
    leftBodyTextRect: null,
    firstHeaderTextRect: null,
    firstFooterTextRect: null,
    rightHeaderTextRect: null,
    rightFooterTextRect: null,
    leftHeaderTextRect: null,
    leftFooterTextRect: null,

    bodyTextFlow: null,
    firstHeaderTextFlow: null,
    firstFooterTextFlow: null,
    leftHeaderTextFlow: null,
    leftFooterTextFlow: null,
    rightHeaderTextFlow: null,
    rightFooterTextFlow: null,

    firstBodyEmptyFlow: null,
    leftBodyEmptyFlow: null,
    rightBodyEmptyFlow: null
  };
}

// MifFOTBuilder class - faithful port from upstream
export class MifFOTBuilder extends SerialFOTBuilder {
  private outputCallback_: (s: string) => void;
  private flushCallback_: (() => void) | null;

  // Output stream
  private os_: MifOutputStream;

  // Format state
  private nextFormat_: Format;
  private formatStack_: Format[] = [];

  // Display state
  private displayStack_: DisplayInfo[] = [];

  // Table state
  private tableStack_: Table[] = [];
  private curTable_: Table | null = null;
  private curTablePart_: TablePart | null = null;
  private curRow_: Row | null = null;
  private curCell_: Cell | null = null;

  // Simple page sequence state
  private fotSimplePageSequence_: SimplePageSequence;
  private inSimplePageSequence_: boolean = false;
  private firstHeaderFooter_: boolean = true;

  // Paragraph state
  private inParagraph_: boolean = false;
  private paragraphContent_: string = '';
  private lastFlowObjectWasWhitespace_: boolean = false;

  // Pending space/break
  private pendingBreak_: Symbol = Symbol.symbolFalse;
  private pendingSpaceBefore_: number = 0;

  // Color catalog
  private colorCatalog_: Map<string, DeviceRGBColor> = new Map();

  // Paragraph catalog
  private pgfCatalog_: ParagraphFormat[] = [];

  constructor(
    outputCallback: (s: string) => void,
    flushCallback: (() => void) | null = null,
    _options: string[] = [],
    _exts: { value: FOTBuilderExtension[] | null } = { value: null }
  ) {
    super();
    this.outputCallback_ = outputCallback;
    this.flushCallback_ = flushCallback;

    this.os_ = new MifOutputStream();
    this.nextFormat_ = makeFormat();
    this.formatStack_.push({ ...this.nextFormat_ });
    this.fotSimplePageSequence_ = makeSimplePageSequence();

    // Initialize default paragraph format
    this.pgfCatalog_.push(makeDefaultParagraphFormat());

    // Add header/footer paragraph formats
    const headerFormat = makeDefaultParagraphFormat();
    headerFormat.PgfTag = 'Header';
    headerFormat.FSize = 0;
    this.pgfCatalog_.push(headerFormat);

    const footerFormat = makeDefaultParagraphFormat();
    footerFormat.PgfTag = 'Footer';
    footerFormat.FSize = 0;
    this.pgfCatalog_.push(footerFormat);
  }

  // ============================================================================
  // Output Methods
  // ============================================================================

  private outMifHeader(): void {
    this.os_.write('<MIFFile 5.0>');
  }

  private outPgfCatalog(): void {
    this.os_.writeLine('<PgfCatalog ');
    this.os_.indent();

    for (const pgf of this.pgfCatalog_) {
      this.outParagraphFormat(pgf);
    }

    this.os_.outdent();
    this.os_.writeLine('>');
  }

  private outParagraphFormat(pgf: ParagraphFormat): void {
    this.os_.writeLine('<Pgf ');
    this.os_.indent();

    this.os_.writeLine(`<PgfTag \`${pgf.PgfTag}'>`);

    // Font properties
    this.os_.writeLine('<PgfFont ');
    this.os_.indent();
    this.os_.writeLine(`<FFamily \`${pgf.FFamily}'>`);
    this.os_.writeLine(`<FAngle \`${pgf.FAngle}'>`);
    this.os_.writeLine(`<FWeight \`${pgf.FWeight}'>`);
    this.os_.writeLine(`<FVar \`${pgf.FVar}'>`);
    this.os_.writeLine(`<FSize ${toPoints(pgf.FSize)}>`);
    this.os_.writeLine(`<FColor \`${pgf.FColor}'>`);
    this.os_.writeLine(`<FUnderlining ${pgf.FUnderlining}>`);
    this.os_.writeLine(`<FOverline ${pgf.FOverline ? 'Yes' : 'No'}>`);
    this.os_.writeLine(`<FStrike ${pgf.FStrike ? 'Yes' : 'No'}>`);
    this.os_.writeLine(`<FPosition ${pgf.FPosition}>`);
    this.os_.writeLine(`<FPairKern ${pgf.FPairKern ? 'Yes' : 'No'}>`);
    this.os_.writeLine(`<FCase ${pgf.FCase}>`);
    this.os_.writeLine(`<FDX ${pgf.FDX.toFixed(6)}>`);
    this.os_.writeLine(`<FDY ${pgf.FDY.toFixed(6)}>`);
    this.os_.writeLine(`<FDW ${pgf.FDW.toFixed(6)}>`);
    this.os_.outdent();
    this.os_.writeLine('>');

    // Paragraph properties
    this.os_.writeLine(`<PgfLanguage ${pgf.PgfLanguage}>`);
    this.os_.writeLine(`<PgfFIndent ${toPoints(pgf.PgfFIndent)}>`);
    this.os_.writeLine(`<PgfLIndent ${toPoints(pgf.PgfLIndent)}>`);
    this.os_.writeLine(`<PgfRIndent ${toPoints(pgf.PgfRIndent)}>`);
    this.os_.writeLine(`<PgfAlignment ${pgf.PgfAlignment}>`);
    this.os_.writeLine(`<PgfSpBefore ${toPoints(pgf.PgfSpBefore)}>`);
    this.os_.writeLine(`<PgfSpAfter ${toPoints(pgf.PgfSpAfter)}>`);
    this.os_.writeLine(`<PgfLineSpacing ${pgf.PgfLineSpacing}>`);
    this.os_.writeLine(`<PgfLeading ${toPoints(pgf.PgfLeading)}>`);
    this.os_.writeLine('<PgfNumTabs 0>');

    // Tab stops for header/footer
    if (pgf.PgfTag === 'Header' || pgf.PgfTag === 'Footer') {
      const pageWidth = this.nextFormat_.FotPageWidth;
      const centerTab = pageWidth / 2;
      const rightTab = pageWidth;
      this.os_.writeLine('<TabStop ');
      this.os_.indent();
      this.os_.writeLine(`<TSX ${toPoints(centerTab)}>`);
      this.os_.writeLine('<TSType Center>');
      this.os_.writeLine('<TSLeaderStr ` \'>');
      this.os_.outdent();
      this.os_.writeLine('>');
      this.os_.writeLine('<TabStop ');
      this.os_.indent();
      this.os_.writeLine(`<TSX ${toPoints(rightTab)}>`);
      this.os_.writeLine('<TSType Right>');
      this.os_.writeLine('<TSLeaderStr ` \'>');
      this.os_.outdent();
      this.os_.writeLine('>');
    }

    this.os_.writeLine(`<PgfPlacement ${pgf.PgfPlacement}>`);
    this.os_.writeLine(`<PgfPlacementStyle ${pgf.PgfPlacementStyle}>`);
    this.os_.writeLine(`<PgfWithPrev ${pgf.PgfWithPrev ? 'Yes' : 'No'}>`);
    this.os_.writeLine(`<PgfWithNext ${pgf.PgfWithNext ? 'Yes' : 'No'}>`);
    this.os_.writeLine('<PgfBlockSize 2>');
    this.os_.writeLine('<PgfAutoNum No>');
    this.os_.writeLine(`<PgfHyphenate ${pgf.PgfHyphenate ? 'Yes' : 'No'}>`);
    this.os_.writeLine('<HyphenMaxLines 999>');
    this.os_.writeLine('<HyphenMinPrefix 2>');
    this.os_.writeLine('<HyphenMinSuffix 2>');
    this.os_.writeLine('<HyphenMinWord 2>');
    this.os_.writeLine('<PgfLetterSpace No>');
    this.os_.writeLine('<PgfCellAlignment Top>');
    this.os_.writeLine('<PgfCellMargins 0pt 0pt 0pt 0pt>');
    this.os_.writeLine('<PgfCellLMarginFixed Yes>');
    this.os_.writeLine('<PgfCellTMarginFixed Yes>');
    this.os_.writeLine('<PgfCellRMarginFixed Yes>');
    this.os_.writeLine('<PgfCellBMarginFixed Yes>');

    this.os_.outdent();
    this.os_.writeLine('>');
  }

  // Following upstream MifFOTBuilder: only output ColorCatalog if custom colors exist
  private outColorCatalog(): void {
    // Only output if we have custom colors (following upstream)
    if (this.colorCatalog_.size === 0) {
      return;
    }

    this.os_.writeLine('<ColorCatalog ');
    this.os_.indent();

    // Custom colors from document
    for (const [name, color] of this.colorCatalog_) {
      this.os_.writeLine('<Color ');
      this.os_.indent();
      this.os_.writeLine(`<ColorTag \`${name}'>`);
      // Convert RGB to CMYK (simple approximation)
      const c = 100 - Math.round(color.red * 100 / 255);
      const m = 100 - Math.round(color.green * 100 / 255);
      const y = 100 - Math.round(color.blue * 100 / 255);
      const k = Math.min(c, m, y);
      this.os_.writeLine(`<ColorCyan ${c - k}>`);
      this.os_.writeLine(`<ColorMagenta ${m - k}>`);
      this.os_.writeLine(`<ColorYellow ${y - k}>`);
      this.os_.writeLine(`<ColorBlack ${k}>`);
      this.os_.outdent();
      this.os_.writeLine('>');
    }

    this.os_.outdent();
    this.os_.writeLine('>');
  }

  // Following upstream MifDoc::Document::out
  private outDocumentSetup(): void {
    const f = this.nextFormat_;

    this.os_.writeLine('<Document ');
    this.os_.indent();
    // Following upstream order
    this.os_.writeLine(`<DColumns ${f.FotPageNColumns}>`);
    this.os_.writeLine(`<DPageSize ${toPoints(f.FotPageWidth)} ${toPoints(f.FotPageHeight)}>`);
    this.os_.writeLine('<DTwoSides Yes>');
    this.os_.writeLine('<DParity FirstRight>');
    this.os_.outdent();
    this.os_.writeLine('>');
  }

  // Output a TextRect following upstream MifDoc::TextRect::out
  private outTextRect(tr: TextRect): void {
    this.os_.writeLine('<TextRect ');
    this.os_.indent();
    this.os_.writeLine(`<ID ${tr.id}>`);
    this.os_.writeLine('<Pen 15>');
    this.os_.writeLine('<Fill 15>');
    this.os_.writeLine(`<PenWidth ${toPoints(0)}>`);
    this.os_.writeLine(`<ObColor \`Black'>`);
    this.os_.writeLine(`<ShapeRect ${toPoints(tr.shapeRect.l)} ${toPoints(tr.shapeRect.t)} ${toPoints(tr.shapeRect.w)} ${toPoints(tr.shapeRect.h)}>`);
    this.os_.writeLine(`<TRNumColumns ${tr.numColumns}>`);
    this.os_.writeLine(`<TRColumnGap ${toPoints(tr.columnGap)}>`);
    this.os_.writeLine(`<TRColumnBalance ${tr.columnBalance ? 'Yes' : 'No'}>`);
    this.os_.outdent();
    this.os_.writeLine('>');
  }

  // Output a Page following upstream MifDoc::Page::out
  private outPage(page: Page): void {
    this.os_.writeLine('<Page ');
    this.os_.indent();
    this.os_.writeLine(`<PageType ${page.pageType}>`);
    // Always output PageTag (even if empty)
    this.os_.writeLine(`<PageTag \`${page.pageTag}'>`);
    if (page.pageBackground) {
      this.os_.writeLine(`<PageBackground \`${page.pageBackground}'>`);
    }
    for (const tr of page.textRects) {
      this.outTextRect(tr);
    }
    this.os_.outdent();
    this.os_.writeLine('>');
  }

  // Output a TextFlow following upstream MifDoc::TextFlow::out
  private outMifTextFlow(tf: MifTextFlow, useTextRectId: boolean): void {
    this.os_.writeLine('<TextFlow ');
    this.os_.indent();
    if (tf.tag) {
      this.os_.writeLine(`<TFTag \`${tf.tag}'>`);
    }
    if (tf.autoConnect) {
      this.os_.writeLine('<TFAutoConnect Yes>');
    }

    // Output paragraph(s)
    if (tf.content.length > 0) {
      this.os_.write(tf.content);
    } else if (useTextRectId) {
      // Empty para with TextRectID
      this.os_.writeLine('<Para ');
      this.os_.indent();
      this.os_.writeLine('<ParaLine ');
      this.os_.indent();
      this.os_.writeLine(`<TextRectID ${tf.textRectId}>`);
      this.os_.outdent();
      this.os_.writeLine('>');
      this.os_.outdent();
      this.os_.writeLine('>');
    }

    this.os_.outdent();
    this.os_.writeLine('>');
  }

  // ============================================================================
  // Core FOTBuilder Methods
  // ============================================================================

  override start(): void {
    this.formatStack_.push({ ...this.nextFormat_ });
  }

  override end(): void {
    if (this.formatStack_.length > 1) {
      this.formatStack_.pop();
      this.nextFormat_ = { ...this.formatStack_[this.formatStack_.length - 1] };
    }
  }

  override flush(): void {
    // Build complete MIF document following upstream order:
    // MifHeader, ColorCatalog, PgfCatalog, Document, Pages, TextFlows
    this.outMifHeader();
    this.outColorCatalog();
    this.outPgfCatalog();
    this.outDocumentSetup();

    const sps = this.fotSimplePageSequence_;

    // Output pages (following upstream order: bodyPage, first, right, left)
    if (sps.bodyPage) {
      this.outPage(sps.bodyPage);
    }
    if (sps.firstMasterPage) {
      this.outPage(sps.firstMasterPage);
    }
    if (sps.rightMasterPage) {
      this.outPage(sps.rightMasterPage);
    }
    if (sps.leftMasterPage) {
      this.outPage(sps.leftMasterPage);
    }

    // Output text flows (following upstream order)
    // First the empty flows for master page body areas
    if (sps.firstBodyEmptyFlow) {
      this.outMifTextFlow(sps.firstBodyEmptyFlow, true);
    }
    if (sps.leftBodyEmptyFlow) {
      this.outMifTextFlow(sps.leftBodyEmptyFlow, true);
    }
    if (sps.rightBodyEmptyFlow) {
      this.outMifTextFlow(sps.rightBodyEmptyFlow, true);
    }

    // Then the body text flow with content
    if (sps.bodyTextFlow) {
      this.outMifTextFlow(sps.bodyTextFlow, true);
    }

    // Then header/footer text flows
    if (sps.firstHeaderTextFlow) {
      this.outMifTextFlow(sps.firstHeaderTextFlow, true);
    }
    if (sps.firstFooterTextFlow) {
      this.outMifTextFlow(sps.firstFooterTextFlow, true);
    }
    if (sps.leftHeaderTextFlow) {
      this.outMifTextFlow(sps.leftHeaderTextFlow, true);
    }
    if (sps.leftFooterTextFlow) {
      this.outMifTextFlow(sps.leftFooterTextFlow, true);
    }
    if (sps.rightHeaderTextFlow) {
      this.outMifTextFlow(sps.rightHeaderTextFlow, true);
    }
    if (sps.rightFooterTextFlow) {
      this.outMifTextFlow(sps.rightFooterTextFlow, true);
    }

    // Write output
    this.outputCallback_(this.os_.getContent());

    if (this.flushCallback_) {
      this.flushCallback_();
    }
  }

  // ============================================================================
  // Display Handling
  // ============================================================================

  private startDisplay(nic: DisplayNIC): void {
    const parent = this.displayStack_.length > 0
      ? this.displayStack_[this.displayStack_.length - 1]
      : null;
    this.displayStack_.push(makeDisplayInfo(nic, parent));

    // Handle break before
    if (nic.breakBefore === Symbol.symbolPage) {
      this.pendingBreak_ = Symbol.symbolPage;
    } else if (nic.breakBefore === Symbol.symbolColumn) {
      this.pendingBreak_ = Symbol.symbolColumn;
    }

    // Handle space before
    if (nic.spaceBefore && nic.spaceBefore.nominal) {
      this.pendingSpaceBefore_ += nic.spaceBefore.nominal.length;
    }
  }

  private endDisplay(): void {
    const ds = this.displayStack_.pop();
    if (ds && ds.spaceAfter && ds.spaceAfter.nominal) {
      this.pendingSpaceBefore_ += ds.spaceAfter.nominal.length;
    }

    // Handle break after
    if (ds && ds.breakAfter === Symbol.symbolPage) {
      this.pendingBreak_ = Symbol.symbolPage;
    } else if (ds && ds.breakAfter === Symbol.symbolColumn) {
      this.pendingBreak_ = Symbol.symbolColumn;
    }
  }

  // ============================================================================
  // Length computation
  // ============================================================================

  private computeLengthSpec(spec: LengthSpec): number {
    return spec.length + Math.round(spec.displaySizeFactor * this.nextFormat_.FotCurDisplaySize);
  }

  // ============================================================================
  // Atomic Flow Objects
  // ============================================================================

  override characters(s: Uint32Array, n: number): void {
    if (!this.inParagraph_) return;

    for (let i = 0; i < n; i++) {
      const c = s[i];

      if (c === 0x09) { // Tab
        this.paragraphContent_ += MIF_TAB;
      } else if (c === 0x0A || c === 0x0D) { // LF or CR
        this.paragraphContent_ += MIF_HARD_RETURN;
      } else if (c === 0x27) { // Single quote - escape for MIF
        this.paragraphContent_ += '\\q';
      } else if (c === 0x60) { // Backtick - escape for MIF
        this.paragraphContent_ += '\\Q';
      } else if (c === 0x5C) { // Backslash
        this.paragraphContent_ += '\\\\';
      } else if (c === 0x3E) { // > - escape for MIF
        this.paragraphContent_ += '\\>';
      } else if (c > 127) {
        // High characters - use hex encoding
        this.paragraphContent_ += `\\x${c.toString(16).padStart(2, '0')} `;
      } else {
        this.paragraphContent_ += String.fromCharCode(c);
      }

      this.lastFlowObjectWasWhitespace_ = (c === 0x20 || c === 0x09);
    }
  }

  override character(nic: CharacterNIC): void {
    if (nic.valid && nic.ch !== 0) {
      const arr = new Uint32Array([nic.ch]);
      this.characters(arr, 1);
    }
  }

  override paragraphBreak(_nic: ParagraphNIC): void {
    // Force end of current paragraph and start new one
    if (this.inParagraph_) {
      this.endParagraphMif();
      this.startParagraphMif();
    }
  }

  override externalGraphic(nic: ExternalGraphicNIC): void {
    if (!this.inParagraph_) return;

    // Output anchored frame for graphic
    // This is a simplified version
    if (nic.entitySystemId) {
      this.paragraphContent_ += `<AFrame><ImportObject <ImportObFile \`${nic.entitySystemId}\'>>`;
    }
  }

  override rule(nic: RuleNIC): void {
    // Rules in MIF would be implemented as anchored frames with lines
    // Simplified for now
  }

  override pageNumber(): void {
    if (this.inParagraph_) {
      // MIF page number variable
      this.paragraphContent_ += '<Variable <VariableName `Current Page #\'>>';
    }
  }

  override formattingInstruction(instr: string): void {
    // Pass through MIF formatting instructions
    if (this.inParagraph_) {
      this.paragraphContent_ += instr;
    }
  }

  // ============================================================================
  // Compound Flow Objects
  // ============================================================================

  override startSequence(): void {
    this.start();
  }

  override endSequence(): void {
    this.end();
  }

  override startLineField(_nic: LineFieldNIC): void {
    this.start();
  }

  override endLineField(): void {
    this.end();
  }

  // Track if this is the first paragraph output (needs TextRectID)
  private firstParagraphOutput_: boolean = true;

  private startParagraphMif(): void {
    this.inParagraph_ = true;
    this.paragraphContent_ = '';
  }

  private endParagraphMif(): void {
    if (!this.inParagraph_) return;

    const f = this.nextFormat_;
    const sps = this.fotSimplePageSequence_;

    // Build paragraph MIF following upstream structure
    let para = '\n  <Para ';

    // First paragraph needs Pgf format override and TextRectID
    if (this.firstParagraphOutput_) {
      para += '\n    <Pgf ';
      para += '\n      <PgfTag `Default Pgf Format\'>';
      para += '\n      <PgfFont ';
      para += `\n        <FSize ${toPoints(12000)}>`; // Base font size
      para += '\n      >';
      para += '\n    >';
    }

    para += '\n    <ParaLine ';

    // Add TextRectID for first paragraph to link to body TextRect
    if (this.firstParagraphOutput_ && sps.bodyTextRect) {
      para += `\n      <TextRectID ${sps.bodyTextRect.id}>`;
      this.firstParagraphOutput_ = false;
    }

    // Add font override for content
    para += '\n      <Font ';
    para += `\n        <FSize ${toPoints(f.FSize)}>`;
    para += '\n      >';

    // Add string content
    if (this.paragraphContent_.length > 0) {
      para += `\n      <String \`${this.paragraphContent_}\'>`;
    }

    para += '\n    >';
    para += '\n  >';

    // Append to body text flow
    if (sps.bodyTextFlow) {
      sps.bodyTextFlow.content += para;
    }

    this.inParagraph_ = false;
    this.paragraphContent_ = '';
  }

  override startParagraph(nic: ParagraphNIC): void {
    this.startDisplay(nic);
    this.start();
    this.startParagraphMif();
  }

  override endParagraph(): void {
    this.endParagraphMif();
    this.end();
    this.endDisplay();
  }

  override startDisplayGroup(nic: DisplayGroupNIC): void {
    this.startDisplay(nic);
    this.start();
  }

  override endDisplayGroup(): void {
    this.end();
    this.endDisplay();
  }

  override startScroll(): void {
    this.start();
  }

  override endScroll(): void {
    this.end();
  }

  override startLeader(_nic: LeaderNIC): void {
    this.start();
    // Leaders in MIF would need special handling
  }

  override endLeader(): void {
    this.end();
  }

  override startBox(nic: BoxNIC): void {
    this.startDisplay(nic);
    this.start();
  }

  override endBox(): void {
    this.end();
    this.endDisplay();
  }

  override startLink(_addr: Address): void {
    this.start();
    // Links would be implemented as cross-references
  }

  override endLink(): void {
    this.end();
  }

  // ============================================================================
  // Simple Page Sequence
  // ============================================================================

  // Following upstream MifFOTBuilder::setupSimplePageSequence
  private setupSimplePageSequence(): void {
    // Reset ID counter for consistent output
    mifObjectIdCnt = 0;

    const f = this.nextFormat_;
    const sps = this.fotSimplePageSequence_;

    // Create pages (following upstream)
    sps.firstMasterPage = makePage(sOtherMasterPage, sFirst);
    sps.rightMasterPage = makePage(sRightMasterPage, sRight);
    sps.leftMasterPage = makePage(sLeftMasterPage, sLeft);
    sps.bodyPage = makePage(sBodyPage, '', sFirst);

    // Calculate rects (following upstream)
    const bodyRect = {
      l: f.FotLeftMargin,
      t: f.FotTopMargin,
      w: f.FotPageWidth - f.FotLeftMargin - f.FotRightMargin,
      h: f.FotPageHeight - f.FotTopMargin - f.FotBottomMargin
    };

    const headerRect = {
      l: f.FotLeftMargin,
      t: 0,
      w: bodyRect.w,
      h: f.FotTopMargin
    };

    const footerRect = {
      l: f.FotLeftMargin,
      t: f.FotPageHeight - f.FotBottomMargin,
      w: bodyRect.w,
      h: f.FotBottomMargin
    };

    // Create TextRects in exact upstream order (from MifFOTBuilder::setupSimplePageSequence):
    // 1. Body TextRects for master pages (first, right, left), then main body
    // 2. Header TextRects (first, right, left)
    // 3. Footer TextRects (first, right, left)
    sps.firstBodyTextRect = makeTextRect(bodyRect, f.FotPageNColumns, f.FotPageColumnSep);
    sps.rightBodyTextRect = makeTextRect(bodyRect, f.FotPageNColumns, f.FotPageColumnSep);
    sps.leftBodyTextRect = makeTextRect(bodyRect, f.FotPageNColumns, f.FotPageColumnSep);
    sps.bodyTextRect = makeTextRect(bodyRect, f.FotPageNColumns, f.FotPageColumnSep);
    sps.firstHeaderTextRect = makeTextRect(headerRect);
    sps.rightHeaderTextRect = makeTextRect(headerRect);
    sps.leftHeaderTextRect = makeTextRect(headerRect);
    sps.firstFooterTextRect = makeTextRect(footerRect);
    sps.rightFooterTextRect = makeTextRect(footerRect);
    sps.leftFooterTextRect = makeTextRect(footerRect);

    // Add text rects to pages (order: header, body, footer on each master page)
    sps.firstMasterPage.textRects.push(sps.firstHeaderTextRect);
    sps.firstMasterPage.textRects.push(sps.firstBodyTextRect);
    sps.firstMasterPage.textRects.push(sps.firstFooterTextRect);

    sps.rightMasterPage.textRects.push(sps.rightHeaderTextRect);
    sps.rightMasterPage.textRects.push(sps.rightBodyTextRect);
    sps.rightMasterPage.textRects.push(sps.rightFooterTextRect);

    sps.leftMasterPage.textRects.push(sps.leftHeaderTextRect);
    sps.leftMasterPage.textRects.push(sps.leftBodyTextRect);
    sps.leftMasterPage.textRects.push(sps.leftFooterTextRect);

    sps.bodyPage.textRects.push(sps.bodyTextRect);

    // Create empty text flows for master page body areas (following upstream)
    sps.firstBodyEmptyFlow = makeMifTextFlow(sps.firstBodyTextRect, true, 'A');
    sps.leftBodyEmptyFlow = makeMifTextFlow(sps.leftBodyTextRect, true, 'A');
    sps.rightBodyEmptyFlow = makeMifTextFlow(sps.rightBodyTextRect, true, 'A');

    // Create the body text flow (where paragraphs go)
    sps.bodyTextFlow = makeMifTextFlow(sps.bodyTextRect, true, 'A');

    // Create header/footer text flows
    sps.firstHeaderTextFlow = makeMifTextFlow(sps.firstHeaderTextRect, false, '');
    sps.firstFooterTextFlow = makeMifTextFlow(sps.firstFooterTextRect, false, '');
    sps.leftHeaderTextFlow = makeMifTextFlow(sps.leftHeaderTextRect, false, '');
    sps.leftFooterTextFlow = makeMifTextFlow(sps.leftFooterTextRect, false, '');
    sps.rightHeaderTextFlow = makeMifTextFlow(sps.rightHeaderTextRect, false, '');
    sps.rightFooterTextFlow = makeMifTextFlow(sps.rightFooterTextRect, false, '');
  }

  override startSimplePageSequenceSerial(): void {
    this.start();
    this.inSimplePageSequence_ = true;
    this.firstHeaderFooter_ = true;
  }

  override endSimplePageSequenceSerial(): void {
    this.inSimplePageSequence_ = false;
    this.end();
  }

  override startSimplePageSequenceHeaderFooterSerial(flags: number): void {
    // Setup page structure on first header/footer (following upstream)
    if (this.firstHeaderFooter_) {
      this.setupSimplePageSequence();
      this.firstHeaderFooter_ = false;
    }

    // Determine which header/footer flow to use
    const isFirst = (flags & HF.firstHF) === HF.firstHF;
    const isFront = (flags & HF.frontHF) === HF.frontHF;
    const isHeader = (flags & HF.headerHF) === HF.headerHF;
    const isLeft = (flags & HF.leftHF) === HF.leftHF;
    const isCenter = (flags & HF.centerHF) === HF.centerHF;
    const isRight = (flags & HF.rightHF) === HF.rightHF;

    // Start tracking header/footer content
    this.start();

    // Add tab characters for center and right positions (following upstream)
    const sps = this.fotSimplePageSequence_;
    let flow: MifTextFlow | null = null;

    if (isFirst && isFront) {
      flow = isHeader ? sps.firstHeaderTextFlow : sps.firstFooterTextFlow;
    } else if (!isFirst && isFront) {
      flow = isHeader ? sps.rightHeaderTextFlow : sps.rightFooterTextFlow;
    } else if (!isFirst && !isFront) {
      flow = isHeader ? sps.leftHeaderTextFlow : sps.leftFooterTextFlow;
    }

    if (flow && (isCenter || isRight)) {
      // Add tab for positioning
      flow.content += '<Char Tab>';
    }
  }

  override endSimplePageSequenceHeaderFooterSerial(_flags: number): void {
    this.end();
  }

  override endAllSimplePageSequenceHeaderFooter(): void {
    // All header/footers processed - finalize header/footer flows
    const sps = this.fotSimplePageSequence_;

    // Wrap header/footer content in Para/ParaLine if not empty
    // Following upstream MifDoc::Para/ParaLine formatting
    const wrapHeaderFooter = (tf: MifTextFlow | null, pgfTag: string) => {
      if (tf && tf.content.length > 0) {
        // Count <Char Tab> occurrences to match legacy format
        const tabCount = (tf.content.match(/<Char Tab>/g) || []).length;
        const charContent = Array(tabCount)
          .fill('      <Char Tab>')
          .join('\n');

        // Note: <Para , <Font , <ParaLine  need trailing space to match legacy
        // Don't end with \n since outMifTextFlow's writeLine('>') adds the newline
        const wrappedContent =
          '\n  <Para \n' +
          `    <PgfTag \`${pgfTag}'>\n` +
          '    <Font \n' +
          `      <FSize ${toPoints(this.nextFormat_.FSize)}>\n` +
          '    >\n' +
          '    <ParaLine \n' +
          `      <TextRectID ${tf.textRectId}>\n` +
          charContent + '\n' +
          '    >\n' +
          '  >';
        tf.content = wrappedContent;
      }
    };

    wrapHeaderFooter(sps.firstHeaderTextFlow, 'Header');
    wrapHeaderFooter(sps.firstFooterTextFlow, 'Footer');
    wrapHeaderFooter(sps.leftHeaderTextFlow, 'Header');
    wrapHeaderFooter(sps.leftFooterTextFlow, 'Footer');
    wrapHeaderFooter(sps.rightHeaderTextFlow, 'Header');
    wrapHeaderFooter(sps.rightFooterTextFlow, 'Footer');
  }

  // ============================================================================
  // Table Support
  // ============================================================================

  override startTable(nic: TableNIC): void {
    this.start();

    const table = makeTable();
    if (nic.widthType === 2) { // explicit width
      table.tableWidth = nic.width.length;
    }
    this.tableStack_.push(table);
    this.curTable_ = table;
  }

  override endTable(): void {
    if (this.tableStack_.length > 0) {
      this.tableStack_.pop();
      this.curTable_ = this.tableStack_.length > 0
        ? this.tableStack_[this.tableStack_.length - 1]
        : null;
    }
    this.end();
  }

  override startTablePartSerial(_nic: TablePartNIC): void {
    this.start();
    const part: TablePart = {
      columns: [],
      header: [],
      body: [],
      footer: []
    };
    if (this.curTable_) {
      this.curTable_.parts.push(part);
    }
    this.curTablePart_ = part;
  }

  override endTablePartSerial(): void {
    this.curTablePart_ = null;
    this.end();
  }

  override startTablePartHeader(): void {
    // Switch to header rows
  }

  override endTablePartHeader(): void {
    // End header rows
  }

  override startTablePartFooter(): void {
    // Switch to footer rows
  }

  override endTablePartFooter(): void {
    // End footer rows
  }

  override tableColumn(nic: TableColumnNIC): void {
    const col: Column = {
      hasWidth: nic.hasWidth,
      width: nic.width
    };
    if (this.curTablePart_) {
      this.curTablePart_.columns.push(col);
    }
  }

  override startTableRow(): void {
    this.start();
    const row: Row = { cells: [] };
    if (this.curTablePart_) {
      this.curTablePart_.body.push(row);
    }
    this.curRow_ = row;
  }

  override endTableRow(): void {
    this.curRow_ = null;
    this.end();
  }

  override startTableCell(nic: TableCellNIC): void {
    this.start();
    const cell: Cell = {
      missing: nic.missing,
      nColumnsSpanned: nic.nColumnsSpanned,
      nRowsSpanned: nic.nRowsSpanned,
      content: ''
    };
    if (this.curRow_) {
      this.curRow_.cells.push(cell);
    }
    this.curCell_ = cell;
  }

  override endTableCell(): void {
    this.curCell_ = null;
    this.end();
  }

  override tableBeforeRowBorder(): void {}
  override tableAfterRowBorder(): void {}
  override tableBeforeColumnBorder(): void {}
  override tableAfterColumnBorder(): void {}
  override tableCellBeforeRowBorder(): void {}
  override tableCellAfterRowBorder(): void {}
  override tableCellBeforeColumnBorder(): void {}
  override tableCellAfterColumnBorder(): void {}

  // ============================================================================
  // Score/Underline Support
  // ============================================================================

  override startScoreChar(_ch: Char): void {
    this.start();
  }

  override startScoreLengthSpec(_len: LengthSpec): void {
    this.start();
  }

  override startScoreSymbol(type: Symbol): void {
    this.start();
    // Set underlining based on type
    if (type === Symbol.symbolTrue) {
      this.nextFormat_.FUnderlining = MIF_SINGLE;
    }
  }

  override endScore(): void {
    this.nextFormat_.FUnderlining = MIF_NO_UNDERLINING;
    this.end();
  }

  // ============================================================================
  // Property Setters
  // ============================================================================

  override setFontSize(size: Length): void {
    this.nextFormat_.FSize = size;
  }

  override setFontFamilyName(name: string): void {
    this.nextFormat_.FFamily = name;
  }

  override setFontWeight(weight: Symbol): void {
    if (weight === Symbol.symbolBold) {
      this.nextFormat_.FWeight = MIF_BOLD;
    } else {
      this.nextFormat_.FWeight = MIF_REGULAR;
    }
  }

  override setFontPosture(posture: Symbol): void {
    if (posture === Symbol.symbolItalic || posture === Symbol.symbolOblique) {
      this.nextFormat_.FAngle = MIF_ITALIC;
    } else {
      this.nextFormat_.FAngle = MIF_REGULAR;
    }
  }

  override setStartIndent(indent: LengthSpec): void {
    this.nextFormat_.FotStartIndentSpec = indent;
  }

  override setEndIndent(indent: LengthSpec): void {
    this.nextFormat_.FotEndIndentSpec = indent;
  }

  override setFirstLineStartIndent(indent: LengthSpec): void {
    this.nextFormat_.FotFirstLineStartIndentSpec = indent;
  }

  override setLineSpacing(spacing: LengthSpec): void {
    this.nextFormat_.FotLineSpacingSpec = spacing;
  }

  override setFieldWidth(width: LengthSpec): void {
    this.nextFormat_.FotFieldWidth = width;
  }

  override setQuadding(quad: Symbol): void {
    switch (quad) {
      case Symbol.symbolStart:
        this.nextFormat_.PgfAlignment = MIF_LEFT;
        break;
      case Symbol.symbolEnd:
        this.nextFormat_.PgfAlignment = MIF_RIGHT;
        break;
      case Symbol.symbolCenter:
        this.nextFormat_.PgfAlignment = MIF_CENTER;
        break;
      case Symbol.symbolJustify:
        this.nextFormat_.PgfAlignment = MIF_LEFT_RIGHT;
        break;
    }
  }

  override setDisplayAlignment(align: Symbol): void {
    this.nextFormat_.FotDisplayAlignment = align;
  }

  override setFieldAlign(align: Symbol): void {
    this.nextFormat_.FotFieldAlign = align;
  }

  override setColor(color: DeviceRGBColor): void {
    // Register color and set name
    const colorName = `Color_${color.red}_${color.green}_${color.blue}`;
    this.colorCatalog_.set(colorName, color);
    this.nextFormat_.FColor = colorName;
  }

  override setBackgroundColor(color: DeviceRGBColor): void {
    const colorName = `Color_${color.red}_${color.green}_${color.blue}`;
    this.colorCatalog_.set(colorName, color);
    this.nextFormat_.FotBackgroundColor = colorName;
  }

  override setLines(lines: Symbol): void {
    this.nextFormat_.FotLines = lines;
  }

  override setLineThickness(thickness: Length): void {
    this.nextFormat_.FotLineThickness = thickness;
  }

  override setLineSep(sep: Length): void {
    this.nextFormat_.FotLineSep = sep;
  }

  override setLineCap(cap: Symbol): void {
    this.nextFormat_.FotLineCap = cap;
  }

  override setBorderPresent(present: boolean): void {
    this.nextFormat_.FotBorderPresent = present;
  }

  override setBorderPriority(priority: number): void {
    this.nextFormat_.FotBorderPriority = priority;
  }

  override setLineRepeat(repeat: number): void {
    this.nextFormat_.FotLineRepeat = repeat;
  }

  override setPageWidth(width: Length): void {
    this.nextFormat_.FotPageWidth = width;
  }

  override setPageHeight(height: Length): void {
    this.nextFormat_.FotPageHeight = height;
  }

  override setLeftMargin(margin: Length): void {
    this.nextFormat_.FotLeftMargin = margin;
  }

  override setRightMargin(margin: Length): void {
    this.nextFormat_.FotRightMargin = margin;
  }

  override setTopMargin(margin: Length): void {
    this.nextFormat_.FotTopMargin = margin;
  }

  override setBottomMargin(margin: Length): void {
    this.nextFormat_.FotBottomMargin = margin;
  }

  override setHeaderMargin(margin: Length): void {
    this.nextFormat_.FotHeaderMargin = margin;
  }

  override setFooterMargin(margin: Length): void {
    this.nextFormat_.FotFooterMargin = margin;
  }

  setPageNColumns(n: number): void {
    this.nextFormat_.FotPageNColumns = n;
  }

  setPageColumnSep(sep: Length): void {
    this.nextFormat_.FotPageColumnSep = sep;
  }

  override setSpan(span: number): void {
    this.nextFormat_.FotSpan = span;
  }

  override setCellBeforeRowMargin(_margin: Length): void {}
  override setCellAfterRowMargin(_margin: Length): void {}
  override setCellBeforeColumnMargin(_margin: Length): void {}
  override setCellAfterColumnMargin(_margin: Length): void {}

  override setCellBackground(bg: boolean): void {
    this.nextFormat_.FotCellBackground = bg;
  }

  override setCellRowAlignment(_align: Symbol): void {}

  override setHyphenate(hyphenate: boolean): void {
    this.nextFormat_.PgfHyphenate = hyphenate;
  }

  override setKern(kern: boolean): void {
    this.nextFormat_.FPairKern = kern;
  }

  override setLanguage(_lang: number): void {
    // Would need to map language codes to MIF language names
  }

  override setCountry(_country: number): void {}

  override setInputWhitespaceTreatment(treatment: Symbol): void {
    this.nextFormat_.FotInputWhitespaceTreatment = treatment;
  }

  override setPositionPointShift(shift: LengthSpec): void {
    this.nextFormat_.FotPositionPointShiftSpec = shift;
  }

  override setMinLeading(leading: OptLengthSpec): void {
    this.nextFormat_.FotMinLeading = leading;
  }

  // ============================================================================
  // Node Tracking
  // ============================================================================

  override startNode(_node: NodePtr, _mode: StringC): void {
    // Could track nodes for cross-references
  }

  override endNode(): void {}

  override currentNodePageNumber(_node: NodePtr): void {
    this.pageNumber();
  }
}

// Factory function
export function makeMifFOTBuilder(
  outputCallback: (s: string) => void,
  flushCallback: (() => void) | null = null,
  options: string[] = [],
  exts: { value: FOTBuilderExtension[] | null } = { value: null }
): FOTBuilder {
  return new MifFOTBuilder(outputCallback, flushCallback, options, exts);
}
