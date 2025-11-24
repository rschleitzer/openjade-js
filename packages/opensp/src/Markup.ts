// Copyright (c) 1995 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Syntax } from './Syntax';
import { Sd } from './Sd';
import { Vector } from './Vector';
import { Text } from './Text';
import { SdText } from './SdText';
import { ConstPtr, Ptr } from './Ptr';
import { Origin, EntityOrigin } from './Location';
import { Location } from './Location';
import { Boolean } from './Boolean';
import { InputSource } from './InputSource';
import { ASSERT } from './macros';

export class MarkupItem {
  type: number;
  index: number;
  // Union members - only one is valid based on type
  nChars?: number;
  origin?: ConstPtr<Origin>;
  text?: Text;
  sdText?: SdText;

  constructor();
  constructor(other: MarkupItem);
  constructor(other?: MarkupItem) {
    if (other) {
      this.type = other.type;
      this.index = other.index;
      switch (other.type) {
        case Markup.Type.entityStart:
          this.origin = new ConstPtr<Origin>();
          this.origin.assign(other.origin!.pointer());
          break;
        case Markup.Type.literal:
          this.text = new Text();
          // Copy text content
          this.text = other.text!;
          break;
        case Markup.Type.sdLiteral:
          this.sdText = new SdText();
          // Copy sdText content
          this.sdText = other.sdText!;
          break;
        case Markup.Type.delimiter:
          break;
        default:
          this.nChars = other.nChars;
          break;
      }
    } else {
      this.type = Markup.Type.delimiter;
      this.index = 0;
    }
  }

  assign(item: MarkupItem): void {
    switch (this.type) {
      case Markup.Type.entityStart:
        if (item.type === Markup.Type.entityStart) {
          this.origin!.assign(item.origin!.pointer());
          return;
        }
        delete this.origin;
        break;
      case Markup.Type.literal:
        if (item.type === Markup.Type.literal) {
          this.text = item.text!;
          return;
        }
        delete this.text;
        break;
      case Markup.Type.sdLiteral:
        if (item.type === Markup.Type.sdLiteral) {
          this.sdText = item.sdText!;
          return;
        }
        delete this.sdText;
        break;
    }
    this.type = item.type;
    this.index = item.index;
    switch (item.type) {
      case Markup.Type.entityStart:
        this.origin = new ConstPtr<Origin>();
        this.origin.assign(item.origin!.pointer());
        break;
      case Markup.Type.literal:
        this.text = item.text!;
        break;
      case Markup.Type.sdLiteral:
        this.sdText = item.sdText!;
        break;
      case Markup.Type.delimiter:
        break;
      default:
        this.nChars = item.nChars;
        break;
    }
  }
}

export class Markup {
  static readonly Type = {
    reservedName: 0,
    sdReservedName: 1,
    name: 2,
    nameToken: 3,
    attributeValue: 4,
    number: 5,
    comment: 6,
    s: 7,
    shortref: 8,
    delimiter: 9,
    refEndRe: 10,
    entityStart: 11,
    entityEnd: 12,
    literal: 13,
    sdLiteral: 14
  } as const;

  private chars_: StringC;
  private items_: Vector<MarkupItem>;

  constructor() {
    this.chars_ = new StringOf<Char>();
    this.items_ = new Vector<MarkupItem>();
  }

  size(): number {
    return this.items_.size();
  }

  clear(): void {
    this.chars_.resize(0);
    this.items_.resize(0);
  }

  resize(n: number): void {
    let chopChars = 0;
    for (let i = n; i < this.items_.size(); i++) {
      switch (this.items_.get(i).type) {
        case Markup.Type.reservedName:
        case Markup.Type.sdReservedName:
        case Markup.Type.name:
        case Markup.Type.nameToken:
        case Markup.Type.number:
        case Markup.Type.attributeValue:
        case Markup.Type.s:
        case Markup.Type.comment:
        case Markup.Type.shortref:
          chopChars += this.items_.get(i).nChars!;
          break;
      }
    }
    this.items_.resize(n);
    this.chars_.resize(this.chars_.size() - chopChars);
  }

  addDelim(d: number): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    item.type = Markup.Type.delimiter;
    item.index = d;
  }

  addReservedName(rn: number, source: InputSource | StringC): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    if (source instanceof InputSource) {
      const length = source.currentTokenLength();
      item.nChars = length;
      item.type = Markup.Type.reservedName;
      item.index = rn;
      this.chars_.append(source.currentTokenStart(), length);
    } else {
      item.nChars = source.size();
      item.type = Markup.Type.reservedName;
      item.index = rn;
      this.chars_.append(source.data(), source.size());
    }
  }

  addSdReservedName(rn: number, source: InputSource | Char[], length?: number): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    if (source instanceof InputSource) {
      const len = source.currentTokenLength();
      item.nChars = len;
      item.type = Markup.Type.sdReservedName;
      item.index = rn;
      this.chars_.append(source.currentTokenStart(), len);
    } else {
      item.nChars = length!;
      item.type = Markup.Type.sdReservedName;
      item.index = rn;
      this.chars_.append(source, length!);
    }
  }

  addS(source: Char | InputSource): void {
    if (typeof source === 'number') {
      if (this.items_.size() > 0) {
        const item = this.items_.back();
        if (item.type === Markup.Type.s) {
          item.nChars = item.nChars! + 1;
          this.chars_.append([source], 1);
          return;
        }
      }
      this.items_.resize(this.items_.size() + 1);
      const item = this.items_.back();
      item.type = Markup.Type.s;
      item.nChars = 1;
      this.chars_.append([source], 1);
    } else {
      this.items_.resize(this.items_.size() + 1);
      const item = this.items_.back();
      const length = source.currentTokenLength();
      item.nChars = length;
      item.type = Markup.Type.s;
      this.chars_.append(source.currentTokenStart(), length);
    }
  }

  addCommentStart(): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    item.type = Markup.Type.comment;
    item.nChars = 0;
  }

  addRefEndRe(): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    item.type = Markup.Type.refEndRe;
  }

  addCommentChar(c: Char): void {
    this.items_.back().nChars = this.items_.back().nChars! + 1;
    this.chars_.append([c], 1);
  }

  addName(source: InputSource | Char[], length?: number): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    if (source instanceof InputSource) {
      const len = source.currentTokenLength();
      item.nChars = len;
      item.type = Markup.Type.name;
      this.chars_.append(source.currentTokenStart(), len);
    } else {
      item.nChars = length!;
      item.type = Markup.Type.name;
      this.chars_.append(source, length!);
    }
  }

  addNumber(source: InputSource): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    const length = source.currentTokenLength();
    item.nChars = length;
    item.type = Markup.Type.number;
    this.chars_.append(source.currentTokenStart(), length);
  }

  addNameToken(source: InputSource): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    const length = source.currentTokenLength();
    item.nChars = length;
    item.type = Markup.Type.nameToken;
    this.chars_.append(source.currentTokenStart(), length);
  }

  addAttributeValue(source: InputSource): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    const length = source.currentTokenLength();
    item.nChars = length;
    item.type = Markup.Type.attributeValue;
    this.chars_.append(source.currentTokenStart(), length);
  }

  addShortref(source: InputSource): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    const length = source.currentTokenLength();
    item.nChars = length;
    item.type = Markup.Type.shortref;
    this.chars_.append(source.currentTokenStart(), length);
  }

  addEntityStart(origin: Ptr<EntityOrigin>): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    item.type = Markup.Type.entityStart;
    item.origin = new ConstPtr<Origin>(origin.pointer());
  }

  addEntityEnd(): void {
    this.items_.resize(this.items_.size() + 1);
    this.items_.back().type = Markup.Type.entityEnd;
  }

  addLiteral(text: Text): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    item.type = Markup.Type.literal;
    item.text = new Text();
    item.text.swap(text);
  }

  addSdLiteral(sdText: SdText): void {
    this.items_.resize(this.items_.size() + 1);
    const item = this.items_.back();
    item.type = Markup.Type.sdLiteral;
    item.sdText = new SdText();
    item.sdText.swap(sdText);
  }

  changeToAttributeValue(i: number): void {
    ASSERT(this.items_.get(i).type === Markup.Type.name);
    this.items_.get(i).type = Markup.Type.attributeValue;
  }

  changeToSdReservedName(i: number, rn: number): void {
    ASSERT(this.items_.get(i).type === Markup.Type.name);
    this.items_.get(i).type = Markup.Type.sdReservedName;
    this.items_.get(i).index = rn;
  }

  swap(to: Markup): void {
    this.chars_.swap(to.chars_);
    this.items_.swap(to.items_);
  }

  // For MarkupIter access
  getChars(): StringC {
    return this.chars_;
  }

  getItems(): Vector<MarkupItem> {
    return this.items_;
  }
}

export class MarkupIter {
  private chars_: Char[];
  private items_: Vector<MarkupItem>;
  private nItems_: number;
  private index_: number;
  private charIndex_: number;

  constructor(m: Markup) {
    this.chars_ = m.getChars().data();
    this.items_ = m.getItems();
    this.nItems_ = m.getItems().size();
    this.index_ = 0;
    this.charIndex_ = 0;
  }

  type(): number {
    return this.items_.get(this.index_).type;
  }

  valid(): Boolean {
    return this.index_ < this.nItems_;
  }

  advance(): void;
  advance(loc: Location, syntax: ConstPtr<Syntax>): void;
  advance(loc?: Location, syntax?: ConstPtr<Syntax>): void {
    if (loc && syntax) {
      const item = this.items_.get(this.index_);
      switch (item.type) {
        case Markup.Type.delimiter:
          loc.addOffset(syntax.pointer()!.delimGeneral(this.delimGeneral()).size());
          break;
        case Markup.Type.refEndRe:
          loc.addOffset(1);
          break;
        case Markup.Type.reservedName:
        case Markup.Type.sdReservedName:
        case Markup.Type.name:
        case Markup.Type.nameToken:
        case Markup.Type.number:
        case Markup.Type.attributeValue:
        case Markup.Type.s:
        case Markup.Type.shortref:
          loc.addOffset(item.nChars!);
          this.charIndex_ += item.nChars!;
          break;
        case Markup.Type.comment:
          loc.addOffset(item.nChars! + (2 * syntax.pointer()!.delimGeneral(Syntax.DelimGeneral.dCOM).size()));
          this.charIndex_ += item.nChars!;
          break;
        case Markup.Type.entityStart:
          {
            // Reassign location to entity start
            Object.assign(loc, new Location(item.origin!.pointer()!, 0));
          }
          break;
        case Markup.Type.entityEnd:
          {
            const origin = new ConstPtr<Origin>(loc.origin().pointer());
            const parentLoc = origin.pointer()!.parent();
            Object.assign(loc, parentLoc);
            loc.addOffset(origin.pointer()!.refLength());
          }
          break;
        case Markup.Type.literal:
          {
            const text = item.text!;
            const endLocResult = { value: new Location() };
            text.endDelimLocation(endLocResult);
            Object.assign(loc, endLocResult.value);
            const litaResult = { value: false };
            text.delimType(litaResult);
            loc.addOffset(
              syntax.pointer()!.delimGeneral(litaResult.value ? Syntax.DelimGeneral.dLITA : Syntax.DelimGeneral.dLIT).size()
            );
          }
          break;
        case Markup.Type.sdLiteral:
          {
            const text = item.sdText!;
            const endLoc = text.endDelimLocation();
            Object.assign(loc, endLoc);
            loc.addOffset(1);
          }
          break;
      }
      this.index_++;
    } else {
      const item = this.items_.get(this.index_);
      switch (item.type) {
        case Markup.Type.reservedName:
        case Markup.Type.sdReservedName:
        case Markup.Type.name:
        case Markup.Type.nameToken:
        case Markup.Type.number:
        case Markup.Type.attributeValue:
        case Markup.Type.s:
        case Markup.Type.comment:
        case Markup.Type.shortref:
          this.charIndex_ += item.nChars!;
          break;
      }
      this.index_++;
    }
  }

  index(): number {
    return this.index_;
  }

  charsPointer(): Char[] {
    return this.chars_.slice(this.charIndex_);
  }

  charsLength(): number {
    return this.items_.get(this.index_).nChars!;
  }

  text(): Text {
    return this.items_.get(this.index_).text!;
  }

  entityOrigin(): EntityOrigin | null {
    return this.items_.get(this.index_).origin!.pointer()!.asEntityOrigin();
  }

  sdText(): SdText {
    return this.items_.get(this.index_).sdText!;
  }

  delimGeneral(): number {
    return this.items_.get(this.index_).index;
  }

  reservedName(): number {
    return this.items_.get(this.index_).index;
  }

  sdReservedName(): number {
    return this.items_.get(this.index_).index;
  }
}
