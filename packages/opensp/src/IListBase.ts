// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Link } from './Link';
import { Boolean } from './Boolean';

export class IListBase {
  private head_: Link | null;

  constructor();
  constructor(head: Link | null);
  constructor(head?: Link | null) {
    if (head === undefined) {
      this.head_ = null;
    } else {
      this.head_ = head;
    }
  }

  append(p: Link): void {
    // Link **pp;
    // for (pp = &head_; *pp; pp = &(*pp)->next_)
    //   ;
    // *pp = p;
    if (this.head_ === null) {
      this.head_ = p;
    } else {
      let current = this.head_;
      while (current.next_ !== null) {
        current = current.next_;
      }
      current.next_ = p;
    }
  }

  insert(p: Link): void {
    p.next_ = this.head_;
    this.head_ = p;
  }

  head(): Link | null {
    return this.head_;
  }

  empty(): Boolean {
    return this.head_ === null;
  }

  get(): Link | null {
    const tem = this.head_;
    if (this.head_) {
      this.head_ = this.head_.next_;
    }
    return tem;
  }

  remove(p: Link): void {
    // for (Link **pp = &head_; *pp; pp = &(*pp)->next_)
    //   if (*pp == p) {
    //     *pp = p->next_;
    //     break;
    //   }
    if (this.head_ === p) {
      this.head_ = p.next_;
      return;
    }
    let current = this.head_;
    while (current && current.next_) {
      if (current.next_ === p) {
        current.next_ = p.next_;
        break;
      }
      current = current.next_;
    }
  }

  swap(list: IListBase): void {
    const tem = this.head_;
    this.head_ = list.head_;
    list.head_ = tem;
  }

  clear(): void {
    while (!this.empty()) {
      // delete get();
      // In TypeScript, just remove from list - GC will handle it
      this.get();
    }
  }
}
