// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { Resource } from './Resource';

// T must have Resource as a public base class
// T may be an incomplete type

export class Ptr<T extends Resource> {
  private ptr_: T | null;

  constructor();
  constructor(ptr: T | null);
  constructor(p: Ptr<T>);
  constructor(ptrOrP?: T | null | Ptr<T>) {
    if (ptrOrP === undefined) {
      // Ptr()
      this.ptr_ = null;
    } else if (ptrOrP instanceof Ptr) {
      // Ptr(const Ptr<T> &p)
      const p = ptrOrP;
      this.ptr_ = p.ptr_;
      if (p.ptr_) {
        p.ptr_.ref();
      }
    } else {
      // Ptr(T *ptr)
      const ptr = ptrOrP;
      this.ptr_ = ptr;
      if (this.ptr_) {
        this.ptr_.ref();
      }
    }
  }

  // Ptr<T> &operator=(const Ptr<T> &)
  assign(p: Ptr<T>): Ptr<T>;
  assign(p: T | null): Ptr<T>;
  assign(pOrPtr: Ptr<T> | T | null): Ptr<T> {
    if (pOrPtr instanceof Ptr) {
      // operator=(const Ptr<T> &p)
      const p = pOrPtr;
      if (p.ptr_) {
        p.ptr_.ref();
      }
      if (this.ptr_ && this.ptr_.unref()) {
        // delete ptr_;
        // Let GC handle it
      }
      this.ptr_ = p.ptr_;
      return this;
    } else {
      // operator=(T *p)
      const p = pOrPtr;
      if (p) {
        p.ref();
      }
      if (this.ptr_ && this.ptr_.unref()) {
        // delete ptr_;
        // Let GC handle it
      }
      this.ptr_ = p;
      return this;
    }
  }

  pointer(): T | null {
    return this.ptr_;
  }

  // T *operator->() const { return ptr_; }
  deref(): T {
    return this.ptr_!;
  }

  // T &operator*() const { return *ptr_; }
  get(): T {
    return this.ptr_!;
  }

  swap(p: Ptr<T>): void {
    const tem = p.ptr_;
    p.ptr_ = this.ptr_;
    this.ptr_ = tem;
  }

  isNull(): Boolean {
    return this.ptr_ === null;
  }

  clear(): void {
    if (this.ptr_) {
      if (this.ptr_.unref()) {
        // delete ptr_;
        // Let GC handle it
      }
      this.ptr_ = null;
    }
  }

  // Boolean operator==(const Ptr<T> &p) const
  equals(p: Ptr<T> | T | null): Boolean {
    if (p instanceof Ptr) {
      return this.ptr_ === p.ptr_;
    } else {
      return this.ptr_ === p;
    }
  }

  // Boolean operator!=(const Ptr<T> &p) const
  notEquals(p: Ptr<T> | T | null): Boolean {
    return !this.equals(p);
  }
}

export class ConstPtr<T extends Resource> {
  private base_: Ptr<T>;

  constructor();
  constructor(ptr: T | null);
  constructor(p: Ptr<T>);
  constructor(p: ConstPtr<T>);
  constructor(ptrOrP?: T | null | Ptr<T> | ConstPtr<T>) {
    if (ptrOrP === undefined) {
      this.base_ = new Ptr<T>();
    } else if (ptrOrP instanceof ConstPtr) {
      this.base_ = new Ptr<T>((ptrOrP as any).base_);
    } else if (ptrOrP instanceof Ptr) {
      this.base_ = new Ptr<T>(ptrOrP);
    } else {
      this.base_ = new Ptr<T>(ptrOrP);
    }
  }

  assign(p: Ptr<T> | ConstPtr<T> | T | null): ConstPtr<T> {
    if (p instanceof ConstPtr) {
      this.base_.assign((p as any).base_);
    } else if (p instanceof Ptr) {
      this.base_.assign(p);
    } else {
      this.base_.assign(p);
    }
    return this;
  }

  pointer(): T | null {
    return this.base_.pointer();
  }

  deref(): T {
    return this.base_.deref();
  }

  get(): T {
    return this.base_.get();
  }

  swap(p: ConstPtr<T>): void {
    this.base_.swap((p as any).base_);
  }

  isNull(): Boolean {
    return this.base_.isNull();
  }

  clear(): void {
    this.base_.clear();
  }

  equals(p: Ptr<T> | ConstPtr<T>): Boolean {
    if (p instanceof ConstPtr) {
      return this.base_.equals((p as any).base_);
    } else {
      return this.base_.equals(p);
    }
  }

  notEquals(p: Ptr<T> | ConstPtr<T>): Boolean {
    return !this.equals(p);
  }
}
