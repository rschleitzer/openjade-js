// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { Hash } from './Hash';
import { StringC } from './StringC';

// Simplified TypeScript implementation using native Map
// Preserves the C++ API but uses JavaScript Map internally

export interface Hashable {
  // Types that can be hashed must provide a way to get a hash key
  toString(): string;
}

export class HashTable<K extends Hashable, V> {
  private table_: Map<string, { key: K; value: V }>;

  constructor() {
    this.table_ = new Map();
  }

  insert(key: K, value: V, replace: Boolean = true): void {
    const hashKey = this.getHashKey(key);
    if (replace || !this.table_.has(hashKey)) {
      this.table_.set(hashKey, { key, value });
    }
  }

  lookup(key: K): V | null {
    const hashKey = this.getHashKey(key);
    const item = this.table_.get(hashKey);
    return item ? item.value : null;
  }

  count(): number {
    return this.table_.size;
  }

  clear(): void {
    this.table_.clear();
  }

  private getHashKey(key: K): string {
    // For StringC, use the Hash function
    if (key instanceof String || (key as any).data) {
      const h = Hash.hash(key as any as StringC);
      return h.toString();
    }
    // For other types, use toString()
    return key.toString();
  }
}

export class HashTableIter<K extends Hashable, V> {
  private iter_: Iterator<[string, { key: K; value: V }]>;
  private done_: boolean;

  constructor(table: HashTable<K, V>) {
    this.iter_ = (table as any).table_.entries();
    this.done_ = false;
  }

  next(): { key: K; value: V } | null {
    const result = this.iter_.next();
    if (result.done) {
      this.done_ = true;
      return null;
    }
    return result.value[1];
  }
}
