// Copyright (c) 1995 James Clark
// See the file COPYING for copying permission.

import { MessageArg, OtherMessageArg } from './MessageArg';
import { StringC } from './StringC';
import { Vector } from './Vector';

// C++ uses RTTI_DEF1(SearchResultMessageArg, OtherMessageArg) for runtime type info
// TypeScript has native instanceof support, so we don't need explicit RTTI

export class SearchResultMessageArg extends OtherMessageArg {
  private filename_: Vector<StringC>;
  private errno_: Vector<number>;

  constructor() {
    super();
    this.filename_ = new Vector<StringC>();
    this.errno_ = new Vector<number>();
  }

  add(str: StringC, n: number): void {
    this.filename_.resize(this.filename_.size() + 1);
    str.swap(this.filename_.back());
    this.errno_.push_back(n);
  }

  copy(): MessageArg {
    const result = new SearchResultMessageArg();
    // Copy all filenames and error numbers
    for (let i = 0; i < this.filename_.size(); i++) {
      const nameCopy = this.filename_.get(i);
      result.filename_.push_back(nameCopy);
      result.errno_.push_back(this.errno_.get(i));
    }
    return result;
  }

  nTried(): number {
    return this.filename_.size();
  }

  filename(i: number): StringC {
    return this.filename_.get(i);
  }

  errnum(i: number): number {
    return this.errno_.get(i);
  }
}
