// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { Vector } from './Vector';
import { ISet } from './ISet';
import { WideChar } from './types';
import { wideCharMax } from './constant';

export class RangeMapRange<From extends number, To extends number> {
  fromMin: From;
  fromMax: From;
  toMin: To;

  constructor() {
    this.fromMin = 0 as From;
    this.fromMax = 0 as From;
    this.toMin = 0 as To;
  }
}

export class RangeMap<From extends number, To extends number> {
  private ranges_: Vector<RangeMapRange<From, To>>;

  constructor() {
    this.ranges_ = new Vector<RangeMapRange<From, To>>();
  }

  map(from: From, to: { value: To }, alsoMax: { value: From }): Boolean {
    // FIXME use binary search
    for (let i = 0; i < this.ranges_.size(); i++) {
      const r = this.ranges_.get(i);
      if (r.fromMin <= from && from <= r.fromMax) {
        to.value = (r.toMin + (from - r.fromMin)) as To;
        alsoMax.value = r.fromMax;
        return true;
      }
      if (r.fromMin > from) {
        alsoMax.value = (r.fromMin - 1) as From;
        return false;
      }
    }
    alsoMax.value = -1 as From;
    return false;
  }

  inverseMap(to: To, from: { value: From }, fromSet: ISet<WideChar>, count: { value: WideChar }): number {
    // FIXME use binary search
    let ret = 0;
    count.value = wideCharMax;
    for (let i = 0; i < this.ranges_.size(); i++) {
      const r = this.ranges_.get(i);
      if (r.toMin <= to && to <= r.toMin + (r.fromMax - r.fromMin)) {
        const n = (r.fromMin + (to - r.toMin)) as From;
        const thisCount = (r.fromMax - n + 1) as WideChar;
        if (ret > 1) {
          fromSet.add(n as unknown as WideChar);
          if (thisCount < count.value) {
            count.value = thisCount;
          }
        } else if (ret === 1) {
          fromSet.add(from.value as unknown as WideChar);
          fromSet.add(n as unknown as WideChar);
          ret = 2;
          if (thisCount < count.value) {
            count.value = thisCount;
          }
        } else {
          count.value = thisCount;
          from.value = n;
          ret = 1;
        }
      } else if (ret === 0 && r.toMin > to && ((r.toMin - to) as WideChar) < count.value) {
        count.value = (r.toMin - to) as WideChar;
      }
    }
    return ret;
  }

  addRange(fromMin: From, fromMax: From, toMin: To): void {
    // FIXME use binary search
    let i: number;
    for (i = this.ranges_.size(); i > 0; i--) {
      if (fromMin > this.ranges_.get(i - 1).fromMax) {
        break;
      }
    }
    // fromMin <= ranges[i].fromMax
    let coalesced = false;
    if (i > 0
        && this.ranges_.get(i - 1).fromMax + 1 === fromMin
        && this.ranges_.get(i - 1).toMin + (fromMin - this.ranges_.get(i - 1).fromMin) === toMin) {
      // coalesce with previous
      this.ranges_.get(i - 1).fromMax = fromMax;
      i--;
      coalesced = true;
    } else if (i < this.ranges_.size() && fromMax >= this.ranges_.get(i).fromMin - 1) {
      // overlap
      if (fromMin <= this.ranges_.get(i).fromMin) {
        if ((toMin + (this.ranges_.get(i).fromMin - fromMin)) as To === this.ranges_.get(i).toMin) {
          this.ranges_.get(i).fromMin = fromMin;
          if (fromMax <= this.ranges_.get(i).fromMax) {
            return;
          }
          this.ranges_.get(i).fromMax = fromMax;
          coalesced = true;
        }
      } else {
        // fromMin > ranges_[i].fromMin
        if ((this.ranges_.get(i).toMin + (fromMin - this.ranges_.get(i).fromMin)) as To === toMin) {
          if (fromMax < this.ranges_.get(i).fromMax) {
            return;
          }
          this.ranges_.get(i).fromMax = fromMax;
          coalesced = true;
        }
      }
    }
    if (!coalesced) {
      // insert
      this.ranges_.resize(this.ranges_.size() + 1);
      for (let j = this.ranges_.size() - 1; j > i; j--) {
        this.ranges_.set(j, this.ranges_.get(j - 1));
      }
      const newRange = new RangeMapRange<From, To>();
      newRange.fromMin = fromMin;
      newRange.fromMax = fromMax;
      newRange.toMin = toMin;
      this.ranges_.set(i, newRange);
    }
    // Delete overlapping ranges starting at i + 1.
    let j: number;
    for (j = i + 1; j < this.ranges_.size(); j++) {
      if (fromMax < this.ranges_.get(j).fromMax) {
        if (fromMax >= this.ranges_.get(j).fromMin) {
          this.ranges_.get(j).fromMin = (fromMax + 1) as From;
        }
        break;
      }
    }
    if (j > i + 1) {
      // delete i + 1 ... j - 1
      // j -> i + 1
      // j - 1 -> i + 2
      const count = this.ranges_.size() - j;
      for (let k = 0; k < count; k++) {
        this.ranges_.set(i + 1 + k, this.ranges_.get(j + k));
      }
      this.ranges_.resize(this.ranges_.size() - (j - (i + 1)));
    }
  }

  // For RangeMapIter access
  getRanges(): Vector<RangeMapRange<From, To>> {
    return this.ranges_;
  }
}

export class RangeMapIter<From extends number, To extends number> {
  private count_: number;
  private ptr_: number; // index into ranges
  private ranges_: Vector<RangeMapRange<From, To>>;

  constructor(map: RangeMap<From, To>) {
    this.ranges_ = map.getRanges();
    this.count_ = this.ranges_.size();
    this.ptr_ = 0;
  }

  next(result: { fromMin: From; fromMax: From; toMin: To }): Boolean {
    if (this.count_ === 0) {
      return false;
    } else {
      const r = this.ranges_.get(this.ptr_);
      result.fromMin = r.fromMin;
      result.fromMax = r.fromMax;
      result.toMin = r.toMin;
      this.ptr_++;
      this.count_--;
      return true;
    }
  }
}
