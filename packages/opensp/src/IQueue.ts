// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { Link } from './Link';

export class IQueueBase {
  private last_: Link | null;

  constructor() {
    this.last_ = null;
  }

  empty(): Boolean {
    return this.last_ === null;
  }

  get(): Link | null {
    if (!this.last_) {
      return null;
    }
    const tem = this.last_.next_;
    if (tem === this.last_) {
      this.last_ = null;
    } else {
      this.last_.next_ = tem ? tem.next_ : null;
    }
    return tem;
  }

  append(p: Link): void {
    if (this.last_) {
      p.next_ = this.last_.next_;
      this.last_ = this.last_.next_ = p;
    } else {
      this.last_ = p.next_ = p;
    }
  }

  swap(withQueue: IQueueBase): void {
    const tem = this.last_;
    this.last_ = withQueue.last_;
    withQueue.last_ = tem;
  }
}

export class IQueue<T extends Link> {
  private base_: IQueueBase;

  constructor() {
    this.base_ = new IQueueBase();
  }

  clear(): void {
    // In C++ this deletes all items
    // In TypeScript, GC handles cleanup
    while (!this.base_.empty()) {
      this.base_.get();
    }
  }

  get(): T | null {
    return this.base_.get() as T | null;
  }

  append(p: T): void {
    this.base_.append(p);
  }

  empty(): Boolean {
    return this.base_.empty();
  }

  swap(to: IQueue<T>): void {
    this.base_.swap(to.base_);
  }
}
