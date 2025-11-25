// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Link } from './Link';
import { Char } from './types';
import { ISet } from './ISet';

export class EquivClass extends Link {
  set: ISet<Char>;
  inSets: number;

  constructor(inSets: number = 0) {
    super();
    this.set = new ISet<Char>();
    this.inSets = inSets;
  }
}
