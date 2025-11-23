// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Ptr, ConstPtr } from './Ptr';
import { Resource } from './Resource';

// Forward declaration - will be defined in Attribute.ts
export interface AttributeDefinitionList extends Resource {
  // Defined in Attribute.ts
}

// This is used for things that have attribute definitions
// that notations and elements.
export class Attributed {
  private attributeDef_: Ptr<AttributeDefinitionList>;

  constructor() {
    this.attributeDef_ = new Ptr<AttributeDefinitionList>(null);
  }

  attributeDef(): Ptr<AttributeDefinitionList> {
    return this.attributeDef_;
  }

  attributeDefConst(): ConstPtr<AttributeDefinitionList> {
    return new ConstPtr<AttributeDefinitionList>(this.attributeDef_.pointer());
  }

  attributeDefTemp(): AttributeDefinitionList | null {
    return this.attributeDef_.pointer();
  }

  setAttributeDef(def: Ptr<AttributeDefinitionList>): void {
    this.attributeDef_ = def;
  }
}
