// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';

export class Priority {
  static readonly data = 0;
  static readonly dataDelim = 1;
  static readonly function = 2;
  static readonly delim = 255; // UCHAR_MAX

  static blank(n: number): number {
    return n + Priority.function;
  }

  static isBlank(t: number): Boolean {
    return Priority.function < t && t < Priority.delim;
  }
}

export type PriorityType = number;
