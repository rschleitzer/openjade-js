// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Named } from './Named';
import { Location } from './Location';
import { Vector } from './Vector';
import { StringC } from './StringC';
import { Boolean } from './Boolean';

export class Id extends Named {
  private defLocation_: Location;
  private pendingRefs_: Vector<Location>;

  constructor(name: StringC) {
    super(name);
    this.defLocation_ = new Location();
    this.pendingRefs_ = new Vector<Location>();
  }

  define(loc: Location): void {
    this.defLocation_ = loc;
    // release memory for pendingRefs_
    const tem = new Vector<Location>();
    this.pendingRefs_.swap(tem);
  }

  addPendingRef(loc: Location): void {
    this.pendingRefs_.push_back(loc);
  }

  defined(): Boolean {
    return !this.defLocation_.origin().isNull();
  }

  defLocation(): Location {
    return this.defLocation_;
  }

  pendingRefs(): Vector<Location> {
    return this.pendingRefs_;
  }
}
