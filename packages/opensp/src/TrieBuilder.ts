// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Token, EquivCode } from './types';
import { String } from './StringOf';
import { Owner } from './Owner';
import { Trie, BlankTrie } from './Trie';
import { Vector } from './Vector';
import { Priority, PriorityType } from './Priority';
import { Boolean, PackedBoolean } from './Boolean';
import { ASSERT } from './macros';
import { CopyOwner } from './CopyOwner';

export type TokenVector = Vector<Token>;

export class TrieBuilder {
  private nCodes_: number;
  private root_: Owner<Trie>;

  constructor(nCodes: number) {
    this.nCodes_ = nCodes;
    this.root_ = new Owner<Trie>(new Trie());
    const root = this.root_.pointer()!;
    root.token_ = 0;
    root.tokenLength_ = 0;
    root.priority_ = Priority.data;
    root.nCodes_ = nCodes;
  }

  recognize(
    chars: String<EquivCode>,
    t: Token,
    pri: PriorityType,
    ambiguities: TokenVector
  ): void;
  recognize(
    chars: String<EquivCode>,
    set: String<EquivCode>,
    t: Token,
    pri: PriorityType,
    ambiguities: TokenVector
  ): void;
  recognize(
    chars: String<EquivCode>,
    setOrT: String<EquivCode> | Token,
    tOrPri: Token | PriorityType,
    priOrAmbiguities: PriorityType | TokenVector,
    maybeAmbiguities?: TokenVector
  ): void {
    if (maybeAmbiguities === undefined) {
      // First overload: recognize(chars, t, pri, ambiguities)
      const t = setOrT as Token;
      const pri = tOrPri as PriorityType;
      const ambiguities = priOrAmbiguities as TokenVector;
      this.setToken(
        this.extendTrie(this.root_.pointer()!, chars),
        chars.size(),
        t,
        pri,
        ambiguities
      );
    } else {
      // Second overload: recognize(chars, set, t, pri, ambiguities)
      const set = setOrT as String<EquivCode>;
      const t = tOrPri as Token;
      const pri = priOrAmbiguities as PriorityType;
      const ambiguities = maybeAmbiguities;

      const trie = this.extendTrie(this.root_.pointer()!, chars);

      for (let i = 0; i < set.size(); i++) {
        this.setToken(
          this.forceNext(trie, set.get(i)),
          chars.size() + 1,
          t,
          pri,
          ambiguities
        );
      }
    }
  }

  // recognize a delimiter with a blank sequence
  recognizeB(
    chars: String<EquivCode>,
    bSequenceLength: number, // >= 1
    maxBlankSequenceLength: number,
    blankCodes: String<EquivCode>,
    chars2: String<EquivCode>,
    t: Token,
    ambiguities: TokenVector
  ): void {
    this.doB(
      this.extendTrie(this.root_.pointer()!, chars),
      chars.size(),
      bSequenceLength,
      maxBlankSequenceLength,
      blankCodes,
      chars2,
      t,
      Priority.blank(bSequenceLength),
      ambiguities
    );
  }

  recognizeEE(code: EquivCode, t: Token): void {
    const trie = this.forceNext(this.root_.pointer()!, code);
    trie.tokenLength_ = 0; // it has length 0 in the buffer
    trie.token_ = t;
    trie.priority_ = Priority.data;
  }

  extractTrie(): Trie | null {
    return this.root_.extract();
  }

  private doB(
    trie: Trie,
    tokenLength: number,
    minBLength: number,
    maxLength: number,
    blankCodes: String<EquivCode>,
    chars2: String<EquivCode>,
    token: Token,
    pri: PriorityType,
    ambiguities: TokenVector
  ): void {
    if (minBLength === 0 && trie.next_ === null) {
      if (!trie.blank_.pointer()) {
        const b = new BlankTrie();
        trie.blank_ = new CopyOwner<BlankTrie>(b);
        b.maxBlanksToScan_ = maxLength;
        b.additionalLength_ = tokenLength;
        b.codeIsBlank_.assign(this.nCodes_, false);
        for (let i = 0; i < blankCodes.size(); i++) {
          b.codeIsBlank_.set(blankCodes.get(i), true);
        }
        b.tokenLength_ = 0;
        b.token_ = 0;
        b.priority_ = Priority.data;
        b.nCodes_ = this.nCodes_;
      } else {
        // A B sequence is not allowed to be adjacent to a character
        // that can occur in a blank sequence, so maxLength will be
        // the same at a node, no matter how we got there.
        ASSERT(trie.blank_.pointer()!.maxBlanksToScan_ === maxLength);
        ASSERT(trie.blank_.pointer()!.additionalLength_ === tokenLength);
      }
      if (chars2.size() === 0) {
        this.setToken(trie, tokenLength, token, pri, ambiguities);
      } else {
        this.setToken(
          this.extendTrie(trie.blank_.pointer()!, chars2),
          chars2.size(),
          token,
          pri,
          ambiguities
        );
      }
    } else {
      if (minBLength === 0) {
        this.setToken(
          this.extendTrie(trie, chars2),
          tokenLength + chars2.size(),
          token,
          pri,
          ambiguities
        );
      }
      for (let i = 0; i < blankCodes.size(); i++) {
        this.doB(
          this.forceNext(trie, blankCodes.get(i)),
          tokenLength + 1,
          minBLength === 0 ? 0 : minBLength - 1,
          maxLength - 1,
          blankCodes,
          chars2,
          token,
          pri,
          ambiguities
        );
      }
    }
  }

  private extendTrie(trie: Trie, s: String<EquivCode>): Trie {
    for (let i = 0; i < s.size(); i++) {
      trie = this.forceNext(trie, s.get(i));
    }
    return trie;
  }

  private setToken(
    trie: Trie,
    tokenLength: number,
    token: Token,
    pri: PriorityType,
    ambiguities: TokenVector
  ): void {
    if (
      tokenLength > trie.tokenLength_ ||
      (tokenLength === trie.tokenLength_ && pri > trie.priority_)
    ) {
      trie.tokenLength_ = tokenLength;
      trie.token_ = token;
      trie.priority_ = pri;
    } else if (
      trie.tokenLength_ === tokenLength &&
      trie.priority_ === pri &&
      trie.token_ !== token &&
      trie.token_ !== 0
    ) {
      ambiguities.push_back(trie.token_);
      ambiguities.push_back(token);
    }
    if (trie.hasNext()) {
      for (let i = 0; i < this.nCodes_; i++) {
        this.setToken(trie.next_![i], tokenLength, token, pri, ambiguities);
      }
    }
  }

  private copyInto(into: Trie, from: Trie, additionalLength: number): void {
    if (from.token_ !== 0) {
      const ambiguities = new Vector<Token>();
      this.setToken(
        into,
        from.tokenLength_ + additionalLength,
        from.token_,
        from.priority_,
        ambiguities
      );
      ASSERT(ambiguities.size() === 0);
    }
    if (from.hasNext()) {
      for (let i = 0; i < this.nCodes_; i++) {
        this.copyInto(
          this.forceNext(into, i),
          from.next_![i],
          additionalLength
        );
      }
    }
  }

  private forceNext(trie: Trie, c: EquivCode): Trie {
    if (!trie.hasNext()) {
      trie.next_ = new Array(this.nCodes_);
      if (trie.blank_.pointer()) {
        trie.blank_.pointer()!.additionalLength_ += 1;
        trie.blank_.pointer()!.maxBlanksToScan_ -= 1;
      }
      const blankOwner = new Owner<BlankTrie>(
        trie.blank_.extract() as BlankTrie | null
      );
      const b = blankOwner.pointer();
      for (let i = 0; i < this.nCodes_; i++) {
        const p = new Trie();
        trie.next_[i] = p;
        if (b && b.codeIsBlank(i)) {
          trie.next_[i].blank_ = blankOwner.pointer()
            ? new CopyOwner<BlankTrie>(blankOwner.extract()!)
            : new CopyOwner<BlankTrie>(new BlankTrie());
          if (trie.next_[i].blank_.pointer()) {
            // Copy from b if blankOwner was extracted
            const newBlank = trie.next_[i].blank_.pointer()!;
            newBlank.additionalLength_ = b.additionalLength_;
            newBlank.maxBlanksToScan_ = b.maxBlanksToScan_;
            newBlank.codeIsBlank_ = new Vector<PackedBoolean>(b.codeIsBlank_);
            newBlank.token_ = b.token_;
            newBlank.tokenLength_ = b.tokenLength_;
            newBlank.priority_ = b.priority_;
            newBlank.nCodes_ = b.nCodes_;
          }
        }
        p.token_ = trie.token_;
        p.tokenLength_ = trie.tokenLength_;
        p.priority_ = trie.priority_;
        p.nCodes_ = this.nCodes_;
      }
      if (b) {
        // -1 because 1 was added above
        this.copyInto(trie, b, b.additionalLength_ - 1);
      }
    }
    return trie.next_![c];
  }
}
