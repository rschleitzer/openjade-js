// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Hash } from './Hash';
import { StringC } from './StringC';
import { Named } from './Named';
import { OwnerTable, OwnerTableIter } from './OwnerTable';
import { HashFunction, KeyFunction } from './PointerTable';

export class NamedTableKeyFunction implements KeyFunction<Named, StringC> {
  key(obj: Named): StringC {
    return obj.name();
  }
}

export class NamedTable<T extends Named> {
  private table_: OwnerTable<T, StringC, Hash, NamedTableKeyFunction>;

  constructor() {
    this.table_ = new OwnerTable<T, StringC, Hash, NamedTableKeyFunction>(
      new Hash(),
      new NamedTableKeyFunction()
    );
  }

  insert(p: T): T | null {
    return this.table_.insert(p) as T | null;
  }

  lookup(str: StringC): T | null {
    return this.table_.lookup(str) as T | null;
  }

  remove(str: StringC): T | null {
    return this.table_.remove(str) as T | null;
  }

  count(): number {
    return this.table_.count();
  }

  clear(): void {
    this.table_.clear();
  }

  swap(to: NamedTable<T>): void {
    this.table_.swap(to.table_);
  }
}

export class NamedTableIter<T extends Named> {
  private iter_: OwnerTableIter<T, StringC, Hash, NamedTableKeyFunction>;

  constructor(table: NamedTable<T>) {
    this.iter_ = new OwnerTableIter<T, StringC, Hash, NamedTableKeyFunction>(
      (table as any).table_
    );
  }

  next(): T | null {
    return this.iter_.next() as T | null;
  }
}

export class ConstNamedTableIter<T extends Named> {
  private iter_: OwnerTableIter<T, StringC, Hash, NamedTableKeyFunction>;

  constructor(table: NamedTable<T>) {
    this.iter_ = new OwnerTableIter<T, StringC, Hash, NamedTableKeyFunction>(
      (table as any).table_
    );
  }

  next(): T | null {
    return this.iter_.next() as T | null;
  }
}
