// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, Index, Offset } from './types';
import { Boolean } from './Boolean';
import { ConstPtr } from './Ptr';
import { Resource } from './Resource';
import { String } from './StringOf';

// StringC is String<Char>
type StringC = String<Char>;

// Forward declarations for types we'll port later
// These will be replaced with actual classes when we port Entity.h
export interface Entity extends Resource { }
export interface EntityDecl {
  name(): StringC;
}
export interface Markup { }
export interface Text {
  charLocation(off: Offset, origin: Origin | null, index: Index): Boolean;
}
export interface InternalEntity extends Entity {
  asInternalEntity(): InternalEntity | null;
  text(): Text;
}

export class ExternalInfo {
  // RTTI support would go here
}

export class NamedCharRef {
  private refStartIndex_: Index;
  private refEndType_: NamedCharRef.RefEndType;
  private origName_: StringC;

  constructor(refStartIndex?: Index, refEndType?: NamedCharRef.RefEndType, origName?: StringC) {
    this.refStartIndex_ = refStartIndex ?? 0;
    this.refEndType_ = refEndType ?? NamedCharRef.RefEndType.endOmitted;
    this.origName_ = origName ?? new String<Char>();
  }

  refStartIndex(): Index {
    return this.refStartIndex_;
  }

  refEndType(): NamedCharRef.RefEndType {
    return this.refEndType_;
  }

  origName(): StringC {
    return this.origName_;
  }

  set(refStartIndex: Index, refEndType: NamedCharRef.RefEndType, s: number[] | null, n: number): void {
    this.refStartIndex_ = refStartIndex;
    this.refEndType_ = refEndType;
    if (s) {
      this.origName_.assign(s, n);
    }
  }
}

export namespace NamedCharRef {
  export enum RefEndType {
    endOmitted,
    endRE,
    endRefc
  }
}

export class Origin extends Resource {
  asEntityOrigin(): EntityOrigin | null {
    return null;
  }

  asInputSourceOrigin(): InputSourceOrigin | null {
    return null;
  }

  parent(): Location {
    throw new Error('Origin.parent() must be overridden');
  }

  refLength(): Index {
    return 0;
  }

  origChars(chars: Char[] | null): Boolean {
    return false;
  }

  inBracketedTextOpenDelim(): Boolean {
    return false;
  }

  inBracketedTextCloseDelim(): Boolean {
    return false;
  }

  isNumericCharRef(markup: Markup | null): Boolean {
    return false;
  }

  isNamedCharRef(ind: Index, ref: NamedCharRef): Boolean {
    return false;
  }

  entityDecl(): EntityDecl | null {
    return null;
  }

  defLocation(off: Offset, origin: Origin | null, index: Index): Boolean {
    return false;
  }

  markup(): Markup | null {
    return null;
  }

  entity(): Entity | null {
    return null;
  }

  externalInfo(): ExternalInfo | null {
    return null;
  }

  startOffset(ind: Index): Offset {
    return ind;
  }

  entityName(): StringC | null {
    const ent = this.entityDecl();
    if (ent) {
      return ent.name();
    } else {
      return null;
    }
  }
}

export class ProxyOrigin extends Origin {
  private origin_: Origin;

  constructor(origin: Origin) {
    super();
    this.origin_ = origin;
  }

  asEntityOrigin(): EntityOrigin | null {
    return this.origin_.asEntityOrigin();
  }

  asInputSourceOrigin(): InputSourceOrigin | null {
    return this.origin_.asInputSourceOrigin();
  }

  parent(): Location {
    return this.origin_.parent();
  }

  refLength(): Index {
    return this.origin_.refLength();
  }

  origChars(p: Char[] | null): Boolean {
    return this.origin_.origChars(p);
  }

  inBracketedTextOpenDelim(): Boolean {
    return this.origin_.inBracketedTextOpenDelim();
  }

  inBracketedTextCloseDelim(): Boolean {
    return this.origin_.inBracketedTextCloseDelim();
  }

  isNumericCharRef(markup: Markup | null): Boolean {
    return this.origin_.isNumericCharRef(markup);
  }

  isNamedCharRef(ind: Index, ref: NamedCharRef): Boolean {
    return this.origin_.isNamedCharRef(ind, ref);
  }

  entityDecl(): EntityDecl | null {
    return this.origin_.entityDecl();
  }

  defLocation(off: Offset, origin: Origin | null, index: Index): Boolean {
    return this.origin_.defLocation(off, origin, index);
  }

  markup(): Markup | null {
    return this.origin_.markup();
  }

  entity(): Entity | null {
    return this.origin_.entity();
  }

  externalInfo(): ExternalInfo | null {
    return this.origin_.externalInfo();
  }

  startOffset(ind: Index): Offset {
    return this.origin_.startOffset(ind);
  }
}

export class Location {
  private origin_: ConstPtr<Origin>;
  private index_: Index;

  constructor();
  constructor(origin: Origin | null, index: Index);
  constructor(origin: ConstPtr<Origin>, index: Index);
  constructor(loc: Location);
  constructor(arg1?: Origin | null | ConstPtr<Origin> | Location, arg2?: Index) {
    if (arg1 === undefined) {
      // Default constructor
      this.origin_ = new ConstPtr<Origin>(null);
      this.index_ = 0;
    } else if (arg1 instanceof Location) {
      // Copy constructor
      this.origin_ = new ConstPtr<Origin>(arg1.origin_);
      this.index_ = arg1.index_;
    } else if (arg1 instanceof ConstPtr) {
      // ConstPtr<Origin> constructor
      this.origin_ = new ConstPtr<Origin>(arg1);
      this.index_ = arg2 ?? 0;
    } else {
      // Origin* constructor
      this.origin_ = new ConstPtr<Origin>(arg1);
      this.index_ = arg2 ?? 0;
    }
  }

  addOffset(i: Index): void {
    this.index_ += i;
  }

  subtractOffset(i: Index): void {
    this.index_ -= i;
  }

  index(): Index {
    return this.index_;
  }

  origin(): ConstPtr<Origin> {
    return this.origin_;
  }

  clear(): void {
    this.origin_.clear();
  }

  swap(to: Location): void {
    this.origin_.swap(to.origin_);
    const tem = to.index_;
    to.index_ = this.index_;
    this.index_ = tem;
  }
}

export class BracketOrigin extends Origin {
  private pos_: BracketOrigin.Position;
  private loc_: Location;

  constructor(loc: Location, pos: BracketOrigin.Position) {
    super();
    this.loc_ = new Location(loc);
    this.pos_ = pos;
  }

  parent(): Location {
    return this.loc_;
  }

  inBracketedTextOpenDelim(): Boolean {
    return this.pos_ === BracketOrigin.Position.open;
  }

  inBracketedTextCloseDelim(): Boolean {
    return this.pos_ === BracketOrigin.Position.close;
  }
}

export namespace BracketOrigin {
  export enum Position {
    open,
    close
  }
}

export class ReplacementOrigin extends Origin {
  private loc_: Location;
  private origChar_: Char;

  constructor(loc: Location, origChar: Char) {
    super();
    this.loc_ = new Location(loc);
    this.origChar_ = origChar;
  }

  parent(): Location {
    return this.loc_;
  }

  origChars(s: Char[] | null): Boolean {
    if (this.loc_.origin().isNull() || !this.loc_.origin().pointer()!.origChars(s)) {
      // In C++, s = &origChar_, but we can't do that in TS
      // Caller needs to handle this differently
    }
    return true;
  }
}

export class MultiReplacementOrigin extends Origin {
  private loc_: Location;
  private origChars_: StringC;

  constructor(loc: Location, origChars: StringC) {
    super();
    this.loc_ = new Location(loc);
    this.origChars_ = new String<Char>();
    origChars.swap(this.origChars_);
  }

  parent(): Location {
    return this.loc_;
  }

  origChars(s: Char[] | null): Boolean {
    if (this.loc_.origin().isNull() || !this.loc_.origin().pointer()!.origChars(s)) {
      // In C++, s = origChars_.data()
      // Caller needs to handle this differently
    }
    return true;
  }
}

// Abstract base class for InputSourceOrigin
export abstract class InputSourceOrigin extends Origin {
  abstract noteCharRef(replacementIndex: Index, ref: NamedCharRef): void;
  abstract setExternalInfo(info: ExternalInfo | null): void;
  abstract copy(): InputSourceOrigin;

  static make(): InputSourceOrigin {
    return new InputSourceOriginImpl();
  }

  static makeWithLocation(refLocation: Location): InputSourceOrigin {
    return new InputSourceOriginImpl(refLocation);
  }

  asInputSourceOrigin(): InputSourceOrigin | null {
    return this;
  }
}

export interface InputSourceOriginNamedCharRef {
  replacementIndex: Index;
  origNameOffset: number;
  refStartIndex: Index;
  refEndType: NamedCharRef.RefEndType;
}

// Abstract base class for EntityOrigin
// Note: In the C++ code, EntityOrigin doesn't override the static make() methods
// from InputSourceOrigin. The Entity-specific factory methods will be added later.
export abstract class EntityOrigin extends InputSourceOrigin {
  static allocSize: number = 0; // Will be set properly when we have full implementation

  // These will be implemented when we port Entity.h
  // static make(entity: ConstPtr<Entity>): EntityOrigin
  // static makeWithLocation(entity: ConstPtr<Entity>, refLocation: Location): EntityOrigin
}

// Concrete implementation (private in C++, exported here for now)
class InputSourceOriginImpl extends EntityOrigin {
  private charRefs_: InputSourceOriginNamedCharRef[];
  private charRefOrigNames_: StringC;
  private externalInfo_: ExternalInfo | null;
  private refLocation_: Location;

  constructor(refLocation?: Location) {
    super();
    this.charRefs_ = [];
    this.charRefOrigNames_ = new String<Char>();
    this.externalInfo_ = null;
    this.refLocation_ = refLocation ?? new Location();
  }

  parent(): Location {
    return this.refLocation_;
  }

  externalInfo(): ExternalInfo | null {
    return this.externalInfo_;
  }

  copy(): InputSourceOrigin {
    return new InputSourceOriginImpl(this.refLocation_);
  }

  setExternalInfo(info: ExternalInfo | null): void {
    this.externalInfo_ = info;
  }

  noteCharRef(replacementIndex: Index, ref: NamedCharRef): void {
    // In C++ this uses a Mutex, we skip that in TS
    this.charRefs_.push({
      replacementIndex: replacementIndex,
      refStartIndex: ref.refStartIndex(),
      refEndType: ref.refEndType(),
      origNameOffset: this.charRefOrigNames_.size()
    });
    this.charRefOrigNames_.appendString(ref.origName());
  }

  private nPrecedingCharRefs(ind: Index): number {
    let i: number;
    // Find i such that
    // charRefs_[i].replacementIndex >= ind
    // charRefs_[i - 1].replacementIndex < ind
    if (this.charRefs_.length === 0 || ind > this.charRefs_[this.charRefs_.length - 1].replacementIndex) {
      // This will be a common case, so optimize it.
      i = this.charRefs_.length;
    } else {
      // Binary search
      i = 0;
      let lim = this.charRefs_.length;
      while (i < lim) {
        const mid = i + Math.floor((lim - i) / 2);
        if (this.charRefs_[mid].replacementIndex >= ind) {
          lim = mid;
        } else {
          i = mid + 1;
        }
      }
    }
    return i;
  }

  startOffset(ind: Index): Offset {
    const n = this.nPrecedingCharRefs(ind);
    let adjustedInd = ind;
    if (n < this.charRefs_.length && ind === this.charRefs_[n].replacementIndex) {
      let m = n;
      for (;;) {
        adjustedInd = this.charRefs_[m].refStartIndex;
        if (m === 0 || this.charRefs_[m - 1].replacementIndex !== adjustedInd) {
          break;
        }
        --m;
      }
    }
    return adjustedInd - n;
  }

  isNamedCharRef(ind: Index, ref: NamedCharRef): Boolean {
    const n = this.nPrecedingCharRefs(ind);
    if (n < this.charRefs_.length && ind === this.charRefs_[n].replacementIndex) {
      const data = this.charRefOrigNames_.data();
      const offset = this.charRefs_[n].origNameOffset;
      const nextOffset = (n + 1 < this.charRefs_.length)
        ? this.charRefs_[n + 1].origNameOffset
        : this.charRefOrigNames_.size();
      ref.set(
        this.charRefs_[n].refStartIndex,
        this.charRefs_[n].refEndType,
        data,
        nextOffset - offset
      );
      return true;
    }
    return false;
  }
}
