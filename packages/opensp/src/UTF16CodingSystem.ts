// Copyright (c) 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Char, Unsigned32 } from './types';
import { Boolean } from './Boolean';
import { Decoder, Encoder, CodingSystem } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';

class UTF16Decoder extends Decoder {
  // value for encoding error
  private static readonly invalid = 0xfffd;

  private lsbFirst_: Boolean;

  constructor(lsbFirst: Boolean) {
    super();
    this.lsbFirst_ = lsbFirst;
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

    let toIdx = 0;
    let fromIdx = 0;

    while (true) {
      if (fromLen < 2) {
        break;
      }

      const x: Unsigned32 = this.lsbFirst_
        ? ((fromBytes[fromIdx + 1] & 0xff) << 8) + (fromBytes[fromIdx] & 0xff)
        : ((fromBytes[fromIdx] & 0xff) << 8) + (fromBytes[fromIdx + 1] & 0xff);

      if (x < 0xd800 || x > 0xdfff) {
        to[toIdx++] = x;
        fromIdx += 2;
        fromLen -= 2;
        continue;
      }

      if (x > 0xdbff) {
        // FIXME: unpaired RC element
        to[toIdx++] = UTF16Decoder.invalid;
        fromIdx += 2;
        fromLen -= 2;
        continue;
      }

      if (fromLen < 4) {
        break;
      }

      const y: Unsigned32 = this.lsbFirst_
        ? ((fromBytes[fromIdx + 3] & 0xff) << 8) + (fromBytes[fromIdx + 2] & 0xff)
        : ((fromBytes[fromIdx + 2] & 0xff) << 8) + (fromBytes[fromIdx + 3] & 0xff);

      if (y < 0xd800 || y > 0xdfff) {
        // FIXME: unpaired RC element
        to[toIdx++] = UTF16Decoder.invalid;
        to[toIdx++] = y;
        fromIdx += 4;
        fromLen -= 4;
        continue;
      }

      if (y < 0xdc00) {
        // FIXME: unpaired RC element
        to[toIdx++] = UTF16Decoder.invalid;
        fromIdx += 2;
        fromLen -= 2;
        continue;
      }

      to[toIdx++] = ((x - 0xd800) * 0x400 + (y - 0xdc00)) + 0x10000;
      fromIdx += 4;
      fromLen -= 4;
    }

    rest.value = fromIdx;
    return toIdx;
  }
}

class UTF16Encoder extends Encoder {
  constructor() {
    super();
  }

  output(s: number[], n: number, sb: OutputByteStream | null): void {
    if (!sb) return;

    for (let i = 0; i < n; i++) {
      const c = s[i];
      if (c < 0x10000) {
        sb.sputc((c >> 8) & 0xff);
        sb.sputc(c & 0xff);
      } else {
        const y: Unsigned32 = Math.floor((c - 0x10000) / 0x400) + 0xd800;
        const z: Unsigned32 = ((c - 0x10000) % 0x400) + 0xdc00;
        sb.sputc((y >> 8) & 0xff);
        sb.sputc(y & 0xff);
        sb.sputc((z >> 8) & 0xff);
        sb.sputc(z & 0xff);
      }
    }
  }
}

export class UTF16CodingSystem extends CodingSystem {
  makeDecoder(lsbFirst: Boolean = false): Decoder {
    return new UTF16Decoder(lsbFirst);
  }

  makeEncoder(): Encoder {
    return new UTF16Encoder();
  }
}
