// Copyright (c) 1997 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { Decoder, Encoder, CodingSystem } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';

class Big5Decoder extends Decoder {
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
        to[toIdx++] = byte;
        usIdx++;
        slen--;
      } else {
        if (slen < 2) {
          break;
        }
        slen -= 2;
        let n = us[usIdx++] << 8;
        n |= us[usIdx++];
        to[toIdx++] = n;
      }
    }

    rest.value = usIdx;
    return toIdx;
  }
}

class Big5Encoder extends Encoder {
  constructor() {
    super();
  }

  output(s: number[], n: number, sb: OutputByteStream | null): void {
    if (!sb) return;

    for (let i = 0; i < n; i++) {
      const c = s[i];

      if (c < 0x80) {
        sb.sputc(c);
      } else if (c & 0x8000) {
        sb.sputc((c >> 8) & 0xff);
        sb.sputc(c & 0xff);
      } else {
        this.handleUnencodable(c, sb);
      }
    }
  }
}

export class Big5CodingSystem extends CodingSystem {
  makeDecoder(): Decoder {
    return new Big5Decoder();
  }

  makeEncoder(): Encoder {
    return new Big5Encoder();
  }
}
