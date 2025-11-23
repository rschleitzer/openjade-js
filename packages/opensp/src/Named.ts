// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { StringC } from './StringC';

export class Named {
  private name_: StringC;

  constructor(name: StringC) {
    this.name_ = name;
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
