// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { StringC } from './StringC';

export class Hash {
  static hash(str: StringC): number {
    // unsigned long h = 0;
    let h = 0;
    const ptr = str.data();
    if (!ptr) {
      return 0;
    }
    // for (const Char *p = str.data(); p < str.data() + str.size(); p++)
    //   h = (h << 5) + h + *p;	// from Chris Torek
    for (let i = 0; i < str.size(); i++) {
      const charCode = ptr[i];
      h = ((h << 5) + h + charCode) >>> 0; // >>> 0 ensures unsigned 32-bit
    }
    return h;
  }
}
