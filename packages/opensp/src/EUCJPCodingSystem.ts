// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { Decoder, Encoder, CodingSystem } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';

class EUCJPDecoder extends Decoder {
  constructor() {
    super();
  }

  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    // Convert input to byte array if needed
    let us: number[];
    if (typeof from === 'string') {
      us = [];
      for (let i = 0; i < from.length; i++) {
        us.push(from.charCodeAt(i));
      }
    } else {
      us = from;
    }

    let toIdx = 0;
    let usIdx = 0;
    let slen = fromLen;

    while (slen > 0) {
      const byte = us[usIdx];

      if (!(byte & 0x80)) {
        // G0
        to[toIdx++] = byte;
        usIdx++;
        slen--;
      } else if (byte === 0x8e) {
        // G2
        if (slen < 2) {
          break;
        }
        slen -= 2;
        usIdx++;
        to[toIdx++] = us[usIdx++] | 0x80;
      } else if (byte === 0x8f) {
        // G3
        if (slen < 3) {
          break;
        }
        slen -= 3;
        usIdx++;
        let n = (us[usIdx++] | 0x80) << 8;
        n |= us[usIdx++] & ~0x80;
        to[toIdx++] = n;
      } else {
        // G1
        if (slen < 2) {
          break;
        }
        slen -= 2;
        let n = us[usIdx++] << 8;
        n |= us[usIdx++] | 0x80;
        to[toIdx++] = n;
      }
    }

    rest.value = usIdx;
    return toIdx;
  }
}

class EUCJPEncoder extends Encoder {
  constructor() {
    super();
  }

  output(s: number[], n: number, sb: OutputByteStream | null): void {
    if (!sb) return;

    for (let i = 0; i < n; i++) {
      const c = s[i];
      const mask = c & 0x8080;

      if (mask === 0) {
        sb.sputc(c & 0xff);
      } else if (mask === 0x8080) {
        sb.sputc((c >> 8) & 0xff);
        sb.sputc(c & 0xff);
      } else if (mask === 0x0080) {
        sb.sputc(0x8e);
        sb.sputc(c & 0xff);
      } else {
        // mask === 0x8000
        sb.sputc(0x8f);
        sb.sputc((c >> 8) & 0xff);
        sb.sputc(c & 0x7f);
      }
    }
  }
}

export class EUCJPCodingSystem extends CodingSystem {
  makeDecoder(): Decoder {
    return new EUCJPDecoder();
  }

  makeEncoder(): Encoder {
    return new EUCJPEncoder();
  }
}
