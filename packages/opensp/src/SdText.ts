// Copyright (c) 1995 James Clark
// See the file COPYING for copying permission.

import { SyntaxChar } from './types';
import { String as StringOf } from './StringOf';
import { Vector } from './Vector';
import { Location } from './Location';
import { Boolean } from './Boolean';

export class SdTextItem {
  loc: Location;
  index: number;

  constructor();
  constructor(other: SdTextItem);
  constructor(other?: SdTextItem) {
    if (other) {
      this.loc = new Location(other.loc);
      this.index = other.index;
    } else {
      this.loc = new Location();
      this.index = 0;
    }
  }

  assign(other: SdTextItem): void {
    this.loc = other.loc;
    this.index = other.index;
  }
}

export class SdText {
  private lita_: Boolean;
  private chars_: StringOf<SyntaxChar>;
  private items_: Vector<SdTextItem>;

  constructor();
  constructor(loc: Location, lita: Boolean);
  constructor(loc?: Location, lita?: Boolean) {
    this.lita_ = lita ?? false;
    this.chars_ = new StringOf<SyntaxChar>();
    this.items_ = new Vector<SdTextItem>();

    if (loc !== undefined) {
      this.items_.resize(this.items_.size() + 1);
      const back = this.items_.get(this.items_.size() - 1);
      back.loc = loc;
      back.index = 0;
    }
  }

  addChar(c: SyntaxChar, loc: Location): void {
    if (this.items_.size() === 0 ||
        loc.origin().pointer() !== this.items_.get(this.items_.size() - 1).loc.origin().pointer() ||
        loc.index() !== (this.items_.get(this.items_.size() - 1).loc.index() +
                         (this.chars_.size() - this.items_.get(this.items_.size() - 1).index))) {
      this.items_.resize(this.items_.size() + 1);
      const back = this.items_.get(this.items_.size() - 1);
      back.loc = loc;
      back.index = this.chars_.size();
    }
    this.chars_.append([c], 1);
  }

  string(): StringOf<SyntaxChar> {
    return this.chars_;
  }

  lita(): Boolean {
    return this.lita_;
  }

  endDelimLocation(): Location {
    const loc = new Location(this.items_.get(this.items_.size() - 1).loc);
    loc.addOffset(this.chars_.size() - this.items_.get(this.items_.size() - 1).index);
    return loc;
  }

  swap(to: SdText): void {
    this.items_.swap(to.items_);
    this.chars_.swap(to.chars_);
    const tem = to.lita_;
    to.lita_ = this.lita_;
    this.lita_ = tem;
  }

  // For SdTextIter access
  getItems(): Vector<SdTextItem> {
    return this.items_;
  }

  getChars(): StringOf<SyntaxChar> {
    return this.chars_;
  }
}

export class SdTextIter {
  private ptr_: SdText;
  private itemIndex_: number;

  constructor(text: SdText) {
    this.ptr_ = text;
    this.itemIndex_ = 0;
  }

  next(result: { ptr: SyntaxChar[] | null; length: number; loc: Location }): Boolean {
    const items = this.ptr_.getItems();
    if (this.itemIndex_ >= items.size()) {
      return false;
    }

    result.loc = items.get(this.itemIndex_).loc;
    const chars = this.ptr_.getChars();
    const charsIndex = items.get(this.itemIndex_).index;
    const data = chars.data();
    result.ptr = data;

    if (this.itemIndex_ + 1 < items.size()) {
      result.length = items.get(this.itemIndex_ + 1).index - charsIndex;
    } else {
      result.length = chars.size() - charsIndex;
    }

    this.itemIndex_++;
    return true;
  }
}
