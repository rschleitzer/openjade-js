// Copyright (c) 1994, 1995 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Char } from './types';
import { Named } from './Named';
import { Vector } from './Vector';
import { ConstPtr } from './Ptr';
import { Entity } from './Entity';
import { Location } from './Location';

export class ShortReferenceMap extends Named {
  private nameMap_: Vector<StringC>;
  private entityMap_: Vector<ConstPtr<Entity>>;
  private nullEntity_: ConstPtr<Entity>;
  private used_: Boolean;
  private defLocation_: Location;

  constructor(name?: StringC) {
    super(name || new StringOf<Char>());
    this.nameMap_ = new Vector<StringC>();
    this.entityMap_ = new Vector<ConstPtr<Entity>>();
    this.nullEntity_ = new ConstPtr<Entity>();
    this.used_ = false;
    this.defLocation_ = new Location();
  }

  defined(): Boolean {
    return this.nameMap_.size() > 0;
  }

  setNameMap(map: Vector<StringC>): void {
    map.swap(this.nameMap_);
    // Make sure we know it's defined.
    if (this.nameMap_.size() === 0) {
      this.nameMap_.resize(1);
    }
  }

  setEntityMap(map: Vector<ConstPtr<Entity>>): void {
    map.swap(this.entityMap_);
  }

  lookup(i: number, result: { value: StringC | null }): Boolean {
    if (i < this.nameMap_.size() && this.nameMap_.get(i).size() !== 0) {
      result.value = this.nameMap_.get(i);
      return true;
    } else {
      result.value = null;
      return false;
    }
  }

  entityName(i: number): StringC | null {
    if (i < this.nameMap_.size() && this.nameMap_.get(i).size() !== 0) {
      return this.nameMap_.get(i);
    } else {
      return null;
    }
  }

  entity(i: number): ConstPtr<Entity> {
    if (i < this.entityMap_.size()) {
      return this.entityMap_.get(i);
    } else {
      return this.nullEntity_;
    }
  }

  used(): Boolean {
    return this.used_;
  }

  setUsed(): void {
    this.used_ = true;
  }

  setDefLocation(loc: Location): void {
    Object.assign(this.defLocation_, loc);
  }

  defLocation(): Location {
    return this.defLocation_;
  }
}
