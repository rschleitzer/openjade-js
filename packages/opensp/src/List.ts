// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { IList } from './IList';
import { Link } from './Link';
import { IListIter } from './IListIter';

export class ListItem<T> extends Link {
  value: T;

  constructor(v: T) {
    super();
    this.value = v;
  }
}

export class List<T> {
  private list_: IList<ListItem<T>>;

  constructor() {
    this.list_ = new IList<ListItem<T>>();
  }

  append(item: T): void {
    this.list_.append(new ListItem<T>(item));
  }

  insert(item: T): void {
    this.list_.insert(new ListItem<T>(item));
  }

  head(): T {
    const h = this.list_.head();
    if (!h) {
      throw new Error('List is empty');
    }
    return h.value;
  }

  remove(value: T): void {
    const iter = new IListIter<ListItem<T>>(this.list_);
    while (!iter.done()) {
      const cur = iter.cur();
      if (cur && cur.value === value) {
        this.list_.remove(cur);
        // In C++ we delete cur here, but in TS GC handles it
        break;
      }
      iter.next();
    }
  }

  get(): T {
    const p = this.list_.get();
    if (!p) {
      throw new Error('List is empty');
    }
    const temp = p.value;
    // In C++ we delete p here, but in TS GC handles it
    return temp;
  }

  empty(): boolean {
    return this.list_.empty();
  }
}

export class ListIter<T> {
  private iter_: IListIter<ListItem<T>>;

  constructor(list: List<T>) {
    this.iter_ = new IListIter<ListItem<T>>((list as any).list_);
  }

  cur(): T | null {
    const item = this.iter_.cur();
    return item ? item.value : null;
  }

  next(): void {
    this.iter_.next();
  }

  done(): boolean {
    return this.iter_.done();
  }
}
