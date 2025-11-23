// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

export class Resource {
  private count_: number;

  constructor();
  constructor(r: Resource);
  constructor(r?: Resource) {
    // Both default and copy constructor initialize count to 0
    this.count_ = 0;
  }

  // return 1 if it should be deleted
  unref(): number {
    return --this.count_ <= 0 ? 1 : 0;
  }

  ref(): void {
    ++this.count_;
  }

  count(): number {
    return this.count_;
  }
}
