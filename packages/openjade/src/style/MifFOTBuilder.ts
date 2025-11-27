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
function toPoints(mp: number): string {
  return `${(mp / 1000).toFixed(3)}pt`;
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

// Text flow for header/footer
interface TextFlow {
  content: string;
}

// Simple page sequence state
interface SimplePageSequence {
  bodyTextFlow: TextFlow | null;
  firstHeaderTextFlow: TextFlow | null;
  firstFooterTextFlow: TextFlow | null;
  leftHeaderTextFlow: TextFlow | null;
  leftFooterTextFlow: TextFlow | null;
  rightHeaderTextFlow: TextFlow | null;
  rightFooterTextFlow: TextFlow | null;
}

function makeSimplePageSequence(): SimplePageSequence {
  return {
    bodyTextFlow: null,
    firstHeaderTextFlow: null,
    firstFooterTextFlow: null,
    leftHeaderTextFlow: null,
    leftFooterTextFlow: null,
    rightHeaderTextFlow: null,
    rightFooterTextFlow: null
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
    this.os_.write('<MIFFile 5.0>\n');
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

  private outColorCatalog(): void {
    this.os_.writeLine('<ColorCatalog ');
    this.os_.indent();

    // Default colors
    this.os_.writeLine('<Color ');
    this.os_.indent();
    this.os_.writeLine('<ColorTag `Black\'>');
    this.os_.writeLine('<ColorCyan 0>');
    this.os_.writeLine('<ColorMagenta 0>');
    this.os_.writeLine('<ColorYellow 0>');
    this.os_.writeLine('<ColorBlack 100>');
    this.os_.outdent();
    this.os_.writeLine('>');

    this.os_.writeLine('<Color ');
    this.os_.indent();
    this.os_.writeLine('<ColorTag `White\'>');
    this.os_.writeLine('<ColorCyan 0>');
    this.os_.writeLine('<ColorMagenta 0>');
    this.os_.writeLine('<ColorYellow 0>');
    this.os_.writeLine('<ColorBlack 0>');
    this.os_.outdent();
    this.os_.writeLine('>');

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

  private outDocumentSetup(): void {
    const f = this.nextFormat_;

    this.os_.writeLine('<Document ');
    this.os_.indent();
    this.os_.writeLine(`<DPageSize ${toPoints(f.FotPageWidth)} ${toPoints(f.FotPageHeight)}>`);
    this.os_.writeLine('<DStartPage 1>');
    this.os_.writeLine(`<DPageNumStyle Arabic>`);
    this.os_.writeLine(`<DTwoSides Yes>`);
    this.os_.writeLine(`<DParity FirstRight>`);
    this.os_.writeLine(`<DColumnGap ${toPoints(f.FotPageColumnSep)}>`);
    this.os_.writeLine(`<DColumns ${f.FotPageNColumns}>`);
    this.os_.writeLine(`<DMargins ${toPoints(f.FotLeftMargin)} ${toPoints(f.FotTopMargin)} ${toPoints(f.FotRightMargin)} ${toPoints(f.FotBottomMargin)}>`);
    this.os_.outdent();
    this.os_.writeLine('>');
  }

  private outTextFlow(content: string, flowTag: string): void {
    this.os_.writeLine('<TextFlow ');
    this.os_.indent();
    this.os_.writeLine(`<TFTag \`${flowTag}'>`);
    this.os_.writeLine('<TFAutoConnect Yes>');

    if (content.length > 0) {
      this.os_.write(content);
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
    // Build complete MIF document
    this.outMifHeader();
    this.outColorCatalog();
    this.outPgfCatalog();
    this.outDocumentSetup();

    // Output body text flow
    if (this.fotSimplePageSequence_.bodyTextFlow) {
      this.outTextFlow(this.fotSimplePageSequence_.bodyTextFlow.content, 'A');
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

  private startParagraphMif(): void {
    this.inParagraph_ = true;
    this.paragraphContent_ = '';
  }

  private endParagraphMif(): void {
    if (!this.inParagraph_) return;

    const f = this.nextFormat_;

    // Build paragraph MIF
    let para = '\n<Para ';
    para += '\n  <PgfTag `Default Pgf Format\'>';

    // Apply format overrides
    para += `\n  <PgfSpBefore ${toPoints(this.pendingSpaceBefore_)}>`;
    this.pendingSpaceBefore_ = 0;

    para += `\n  <PgfLIndent ${toPoints(this.computeLengthSpec(f.FotStartIndentSpec))}>`;
    para += `\n  <PgfFIndent ${toPoints(this.computeLengthSpec(f.FotFirstLineStartIndentSpec) + this.computeLengthSpec(f.FotStartIndentSpec))}>`;
    para += `\n  <PgfRIndent ${toPoints(this.computeLengthSpec(f.FotEndIndentSpec))}>`;

    // Handle placement based on pending break
    switch (this.pendingBreak_) {
      case Symbol.symbolPage:
        para += '\n  <PgfPlacement PageTop>';
        break;
      case Symbol.symbolColumn:
        para += '\n  <PgfPlacement ColumnTop>';
        break;
      default:
        para += '\n  <PgfPlacement Anywhere>';
    }
    this.pendingBreak_ = Symbol.symbolFalse;

    // Quadding/alignment
    switch (f.FotDisplayAlignment) {
      case Symbol.symbolStart:
        para += '\n  <PgfAlignment Left>';
        break;
      case Symbol.symbolEnd:
        para += '\n  <PgfAlignment Right>';
        break;
      case Symbol.symbolCenter:
        para += '\n  <PgfAlignment Center>';
        break;
      case Symbol.symbolJustify:
        para += '\n  <PgfAlignment LeftRight>';
        break;
    }

    // Para content
    para += '\n  <ParaLine ';
    if (this.paragraphContent_.length > 0) {
      para += `\n    <String \`${this.paragraphContent_}\'>`;
    }
    para += '\n  >';

    para += '\n>';

    // Append to body text flow
    if (this.fotSimplePageSequence_.bodyTextFlow) {
      this.fotSimplePageSequence_.bodyTextFlow.content += para;
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

  override startSimplePageSequenceSerial(): void {
    this.start();
    this.inSimplePageSequence_ = true;
    this.firstHeaderFooter_ = true;

    // Initialize body text flow
    this.fotSimplePageSequence_.bodyTextFlow = { content: '' };
  }

  override endSimplePageSequenceSerial(): void {
    this.inSimplePageSequence_ = false;
    this.end();
  }

  override startSimplePageSequenceHeaderFooterSerial(flags: number): void {
    // Determine which header/footer this is
    const isFirst = (flags & HF.firstHF) === HF.firstHF;
    const isFront = (flags & HF.frontHF) === HF.frontHF;
    const isHeader = (flags & HF.headerHF) === HF.headerHF;

    let position = '';
    if ((flags & HF.leftHF) === HF.leftHF) position = 'Left';
    else if ((flags & HF.centerHF) === HF.centerHF) position = 'Center';
    else if ((flags & HF.rightHF) === HF.rightHF) position = 'Right';

    // Create text flow for this header/footer region
    // Simplified - just track that we're in a header/footer
    this.start();
  }

  override endSimplePageSequenceHeaderFooterSerial(_flags: number): void {
    this.end();
  }

  override endAllSimplePageSequenceHeaderFooter(): void {
    // All header/footers processed
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
