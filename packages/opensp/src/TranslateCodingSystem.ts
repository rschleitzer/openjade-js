// Copyright (c) 1997 James Clark
// See the file COPYING for copying permission.

import { Char, WideChar, UnivChar } from './types';
import { Boolean } from './Boolean';
import { Decoder, Encoder, RecoveringEncoder, CodingSystem } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';
import { Owner } from './Owner';
import { ConstPtr } from './Ptr';
import { CharMapResource } from './CharMap';
import { CharsetRegistry } from './CharsetRegistry';
import { CharsetInfo } from './CharsetInfo';
import { ISet } from './ISet';

class TranslateDecoder extends Decoder {
  private decoder_: Owner<Decoder>;
  private map_: ConstPtr<CharMapResource<Char>>;

  constructor(decoder: Decoder, map: ConstPtr<CharMapResource<Char>>) {
    super(decoder.minBytesPerChar());
    this.decoder_ = new Owner<Decoder>(decoder);
    this.map_ = map;
  }

  convertOffset(offset: { value: number }): Boolean {
    const decoder = this.decoder_.pointer();
    return decoder ? decoder.convertOffset(offset) : false;
  }

  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    const decoder = this.decoder_.pointer();
    if (!decoder) {
      rest.value = 0;
      return 0;
    }

    const n = decoder.decode(to, from, fromLen, rest);
    const map = this.map_.pointer();
    if (map) {
      for (let i = 0; i < n; i++) {
        to[i] = map.get(to[i]);
      }
    }
    return n;
  }
}

class TranslateEncoder extends RecoveringEncoder {
  private encoder_: Owner<Encoder>;
  private map_: ConstPtr<CharMapResource<Char>>;
  private illegalChar_: Char;
  private static readonly bufSize = 256;
  private buf_: Char[];

  constructor(encoder: Encoder, map: ConstPtr<CharMapResource<Char>>, illegalChar: Char) {
    super();
    this.encoder_ = new Owner<Encoder>(encoder);
    this.map_ = map;
    this.illegalChar_ = illegalChar;
    this.buf_ = new Array(TranslateEncoder.bufSize);
  }

  startFile(sbuf: OutputByteStream | null): void {
    const encoder = this.encoder_.pointer();
    if (encoder) {
      encoder.startFile(sbuf);
    }
  }

  output(s: number[], n: number, sbuf: OutputByteStream | null): void {
    const encoder = this.encoder_.pointer();
    if (!encoder) return;

    const map = this.map_.pointer();
    if (!map) {
      encoder.output(s, n, sbuf);
      return;
    }

    let j = 0;
    for (let i = 0; i < n; i++) {
      const c = map.get(s[i]);
      if (c === this.illegalChar_) {
        if (j > 0) {
          encoder.output(this.buf_, j, sbuf);
          j = 0;
        }
        this.handleUnencodable(s[i], sbuf);
      } else {
        if (j >= TranslateEncoder.bufSize) {
          encoder.output(this.buf_, j, sbuf);
          j = 0;
        }
        this.buf_[j++] = c;
      }
    }
    if (j > 0) {
      encoder.output(this.buf_, j, sbuf);
    }
  }
}

export namespace TranslateCodingSystem {
  export interface Desc {
    number: CharsetRegistry.ISORegistrationNumber;
    // How much to add to the values in the base set
    add: Char;
  }
}

export class TranslateCodingSystem extends CodingSystem {
  private decodeMap_: ConstPtr<CharMapResource<Char>>;
  private encodeMap_: ConstPtr<CharMapResource<Char>>;
  private sub_: CodingSystem | null;
  private desc_: TranslateCodingSystem.Desc[];
  private charset_: CharsetInfo | null;
  private illegalChar_: Char;
  private replacementChar_: Char;

  constructor(
    codingSystem: CodingSystem | null,
    desc: TranslateCodingSystem.Desc[],
    charset: CharsetInfo | null,
    illegalChar: Char,
    replacementChar: Char
  ) {
    super();
    this.sub_ = codingSystem;
    this.desc_ = desc;
    this.charset_ = charset;
    this.illegalChar_ = illegalChar;
    this.replacementChar_ = replacementChar;
    this.decodeMap_ = new ConstPtr<CharMapResource<Char>>();
    this.encodeMap_ = new ConstPtr<CharMapResource<Char>>();
  }

  makeDecoder(): Decoder {
    if (this.decodeMap_.isNull()) {
      const map = new CharMapResource<Char>(this.replacementChar_);
      this.decodeMap_ = new ConstPtr<CharMapResource<Char>>(map);

      for (const d of this.desc_) {
        if (d.number === CharsetRegistry.ISORegistrationNumber.UNREGISTERED) {
          break;
        }

        const iter = CharsetRegistry.makeIter(d.number);
        if (iter && this.charset_) {
          const min = { value: 0 as WideChar };
          const max = { value: 0 as WideChar };
          const univ = { value: 0 as UnivChar };

          while (iter.next(min, max, univ)) {
            let currentMin = min.value;
            do {
              const set = new ISet<WideChar>();
              const sysChar = { value: 0 as WideChar };
              const count = { value: 0 as WideChar };

              const n = this.charset_.univToDesc(univ.value, sysChar, set, count);
              let actualCount = count.value;
              if (actualCount > (max.value - currentMin) + 1) {
                actualCount = (max.value - currentMin) + 1;
              }

              if (n) {
                for (let i = 0; i < actualCount; i++) {
                  map.setChar(currentMin + d.add + i, sysChar.value + i);
                }
              }

              currentMin += actualCount - 1;
              univ.value += actualCount;
            } while (currentMin++ !== max.value);
          }
        }
      }
    }

    if (!this.sub_) {
      throw new Error('TranslateCodingSystem: no sub coding system');
    }
    return new TranslateDecoder(this.sub_.makeDecoder(), this.decodeMap_);
  }

  makeEncoder(): Encoder {
    if (this.encodeMap_.isNull()) {
      const map = new CharMapResource<Char>(this.illegalChar_);
      this.encodeMap_ = new ConstPtr<CharMapResource<Char>>(map);

      for (const d of this.desc_) {
        if (d.number === CharsetRegistry.ISORegistrationNumber.UNREGISTERED) {
          break;
        }

        const iter = CharsetRegistry.makeIter(d.number);
        if (iter && this.charset_) {
          const min = { value: 0 as WideChar };
          const max = { value: 0 as WideChar };
          const univ = { value: 0 as UnivChar };

          while (iter.next(min, max, univ)) {
            let currentMin = min.value;
            do {
              const set = new ISet<WideChar>();
              const sysChar = { value: 0 as WideChar };
              const count = { value: 0 as WideChar };

              const n = this.charset_.univToDesc(univ.value, sysChar, set, count);
              let actualCount = count.value;
              if (actualCount > (max.value - currentMin) + 1) {
                actualCount = (max.value - currentMin) + 1;
              }

              if (n) {
                for (let i = 0; i < actualCount; i++) {
                  map.setChar(sysChar.value + i, currentMin + d.add + i);
                }
              }

              currentMin += actualCount - 1;
              univ.value += actualCount;
            } while (currentMin++ !== max.value);
          }
        }
      }
    }

    if (!this.sub_) {
      throw new Error('TranslateCodingSystem: no sub coding system');
    }
    return new TranslateEncoder(this.sub_.makeEncoder(), this.encodeMap_, this.illegalChar_);
  }

  fixedBytesPerChar(): number {
    return this.sub_ ? this.sub_.fixedBytesPerChar() : 0;
  }
}
