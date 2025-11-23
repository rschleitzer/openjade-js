// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { Boolean } from './Boolean';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { OutputByteStream, StrOutputByteStream } from './OutputByteStream';

export abstract class Decoder {
  protected minBytesPerChar_: number;

  constructor(minBytesPerChar: number = 1) {
    this.minBytesPerChar_ = minBytesPerChar;
  }

  abstract decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number;

  convertOffset(offset: { value: number }): Boolean {
    return false;
  }

  minBytesPerChar(): number {
    return this.minBytesPerChar_;
  }
}

export abstract class Encoder {
  abstract output(chars: Char[], n: number, stream: OutputByteStream | null): void;

  startFile(stream: OutputByteStream | null): void {
    // Default: no-op
  }

  handleUnencodable(c: Char, stream: OutputByteStream | null): void {
    // Default: no-op
  }

  setUnencodableHandler(handler: Encoder.Handler | null): void {
    // Default: no-op
  }
}

export namespace Encoder {
  export abstract class Handler {
    abstract handleUnencodable(c: Char, stream: OutputByteStream | null): void;
  }
}

export abstract class RecoveringEncoder extends Encoder {
  private unencodableHandler_: Encoder.Handler | null;

  constructor() {
    super();
    this.unencodableHandler_ = null;
  }

  abstract output(chars: Char[], n: number, stream: OutputByteStream | null): void;

  handleUnencodable(c: Char, stream: OutputByteStream | null): void {
    if (this.unencodableHandler_) {
      this.unencodableHandler_.handleUnencodable(c, stream);
    }
  }

  setUnencodableHandler(handler: Encoder.Handler | null): void {
    this.unencodableHandler_ = handler;
  }
}

export abstract class InputCodingSystem {
  // One of these has to be overwritten
  makeDecoder(): Decoder;
  makeDecoder(lsbFirst: Boolean): Decoder;
  makeDecoder(lsbFirst: Boolean, lswFirst: Boolean): Decoder;
  makeDecoder(lsbFirst?: Boolean, lswFirst?: Boolean): Decoder {
    if (lswFirst !== undefined) {
      return this.makeDecoder(lsbFirst);
    }
    if (lsbFirst !== undefined) {
      return this.makeDecoder();
    }
    // Must be overridden
    throw new Error('makeDecoder must be implemented');
  }

  convertIn(s: string): StringC {
    const decoder = this.makeDecoder();
    const str = new StringOf<Char>();
    str.resize(s.length);
    const rest = { value: 0 };
    const data = str.data();
    if (data) {
      const len = decoder.decode(data, s, s.length, rest);
      str.resize(len);
    }
    return str;
  }

  isIdentity(): Boolean {
    return false;
  }
}

export abstract class OutputCodingSystem {
  abstract makeEncoder(): Encoder;

  fixedBytesPerChar(): number {
    return 0;
  }

  convertOut(str: StringC): StringOf<number> {
    const encoder = this.makeEncoder();
    const stream = new StrOutputByteStream();
    const data = str.data();
    if (data) {
      encoder.output(data, str.size(), stream);
    }
    const result = new StringOf<number>();
    stream.extractString(result);
    // Add null terminator
    const resultData = result.data();
    if (resultData) {
      resultData.push(0);
      result.resize(result.size() + 1);
    }
    return result;
  }
}

export abstract class CodingSystem extends InputCodingSystem {
  abstract makeEncoder(): Encoder;
}
