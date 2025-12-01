// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Char, StringC } from '@openjade-js/opensp';
import { NodePtr, GroveString, AccessResult } from '../grove/Node';
import {
  SerialFOTBuilder,
  FOTBuilder,
  Symbol,
  Length,
  LengthSpec,
  OptLengthSpec,
  Letter2,
  PublicId,
  DeviceRGBColor,
  CharacterNIC,
  DisplayNIC,
  InlineNIC,
  DisplayGroupNIC,
  ExternalGraphicNIC,
  BoxNIC,
  RuleNIC,
  LeaderNIC,
  TableNIC,
  TablePartNIC,
  TableColumnNIC,
  TableCellNIC,
  GridNIC,
  GridCellNIC,
  Address,
  MultiMode,
  HF,
  nSymbols
} from './FOTBuilder';

// Symbol name strings indexed by Symbol enum
const symbolNames: (string | null)[] = [];
symbolNames[Symbol.symbolFalse] = 'false';
symbolNames[Symbol.symbolTrue] = 'true';
symbolNames[Symbol.symbolNotApplicable] = 'not-applicable';
symbolNames[Symbol.symbolUltraCondensed] = 'ultra-condensed';
symbolNames[Symbol.symbolExtraCondensed] = 'extra-condensed';
symbolNames[Symbol.symbolCondensed] = 'condensed';
symbolNames[Symbol.symbolSemiCondensed] = 'semi-condensed';
symbolNames[Symbol.symbolUltraLight] = 'ultra-light';
symbolNames[Symbol.symbolExtraLight] = 'extra-light';
symbolNames[Symbol.symbolLight] = 'light';
symbolNames[Symbol.symbolSemiLight] = 'semi-light';
symbolNames[Symbol.symbolMedium] = 'medium';
symbolNames[Symbol.symbolSemiExpanded] = 'semi-expanded';
symbolNames[Symbol.symbolExpanded] = 'expanded';
symbolNames[Symbol.symbolExtraExpanded] = 'extra-expanded';
symbolNames[Symbol.symbolUltraExpanded] = 'ultra-expanded';
symbolNames[Symbol.symbolSemiBold] = 'semi-bold';
symbolNames[Symbol.symbolBold] = 'bold';
symbolNames[Symbol.symbolExtraBold] = 'extra-bold';
symbolNames[Symbol.symbolUltraBold] = 'ultra-bold';
symbolNames[Symbol.symbolUpright] = 'upright';
symbolNames[Symbol.symbolOblique] = 'oblique';
symbolNames[Symbol.symbolBackSlantedOblique] = 'back-slanted-oblique';
symbolNames[Symbol.symbolItalic] = 'italic';
symbolNames[Symbol.symbolBackSlantedItalic] = 'back-slanted-italic';
symbolNames[Symbol.symbolStart] = 'start';
symbolNames[Symbol.symbolEnd] = 'end';
symbolNames[Symbol.symbolCenter] = 'center';
symbolNames[Symbol.symbolJustify] = 'justify';
symbolNames[Symbol.symbolSpreadInside] = 'spread-inside';
symbolNames[Symbol.symbolSpreadOutside] = 'spread-outside';
symbolNames[Symbol.symbolPageInside] = 'page-inside';
symbolNames[Symbol.symbolPageOutside] = 'page-outside';
symbolNames[Symbol.symbolWrap] = 'wrap';
symbolNames[Symbol.symbolAsis] = 'asis';
symbolNames[Symbol.symbolAsisWrap] = 'asis-wrap';
symbolNames[Symbol.symbolAsisTruncate] = 'asis-truncate';
symbolNames[Symbol.symbolNone] = 'none';
symbolNames[Symbol.symbolBefore] = 'before';
symbolNames[Symbol.symbolThrough] = 'through';
symbolNames[Symbol.symbolAfter] = 'after';
symbolNames[Symbol.symbolTopToBottom] = 'top-to-bottom';
symbolNames[Symbol.symbolLeftToRight] = 'left-to-right';
symbolNames[Symbol.symbolBottomToTop] = 'bottom-to-top';
symbolNames[Symbol.symbolRightToLeft] = 'right-to-left';
symbolNames[Symbol.symbolInside] = 'inside';
symbolNames[Symbol.symbolOutside] = 'outside';
symbolNames[Symbol.symbolHorizontal] = 'horizontal';
symbolNames[Symbol.symbolVertical] = 'vertical';
symbolNames[Symbol.symbolEscapement] = 'escapement';
symbolNames[Symbol.symbolLineProgression] = 'line-progression';
symbolNames[Symbol.symbolMath] = 'math';
symbolNames[Symbol.symbolOrdinary] = 'ordinary';
symbolNames[Symbol.symbolOperator] = 'operator';
symbolNames[Symbol.symbolBinary] = 'binary';
symbolNames[Symbol.symbolRelation] = 'relation';
symbolNames[Symbol.symbolOpening] = 'opening';
symbolNames[Symbol.symbolClosing] = 'closing';
symbolNames[Symbol.symbolPunctuation] = 'punctuation';
symbolNames[Symbol.symbolInner] = 'inner';
symbolNames[Symbol.symbolSpace] = 'space';
symbolNames[Symbol.symbolPage] = 'page';
symbolNames[Symbol.symbolPageRegion] = 'page-region';
symbolNames[Symbol.symbolColumnSet] = 'column-set';
symbolNames[Symbol.symbolColumn] = 'column';
symbolNames[Symbol.symbolMax] = 'max';
symbolNames[Symbol.symbolMaxUniform] = 'max-uniform';
symbolNames[Symbol.symbolMiter] = 'miter';
symbolNames[Symbol.symbolRound] = 'round';
symbolNames[Symbol.symbolBevel] = 'bevel';
symbolNames[Symbol.symbolButt] = 'butt';
symbolNames[Symbol.symbolSquare] = 'square';
symbolNames[Symbol.symbolLoose] = 'loose';
symbolNames[Symbol.symbolNormal] = 'normal';
symbolNames[Symbol.symbolKern] = 'kern';
symbolNames[Symbol.symbolTight] = 'tight';
symbolNames[Symbol.symbolTouch] = 'touch';
symbolNames[Symbol.symbolPreserve] = 'preserve';
symbolNames[Symbol.symbolCollapse] = 'collapse';
symbolNames[Symbol.symbolIgnore] = 'ignore';
symbolNames[Symbol.symbolRelative] = 'relative';
symbolNames[Symbol.symbolDisplay] = 'display';
symbolNames[Symbol.symbolInline] = 'inline';
symbolNames[Symbol.symbolBorder] = 'border';
symbolNames[Symbol.symbolBackground] = 'background';
symbolNames[Symbol.symbolBoth] = 'both';
symbolNames[Symbol.symbolBase] = 'base';
symbolNames[Symbol.symbolFont] = 'font';
symbolNames[Symbol.symbolTop] = 'top';
symbolNames[Symbol.symbolBottom] = 'bottom';
symbolNames[Symbol.symbolSpread] = 'spread';
symbolNames[Symbol.symbolSolid] = 'solid';
symbolNames[Symbol.symbolOutline] = 'outline';
symbolNames[Symbol.symbolWith] = 'with';
symbolNames[Symbol.symbolAgainst] = 'against';
symbolNames[Symbol.symbolForce] = 'force';
symbolNames[Symbol.symbolIndependent] = 'independent';
symbolNames[Symbol.symbolPile] = 'pile';
symbolNames[Symbol.symbolSupOut] = 'sup-out';
symbolNames[Symbol.symbolSubOut] = 'sub-out';
symbolNames[Symbol.symbolLeadEdge] = 'lead-edge';
symbolNames[Symbol.symbolTrailEdge] = 'trail-edge';
symbolNames[Symbol.symbolExplicit] = 'explicit';
symbolNames[Symbol.symbolRowMajor] = 'row-major';
symbolNames[Symbol.symbolColumnMajor] = 'column-major';

function symbolName(sym: Symbol): string | null {
  if (sym >= 0 && sym < symbolNames.length) {
    return symbolNames[sym] || null;
  }
  return null;
}

// String output stream class for building attribute strings
class StrOutputCharStream {
  private buffer_: string = '';

  write(s: string): void {
    this.buffer_ += s;
  }

  writeChar(c: number): void {
    this.buffer_ += String.fromCodePoint(c);
  }

  writeNum(n: number): void {
    this.buffer_ += n.toString();
  }

  extractString(): string {
    const result = this.buffer_;
    this.buffer_ = '';
    return result;
  }

  clear(): void {
    this.buffer_ = '';
  }
}

// Output stream wrapper for the main output
class OutputCharStream {
  private callback_: (s: string) => void;
  private flushCallback_: (() => void) | null;

  constructor(callback: (s: string) => void, flushCallback?: () => void) {
    this.callback_ = callback;
    this.flushCallback_ = flushCallback || null;
  }

  write(s: string): void {
    this.callback_(s);
  }

  writeChar(c: number): void {
    this.callback_(String.fromCodePoint(c));
  }

  put(c: number): void {
    this.callback_(String.fromCodePoint(c));
  }

  writeNum(n: number): void {
    this.callback_(n.toString());
  }

  flush(): void {
    if (this.flushCallback_) {
      this.flushCallback_();
    }
  }
}

// Constants
const RE = '\n'; // Record end (newline)
const quot = '"';
const trueString = 'true';
const falseString = 'false';

// Helper to format length in points
function formatLength(units: Length): string {
  // Convert from internal units (millipoints) to points
  return (units / 1000).toString() + 'pt';
}

// Helper to format length spec
function formatLengthSpec(ls: LengthSpec): string {
  if (ls.displaySizeFactor !== 0.0) {
    return ls.length.toString() + '+' + ls.displaySizeFactor.toString() + 'd';
  }
  return (ls.length / 1000).toString() + 'pt';
}

// Helper to format RGB color
function formatColor(color: DeviceRGBColor): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return '#' + hex(color.red) + hex(color.green) + hex(color.blue);
}

// Check if a node is an element
// Following upstream: use getGi() to determine if node is an element
function nodeIsElement(node: NodePtr | null): boolean {
  if (!node || !node.node()) return false;
  const giResult = node.node()!.getGi();
  return giResult.result === AccessResult.accessOK;
}

// SgmlFOTBuilder - outputs flow object tree as SGML per fot.dtd
export class SgmlFOTBuilder extends SerialFOTBuilder {
  private os_: OutputCharStream;
  private curOs_: OutputCharStream;
  private ics_: StrOutputCharStream; // inherited characteristics string buffer
  private hfs_: StrOutputCharStream; // header/footer string buffer
  private hf_: string[]; // header/footer content strings
  private suppressAnchors_: number = 0;
  private nodeLevel_: number = 0;
  private pendingElements_: NodePtr[] = [];
  private pendingElementLevels_: number[] = [];
  private nPendingElementsNonEmpty_: number = 0;

  constructor(outputCallback: (s: string) => void, flushCallback?: () => void) {
    super();
    this.os_ = new OutputCharStream(outputCallback, flushCallback);
    this.curOs_ = this.os_;
    this.ics_ = new StrOutputCharStream();
    this.hfs_ = new StrOutputCharStream();
    this.hf_ = new Array(HF.nHF).fill('');

    // Output XML declaration and fot root element
    this.os().write('<?xml version="1.0"?>' + RE);
    this.os().write('<fot>' + RE);
  }

  finish(): void {
    this.os().write('</fot>' + RE);
  }

  override flush(): void {
    this.finish();
    // Flush the underlying output stream
    this.os_.flush();
  }

  private os(): OutputCharStream {
    return this.curOs_;
  }

  // Helper methods for outputting characteristics

  private outputIcs(): void {
    const str = this.ics_.extractString();
    this.os().write(str);
  }

  private lengthC(name: string, units: Length): void {
    this.ics_.write(' ' + name + '=' + quot + formatLength(units) + quot);
  }

  private lengthSpecC(name: string, ls: LengthSpec): void {
    this.ics_.write(' ' + name + '=' + quot + formatLengthSpec(ls) + quot);
  }

  private optLengthSpecC(name: string, ols: OptLengthSpec): void {
    if (ols.hasLength) {
      this.lengthSpecC(name, ols.length);
    } else {
      this.ics_.write(' ' + name + '=' + quot + falseString + quot);
    }
  }

  private symbolC(name: string, sym: Symbol): void {
    const s = symbolName(sym);
    if (s) {
      this.ics_.write(' ' + name + '=' + quot + s + quot);
    }
  }

  private boolC(name: string, b: boolean): void {
    this.ics_.write(' ' + name + '=' + quot + (b ? trueString : falseString) + quot);
  }

  private integerC(name: string, n: number): void {
    this.ics_.write(' ' + name + '=' + quot + n.toString() + quot);
  }

  private publicIdC(name: string, pubid: PublicId): void {
    this.ics_.write(' ' + name + '=' + quot);
    if (pubid) {
      this.ics_.write(pubid);
    } else {
      this.ics_.write(falseString);
    }
    this.ics_.write(quot);
  }

  // Display non-inherited characteristics
  private displayNIC(nic: DisplayNIC): void {
    if (nic.keepWithPrevious) {
      this.os().write(' keep-with-previous=' + quot + trueString + quot);
    }
    if (nic.keepWithNext) {
      this.os().write(' keep-with-next=' + quot + trueString + quot);
    }
    if (nic.mayViolateKeepBefore) {
      this.os().write(' may-violate-keep-before=' + quot + trueString + quot);
    }
    if (nic.mayViolateKeepAfter) {
      this.os().write(' may-violate-keep-after=' + quot + trueString + quot);
    }
    if (nic.positionPreference !== Symbol.symbolFalse) {
      this.os().write(' position-preference=' + quot + symbolName(nic.positionPreference) + quot);
    }
    if (nic.keep !== Symbol.symbolFalse) {
      this.os().write(' keep=' + quot + symbolName(nic.keep) + quot);
    }
    if (nic.breakBefore !== Symbol.symbolFalse) {
      this.os().write(' break-before=' + quot + symbolName(nic.breakBefore) + quot);
    }
    if (nic.breakAfter !== Symbol.symbolFalse) {
      this.os().write(' break-after=' + quot + symbolName(nic.breakAfter) + quot);
    }
    this.displaySpaceNIC('space-before', nic.spaceBefore);
    this.displaySpaceNIC('space-after', nic.spaceAfter);
  }

  // Display space non-inherited characteristics - matches upstream displaySpaceNIC
  private displaySpaceNIC(name: string, ds: { nominal: LengthSpec; min: LengthSpec; max: LengthSpec; priority: number; conditional: boolean; force: boolean }): void {
    // In C++, LengthSpec has operator long() returning length, so ds.nominal || ds.min || ds.max
    // is equivalent to ds.nominal.length || ds.min.length || ds.max.length
    if (ds.nominal.length || ds.min.length || ds.max.length) {
      this.os().write(' ' + name + '=' + quot + formatLengthSpec(ds.nominal));
      // Output min,max if they differ from nominal
      if (ds.min.length !== ds.nominal.length
          || ds.min.displaySizeFactor !== ds.nominal.displaySizeFactor
          || ds.max.length !== ds.nominal.length
          || ds.max.displaySizeFactor !== ds.nominal.displaySizeFactor) {
        this.os().write(',' + formatLengthSpec(ds.min) + ',' + formatLengthSpec(ds.max));
      }
      this.os().write(quot);
    }
    // These are output OUTSIDE the main if block (per upstream)
    if (ds.force) {
      this.os().write(' ' + name + '-priority=' + quot + 'force' + quot);
    } else if (ds.priority) {
      this.os().write(' ' + name + '-priority=' + quot + ds.priority + quot);
    }
    if (!ds.conditional) {
      this.os().write(' ' + name + '-conditional=' + quot + falseString + quot);
    }
  }

  // Inline non-inherited characteristics
  private inlineNIC(nic: InlineNIC): void {
    if (nic.breakBeforePriority !== 0) {
      this.os().write(' break-before-priority=' + quot + nic.breakBeforePriority + quot);
    }
    if (nic.breakAfterPriority !== 0) {
      this.os().write(' break-after-priority=' + quot + nic.breakAfterPriority + quot);
    }
  }

  // Character non-inherited characteristics
  private characterNIC(nic: CharacterNIC): void {
    if (nic.specifiedC & (1 << CharacterNIC.cChar)) {
      this.os().write(' char=' + quot);
      this.outputData(nic.ch);
      this.os().write(quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cGlyphId)) {
      if (nic.glyphId.publicId) {
        this.os().write(' glyph-id=' + quot + nic.glyphId.publicId);
        if (nic.glyphId.suffix) {
          this.os().write('::' + nic.glyphId.suffix);
        }
        this.os().write(quot);
      }
    }
    if (nic.specifiedC & (1 << CharacterNIC.cIsDropAfterLineBreak)) {
      this.os().write(' drop-after-line-break=' + quot + (nic.isDropAfterLineBreak ? trueString : falseString) + quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cIsDropUnlessBeforeLineBreak)) {
      this.os().write(' drop-unless-before-line-break=' + quot + (nic.isDropUnlessBeforeLineBreak ? trueString : falseString) + quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cIsPunct)) {
      this.os().write(' punct=' + quot + (nic.isPunct ? trueString : falseString) + quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cIsSpace)) {
      this.os().write(' space=' + quot + (nic.isSpace ? trueString : falseString) + quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cIsInputTab)) {
      this.os().write(' input-tab=' + quot + (nic.isInputTab ? trueString : falseString) + quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cIsInputWhitespace)) {
      this.os().write(' input-whitespace=' + quot + (nic.isInputWhitespace ? trueString : falseString) + quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cIsRecordEnd)) {
      this.os().write(' record-end=' + quot + (nic.isRecordEnd ? trueString : falseString) + quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cBreakBeforePriority)) {
      this.os().write(' break-before-priority=' + quot + nic.breakBeforePriority + quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cBreakAfterPriority)) {
      this.os().write(' break-after-priority=' + quot + nic.breakAfterPriority + quot);
    }
    if (nic.specifiedC & (1 << CharacterNIC.cMathFontPosture)) {
      const name = symbolName(nic.mathFontPosture);
      if (name) {
        this.os().write(' math-font-posture=' + quot + name + quot);
      }
    }
    if (nic.specifiedC & (1 << CharacterNIC.cMathClass)) {
      const name = symbolName(nic.mathClass);
      if (name) {
        this.os().write(' math-class=' + quot + name + quot);
      }
    }
    if (nic.specifiedC & (1 << CharacterNIC.cScript)) {
      if (nic.script) {
        this.os().write(' script=' + quot + nic.script + quot);
      }
    }
    if (nic.stretchFactor !== 1.0) {
      this.os().write(' stretch-factor=' + quot + nic.stretchFactor + quot);
    }
  }

  // Output SGML/XML data with proper escaping
  private outputData(c: Char): void {
    if (c === 0x26) { // &
      this.os().write('&amp;');
    } else if (c === 0x3C) { // <
      this.os().write('&lt;');
    } else if (c === 0x3E) { // >
      this.os().write('&gt;');
    } else if (c === 0x22) { // "
      this.os().write('&quot;');
    } else if (c < 0x80) {
      // ASCII characters (except already handled special chars)
      this.os().put(c);
    } else {
      // Non-ASCII characters: output as numeric character reference
      this.os().write('&#' + c + ';');
    }
  }

  private outputDataStr(data: Uint32Array, n: number): void {
    for (let i = 0; i < n; i++) {
      this.outputData(data[i]);
    }
  }

  private flushPendingElements(): void {
    if (this.suppressAnchors_) {
      return;
    }
    for (let i = 0; i < this.pendingElements_.length; i++) {
      const node = this.pendingElements_[i];
      this.os().write('<a name=' + quot);
      this.outputElementName(node);
      this.os().write(quot + '/>' + RE);
    }
    this.nPendingElementsNonEmpty_ = 0;
    this.pendingElements_ = [];
    this.pendingElementLevels_ = [];
  }

  private outputElementName(node: NodePtr | null): void {
    if (!node || !node.node()) return;
    const idResult = node.node()!.getId();
    if (idResult.result === AccessResult.accessOK) {
      const groveIndex = node.groveIndex();
      if (groveIndex) {
        this.os().write(groveIndex + '.');
      }
      // Output the id string
      const str = idResult.str;
      const data = str.data();
      if (data) {
        for (let i = 0; i < str.size(); i++) {
          this.outputData(data[i]);
        }
      }
    } else {
      const groveIndex = node.groveIndex();
      if (groveIndex) {
        this.os().write(groveIndex + '.');
      }
      const elemIdx = node.elementIndex();
      if (elemIdx !== null) {
        this.os().write(elemIdx.toString());
      }
    }
  }

  // Helper for starting simple flow objects
  private startSimpleFlowObj(name: string): void {
    this.os().write('<' + name);
    this.outputIcs();
    this.os().write('>' + RE);
  }

  // Helper for ending flow objects
  private endFlow(name: string): void {
    this.os().write('</' + name + '>' + RE);
  }

  // Helper for port flow objects (empty start tag for port content)
  private startPortFlow(name: string): void {
    this.os().write('<' + name + '>' + RE);
  }

  // Helper for simple/atomic flow objects
  private simpleFlowObj(name: string): void {
    this.os().write('<' + name);
    this.outputIcs();
    this.os().write('/>' + RE);
  }

  // === Atomic Flow Objects ===

  override characters(s: Uint32Array, n: number): void {
    // Port from upstream: don't flush pending elements for empty text
    if (n === 0) {
      return;
    }
    this.flushPendingElements();
    this.os().write('<text>');
    this.outputDataStr(s, n);
    this.os().write('</text>' + RE);
  }

  override character(nic: CharacterNIC): void {
    this.flushPendingElements();
    this.os().write('<character');
    this.characterNIC(nic);
    this.outputIcs();
    this.os().write('/>' + RE);
  }

  override paragraphBreak(_nic: DisplayNIC): void {
    this.simpleFlowObj('paragraph-break');
  }

  override externalGraphic(nic: ExternalGraphicNIC): void {
    this.flushPendingElements();
    this.os().write('<external-graphic entity-system-id=' + quot);
    this.os().write(nic.entitySystemId);
    this.os().write(quot + ' notation-system-id=' + quot);
    this.os().write(nic.notationSystemId);
    this.os().write(quot);
    if (nic.scaleType !== Symbol.symbolFalse) {
      this.os().write(' scale=' + quot + symbolName(nic.scaleType) + quot);
    } else {
      this.os().write(' scale-x=' + quot + nic.scale[0] + quot);
      this.os().write(' scale-y=' + quot + nic.scale[1] + quot);
    }
    if (nic.hasMaxWidth) {
      this.os().write(' max-width=' + quot + formatLengthSpec(nic.maxWidth) + quot);
    }
    if (nic.hasMaxHeight) {
      this.os().write(' max-height=' + quot + formatLengthSpec(nic.maxHeight) + quot);
    }
    if (nic.isDisplay) {
      this.os().write(' display=' + quot + trueString + quot);
      this.displayNIC(nic);
    } else {
      if (nic.escapementDirection !== Symbol.symbolFalse) {
        this.os().write(' escapement-direction=' + quot + symbolName(nic.escapementDirection) + quot);
      }
      if (nic.positionPointX.length || nic.positionPointX.displaySizeFactor) {
        this.os().write(' position-point-x=' + quot + formatLengthSpec(nic.positionPointX) + quot);
      }
      if (nic.positionPointY.length || nic.positionPointY.displaySizeFactor) {
        this.os().write(' position-point-y=' + quot + formatLengthSpec(nic.positionPointY) + quot);
      }
      this.inlineNIC(nic);
    }
    this.outputIcs();
    this.os().write('/>' + RE);
  }

  override rule(nic: RuleNIC): void {
    this.flushPendingElements();
    const s = symbolName(nic.orientation);
    if (!s) return;
    this.os().write('<rule orientation=' + quot + s + quot);
    if (nic.orientation === Symbol.symbolHorizontal || nic.orientation === Symbol.symbolVertical) {
      this.displayNIC(nic);
    } else {
      this.inlineNIC(nic);
    }
    if (nic.hasLength) {
      this.os().write(' length=' + quot + formatLengthSpec(nic.length) + quot);
    }
    this.outputIcs();
    this.os().write('/>' + RE);
  }

  override alignmentPoint(): void {
    this.simpleFlowObj('alignment-point');
  }

  override pageNumber(): void {
    this.os().write('<page-number/>' + RE);
  }

  // === Non-atomic Flow Objects ===

  override startSequence(): void {
    this.startSimpleFlowObj('sequence');
  }

  override endSequence(): void {
    this.endFlow('sequence');
  }

  override startParagraph(_nic: DisplayNIC): void {
    this.os().write('<paragraph');
    this.displayNIC(_nic);
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endParagraph(): void {
    this.endFlow('paragraph');
  }

  override startDisplayGroup(nic: DisplayGroupNIC): void {
    this.os().write('<display-group');
    if (nic.hasCoalesceId) {
      this.os().write(' coalesce-id=' + quot + nic.coalesceId + quot);
    }
    this.displayNIC(nic);
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endDisplayGroup(): void {
    this.endFlow('display-group');
  }

  override startLineField(_nic: InlineNIC): void {
    this.flushPendingElements();
    this.startSimpleFlowObj('line-field');
  }

  override endLineField(): void {
    this.endFlow('line-field');
  }

  override startScroll(): void {
    this.startSimpleFlowObj('scroll');
  }

  override endScroll(): void {
    this.endFlow('scroll');
  }

  override startLink(addr: Address): void {
    this.os().write('<link');
    if (addr.type !== Address.Type.none) {
      this.os().write(' destination=' + quot);
      switch (addr.type) {
        case Address.Type.resolvedNode:
          if (addr.node) {
            this.outputElementName(addr.node);
          }
          break;
        case Address.Type.idref:
          this.os().write(addr.params[0]);
          break;
        case Address.Type.html:
          this.os().write(addr.params[0]);
          break;
        default:
          this.os().write(addr.params[0]);
          break;
      }
      this.os().write(quot);
    }
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endLink(): void {
    this.endFlow('link');
  }

  override startMarginalia(): void {
    this.startSimpleFlowObj('marginalia');
  }

  override endMarginalia(): void {
    this.endFlow('marginalia');
  }

  override startLeader(nic: LeaderNIC): void {
    this.flushPendingElements();
    this.os().write('<leader');
    if (nic.hasLength) {
      this.os().write(' length=' + quot + formatLengthSpec(nic.length) + quot);
    }
    this.inlineNIC(nic);
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endLeader(): void {
    this.endFlow('leader');
  }

  override startSideline(): void {
    this.startSimpleFlowObj('sideline');
  }

  override endSideline(): void {
    this.endFlow('sideline');
  }

  override startBox(nic: BoxNIC): void {
    this.flushPendingElements();
    this.os().write('<box');
    if (nic.isDisplay) {
      this.os().write(' display=' + quot + trueString + quot);
      this.displayNIC(nic);
    } else {
      this.inlineNIC(nic);
    }
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endBox(): void {
    this.endFlow('box');
  }

  // Score flow objects
  override startScoreSymbol(type: Symbol): void {
    this.os().write('<score type=' + quot + symbolName(type) + quot);
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override startScoreLengthSpec(ls: LengthSpec): void {
    this.os().write('<score type.length-spec=' + quot + formatLengthSpec(ls) + quot);
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override startScoreChar(c: Char): void {
    this.os().write('<score type="char" char=' + quot);
    this.os().put(c);
    this.os().write(quot);
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endScore(): void {
    this.endFlow('score');
  }

  // Math flow objects
  override startMathSequence(): void {
    this.startSimpleFlowObj('math-sequence');
  }

  override endMathSequence(): void {
    this.endFlow('math-sequence');
  }

  override startUnmath(): void {
    this.startSimpleFlowObj('unmath');
  }

  override endUnmath(): void {
    this.endFlow('unmath');
  }

  override startSuperscript(): void {
    this.startSimpleFlowObj('superscript');
  }

  override endSuperscript(): void {
    this.endFlow('superscript');
  }

  override startSubscript(): void {
    this.startSimpleFlowObj('subscript');
  }

  override endSubscript(): void {
    this.endFlow('subscript');
  }

  // Serial math flow objects
  override startFractionSerial(): void {
    this.startSimpleFlowObj('fraction');
  }

  override endFractionSerial(): void {
    this.endFlow('fraction');
  }

  override startFractionNumerator(): void {
    this.startPortFlow('fraction.numerator');
  }

  override endFractionNumerator(): void {
    this.endFlow('fraction.numerator');
  }

  override startFractionDenominator(): void {
    this.startPortFlow('fraction.denominator');
  }

  override endFractionDenominator(): void {
    this.endFlow('fraction.denominator');
  }

  override fractionBar(): void {
    this.simpleFlowObj('fraction.fraction-bar');
  }

  override startScriptSerial(): void {
    this.startSimpleFlowObj('script');
    this.startPortFlow('script.principal');
  }

  override endScriptSerial(): void {
    this.endFlow('script');
  }

  override startScriptPreSup(): void {
    this.endFlow('script.principal');
    this.startPortFlow('script.pre-sup');
  }

  override endScriptPreSup(): void {
    this.endFlow('script.pre-sup');
  }

  override startScriptPreSub(): void {
    this.startPortFlow('script.pre-sub');
  }

  override endScriptPreSub(): void {
    this.endFlow('script.pre-sub');
  }

  override startScriptPostSup(): void {
    this.startPortFlow('script.post-sup');
  }

  override endScriptPostSup(): void {
    this.endFlow('script.post-sup');
  }

  override startScriptPostSub(): void {
    this.startPortFlow('script.post-sub');
  }

  override endScriptPostSub(): void {
    this.endFlow('script.post-sub');
  }

  override startScriptMidSup(): void {
    this.startPortFlow('script.mid-sup');
  }

  override endScriptMidSup(): void {
    this.endFlow('script.mid-sup');
  }

  override startScriptMidSub(): void {
    this.startPortFlow('script.mid-sub');
  }

  override endScriptMidSub(): void {
    this.endFlow('script.mid-sub');
  }

  override startMarkSerial(): void {
    this.startSimpleFlowObj('mark');
    this.startPortFlow('mark.principal');
  }

  override endMarkSerial(): void {
    this.endFlow('mark');
  }

  override startMarkOver(): void {
    this.endFlow('mark.principal');
    this.startPortFlow('mark.over-mark');
  }

  override endMarkOver(): void {
    this.endFlow('mark.over-mark');
  }

  override startMarkUnder(): void {
    this.startPortFlow('mark.under-mark');
  }

  override endMarkUnder(): void {
    this.endFlow('mark.under-mark');
  }

  override startFenceSerial(): void {
    this.startSimpleFlowObj('fence');
    this.startPortFlow('fence.principal');
  }

  override endFenceSerial(): void {
    this.endFlow('fence');
  }

  override startFenceOpen(): void {
    this.endFlow('fence.principal');
    this.startPortFlow('fence.open');
  }

  override endFenceOpen(): void {
    this.endFlow('fence.open');
  }

  override startFenceClose(): void {
    this.startPortFlow('fence.close');
  }

  override endFenceClose(): void {
    this.endFlow('fence.close');
  }

  override startRadicalSerial(): void {
    this.startSimpleFlowObj('radical');
  }

  override endRadicalSerial(): void {
    this.endFlow('radical');
  }

  override startRadicalDegree(): void {
    this.endFlow('radical.principal');
    this.startPortFlow('radical.degree');
  }

  override endRadicalDegree(): void {
    this.endFlow('radical.degree');
  }

  override radicalRadical(nic: CharacterNIC): void {
    this.os().write('<radical.radical');
    this.characterNIC(nic);
    this.outputIcs();
    this.os().write('/>' + RE);
    this.startPortFlow('radical.principal');
  }

  override radicalRadicalDefaulted(): void {
    this.startPortFlow('radical.principal');
  }

  override startMathOperatorSerial(): void {
    this.startSimpleFlowObj('math-operator');
    this.startPortFlow('math-operator.principal');
  }

  override endMathOperatorSerial(): void {
    this.endFlow('math-operator');
  }

  override startMathOperatorOperator(): void {
    this.endFlow('math-operator.principal');
    this.startPortFlow('math-operator.operator');
  }

  override endMathOperatorOperator(): void {
    this.endFlow('math-operator.operator');
  }

  override startMathOperatorLowerLimit(): void {
    this.startPortFlow('math-operator.lower-limit');
  }

  override endMathOperatorLowerLimit(): void {
    this.endFlow('math-operator.lower-limit');
  }

  override startMathOperatorUpperLimit(): void {
    this.startPortFlow('math-operator.upper-limit');
  }

  override endMathOperatorUpperLimit(): void {
    this.endFlow('math-operator.upper-limit');
  }

  // Grid flow objects
  override startGrid(nic: GridNIC): void {
    this.os().write('<grid');
    if (nic.nColumns) {
      this.os().write(' grid-n-columns=' + quot + nic.nColumns + quot);
    }
    if (nic.nRows) {
      this.os().write(' grid-n-rows=' + quot + nic.nRows + quot);
    }
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endGrid(): void {
    this.endFlow('grid');
  }

  override startGridCell(nic: GridCellNIC): void {
    this.os().write('<grid-cell');
    if (nic.columnNumber) {
      this.os().write(' column-number=' + quot + nic.columnNumber + quot);
    }
    if (nic.rowNumber) {
      this.os().write(' row-number=' + quot + nic.rowNumber + quot);
    }
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endGridCell(): void {
    this.endFlow('grid-cell');
  }

  // Simple page sequence
  override startSimplePageSequenceSerial(): void {
    this.startSimpleFlowObj('simple-page-sequence');
    this.suppressAnchors_ = 1;
    this.curOs_ = new OutputCharStream((s) => this.hfs_.write(s));
  }

  override endSimplePageSequenceSerial(): void {
    this.endFlow('simple-page-sequence');
  }

  override startSimplePageSequenceHeaderFooterSerial(_flags: number): void {
    // Empty - content goes to hfs_
  }

  override endSimplePageSequenceHeaderFooterSerial(flags: number): void {
    this.hf_[flags] = this.hfs_.extractString();
  }

  override endAllSimplePageSequenceHeaderFooter(): void {
    this.curOs_ = this.os_;
    this.suppressAnchors_ = 0;
    const { firstHF, frontHF, headerHF, centerHF, rightHF } = HF;
    const nHF = HF.nHF;

    for (let i = 0; i < nHF; i += nHF / 6) {
      let front: number;
      if (this.hf_[i + (firstHF | frontHF)] !== this.hf_[i + (firstHF)] ||
          this.hf_[i + frontHF] !== this.hf_[i]) {
        front = frontHF;
      } else {
        front = 0;
      }
      let first: number;
      if (this.hf_[i + (firstHF | frontHF)] !== this.hf_[i + frontHF] ||
          this.hf_[i + firstHF] !== this.hf_[i]) {
        first = firstHF;
      } else {
        first = 0;
      }
      for (let j = 0; j <= front; j += frontHF) {
        for (let k = 0; k <= first; k += firstHF) {
          const str = this.hf_[i + j + k];
          if (str.length !== 0) {
            let side: string;
            if (i & centerHF) {
              side = 'center';
            } else if (i & rightHF) {
              side = 'right';
            } else {
              side = 'left';
            }
            const hf = (i & headerHF) ? 'header' : 'footer';
            this.os().write('<simple-page-sequence.' + side + '-' + hf);
            if (front) {
              this.os().write(' front=' + quot + (j !== 0 ? trueString : falseString) + quot);
            }
            if (first) {
              this.os().write(' first=' + quot + (k !== 0 ? trueString : falseString) + quot);
            }
            this.os().write('>' + RE);
            this.os().write(str + '</simple-page-sequence.' + side + '-' + hf + '>' + RE);
          }
        }
      }
    }
  }

  // Table flow objects
  override startTable(nic: TableNIC): void {
    this.flushPendingElements();
    this.os().write('<table');
    switch (nic.widthType) {
      case TableNIC.widthExplicit:
        this.os().write(' width=' + quot + formatLengthSpec(nic.width) + quot);
        break;
      case TableNIC.widthMinimum:
        this.os().write(' minimum-width=' + quot + trueString + quot);
        break;
    }
    this.displayNIC(nic);
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endTable(): void {
    this.endFlow('table');
  }

  override tableBeforeRowBorder(): void {
    this.simpleFlowObj('table.before-row-border');
  }

  override tableAfterRowBorder(): void {
    this.simpleFlowObj('table.after-row-border');
  }

  override tableBeforeColumnBorder(): void {
    this.simpleFlowObj('table.before-column-border');
  }

  override tableAfterColumnBorder(): void {
    this.simpleFlowObj('table.after-column-border');
  }

  override tableColumn(nic: TableColumnNIC): void {
    this.os().write('<table-column column-number=' + quot + (nic.columnIndex + 1) + quot);
    if (nic.nColumnsSpanned !== 1) {
      this.os().write(' n-columns-spanned=' + quot + nic.nColumnsSpanned + quot);
    }
    if (nic.hasWidth) {
      this.os().write(' width=' + quot + formatLengthSpec(nic.width) + quot);
    }
    this.outputIcs();
    this.os().write('/>' + RE);
  }

  override startTablePartSerial(nic: TablePartNIC): void {
    this.os().write('<table-part');
    this.displayNIC(nic);
    this.outputIcs();
    this.os().write('>' + RE);
    this.startPortFlow('table-part.principal');
  }

  override endTablePartSerial(): void {
    this.endFlow('table-part');
  }

  override startTablePartHeader(): void {
    this.endFlow('table-part.principal');
    this.os().write('<table-part.header>' + RE);
  }

  override endTablePartHeader(): void {
    this.endFlow('table-part.header');
  }

  override startTablePartFooter(): void {
    this.os().write('<table-part.footer>' + RE);
  }

  override endTablePartFooter(): void {
    this.endFlow('table-part.footer');
  }

  override startTableRow(): void {
    this.startSimpleFlowObj('table-row');
  }

  override endTableRow(): void {
    this.endFlow('table-row');
  }

  override startTableCell(nic: TableCellNIC): void {
    if (nic.missing) {
      this.os().write('<table-cell column-number=' + quot + '0' + quot);
    } else {
      this.os().write('<table-cell column-number=' + quot + (nic.columnIndex + 1) + quot);
      if (nic.nColumnsSpanned !== 1) {
        this.os().write(' n-columns-spanned=' + quot + nic.nColumnsSpanned + quot);
      }
      if (nic.nRowsSpanned !== 1) {
        this.os().write(' n-rows-spanned=' + quot + nic.nRowsSpanned + quot);
      }
    }
    this.outputIcs();
    this.os().write('>' + RE);
  }

  override endTableCell(): void {
    this.endFlow('table-cell');
  }

  override tableCellBeforeRowBorder(): void {
    this.simpleFlowObj('table-cell.before-row-border');
  }

  override tableCellAfterRowBorder(): void {
    this.simpleFlowObj('table-cell.after-row-border');
  }

  override tableCellBeforeColumnBorder(): void {
    this.simpleFlowObj('table-cell.before-column-border');
  }

  override tableCellAfterColumnBorder(): void {
    this.simpleFlowObj('table-cell.after-column-border');
  }

  // Node tracking
  override startNode(node: NodePtr, mode: StringC): void {
    this.nodeLevel_++;
    if (mode.size() !== 0 || !nodeIsElement(node)) {
      return;
    }
    // Check if node is already pending
    for (let i = 0; i < this.pendingElements_.length; i++) {
      if (this.pendingElements_[i].sameNode(node)) {
        return;
      }
    }
    this.pendingElements_.push(node);
    this.pendingElementLevels_.push(this.nodeLevel_);
  }

  override endNode(): void {
    if (this.pendingElements_.length > 0 &&
        this.pendingElementLevels_[this.pendingElementLevels_.length - 1] === this.nodeLevel_ &&
        this.nPendingElementsNonEmpty_ < this.pendingElements_.length) {
      this.pendingElementLevels_.pop();
      this.pendingElements_.pop();
    }
    this.nodeLevel_--;
  }

  override currentNodePageNumber(node: NodePtr): void {
    if (!nodeIsElement(node)) {
      return;
    }
    this.os().write('<page-number ref=' + quot);
    this.outputElementName(node);
    this.os().write(quot + '/>' + RE);
  }

  // === Inherited Characteristic Setters ===

  override setFontSize(n: Length): void {
    this.lengthC('font-size', n);
  }

  override setFontFamilyName(name: string): void {
    this.ics_.write(' font-family-name=' + quot + name + quot);
  }

  override setFontWeight(weight: Symbol): void {
    this.symbolC('font-weight', weight);
  }

  override setFontPosture(posture: Symbol): void {
    this.symbolC('font-posture', posture);
  }

  override setStartIndent(ls: LengthSpec): void {
    this.lengthSpecC('start-indent', ls);
  }

  override setEndIndent(ls: LengthSpec): void {
    this.lengthSpecC('end-indent', ls);
  }

  override setFirstLineStartIndent(ls: LengthSpec): void {
    this.lengthSpecC('first-line-start-indent', ls);
  }

  override setLastLineEndIndent(ls: LengthSpec): void {
    this.lengthSpecC('last-line-end-indent', ls);
  }

  override setLineSpacing(ls: LengthSpec): void {
    this.lengthSpecC('line-spacing', ls);
  }

  override setFieldWidth(ls: LengthSpec): void {
    this.lengthSpecC('field-width', ls);
  }

  override setPositionPointShift(ls: LengthSpec): void {
    this.lengthSpecC('position-point-shift', ls);
  }

  override setStartMargin(ls: LengthSpec): void {
    this.lengthSpecC('start-margin', ls);
  }

  override setEndMargin(ls: LengthSpec): void {
    this.lengthSpecC('end-margin', ls);
  }

  override setSidelineSep(ls: LengthSpec): void {
    this.lengthSpecC('sideline-sep', ls);
  }

  override setAsisWrapIndent(ls: LengthSpec): void {
    this.lengthSpecC('asis-wrap-indent', ls);
  }

  override setLineNumberSep(ls: LengthSpec): void {
    this.lengthSpecC('line-number-sep', ls);
  }

  override setLastLineJustifyLimit(ls: LengthSpec): void {
    this.lengthSpecC('last-line-justify-limit', ls);
  }

  override setJustifyGlyphSpaceMaxAdd(ls: LengthSpec): void {
    this.lengthSpecC('justify-glyph-space-max-add', ls);
  }

  override setJustifyGlyphSpaceMaxRemove(ls: LengthSpec): void {
    this.lengthSpecC('justify-glyph-space-max-remove', ls);
  }

  override setTableCornerRadius(ls: LengthSpec): void {
    this.lengthSpecC('table-corner-radius', ls);
  }

  override setBoxCornerRadius(ls: LengthSpec): void {
    this.lengthSpecC('box-corner-radius', ls);
  }

  override setMarginaliaSep(ls: LengthSpec): void {
    this.lengthSpecC('marginalia-sep', ls);
  }

  override setMinPreLineSpacing(ols: OptLengthSpec): void {
    this.optLengthSpecC('min-pre-line-spacing', ols);
  }

  override setMinPostLineSpacing(ols: OptLengthSpec): void {
    this.optLengthSpecC('min-post-line-spacing', ols);
  }

  override setMinLeading(ols: OptLengthSpec): void {
    this.optLengthSpecC('min-leading', ols);
  }

  override setLines(sym: Symbol): void {
    this.symbolC('lines', sym);
  }

  override setQuadding(sym: Symbol): void {
    this.symbolC('quadding', sym);
  }

  override setDisplayAlignment(sym: Symbol): void {
    this.symbolC('display-alignment', sym);
  }

  override setFieldAlign(sym: Symbol): void {
    this.symbolC('field-align', sym);
  }

  override setLineJoin(sym: Symbol): void {
    this.symbolC('line-join', sym);
  }

  override setLineCap(sym: Symbol): void {
    this.symbolC('line-cap', sym);
  }

  override setLineNumberSide(sym: Symbol): void {
    this.symbolC('line-number-side', sym);
  }

  override setKernMode(sym: Symbol): void {
    this.symbolC('kern-mode', sym);
  }

  override setInputWhitespaceTreatment(sym: Symbol): void {
    this.symbolC('input-whitespace-treatment', sym);
  }

  override setFillingDirection(sym: Symbol): void {
    this.symbolC('filling-direction', sym);
  }

  override setWritingMode(sym: Symbol): void {
    this.symbolC('writing-mode', sym);
  }

  override setLastLineQuadding(sym: Symbol): void {
    this.symbolC('last-line-quadding', sym);
  }

  override setMathDisplayMode(sym: Symbol): void {
    this.symbolC('math-display-mode', sym);
  }

  override setScriptPreAlign(sym: Symbol): void {
    this.symbolC('script-pre-align', sym);
  }

  override setScriptPostAlign(sym: Symbol): void {
    this.symbolC('script-post-align', sym);
  }

  override setScriptMidSupAlign(sym: Symbol): void {
    this.symbolC('script-mid-sup-align', sym);
  }

  override setScriptMidSubAlign(sym: Symbol): void {
    this.symbolC('script-mid-sub-align', sym);
  }

  override setNumeratorAlign(sym: Symbol): void {
    this.symbolC('numerator-align', sym);
  }

  override setDenominatorAlign(sym: Symbol): void {
    this.symbolC('denominator-align', sym);
  }

  override setGridPositionCellType(sym: Symbol): void {
    this.symbolC('grid-position-cell-type', sym);
  }

  override setGridColumnAlignment(sym: Symbol): void {
    this.symbolC('grid-column-alignment', sym);
  }

  override setGridRowAlignment(sym: Symbol): void {
    this.symbolC('grid-row-alignment', sym);
  }

  override setBoxType(sym: Symbol): void {
    this.symbolC('box-type', sym);
  }

  override setGlyphAlignmentMode(sym: Symbol): void {
    this.symbolC('glyph-alignment-mode', sym);
  }

  override setBoxBorderAlignment(sym: Symbol): void {
    this.symbolC('box-border-alignment', sym);
  }

  override setCellRowAlignment(sym: Symbol): void {
    this.symbolC('cell-row-alignment', sym);
  }

  override setBorderAlignment(sym: Symbol): void {
    this.symbolC('border-alignment', sym);
  }

  override setSidelineSide(sym: Symbol): void {
    this.symbolC('sideline-side', sym);
  }

  override setHyphenationKeep(sym: Symbol): void {
    this.symbolC('hyphenation-keep', sym);
  }

  override setFontStructure(sym: Symbol): void {
    this.symbolC('font-structure', sym);
  }

  override setFontProportionateWidth(sym: Symbol): void {
    this.symbolC('font-proportionate-width', sym);
  }

  override setCellCrossed(sym: Symbol): void {
    this.symbolC('cell-crossed', sym);
  }

  override setMarginaliaSide(sym: Symbol): void {
    this.symbolC('marginalia-side', sym);
  }

  override setColor(color: DeviceRGBColor): void {
    this.ics_.write(' color=' + quot + formatColor(color) + quot);
  }

  override setBackgroundColor(color: DeviceRGBColor): void {
    this.ics_.write(' background-color=' + quot + formatColor(color) + quot);
  }

  override setPageWidth(units: Length): void {
    this.lengthC('page-width', units);
  }

  override setPageHeight(units: Length): void {
    this.lengthC('page-height', units);
  }

  override setLeftMargin(units: Length): void {
    this.lengthC('left-margin', units);
  }

  override setRightMargin(units: Length): void {
    this.lengthC('right-margin', units);
  }

  override setTopMargin(units: Length): void {
    this.lengthC('top-margin', units);
  }

  override setBottomMargin(units: Length): void {
    this.lengthC('bottom-margin', units);
  }

  override setHeaderMargin(units: Length): void {
    this.lengthC('header-margin', units);
  }

  override setFooterMargin(units: Length): void {
    this.lengthC('footer-margin', units);
  }

  override setLineThickness(units: Length): void {
    this.lengthC('line-thickness', units);
  }

  override setCellBeforeRowMargin(units: Length): void {
    this.lengthC('cell-before-row-margin', units);
  }

  override setCellAfterRowMargin(units: Length): void {
    this.lengthC('cell-after-row-margin', units);
  }

  override setCellBeforeColumnMargin(units: Length): void {
    this.lengthC('cell-before-column-margin', units);
  }

  override setCellAfterColumnMargin(units: Length): void {
    this.lengthC('cell-after-column-margin', units);
  }

  override setLineSep(units: Length): void {
    this.lengthC('line-sep', units);
  }

  override setBoxSizeBefore(units: Length): void {
    this.lengthC('box-size-before', units);
  }

  override setBoxSizeAfter(units: Length): void {
    this.lengthC('box-size-after', units);
  }

  override setLayer(n: number): void {
    this.integerC('layer', n);
  }

  override setBackgroundLayer(n: number): void {
    this.integerC('background-layer', n);
  }

  override setBorderPriority(n: number): void {
    this.integerC('border-priority', n);
  }

  override setLineRepeat(n: number): void {
    this.integerC('line-repeat', n);
  }

  override setSpan(n: number): void {
    this.integerC('span', n);
  }

  override setMinLeaderRepeat(n: number): void {
    this.integerC('min-leader-repeat', n);
  }

  override setHyphenationRemainCharCount(n: number): void {
    this.integerC('hyphenation-remain-char-count', n);
  }

  override setHyphenationPushCharCount(n: number): void {
    this.integerC('hyphenation-push-char-count', n);
  }

  override setWidowCount(n: number): void {
    this.integerC('widow-count', n);
  }

  override setOrphanCount(n: number): void {
    this.integerC('orphan-count', n);
  }

  override setExpandTabs(n: number): void {
    this.integerC('expand-tabs', n);
  }

  override setHyphenationLadderCount(n: number): void {
    this.integerC('hyphenation-ladder-count', n);
  }

  override setCountry(code: Letter2): void {
    this.ics_.write(' country=' + quot);
    if (code) {
      this.ics_.write(String.fromCharCode((code >> 8) & 0xff) + String.fromCharCode(code & 0xff));
    } else {
      this.ics_.write(falseString);
    }
    this.ics_.write(quot);
  }

  override setLanguage(code: Letter2): void {
    this.ics_.write(' language=' + quot);
    if (code) {
      this.ics_.write(String.fromCharCode((code >> 8) & 0xff) + String.fromCharCode(code & 0xff));
    } else {
      this.ics_.write(falseString);
    }
    this.ics_.write(quot);
  }

  override setBackgroundTile(pubid: PublicId): void {
    this.publicIdC('background-tile', pubid);
  }

  override setLineBreakingMethod(pubid: PublicId): void {
    this.publicIdC('line-breaking-method', pubid);
  }

  override setLineCompositionMethod(pubid: PublicId): void {
    this.publicIdC('line-composition-method', pubid);
  }

  override setImplicitBidiMethod(pubid: PublicId): void {
    this.publicIdC('implicit-bidi-method', pubid);
  }

  override setGlyphSubstMethod(pubid: PublicId): void {
    this.publicIdC('glyph-subst-method', pubid);
  }

  override setGlyphReorderMethod(pubid: PublicId): void {
    this.publicIdC('glyph-reorder-method', pubid);
  }

  override setHyphenationMethod(pubid: PublicId): void {
    this.publicIdC('hyphenation-method', pubid);
  }

  override setTableAutoWidthMethod(pubid: PublicId): void {
    this.publicIdC('table-auto-width-method', pubid);
  }

  override setFontName(pubid: PublicId): void {
    this.publicIdC('font-name', pubid);
  }

  override setBorderPresent(b: boolean): void {
    this.boolC('border-present', b);
  }

  override setInhibitLineBreaks(b: boolean): void {
    this.boolC('inhibit-line-breaks', b);
  }

  override setHyphenate(b: boolean): void {
    this.boolC('hyphenate', b);
  }

  override setKern(b: boolean): void {
    this.boolC('kern', b);
  }

  override setLigature(b: boolean): void {
    this.boolC('ligature', b);
  }

  override setScoreSpaces(b: boolean): void {
    this.boolC('score-spaces', b);
  }

  override setFloatOutMarginalia(b: boolean): void {
    this.boolC('float-out-marginalia', b);
  }

  override setFloatOutSidelines(b: boolean): void {
    this.boolC('float-out-sidelines', b);
  }

  override setFloatOutLineNumbers(b: boolean): void {
    this.boolC('float-out-line-numbers', b);
  }

  override setCellBackground(b: boolean): void {
    this.boolC('cell-background', b);
  }

  override setSpanWeak(b: boolean): void {
    this.boolC('span-weak', b);
  }

  override setIgnoreRecordEnd(b: boolean): void {
    this.boolC('ignore-record-end', b);
  }

  override setNumberedLines(b: boolean): void {
    this.boolC('numbered-lines', b);
  }

  override setHangingPunct(b: boolean): void {
    this.boolC('hanging-punct', b);
  }

  override setBoxOpenEnd(b: boolean): void {
    this.boolC('box-open-end', b);
  }

  override setTruncateLeader(b: boolean): void {
    this.boolC('truncate-leader', b);
  }

  override setAlignLeader(b: boolean): void {
    this.boolC('align-leader', b);
  }

  override setTablePartOmitMiddleHeader(b: boolean): void {
    this.boolC('table-part-omit-middle-header', b);
  }

  override setTablePartOmitMiddleFooter(b: boolean): void {
    this.boolC('table-part-omit-middle-footer', b);
  }

  override setBorderOmitAtBreak(b: boolean): void {
    this.boolC('border-omit-at-break', b);
  }

  override setPrincipalModeSimultaneous(b: boolean): void {
    this.boolC('principal-mode-simultaneous', b);
  }

  override setMarginaliaKeepWithPrevious(b: boolean): void {
    this.boolC('marginalia-keep-with-previous', b);
  }

  override setGridEquidistantRows(b: boolean): void {
    this.boolC('grid-equidistant-rows', b);
  }

  override setGridEquidistantColumns(b: boolean): void {
    this.boolC('grid-equidistant-columns', b);
  }
}

// Factory function
export function makeSgmlFOTBuilder(outputCallback: (s: string) => void): FOTBuilder {
  return new SgmlFOTBuilder(outputCallback);
}
