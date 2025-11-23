// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Owner } from './Owner';

// Interface for types that can be copied
export interface Copyable<T> {
  copy(): T;
}

export class CopyOwner<T extends Copyable<T>> extends Owner<T> {
  constructor();
  constructor(p: T | null);
  constructor(o: CopyOwner<T>);
  constructor(pOrO?: T | null | CopyOwner<T>) {
    if (pOrO === undefined) {
      super();
    } else if (pOrO instanceof CopyOwner) {
      // CopyOwner(const CopyOwner<T> &o)
      const o = pOrO;
      const ptr = o.pointer();
      super(ptr ? ptr.copy() : null);
    } else {
      // CopyOwner(T *p)
      super(pOrO);
    }
  }

  assignCopy(o: CopyOwner<T>): void {
    const ptr = o.pointer();
    super.assign(ptr ? ptr.copy() : null);
  }

  assign(p: T | null): void {
    super.assign(p);
  }
}
