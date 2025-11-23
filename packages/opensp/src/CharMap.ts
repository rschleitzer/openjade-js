// Copyright (c) 1997 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Char } from './types';
import { Resource } from './Resource';

// TypeScript port: Simplified implementation using Map instead of 4-level sparse array
// The C++ version uses a complex CharMapPlane/CharMapPage/CharMapColumn hierarchy
// for memory efficiency. We use JavaScript Map which handles sparse arrays efficiently.

export class CharMap<T> {
  private lo_: T[]; // Fast lookup for chars < 256
  private hi_: Map<Char, T>; // Sparse storage for chars >= 256
  private defaultValue_: T | undefined;

  constructor();
  constructor(defaultValue: T);
  constructor(defaultValue?: T) {
    this.defaultValue_ = defaultValue;
    this.lo_ = new Array(256);
    this.hi_ = new Map<Char, T>();

    if (defaultValue !== undefined) {
      for (let i = 0; i < 256; i++) {
        this.lo_[i] = defaultValue;
      }
    }
  }

  get(c: Char): T {
    if (c < 256) {
      return this.lo_[c];
    }
    const val = this.hi_.get(c);
    return val !== undefined ? val : this.defaultValue_!;
  }

  getRange(from: Char, to: { value: Char }): T {
    // C++ version returns the value and sets 'to' to the max char with same value
    // Simplified: just return the value and set to = from
    to.value = from;
    return this.get(from);
  }

  swap(map: CharMap<T>): void {
    // Swap lo_ arrays
    const temLo = this.lo_;
    this.lo_ = map.lo_;
    map.lo_ = temLo;

    // Swap hi_ maps
    const temHi = this.hi_;
    this.hi_ = map.hi_;
    map.hi_ = temHi;

    // Swap defaults
    const temDefault = this.defaultValue_;
    this.defaultValue_ = map.defaultValue_;
    map.defaultValue_ = temDefault;
  }

  setChar(c: Char, val: T): void {
    if (c < 256) {
      this.lo_[c] = val;
    } else {
      this.hi_.set(c, val);
    }
  }

  setRange(from: Char, to: Char, val: T): void {
    // Set range [from, to] inclusive
    let c = from;
    do {
      this.setChar(c, val);
    } while (c++ !== to);
  }

  setAll(val: T): void {
    for (let i = 0; i < 256; i++) {
      this.lo_[i] = val;
    }
    this.hi_.clear();
    this.defaultValue_ = val;
  }
}

export class CharMapResource<T> extends Resource {
  private charMap_: CharMap<T>;

  constructor();
  constructor(defaultValue: T);
  constructor(defaultValue?: T) {
    super();
    if (defaultValue === undefined) {
      this.charMap_ = new CharMap<T>();
    } else {
      this.charMap_ = new CharMap<T>(defaultValue);
    }
  }

  // Delegate to CharMap
  get(c: Char): T {
    return this.charMap_.get(c);
  }

  getRange(from: Char, to: { value: Char }): T {
    return this.charMap_.getRange(from, to);
  }

  swap(map: CharMapResource<T>): void {
    this.charMap_.swap(map.charMap_);
  }

  setChar(c: Char, val: T): void {
    this.charMap_.setChar(c, val);
  }

  setRange(from: Char, to: Char, val: T): void {
    this.charMap_.setRange(from, to, val);
  }

  setAll(val: T): void {
    this.charMap_.setAll(val);
  }
}
