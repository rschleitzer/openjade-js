// Copyright (c) 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Char, Unsigned32 } from './types';
import { Boolean } from './Boolean';
import { Decoder, Encoder, CodingSystem } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';
import { charMax } from './constant';

class Fixed4Decoder extends Decoder {
  // value for encoding error
  private static readonly invalid = 0xfffd;

  private lsbFirst_: Boolean;
  private lswFirst_: Boolean;

  constructor(lsbFirst: Boolean, lswFirst: Boolean) {
    super(4); // minBytesPerChar = 4
    this.lsbFirst_ = lsbFirst;
    this.lswFirst_ = lswFirst;
  }

  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    // Convert input to byte array if needed
    let fromBytes: number[];
    if (typeof from === 'string') {
      fromBytes = [];
      for (let i = 0; i < from.length; i++) {
        fromBytes.push(from.charCodeAt(i));
      }
    } else {
      fromBytes = from;
    }

    // Round down to multiple of 4 bytes
    const evenLen = fromLen & ~3;
    rest.value = evenLen;

    // Calculate shifts based on byte order
    //  lsbFirst,  lswFirst: 0123
    //  lsbFirst, !lswFirst: 2301
    // !lsbFirst,  lswFirst: 1032
    // !lsbFirst, !lswFirst: 3210
    const shift0 = 8 * ((!this.lsbFirst_ ? 1 : 0) + 2 * (!this.lswFirst_ ? 1 : 0));
    const shift1 = 8 * ((this.lsbFirst_ ? 1 : 0) + 2 * (!this.lswFirst_ ? 1 : 0));
    const shift2 = 8 * ((!this.lsbFirst_ ? 1 : 0) + 2 * (this.lswFirst_ ? 1 : 0));
    const shift3 = 8 * ((this.lsbFirst_ ? 1 : 0) + 2 * (this.lswFirst_ ? 1 : 0));

    let toIdx = 0;
    for (let i = 0; i < evenLen; i += 4) {
      const c: Unsigned32 =
        ((fromBytes[i] & 0xff) << shift0) +
        ((fromBytes[i + 1] & 0xff) << shift1) +
        ((fromBytes[i + 2] & 0xff) << shift2) +
        ((fromBytes[i + 3] & 0xff) << shift3);

      to[toIdx++] = charMax < c ? Fixed4Decoder.invalid : c;
    }

    return evenLen / 4;
  }

  convertOffset(n: { value: number }): Boolean {
    n.value *= 4;
    return true;
  }
}

class Fixed4Encoder extends Encoder {
  private buf_: Uint8Array | null;
  private bufSize_: number;

  constructor() {
    super();
    this.buf_ = null;
    this.bufSize_ = 0;
  }

  private allocBuf(n: number): void {
    if (this.bufSize_ < n) {
      this.buf_ = new Uint8Array(n);
      this.bufSize_ = n;
    }
  }

  output(s: number[], n: number, sb: OutputByteStream | null): void {
    if (!sb) return;

    this.allocBuf(n * 4);
    if (this.buf_) {
      for (let i = 0; i < n; i++) {
        this.buf_[i * 4] = (s[i] >> 24) & 0xff;
        this.buf_[i * 4 + 1] = (s[i] >> 16) & 0xff;
        this.buf_[i * 4 + 2] = (s[i] >> 8) & 0xff;
        this.buf_[i * 4 + 3] = s[i] & 0xff;
      }
      // Write buffer as string
      let str = '';
      for (let i = 0; i < n * 4; i++) {
        str += String.fromCharCode(this.buf_[i]);
      }
      sb.sputn(str, n * 4);
    }
  }
}

export class Fixed4CodingSystem extends CodingSystem {
  makeDecoder(lsbFirst: Boolean = false, lswFirst: Boolean = false): Decoder {
    return new Fixed4Decoder(lsbFirst, lswFirst);
  }

  makeEncoder(): Encoder {
    return new Fixed4Encoder();
  }

  fixedBytesPerChar(): number {
    return 4;
  }
}
