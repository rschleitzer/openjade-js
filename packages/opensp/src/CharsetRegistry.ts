// Copyright (c) 1997 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { WideChar, UnivChar, Char } from './types';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { CharsetInfo } from './CharsetInfo';
import { UnivCharsetDesc } from './UnivCharsetDesc';
import { SIZEOF } from './macros';

export namespace CharsetRegistry {
  export abstract class Iter {
    abstract next(min: { value: WideChar }, max: { value: WideChar }, univ: { value: UnivChar }): Boolean;
  }

  export enum ISORegistrationNumber {
    UNREGISTERED = 0,
    ISO646_ASCII_G0 = 6,
    ISO646_C0 = 1,
    ISO6429 = 77,
    ISO8859_1 = 100,
    ISO8859_2 = 101,
    ISO8859_3 = 109,
    ISO8859_4 = 110,
    ISO8859_5 = 144,
    ISO8859_6 = 127,
    ISO8859_7 = 126,
    ISO8859_8 = 138,
    ISO8859_9 = 148,
    ISO646_JIS_G0 = 14,
    JIS0201 = 13,
    JIS0208 = 168,
    JIS0212 = 159,
    KSC5601 = 149,
    GB2312 = 58,
    ISO10646_UCS2 = 176,
    ISO10646_UCS4 = 177,
    KOI8_R = 65534, // not registered
    BIG5 = 65535 // not registered
  }

  export function getRegistrationNumber(sequence: StringC, charset: CharsetInfo): ISORegistrationNumber {
    // Canonicalize the escape sequence by mapping esc -> ESC,
    // removing leading zeros from escape sequences, and removing
    // initial spaces.
    const s = new StringOf<Char>();
    for (let i = 0; i < sequence.size(); i++) {
      let c = sequence.get(i);
      if (c === charset.execToDesc('e')) {
        s.appendChar(charset.execToDesc('E'));
      } else if (c === charset.execToDesc('s')) {
        s.appendChar(charset.execToDesc('S'));
      } else if (c === charset.execToDesc('c')) {
        s.appendChar(charset.execToDesc('C'));
      } else if (
        charset.digitWeight(c) >= 0 &&
        s.size() > 0 &&
        s.get(s.size() - 1) === charset.execToDesc('0') &&
        (s.size() === 1 || charset.digitWeight(s.get(s.size() - 2)) >= 0)
      ) {
        s.set(s.size() - 1, c);
      } else if (c !== charset.execToDesc(' ') || s.size() > 0) {
        s.appendChar(c);
      }
    }

    for (const entry of escTable) {
      const esc = new StringOf<Char>();
      for (let j = 0; j < entry.esc.length; j++) {
        const byte = entry.esc.charCodeAt(j);
        if (byte === 0x1b) {
          esc.appendChar(charset.execToDesc('E'));
          esc.appendChar(charset.execToDesc('S'));
          esc.appendChar(charset.execToDesc('C'));
        } else {
          const digits = '0123456789';
          let c = (byte >> 4);
          if (c >= 10) {
            esc.appendChar(charset.execToDesc('1'));
          }
          esc.appendChar(charset.execToDesc(digits[c % 10]));
          esc.appendChar(charset.execToDesc('/'));
          c = byte & 0xf;
          if (c >= 10) {
            esc.appendChar(charset.execToDesc('1'));
          }
          esc.appendChar(charset.execToDesc(digits[c % 10]));
        }
        if (j + 1 < entry.esc.length) {
          esc.appendChar(charset.execToDesc(' '));
        }
      }
      if (s.equals(esc)) {
        return entry.number;
      }
    }
    return ISORegistrationNumber.UNREGISTERED;
  }

  export function makeIter(number: ISORegistrationNumber): Iter | null {
    for (const entry of rangeTable) {
      if (number === entry.number) {
        return new CharsetRegistryRangeIter(entry.ranges);
      }
    }
    for (const entry of descTable) {
      if (number === entry.number) {
        return new CharsetRegistryDescIter(entry.desc);
      }
    }
    return null;
  }
}

class CharsetRegistryRangeIter extends CharsetRegistry.Iter {
  private p_: UnivCharsetDesc.Range[];
  private i_: number;

  constructor(ranges: UnivCharsetDesc.Range[]) {
    super();
    this.p_ = ranges;
    this.i_ = 0;
  }

  next(min: { value: WideChar }, max: { value: WideChar }, univ: { value: UnivChar }): Boolean {
    if (this.i_ < this.p_.length) {
      const range = this.p_[this.i_];
      min.value = range.descMin;
      max.value = range.descMin + (range.count - 1);
      univ.value = range.univMin;
      this.i_++;
      return true;
    }
    return false;
  }
}

class CharsetRegistryDescIter extends CharsetRegistry.Iter {
  private p_: number[];
  private idx_: number;
  private n_: number;
  private c_: WideChar;

  constructor(desc: number[]) {
    super();
    this.p_ = desc;
    this.idx_ = 2;
    this.n_ = desc[0];
    this.c_ = desc[1];
  }

  next(min: { value: WideChar }, max: { value: WideChar }, univ: { value: UnivChar }): Boolean {
    if (this.n_ === 0) {
      this.n_ = this.p_[this.idx_];
      if (this.n_ === 0) {
        return false;
      }
      this.idx_++;
      this.c_ = this.p_[this.idx_++];
    }

    let i = 1;
    for (; i < this.n_; i++) {
      if (this.p_[this.idx_ + i] !== this.p_[this.idx_ + i - 1] + 1) {
        break;
      }
    }

    min.value = this.c_;
    max.value = min.value + (i - 1);
    univ.value = this.p_[this.idx_];
    this.idx_ += i;
    this.c_ += i;
    this.n_ -= i;
    return true;
  }
}

// Escape sequence table
const escTable: { esc: string; number: CharsetRegistry.ISORegistrationNumber }[] = [
  { esc: '\x1B%@', number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0 },
  { esc: '\x1B(@', number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0 },
  { esc: '\x1B(B', number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0 }, // ASCII
  { esc: '\x1B!@', number: CharsetRegistry.ISORegistrationNumber.ISO646_C0 },
  { esc: '\x1B-A', number: CharsetRegistry.ISORegistrationNumber.ISO8859_1 },
  { esc: '\x1B-B', number: CharsetRegistry.ISORegistrationNumber.ISO8859_2 },
  { esc: '\x1B-C', number: CharsetRegistry.ISORegistrationNumber.ISO8859_3 },
  { esc: '\x1B-D', number: CharsetRegistry.ISORegistrationNumber.ISO8859_4 },
  { esc: '\x1B-L', number: CharsetRegistry.ISORegistrationNumber.ISO8859_5 },
  { esc: '\x1B-G', number: CharsetRegistry.ISORegistrationNumber.ISO8859_6 },
  { esc: '\x1B-F', number: CharsetRegistry.ISORegistrationNumber.ISO8859_7 },
  { esc: '\x1B-H', number: CharsetRegistry.ISORegistrationNumber.ISO8859_8 },
  { esc: '\x1B-M', number: CharsetRegistry.ISORegistrationNumber.ISO8859_9 },
  { esc: '\x1B(J', number: CharsetRegistry.ISORegistrationNumber.ISO646_JIS_G0 },
  { esc: '\x1B(I', number: CharsetRegistry.ISORegistrationNumber.JIS0201 },
  { esc: '\x1B$B', number: CharsetRegistry.ISORegistrationNumber.JIS0208 },
  { esc: '\x1B&@\x1B$B', number: CharsetRegistry.ISORegistrationNumber.JIS0208 },
  { esc: '\x1B$(D', number: CharsetRegistry.ISORegistrationNumber.JIS0212 },
  { esc: '\x1B$A', number: CharsetRegistry.ISORegistrationNumber.GB2312 },
  { esc: '\x1B$(C', number: CharsetRegistry.ISORegistrationNumber.KSC5601 },
  { esc: '\x1B%/@', number: CharsetRegistry.ISORegistrationNumber.ISO10646_UCS2 },
  { esc: '\x1B%/A', number: CharsetRegistry.ISORegistrationNumber.ISO10646_UCS4 },
  { esc: '\x1B%/C', number: CharsetRegistry.ISORegistrationNumber.ISO10646_UCS2 },
  { esc: '\x1B%/D', number: CharsetRegistry.ISORegistrationNumber.ISO10646_UCS4 },
  { esc: '\x1B%/E', number: CharsetRegistry.ISORegistrationNumber.ISO10646_UCS2 },
  { esc: '\x1B%/F', number: CharsetRegistry.ISORegistrationNumber.ISO10646_UCS4 }
];

// Range data
const iso646_ascii: UnivCharsetDesc.Range[] = [{ descMin: 0, count: 128, univMin: 0 }];

const iso646_C0: UnivCharsetDesc.Range[] = [
  { descMin: 0, count: 32, univMin: 0 },
  { descMin: 127, count: 1, univMin: 127 }
];

const iso6429: UnivCharsetDesc.Range[] = [{ descMin: 0, count: 32, univMin: 128 }];

const iso8859_1: UnivCharsetDesc.Range[] = [{ descMin: 32, count: 96, univMin: 160 }];

const iso10646_ucs2: UnivCharsetDesc.Range[] = [{ descMin: 0, count: 65536, univMin: 0 }];

const iso10646_ucs4: UnivCharsetDesc.Range[] = [{ descMin: 0, count: 0x80000000, univMin: 0 }];

const rangeTable: { number: CharsetRegistry.ISORegistrationNumber; ranges: UnivCharsetDesc.Range[] }[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, ranges: iso646_ascii },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, ranges: iso646_C0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, ranges: iso6429 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_1, ranges: iso8859_1 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO10646_UCS2, ranges: iso10646_ucs2 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO10646_UCS4, ranges: iso10646_ucs4 }
];

// Note: The full charset data tables for ISO8859-2 through ISO8859-9, JIS, GB2312, KSC5601, Big5, KOI8-R
// are not included here. They are large data tables that would need to be ported from the .h files
// in the lib/ directory. For now, we include only the basic rangeTable entries.
// These can be added later if TranslateCodingSystem is actually used.

const descTable: { number: CharsetRegistry.ISORegistrationNumber; desc: number[] }[] = [
  // Placeholder - full data tables would go here
];
