// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { PointerTable, PointerTableIter, HashFunction, KeyFunction } from './PointerTable';

export class OwnerTable<T, K, HF extends HashFunction<K>, KF extends KeyFunction<any, K>>
  extends PointerTable<T, K, HF, KF> {

  constructor(hashFunc: HF, keyFunc: KF) {
    super(hashFunc, keyFunc);
  }

  // In TypeScript, garbage collection handles deletion automatically
  // So destructor is not needed

  clear(): void {
    // In C++, this deletes all owned objects before clearing
    // In TypeScript, GC will handle cleanup
    super.clear();
  }

  swap(x: OwnerTable<T, K, HF, KF>): void {
    super.swap(x);
  }
}

export class OwnerTableIter<T, K, HF extends HashFunction<K>, KF extends KeyFunction<any, K>>
  extends PointerTableIter<T, K, HF, KF> {

  constructor(table: OwnerTable<T, K, HF, KF>) {
    super(table);
  }
}

// CopyOwnerTable supports copying with deep cloning
export interface Copyable {
  copy(): this;
}

export class CopyOwnerTable<T extends Copyable, K, HF extends HashFunction<K>, KF extends KeyFunction<any, K>>
  extends OwnerTable<T, K, HF, KF> {

  constructor(hashFunc: HF, keyFunc: KF) {
    super(hashFunc, keyFunc);
  }

  // Deep copy assignment
  assign(t: CopyOwnerTable<T, K, HF, KF>): void {
    this.clear();
    // Copy all elements with deep clone
    const vec = t['vec_'];
    for (let i = 0; i < vec.size(); i++) {
      const item = vec.get(i);
      if (item) {
        this.insert(item.copy() as T);
      }
    }
  }
}
