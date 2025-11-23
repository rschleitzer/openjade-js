// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, Xchar, Index } from './types';
import { Link } from './Link';
import { Ptr } from './Ptr';
import { Location, InputSourceOrigin, NamedCharRef } from './Location';
import { XcharMap } from './XcharMap';
import { Boolean } from './Boolean';
import { MarkupScan } from './MarkupScan';

// Forward declarations
export interface Messenger {
  // Will be defined in Message.ts
}

export interface CharsetInfo {
  // Defined in CharsetInfo.ts
}

export interface InternalInputSource {
  // Will be defined elsewhere
}

export abstract class InputSource extends Link {
  static readonly eE = -1; // end of entity signal

  protected cur_: number; // index into buffer
  protected start_: number; // index into buffer
  protected end_: number; // index into buffer
  protected buffer_: Char[]; // the actual character buffer
  protected startLocation_: Location;
  protected origin_: Ptr<InputSourceOrigin>;
  protected accessError_: Boolean;
  protected scanSuppress_: Boolean;
  protected scanSuppressSingle_: Boolean;
  protected scanSuppressIndex_: Index;
  protected multicode_: Boolean;
  protected markupScanTable_: XcharMap<number>;

  constructor(origin: InputSourceOrigin | null, start: Char[] | null, startIdx: number, endIdx: number) {
    super();
    this.origin_ = new Ptr(origin);
    this.buffer_ = start || [];
    this.start_ = startIdx;
    this.end_ = endIdx;
    this.cur_ = startIdx;
    this.accessError_ = false;
    this.startLocation_ = new Location(origin, 0);
    this.multicode_ = false;
    this.scanSuppress_ = false;
    this.scanSuppressSingle_ = false;
    this.scanSuppressIndex_ = 0;
    this.markupScanTable_ = new XcharMap<number>();
  }

  abstract pushCharRef(ch: Char, ref: NamedCharRef): void;
  abstract rewind(mgr: Messenger): Boolean;
  protected abstract fill(mgr: Messenger): Xchar;

  get(mgr: Messenger): Xchar {
    this.advanceStart(this.cur_);
    return this.cur_ < this.end_ ? this.buffer_[this.cur_++] : this.fill(mgr);
  }

  currentLocation(): Location {
    return this.startLocation_;
  }

  currentTokenStart(): Char[] {
    return this.buffer_;
  }

  currentTokenStartIndex(): number {
    return this.start_;
  }

  currentTokenLength(): number {
    return this.cur_ - this.start_;
  }

  currentTokenEnd(): Char[] {
    return this.buffer_;
  }

  currentTokenEndIndex(): number {
    return this.cur_;
  }

  nextIndex(): Index {
    return this.startLocation_.index() + (this.cur_ - this.start_);
  }

  discardInitial(): void {
    this.advanceStart(this.cur_ - 1);
  }

  startToken(): void {
    this.advanceStart(this.cur_);
  }

  startTokenNoMulticode(): void {
    this.startLocation_.addOffset(this.cur_ - this.start_);
    this.start_ = this.cur_;
  }

  endToken(length: number): void {
    this.cur_ = this.start_ + length;
  }

  tokenChar(mgr: Messenger): Xchar {
    return this.cur_ < this.end_ ? this.buffer_[this.cur_++] : this.fill(mgr);
  }

  tokenCharInBuffer(_mgr: Messenger): Xchar {
    return this.cur_ < this.end_ ? this.buffer_[this.cur_++] : InputSource.eE;
  }

  ungetToken(): void {
    this.cur_ = this.start_;
  }

  setMarkupScanTable(table: XcharMap<number>): void {
    this.markupScanTable_ = table;
    this.multicode_ = true;
  }

  scanSuppress(): Boolean {
    return this.scanSuppress_ && (!this.scanSuppressSingle_ ||
                                   this.startLocation_.index() === this.scanSuppressIndex_);
  }

  extendToBufferEnd(): void {
    this.cur_ = this.end_;
  }

  willNotRewind(): void {
    // Default: no-op
  }

  accessError(): Boolean {
    return this.accessError_;
  }

  setDocCharset(_docCharset: CharsetInfo, _emCharset: CharsetInfo): void {
    // Default: no-op
  }

  willNotSetDocCharset(): void {
    // Default: no-op
  }

  asInternalInputSource(): InternalInputSource | null {
    return null;
  }

  // Protected methods
  protected reset(buffer: Char[], startIdx: number, endIdx: number): void {
    const originCopy = this.origin_.pointer()?.copy();
    if (originCopy) {
      this.origin_ = new Ptr(originCopy);
    }
    this.buffer_ = buffer;
    this.start_ = startIdx;
    this.end_ = endIdx;
    this.cur_ = startIdx;
    this.startLocation_ = new Location(this.origin_.pointer(), 0);
    this.multicode_ = false;
    this.scanSuppress_ = false;
    this.markupScanTable_.clear();
  }

  protected inputSourceOrigin(): InputSourceOrigin | null {
    return this.origin_.pointer();
  }

  protected noteCharRef(replacementIndex: Index, ref: NamedCharRef): void {
    const origin = this.origin_.pointer();
    if (origin) {
      origin.noteCharRef(replacementIndex, ref);
    }
  }

  protected cur(): number {
    return this.cur_;
  }

  protected start(): number {
    return this.start_;
  }

  protected end(): number {
    return this.end_;
  }

  protected startIndex(): Index {
    return this.startLocation_.index();
  }

  protected changeBuffer(newBuffer: Char[], _oldBuffer: Char[]): void {
    // When changing buffer, we need to preserve offsets
    // In the original C++, this adjusts pointers
    // In TypeScript, we just update the buffer reference
    this.buffer_ = newBuffer;
    // The indices remain the same as they're relative to buffer start
  }

  protected advanceEnd(newEndIdx: number): void {
    this.end_ = newEndIdx;
  }

  protected moveLeft(): void {
    this.start_--;
    this.cur_--;
  }

  protected moveStart(newStartIdx: number): void {
    const offset = newStartIdx - this.start_;
    this.cur_ += offset;
    this.end_ += offset;
    this.start_ = newStartIdx;
  }

  protected nextChar(): Char {
    return this.buffer_[this.cur_++];
  }

  protected setAccessError(): void {
    this.accessError_ = true;
  }

  private advanceStart(to: number): void {
    if (this.multicode_) {
      this.advanceStartMulticode(to);
    } else {
      this.startLocation_.addOffset(to - this.start_);
      this.start_ = to;
    }
  }

  private advanceStartMulticode(to: number): void {
    while (this.start_ < to) {
      const scanType = this.markupScanTable_.get(this.buffer_[this.start_]);
      switch (scanType) {
        case MarkupScan.Type.normal:
          break;
        case MarkupScan.Type.in:
          this.scanSuppress_ = false;
          break;
        case MarkupScan.Type.out:
          if (!this.scanSuppress()) {
            this.scanSuppress_ = true;
            this.scanSuppressSingle_ = false;
          }
          break;
        case MarkupScan.Type.suppress:
          // what's the effect of MSSCHAR followed by MSSCHAR
          if (!this.scanSuppress()) {
            this.scanSuppress_ = true;
            this.scanSuppressSingle_ = true;
            this.scanSuppressIndex_ = this.startLocation_.index() + 1;
          }
          break;
      }
      this.start_++;
      this.startLocation_.addOffset(1);
    }
  }
}
