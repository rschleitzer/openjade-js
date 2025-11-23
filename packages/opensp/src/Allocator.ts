// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

// Allocator is not needed in TypeScript - we have garbage collection.
// This is a stub for compatibility with code that references it.

export class Allocator {
  constructor(_maxSize: number, _blocksPerSegment: number) {
    // No-op in TypeScript
  }

  alloc(_size: number): any {
    // Not used in TypeScript
    return null;
  }

  static allocSimple(_size: number): any {
    // Not used in TypeScript
    return null;
  }

  static free(_ptr: any): void {
    // Not used in TypeScript
  }
}
