// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Entity } from './Entity';
import { Boolean, PackedBoolean } from './Boolean';
import { ConstPtr } from './Ptr';
import { Hash } from './Hash';

// Information about a reference to an entity that
// used a definition in an LPD.

export class LpdEntityRef {
  entity: ConstPtr<Entity>;
  lookedAtDefault: PackedBoolean;
  foundInPass1Dtd: PackedBoolean;

  constructor() {
    this.entity = new ConstPtr<Entity>();
    this.lookedAtDefault = false;
    this.foundInPass1Dtd = false;
  }

  static key(r: LpdEntityRef): LpdEntityRef {
    return r;
  }

  static hash(r: LpdEntityRef): number {
    const entity = r.entity.pointer();
    if (entity) {
      const hasher = new Hash();
      return hasher.hash(entity.name());
    }
    return 0;
  }

  equals(r2: LpdEntityRef): boolean {
    return (
      this.entity.pointer() === r2.entity.pointer() &&
      this.foundInPass1Dtd === r2.foundInPass1Dtd &&
      this.lookedAtDefault === r2.lookedAtDefault
    );
  }

  notEquals(r2: LpdEntityRef): boolean {
    return !this.equals(r2);
  }
}
