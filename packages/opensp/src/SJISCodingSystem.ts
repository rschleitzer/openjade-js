// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { Decoder, RecoveringEncoder, CodingSystem } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';

class SJISDecoder extends Decoder {
  constructor() {
    super();
  }

  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    // Convert input to byte array if needed
    let s: number[];
    if (typeof from === 'string') {
      s = [];
      for (let i = 0; i < from.length; i++) {
        s.push(from.charCodeAt(i));
      }
    } else {
      s = from;
    }

    let toIdx = 0;
    let sIdx = 0;
    let slen = fromLen;

    while (slen > 0) {
      const c = s[sIdx] & 0xff;

      if (!(c & 0x80)) {
        to[toIdx++] = c;
        sIdx++;
        slen--;
      } else if (129 <= c && c <= 159) {
        if (slen < 2) {
          break;
        }
        sIdx++;
        slen -= 2;
        const c2 = s[sIdx++] & 0xff;
        let n = ((c - 112) << 9) | c2;
        if (64 <= c2 && c2 <= 127) {
          n -= 31 + (1 << 8);
        } else if (c2 <= 158) {
          n -= 32 + (1 << 8);
        } else if (c2 <= 252) {
          n -= 126;
        } else {
          continue;
        }
        n |= 0x8080;
        to[toIdx++] = n;
      } else if (224 <= c && c <= 239) {
        if (slen < 2) {
          break;
        }
        sIdx++;
        slen -= 2;
        const c2 = s[sIdx++] & 0xff;
        let n = ((c - 176) << 9) | c2;
        if (64 <= c2 && c2 <= 127) {
          n -= 31 + (1 << 8);
        } else if (c2 <= 158) {
          n -= 32 + (1 << 8);
        } else if (c2 <= 252) {
          n -= 126;
        } else {
          continue;
        }
        n |= 0x8080;
        to[toIdx++] = n;
      } else if (161 <= c && c <= 223) {
        slen--;
        sIdx++;
        to[toIdx++] = c;
      } else {
        // 128, 160, 240-255
        slen--;
        sIdx++;
      }
    }

    rest.value = sIdx;
    return toIdx;
  }
}

class SJISEncoder extends RecoveringEncoder {
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
        const c1 = (c >> 8) & 0x7f;
        const c2 = c & 0x7f;
        let out1: number;

        if (c1 < 33) {
          out1 = 0;
        } else if (c1 < 95) {
          out1 = ((c1 + 1) >> 1) + 112;
        } else if (c1 < 127) {
          out1 = ((c1 + 1) >> 1) + 176;
        } else {
          out1 = 0;
        }

        if (out1) {
          let out2: number;
          if (c1 & 1) {
            if (c2 < 33) {
              out2 = 0;
            } else if (c2 <= 95) {
              out2 = c2 + 31;
            } else if (c2 <= 126) {
              out2 = c2 + 32;
            } else {
              out2 = 0;
            }
          } else {
            if (33 <= c2 && c2 <= 126) {
              out2 = c2 + 126;
            } else {
              out2 = 0;
            }
          }

          if (out2) {
            sb.sputc(out1);
            sb.sputc(out2);
          } else {
            this.handleUnencodable(c, sb);
          }
        } else {
          this.handleUnencodable(c, sb);
        }
      } else if (mask === 0x0080) {
        if (161 <= c && c <= 223) {
          sb.sputc(c & 0xff);
        } else {
          this.handleUnencodable(c, sb);
        }
      } else {
        this.handleUnencodable(c, sb);
      }
    }
  }
}

export class SJISCodingSystem extends CodingSystem {
  makeDecoder(): Decoder {
    return new SJISDecoder();
  }

  makeEncoder(): RecoveringEncoder {
    return new SJISEncoder();
  }
}
