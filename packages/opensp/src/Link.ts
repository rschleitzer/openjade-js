// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

export class Link {
  public next_: Link | null;

  constructor();
  constructor(next: Link | null);
  constructor(next?: Link | null) {
    if (next === undefined) {
      this.next_ = null;
    } else {
      this.next_ = next;
    }
  }

  // virtual ~Link();
  // Destructor not needed in TypeScript
}
