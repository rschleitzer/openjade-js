// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

// TypeScript versions of C++ macros

export function ASSERT(expr: boolean, message?: string): void {
  if (!expr) {
    throw new Error(`Assertion failed: ${message || 'unknown'}`);
  }
}

export function CANNOT_HAPPEN(): never {
  throw new Error('CANNOT_HAPPEN: This code path should never be reached');
}

export function SIZEOF<T>(v: T[]): number {
  return v.length;
}
