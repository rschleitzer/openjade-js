// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { MessageArg, OtherMessageArg } from './MessageArg';

// C++ uses RTTI_DEF1(ErrnoMessageArg, OtherMessageArg) for runtime type info
// TypeScript has native instanceof support, so we don't need explicit RTTI

export class ErrnoMessageArg extends OtherMessageArg {
  private errno_: number;

  constructor(errnum: number) {
    super();
    this.errno_ = errnum;
  }

  copy(): MessageArg {
    return new ErrnoMessageArg(this.errno_);
  }

  // errno might be a macro in C so we use a different name
  errnum(): number {
    return this.errno_;
  }
}
