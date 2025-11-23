// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { Boolean } from './Boolean';
import { CodingSystem, Decoder, Encoder, RecoveringEncoder } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';

class IdentityDecoder extends Decoder {
  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    // In TypeScript, always copy since types are different
    for (let i = 0; i < fromLen; i++) {
      const ch = typeof from === 'string' ? from.charCodeAt(i) : from[i];
      to[i] = ch & 0xFF; // Zero extend (keep as unsigned byte)
    }
    rest.value = fromLen;
    return fromLen;
  }

  convertOffset(offset: { value: number }): Boolean {
    return true;
  }
}

class IdentityEncoder extends RecoveringEncoder {
  output(chars: Char[], n: number, stream: OutputByteStream | null): void {
    if (!stream) return;

    // Always need to check bounds since Char is number (can be > 255)
    for (let i = 0; i < n; i++) {
      const c = chars[i];
      if (c > 255) {
        this.handleUnencodable(c, stream);
      } else {
        stream.sputc(c);
      }
    }
  }
}

export class IdentityCodingSystem extends CodingSystem {
  constructor() {
    super();
  }

  makeDecoder(): Decoder {
    return new IdentityDecoder();
  }

  makeEncoder(): Encoder {
    return new IdentityEncoder();
  }

  isIdentity(): Boolean {
    return true;
  }
}
