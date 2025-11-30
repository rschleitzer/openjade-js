// Copyright (c) 1994, 1997 James Clark
// See the file COPYING for copying permission.

import { UnivCharsetDesc, UnivCharsetDescIter } from './UnivCharsetDesc';
import { Boolean } from './Boolean';
import { Char, WideChar, UnivChar, Unsigned32 } from './types';
import { StringC } from './StringC';
import { ISet } from './ISet';
import { CharMap } from './CharMap';
import { charMax } from './constant';
import { String as StringOf } from './StringOf';

export class CharsetInfo {
  private desc_: UnivCharsetDesc;
  private inverse_: CharMap<Unsigned32>;
  private execToDesc_: Char[];

  constructor();
  constructor(desc: UnivCharsetDesc);
  constructor(desc?: UnivCharsetDesc) {
    this.desc_ = desc ? new UnivCharsetDesc(desc) : new UnivCharsetDesc();
    this.inverse_ = new CharMap<Unsigned32>();
    this.execToDesc_ = new Array(256);

    if (desc) {
      this.init();
    } else {
      this.inverse_.setAll(((-1) >>> 0) as Unsigned32);
    }
  }

  set(desc: UnivCharsetDesc): void {
    this.desc_ = new UnivCharsetDesc(desc);
    this.init();
  }

  execToDesc(ch: string): Char;
  execToDesc(s: string): StringC;
  execToDesc(chOrS: string): Char | StringC {
    if (chOrS.length === 1) {
      return this.execToDesc_[chOrS.charCodeAt(0)];
    } else {
      const result = new StringOf<Char>();
      for (let i = 0; i < chOrS.length; i++) {
        result.append([this.execToDesc_[chOrS.charCodeAt(i)]], 1);
      }
      return result;
    }
  }

  // Get string descriptor - always returns StringC even for single char
  execToDescString(s: string): StringC {
    const result = new StringOf<Char>();
    for (let i = 0; i < s.length; i++) {
      result.append([this.execToDesc_[s.charCodeAt(i)]], 1);
    }
    return result;
  }

  descToUniv(from: WideChar, to: { value: UnivChar }): Boolean;
  descToUniv(from: WideChar, to: { value: UnivChar }, alsoMax: { value: WideChar }): Boolean;
  descToUniv(from: WideChar, to: { value: UnivChar }, alsoMax?: { value: WideChar }): Boolean {
    if (alsoMax !== undefined) {
      return this.desc_.descToUniv(from, to, alsoMax);
    } else {
      return this.desc_.descToUniv(from, to);
    }
  }

  univToDesc(from: UnivChar, to: { value: WideChar }, toSet: ISet<WideChar>): number;
  univToDesc(from: UnivChar, to: { value: WideChar }, toSet: ISet<WideChar>, count: { value: WideChar }): number;
  univToDesc(from: UnivChar, to: { value: WideChar }, toSet: ISet<WideChar>, count?: { value: WideChar }): number {
    if (count !== undefined) {
      if (from <= charMax) {
        const fromMax = { value: 0 as Char };
        const n = this.inverse_.getRange(from as Char, fromMax);
        if (n === ((-1) >>> 0)) {
          count.value = (fromMax.value - from) + 1;
          to.value = 0;
          return 0;
        }
        if (n !== ((-2) >>> 0)) {
          count.value = (fromMax.value - from) + 1;
          to.value = ((n + from) & ((1 << 31) - 1)) >>> 0;
          return 1;
        }
      }
      return this.desc_.univToDesc(from, to, toSet, count);
    } else {
      if (from <= charMax) {
        const n = this.inverse_.get(from as Char);
        if (n === ((-1) >>> 0)) {
          return 0;
        }
        if (n !== ((-2) >>> 0)) {
          to.value = ((n + from) & ((1 << 31) - 1)) >>> 0;
          return 1;
        }
      }
      const dummy = { value: 0 };
      return this.desc_.univToDesc(from, to, toSet, dummy);
    }
  }

  getDescSet(set: ISet<Char>): void {
    const iter = new UnivCharsetDescIter(this.desc_);
    const descMin = { value: 0 };
    const descMax = { value: 0 };
    const univMin = { value: 0 };
    while (iter.next(descMin, descMax, univMin)) {
      if (descMin.value > charMax) {
        break;
      }
      let max = descMax.value;
      if (max > charMax) {
        max = charMax;
      }
      set.addRange(descMin.value as Char, max as Char);
    }
  }

  digitWeight(c: Char): number {
    for (let i = 0; i < 10; i++) {
      if (c === this.execToDesc_['0'.charCodeAt(0) + i]) {
        return i;
      }
    }
    return -1;
  }

  hexDigitWeight(c: Char): number {
    for (let i = 0; i < 10; i++) {
      if (c === this.execToDesc_['0'.charCodeAt(0) + i]) {
        return i;
      }
    }
    for (let i = 0; i < 6; i++) {
      if (c === this.execToDesc_['a'.charCodeAt(0) + i] || c === this.execToDesc_['A'.charCodeAt(0) + i]) {
        return i + 10;
      }
    }
    return -1;
  }

  desc(): UnivCharsetDesc {
    return this.desc_;
  }

  private init(): void {
    this.inverse_.setAll(((-1) >>> 0) as Unsigned32);

    const iter = new UnivCharsetDescIter(this.desc_);

    const descMin = { value: 0 };
    const descMax = { value: 0 };
    const univMin = { value: 0 };

    while (iter.next(descMin, descMax, univMin)) {
      if (univMin.value <= charMax) {
        let univMax: Char;
        if (charMax - univMin.value < descMax.value - descMin.value) {
          univMax = charMax;
        } else {
          univMax = univMin.value + (descMax.value - descMin.value);
        }
        const diff = ((descMin.value - univMin.value) & ((1 << 31) - 1)) >>> 0;
        let currentUnivMin = univMin.value;
        for (;;) {
          const max = { value: 0 as Char };
          const n = this.inverse_.getRange(currentUnivMin as Char, max);
          if (max.value > univMax) {
            max.value = univMax;
          }
          if (n === ((-1) >>> 0)) {
            this.inverse_.setRange(currentUnivMin as Char, max.value, diff);
          } else if (n !== ((-2) >>> 0)) {
            this.inverse_.setRange(currentUnivMin as Char, max.value, ((-2) >>> 0) as Unsigned32);
          }
          if (max.value === univMax) {
            break;
          }
          currentUnivMin = max.value + 1;
        }
      }
    }

    // These are the characters that the ANSI C
    // standard guarantees will be in the basic execution
    // character set.
    const execChars =
      '\t\n\r ' +
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
      'abcdefghijklmnopqrstuvwxyz' +
      '0123456789' +
      '!"#%&\'()*+,-./:' +
      ';<=>?[\\]^_{|}~';

    // These are the corresponding ISO 646 codes.
    const univCodes = [
      9, 10, 13, 32,
      65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77,
      78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
      97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
      110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
      48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
      33, 34, 35, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 58,
      59, 60, 61, 62, 63, 91, 92, 93, 94, 95, 123, 124, 125, 126,
    ];

    for (let i = 0; i < execChars.length; i++) {
      const c = { value: 0 };
      const set = new ISet<WideChar>();
      if (this.univToDesc(univCodes[i], c, set) > 0 && c.value <= charMax) {
        this.execToDesc_[execChars.charCodeAt(i)] = c.value as Char;
      }
    }
  }
}
