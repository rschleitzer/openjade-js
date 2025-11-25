// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

// A pointer that owns the object pointed to.
// T must be of class type.
// In TypeScript, ownership semantics are handled by GC, but we preserve the API.

export class Owner<T> {
  protected p_: T | null;

  constructor();
  constructor(p: T | null);
  constructor(p?: T | null) {
    if (p === undefined) {
      this.p_ = null;
    } else {
      this.p_ = p;
    }
  }

  assign(p: T | null): void {
    // if (p_) del();
    // In TypeScript, old object will be GC'd automatically
    this.p_ = p;
  }

  // operator int() const { return p_ != 0; }
  isSet(): boolean {
    return this.p_ !== null;
  }

  pointer(): T | null {
    return this.p_;
  }

  // T *operator->() const { return p_; }
  deref(): T {
    return this.p_!;
  }

  // T &operator*() const { return *p_; }
  get(): T {
    return this.p_!;
  }

  swap(x: Owner<T>): void {
    const tem = this.p_;
    this.p_ = x.p_;
    x.p_ = tem;
  }

  extract(): T | null {
    const tem = this.p_;
    this.p_ = null;
    return tem;
  }

  clear(): void {
    // if (p_) del();
    // In TypeScript, GC handles deletion
    this.p_ = null;
  }

  // Same as assign but named reset for compatibility with smart pointers
  reset(p: T | null = null): void {
    this.p_ = p;
  }
}
