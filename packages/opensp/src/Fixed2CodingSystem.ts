// Copyright (c) 1994 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Char } from './types';
import { Boolean } from './Boolean';
import { Decoder, RecoveringEncoder, CodingSystem } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';

class Fixed2Decoder extends Decoder {
  private lsbFirst_: Boolean;

  constructor(lsbFirst: Boolean) {
    super(2); // minBytesPerChar = 2
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

    // Round down to even number of bytes
    const evenLen = fromLen & ~1;
    rest.value = evenLen;

    let toIdx = 0;
    for (let i = 0; i < evenLen; i += 2) {
      to[toIdx++] = this.lsbFirst_
        ? ((fromBytes[i + 1] & 0xff) << 8) + (fromBytes[i] & 0xff)
        : ((fromBytes[i] & 0xff) << 8) + (fromBytes[i + 1] & 0xff);
    }

    return evenLen / 2;
  }

  convertOffset(n: { value: number }): Boolean {
    n.value *= 2;
    return true;
  }
}

class Fixed2Encoder extends RecoveringEncoder {
  constructor() {
    super();
  }

  output(s: number[], n: number, sb: OutputByteStream | null): void {
    if (!sb) return;

    for (let i = 0; i < n; i++) {
      const c = s[i];
      if (c > 0xffff) {
        this.handleUnencodable(c, sb);
      } else {
        sb.sputc((c >> 8) & 0xff);
        sb.sputc(c & 0xff);
      }
    }
  }
}

export class Fixed2CodingSystem extends CodingSystem {
  makeDecoder(lsbFirst: Boolean = false): Decoder {
    return new Fixed2Decoder(lsbFirst);
  }

  makeEncoder(): RecoveringEncoder {
    return new Fixed2Encoder();
  }

  fixedBytesPerChar(): number {
    return 2;
  }
}
