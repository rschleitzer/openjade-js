// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean, PackedBoolean } from './Boolean';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Text } from './Text';
import { Char } from './types';
import { MessageType1 } from './Message';
import { CharsetInfo } from './CharsetInfo';
import { Location } from './Location';
import { SIZEOF } from './macros';

export class PublicId {
  static readonly Type = {
    informal: 0,
    fpi: 1,
    urn: 2
  } as const;

  static readonly TextClass = {
    CAPACITY: 0,
    CHARSET: 1,
    DOCUMENT: 2,
    DTD: 3,
    ELEMENTS: 4,
    ENTITIES: 5,
    LPD: 6,
    NONSGML: 7,
    NOTATION: 8,
    SD: 9,
    SHORTREF: 10,
    SUBDOC: 11,
    SYNTAX: 12,
    TEXT: 13
  } as const;

  static readonly OwnerType = {
    ISO: 0,
    registered: 1,
    unregistered: 2
  } as const;

  private type_: number;
  private ownerType_: number;
  private owner_: StringC;
  private textClass_: number;
  private unavailable_: PackedBoolean;
  private description_: StringC;
  private languageOrDesignatingSequence_: StringC;
  private haveDisplayVersion_: PackedBoolean;
  private displayVersion_: StringC;
  private text_: Text;
  private nid_: StringC;
  private nss_: StringC;

  constructor() {
    this.type_ = PublicId.Type.informal;
    this.ownerType_ = PublicId.OwnerType.ISO;
    this.owner_ = new StringOf<Char>();
    this.textClass_ = PublicId.TextClass.CAPACITY;
    this.unavailable_ = false;
    this.description_ = new StringOf<Char>();
    this.languageOrDesignatingSequence_ = new StringOf<Char>();
    this.haveDisplayVersion_ = false;
    this.displayVersion_ = new StringOf<Char>();
    this.text_ = new Text();
    this.nid_ = new StringOf<Char>();
    this.nss_ = new StringOf<Char>();
  }

  getOwnerType(result: { value: number }): Boolean {
    if (this.type_ !== PublicId.Type.fpi) {
      return false;
    }
    result.value = this.ownerType_;
    return true;
  }

  getOwner(result: StringC): Boolean {
    if (this.type_ !== PublicId.Type.fpi) {
      return false;
    }
    result.assign(this.owner_.data()!, this.owner_.size());
    return true;
  }

  getTextClass(result: { value: number }): Boolean {
    if (this.type_ !== PublicId.Type.fpi) {
      return false;
    }
    result.value = this.textClass_;
    return true;
  }

  getUnavailable(result: { value: Boolean }): Boolean {
    if (this.type_ !== PublicId.Type.fpi) {
      return false;
    }
    result.value = this.unavailable_;
    return true;
  }

  getDescription(result: StringC): Boolean {
    if (this.type_ !== PublicId.Type.fpi) {
      return false;
    }
    result.assign(this.description_.data()!, this.description_.size());
    return true;
  }

  getLanguage(result: StringC): Boolean {
    if (this.type_ !== PublicId.Type.fpi || this.textClass_ === PublicId.TextClass.CHARSET) {
      return false;
    }
    result.assign(this.languageOrDesignatingSequence_.data()!, this.languageOrDesignatingSequence_.size());
    return true;
  }

  getDesignatingSequence(result: StringC): Boolean {
    if (this.type_ !== PublicId.Type.fpi || this.textClass_ !== PublicId.TextClass.CHARSET) {
      return false;
    }
    result.assign(this.languageOrDesignatingSequence_.data()!, this.languageOrDesignatingSequence_.size());
    return true;
  }

  getDisplayVersion(result: StringC): Boolean {
    if (this.type_ !== PublicId.Type.fpi) {
      return false;
    }
    if (this.haveDisplayVersion_) {
      result.assign(this.displayVersion_.data()!, this.displayVersion_.size());
    }
    return true;
  }

  getNamespaceIdentifier(result: StringC): Boolean {
    if (this.type_ !== PublicId.Type.urn) {
      return false;
    }
    result.assign(this.nid_.data()!, this.nid_.size());
    return true;
  }

  getNamespaceSpecificString(result: StringC): Boolean {
    if (this.type_ !== PublicId.Type.urn) {
      return false;
    }
    result.assign(this.nss_.data()!, this.nss_.size());
    return true;
  }

  init(text: Text, charset: CharsetInfo, space: Char, fpierror: { value: MessageType1 | null }, urnerror: { value: MessageType1 | null }): number {
    text.swap(this.text_);
    const str = this.text_.string();
    this.type_ = PublicId.Type.informal;
    if (this.initFpi(str, charset, space, fpierror)) {
      this.type_ = PublicId.Type.fpi;
    }
    if (this.initUrn(str, charset, space, urnerror)) {
      this.type_ = PublicId.Type.urn;
    }
    return this.type_;
  }

  string(): StringC {
    return this.text_.string();
  }

  text(): Text {
    return this.text_;
  }

  type(): number {
    return this.type_;
  }

  private initUrn(str: StringC, charset: CharsetInfo, _space: Char, error: { value: MessageType1 | null }): Boolean {
    const nextRef: { value: number | null } = { value: 0 };
    const data = str.data()!;
    const lim = str.size();
    const sep = charset.execToDesc(':');
    const lcU = charset.execToDesc('u');
    const ucU = charset.execToDesc('U');
    const lcR = charset.execToDesc('r');
    const ucR = charset.execToDesc('R');
    const lcN = charset.execToDesc('n');
    const ucN = charset.execToDesc('N');

    const fieldStart = { value: 0 };
    const fieldLength = { value: 0 };

    if (!PublicId.nextField(sep, nextRef, lim, data, fieldStart, fieldLength, false)) {
      // error.value = &ParserMessages::urnMissingField;
      return false;
    }

    if (fieldLength.value !== 3 ||
        (data[fieldStart.value] !== lcU && data[fieldStart.value] !== ucU) ||
        (data[fieldStart.value + 1] !== lcR && data[fieldStart.value + 1] !== ucR) ||
        (data[fieldStart.value + 2] !== lcN && data[fieldStart.value + 2] !== ucN)) {
      // error.value = &ParserMessages::urnMissingPrefix;
      return false;
    }

    if (!PublicId.nextField(sep, nextRef, lim, data, fieldStart, fieldLength, false)) {
      // error.value = &ParserMessages::urnMissingField;
      return false;
    }

    if (fieldLength.value < 1) {
      // error.value = &ParserMessages::urnInvalidNid;
      return false;
    }

    // Validate NID
    for (let i = 0; i < fieldLength.value; i++) {
      const c = { value: 0 };
      const ch = data[fieldStart.value + i];
      if (!charset.descToUniv(ch, c)) {
        // error.value = &ParserMessages::urnInvalidNid;
        return false;
      }
      const univChar = c.value;
      if ((univChar !== 45 || i === 0) &&
          !(univChar >= 97 && univChar < 97 + 26) &&
          !(univChar >= 65 && univChar < 65 + 26) &&
          !(univChar >= 48 && univChar < 48 + 10)) {
        // error.value = &ParserMessages::urnInvalidNid;
        return false;
      }
    }

    this.nid_.assign(data.slice(fieldStart.value, fieldStart.value + fieldLength.value), fieldLength.value);

    if (nextRef.value === null) {
      // error.value = &ParserMessages::urnMissingField;
      return false;
    }

    const nssStart = nextRef.value;
    const nssLength = lim - nssStart;

    if (nssLength < 1) {
      // error.value = &ParserMessages::urnInvalidNss;
      return false;
    }

    // Validate NSS
    for (let i = 0; i < nssLength; i++) {
      const c = { value: 0 };
      const ch = data[nssStart + i];
      if (!charset.descToUniv(ch, c)) {
        // error.value = &ParserMessages::urnInvalidNss;
        return false;
      }
      const univChar = c.value;

      if (univChar === 37) { // percent
        if (nssLength - i < 3) {
          // error.value = &ParserMessages::urnInvalidNss;
          return false;
        }
        let zeros = true;
        for (let j = 0; j < 2; j++) {
          i++;
          const hexC = { value: 0 };
          if (!charset.descToUniv(data[nssStart + i], hexC)) {
            // error.value = &ParserMessages::urnInvalidNss;
            return false;
          }
          const hexChar = hexC.value;
          if (!(hexChar >= 97 && hexChar < 97 + 6) &&
              !(hexChar >= 65 && hexChar < 65 + 6) &&
              !(hexChar >= 48 && hexChar < 48 + 10)) {
            // error.value = &ParserMessages::urnInvalidNss;
            return false;
          }
          if (hexChar !== 48) {
            zeros = false;
          }
        }
        if (zeros) {
          // error.value = &ParserMessages::urnInvalidNss;
          return false;
        }
      } else {
        if (!(univChar >= 97 && univChar < 97 + 26) &&
            !(univChar >= 65 && univChar < 65 + 26) &&
            !(univChar >= 48 && univChar < 48 + 10) &&
            univChar !== 40 && univChar !== 41 && univChar !== 43 && univChar !== 44 &&
            univChar !== 45 && univChar !== 46 && univChar !== 58 && univChar !== 61 &&
            univChar !== 64 && univChar !== 59 && univChar !== 36 && univChar !== 95 &&
            univChar !== 33 && univChar !== 42 && univChar !== 39) {
          // error.value = &ParserMessages::urnInvalidNss;
          return false;
        }
      }
    }

    this.nss_.assign(data.slice(nssStart, nssStart + nssLength), nssLength);
    return true;
  }

  private initFpi(str: StringC, charset: CharsetInfo, space: Char, error: { value: MessageType1 | null }): Boolean {
    const nextRef: { value: number | null } = { value: 0 };
    const data = str.data()!;
    const lim = str.size();
    const solidus = charset.execToDesc('/');
    const minus = charset.execToDesc('-');
    const plus = charset.execToDesc('+');

    const fieldStart = { value: 0 };
    const fieldLength = { value: 0 };

    if (!PublicId.nextField(solidus, nextRef, lim, data, fieldStart, fieldLength, true)) {
      // error.value = &ParserMessages::fpiMissingField;
      return false;
    }

    if (fieldLength.value === 1 && (data[fieldStart.value] === minus || data[fieldStart.value] === plus)) {
      this.ownerType_ = data[fieldStart.value] === plus ? PublicId.OwnerType.registered : PublicId.OwnerType.unregistered;
      if (!PublicId.nextField(solidus, nextRef, lim, data, fieldStart, fieldLength, true)) {
        // error.value = &ParserMessages::fpiMissingField;
        return false;
      }
    } else {
      this.ownerType_ = PublicId.OwnerType.ISO;
    }

    this.owner_.assign(data.slice(fieldStart.value, fieldStart.value + fieldLength.value), fieldLength.value);

    if (!PublicId.nextField(solidus, nextRef, lim, data, fieldStart, fieldLength, true)) {
      // error.value = &ParserMessages::fpiMissingField;
      return false;
    }

    let i: number;
    for (i = 0; i < fieldLength.value; i++) {
      if (data[fieldStart.value + i] === space) {
        break;
      }
    }

    if (i >= fieldLength.value) {
      // error.value = &ParserMessages::fpiMissingTextClassSpace;
      return false;
    }

    const textClassString = new StringOf<Char>();
    textClassString.assign(data.slice(fieldStart.value, fieldStart.value + i), i);
    const textClassResult = { value: 0 };
    if (!PublicId.lookupTextClass(textClassString, charset, textClassResult)) {
      // error.value = &ParserMessages::fpiInvalidTextClass;
      return false;
    }
    this.textClass_ = textClassResult.value;

    i++; // skip the space
    fieldStart.value += i;
    fieldLength.value -= i;

    if (fieldLength.value === 1 && data[fieldStart.value] === minus) {
      this.unavailable_ = true;
      if (!PublicId.nextField(solidus, nextRef, lim, data, fieldStart, fieldLength, true)) {
        // error.value = &ParserMessages::fpiMissingField;
        return false;
      }
    } else {
      this.unavailable_ = false;
    }

    this.description_.assign(data.slice(fieldStart.value, fieldStart.value + fieldLength.value), fieldLength.value);

    if (!PublicId.nextField(solidus, nextRef, lim, data, fieldStart, fieldLength, true)) {
      // error.value = &ParserMessages::fpiMissingField;
      return false;
    }

    if (this.textClass_ !== PublicId.TextClass.CHARSET) {
      for (i = 0; i < fieldLength.value; i++) {
        const c = { value: 0 };
        if (!charset.descToUniv(data[fieldStart.value + i], c) ||
            c.value < 65 || c.value >= 65 + 26) {
          // error.value = &ParserMessages::fpiInvalidLanguage;
          return false;
        }
      }
      if (fieldLength.value === 0) {
        // error.value = &ParserMessages::fpiInvalidLanguage;
        return false;
      }
    }

    this.languageOrDesignatingSequence_.assign(data.slice(fieldStart.value, fieldStart.value + fieldLength.value), fieldLength.value);

    if (PublicId.nextField(solidus, nextRef, lim, data, fieldStart, fieldLength, true)) {
      switch (this.textClass_) {
        case PublicId.TextClass.CAPACITY:
        case PublicId.TextClass.CHARSET:
        case PublicId.TextClass.NOTATION:
        case PublicId.TextClass.SYNTAX:
          // error.value = &ParserMessages::fpiIllegalDisplayVersion;
          return false;
        default:
          break;
      }
      this.haveDisplayVersion_ = true;
      this.displayVersion_.assign(data.slice(fieldStart.value, fieldStart.value + fieldLength.value), fieldLength.value);
    } else {
      this.haveDisplayVersion_ = false;
    }

    if (nextRef.value !== null) {
      // error.value = &ParserMessages::fpiExtraField;
      return false;
    }

    return true;
  }

  private static nextField(
    solidus: Char,
    next: { value: number | null },
    lim: number,
    data: Char[],
    fieldStart: { value: number },
    fieldLength: { value: number },
    dup: Boolean
  ): Boolean {
    if (next.value === null) {
      return false;
    }

    fieldStart.value = next.value;
    const dupOffset = dup ? 1 : 0;

    for (let i = next.value; i < lim; i++) {
      if (data[i] === solidus && i + dupOffset < lim && data[i + dupOffset] === solidus) {
        fieldLength.value = i - fieldStart.value;
        next.value = i + 1 + dupOffset;
        return true;
      }
    }

    fieldLength.value = lim - fieldStart.value;
    next.value = null;
    return true;
  }

  private static textClasses: string[] = [
    'CAPACITY',
    'CHARSET',
    'DOCUMENT',
    'DTD',
    'ELEMENTS',
    'ENTITIES',
    'LPD',
    'NONSGML',
    'NOTATION',
    'SD',
    'SHORTREF',
    'SUBDOC',
    'SYNTAX',
    'TEXT',
  ];

  private static lookupTextClass(str: StringC, charset: CharsetInfo, textClass: { value: number }): Boolean {
    for (let i = 0; i < SIZEOF(PublicId.textClasses); i++) {
      const expected = charset.execToDesc(PublicId.textClasses[i]) as unknown as StringC;
      if (str.equals(expected)) {
        textClass.value = i;
        return true;
      }
    }
    return false;
  }
}

export class ExternalId {
  private haveSystem_: PackedBoolean;
  private havePublic_: PackedBoolean;
  private system_: Text;
  private public_: PublicId;
  private loc_: Location;
  private effectiveSystem_: StringC;

  constructor() {
    this.haveSystem_ = false;
    this.havePublic_ = false;
    this.system_ = new Text();
    this.public_ = new PublicId();
    this.loc_ = new Location();
    this.effectiveSystem_ = new StringOf<Char>();
  }

  systemIdString(): StringC | null {
    return this.haveSystem_ ? this.system_.string() : null;
  }

  publicIdString(): StringC | null {
    return this.havePublic_ ? this.public_.string() : null;
  }

  effectiveSystemId(): StringC {
    return this.effectiveSystem_;
  }

  systemIdText(): Text | null {
    return this.haveSystem_ ? this.system_ : null;
  }

  publicIdText(): Text | null {
    return this.havePublic_ ? this.public_.text() : null;
  }

  publicId(): PublicId | null {
    return this.havePublic_ ? this.public_ : null;
  }

  setSystem(text: Text): void {
    text.swap(this.system_);
    this.haveSystem_ = true;
  }

  setEffectiveSystem(str: StringC): void {
    str.swap(this.effectiveSystem_);
  }

  setPublic(text: Text, charset: CharsetInfo, space: Char, fpierror: { value: MessageType1 | null }, urnerror: { value: MessageType1 | null }): number {
    this.havePublic_ = true;
    return this.public_.init(text, charset, space, fpierror, urnerror);
  }

  setLocation(loc: Location): void {
    this.loc_ = loc;
  }

  location(): Location {
    return this.loc_;
  }
}
