// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

// All hash tables with the same type of key share object code.
// The cost of this is a virtual dtor in HashTableItemBase.

export abstract class HashTableItemBase<K> {
  key: K;

  constructor(k: K) {
    this.key = k;
  }

  abstract copy(): HashTableItemBase<K>;
}

export class HashTableKeyFunction<K> {
  static key<K>(obj: HashTableItemBase<K>): K {
    return obj.key;
  }
}
