// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, Xchar } from './types';
import { Boolean } from './Boolean';
import { StringC } from './StringC';
import { InputSource } from './InputSource';
import { InputSourceOrigin, NamedCharRef } from './Location';
import { Messenger } from './Message';
import { ASSERT } from './macros';

export class InternalInputSource extends InputSource {
  private buf_: Char[] | null;
  private contents_: StringC | null;

  constructor(str: StringC, origin: InputSourceOrigin) {
    super(origin, str.data(), 0, str.size());
    this.buf_ = null;
    this.contents_ = str;
  }

  fill(messenger: Messenger): Xchar {
    return InputSource.eE;
  }

  pushCharRef(c: Char, ref: NamedCharRef): void {
    ASSERT(this.cur() === this.start());
    this.noteCharRef(this.startIndex() + (this.cur() - this.start()), ref);

    if (this.buf_ === null) {
      const len = this.end() - this.start();
      this.buf_ = new Array(len + 1);
      // Copy current buffer contents starting at position 1
      // The buffer is this.buffer_ from base class, accessed via protected methods
      const buffer = this['buffer_'] as Char[];
      const startIdx = this.start();
      for (let i = 0; i < len; i++) {
        this.buf_[i + 1] = buffer[startIdx + i];
      }
      this.changeBuffer(this.buf_, buffer);
    }

    this.moveLeft();
    this.buf_[this.cur()] = c;
  }

  rewind(messenger: Messenger): Boolean {
    if (this.contents_) {
      this.reset(this.contents_.data(), 0, this.contents_.size());
    }
    if (this.buf_) {
      this.buf_ = null;
    }
    return true;
  }

  contents(): StringC | null {
    return this.contents_;
  }

  asInternalInputSource(): InternalInputSource | null {
    return this;
  }
}
