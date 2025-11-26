// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, Index } from './types';
import { Boolean } from './Boolean';
import { String as StringOf } from './StringOf';
import { Vector } from './Vector';
import { Location, Origin, MultiReplacementOrigin } from './Location';
import { SubstTable } from './SubstTable';
import { ConstPtr } from './Ptr';

type StringC = StringOf<Char>;

export class TextItem {
  type: TextItem.Type;
  c: Char; // char that was ignored
  loc: Location; // location of this item
  index: number; // index of character in chars_ to which this applies

  constructor() {
    this.type = TextItem.Type.data;
    this.c = 0;
    this.loc = new Location();
    this.index = 0;
  }

  // Copy constructor
  static copy(from: TextItem): TextItem {
    const item = new TextItem();
    item.type = from.type;
    item.c = from.c;
    item.loc = new Location(from.loc);
    item.index = from.index;
    return item;
  }

  assign(from: TextItem): TextItem {
    if (this !== from) {
      this.type = from.type;
      this.c = from.c;
      this.loc = new Location(from.loc);
      this.index = from.index;
    }
    return this;
  }
}

export namespace TextItem {
  export enum Type {
    data,
    cdata,
    sdata,
    nonSgml,
    entityStart,
    entityEnd,
    startDelim,
    endDelim,
    endDelimA,
    ignore
  }
}

// This is used to represent literals and attribute values.
export class Text {
  private chars_: StringC;
  private items_: Vector<TextItem>;

  constructor() {
    this.chars_ = new StringOf<Char>();
    this.items_ = new Vector<TextItem>();
  }

  // Create a deep copy of this Text
  copy(): Text {
    const result = new Text();
    // Copy the characters
    const data = this.chars_.data();
    if (data) {
      result.chars_.append(data, this.chars_.size());
    }
    // Copy the items using TextItem.copy()
    result.items_.resize(this.items_.size());
    for (let i = 0; i < this.items_.size(); i++) {
      result.items_.set(i, TextItem.copy(this.items_.get(i)));
    }
    return result;
  }

  clear(): void {
    this.chars_.resize(0);
    this.items_.clear();
  }

  swap(to: Text): void {
    this.items_.swap(to.items_);
    this.chars_.swap(to.chars_);
  }

  addChar(c: Char, loc: Location): void {
    if (this.items_.size() === 0
        || this.items_.back().type !== TextItem.Type.data
        || loc.origin().pointer() !== this.items_.back().loc.origin().pointer()
        || loc.index() !== (this.items_.back().loc.index()
                            + (this.chars_.size() - this.items_.back().index))) {
      const item = new TextItem();
      item.loc = new Location(loc);
      item.type = TextItem.Type.data;
      item.index = this.chars_.size();
      this.items_.push_back(item);
    }
    this.chars_.appendChar(c);
  }

  addChars(p: Char[] | StringC, length: number | Location, loc?: Location): void {
    if (p instanceof StringOf) {
      // addChars(const StringC &s, const Location &loc)
      const s = p as StringC;
      const location = length as Location;
      const data = s.data();
      this.addChars(data ? data : [], s.size(), location);
    } else {
      // addChars(const Char *p, size_t length, const Location &loc)
      const arr = p as Char[];
      const len = length as number;
      const location = loc!;
      if (this.items_.size() === 0
          || this.items_.back().type !== TextItem.Type.data
          || location.origin().pointer() !== this.items_.back().loc.origin().pointer()
          || location.index() !== (this.items_.back().loc.index()
                                    + (this.chars_.size() - this.items_.back().index))) {
        const item = new TextItem();
        item.loc = new Location(location);
        item.type = TextItem.Type.data;
        item.index = this.chars_.size();
        this.items_.push_back(item);
      }
      this.chars_.append(arr, len);
    }
  }

  insertChars(s: StringC, loc: Location): void {
    this.chars_.insert(0, s);
    // Create new item at position 0, shift existing items
    const newItem = new TextItem();
    newItem.loc = new Location(loc);
    newItem.type = TextItem.Type.data;
    newItem.index = 0;
    // Shift all existing items to the right and update their indices
    const oldSize = this.items_.size();
    this.items_.push_back(newItem); // Just to allocate space
    for (let i = oldSize; i > 0; i--) {
      const prevItem = this.items_.get(i - 1);
      prevItem.index += s.size();
      this.items_.set(i, prevItem);
    }
    this.items_.set(0, newItem);
  }

  ignoreChar(c: Char, loc: Location): void {
    const item = new TextItem();
    item.loc = new Location(loc);
    item.type = TextItem.Type.ignore;
    item.c = c;
    item.index = this.chars_.size();
    this.items_.push_back(item);
  }

  ignoreLastChar(): void {
    const lastIndex = this.chars_.size() - 1;
    let i: number;
    for (i = this.items_.size() - 1; this.items_.get(i).index > lastIndex; i--)
      ;
    // lastIndex >= items_[i].index
    if (this.items_.get(i).index !== lastIndex) {
      // Need to insert a new item at position i+1
      const newItem = new TextItem();
      newItem.index = lastIndex;
      newItem.loc = new Location(this.items_.get(i).loc);
      newItem.loc.addOffset(lastIndex - this.items_.get(i).index);
      // Shift items to make room and insert new item
      const oldSize = this.items_.size();
      this.items_.push_back(newItem); // Allocate space
      i++;
      for (let j = oldSize; j > i; j--) {
        this.items_.set(j, this.items_.get(j - 1));
      }
      this.items_.set(i, newItem);
    }

    this.items_.get(i).c = this.chars_.get(this.chars_.size() - 1);
    this.items_.get(i).type = TextItem.Type.ignore;
    for (let j = i + 1; j < this.items_.size(); j++) {
      this.items_.get(j).index = lastIndex;
    }
    this.chars_.resize(this.chars_.size() - 1);
  }

  addNonSgmlChar(c: Char, loc: Location): void {
    this.addSimple(TextItem.Type.nonSgml, loc);
    this.chars_.appendChar(c);
  }

  addEntityStart(loc: Location): void {
    this.addSimple(TextItem.Type.entityStart, loc);
  }

  addEntityEnd(loc: Location): void {
    this.addSimple(TextItem.Type.entityEnd, loc);
  }

  addCdata(str: StringC, origin: ConstPtr<Origin>): void {
    this.addSimple(TextItem.Type.cdata, new Location(origin, 0));
    const data = str.data();
    if (data) {
      this.chars_.append(data, str.size());
    }
  }

  addSdata(str: StringC, origin: ConstPtr<Origin>): void {
    this.addSimple(TextItem.Type.sdata, new Location(origin, 0));
    const data = str.data();
    if (data) {
      this.chars_.append(data, str.size());
    }
  }

  addStartDelim(loc: Location): void {
    this.addSimple(TextItem.Type.startDelim, loc);
  }

  addEndDelim(loc: Location, lita: Boolean): void {
    this.addSimple(lita ? TextItem.Type.endDelimA : TextItem.Type.endDelim, loc);
  }

  subst(table: SubstTable, space: Char): void {
    for (let i = 0; i < this.items_.size(); i++) {
      if (this.items_.get(i).type === TextItem.Type.data) {
        const lim = (i + 1 < this.items_.size()
                      ? this.items_.get(i + 1).index
                      : this.chars_.size());
        let j: number;
        for (j = this.items_.get(i).index; j < lim; j++) {
          const c = this.chars_.get(j);
          if (c !== space && c !== table.get(c)) {
            break;
          }
        }
        if (j < lim) {
          const start = this.items_.get(i).index;
          const data = this.chars_.data();
          if (data) {
            const origChars = new StringOf<Char>();
            origChars.assign(data.slice(start, lim), lim - start);
            for (; j < lim; j++) {
              if (this.chars_.get(j) !== space) {
                this.chars_.set(j, table.get(this.chars_.get(j)));
              }
            }
            this.items_.get(i).loc = new Location(
              new MultiReplacementOrigin(this.items_.get(i).loc, origChars),
              0
            );
          }
        }
      }
    }
  }

  addCharsTokenize(str: Char[] | StringC, n: number | Location, loc: Location | Char, space?: Char): void {
    if (str instanceof StringOf) {
      // addCharsTokenize(const StringC &str, const Location &loc, Char space)
      const s = str as StringC;
      const location = n as Location;
      const sp = loc as Char;
      const data = s.data();
      this.addCharsTokenize(data ? data : [], s.size(), location, sp);
    } else {
      // addCharsTokenize(const Char *str, size_t n, const Location &loc, Char space)
      const arr = str as Char[];
      const len = n as number;
      const location = loc as Location;
      const sp = space!;
      const loci = new Location(location);
      // FIXME speed this up
      for (let i = 0; i < len; i++, loci.addOffset(1)) {
        if (arr[i] === sp && (this.size() === 0 || this.lastChar() === sp)) {
          this.ignoreChar(arr[i], loci);
        } else {
          this.addChar(arr[i], loci);
        }
      }
    }
  }

  tokenize(space: Char, text: Text): void {
    const iter = new TextIter(this);
    let type: TextItem.Type;
    let p: Char[] | null;
    let n: number;
    let loc: Location | null;
    const result = { type: TextItem.Type.data, p: null as Char[] | null, n: 0, loc: null as Location | null };
    while (iter.next(result)) {
      type = result.type;
      p = result.p;
      n = result.n;
      loc = result.loc;
      if (!loc || !p) continue;

      switch (type) {
        case TextItem.Type.data:
          text.addCharsTokenize(p, n, loc, space);
          break;
        case TextItem.Type.sdata:
        case TextItem.Type.cdata:
          {
            text.addEntityStart(loc);
            text.addCharsTokenize(p, n, loc, space);
            const tem = new Location(loc);
            tem.addOffset(n);
            text.addEntityEnd(tem);
          }
          break;
        case TextItem.Type.ignore:
          if (p.length > 0) {
            text.ignoreChar(p[0], loc);
          }
          break;
        default:
          text.addSimple(type, loc);
          break;
      }
    }
    if (text.size() > 0 && text.lastChar() === space) {
      text.ignoreLastChar();
    }
  }

  charLocation(i: number): Location;
  charLocation(i: number, origin: { value: Origin | null }, index: { value: Index }): Boolean;
  charLocation(i: number, originP: { value: ConstPtr<Origin> | null }, index: { value: Index }): Boolean;
  charLocation(i: number, arg1?: { value: Origin | null | ConstPtr<Origin> }, arg2?: { value: Index }): Location | Boolean {
    if (arg1 === undefined) {
      // Location charLocation(size_t i) const
      const originP = { value: null as ConstPtr<Origin> | null };
      const index = { value: 0 as Index };
      if (this.charLocationImpl(i, originP, index)) {
        return new Location(originP.value!, index.value);
      } else {
        return new Location();
      }
    } else if (arg1.value instanceof ConstPtr || arg1.value === null) {
      // Boolean charLocation(size_t i, const ConstPtr<Origin> *&originP, Index &index) const
      return this.charLocationImpl(i, arg1 as { value: ConstPtr<Origin> | null }, arg2!);
    } else {
      // Boolean charLocation(size_t i, const Origin *&origin, Index &index) const
      const originP = { value: null as ConstPtr<Origin> | null };
      if (this.charLocationImpl(i, originP, arg2!)) {
        arg1.value = originP.value!.pointer();
        return true;
      } else {
        return false;
      }
    }
  }

  private charLocationImpl(ind: number, origin: { value: ConstPtr<Origin> | null }, index: { value: Index }): Boolean {
    // Find the last item whose index <= ind.
    // Binary search
    let i = 1;
    let lim = this.items_.size();
    while (i < lim) {
      const mid = i + Math.floor((lim - i) / 2);
      if (this.items_.get(mid).index > ind) {
        lim = mid;
      } else {
        i = mid + 1;
      }
    }
    i--;
    // If items_.size() == 0, then i == lim.
    if (i < lim) {
      origin.value = this.items_.get(i).loc.origin();
      index.value = this.items_.get(i).loc.index() + (ind - this.items_.get(i).index);
    }
    return true;
  }

  size(): number {
    return this.chars_.size();
  }

  lastChar(): Char {
    return this.chars_.get(this.chars_.size() - 1);
  }

  string(): StringC {
    return this.chars_;
  }

  normalizedLength(normsep: number): number {
    let n = this.size();
    n += normsep;
    for (let i = 0; i < this.items_.size(); i++) {
      switch (this.items_.get(i).type) {
        case TextItem.Type.sdata:
        case TextItem.Type.cdata:
          n += normsep;
          break;
        default:
          break;
      }
    }
    return n;
  }

  fixedEqual(text: Text): Boolean {
    if (!this.string().equals(text.string())) {
      return false;
    }
    let j = 0;
    for (let i = 0; i < this.items_.size(); i++) {
      switch (this.items_.get(i).type) {
        case TextItem.Type.cdata:
        case TextItem.Type.sdata:
          for (;;) {
            if (j >= text.items_.size()) {
              return false;
            }
            if (text.items_.get(j).type === TextItem.Type.nonSgml) {
              return false;
            }
            if (text.items_.get(j).type === TextItem.Type.cdata
                || text.items_.get(j).type === TextItem.Type.sdata) {
              break;
            }
            j++;
          }
          const thisOrigin = this.items_.get(i).loc.origin().pointer();
          const textOrigin = text.items_.get(j).loc.origin().pointer();
          if (text.items_.get(j).index !== this.items_.get(i).index
              || (textOrigin && thisOrigin && textOrigin.entityDecl() !== thisOrigin.entityDecl())) {
            return false;
          }
          break;
        case TextItem.Type.nonSgml:
          for (;;) {
            if (j >= text.items_.size()) {
              return false;
            }
            if (text.items_.get(j).type === TextItem.Type.cdata
                || text.items_.get(j).type === TextItem.Type.sdata) {
              return false;
            }
            if (text.items_.get(j).type === TextItem.Type.nonSgml) {
              break;
            }
            j++;
          }
          if (text.items_.get(j).index !== this.items_.get(i).index) {
            return false;
          }
          break;
        default:
          break;
      }
    }
    for (; j < text.items_.size(); j++) {
      switch (text.items_.get(j).type) {
        case TextItem.Type.cdata:
        case TextItem.Type.sdata:
        case TextItem.Type.nonSgml:
          return false;
        default:
          break;
      }
    }
    return true;
  }

  // Location of first char of start delimiter.
  startDelimLocation(loc: { value: Location }): Boolean {
    if (this.items_.size() === 0 || this.items_.get(0).type !== TextItem.Type.startDelim) {
      return false;
    }
    loc.value = this.items_.get(0).loc;
    return true;
  }

  // Location of first char of end delimiter
  endDelimLocation(loc: { value: Location }): Boolean {
    if (this.items_.size() === 0) {
      return false;
    }
    switch (this.items_.back().type) {
      case TextItem.Type.endDelim:
      case TextItem.Type.endDelimA:
        break;
      default:
        return false;
    }
    loc.value = this.items_.back().loc;
    return true;
  }

  // Is delimiter a lit or lita?
  delimType(lita: { value: Boolean }): Boolean {
    if (this.items_.size() === 0) {
      return false;
    }
    switch (this.items_.back().type) {
      case TextItem.Type.endDelim:
        lita.value = false;
        return true;
      case TextItem.Type.endDelimA:
        lita.value = true;
        return true;
      default:
        break;
    }
    return false;
  }

  private addSimple(type: TextItem.Type, loc: Location): void {
    const item = new TextItem();
    item.loc = new Location(loc);
    item.type = type;
    item.index = this.chars_.size();
    this.items_.push_back(item);
  }

  // Friend class access for TextIter
  getItems(): Vector<TextItem> {
    return this.items_;
  }
}

export class TextIter {
  private ptr_: number; // index into items array
  private text_: Text;

  constructor(text: Text) {
    this.text_ = text;
    this.ptr_ = 0;
  }

  rewind(): void {
    this.ptr_ = 0;
  }

  next(result: { type: TextItem.Type; p: Char[] | null; n: number; loc: Location | null }): Boolean {
    const items = this.text_.getItems();
    const end = items.size();
    if (this.ptr_ >= end) {
      return false;
    }
    const item = items.get(this.ptr_);
    result.type = item.type;
    result.loc = item.loc;
    if (item.type === TextItem.Type.ignore) {
      result.p = [item.c];
      result.n = 1;
    } else {
      const chars = this.text_.string();
      const charsIndex = item.index;
      const data = chars.data();
      if (data) {
        result.p = data.slice(charsIndex);
      } else {
        result.p = [];
      }
      if (this.ptr_ + 1 !== end) {
        result.n = items.get(this.ptr_ + 1).index - charsIndex;
      } else {
        result.n = chars.size() - charsIndex;
      }
    }
    this.ptr_++;
    return true;
  }

  // Alternative interface to next()
  valid(): Boolean {
    return this.ptr_ !== this.text_.getItems().size();
  }

  advance(): void {
    this.ptr_++;
  }

  type(): TextItem.Type {
    return this.text_.getItems().get(this.ptr_).type;
  }

  location(): Location {
    return this.text_.getItems().get(this.ptr_).loc;
  }

  chars(length: { value: number }): Char[] | null {
    const items = this.text_.getItems();
    const ptr = items.get(this.ptr_);
    if (ptr.type === TextItem.Type.ignore) {
      length.value = 1;
      return [ptr.c];
    } else {
      const chars = this.text_.string();
      const charsIndex = ptr.index;
      const end = items.size();
      if (this.ptr_ + 1 !== end) {
        length.value = items.get(this.ptr_ + 1).index - charsIndex;
      } else {
        length.value = chars.size() - charsIndex;
      }
      const data = chars.data();
      return data ? data.slice(charsIndex) : null;
    }
  }
}
