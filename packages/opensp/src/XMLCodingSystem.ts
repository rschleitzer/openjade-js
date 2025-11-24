// Copyright (c) 1994, 1997 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { CodingSystem, Decoder, Encoder } from './CodingSystem';
import { InputCodingSystemKit } from './CodingSystemKit';
import { UTF8CodingSystem } from './UTF8CodingSystem';
import { UTF16CodingSystem } from './UTF16CodingSystem';
import { Fixed4CodingSystem } from './Fixed4CodingSystem';
import { Boolean } from './Boolean';
import { Owner } from './Owner';
import { Char } from './types';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { UnivCharsetDesc } from './UnivCharsetDesc';
import { CharsetInfo } from './CharsetInfo';
import { ASSERT, CANNOT_HAPPEN } from './macros';

// ISO 646 characters
const ISO646_TAB = 0x9;
const ISO646_LF = 0xa;
const ISO646_CR = 0xd;
const ISO646_SPACE = 0x20;
const ISO646_QUOT = 0x22;
const ISO646_APOS = 0x27;
const ISO646_LT = 0x3c;
const ISO646_EQUAL = 0x3d;
const ISO646_GT = 0x3e;
const ISO646_QUEST = 0x3f;
const ISO646_LETTER_a = 0x61;
const ISO646_LETTER_c = 0x63;
const ISO646_LETTER_d = 0x64;
const ISO646_LETTER_e = 0x65;
const ISO646_LETTER_g = 0x67;
const ISO646_LETTER_i = 0x69;
const ISO646_LETTER_l = 0x6c;
const ISO646_LETTER_m = 0x6d;
const ISO646_LETTER_n = 0x6e;
const ISO646_LETTER_o = 0x6f;
const ISO646_LETTER_x = 0x78;

enum DetectPhase {
  phaseInit,
  phasePI,
  phaseFinish
}

class XMLDecoder extends Decoder {
  private static readonly piMaxSize = 1024 * 32;

  private phase_: DetectPhase;
  private byteOrderMark_: Boolean;
  private lsbFirst_: Boolean;
  private lswFirst_: Boolean;
  private guessBytesPerChar_: number;
  private subDecoder_: Owner<Decoder>;
  private pi_: StringOf<Char>;
  private piLiteral_: Char;
  private kit_: InputCodingSystemKit;

  constructor(kit: InputCodingSystemKit) {
    super(1);
    this.kit_ = kit;
    this.phase_ = DetectPhase.phaseInit;
    this.byteOrderMark_ = false;
    this.lsbFirst_ = false;
    this.lswFirst_ = false;
    this.guessBytesPerChar_ = 1;
    this.subDecoder_ = new Owner<Decoder>();
    this.pi_ = new StringOf<Char>();
    this.piLiteral_ = 0;
  }

  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    // Convert input to byte array
    let fromBytes: number[];
    if (typeof from === 'string') {
      fromBytes = [];
      for (let i = 0; i < from.length; i++) {
        fromBytes.push(from.charCodeAt(i));
      }
    } else {
      fromBytes = from;
    }

    if (this.phase_ === DetectPhase.phaseFinish) {
      const decoder = this.subDecoder_.pointer();
      if (decoder) {
        return decoder.decode(to, fromBytes, fromLen, rest);
      }
      rest.value = 0;
      return 0;
    }

    let fromIdx = 0;

    if (this.phase_ === DetectPhase.phaseInit) {
      if (fromLen === 0) {
        rest.value = 0;
        return 0;
      }

      switch (fromBytes[fromIdx] & 0xff) {
        case 0x00:
        case 0x3c:
        case 0xff:
        case 0xfe:
          if (fromLen < 2) {
            rest.value = fromIdx;
            return 0;
          }
          const word = ((fromBytes[fromIdx] & 0xff) << 8) | (fromBytes[fromIdx + 1] & 0xff);
          switch (word) {
            case 0xfeff:
              this.phase_ = DetectPhase.phasePI;
              this.byteOrderMark_ = true;
              this.guessBytesPerChar_ = 2;
              fromIdx += 2;
              fromLen -= 2;
              break;
            case 0xfffe:
              this.lsbFirst_ = true;
              this.phase_ = DetectPhase.phasePI;
              this.byteOrderMark_ = true;
              this.guessBytesPerChar_ = 2;
              fromIdx += 2;
              fromLen -= 2;
              break;
            case 0x3c3f:
              this.phase_ = DetectPhase.phasePI;
              break;
            case 0x0000:
            case 0x3c00:
            case 0x003c:
              if (fromLen < 4) {
                rest.value = fromIdx;
                return 0;
              }
              const dword =
                ((fromBytes[fromIdx] & 0xff) << 24) |
                ((fromBytes[fromIdx + 1] & 0xff) << 16) |
                ((fromBytes[fromIdx + 2] & 0xff) << 8) |
                (fromBytes[fromIdx + 3] & 0xff);
              switch (dword) {
                case 0x0000003c:
                  this.lsbFirst_ = false;
                  this.lswFirst_ = false;
                  this.phase_ = DetectPhase.phasePI;
                  this.guessBytesPerChar_ = 4;
                  break;
                case 0x00003c00:
                  this.lsbFirst_ = true;
                  this.lswFirst_ = false;
                  this.phase_ = DetectPhase.phasePI;
                  this.guessBytesPerChar_ = 4;
                  break;
                case 0x003c0000:
                  this.lsbFirst_ = false;
                  this.lswFirst_ = true;
                  this.phase_ = DetectPhase.phasePI;
                  this.guessBytesPerChar_ = 4;
                  break;
                case 0x3c000000:
                  this.lsbFirst_ = true;
                  this.lswFirst_ = true;
                  this.phase_ = DetectPhase.phasePI;
                  this.guessBytesPerChar_ = 4;
                  break;
                case 0x003c003f:
                  this.lsbFirst_ = true;
                  this.phase_ = DetectPhase.phasePI;
                  this.guessBytesPerChar_ = 2;
                  break;
                case 0x3c003f00:
                  this.lsbFirst_ = false;
                  this.phase_ = DetectPhase.phasePI;
                  this.guessBytesPerChar_ = 2;
                  break;
                default:
                  break;
              }
              if (this.phase_ === DetectPhase.phasePI) {
                break;
              }
            // fall through
            default:
              break;
          }
          if (this.phase_ === DetectPhase.phasePI) {
            break;
          }
        // fall through
        default:
          this.phase_ = DetectPhase.phaseFinish;
          this.guessBytesPerChar_ = 1;
          this.initDecoderDefault();
          const decoder = this.subDecoder_.pointer();
          if (decoder) {
            return decoder.decode(to, fromBytes.slice(fromIdx), fromLen, rest);
          }
          rest.value = fromIdx;
          return 0;
      }
    }

    ASSERT(this.phase_ === DetectPhase.phasePI);

    let toIdx = 0;
    while (fromLen > this.guessBytesPerChar_) {
      if (!this.piLiteral_ && this.pi_.size() > 0 && this.pi_.get(this.pi_.size() - 1) === ISO646_GT) {
        this.initDecoderPI();
        this.phase_ = DetectPhase.phaseFinish;
        const decoder = this.subDecoder_.pointer();
        if (decoder) {
          return toIdx + decoder.decode(to.slice(toIdx), fromBytes.slice(fromIdx), fromLen, rest);
        }
        rest.value = fromIdx;
        return toIdx;
      }

      let c: Char;
      switch (this.guessBytesPerChar_) {
        case 1:
          c = fromBytes[fromIdx] & 0xff;
          break;
        case 2:
          if (this.lsbFirst_) {
            c = ((fromBytes[fromIdx + 1] & 0xff) << 8) | (fromBytes[fromIdx] & 0xff);
          } else {
            c = ((fromBytes[fromIdx] & 0xff) << 8) | (fromBytes[fromIdx + 1] & 0xff);
          }
          break;
        case 4: {
          const shift0 = 8 * (this.lsbFirst_ ? 0 : 1) + 16 * (this.lswFirst_ ? 0 : 1);
          const shift1 = 8 * (this.lsbFirst_ ? 1 : 0) + 16 * (this.lswFirst_ ? 0 : 1);
          const shift2 = 8 * (this.lsbFirst_ ? 0 : 1) + 16 * (this.lswFirst_ ? 1 : 0);
          const shift3 = 8 * (this.lsbFirst_ ? 1 : 0) + 16 * (this.lswFirst_ ? 1 : 0);
          c =
            ((fromBytes[fromIdx] & 0xff) << shift0) |
            ((fromBytes[fromIdx + 1] & 0xff) << shift1) |
            ((fromBytes[fromIdx + 2] & 0xff) << shift2) |
            ((fromBytes[fromIdx + 3] & 0xff) << shift3);
          break;
        }
        default:
          CANNOT_HAPPEN();
          c = 0;
      }

      const startBytes = [ISO646_LT, ISO646_QUEST, ISO646_LETTER_x, ISO646_LETTER_m, ISO646_LETTER_l];

      // Stop accumulating the PI if we get characters that are illegal in the PI.
      if (
        c === 0 ||
        c >= 0x7f ||
        (this.pi_.size() > 0 && c === ISO646_LT) ||
        this.pi_.size() > XMLDecoder.piMaxSize ||
        (this.pi_.size() < 5 && c !== startBytes[this.pi_.size()]) ||
        (this.pi_.size() === 5 && !XMLDecoder.isWS(c))
      ) {
        this.initDecoderDefault();
        this.phase_ = DetectPhase.phaseFinish;
        break;
      }

      to[toIdx++] = c;
      this.pi_.appendChar(c);

      if (this.piLiteral_) {
        if (c === this.piLiteral_) {
          this.piLiteral_ = 0;
        }
      } else if (c === ISO646_QUOT || c === ISO646_APOS) {
        this.piLiteral_ = c;
      }

      fromIdx += this.guessBytesPerChar_;
      fromLen -= this.guessBytesPerChar_;
    }

    if (this.phase_ === DetectPhase.phaseFinish && fromLen > 0) {
      const decoder = this.subDecoder_.pointer();
      if (decoder) {
        toIdx += decoder.decode(to.slice(toIdx), fromBytes.slice(fromIdx), fromLen, rest);
      } else {
        rest.value = fromIdx;
      }
    } else {
      rest.value = fromIdx;
    }

    return toIdx;
  }

  convertOffset(offset: { value: number }): Boolean {
    const n = offset.value;
    if (n <= this.pi_.size()) {
      offset.value = n * this.guessBytesPerChar_;
    } else {
      const decoder = this.subDecoder_.pointer();
      if (!decoder) {
        return false;
      }
      const tem = { value: n - this.pi_.size() };
      if (!decoder.convertOffset(tem)) {
        return false;
      }
      offset.value = tem.value + this.pi_.size() * this.guessBytesPerChar_;
    }
    if (this.byteOrderMark_) {
      offset.value += 2;
    }
    return true;
  }

  private initDecoderDefault(): void {
    switch (this.guessBytesPerChar_) {
      case 1: {
        const utf8 = new UTF8CodingSystem();
        this.subDecoder_ = new Owner<Decoder>(utf8.makeDecoder());
        break;
      }
      case 2: {
        const utf16 = new UTF16CodingSystem();
        this.subDecoder_ = new Owner<Decoder>(utf16.makeDecoder(this.lsbFirst_));
        break;
      }
      case 4: {
        const utf32 = new Fixed4CodingSystem();
        this.subDecoder_ = new Owner<Decoder>(utf32.makeDecoder(this.lsbFirst_, this.lswFirst_));
        break;
      }
      default:
        CANNOT_HAPPEN();
    }
    const decoder = this.subDecoder_.pointer();
    if (decoder) {
      this.minBytesPerChar_ = decoder.minBytesPerChar();
    }
  }

  private initDecoderPI(): void {
    const name = new StringOf<Char>();
    if (!this.extractEncoding(name)) {
      this.initDecoderDefault();
      return;
    }

    const staticName = { value: null as string | null };
    const range: UnivCharsetDesc.Range = { descMin: 0, count: 128, univMin: 0 };
    const piCharset = new CharsetInfo();
    const desc = new UnivCharsetDesc([range], 1);
    piCharset.set(desc);

    const ics = this.kit_.makeInputCodingSystem(name, piCharset, false, staticName);
    if (ics) {
      this.subDecoder_ = new Owner<Decoder>(ics.makeDecoder(this.lsbFirst_, this.lswFirst_));
      const decoder = this.subDecoder_.pointer();
      if (decoder) {
        this.minBytesPerChar_ = decoder.minBytesPerChar();
      }
    }
    if (!this.subDecoder_.pointer()) {
      this.initDecoderDefault();
    }
  }

  private static isWS(c: Char): boolean {
    switch (c) {
      case ISO646_CR:
      case ISO646_LF:
      case ISO646_SPACE:
      case ISO646_TAB:
        return true;
    }
    return false;
  }

  private extractEncoding(name: StringOf<Char>): Boolean {
    let lit: Char = 0;
    for (let i = 5; i < this.pi_.size(); i++) {
      if (!lit) {
        if (this.pi_.get(i) === ISO646_APOS || this.pi_.get(i) === ISO646_QUOT) {
          lit = this.pi_.get(i);
        } else if (this.pi_.get(i) === ISO646_EQUAL) {
          let j = i;
          while (j > 0) {
            if (!XMLDecoder.isWS(this.pi_.get(j - 1))) {
              break;
            }
            j--;
          }
          const nameEnd = j;
          while (j > 0) {
            if (
              XMLDecoder.isWS(this.pi_.get(j - 1)) ||
              this.pi_.get(j - 1) === ISO646_QUOT ||
              this.pi_.get(j - 1) === ISO646_APOS
            ) {
              break;
            }
            j--;
          }

          const encodingName = [
            ISO646_LETTER_e,
            ISO646_LETTER_n,
            ISO646_LETTER_c,
            ISO646_LETTER_o,
            ISO646_LETTER_d,
            ISO646_LETTER_i,
            ISO646_LETTER_n,
            ISO646_LETTER_g
          ];

          let s = 0;
          while (s < encodingName.length && j < nameEnd) {
            if (this.pi_.get(j) !== encodingName[s]) {
              break;
            }
            j++;
            s++;
          }

          if (j === nameEnd && s === encodingName.length) {
            let k = i + 1;
            while (k < this.pi_.size()) {
              if (!XMLDecoder.isWS(this.pi_.get(k))) {
                break;
              }
              k++;
            }

            if (this.pi_.get(k) === ISO646_QUOT || this.pi_.get(k) === ISO646_APOS) {
              const quoteLit = this.pi_.get(k);
              const nameStart = k + 1;
              k++;
              while (k < this.pi_.size()) {
                if (this.pi_.get(k) === quoteLit) {
                  if (k > nameStart) {
                    const data = this.pi_.data();
                    if (data) {
                      name.assign(data.slice(nameStart, k), k - nameStart);
                    }
                    return true;
                  }
                  break;
                }
                k++;
              }
            }
            return false;
          }
        }
      } else if (this.pi_.get(i) === lit) {
        lit = 0;
      }
    }
    return false;
  }
}

export class XMLCodingSystem extends CodingSystem {
  private kit_: InputCodingSystemKit;

  constructor(kit: InputCodingSystemKit) {
    super();
    this.kit_ = kit;
  }

  makeDecoder(): Decoder {
    return new XMLDecoder(this.kit_);
  }

  makeEncoder(): Encoder {
    const utf8 = new UTF8CodingSystem();
    return utf8.makeEncoder();
  }
}
