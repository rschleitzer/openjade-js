// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { Vector } from './Vector';

export class ISetRange<T> {
  min: T;
  max: T;

  constructor() {
    this.min = 0 as T;
    this.max = 0 as T;
  }
}

export class ISet<T extends number> {
  private r_: Vector<ISetRange<T>>;

  constructor();
  constructor(v: T[], n: number);
  constructor(v?: T[], n?: number) {
    this.r_ = new Vector<ISetRange<T>>();
    if (v && n !== undefined) {
      for (let i = 0; i < n; i++) {
        this.add(v[i]);
      }
    }
  }

  contains(x: T): Boolean {
    for (let i = 0; i < this.r_.size(); i++) {
      if (this.r_.get(i).max >= x) {
        return this.r_.get(i).min <= x ? true : false;
      }
    }
    return false;
  }

  add(x: T): void {
    this.addRange(x, x);
  }

  addRange(min: T, max: T): void {
    let i: number;
    if (min === 0) {
      i = 0;
    } else {
      for (i = this.r_.size(); i > 0 && (min as number) - 1 <= (this.r_.get(i - 1).max as number); i--)
        ;
    }
    // r_[i - 1].max < min - 1 <= r_[i].max
    if (i < this.r_.size() && ((this.r_.get(i).min as number) === 0 || (max as number) >= (this.r_.get(i).min as number) - 1)) {
      // we can coalesce
      if ((min as number) < (this.r_.get(i).min as number)) {
        this.r_.get(i).min = min;
      }
      if ((max as number) > (this.r_.get(i).max as number)) {
        this.r_.get(i).max = max;
        let j: number;
        for (j = i + 1; j < this.r_.size() && (this.r_.get(i).max as number) >= (this.r_.get(j).min as number) - 1; j++) {
          this.r_.get(i).max = this.r_.get(j).max;
        }
        // get rid of i + 1 ... j - 1
        if (j > i + 1) {
          for (let k = j; k < this.r_.size(); k++) {
            this.r_.set(k - (j - i - 1), this.r_.get(k));
          }
          this.r_.resize(this.r_.size() - (j - i - 1));
        }
      }
    } else {
      // r_[i - 1].max < min - 1
      // max + 1 < r_[i].min
      this.r_.resize(this.r_.size() + 1);
      for (let j = this.r_.size() - 1; j > i; j--) {
        this.r_.set(j, this.r_.get(j - 1));
      }
      const newRange = new ISetRange<T>();
      newRange.max = max;
      newRange.min = min;
      this.r_.set(i, newRange);
    }
  }

  remove(c: T): void {
    for (let i = 0; i < this.r_.size(); i++) {
      if ((this.r_.get(i).max as number) >= (c as number)) {
        if ((this.r_.get(i).min as number) <= (c as number)) {
          if (this.r_.get(i).min === this.r_.get(i).max) {
            while (++i < this.r_.size()) {
              this.r_.set(i - 1, this.r_.get(i));
            }
            this.r_.resize(this.r_.size() - 1);
          } else if (c === this.r_.get(i).min) {
            this.r_.get(i).min = ((c as number) + 1) as T;
          } else if (c === this.r_.get(i).max) {
            this.r_.get(i).max = ((c as number) - 1) as T;
          } else {
            this.r_.resize(this.r_.size() + 1);
            // split the range
            // subtracting 2 is safe since we know that the length is >= 2
            for (let j = this.r_.size() - 2; j > i; j--) {
              this.r_.set(j + 1, this.r_.get(j));
            }
            const newRange = new ISetRange<T>();
            newRange.max = this.r_.get(i).max;
            newRange.min = ((c as number) + 1) as T;
            this.r_.set(i + 1, newRange);
            this.r_.get(i).max = ((c as number) - 1) as T;
          }
        }
        break;
      }
    }
  }

  check(): void {
    for (let i = 0; i < this.r_.size(); i++) {
      if ((this.r_.get(i).min as number) > (this.r_.get(i).max as number)) {
        throw new Error('ISet check failed: min > max');
      }
      // adjacent ranges must be coalesced
      if (i > 0 && (this.r_.get(i).min as number) - 1 <= (this.r_.get(i - 1).max as number)) {
        throw new Error('ISet check failed: ranges not coalesced');
      }
    }
  }

  clear(): void {
    this.r_.resize(0);
  }

  isSingleton(): boolean {
    return this.r_.size() === 1 && this.r_.get(0).min === this.r_.get(0).max;
  }

  isEmpty(): boolean {
    return this.r_.size() === 0;
  }

  swap(x: ISet<T>): void {
    this.r_.swap(x.r_);
  }

  // For ISetIter access
  getRanges(): Vector<ISetRange<T>> {
    return this.r_;
  }
}

export class ISetIter<T extends number> {
  private count_: number;
  private ptr_: number; // index into ranges vector
  private ranges_: Vector<ISetRange<T>>;

  constructor(set: ISet<T>) {
    this.ranges_ = set.getRanges();
    this.count_ = this.ranges_.size();
    this.ptr_ = 0;
  }

  next(result: { fromMin: T; fromMax: T }): Boolean {
    if (this.count_ === 0) {
      return false;
    } else {
      result.fromMin = this.ranges_.get(this.ptr_).min;
      result.fromMax = this.ranges_.get(this.ptr_).max;
      this.ptr_++;
      this.count_--;
      return true;
    }
  }
}
