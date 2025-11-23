// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { IListBase } from './IListBase';
import { Link } from './Link';
import { Boolean } from './Boolean';

// This owns the objects that are put in it.

export class IList<T extends Link> {
  private base_: IListBase;

  constructor();
  constructor(p: T);
  constructor(p?: T) {
    if (p === undefined) {
      this.base_ = new IListBase();
    } else {
      this.base_ = new IListBase(p);
    }
  }

  append(p: T): void {
    this.base_.append(p);
  }

  insert(p: T): void {
    this.base_.insert(p);
  }

  remove(p: T): void {
    this.base_.remove(p);
  }

  swap(list: IList<T>): void {
    this.base_.swap(list.base_);
  }

  head(): T | null {
    return this.base_.head() as T | null;
  }

  get(): T | null {
    return this.base_.get() as T | null;
  }

  clear(): void {
    this.base_.clear();
  }

  empty(): Boolean {
    return this.base_.empty();
  }
}
