// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { IListIterBase } from './IListIterBase';
import { IList } from './IList';
import { Link } from './Link';

export class IListIter<T extends Link> {
  private iter_: IListIterBase;

  constructor(list: IList<T>) {
    // Cast to any to access the base IListBase
    this.iter_ = new IListIterBase(list as any);
  }

  cur(): T | null {
    return this.iter_.cur() as T | null;
  }

  next(): void {
    this.iter_.next();
  }

  done(): boolean {
    return this.iter_.done();
  }
}
