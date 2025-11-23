// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { WideChar, Number, Char } from './types';
import { Vector } from './Vector';
import { PublicId } from './ExternalId';
import { ISet } from './ISet';
import { Boolean } from './Boolean';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { ASSERT } from './macros';
import { charMax } from './constant';

export class CharsetDeclRange {
  static readonly Type = {
    number: 0,
    string: 1,
    unused: 2
  } as const;

  private descMin_: WideChar;
  private count_: Number;
  private baseMin_: WideChar;
  private type_: number;
  private str_: StringC;

  constructor();
  constructor(descMin: WideChar, count: Number, baseMin: WideChar);
  constructor(descMin: WideChar, count: Number);
  constructor(descMin: WideChar, count: Number, str: StringC);
  constructor(descMin?: WideChar, count?: Number, baseMinOrStr?: WideChar | StringC) {
    this.descMin_ = 0;
    this.count_ = 0;
    this.baseMin_ = 0;
    this.type_ = CharsetDeclRange.Type.unused;
    this.str_ = new StringOf<Char>();

    if (descMin !== undefined && count !== undefined) {
      this.descMin_ = descMin;
      this.count_ = count;

      if (baseMinOrStr !== undefined) {
        if (typeof baseMinOrStr === 'object') {
          // StringC case
          this.type_ = CharsetDeclRange.Type.string;
          this.str_ = baseMinOrStr;
        } else {
          // WideChar case
          this.type_ = CharsetDeclRange.Type.number;
          this.baseMin_ = baseMinOrStr;
        }
      } else {
        this.type_ = CharsetDeclRange.Type.unused;
      }
    }
  }

  rangeDeclared(min: WideChar, count: Number, declared: ISet<WideChar>): void {
    if (count > 0 && min + count > this.descMin_ && min < this.descMin_ + this.count_) {
      const commMin = (this.descMin_ > min) ? this.descMin_ : min;
      const commMax = min + ((min + count < this.descMin_ + this.count_
                              ? count
                              : this.descMin_ + this.count_ - min) - 1);
      ASSERT(commMin <= commMax);
      declared.addRange(commMin, commMax);
    }
  }

  usedSet(set: ISet<Char>): void {
    if (this.type_ !== CharsetDeclRange.Type.unused && this.count_ > 0 && this.descMin_ <= charMax) {
      let max: Char;
      if (charMax - this.descMin_ < this.count_ - 1)
        max = charMax;
      else
        max = this.descMin_ + (this.count_ - 1);
      set.addRange(this.descMin_, max);
    }
  }

  stringToChar(str: StringC, to: ISet<WideChar>): void {
    if (this.type_ === CharsetDeclRange.Type.string && this.str_.equals(str) && this.count_ > 0)
      to.addRange(this.descMin_, this.descMin_ + (this.count_ - 1));
  }

  numberToChar(n: Number, to: ISet<WideChar>, count: { value: Number }): void {
    if (this.type_ === CharsetDeclRange.Type.number && n >= this.baseMin_ && n - this.baseMin_ < this.count_) {
      const thisCount = this.count_ - (n - this.baseMin_);
      if (to.isEmpty() || thisCount < count.value)
        count.value = thisCount;
      to.add(this.descMin_ + (n - this.baseMin_));
    }
  }

  getCharInfo(fromChar: WideChar, result: { type: number; n: Number; str: StringC; count: Number }): Boolean {
    if (fromChar >= this.descMin_ && fromChar - this.descMin_ < this.count_) {
      result.type = this.type_;
      if (result.type === CharsetDeclRange.Type.number)
        result.n = this.baseMin_ + (fromChar - this.descMin_);
      else if (result.type === CharsetDeclRange.Type.string)
        result.str = this.str_;
      result.count = this.count_ - (fromChar - this.descMin_);
      return true;
    } else {
      return false;
    }
  }
}

export class CharsetDeclSection {
  private baseset_: PublicId;
  private ranges_: Vector<CharsetDeclRange>;

  constructor() {
    this.baseset_ = new PublicId();
    this.ranges_ = new Vector<CharsetDeclRange>();
  }

  setPublicId(id: PublicId): void {
    this.baseset_ = id;
  }

  addRange(range: CharsetDeclRange): void {
    this.ranges_.push_back(range);
  }

  rangeDeclared(min: WideChar, count: Number, declared: ISet<WideChar>): void {
    for (let i = 0; i < this.ranges_.size(); i++)
      this.ranges_.get(i).rangeDeclared(min, count, declared);
  }

  usedSet(set: ISet<Char>): void {
    for (let i = 0; i < this.ranges_.size(); i++)
      this.ranges_.get(i).usedSet(set);
  }

  stringToChar(str: StringC, to: ISet<WideChar>): void {
    for (let i = 0; i < this.ranges_.size(); i++)
      this.ranges_.get(i).stringToChar(str, to);
  }

  numberToChar(id: PublicId | null, n: Number, to: ISet<WideChar>, count: { value: Number }): void {
    const ownerTypeResult = { value: 0 };
    const seq1 = new StringOf<Char>();
    const seq2 = new StringOf<Char>();

    if (id && id.string().equals(this.baseset_.string())
        // Assume that 2 ISO character sets are the same if
        // their designating sequences are the same.
        || (id && id.getOwnerType(ownerTypeResult)
            && ownerTypeResult.value === PublicId.OwnerType.ISO
            && this.baseset_.getOwnerType(ownerTypeResult)
            && ownerTypeResult.value === PublicId.OwnerType.ISO
            && id.getDesignatingSequence(seq1)
            && this.baseset_.getDesignatingSequence(seq2)
            && seq1.equals(seq2))) {
      for (let i = 0; i < this.ranges_.size(); i++)
        this.ranges_.get(i).numberToChar(n, to, count);
    }
  }

  getCharInfo(fromChar: WideChar, result: { id: PublicId | null; type: number; n: Number; str: StringC; count: Number }): Boolean {
    const rangeResult = { type: 0, n: 0, str: new StringOf<Char>(), count: 0 };
    for (let i = 0; i < this.ranges_.size(); i++) {
      if (this.ranges_.get(i).getCharInfo(fromChar, rangeResult)) {
        result.id = this.baseset_;
        result.type = rangeResult.type;
        result.n = rangeResult.n;
        result.str = rangeResult.str;
        result.count = rangeResult.count;
        return true;
      }
    }
    return false;
  }
}

export class CharsetDecl {
  private sections_: Vector<CharsetDeclSection>;
  private declaredSet_: ISet<WideChar>;

  constructor() {
    this.sections_ = new Vector<CharsetDeclSection>();
    this.declaredSet_ = new ISet<WideChar>();
  }

  addSection(id: PublicId): void {
    this.sections_.resize(this.sections_.size() + 1);
    this.sections_.back().setPublicId(id);
  }

  swap(to: CharsetDecl): void {
    this.sections_.swap(to.sections_);
    this.declaredSet_.swap(to.declaredSet_);
  }

  clear(): void {
    this.sections_.clear();
  }

  addRange(min: WideChar, count: Number, baseMinOrStr?: WideChar | StringC): void {
    if (count > 0)
      this.declaredSet_.addRange(min, min + (count - 1));

    let range: CharsetDeclRange;
    if (baseMinOrStr === undefined) {
      range = new CharsetDeclRange(min, count);
    } else if (typeof baseMinOrStr === 'object') {
      range = new CharsetDeclRange(min, count, baseMinOrStr);
    } else {
      range = new CharsetDeclRange(min, count, baseMinOrStr);
    }
    this.sections_.back().addRange(range);
  }

  rangeDeclared(min: WideChar, count: Number, declared: ISet<WideChar>): void {
    for (let i = 0; i < this.sections_.size(); i++)
      this.sections_.get(i).rangeDeclared(min, count, declared);
  }

  usedSet(set: ISet<Char>): void {
    for (let i = 0; i < this.sections_.size(); i++)
      this.sections_.get(i).usedSet(set);
  }

  getCharInfo(fromChar: WideChar, result: { id: PublicId | null; type: number; n: Number; str: StringC; count: Number }): Boolean {
    for (let i = 0; i < this.sections_.size(); i++) {
      if (this.sections_.get(i).getCharInfo(fromChar, result))
        return true;
    }
    return false;
  }

  stringToChar(str: StringC, to: ISet<WideChar>): void {
    for (let i = 0; i < this.sections_.size(); i++)
      this.sections_.get(i).stringToChar(str, to);
  }

  numberToChar(id: PublicId | null, n: Number, to: ISet<WideChar>, count: { value: Number }): void {
    for (let i = 0; i < this.sections_.size(); i++)
      this.sections_.get(i).numberToChar(id, n, to, count);
  }

  declaredSet(): ISet<WideChar> {
    return this.declaredSet_;
  }

  charDeclared(c: WideChar): Boolean {
    return this.declaredSet_.contains(c);
  }
}
