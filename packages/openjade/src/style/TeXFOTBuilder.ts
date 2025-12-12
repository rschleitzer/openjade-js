// TeXFOTBuilder.ts: a Generic TeX backend for Jade
// Ported from upstream OpenJade TeXFOTBuilder.cxx
// Original written by David Megginson <dmeggins@microstar.com>
// With changes from Sebastian Rahtz <s.rahtz@elsevier.co.uk>

import { Char, StringC } from '@scaly/opensp';
import { NodePtr } from '../grove/Node';
import {
  FOTBuilder,
  SerialFOTBuilder,
  Symbol,
  Length,
  LengthSpec,
  DeviceRGBColor,
  DisplayNIC,
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

// Length in points helper
function lengthInPoints(l: number): string {
  return `${(l / 1000.0).toFixed(3)}\\p@`;
}

// Format state structure (faithful port from upstream)
interface Format {
  fotCurDisplaySize: number;
  fotLineThickness: Length;
  fotLineCap: Symbol;
  fotBorderPriority: number;
  fotBorderPresent: boolean;
  fotLineRepeat: number;
  fotLineSep: Length;
  fotLines: Symbol;
  fotDisplayAlignment: Symbol;
  fotCellRowAlignment: Symbol;
  fotStartIndentSpec: LengthSpec;
  fotEndIndentSpec: LengthSpec;
  fotLeftMargin: Length;
  fotRightMargin: Length;
  fotPageWidth: Length;
  fotPageNColumns: number;
  fotPageColumnSep: Length;
  fotSpan: number;
  fotCellBackground: boolean;
  fotBackgroundColor: DeviceRGBColor;
  fotCellBeforeColumnMargin: Length;
  fotCellAfterColumnMargin: Length;
}

const INITIAL_PAGE_SIZE = 72000 * 8;
const LENGTH_UNSPECIFIED = Number.MAX_SAFE_INTEGER;

function makeFormat(): Format {
  return {
    fotCurDisplaySize: 0,
    fotLineThickness: 1000,
    fotLineCap: Symbol.symbolButt,
    fotBorderPriority: 0,
    fotBorderPresent: true,
    fotLineRepeat: 1,
    fotLineSep: 1000,
    fotLines: Symbol.symbolWrap,
    fotDisplayAlignment: Symbol.symbolNotApplicable,
    fotCellRowAlignment: Symbol.symbolNotApplicable,
    fotStartIndentSpec: new LengthSpec(),
    fotEndIndentSpec: new LengthSpec(),
    fotLeftMargin: 1,
    fotRightMargin: 1,
    fotPageWidth: INITIAL_PAGE_SIZE,
    fotPageNColumns: 1,
    fotPageColumnSep: 72000 / 2,
    fotSpan: 1,
    fotCellBackground: false,
    fotBackgroundColor: { red: 0, green: 0, blue: 0 },
    fotCellBeforeColumnMargin: LENGTH_UNSPECIFIED,
    fotCellAfterColumnMargin: LENGTH_UNSPECIFIED
  };
}

// FotElementState
interface FotElementState {
  enforcingStructure: boolean;
  isOpen: boolean;
  curNodeInfoProlog: string;
}

function makeFotElementState(): FotElementState {
  return {
    enforcingStructure: true,
    isOpen: false,
    curNodeInfoProlog: ''
  };
}

// Column info for tables
interface Column {
  hasWidth: boolean;
  width: TableLengthSpec;
  displayAlignment: Symbol;
  computedWidth: number;
  defaultTeXLeftBorder: string;
  defaultTeXRightBorder: string;
}

function makeColumn(): Column {
  return {
    hasWidth: false,
    width: new TableLengthSpec(),
    displayAlignment: Symbol.symbolNotApplicable,
    computedWidth: 0,
    defaultTeXLeftBorder: '',
    defaultTeXRightBorder: ''
  };
}

// Cell info for tables
interface Cell {
  present: boolean;
  missing: boolean;
  nColumnsSpanned: number;
  nRowsSpanned: number;
  content: string;
  columnIdx: number;
  displayAlignment: Symbol;
  rowAlignment: Symbol;
}

function makeCell(): Cell {
  return {
    present: false,
    missing: false,
    nColumnsSpanned: 1,
    nRowsSpanned: 1,
    content: '',
    columnIdx: 0,
    displayAlignment: Symbol.symbolNotApplicable,
    rowAlignment: Symbol.symbolNotApplicable
  };
}

// Row info for tables
interface Row {
  cells: Cell[];
}

function makeRow(): Row {
  return {
    cells: []
  };
}

// Table part info
interface TablePart {
  rows: Row[];
  columns: Column[];
  header: string;
  footer: string;
  isHeader: boolean;
  isFooter: boolean;
}

function makeTablePart(): TablePart {
  return {
    rows: [],
    columns: [],
    header: '',
    footer: '',
    isHeader: false,
    isFooter: false
  };
}

// Table info
interface Table {
  parts: TablePart[];
  tableWidth: LengthSpec;
  widthType: number;
}

function makeTable(): Table {
  return {
    parts: [],
    tableWidth: new LengthSpec(),
    widthType: 0 // widthFull
  };
}

// TeXFOTBuilder class - faithful port from upstream
export class TeXFOTBuilder extends SerialFOTBuilder {
  private outputCallback_: (s: string) => void;
  private flushCallback_: (() => void) | null;

  // Output streams
  private os_: string = '';
  private stringout_: string = '';
  private osStack_: string[] = [];

  // Format state
  private nextFormat_: Format;
  private formatStack_: Format[] = [];

  // Element state
  private fotElementStateStack_: FotElementState[] = [];

  // Table state
  private tableStack_: Table[] = [];
  private curCell_: Cell | null = null;
  private curRow_: Row | null = null;
  private curTablePart_: TablePart | null = null;
  private curTable_: Table | null = null;
  private cellOs_: string = '';
  private inTable_: boolean = false;

  // Math state
  private inMath_: number = 0;

  // Heading/outline support
  private inHeading_: number = 0;
  private headingSet_: number = 0;

  // Sdata preservation
  private preserveSdata_: boolean = true;

  constructor(
    outputCallback: (s: string) => void,
    flushCallback: (() => void) | null = null,
    _options: string[] = [],
    _exts: { value: FOTBuilderExtension[] | null } = { value: null }
  ) {
    super();
    this.outputCallback_ = outputCallback;
    this.flushCallback_ = flushCallback;

    this.nextFormat_ = makeFormat();
    this.nextFormat_.fotCurDisplaySize = INITIAL_PAGE_SIZE;
    this.formatStack_.push({ ...this.nextFormat_ });
    this.pushFotElementState();

    // Output TeX FOT header
    this.os('\\FOT{3}');
  }

  // ============================================================================
  // Output Stream Management
  // ============================================================================

  private os(s: string): void {
    this.os_ += s;
  }

  private pushOs(): void {
    this.osStack_.push(this.os_);
    this.os_ = '';
  }

  private popOs(): string {
    const content = this.os_;
    this.os_ = this.osStack_.pop() || '';
    return content;
  }

  private stringOut(s: string): void {
    this.stringout_ += s;
  }

  private extractStringOut(): string {
    const s = this.stringout_;
    this.stringout_ = '';
    return s;
  }

  // ============================================================================
  // Format Stack Management
  // ============================================================================

  private pushFotElementState(): void {
    this.fotElementStateStack_.push(makeFotElementState());
  }

  private popFotElementState(): void {
    this.fotElementStateStack_.pop();
  }

  private curFotElementState(): FotElementState {
    return this.fotElementStateStack_[this.fotElementStateStack_.length - 1];
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
    // Output TeX FOT footer
    this.os('\\endFOT{}');

    // Write all output
    this.outputCallback_(this.os_);

    if (this.flushCallback_) {
      this.flushCallback_();
    }
  }

  // ============================================================================
  // Set Methods - Output characteristic definitions
  // ============================================================================

  private set(name: string, value: string): void {
    this.stringOut(`\\def\\${name}%\n{${value}}`);
  }

  private setNumber(name: string, value: number): void {
    this.stringOut(`\\def\\${name}%\n{${value}}`);
  }

  private setLength(name: string, value: Length): void {
    this.stringOut(`\\def\\${name}%\n{${lengthInPoints(value)}}`);
  }

  private setLengthSpec(name: string, spec: LengthSpec): void {
    this.stringOut(`\\def\\${name}%\n{${(spec.length / 1000.0).toFixed(3)}\\p@}`);
    this.stringOut(`\\def\\${name}Factor%\n{${spec.displaySizeFactor}}`);
  }

  private setBool(name: string, value: boolean): void {
    this.stringOut(`\\def\\${name}%\n{${value ? 'true' : 'false'}}`);
  }

  private setSymbol(name: string, sym: Symbol): void {
    const symbolName = this.symbolToString(sym);
    this.stringOut(`\\def\\${name}%\n{${symbolName}}`);
  }

  private setColorDef(name: string, color: DeviceRGBColor): void {
    this.stringOut(`\\def\\${name}Red%\n{${color.red}}`);
    this.stringOut(`\\def\\${name}Green%\n{${color.green}}`);
    this.stringOut(`\\def\\${name}Blue%\n{${color.blue}}`);
  }

  private symbolToString(sym: Symbol): string {
    switch (sym) {
      case Symbol.symbolFalse: return 'false';
      case Symbol.symbolTrue: return 'true';
      case Symbol.symbolNotApplicable: return 'notapplicable';
      case Symbol.symbolStart: return 'start';
      case Symbol.symbolEnd: return 'end';
      case Symbol.symbolCenter: return 'center';
      case Symbol.symbolJustify: return 'justify';
      case Symbol.symbolWrap: return 'wrap';
      case Symbol.symbolAsis: return 'asis';
      case Symbol.symbolAsisWrap: return 'asiswrap';
      case Symbol.symbolAsisTruncate: return 'asistruncate';
      case Symbol.symbolNone: return 'none';
      case Symbol.symbolBefore: return 'before';
      case Symbol.symbolThrough: return 'through';
      case Symbol.symbolAfter: return 'after';
      case Symbol.symbolTopToBottom: return 'toptobottom';
      case Symbol.symbolLeftToRight: return 'lefttoright';
      case Symbol.symbolBottomToTop: return 'bottomtotop';
      case Symbol.symbolRightToLeft: return 'righttoleft';
      case Symbol.symbolInside: return 'inside';
      case Symbol.symbolOutside: return 'outside';
      case Symbol.symbolHorizontal: return 'horizontal';
      case Symbol.symbolVertical: return 'vertical';
      case Symbol.symbolBold: return 'bold';
      case Symbol.symbolMedium: return 'medium';
      case Symbol.symbolUpright: return 'upright';
      case Symbol.symbolItalic: return 'italic';
      case Symbol.symbolOblique: return 'oblique';
      case Symbol.symbolButt: return 'butt';
      case Symbol.symbolRound: return 'round';
      case Symbol.symbolSquare: return 'square';
      case Symbol.symbolMiter: return 'miter';
      case Symbol.symbolBevel: return 'bevel';
      case Symbol.symbolSolid: return 'solid';
      case Symbol.symbolOutline: return 'outline';
      case Symbol.symbolPage: return 'page';
      case Symbol.symbolColumn: return 'column';
      default: return 'unknown';
    }
  }

  // ============================================================================
  // Group Methods - Start/End flow object groups
  // ============================================================================

  private startGroup(name: string): void {
    const chars = this.extractStringOut();
    this.os(`\\${name}%\n{${chars}}`);
  }

  private endGroup(name: string): void {
    this.os(`\\end${name}{}`);
  }

  private insertAtomic(name: string): void {
    const chars = this.extractStringOut();
    this.os(`\\insert${name}%\n{${chars}}{}`);
  }

  // ============================================================================
  // Display Handling
  // ============================================================================

  private startDisplay(_nic: DisplayNIC): void {
    // Empty in upstream - characteristics are set via property setters
  }

  private endDisplay(): void {
    // Nothing special needed
  }

  // ============================================================================
  // Atomic Flow Objects
  // ============================================================================

  override characters(s: Uint32Array, n: number): void {
    for (let i = 0; i < n; i++) {
      const c = s[i];

      // Characters > 255 need special treatment for TeX
      if (c > 255) {
        this.os(`\\Character{${c}}`);
      } else {
        switch (c) {
          case 0x20: // space
          case 0x09: // tab
            if (this.nextFormat_.fotLines === Symbol.symbolAsis) {
              this.os('~');
            } else {
              this.os(String.fromCharCode(c));
            }
            break;
          case 0x5c: // backslash
          case 0x5e: // ^
          case 0x5f: // _
          case 0x7e: // ~
            this.os(`\\char${c}{}`);
            break;
          case 0x7b: // {
          case 0x7d: // }
          case 0x24: // $
          case 0x26: // &
          case 0x23: // #
          case 0x25: // %
            this.os(`\\${String.fromCharCode(c)}`);
            break;
          case 0x0d: // CR
            this.os('\n');
            break;
          case 0x0a: // LF
            // ignore
            break;
          case 0x2d: // -
          case 0x3c: // <
          case 0x3e: // >
            this.os(String.fromCharCode(c));
            if (!this.inMath_) {
              this.os('\\/'); // break ligatures
            }
            break;
          default:
            this.os(String.fromCharCode(c));
            break;
        }
      }
    }
  }

  override character(nic: CharacterNIC): void {
    if (nic.valid && nic.ch !== 0) {
      const arr = new Uint32Array([nic.ch]);
      this.characters(arr, 1);
    }
  }

  override paragraphBreak(nic: ParagraphNIC): void {
    this.insertAtomic('ParagraphBreak');
  }

  override externalGraphic(nic: ExternalGraphicNIC): void {
    if (nic.entitySystemId) {
      this.set('EntitySystemId', nic.entitySystemId);
    }
    if (nic.notationSystemId) {
      this.set('NotationSystemId', nic.notationSystemId);
    }
    if (nic.hasMaxWidth) {
      this.setLengthSpec('MaxWidth', nic.maxWidth);
    }
    if (nic.hasMaxHeight) {
      this.setLengthSpec('MaxHeight', nic.maxHeight);
    }
    if (nic.scaleType !== Symbol.symbolFalse) {
      this.setSymbol('ScaleType', nic.scaleType);
    }
    this.insertAtomic('ExternalGraphic');
  }

  override rule(nic: RuleNIC): void {
    this.setSymbol('Orientation', nic.orientation);
    if (nic.hasLength) {
      this.setLengthSpec('Length', nic.length);
    }
    this.insertAtomic('Rule');
  }

  override alignmentPoint(): void {
    this.insertAtomic('AlignmentPoint');
  }

  override pageNumber(): void {
    this.os('\\PageNumber{}');
  }

  override formattingInstruction(instr: string): void {
    // Output raw formatting instruction
    this.os(instr);
  }

  // ============================================================================
  // Compound Flow Objects
  // ============================================================================

  override startSequence(): void {
    this.start();
    if (!this.curFotElementState().enforcingStructure) {
      this.startGroup('Seq');
    }
  }

  override endSequence(): void {
    if (!this.curFotElementState().enforcingStructure) {
      this.endGroup('Seq');
    }
    this.end();
  }

  override startLineField(nic: LineFieldNIC): void {
    this.start();
    // Set characteristics
    this.startGroup('LineField');
  }

  override endLineField(): void {
    this.endGroup('LineField');
    this.end();
  }

  override startParagraph(nic: ParagraphNIC): void {
    this.start();
    this.startDisplay(nic);
    this.startGroup('Par');
  }

  override endParagraph(): void {
    this.endGroup('Par');
    this.endDisplay();
    this.end();
  }

  override startDisplayGroup(nic: DisplayGroupNIC): void {
    this.startDisplay(nic);
    this.start();
    this.startGroup('DisplayGroup');
  }

  override endDisplayGroup(): void {
    this.endGroup('DisplayGroup');
    this.end();
    this.endDisplay();
  }

  override startScroll(): void {
    this.start();
    this.startGroup('Scroll');
  }

  override endScroll(): void {
    this.endGroup('Scroll');
    this.end();
  }

  override startScoreChar(ch: Char): void {
    this.start();
    this.setNumber('ScoreCharacter', ch);
    this.startGroup('Score');
  }

  override startScoreLengthSpec(len: LengthSpec): void {
    this.start();
    this.setLengthSpec('ScoreLength', len);
    this.startGroup('Score');
  }

  override startScoreSymbol(type: Symbol): void {
    this.start();
    this.setSymbol('ScoreType', type);
    this.startGroup('Score');
  }

  override endScore(): void {
    this.endGroup('Score');
    this.end();
  }

  override startLeader(nic: LeaderNIC): void {
    this.start();
    if (nic.hasLength) {
      this.setLengthSpec('LeaderLength', nic.length);
    }
    this.startGroup('Leader');
  }

  override endLeader(): void {
    this.endGroup('Leader');
    this.end();
  }

  override startSideline(): void {
    this.start();
    this.startGroup('Sideline');
  }

  override endSideline(): void {
    this.endGroup('Sideline');
    this.end();
  }

  override startBox(nic: BoxNIC): void {
    this.startDisplay(nic);
    this.start();
    if (nic.isDisplay) {
      this.setBool('IsDisplay', true);
    }
    this.startGroup('Box');
  }

  override endBox(): void {
    this.endGroup('Box');
    this.end();
    this.endDisplay();
  }

  override startLink(addr: Address): void {
    this.start();
    // Set link destination
    this.startGroup('Link');
  }

  override endLink(): void {
    this.endGroup('Link');
    this.end();
  }

  override startMarginalia(): void {
    this.start();
    this.startGroup('Marginalia');
  }

  override endMarginalia(): void {
    this.endGroup('Marginalia');
    this.end();
  }

  // ============================================================================
  // Simple Page Sequence
  // ============================================================================

  override startSimplePageSequenceSerial(): void {
    this.start();
    this.startGroup('SpS');
  }

  override endSimplePageSequenceSerial(): void {
    this.endGroup('SpS');
    this.end();
  }

  override startSimplePageSequenceHeaderFooterSerial(flags: number): void {
    // Build the header/footer name like upstream: SpSOtherBackLeftFooter
    let name = '\\SpS';
    if ((flags & (HF.firstHF | HF.otherHF)) === HF.firstHF) {
      name += 'First';
    } else {
      name += 'Other';
    }
    if ((flags & (HF.frontHF | HF.backHF)) === HF.frontHF) {
      name += 'Front';
    } else {
      name += 'Back';
    }
    switch (flags & (HF.leftHF | HF.centerHF | HF.rightHF)) {
      case HF.leftHF:
        name += 'Left';
        break;
      case HF.centerHF:
        name += 'Center';
        break;
      case HF.rightHF:
        name += 'Right';
        break;
    }
    if ((flags & (HF.headerHF | HF.footerHF)) === HF.headerHF) {
      name += 'Header';
    } else {
      name += 'Footer';
    }
    this.os(`\n${name}%\n{`);
  }

  override endSimplePageSequenceHeaderFooterSerial(_flags: number): void {
    this.os('}');
  }

  override endAllSimplePageSequenceHeaderFooter(): void {
    // Nothing special needed for TeX
  }

  // ============================================================================
  // Table Support
  // ============================================================================

  override startTable(nic: TableNIC): void {
    this.start();
    this.inTable_ = true;

    const table = makeTable();
    table.widthType = nic.widthType;
    if (nic.widthType === 2) { // explicit
      table.tableWidth = nic.width;
    }
    this.tableStack_.push(table);
    this.curTable_ = table;

    this.startGroup('Table');
  }

  override endTable(): void {
    this.endGroup('Table');

    if (this.tableStack_.length > 0) {
      this.tableStack_.pop();
      this.curTable_ = this.tableStack_.length > 0
        ? this.tableStack_[this.tableStack_.length - 1]
        : null;
    }

    this.inTable_ = this.tableStack_.length > 0;
    this.end();
  }

  override startTablePartSerial(nic: TablePartNIC): void {
    this.start();
    const part = makeTablePart();
    if (this.curTable_) {
      this.curTable_.parts.push(part);
    }
    this.curTablePart_ = part;
    this.startGroup('TablePart');
  }

  override endTablePartSerial(): void {
    this.endGroup('TablePart');
    this.curTablePart_ = null;
    this.end();
  }

  override startTablePartHeader(): void {
    this.pushOs();
  }

  override endTablePartHeader(): void {
    if (this.curTablePart_) {
      this.curTablePart_.header = this.popOs();
    }
  }

  override startTablePartFooter(): void {
    this.pushOs();
  }

  override endTablePartFooter(): void {
    if (this.curTablePart_) {
      this.curTablePart_.footer = this.popOs();
    }
  }

  override tableColumn(nic: TableColumnNIC): void {
    const col = makeColumn();
    col.hasWidth = nic.hasWidth;
    if (nic.hasWidth) {
      col.width = nic.width;
    }
    if (this.curTablePart_) {
      this.curTablePart_.columns.push(col);
    }
  }

  override startTableRow(): void {
    this.start();
    const row = makeRow();
    if (this.curTablePart_) {
      this.curTablePart_.rows.push(row);
    }
    this.curRow_ = row;
    this.startGroup('TableRow');
  }

  override endTableRow(): void {
    this.endGroup('TableRow');
    this.curRow_ = null;
    this.end();
  }

  override startTableCell(nic: TableCellNIC): void {
    this.start();
    const cell = makeCell();
    cell.missing = nic.missing;
    cell.columnIdx = nic.columnIndex;
    cell.nColumnsSpanned = nic.nColumnsSpanned;
    cell.nRowsSpanned = nic.nRowsSpanned;

    if (this.curRow_) {
      this.curRow_.cells.push(cell);
    }
    this.curCell_ = cell;

    this.pushOs();
    this.startGroup('TableCell');
  }

  override endTableCell(): void {
    this.endGroup('TableCell');

    if (this.curCell_) {
      this.curCell_.content = this.popOs();
    }
    this.curCell_ = null;
    this.end();
  }

  override tableBeforeRowBorder(): void {
    this.insertAtomic('TableBeforeRowBorder');
  }

  override tableAfterRowBorder(): void {
    this.insertAtomic('TableAfterRowBorder');
  }

  override tableBeforeColumnBorder(): void {
    this.insertAtomic('TableBeforeColumnBorder');
  }

  override tableAfterColumnBorder(): void {
    this.insertAtomic('TableAfterColumnBorder');
  }

  override tableCellBeforeRowBorder(): void {
    this.insertAtomic('CellBeforeRowBorder');
  }

  override tableCellAfterRowBorder(): void {
    this.insertAtomic('CellAfterRowBorder');
  }

  override tableCellBeforeColumnBorder(): void {
    this.insertAtomic('CellBeforeColumnBorder');
  }

  override tableCellAfterColumnBorder(): void {
    this.insertAtomic('CellAfterColumnBorder');
  }

  // ============================================================================
  // Math Support
  // ============================================================================

  override startMathSequence(): void {
    this.inMath_++;
    this.start();
    this.startGroup('MathSequence');
  }

  override endMathSequence(): void {
    this.endGroup('MathSequence');
    this.end();
    this.inMath_--;
  }

  override startFractionSerial(): void {
    this.start();
    this.startGroup('Fraction');
  }

  override endFractionSerial(): void {
    this.endGroup('Fraction');
    this.end();
  }

  override startFractionNumerator(): void {
    this.startGroup('Numerator');
  }

  override endFractionNumerator(): void {
    this.endGroup('Numerator');
  }

  override startFractionDenominator(): void {
    this.startGroup('Denominator');
  }

  override endFractionDenominator(): void {
    this.endGroup('Denominator');
  }

  override fractionBar(): void {
    this.insertAtomic('FractionBar');
  }

  override startUnmath(): void {
    this.start();
    this.startGroup('Unmath');
  }

  override endUnmath(): void {
    this.endGroup('Unmath');
    this.end();
  }

  override startSuperscript(): void {
    this.start();
    this.startGroup('Superscript');
  }

  override endSuperscript(): void {
    this.endGroup('Superscript');
    this.end();
  }

  override startSubscript(): void {
    this.start();
    this.startGroup('Subscript');
  }

  override endSubscript(): void {
    this.endGroup('Subscript');
    this.end();
  }

  override startScriptSerial(): void {
    this.start();
    this.startGroup('Script');
  }

  override endScriptSerial(): void {
    this.endGroup('Script');
    this.end();
  }

  override startScriptPreSup(): void {
    this.startGroup('PreSup');
  }

  override endScriptPreSup(): void {
    this.endGroup('PreSup');
  }

  override startScriptPreSub(): void {
    this.startGroup('PreSub');
  }

  override endScriptPreSub(): void {
    this.endGroup('PreSub');
  }

  override startScriptPostSup(): void {
    this.startGroup('PostSup');
  }

  override endScriptPostSup(): void {
    this.endGroup('PostSup');
  }

  override startScriptPostSub(): void {
    this.startGroup('PostSub');
  }

  override endScriptPostSub(): void {
    this.endGroup('PostSub');
  }

  override startScriptMidSup(): void {
    this.startGroup('MidSup');
  }

  override endScriptMidSup(): void {
    this.endGroup('MidSup');
  }

  override startScriptMidSub(): void {
    this.startGroup('MidSub');
  }

  override endScriptMidSub(): void {
    this.endGroup('MidSub');
  }

  override startMarkSerial(): void {
    this.start();
    this.startGroup('Mark');
  }

  override endMarkSerial(): void {
    this.endGroup('Mark');
    this.end();
  }

  override startMarkOver(): void {
    this.startGroup('OverMark');
  }

  override endMarkOver(): void {
    this.endGroup('OverMark');
  }

  override startMarkUnder(): void {
    this.startGroup('UnderMark');
  }

  override endMarkUnder(): void {
    this.endGroup('UnderMark');
  }

  override startFenceSerial(): void {
    this.start();
    this.startGroup('Fence');
  }

  override endFenceSerial(): void {
    this.endGroup('Fence');
    this.end();
  }

  override startFenceOpen(): void {
    this.startGroup('Open');
  }

  override endFenceOpen(): void {
    this.endGroup('Open');
  }

  override startFenceClose(): void {
    this.startGroup('Close');
  }

  override endFenceClose(): void {
    this.endGroup('Close');
  }

  override startRadicalSerial(): void {
    this.start();
    this.startGroup('Radical');
  }

  override endRadicalSerial(): void {
    this.endGroup('Radical');
    this.end();
  }

  override startRadicalDegree(): void {
    this.startGroup('Degree');
  }

  override endRadicalDegree(): void {
    this.endGroup('Degree');
  }

  override radicalRadical(nic: CharacterNIC): void {
    if (nic.valid && nic.ch !== 0) {
      this.setNumber('RadicalCharacter', nic.ch);
    }
    this.insertAtomic('RadicalRadical');
  }

  override radicalRadicalDefaulted(): void {
    this.insertAtomic('RadicalRadicalDefaulted');
  }

  override startMathOperatorSerial(): void {
    this.start();
    this.startGroup('MathOperator');
  }

  override endMathOperatorSerial(): void {
    this.endGroup('MathOperator');
    this.end();
  }

  override startMathOperatorOperator(): void {
    this.startGroup('Operator');
  }

  override endMathOperatorOperator(): void {
    this.endGroup('Operator');
  }

  override startMathOperatorLowerLimit(): void {
    this.startGroup('LowerLimit');
  }

  override endMathOperatorLowerLimit(): void {
    this.endGroup('LowerLimit');
  }

  override startMathOperatorUpperLimit(): void {
    this.startGroup('UpperLimit');
  }

  override endMathOperatorUpperLimit(): void {
    this.endGroup('UpperLimit');
  }

  // ============================================================================
  // Grid Support
  // ============================================================================

  override startGrid(nic: { nColumns: number; nRows: number }): void {
    this.start();
    this.setNumber('GridNColumns', nic.nColumns);
    this.setNumber('GridNRows', nic.nRows);
    this.startGroup('Grid');
  }

  override endGrid(): void {
    this.endGroup('Grid');
    this.end();
  }

  override startGridCell(nic: { columnNumber: number; rowNumber: number }): void {
    this.start();
    this.setNumber('GridColumnNumber', nic.columnNumber);
    this.setNumber('GridRowNumber', nic.rowNumber);
    this.startGroup('GridCell');
  }

  override endGridCell(): void {
    this.endGroup('GridCell');
    this.end();
  }

  // ============================================================================
  // Property Setters
  // ============================================================================

  override setFontSize(size: Length): void {
    this.setLength('FontSize', size);
  }

  override setFontFamilyName(name: string): void {
    this.set('FontFamilyName', name);
  }

  override setFontWeight(weight: Symbol): void {
    this.setSymbol('FontWeight', weight);
  }

  override setFontPosture(posture: Symbol): void {
    this.setSymbol('FontPosture', posture);
  }

  override setStartIndent(indent: LengthSpec): void {
    this.nextFormat_.fotStartIndentSpec = indent;
    this.setLengthSpec('StartIndent', indent);
  }

  override setEndIndent(indent: LengthSpec): void {
    this.nextFormat_.fotEndIndentSpec = indent;
    this.setLengthSpec('EndIndent', indent);
  }

  override setFirstLineStartIndent(indent: LengthSpec): void {
    this.setLengthSpec('FirstLineStartIndent', indent);
  }

  override setLastLineEndIndent(indent: LengthSpec): void {
    this.setLengthSpec('LastLineEndIndent', indent);
  }

  override setLineSpacing(spacing: LengthSpec): void {
    this.setLengthSpec('LineSpacing', spacing);
  }

  override setFieldWidth(width: LengthSpec): void {
    this.setLengthSpec('FieldWidth', width);
  }

  override setQuadding(quad: Symbol): void {
    this.setSymbol('Quadding', quad);
  }

  override setDisplayAlignment(align: Symbol): void {
    this.nextFormat_.fotDisplayAlignment = align;
    this.setSymbol('DisplayAlignment', align);
  }

  override setFieldAlign(align: Symbol): void {
    this.setSymbol('FieldAlign', align);
  }

  override setColor(color: DeviceRGBColor): void {
    this.setColorDef('Color', color);
  }

  override setBackgroundColor(color: DeviceRGBColor): void {
    this.nextFormat_.fotBackgroundColor = color;
    this.setColorDef('BackgroundColor', color);
  }

  override setLines(lines: Symbol): void {
    this.nextFormat_.fotLines = lines;
    this.setSymbol('Lines', lines);
  }

  override setLineThickness(thickness: Length): void {
    this.nextFormat_.fotLineThickness = thickness;
    this.setLength('LineThickness', thickness);
  }

  override setLineSep(sep: Length): void {
    this.nextFormat_.fotLineSep = sep;
    this.setLength('LineSep', sep);
  }

  override setLineCap(cap: Symbol): void {
    this.nextFormat_.fotLineCap = cap;
    this.setSymbol('LineCap', cap);
  }

  override setBorderPresent(present: boolean): void {
    this.nextFormat_.fotBorderPresent = present;
    this.setBool('BorderPresent', present);
  }

  override setBorderPriority(priority: number): void {
    this.nextFormat_.fotBorderPriority = priority;
    this.setNumber('BorderPriority', priority);
  }

  override setLineRepeat(repeat: number): void {
    this.nextFormat_.fotLineRepeat = repeat;
    this.setNumber('LineRepeat', repeat);
  }

  override setPageWidth(width: Length): void {
    this.nextFormat_.fotPageWidth = width;
    this.setLength('PageWidth', width);
  }

  override setPageHeight(height: Length): void {
    this.setLength('PageHeight', height);
  }

  override setLeftMargin(margin: Length): void {
    this.nextFormat_.fotLeftMargin = margin;
    this.setLength('LeftMargin', margin);
  }

  override setRightMargin(margin: Length): void {
    this.nextFormat_.fotRightMargin = margin;
    this.setLength('RightMargin', margin);
  }

  override setTopMargin(margin: Length): void {
    this.setLength('TopMargin', margin);
  }

  override setBottomMargin(margin: Length): void {
    this.setLength('BottomMargin', margin);
  }

  override setHeaderMargin(margin: Length): void {
    this.setLength('HeaderMargin', margin);
  }

  override setFooterMargin(margin: Length): void {
    this.setLength('FooterMargin', margin);
  }

  override setSpan(span: number): void {
    this.nextFormat_.fotSpan = span;
    this.setNumber('Span', span);
  }

  override setCellBeforeRowMargin(margin: Length): void {
    this.setLength('CellBeforeRowMargin', margin);
  }

  override setCellAfterRowMargin(margin: Length): void {
    this.setLength('CellAfterRowMargin', margin);
  }

  override setCellBeforeColumnMargin(margin: Length): void {
    this.nextFormat_.fotCellBeforeColumnMargin = margin;
    this.setLength('CellBeforeColumnMargin', margin);
  }

  override setCellAfterColumnMargin(margin: Length): void {
    this.nextFormat_.fotCellAfterColumnMargin = margin;
    this.setLength('CellAfterColumnMargin', margin);
  }

  override setCellBackground(bg: boolean): void {
    this.nextFormat_.fotCellBackground = bg;
    this.setBool('CellBackground', bg);
  }

  override setCellRowAlignment(align: Symbol): void {
    this.nextFormat_.fotCellRowAlignment = align;
    this.setSymbol('CellRowAlignment', align);
  }

  override setHyphenate(hyphenate: boolean): void {
    this.setBool('Hyphenate', hyphenate);
  }

  override setKern(kern: boolean): void {
    this.setBool('Kern', kern);
  }

  override setLanguage(lang: number): void {
    this.setNumber('Language', lang);
  }

  override setCountry(country: number): void {
    this.setNumber('Country', country);
  }

  // ============================================================================
  // Node Tracking
  // ============================================================================

  override startNode(node: NodePtr, mode: StringC): void {
    // Get element index if available
    const ei = node.elementIndex();
    if (ei !== null) {
      this.set('Element', ei.toString());
    }

    // Processing mode
    if (mode && mode.size() > 0) {
      // Convert StringC to string
      let modeStr = '';
      const ptr = mode.data();
      for (let i = 0; i < mode.size(); i++) {
        modeStr += String.fromCharCode(ptr[i]);
      }
      this.set('ProcessingMode', modeStr);
    }

    this.startGroup('Node');
  }

  override endNode(): void {
    this.endGroup('Node');
  }

  override currentNodePageNumber(node: NodePtr): void {
    this.os('\\CurrentNodePageNumber{}');
  }
}

// Factory function
export function makeTeXFOTBuilder(
  outputCallback: (s: string) => void,
  flushCallback: (() => void) | null = null,
  options: string[] = [],
  exts: { value: FOTBuilderExtension[] | null } = { value: null }
): FOTBuilder {
  return new TeXFOTBuilder(outputCallback, flushCallback, options, exts);
}
