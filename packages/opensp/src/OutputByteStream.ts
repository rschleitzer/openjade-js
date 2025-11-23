// Copyright (c) 1997 James Clark
// See the file COPYING for copying permission.

import { Link } from './Link';
import { String as StringOf } from './StringOf';
import { Boolean } from './Boolean';
import * as fs from 'fs';

export abstract class OutputByteStream extends Link {
  protected ptr_: number;
  protected end_: number;

  constructor() {
    super();
    this.ptr_ = 0;
    this.end_ = 0;
  }

  abstract flush(): void;
  abstract flushBuf(c: number): void;

  getBufferPtr(): number {
    return this.ptr_;
  }

  getBufferSize(): number {
    return this.end_ - this.ptr_;
  }

  usedBuffer(n: number): void {
    this.ptr_ += n;
  }

  sputc(c: number): void {
    if (this.ptr_ < this.end_) {
      this.ptr_++;
    } else {
      this.flushBuf(c);
    }
  }

  sputn(s: string | number[], n: number): void {
    for (let i = 0; i < n; i++) {
      const ch = typeof s === 'string' ? s.charCodeAt(i) : s[i];
      this.sputc(ch);
    }
  }

  write(c: number): OutputByteStream {
    this.sputc(c);
    return this;
  }

  writeString(s: string): OutputByteStream {
    for (let i = 0; i < s.length; i++) {
      this.sputc(s.charCodeAt(i));
    }
    return this;
  }

  writeNumber(n: number): OutputByteStream {
    return this.writeString(n.toString());
  }

  writeStringOf(s: StringOf<number>): OutputByteStream {
    const data = s.data();
    if (data) {
      this.sputn(data, s.size());
    }
    return this;
  }
}

export class StrOutputByteStream extends OutputByteStream {
  private buf_: StringOf<number>;

  constructor() {
    super();
    this.buf_ = new StringOf<number>();
  }

  extractString(str: StringOf<number>): void {
    if (this.ptr_) {
      this.buf_.resize(this.ptr_);
    }
    str.resize(0);
    this.buf_.swap(str);
    this.ptr_ = this.end_ = 0;
  }

  flush(): void {
    // No-op for string streams
  }

  flushBuf(c: number): void {
    if (this.ptr_ === 0) {
      this.buf_.resize(16);
      this.ptr_ = 0;
    } else {
      const i = this.ptr_;
      this.buf_.resize(this.buf_.size() * 2);
      this.ptr_ = i;
    }
    const data = this.buf_.data();
    if (data) {
      this.end_ = this.buf_.size();
      data[this.ptr_++] = c;
    }
  }
}

export class FileOutputByteStream extends OutputByteStream {
  private buf_: StringOf<number>;
  private fd_: number;
  private closeFd_: Boolean;

  constructor();
  constructor(fd: number, closeFd?: Boolean);
  constructor(fd?: number, closeFd: Boolean = true) {
    super();
    this.buf_ = new StringOf<number>();
    this.fd_ = -1;
    this.closeFd_ = true;
    if (fd !== undefined) {
      this.attach(fd, closeFd);
    }
  }

  open(filename: string): Boolean {
    try {
      const fd = fs.openSync(filename, 'w', 0o666);
      return this.attach(fd);
    } catch (e) {
      return false;
    }
  }

  attach(fd: number, closeFd: Boolean = true): Boolean {
    this.close();
    this.fd_ = fd;
    this.closeFd_ = closeFd;
    return this.fd_ >= 0;
  }

  close(): Boolean {
    if (this.fd_ < 0) {
      return false;
    }
    this.flush();
    const fd = this.fd_;
    this.fd_ = -1;
    if (!this.closeFd_) {
      return true;
    }
    try {
      fs.closeSync(fd);
      return true;
    } catch (e) {
      return false;
    }
  }

  flush(): void {
    const bufSize = 8192;
    if (this.buf_.size() === 0) {
      if (this.fd_ < 0) {
        return;
      }
      this.buf_.resize(bufSize);
      this.ptr_ = 0;
      this.end_ = this.buf_.size();
    }
    const n = this.ptr_;
    const data = this.buf_.data();
    if (data && n > 0) {
      const buffer = Buffer.from(data.slice(0, n));
      try {
        fs.writeSync(this.fd_, buffer);
      } catch (e) {
        // Write error - ignore
      }
    }
    this.ptr_ = 0;
  }

  flushBuf(c: number): void {
    this.flush();
    const data = this.buf_.data();
    if (data) {
      data[this.ptr_++] = c;
    }
  }
}
