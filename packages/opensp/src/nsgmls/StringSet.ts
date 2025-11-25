// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { StringC } from '../StringC';
import { Boolean } from '../Boolean';
import { HashTable } from '../HashTable';

// StringSet - a set of strings
// Port of StringSet from nsgmls/StringSet.h
export class StringSet {
  private table_: HashTable<StringC, boolean>;

  constructor() {
    this.table_ = new HashTable<StringC, boolean>();
  }

  // Add a string to the set
  // Returns true if already present, false if newly added
  add(str: StringC): Boolean {
    if (this.table_.lookup(str) !== null) {
      return true;
    }
    this.table_.insert(str, true);
    return false;
  }

  swap(other: StringSet): void {
    const temp = this.table_;
    this.table_ = other.table_;
    other.table_ = temp;
  }

  clear(): void {
    this.table_ = new HashTable<StringC, boolean>();
  }
}
