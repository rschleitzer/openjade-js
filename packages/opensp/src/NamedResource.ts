// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Named } from './Named';
import { Resource } from './Resource';
import { StringC } from './StringC';

export class NamedResource extends Resource {
  private named_: Named;

  constructor(str: StringC) {
    super();
    this.named_ = new Named(str);
  }

  name(): StringC {
    return this.named_.name();
  }

  namePointer(): StringC {
    return this.named_.namePointer();
  }

  setName(name: StringC): void {
    this.named_.setName(name);
  }

  swap(to: NamedResource): void {
    this.named_.swap((to as any).named_);
  }
}
