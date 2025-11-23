// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { NamedResource } from './NamedResource';
import { PointerTable, PointerTableIter, HashFunction, KeyFunction } from './PointerTable';
import { StringC } from './StringC';
import { Hash } from './Hash';
import { Ptr, ConstPtr } from './Ptr';
import { Boolean } from './Boolean';

export class NamedResourceKeyFunction implements KeyFunction<Ptr<NamedResource>, StringC> {
  key(p: Ptr<NamedResource>): StringC {
    const obj = p.pointer();
    if (!obj) {
      throw new Error('Null pointer in NamedResourceKeyFunction');
    }
    return obj.name();
  }
}

export class NamedResourceTable<T extends NamedResource> {
  private table_: PointerTable<Ptr<NamedResource>, StringC, Hash, NamedResourceKeyFunction>;

  constructor() {
    this.table_ = new PointerTable<Ptr<NamedResource>, StringC, Hash, NamedResourceKeyFunction>(
      new Hash(),
      new NamedResourceKeyFunction()
    );
  }

  insert(p: Ptr<T>, replace: Boolean = false): Ptr<T> | null {
    const result = this.table_.insert(p as Ptr<NamedResource>, replace);
    return result as Ptr<T> | null;
  }

  lookup(str: StringC): Ptr<T> | null {
    const result = this.table_.lookup(str);
    return result as Ptr<T> | null;
  }

  lookupConst(str: StringC): ConstPtr<T> | null {
    const result = this.table_.lookup(str);
    return result as unknown as ConstPtr<T> | null;
  }

  lookupTemp(str: StringC): T | null {
    const result = this.table_.lookup(str);
    return result ? result.pointer() as T : null;
  }

  remove(str: StringC): Ptr<T> | null {
    const result = this.table_.remove(str);
    return result as Ptr<T> | null;
  }

  count(): number {
    return this.table_.count();
  }

  clear(): void {
    this.table_.clear();
  }

  swap(to: NamedResourceTable<T>): void {
    this.table_.swap(to.table_);
  }
}

export class NamedResourceTableIter<T extends NamedResource> {
  private iter_: PointerTableIter<Ptr<NamedResource>, StringC, Hash, NamedResourceKeyFunction>;

  constructor(table: NamedResourceTable<T>) {
    this.iter_ = new PointerTableIter<Ptr<NamedResource>, StringC, Hash, NamedResourceKeyFunction>(
      (table as any).table_
    );
  }

  next(): Ptr<T> | null {
    const result = this.iter_.next();
    return result as Ptr<T> | null;
  }
}

export class ConstNamedResourceTableIter<T extends NamedResource> {
  private iter_: PointerTableIter<Ptr<NamedResource>, StringC, Hash, NamedResourceKeyFunction>;

  constructor(table: NamedResourceTable<T>) {
    this.iter_ = new PointerTableIter<Ptr<NamedResource>, StringC, Hash, NamedResourceKeyFunction>(
      (table as any).table_
    );
  }

  next(): ConstPtr<T> | null {
    const result = this.iter_.next();
    return result as unknown as ConstPtr<T> | null;
  }

  nextTemp(): T | null {
    const result = this.iter_.next();
    return result ? result.pointer() as T : null;
  }
}
