// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { Link } from './Link';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Owner } from './Owner';
import { OutputByteStream } from './OutputByteStream';
import { Encoder, OutputCodingSystem } from './CodingSystem';
import { ASSERT } from './macros';

export type Escaper = (stream: OutputCharStream, c: Char) => void;

export abstract class OutputCharStream extends Link {
  static readonly Newline = Symbol('newline');

  protected ptr_: Uint32Array | null;
  protected end_: number;
  protected ptrOffset_: number;  // Made protected so derived classes can reset it

  constructor() {
    super();
    this.ptr_ = null;
    this.end_ = 0;
    this.ptrOffset_ = 0;
  }

  abstract flush(): void;
  protected abstract flushBuf(c: Char): void;

  setEscaper(escaper: Escaper): void {
    // Default implementation does nothing
  }

  put(c: Char): OutputCharStream {
    if (this.ptr_ && this.ptrOffset_ < this.end_) {
      this.ptr_[this.ptrOffset_++] = c;
    } else {
      this.flushBuf(c);
    }
    return this;
  }

  write(s: Uint32Array | null, n: number): OutputCharStream {
    if (!s) return this;

    let offset = 0;
    while (true) {
      const spare = this.end_ - this.ptrOffset_;
      if (n <= spare) {
        if (this.ptr_) {
          for (let i = 0; i < n; i++) {
            this.ptr_[this.ptrOffset_ + i] = s[offset + i];
          }
          this.ptrOffset_ += n;
        }
        break;
      }
      if (spare > 0 && this.ptr_) {
        for (let i = 0; i < spare; i++) {
          this.ptr_[this.ptrOffset_ + i] = s[offset + i];
        }
        this.ptrOffset_ += spare;
        offset += spare;
        n -= spare;
      }
      n--;
      this.flushBuf(s[offset++]);
    }
    return this;
  }

  putChar(c: string): OutputCharStream {
    return this.put(c.charCodeAt(0));
  }

  putString(s: string): OutputCharStream {
    for (let i = 0; i < s.length; i++) {
      this.put(s.charCodeAt(i));
    }
    return this;
  }

  putStringC(str: StringC): OutputCharStream {
    const data = str.data();
    if (data) {
      return this.write(new Uint32Array(data), str.size());
    }
    return this;
  }

  putUnsignedLong(n: number): OutputCharStream {
    return this.putString(n.toString());
  }

  putInt(n: number): OutputCharStream {
    return this.putString(n.toString());
  }

  putNewline(): OutputCharStream {
    this.put(0x0A); // LINE_TERM1
    return this;
  }
}

export class EncodeOutputCharStream extends OutputCharStream {
  private buf_: Uint32Array | null;
  private byteStream_: OutputByteStream | null;
  private encoder_: Encoder | null;
  private ownedEncoder_: Owner<Encoder>;
  private escaper_: Escaper | null;

  constructor();
  constructor(byteStream: OutputByteStream, codingSystem: OutputCodingSystem);
  constructor(byteStream?: OutputByteStream, codingSystem?: OutputCodingSystem) {
    super();
    this.buf_ = null;
    this.byteStream_ = byteStream ?? null;
    this.escaper_ = null;
    this.ownedEncoder_ = new Owner<Encoder>();

    if (byteStream && codingSystem) {
      this.ownedEncoder_ = new Owner<Encoder>(codingSystem.makeEncoder());
      this.encoder_ = this.ownedEncoder_.pointer();
      if (this.encoder_) {
        this.encoder_.setUnencodableHandler(this.handleUnencodable.bind(this));
        this.allocBuf(codingSystem.fixedBytesPerChar());
        this.encoder_.startFile(byteStream);
      }
    } else {
      this.encoder_ = null;
    }
  }

  open(byteStream: OutputByteStream, codingSystem: OutputCodingSystem): void {
    if (this.byteStream_) {
      this.flush();
    }
    this.byteStream_ = byteStream;
    this.ownedEncoder_ = new Owner<Encoder>(codingSystem.makeEncoder());
    this.encoder_ = this.ownedEncoder_.pointer();
    if (this.encoder_) {
      this.encoder_.setUnencodableHandler(this.handleUnencodable.bind(this));
      this.buf_ = null;
      this.ptr_ = null;
      this.end_ = 0;
      this.allocBuf(codingSystem.fixedBytesPerChar());
      this.encoder_.startFile(byteStream);
    }
  }

  flush(): void {
    if (this.buf_ && this.ptr_ && this.encoder_ && this.byteStream_) {
      if (this.ptrOffset_ > 0) {
        this.encoder_.output(Array.from(this.buf_.subarray(0, this.ptrOffset_)), this.ptrOffset_, this.byteStream_);
        this.ptrOffset_ = 0;
      }
    }
    if (this.byteStream_) {
      this.byteStream_.flush();
    }
  }

  setEscaper(f: Escaper): void {
    this.escaper_ = f;
  }

  protected flushBuf(c: Char): void {
    ASSERT(this.buf_ !== null);
    if (this.buf_ && this.ptr_ && this.encoder_ && this.byteStream_) {
      this.encoder_.output(Array.from(this.buf_.subarray(0, this.ptrOffset_)), this.ptrOffset_, this.byteStream_);
      this.ptrOffset_ = 0;
      this.ptr_[this.ptrOffset_++] = c;
    }
  }

  private allocBuf(bytesPerChar: number): void {
    const blockSize = 16384;  // Increased from 1024 for better I/O batching
    const bufSize = bytesPerChar ? Math.floor(blockSize / bytesPerChar) : blockSize;
    this.buf_ = new Uint32Array(bufSize);
    this.ptr_ = this.buf_;
    this.end_ = bufSize;
  }

  private handleUnencodable(c: Char, byteStream: OutputByteStream | null): void {
    if (this.escaper_ && this.byteStream_) {
      // Note: In C++ this creates a temporary EncodeOutputCharStream with the same encoder
      // For now, we'll just call the escaper with this stream
      this.escaper_(this, c);
    }
  }
}

export class StrOutputCharStream extends OutputCharStream {
  private buf_: Uint32Array | null;
  private bufSize_: number;

  constructor() {
    super();
    this.buf_ = null;
    this.bufSize_ = 0;
    this.sync(0);
  }

  extractString(str: StringC): void {
    if (this.buf_ && this.ptr_) {
      const data: number[] = [];
      for (let i = 0; i < this.ptrOffset_ && i < this.buf_.length; i++) {
        data.push(this.buf_[i]);
      }
      (str as any).assign(data, data.length);
    }
    this.sync(0);
  }

  flush(): void {
    // Nothing to do
  }

  protected flushBuf(c: Char): void {
    const used = this.ptrOffset_;
    const oldSize = this.bufSize_;
    this.bufSize_ = oldSize ? 2 * oldSize : 10;
    const oldBuf = this.buf_;
    this.buf_ = new Uint32Array(this.bufSize_);
    if (oldSize && oldBuf) {
      this.buf_.set(oldBuf.subarray(0, used));
    }
    this.sync(used);
    if (this.ptr_) {
      this.ptr_[this.ptrOffset_++] = c;
    }
  }

  private sync(length: number): void {
    if (!this.buf_) {
      this.buf_ = new Uint32Array(this.bufSize_ || 10);
    }
    this.ptr_ = this.buf_;
    this.ptrOffset_ = length;
    this.end_ = this.bufSize_;
  }
}

export class RecordOutputCharStream extends OutputCharStream {
  private os_: OutputCharStream;
  private buf_: Uint32Array;
  private readonly bufSize_: number = 16384;  // Increased from 1024

  constructor(os: OutputCharStream) {
    super();
    this.os_ = os;
    this.buf_ = new Uint32Array(this.bufSize_);
    this.ptr_ = this.buf_;
    this.end_ = this.bufSize_;
  }

  setEscaper(f: Escaper): void {
    this.os_.setEscaper(f);
  }

  flush(): void {
    this.outputBuf();
    this.os_.flush();
  }

  protected flushBuf(c: Char): void {
    this.outputBuf();
    if (this.ptr_) {
      this.ptr_[this.ptrOffset_++] = c;
    }
  }

  private outputBuf(): void {
    if (!this.ptr_) return;

    let start = 0;
    let p = 0;

    while (p < this.ptrOffset_) {
      const ch = this.buf_[p];
      if (ch === 0x0D) { // '\r' - translate RE to newline
        if (start < p) {
          this.os_.write(this.buf_.subarray(start, p), p - start);
        }
        start = ++p;
        this.os_.putNewline();
      } else if (ch === 0x0A) { // '\n' - ignore RS
        if (start < p) {
          this.os_.write(this.buf_.subarray(start, p), p - start);
        }
        start = ++p;
      } else {
        ++p;
      }
    }

    if (start < p) {
      this.os_.write(this.buf_.subarray(start, p), p - start);
    }

    this.ptr_ = this.buf_;
    this.ptrOffset_ = 0;
    this.end_ = this.bufSize_;
  }
}
