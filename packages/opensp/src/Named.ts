// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Char } from './types';

export class Named {
  private name_: StringC;

  constructor(name: StringC) {
    // Must copy the name since in C++ StringC name_ is a value, not a pointer
    this.name_ = new StringOf<Char>(name);
  }

  // virtual ~Named() { }
  // Destructor not needed in TypeScript

  name(): StringC {
    return this.name_;
  }

  namePointer(): StringC {
    return this.name_;
  }

  setName(name: StringC): void {
    this.name_ = name;
  }

  swap(to: Named): void {
    this.name_.swap(to.name_);
  }
}
