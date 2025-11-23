// Copyright (c) 1994 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Char, Xchar } from './types';
import { Resource } from './Resource';
import { Ptr } from './Ptr';
import { CharMapResource } from './CharMap';

// Shared array for XcharMap, including space for InputSource::eE (-1)
class SharedXcharMap<T> extends Resource {
  private v_: T[];

  constructor();
  constructor(defaultValue: T);
  constructor(defaultValue?: T) {
    super();
    // C++: T v[2 + 0xffff] for SP_MULTI_BYTE
    // Index -1 for eE, 0-0xffff for characters
    this.v_ = new Array(2 + 0xffff);
    if (defaultValue !== undefined) {
      for (let i = 0; i < this.v_.length; i++) {
        this.v_[i] = defaultValue;
      }
    }
  }

  // Returns pointer to v[1], so that v[0] is at index -1
  ptr(): T[] {
    return this.v_;
  }

  // Access with offset (ptr() returns v_, caller accesses with +1 offset)
  get(index: number): T {
    return this.v_[index + 1];
  }

  set(index: number, value: T): void {
    this.v_[index + 1] = value;
  }
}

export class XcharMap<T> {
  private sharedMap_: Ptr<SharedXcharMap<T>>;
  private hiMap_: Ptr<CharMapResource<T>>;

  constructor();
  constructor(defaultValue: T);
  constructor(defaultValue?: T) {
    this.sharedMap_ = new Ptr<SharedXcharMap<T>>(null);
    this.hiMap_ = new Ptr<CharMapResource<T>>(null);

    if (defaultValue !== undefined) {
      this.sharedMap_ = new Ptr<SharedXcharMap<T>>(new SharedXcharMap<T>(defaultValue));
      // TypeScript always uses SP_MULTI_BYTE mode
      this.hiMap_ = new Ptr<CharMapResource<T>>(new CharMapResource<T>(defaultValue));
    }
  }

  get(c: Xchar): T {
    // TypeScript always uses SP_MULTI_BYTE mode (Unicode)
    if (c > 0xffff) {
      return this.hiMap_.pointer()!.get(c as Char);
    }
    // c can be -1 (InputSource::eE), so we use the SharedXcharMap which handles that
    return this.sharedMap_.pointer()!.get(c);
  }

  setRange(min: Char, max: Char, val: T): void {
    if (min <= max) {
      // TypeScript always uses SP_MULTI_BYTE
      if (min <= 0xffff) {
        const m = max <= 0xffff ? max : 0xffff;
        let c = min;
        do {
          this.sharedMap_.pointer()!.set(c, val);
        } while (c++ !== m);
      }
      if (max >= 0x10000) {
        this.hiMap_.pointer()!.setRange(
          min < 0x10000 ? 0x10000 : min,
          max,
          val
        );
      }
    }
  }

  setChar(c: Char, val: T): void {
    // TypeScript always uses SP_MULTI_BYTE
    if (c > 0xffff) {
      this.hiMap_.pointer()!.setChar(c, val);
    } else {
      this.sharedMap_.pointer()!.set(c, val);
    }
  }

  setEe(val: T): void {
    // Set value for InputSource::eE (-1)
    this.sharedMap_.pointer()!.set(-1, val);
  }

  clear(): void {
    this.sharedMap_.clear();
    this.hiMap_.clear();
  }
}
