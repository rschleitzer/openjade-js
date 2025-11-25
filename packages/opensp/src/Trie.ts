// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Token, EquivCode } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { Vector } from './Vector';
import { CopyOwner } from './CopyOwner';
import { Priority, PriorityType } from './Priority';

export class Trie {
  // Public for TrieBuilder access - matches C++ where TrieBuilder is a friend
  next_: Trie[] | null;
  nCodes_: number;
  token_: Token;
  tokenLength_: number;
  priority_: PriorityType;
  blank_: CopyOwner<BlankTrie>;

  constructor() {
    this.next_ = null;
    this.nCodes_ = 0;
    this.token_ = 0;
    this.tokenLength_ = 0;
    this.priority_ = 0;
    this.blank_ = new CopyOwner<BlankTrie>();
  }

  // Copy constructor
  protected copyFrom(other: Trie): void {
    this.nCodes_ = other.nCodes_;
    this.token_ = other.token_;
    this.tokenLength_ = other.tokenLength_;
    this.priority_ = other.priority_;

    if (other.next_) {
      this.next_ = new Array(other.nCodes_);
      for (let i = 0; i < other.nCodes_; i++) {
        this.next_[i] = new Trie();
        this.next_[i].copyFrom(other.next_[i]);
      }
    } else {
      this.next_ = null;
    }

    const blankPtr = other.blank_.pointer();
    if (blankPtr) {
      this.blank_ = new CopyOwner<BlankTrie>(blankPtr.copy());
    } else {
      this.blank_ = new CopyOwner<BlankTrie>();
    }
  }

  next(i: number): Trie {
    if (!this.next_) {
      throw new Error('Trie.next called but next_ is null');
    }
    return this.next_[i];
  }

  hasNext(): Boolean {
    return this.next_ !== null;
  }

  token(): Token {
    return this.token_;
  }

  tokenLength(): number {
    return this.tokenLength_;
  }

  blank(): BlankTrie | null {
    return this.blank_.pointer();
  }

  includeBlanks(): Boolean {
    return Priority.isBlank(this.priority_);
  }
}

export class BlankTrie extends Trie {
  // Public for TrieBuilder access - matches C++ where TrieBuilder is a friend
  additionalLength_: number;
  maxBlanksToScan_: number;
  codeIsBlank_: Vector<PackedBoolean>;

  constructor() {
    super();
    this.additionalLength_ = 0;
    this.maxBlanksToScan_ = 0;
    this.codeIsBlank_ = new Vector<PackedBoolean>();
  }

  codeIsBlank(c: EquivCode): Boolean {
    return this.codeIsBlank_[c];
  }

  // maximum number of blanks to scan (minimum is 0)
  maxBlanksToScan(): number {
    return this.maxBlanksToScan_;
  }

  // length to add to tokenLengths in this trie (for those > 0).
  additionalLength(): number {
    return this.additionalLength_;
  }

  copy(): BlankTrie {
    const result = new BlankTrie();
    result.additionalLength_ = this.additionalLength_;
    result.maxBlanksToScan_ = this.maxBlanksToScan_;
    result.codeIsBlank_ = new Vector<PackedBoolean>(this.codeIsBlank_);
    // Copy base Trie members
    result.copyFrom(this);
    return result;
  }
}
