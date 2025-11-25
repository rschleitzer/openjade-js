// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { String } from './StringOf';
import { EquivCode } from './types';

/**
 * SrInfo (Short Reference Info) stores information about a short reference delimiter
 * for use in building recognizers.
 */
export class SrInfo {
  chars: String<EquivCode>;
  bSequenceLength: number;
  chars2: String<EquivCode>;

  constructor() {
    this.chars = new String<EquivCode>();
    this.bSequenceLength = 0;
    this.chars2 = new String<EquivCode>();
  }
}
