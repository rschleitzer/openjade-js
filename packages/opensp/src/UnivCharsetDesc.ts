// Copyright (c) 1994, 1997 James Clark
// See the file COPYING for copying permission.

import { WideChar, UnivChar, Char, Unsigned32 } from './types';
import { charMax, univCharMax } from './constant';
import { CharMap } from './CharMap';
import { RangeMap, RangeMapIter } from './RangeMap';
import { Boolean } from './Boolean';
import { ISet } from './ISet';
import { ASSERT } from './macros';

export namespace UnivCharsetDesc {
  export interface Range {
    descMin: WideChar;
    // Note that this is a count, as in the SGML declaration,
    // rather than a maximum.
    count: number;
    univMin: UnivChar;
  }
}

export class UnivCharsetDesc {
  static readonly zero = 48;
  static readonly A = 65;
  static readonly a = 97;
  static readonly tab = 9;
  static readonly rs = 10;
  static readonly re = 13;
  static readonly space = 32;
  static readonly exclamation = 33;
  static readonly lessThan = 60;
  static readonly greaterThan = 62;

  private charMap_: CharMap<Unsigned32>;
  private rangeMap_: RangeMap<WideChar, UnivChar>;

  constructor();
  constructor(ranges: UnivCharsetDesc.Range[], n: number);
  constructor(other: UnivCharsetDesc);
  constructor(rangesOrOther?: UnivCharsetDesc.Range[] | UnivCharsetDesc, n?: number) {
    if (rangesOrOther instanceof UnivCharsetDesc) {
      // Copy constructor
      this.charMap_ = new CharMap<Unsigned32>((1 << 31) >>> 0);
      this.rangeMap_ = new RangeMap<WideChar, UnivChar>();
      // Deep copy the maps
      const otherCharMap = (rangesOrOther as any).charMap_ as CharMap<Unsigned32>;
      const otherRangeMap = (rangesOrOther as any).rangeMap_ as RangeMap<WideChar, UnivChar>;
      // Copy CharMap
      for (let i = 0; i < charMax + 1; i++) {
        this.charMap_.setChar(i, otherCharMap.get(i));
      }
      // Copy RangeMap - will copy on addRange
      const otherRanges = otherRangeMap.getRanges();
      for (let i = 0; i < otherRanges.size(); i++) {
        const r = otherRanges.get(i);
        this.rangeMap_.addRange(r.fromMin, r.fromMax, r.toMin);
      }
    } else {
      this.charMap_ = new CharMap<Unsigned32>((1 << 31) >>> 0);
      this.rangeMap_ = new RangeMap<WideChar, UnivChar>();
      if (rangesOrOther && n !== undefined) {
        this.set(rangesOrOther, n);
      }
    }
  }

  set(ranges: UnivCharsetDesc.Range[], n: number): void {
    for (let i = 0; i < n; i++) {
      const r = ranges[i];
      let max: Char;
      if (r.count > charMax || r.descMin > charMax - r.count) {
        max = charMax;
      } else {
        max = r.descMin + (r.count - 1);
      }
      if (max - r.descMin > univCharMax || r.univMin > univCharMax - (max - r.descMin)) {
        max = r.descMin + (univCharMax - r.univMin);
      }
      this.addRange(r.descMin, max, r.univMin);
    }
  }

  descToUniv(from: WideChar, to: { value: UnivChar }): Boolean;
  descToUniv(from: WideChar, to: { value: UnivChar }, alsoMax: { value: WideChar }): Boolean;
  descToUniv(from: WideChar, to: { value: UnivChar }, alsoMax?: { value: WideChar }): Boolean {
    if (alsoMax !== undefined) {
      if (from > charMax) {
        return this.rangeMap_.map(from, to, alsoMax);
      } else {
        const max = { value: 0 };
        const tem = this.charMap_.getRange(from, max);
        alsoMax.value = max.value;
        if (UnivCharsetDesc.noDesc(tem)) {
          return false;
        } else {
          to.value = UnivCharsetDesc.extractChar(tem, from);
          return true;
        }
      }
    } else {
      if (from > charMax) {
        const tem = { value: 0 };
        return this.rangeMap_.map(from, to, tem);
      } else {
        const tem = this.charMap_.get(from);
        if (UnivCharsetDesc.noDesc(tem)) {
          return false;
        } else {
          to.value = UnivCharsetDesc.extractChar(tem, from);
          return true;
        }
      }
    }
  }

  univToDesc(from: UnivChar, to: { value: WideChar }, toSet: ISet<WideChar>): number;
  univToDesc(from: UnivChar, to: { value: WideChar }, toSet: ISet<WideChar>, count: { value: WideChar }): number;
  univToDesc(from: UnivChar, to: { value: WideChar }, toSet: ISet<WideChar>, count?: { value: WideChar }): number {
    if (count === undefined) {
      const tem = { value: 0 };
      return this.univToDesc(from, to, toSet, tem);
    }

    let ret = this.rangeMap_.inverseMap(from, to, toSet, count);
    let min: Char = 0;
    do {
      const max = { value: 0 };
      const tem = this.charMap_.getRange(min, max);
      if (!UnivCharsetDesc.noDesc(tem)) {
        const toMin = UnivCharsetDesc.extractChar(tem, min);
        if (toMin <= from && from <= toMin + (max.value - min)) {
          const n = min + (from - toMin);
          const thisCount = max.value - n + 1;
          if (ret > 1) {
            toSet.add(n);
            if (thisCount < count.value) {
              count.value = thisCount;
            }
            if (n < to.value) {
              to.value = n;
            }
          } else if (ret === 1) {
            toSet.add(to.value);
            toSet.add(n);
            ret = 2;
            if (thisCount < count.value) {
              count.value = thisCount;
            }
            if (n < to.value) {
              to.value = n;
            }
          } else {
            count.value = thisCount;
            to.value = n;
            ret = 1;
          }
        } else if (ret === 0 && toMin > from && toMin - from < count.value) {
          count.value = toMin - from;
        }
      }
      min = max.value;
    } while (min++ !== charMax);
    return ret;
  }

  addRange(descMin: WideChar, descMax: WideChar, univMin: UnivChar): void {
    if (descMin <= charMax) {
      const max = descMax > charMax ? charMax : descMax;
      this.charMap_.setRange(descMin, max, UnivCharsetDesc.wrapChar(univMin, descMin));
    }
    if (descMax > charMax) {
      if (descMin > charMax) {
        this.rangeMap_.addRange(descMin, descMax, univMin);
      } else {
        this.rangeMap_.addRange(charMax, descMax, univMin + (charMax - descMin));
      }
    }
  }

  addBaseRange(
    baseSet: UnivCharsetDesc,
    descMin: WideChar,
    descMax: WideChar,
    baseMin: WideChar,
    baseMissing: ISet<WideChar>
  ): void {
    const iter = new UnivCharsetDescIter(baseSet);
    iter.skipTo(baseMin);
    const baseMax = baseMin + (descMax - descMin);
    let missingBaseMin = baseMin;
    let usedAll = false;

    const iDescMin = { value: 0 };
    const iDescMax = { value: 0 };
    const iBaseMin = { value: 0 };

    while (iter.next(iDescMin, iDescMax, iBaseMin) && iDescMin.value <= baseMax) {
      if (iDescMax.value >= baseMin) {
        const min = baseMin > iDescMin.value ? baseMin : iDescMin.value;
        if (min > missingBaseMin) {
          baseMissing.addRange(missingBaseMin, min - 1);
        }
        const max = baseMax < iDescMax.value ? baseMax : iDescMax.value;
        missingBaseMin = max + 1;
        if (missingBaseMin === 0) {
          usedAll = true;
        }
        ASSERT(min <= max);
        this.addRange(
          descMin + (min - baseMin),
          descMin + (max - baseMin),
          iBaseMin.value + (min - iDescMin.value)
        );
      }
    }
    if (!usedAll && baseMax >= missingBaseMin) {
      baseMissing.addRange(missingBaseMin, baseMax);
    }
  }

  private static noDesc(n: Unsigned32): Boolean {
    return (n & (1 << 31)) !== 0;
  }

  private static extractChar(n: Unsigned32, ch: Char): UnivChar {
    return ((n + ch) & ((1 << 31) - 1)) >>> 0;
  }

  private static wrapChar(univ: UnivChar, ch: Char): Unsigned32 {
    return ((univ - ch) & ((1 << 31) - 1)) >>> 0;
  }
}

export class UnivCharsetDescIter {
  private charMap_: CharMap<Unsigned32> | null;
  private nextChar_: Char;
  private doneCharMap_: Boolean;
  private rangeMapIter_: RangeMapIter<WideChar, UnivChar>;

  constructor(desc: UnivCharsetDesc) {
    this.charMap_ = (desc as any).charMap_;
    this.doneCharMap_ = false;
    this.nextChar_ = 0;
    this.rangeMapIter_ = new RangeMapIter<WideChar, UnivChar>((desc as any).rangeMap_);
  }

  next(descMin: { value: WideChar }, descMax: { value: WideChar }, univMin: { value: UnivChar }): Boolean {
    while (!this.doneCharMap_) {
      const ch = this.nextChar_;
      const nextCharRef = { value: this.nextChar_ };
      const tem = this.charMap_!.getRange(this.nextChar_, nextCharRef);
      this.nextChar_ = nextCharRef.value;
      descMax.value = this.nextChar_;
      if (!UnivCharsetDesc['noDesc'](tem)) {
        descMin.value = ch;
        descMax.value = this.nextChar_;
        univMin.value = UnivCharsetDesc['extractChar'](tem, ch);
        if (this.nextChar_ === charMax) {
          this.doneCharMap_ = true;
        } else {
          this.nextChar_++;
        }
        return true;
      }
      if (this.nextChar_ === charMax) {
        this.doneCharMap_ = true;
      } else {
        this.nextChar_++;
      }
    }
    const result = { fromMin: 0 as WideChar, fromMax: 0 as WideChar, toMin: 0 as UnivChar };
    const hasNext = this.rangeMapIter_.next(result);
    if (hasNext) {
      descMin.value = result.fromMin;
      descMax.value = result.fromMax;
      univMin.value = result.toMin;
    }
    return hasNext;
  }

  skipTo(ch: WideChar): void {
    if (ch > charMax) {
      this.doneCharMap_ = true;
    } else {
      this.nextChar_ = ch;
    }
  }
}
