// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { Decoder, Encoder, CodingSystem } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';
import { charMax } from './constant';

// Constants for UTF-8 encoding
const cmask1 = 0x80;
const cmask2 = 0xe0;
const cmask3 = 0xf0;
const cmask4 = 0xf8;
const cmask5 = 0xfc;
const cmask6 = 0xfe;

const cval1 = 0x00;
const cval2 = 0xc0;
const cval3 = 0xe0;
const cval4 = 0xf0;
const cval5 = 0xf8;
const cval6 = 0xfc;

const vmask2 = 0x1f;
const vmask3 = 0xf;
const vmask4 = 0x7;
const vmask5 = 0x3;
const vmask6 = 0x1;

const min2 = 0x80;
const min3 = 0x800;
const min4 = 0x10000;
const min5 = 0x200000;
const min6 = 0x4000000;
const max6 = 0x7fffffff;

class UTF8Decoder extends Decoder {
  // value for encoding error
  private static readonly invalid = 0xfffd;

  private recovering_: Boolean;
  private hadFirstChar_: PackedBoolean;
  private hadByteOrderMark_: PackedBoolean;

  constructor() {
    super();
    this.recovering_ = false;
    this.hadFirstChar_ = false;
    this.hadByteOrderMark_ = false;
  }

  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    // Convert input to Uint8Array if needed
    let s: Uint8Array;
    if (typeof from === 'string') {
      s = new Uint8Array(from.length);
      for (let i = 0; i < from.length; i++) {
        s[i] = from.charCodeAt(i);
      }
    } else {
      s = new Uint8Array(from);
    }
    let slen = fromLen;

    // Check for byte-order mark
    if (!this.hadFirstChar_ && slen >= 3) {
      this.hadFirstChar_ = true;

      if (s[0] === 0xEF && s[1] === 0xBB && s[2] === 0xBF) {
        s = s.subarray(3);
        slen -= 3;
        this.hadByteOrderMark_ = true;
      }
    }

    let toIdx = 0;
    let sIdx = 0;

    if (this.recovering_) {
      this.recovering_ = false;
      // Jump to recover label logic
      while (slen > 0) {
        if ((s[sIdx] & 0xc0) !== 0x80) {
          break;
        }
        sIdx++;
        slen--;
      }
    }

    while (slen > 0) {
      const c0 = s[sIdx];

      if ((c0 & cmask1) === cval1) {
        to[toIdx++] = c0;
        sIdx++;
        slen--;
      }
      else if ((c0 & cmask2) === cval2) {
        if (slen < 2) {
          break; // done
        }
        const c1 = s[sIdx + 1] ^ 0x80;
        if (c1 & 0xc0) {
          // error
          sIdx++;
          slen--;
          to[toIdx++] = UTF8Decoder.invalid;
          // recover
          while (slen > 0) {
            if (slen === 0) {
              this.recovering_ = true;
              break;
            }
            if ((s[sIdx] & 0xc0) !== 0x80) {
              break;
            }
            sIdx++;
            slen--;
          }
          continue;
        }
        let c = ((c0 & vmask2) << 6) | c1;
        if (c < min2) {
          c = UTF8Decoder.invalid;
        }
        to[toIdx++] = c;
        slen -= 2;
        sIdx += 2;
      }
      else if ((c0 & cmask3) === cval3) {
        if (slen < 3) {
          break; // done
        }
        const c1 = s[sIdx + 1] ^ 0x80;
        const c2 = s[sIdx + 2] ^ 0x80;
        if ((c1 | c2) & 0xc0) {
          // error
          sIdx++;
          slen--;
          to[toIdx++] = UTF8Decoder.invalid;
          // recover
          while (slen > 0) {
            if (slen === 0) {
              this.recovering_ = true;
              break;
            }
            if ((s[sIdx] & 0xc0) !== 0x80) {
              break;
            }
            sIdx++;
            slen--;
          }
          continue;
        }
        let c = ((((c0 & vmask3) << 6) | c1) << 6) | c2;
        if (c < min3) {
          c = UTF8Decoder.invalid;
        }
        to[toIdx++] = c;
        slen -= 3;
        sIdx += 3;
      }
      else if ((c0 & cmask4) === cval4) {
        if (slen < 4) {
          break; // done
        }
        const c1 = s[sIdx + 1] ^ 0x80;
        const c2 = s[sIdx + 2] ^ 0x80;
        const c3 = s[sIdx + 3] ^ 0x80;
        if ((c1 | c2 | c3) & 0xc0) {
          // error
          sIdx++;
          slen--;
          to[toIdx++] = UTF8Decoder.invalid;
          // recover
          while (slen > 0) {
            if (slen === 0) {
              this.recovering_ = true;
              break;
            }
            if ((s[sIdx] & 0xc0) !== 0x80) {
              break;
            }
            sIdx++;
            slen--;
          }
          continue;
        }
        if (charMax < min5 - 1) {
          to[toIdx++] = UTF8Decoder.invalid;
        } else {
          let c = ((((c0 & vmask4) << 6) | c1) << 6) | c2;
          c = (c << 6) | c3;
          if (c < min4) {
            c = UTF8Decoder.invalid;
          }
          to[toIdx++] = c;
        }
        slen -= 4;
        sIdx += 4;
      }
      else if ((c0 & cmask5) === cval5) {
        if (slen < 5) {
          break; // done
        }
        const c1 = s[sIdx + 1] ^ 0x80;
        const c2 = s[sIdx + 2] ^ 0x80;
        const c3 = s[sIdx + 3] ^ 0x80;
        const c4 = s[sIdx + 4] ^ 0x80;
        if ((c1 | c2 | c3 | c4) & 0xc0) {
          // error
          sIdx++;
          slen--;
          to[toIdx++] = UTF8Decoder.invalid;
          // recover
          while (slen > 0) {
            if (slen === 0) {
              this.recovering_ = true;
              break;
            }
            if ((s[sIdx] & 0xc0) !== 0x80) {
              break;
            }
            sIdx++;
            slen--;
          }
          continue;
        }
        if (charMax < min6 - 1) {
          to[toIdx++] = UTF8Decoder.invalid;
        } else {
          let c = ((((c0 & vmask5) << 6) | c1) << 6) | c2;
          c = (((c << 6) | c3) << 6) | c4;
          if (c < min5) {
            c = UTF8Decoder.invalid;
          }
          to[toIdx++] = c;
        }
        slen -= 5;
        sIdx += 5;
      }
      else if ((c0 & cmask6) === cval6) {
        if (slen < 6) {
          break; // done
        }
        const c1 = s[sIdx + 1] ^ 0x80;
        const c2 = s[sIdx + 2] ^ 0x80;
        const c3 = s[sIdx + 3] ^ 0x80;
        const c4 = s[sIdx + 4] ^ 0x80;
        const c5 = s[sIdx + 5] ^ 0x80;
        if ((c1 | c2 | c3 | c4 | c5) & 0xc0) {
          // error
          sIdx++;
          slen--;
          to[toIdx++] = UTF8Decoder.invalid;
          // recover
          while (slen > 0) {
            if (slen === 0) {
              this.recovering_ = true;
              break;
            }
            if ((s[sIdx] & 0xc0) !== 0x80) {
              break;
            }
            sIdx++;
            slen--;
          }
          continue;
        }
        if (charMax < max6) {
          to[toIdx++] = UTF8Decoder.invalid;
        } else {
          let c = ((((c0 & vmask6) << 6) | c1) << 6) | c2;
          c = (((((c << 6) | c3) << 6) | c4) << 6) | c5;
          if (c < min6) {
            c = UTF8Decoder.invalid;
          }
          to[toIdx++] = c;
        }
        slen -= 6;
        sIdx += 6;
      }
      else {
        // error
        sIdx++;
        slen--;
        to[toIdx++] = UTF8Decoder.invalid;
        // recover
        while (true) {
          if (slen === 0) {
            this.recovering_ = true;
            break;
          }
          if ((s[sIdx] & 0xc0) !== 0x80) {
            break;
          }
          sIdx++;
          slen--;
        }
      }
    }

    rest.value = sIdx;
    return toIdx;
  }

  convertOffset(n: { value: number }): Boolean {
    if (this.hadByteOrderMark_) {
      n.value += 3;
    }
    return true;
  }
}

class UTF8Encoder extends Encoder {
  constructor() {
    super();
  }

  output(s: number[], n: number, sb: OutputByteStream | null): void {
    if (!sb) return;

    for (let i = 0; i < n; i++) {
      const c = s[i];
      if (c < min2) {
        sb.sputc(c);
      } else if (c < min3) {
        sb.sputc((c >> 6) | cval2);
        sb.sputc((c & 0x3f) | 0x80);
      } else if (c < min4) {
        sb.sputc((c >> 12) | cval3);
        sb.sputc(((c >> 6) & 0x3f) | 0x80);
        sb.sputc((c & 0x3f) | 0x80);
      } else if (c < min5) {
        sb.sputc((c >> 18) | cval4);
        sb.sputc(((c >> 12) & 0x3f) | 0x80);
        sb.sputc(((c >> 6) & 0x3f) | 0x80);
        sb.sputc((c & 0x3f) | 0x80);
      } else if (c < min6) {
        sb.sputc((c >> 24) | cval5);
        sb.sputc(((c >> 18) & 0x3f) | 0x80);
        sb.sputc(((c >> 12) & 0x3f) | 0x80);
        sb.sputc(((c >> 6) & 0x3f) | 0x80);
        sb.sputc((c & 0x3f) | 0x80);
      } else if (c <= max6) {
        sb.sputc((c >> 30) | cval6);
        sb.sputc(((c >> 24) & 0x3f) | 0x80);
        sb.sputc(((c >> 18) & 0x3f) | 0x80);
        sb.sputc(((c >> 12) & 0x3f) | 0x80);
        sb.sputc(((c >> 6) & 0x3f) | 0x80);
        sb.sputc((c & 0x3f) | 0x80);
      }
    }
  }
}

export class UTF8CodingSystem extends CodingSystem {
  makeDecoder(): Decoder {
    return new UTF8Decoder();
  }

  makeEncoder(): Encoder {
    return new UTF8Encoder();
  }
}
