// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Link } from './Link';
import { IListBase } from './IListBase';

export class IListIterBase {
  private p_: Link | null;

  constructor(list: IListBase) {
    this.p_ = list.head();
  }

  done(): boolean {
    return this.p_ === null;
  }

  cur(): Link | null {
    return this.p_;
  }

  next(): void {
    if (this.p_) {
      this.p_ = this.p_.next_;
    }
  }
}
