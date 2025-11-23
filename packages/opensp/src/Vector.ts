// Copyright (c) 1994, 1996 James Clark
// See the file COPYING for copying permission.

// This offers a subset of the interface offered by the standard C++
// vector class as defined in the Jan 96 WP.
// Code in SP currently assumes that size_type is size_t.

export class Vector<T> {
  private size_: number;
  private ptr_: T[] | null;
  private alloc_: number; // allocated size

  // typedef size_t size_type;
  // typedef T *iterator;
  // typedef const T *const_iterator;

  constructor();
  constructor(n: number);
  constructor(n: number, t: T);
  constructor(v: Vector<T>);
  constructor(nOrV?: number | Vector<T>, t?: T) {
    this.size_ = 0;
    this.ptr_ = null;
    this.alloc_ = 0;

    if (nOrV === undefined) {
      // Vector()
      // Already initialized above
    } else if (typeof nOrV === 'number') {
      if (t === undefined) {
        // Vector(size_t n)
        this.append(nOrV);
      } else {
        // Vector(size_t n, const T &t)
        this.insert(this.ptr_, nOrV, t);
      }
    } else {
      // Vector(const Vector<T> &v)
      const v = nOrV;
      if (v.ptr_ && v.size_ > 0) {
        this.insert(this.ptr_, v.ptr_, 0, v.size_);
      }
    }
  }

  resize(n: number): void {
    if (n < this.size_) {
      this.erase(n, this.size_);
    } else if (n > this.size_) {
      this.append(n - this.size_);
    }
  }

  // Vector<T> &operator=(const Vector<T> &v)
  assign(v: Vector<T>): Vector<T>;
  assign(n: number, t: T): void;
  assign(vOrN: Vector<T> | number, t?: T): Vector<T> | void {
    if (vOrN instanceof Vector) {
      const v = vOrN;
      if (v !== this) {
        let n = v.size_;
        if (n > this.size_) {
          n = this.size_;
          if (v.ptr_) {
            this.insert(this.ptr_, v.ptr_, this.size_, v.size_);
          }
        } else if (n < this.size_) {
          this.erase(n, this.size_);
        }
        // while (n-- > 0)
        //   ptr_[n] = v.ptr_[n];
        if (this.ptr_ && v.ptr_) {
          for (let i = n - 1; i >= 0; i--) {
            this.ptr_[i] = v.ptr_[i];
          }
        }
      }
      return this;
    } else {
      // void Vector<T>::assign(size_t n, const T &t)
      const n = vOrN;
      let sz = n;
      if (n > this.size_) {
        sz = this.size_;
        this.insert(this.ptr_, n - this.size_, t!);
      } else if (n < this.size_) {
        this.erase(n, this.size_);
      }
      // while (sz-- > 0)
      //   ptr_[sz] = t;
      if (this.ptr_) {
        for (let i = sz - 1; i >= 0; i--) {
          this.ptr_[i] = t!;
        }
      }
    }
  }

  push_back(t: T): void {
    this.reserve(this.size_ + 1);
    if (!this.ptr_) {
      this.ptr_ = new Array(this.alloc_);
    }
    // (void)new (ptr_ + size_) T(t);
    this.ptr_[this.size_] = t;
    this.size_++;
  }

  insert(p: T[] | null, n: number, t: T): void;
  insert(p: T[] | null, q: T[], q1: number, q2: number): void;
  insert(p: T[] | null, nOrQ: number | T[], tOrQ1?: T | number, q2?: number): void {
    if (typeof nOrQ === 'number' && tOrQ1 !== undefined && q2 === undefined) {
      // void Vector<T>::insert(const T *p, size_t n, const T &t)
      const n = nOrQ;
      const t = tOrQ1 as T;
      const i = p === null ? 0 : this.size_;
      this.reserve(this.size_ + n);
      if (!this.ptr_) {
        this.ptr_ = new Array(this.alloc_);
      }
      // if (i != size_)
      //   memmove(ptr_ + i + n, ptr_ + i, (size_ - i)*sizeof(T));
      if (i !== this.size_) {
        // Shift elements to the right
        for (let j = this.size_ - 1; j >= i; j--) {
          this.ptr_[j + n] = this.ptr_[j];
        }
      }
      // for (T *pp = ptr_ + i; n-- > 0; pp++) {
      //   (void)new (pp) T(t);
      //   size_++;
      // }
      for (let j = 0; j < n; j++) {
        this.ptr_[i + j] = t;
        this.size_++;
      }
    } else if (Array.isArray(nOrQ) && typeof tOrQ1 === 'number' && typeof q2 === 'number') {
      // void Vector<T>::insert(const T *p, const T *q1, const T *q2)
      const q = nOrQ;
      const q1 = tOrQ1;
      const q2End = q2;
      const i = p === null ? 0 : this.size_;
      const n = q2End - q1;
      this.reserve(this.size_ + n);
      if (!this.ptr_) {
        this.ptr_ = new Array(this.alloc_);
      }
      // if (i != size_)
      //   memmove(ptr_ + i + n, ptr_ + i, (size_ - i)*sizeof(T));
      if (i !== this.size_) {
        // Shift elements to the right
        for (let j = this.size_ - 1; j >= i; j--) {
          this.ptr_[j + n] = this.ptr_[j];
        }
      }
      // for (T *pp = ptr_ + i; q1 != q2; q1++, pp++) {
      //   (void)new (pp) T(*q1);
      //   size_++;
      // }
      for (let j = 0; j < n; j++) {
        this.ptr_[i + j] = q[q1 + j];
        this.size_++;
      }
    }
  }

  swap(v: Vector<T>): void {
    {
      const tem = v.ptr_;
      v.ptr_ = this.ptr_;
      this.ptr_ = tem;
    }
    {
      const tem = v.size_;
      v.size_ = this.size_;
      this.size_ = tem;
    }
    {
      const tem = v.alloc_;
      v.alloc_ = this.alloc_;
      this.alloc_ = tem;
    }
  }

  clear(): void {
    this.erase(0, this.size_);
  }

  size(): number {
    return this.size_;
  }

  // T &operator[](size_t i) { return ptr_[i]; }
  // const T &operator[](size_t i) const { return ptr_[i]; }
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

  // T &back() { return ptr_[size_ - 1]; }
  // const T &back() const { return ptr_[size_ - 1]; }
  back(): T {
    return this.ptr_![this.size_ - 1];
  }

  reserve(n: number): void {
    if (n > this.alloc_) {
      this.reserve1(n);
    }
  }

  // T *Vector<T>::erase(const T *p1, const T *p2)
  erase(p1: number, p2: number): number {
    // typedef T X;
    // for (const T *p = p1; p != p2; p++)
    //   ((X *)p)->~X();
    // In TypeScript, no need to call destructors - GC handles it

    if (!this.ptr_) {
      return p1;
    }

    // if (p2 != ptr_ + size_)
    //   memmove((T *)p1, p2, ((const T *)(ptr_ + size_) - p2)*sizeof(T));
    if (p2 !== this.size_) {
      const moveCount = this.size_ - p2;
      for (let i = 0; i < moveCount; i++) {
        this.ptr_[p1 + i] = this.ptr_[p2 + i];
      }
    }
    this.size_ -= p2 - p1;
    return p1;
  }

  private append(n: number): void {
    this.reserve(this.size_ + n);
    if (!this.ptr_) {
      this.ptr_ = new Array(this.alloc_);
    }
    // while (n-- > 0)
    //   (void)new (ptr_ + size_++) T;
    // For TypeScript, we need to initialize with default values
    // Since we don't know how to construct T, we'll leave undefined
    // The calling code must handle initialization
    this.size_ += n;
  }

  private reserve1(size: number): void {
    // Try to preserve a consistent start in the
    // event of an out of memory exception.
    let newAlloc = this.alloc_ * 2;
    if (size > newAlloc) {
      newAlloc += size;
    }
    const p = new Array(newAlloc);
    this.alloc_ = newAlloc;
    if (this.ptr_) {
      // memcpy(p, ptr_, size_*sizeof(T));
      const toCopy = this.ptr_.slice(0, this.size_);
      p.splice(0, toCopy.length, ...toCopy);
    }
    this.ptr_ = p;
  }
}
