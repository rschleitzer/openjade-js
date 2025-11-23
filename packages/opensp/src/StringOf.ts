// Copyright (c) 1994, 1996 James Clark
// See the file COPYING for copying permission.

// The file is called StringOf to distinguish it from string.h on
// case-insensitive file systems.

// This offers a subset of the interface offered by the standard C++
// basic_string class as defined in the Jan 96 WP.
// Code in SP currently assumes that size_type is size_t.

import { Boolean } from './Boolean';

export class String<T> {
  public ptr_: T[] | null;
  public length_: number;
  public alloc_: number;

  // typedef size_t size_type;
  // typedef T *iterator;
  // typedef const T *const_iterator;

  constructor();
  constructor(ptr: T[] | null, length: number);
  constructor(s: String<T>);
  constructor(ptrOrS?: T[] | null | String<T>, length?: number) {
    if (ptrOrS === undefined) {
      // String()
      this.ptr_ = null;
      this.length_ = 0;
      this.alloc_ = 0;
    } else if (ptrOrS instanceof String) {
      // String(const String<T> &s)
      const s = ptrOrS;
      this.length_ = s.length_;
      this.alloc_ = s.length_;
      if (this.length_ > 0 && s.ptr_) {
        // memcpy(ptr_, s.ptr_, length_*sizeof(T));
        this.ptr_ = s.ptr_.slice(0, this.length_) as T[];
      } else {
        this.ptr_ = null;
      }
    } else {
      // String(const T *ptr, size_t length)
      const ptr = ptrOrS;
      this.length_ = length!;
      this.alloc_ = length!;
      if (this.length_ > 0 && ptr) {
        // memcpy(ptr_, ptr, length*sizeof(T));
        this.ptr_ = ptr.slice(0, this.length_) as T[];
      } else {
        this.ptr_ = null;
      }
    }
  }

  // String<T> &operator=(const String<T> &s)
  assign(s: String<T>): String<T>;
  assign(p: T[], n: number): String<T>;
  assign(sOrP: String<T> | T[], n?: number): String<T> {
    if (sOrP instanceof String) {
      // operator=(const String<T> &s)
      const s = sOrP;
      if (s !== this) {
        if (s.length_ > this.alloc_) {
          this.ptr_ = new Array(s.length_);
          this.alloc_ = s.length_;
        }
        // memcpy(ptr_, s.ptr_, s.length_*sizeof(T));
        if (this.ptr_ && s.ptr_ && s.length_ > 0) {
          const src = s.ptr_.slice(0, s.length_);
          for (let i = 0; i < s.length_; i++) {
            this.ptr_[i] = src[i];
          }
        }
        this.length_ = s.length_;
      }
      return this;
    } else {
      // String<T> &String<T>::assign(const T *p, size_t n)
      const p = sOrP;
      if (this.alloc_ < n!) {
        this.ptr_ = new Array(n!);
        this.alloc_ = n!;
      }
      this.length_ = n!;
      // for(T *to = ptr_; n > 0; n--, to++, p++)
      //   *to = *p;
      if (this.ptr_ && n! > 0) {
        const src = p.slice(0, n!);
        for (let i = 0; i < n!; i++) {
          this.ptr_[i] = src[i];
        }
      }
      return this;
    }
  }

  size(): number {
    return this.length_;
  }

  insert(i: number, s: String<T>): String<T> {
    if (this.length_ + s.length_ > this.alloc_) {
      this.grow(s.length_);
    }
    if (!this.ptr_) {
      this.ptr_ = new Array(this.alloc_);
    }
    // for (size_t n = length_ - i; n > 0; n--)
    //   ptr_[i + n - 1 + s.length_] = ptr_[i + n - 1];
    // Shift elements to the right - work backwards to avoid overwriting
    for (let n = this.length_ - i; n > 0; n--) {
      this.ptr_![i + n - 1 + s.length_] = this.ptr_![i + n - 1];
    }
    this.length_ += s.length_;
    // memcpy(ptr_ + i, s.ptr_, s.length_*sizeof(T));
    if (s.ptr_ && s.length_ > 0) {
      const src = s.ptr_.slice(0, s.length_);
      for (let j = 0; j < s.length_; j++) {
        this.ptr_![i + j] = src[j];
      }
    }
    return this;
  }

  swap(str: String<T>): void {
    {
      const tem = str.ptr_;
      str.ptr_ = this.ptr_;
      this.ptr_ = tem;
    }
    {
      const tem = str.length_;
      str.length_ = this.length_;
      this.length_ = tem;
    }
    {
      const tem = str.alloc_;
      str.alloc_ = this.alloc_;
      this.alloc_ = tem;
    }
  }

  // T operator[](size_t i) const { return ptr_[i]; }
  // T &operator[](size_t i) { return ptr_[i]; }
  get(i: number): T {
    return this.ptr_![i];
  }

  set(i: number, value: T): void {
    this.ptr_![i] = value;
  }

  // iterator begin() { return ptr_; }
  // const_iterator begin() const { return ptr_; }
  begin(): T[] | null {
    return this.ptr_;
  }

  // const T *data() const { return ptr_; }
  data(): T[] | null {
    return this.ptr_;
  }

  // String<T> &operator+=(T c)
  appendChar(c: T): String<T> {
    if (this.length_ >= this.alloc_) {
      this.grow(1);
    }
    if (!this.ptr_) {
      this.ptr_ = new Array(this.alloc_);
    }
    this.ptr_[this.length_++] = c;
    return this;
  }

  // String<T> &operator+=(const String<T> &s)
  appendString(s: String<T>): String<T> {
    if (s.ptr_) {
      this.append(s.ptr_, s.length_);
    }
    return this;
  }

  append(p: T[], length: number): String<T> {
    if (this.length_ + length > this.alloc_) {
      this.grow(length);
    }
    if (!this.ptr_) {
      this.ptr_ = new Array(this.alloc_);
    }
    // memcpy(ptr_ + length_, p, length*sizeof(T));
    const src = p.slice(0, length);
    for (let i = 0; i < length; i++) {
      this.ptr_[this.length_ + i] = src[i];
    }
    this.length_ += length;
    return this;
  }

  // Boolean operator==(const String<T> &s) const
  equals(s: String<T>): Boolean {
    if (this.length_ !== s.length_) {
      return false;
    }
    if (this.length_ === 0) {
      return true;
    }
    if (!this.ptr_ || !s.ptr_) {
      return this.ptr_ === s.ptr_;
    }
    if (this.ptr_[0] !== s.ptr_[0]) {
      return false;
    }
    // memcmp(ptr_ + 1, s.ptr_ + 1, (length_ - 1)*sizeof(T)) == 0
    for (let i = 1; i < this.length_; i++) {
      if (this.ptr_[i] !== s.ptr_[i]) {
        return false;
      }
    }
    return true;
  }

  // Boolean operator!=(const String<T> &str) const
  notEquals(str: String<T>): Boolean {
    return !this.equals(str);
  }

  resize(n: number): void {
    if (this.alloc_ < n) {
      const oldPtr = this.ptr_;
      this.ptr_ = new Array(n);
      this.alloc_ = n;
      if (this.length_ > 0 && oldPtr) {
        // memcpy(ptr_, oldPtr, length_*sizeof(T));
        // Copy existing elements - slice is faster than loop
        const toCopy = oldPtr.slice(0, this.length_);
        this.ptr_.splice(0, toCopy.length, ...toCopy);
      }
    }
    this.length_ = n;
  }

  private grow(n: number): void {
    let newAlloc = this.alloc_;
    if (this.alloc_ < n) {
      newAlloc += n + 16;
    } else {
      newAlloc += this.alloc_;
    }
    const s = new Array(newAlloc);
    // memcpy(s, ptr_, length_*sizeof(T));
    if (this.ptr_ && this.length_ > 0) {
      // Copy existing elements - slice is faster than loop
      const toCopy = this.ptr_.slice(0, this.length_);
      s.splice(0, toCopy.length, ...toCopy);
    }
    this.ptr_ = s;
    this.alloc_ = newAlloc;
  }
}
