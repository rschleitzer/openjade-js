// Copyright (c) 1994 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Char } from './types';
import { String as StringOf } from './StringOf';
import { Vector } from './Vector';

type StringC = StringOf<Char>;

export class SubstTable {
  private lo_: number[];
  private map_: Vector<SubstTable.Pair>;
  private isSorted_: boolean;

  constructor() {
    this.lo_ = new Array(256);
    for (let i = 0; i < 256; i++) {
      this.lo_[i] = i;
    }
    this.map_ = new Vector<SubstTable.Pair>();
    this.isSorted_ = true;
  }

  addSubst(from: Char, to: Char): void {
    if (from < 256) {
      this.lo_[from] = to;
    } else {
      for (let i = 0; i < this.map_.size(); i++) {
        if (this.map_.get(i).from === from) {
          this.map_.get(i).to = to;
          return;
        }
      }
      if (from !== to) {
        this.isSorted_ = this.isSorted_ && (this.map_.size() === 0 || this.map_.back().from < from);
        this.map_.push_back(new SubstTable.Pair(from, to));
      }
    }
  }

  subst(c: Char): Char;
  subst(str: StringC): void;
  subst(arg: Char | StringC): Char | void {
    if (typeof arg === 'number') {
      // Char overload
      return this.get(arg);
    } else {
      // StringC overload
      for (let i = 0; i < arg.size(); i++) {
        arg.set(i, this.get(arg.get(i)));
      }
    }
  }

  get(from: Char): Char {
    if (from < 256) {
      return this.lo_[from];
    } else {
      return this.at(from);
    }
  }

  at(t: Char): Char {
    if (!this.isSorted_) {
      this.sort();
      this.isSorted_ = true;
    }
    let min = 0;
    let max = this.map_.size() - 1;
    if (this.map_.size() === 0 || t < this.map_.get(min).from || t > this.map_.get(max).from) {
      return t;
    }
    if (t === this.map_.get(min).from) {
      return this.map_.get(min).to;
    }
    if (t === this.map_.get(max).from) {
      return this.map_.get(max).to;
    }
    for (;;) {
      const mid = Math.floor((min + max) / 2);
      if (mid === min || mid === max) {
        return t;
      }
      if (t === this.map_.get(mid).from) {
        return this.map_.get(mid).to;
      }
      if (t < this.map_.get(mid).from) {
        max = mid;
      } else {
        min = mid;
      }
    }
  }

  sort(): void {
    // C++: qsort((void *)&map_[0], map_.size(), sizeof(map_[0]), comparePairs);
    // TS: Use native Array.sort() on underlying Vector data
    const arr = this.map_.data();
    if (!arr) return;
    arr.sort((p1, p2) => p1.from - p2.from);
  }

  inverse(c: Char): StringC {
    const res = new StringOf<Char>();
    let cSeen = (c < 256);
    for (let i = 0; i < 256; i++) {
      if (this.lo_[i] === c) {
        res.appendChar(i);
      }
    }
    for (let i = 0; i < this.map_.size(); i++) {
      cSeen = cSeen || (this.map_.get(i).from === c);
      if (this.map_.get(i).to === c) {
        res.appendChar(this.map_.get(i).from);
      }
    }
    if (!cSeen) {
      res.appendChar(c);
    }
    return res;
  }

  inverseTable(inverse: SubstTable): void {
    for (let i = 0; i < 256; i++) {
      inverse.lo_[i] = i;
    }
    inverse.map_.resize(0);
    inverse.isSorted_ = true;
    for (let i = 0; i < 256; i++) {
      inverse.addSubst(this.lo_[i], i);
    }
    for (let i = 0; i < this.map_.size(); i++) {
      inverse.addSubst(this.map_.get(i).to, this.map_.get(i).from);
    }
  }
}

export namespace SubstTable {
  export class Pair {
    from: Char;
    to: Char;

    constructor(f?: Char, t?: Char) {
      this.from = f ?? 0;
      this.to = t ?? 0;
    }
  }
}
