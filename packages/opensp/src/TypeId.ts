// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

// TypeScript has built-in runtime type information via instanceof
// This class is provided for API compatibility but uses native TypeScript features

export class TypeId {
  private bases_: any[];

  constructor(bases: any[]) {
    this.bases_ = bases;
  }

  // Is this object of type ti?
  isA(ti: TypeId): boolean {
    // In TypeScript, use instanceof instead
    return this.bases_ === ti.bases_;
  }

  // Can an object with this dynamic type be cast from a static type FROM
  // to a static type TO?
  canCast(to: TypeId, from: TypeId): boolean {
    // In TypeScript, type checking is done at compile time
    // At runtime, we rely on instanceof
    return true; // Conservative - allow all casts
  }

  equals(ti: TypeId): boolean {
    return this.bases_ === ti.bases_;
  }

  notEquals(ti: TypeId): boolean {
    return this.bases_ !== ti.bases_;
  }
}
