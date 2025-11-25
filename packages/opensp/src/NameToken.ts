// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { StringC } from './StringC';
import { String } from './StringOf';
import { Location } from './Location';
import { Char } from './types';

/**
 * NameToken represents a name token in SGML markup declarations.
 * Used for element names, attribute names, etc. in group declarations.
 */
export class NameToken {
  name: StringC;
  origName: StringC;
  loc: Location;

  constructor() {
    this.name = new String<Char>();
    this.origName = new String<Char>();
    this.loc = new Location();
  }

  /**
   * Swap the contents with another NameToken
   */
  swap(other: NameToken): void {
    const tempName = this.name;
    const tempOrigName = this.origName;
    const tempLoc = this.loc;
    this.name = other.name;
    this.origName = other.origName;
    this.loc = other.loc;
    other.name = tempName;
    other.origName = tempOrigName;
    other.loc = tempLoc;
  }
}
