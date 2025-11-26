// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Vector } from './Vector';
import { Boolean } from './Boolean';

// P = Pointer type (e.g., T* or Ptr<T>)
// K = Key type (e.g., StringC)
// HF = Hash function (e.g., Hash)
// KF = Key function (extracts key from object)

export interface HashFunction<K> {
  hash(key: K): number;
}

export interface KeyFunction<P, K> {
  key(obj: P): K;
}

// Interface for keys that support equality comparison
export interface Equatable<T> {
  equals(other: T): boolean;
}

// Helper to check equality - uses equals() if available, otherwise ===
function keysEqual<K>(a: K, b: K): boolean {
  if (a && typeof (a as any).equals === 'function') {
    return (a as any).equals(b);
  }
  return a === b;
}

export class PointerTable<P, K, HF extends HashFunction<K>, KF extends KeyFunction<any, K>> {
  protected used_: number;
  protected usedLimit_: number;
  protected vec_: Vector<P | null>;
  protected null_: P | null;
  protected hashFunc_: HF;
  protected keyFunc_: KF;

  constructor(hashFunc: HF, keyFunc: KF) {
    this.used_ = 0;
    this.usedLimit_ = 0;
    this.vec_ = new Vector<P | null>();
    this.null_ = null;
    this.hashFunc_ = hashFunc;
    this.keyFunc_ = keyFunc;
  }

  protected startIndex(k: K): number {
    return this.hashFunc_.hash(k) & (this.vec_.size() - 1);
  }

  protected nextIndex(i: number): number {
    return i === 0 ? this.vec_.size() - 1 : i - 1;
  }

  insert(p: P, replace: Boolean = false): P | null {
    let h: number;
    if (this.vec_.size() === 0) {
      this.vec_.assign(8, null);
      this.usedLimit_ = 4;
      h = this.startIndex(this.keyFunc_.key(p));
    } else {
      for (h = this.startIndex(this.keyFunc_.key(p)); this.vec_.get(h) !== null; h = this.nextIndex(h)) {
        const vecH = this.vec_.get(h);
        if (vecH !== null && keysEqual(this.keyFunc_.key(vecH), this.keyFunc_.key(p))) {
          if (replace) {
            const tem = this.vec_.get(h);
            this.vec_.set(h, p);
            return tem;
          } else {
            return this.vec_.get(h);
          }
        }
      }
      if (this.used_ >= this.usedLimit_) {
        if (this.vec_.size() > Number.MAX_SAFE_INTEGER / 2) {
          if (this.usedLimit_ === this.vec_.size() - 1) {
            throw new Error('PointerTable overflow');
          } else {
            this.usedLimit_ = this.vec_.size() - 1;
          }
        } else {
          // rehash
          const oldVec = new Vector<P | null>();
          oldVec.assign(this.vec_.size() * 2, null);
          oldVec.swap(this.vec_);
          this.usedLimit_ = this.vec_.size() / 2;
          for (let i = 0; i < oldVec.size(); i++) {
            if (oldVec.get(i) !== null) {
              let j: number;
              const oldVecI = oldVec.get(i);
              if (oldVecI !== null) {
                for (j = this.startIndex(this.keyFunc_.key(oldVecI));
                     this.vec_.get(j) !== null;
                     j = this.nextIndex(j))
                  ;
                this.vec_.set(j, oldVec.get(i));
              }
            }
          }
          for (h = this.startIndex(this.keyFunc_.key(p)); this.vec_.get(h) !== null; h = this.nextIndex(h))
            ;
        }
      }
    }
    this.used_++;
    this.vec_.set(h, p);
    return null;
  }

  lookup(k: K): P | null {
    if (this.used_ > 0) {
      for (let i = this.startIndex(k); this.vec_.get(i) !== null; i = this.nextIndex(i)) {
        const vecI = this.vec_.get(i);
        if (vecI !== null && keysEqual(this.keyFunc_.key(vecI), k)) {
          return this.vec_.get(i);
        }
      }
    }
    return this.null_;
  }

  remove(k: K): P | null {
    if (this.used_ > 0) {
      for (let i = this.startIndex(k); this.vec_.get(i) !== null; i = this.nextIndex(i)) {
        const vecI = this.vec_.get(i);
        if (vecI !== null && keysEqual(this.keyFunc_.key(vecI), k)) {
          const p = this.vec_.get(i);
          do {
            this.vec_.set(i, null);
            let j = i;
            let r: number;
            do {
              i = this.nextIndex(i);
              if (this.vec_.get(i) === null) {
                break;
              }
              const vecI = this.vec_.get(i);
              if (vecI !== null) {
                r = this.startIndex(this.keyFunc_.key(vecI));
              } else {
                break;
              }
            } while ((i <= r && r < j) || (r < j && j < i) || (j < i && i <= r));
            this.vec_.set(j, this.vec_.get(i));
          } while (this.vec_.get(i) !== null);
          --this.used_;
          return p;
        }
      }
    }
    return null;
  }

  count(): number {
    return this.used_;
  }

  clear(): void {
    this.vec_.clear();
    this.used_ = 0;
    this.usedLimit_ = 0;
  }

  swap(to: PointerTable<P, K, HF, KF>): void {
    this.vec_.swap(to.vec_);
    let tem = to.used_;
    to.used_ = this.used_;
    this.used_ = tem;
    tem = to.usedLimit_;
    to.usedLimit_ = this.usedLimit_;
    this.usedLimit_ = tem;
  }
}

export class PointerTableIter<P, K, HF extends HashFunction<K>, KF extends KeyFunction<any, K>> {
  private tablePtr_: PointerTable<P, K, HF, KF>;
  private i_: number;

  constructor(table: PointerTable<P, K, HF, KF>) {
    this.tablePtr_ = table;
    this.i_ = 0;
  }

  next(): P | null {
    for (; this.i_ < this.tablePtr_['vec_'].size(); this.i_++) {
      if (this.tablePtr_['vec_'].get(this.i_) !== null) {
        return this.tablePtr_['vec_'].get(this.i_++);
      }
    }
    return this.tablePtr_['null_'];
  }
}
