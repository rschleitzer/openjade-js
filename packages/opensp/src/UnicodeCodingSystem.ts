// Copyright (c) 1994 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Char } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { Decoder, Encoder, InputCodingSystem, CodingSystem } from './CodingSystem';
import { OutputByteStream } from './OutputByteStream';
import { UTF16CodingSystem } from './UTF16CodingSystem';
import { Owner } from './Owner';

const byteOrderMark = 0xfeff;
const swappedByteOrderMark = 0xfffe;

class UnicodeDecoder extends Decoder {
  private hadByteOrderMark_: PackedBoolean;
  private swapBytes_: PackedBoolean;
  private subDecoder_: Owner<Decoder>;
  private subCodingSystem_: InputCodingSystem | null;

  constructor(subCodingSystem: InputCodingSystem | null) {
    super(subCodingSystem ? 1 : 2);
    this.subCodingSystem_ = subCodingSystem;
    this.hadByteOrderMark_ = false;
    this.swapBytes_ = false;
    this.subDecoder_ = new Owner<Decoder>();
  }

  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    const subDecoder = this.subDecoder_.pointer();
    if (subDecoder) {
      return subDecoder.decode(to, from, fromLen, rest);
    }

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

    if (fromLen < 2) {
      rest.value = 0;
      return 0;
    }

    this.minBytesPerChar_ = 2;

    let fromIdx = 0;
    const word = ((fromBytes[0] & 0xff) << 8) | (fromBytes[1] & 0xff);

    if (word === byteOrderMark) {
      this.hadByteOrderMark_ = true;
      fromIdx += 2;
      fromLen -= 2;
    } else if (word === swappedByteOrderMark) {
      this.hadByteOrderMark_ = true;
      fromIdx += 2;
      fromLen -= 2;
      this.swapBytes_ = true;
    }

    if (this.hadByteOrderMark_ || !this.subCodingSystem_) {
      this.subCodingSystem_ = new UTF16CodingSystem();
    }

    this.subDecoder_ = new Owner<Decoder>(this.subCodingSystem_.makeDecoder(this.swapBytes_));
    this.minBytesPerChar_ = this.subDecoder_.pointer()?.minBytesPerChar() || 2;

    // Adjust from to skip the BOM bytes we consumed
    const adjustedFrom = fromBytes.slice(fromIdx);
    const subRest = { value: 0 };
    const result = this.subDecoder_.pointer()?.decode(to, adjustedFrom, fromLen, subRest) || 0;
    rest.value = fromIdx + subRest.value;
    return result;
  }

  convertOffset(n: { value: number }): Boolean {
    const subDecoder = this.subDecoder_.pointer();
    if (subDecoder) {
      subDecoder.convertOffset(n);
    }
    if (this.hadByteOrderMark_) {
      n.value += 2;
    }
    return true;
  }
}

class UnicodeEncoder extends Encoder {
  private subEncoder_: Owner<Encoder>;

  constructor() {
    super();
    const utf16 = new UTF16CodingSystem();
    this.subEncoder_ = new Owner<Encoder>(utf16.makeEncoder());
  }

  startFile(sb: OutputByteStream | null): void {
    if (!sb) return;

    // Write byte order mark
    const n = byteOrderMark;
    sb.sputc((n >> 8) & 0xff);
    sb.sputc(n & 0xff);
  }

  output(s: number[], n: number, sb: OutputByteStream | null): void {
    const subEncoder = this.subEncoder_.pointer();
    if (subEncoder) {
      subEncoder.output(s, n, sb);
    }
  }
}

export class UnicodeCodingSystem extends CodingSystem {
  private sub_: InputCodingSystem | null;

  constructor(sub: InputCodingSystem | null = null) {
    super();
    this.sub_ = sub;
  }

  makeDecoder(): Decoder {
    return new UnicodeDecoder(this.sub_);
  }

  makeEncoder(): Encoder {
    return new UnicodeEncoder();
  }
}
