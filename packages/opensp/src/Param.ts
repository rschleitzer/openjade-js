// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean, PackedBoolean } from './Boolean';
import { StringC } from './StringC';
import { String } from './StringOf';
import { Location } from './Location';
import { Text } from './Text';
import { Vector } from './Vector';
import { Owner } from './Owner';
import { ConstPtr } from './Ptr';
import { Mode } from './Mode';
import { Syntax } from './Syntax';
import { ModelGroup } from './ContentToken';
import { NameToken } from './NameToken';
import { ElementType } from './ElementType';
import { MessageArg } from './MessageArg';
import { MessageBuilder } from './MessageBuilder';
import { ASSERT } from './macros';
import { Char } from './types';

/**
 * Param describes a markup declaration parameter.
 * Used for parsing ELEMENT, ATTLIST, ENTITY, NOTATION declarations etc.
 */
export class Param {
  // Type constants
  static readonly invalid = 0;
  static readonly silent = 1;
  static readonly dso = 2;
  static readonly mdc = 3;
  static readonly minus = 4;
  static readonly pero = 5;
  static readonly inclusions = 6;
  static readonly exclusions = 7;
  static readonly nameGroup = 8;
  static readonly nameTokenGroup = 9;
  static readonly modelGroup = 10;
  static readonly number = 11;
  static readonly minimumLiteral = 12;
  static readonly attributeValueLiteral = 13;
  static readonly tokenizedAttributeValueLiteral = 14;
  static readonly systemIdentifier = 15;
  static readonly paramLiteral = 16;
  static readonly paramName = 17; // renamed from 'name' to avoid conflict with Function.name
  static readonly entityName = 18;
  static readonly paramEntityName = 19;
  static readonly attributeValue = 20;
  static readonly reservedName = 21; // Syntax.ReservedName is added to this
  // indicatedReservedName: a reserved name preceded by the RNI delimiter
  static readonly indicatedReservedName = Param.reservedName + Syntax.nNames;
  static readonly nTypes = Param.indicatedReservedName + Syntax.nNames;

  type: number;
  startLocation: Location;
  literalText: Text;
  lita: Boolean;
  modelGroupPtr: Owner<ModelGroup>;
  nameTokenVector: Vector<NameToken>;
  token: StringC; // name nameToken; with substitution
  origToken: StringC;
  elementVector: Vector<ElementType | null>;

  constructor() {
    this.type = Param.invalid;
    this.startLocation = new Location();
    this.literalText = new Text();
    this.lita = false;
    this.modelGroupPtr = new Owner<ModelGroup>();
    this.nameTokenVector = new Vector<NameToken>();
    this.token = new String<Char>();
    this.origToken = new String<Char>();
    this.elementVector = new Vector<ElementType | null>();
  }
}

export type ParamType = number;

/**
 * AllowedParams specifies which parameter types are allowed in a particular context.
 */
export class AllowedParams {
  private silent_: PackedBoolean;
  private mdc_: PackedBoolean;
  private rni_: PackedBoolean;
  private dso_: PackedBoolean;
  private inclusions_: PackedBoolean;
  private exclusions_: PackedBoolean;
  // invalid, minus, pero
  private extraDelimiter_: ParamType;
  // invalid, nameGroup, nameTokenGroup, modelGroup
  private group_: ParamType;
  // invalid, reservedName, name, entityName, paramEntityName, attributeValue
  private nameStart_: ParamType;
  // invalid, number, attributeValue
  private digit_: ParamType;
  // invalid, attributeValue
  private nmchar_: ParamType; // LCNMCHAR or UCNMCHAR
  // invalid, minimumLiteral, systemIdentifier, paramLiteral,
  // (tokenized)attributeValueLiteral
  private literal_: ParamType;
  private reservedNames_: PackedBoolean[];
  private mainMode_: Mode;

  constructor(
    p1: ParamType,
    p2: ParamType = Param.invalid,
    p3: ParamType = Param.invalid,
    p4: ParamType = Param.invalid,
    p5: ParamType = Param.invalid,
    p6: ParamType = Param.invalid,
    p7: ParamType = Param.invalid,
    p8: ParamType = Param.invalid,
    p9: ParamType = Param.invalid,
    p10: ParamType = Param.invalid
  ) {
    this.silent_ = false;
    this.mdc_ = false;
    this.rni_ = false;
    this.dso_ = false;
    this.inclusions_ = false;
    this.exclusions_ = false;
    this.extraDelimiter_ = Param.invalid;
    this.group_ = Param.invalid;
    this.nameStart_ = Param.invalid;
    this.digit_ = Param.invalid;
    this.nmchar_ = Param.invalid;
    this.literal_ = Param.invalid;
    this.reservedNames_ = new Array(Syntax.nNames).fill(false);
    this.mainMode_ = Mode.mdMode;

    this.init();
    this.allow(p1);
    this.allow(p2);
    this.allow(p3);
    this.allow(p4);
    this.allow(p5);
    this.allow(p6);
    this.allow(p7);
    this.allow(p8);
    this.allow(p9);
    this.allow(p10);
  }

  static fromArray(types: ParamType[]): AllowedParams {
    const result = new AllowedParams(Param.invalid);
    result.init();
    for (const t of types) {
      result.allow(t);
    }
    return result;
  }

  private init(): void {
    for (let i = 0; i < Syntax.nNames; i++) {
      this.reservedNames_[i] = false;
    }
    this.mainMode_ = Mode.mdMode;
    this.silent_ = false;
    this.mdc_ = false;
    this.rni_ = false;
    this.dso_ = false;
    this.inclusions_ = false;
    this.exclusions_ = false;
    this.extraDelimiter_ = Param.invalid;
    this.group_ = Param.invalid;
    this.nameStart_ = Param.invalid;
    this.digit_ = Param.invalid;
    this.nmchar_ = Param.invalid;
    this.literal_ = Param.invalid;
  }

  private allow(p: ParamType): void {
    switch (p) {
      case Param.invalid:
        break;
      case Param.silent:
        this.silent_ = true;
        break;
      case Param.dso:
        this.dso_ = true;
        break;
      case Param.mdc:
        this.mdc_ = true;
        break;
      case Param.minus:
        ASSERT(this.mainMode_ === Mode.mdMode);
        this.mainMode_ = Mode.mdMinusMode;
        this.extraDelimiter_ = p;
        break;
      case Param.pero:
        ASSERT(this.mainMode_ === Mode.mdMode);
        this.mainMode_ = Mode.mdPeroMode;
        this.extraDelimiter_ = p;
        break;
      case Param.inclusions:
        this.inclusions_ = true;
        break;
      case Param.exclusions:
        this.exclusions_ = true;
        break;
      case Param.nameGroup:
      case Param.nameTokenGroup:
      case Param.modelGroup:
        ASSERT(this.group_ === Param.invalid);
        this.group_ = p;
        break;
      case Param.number:
        ASSERT(this.digit_ === Param.invalid);
        this.digit_ = p;
        break;
      case Param.minimumLiteral:
      case Param.tokenizedAttributeValueLiteral:
      case Param.attributeValueLiteral:
      case Param.systemIdentifier:
      case Param.paramLiteral:
        ASSERT(this.literal_ === Param.invalid);
        this.literal_ = p;
        break;
      case Param.paramName:
      case Param.entityName:
      case Param.paramEntityName:
        ASSERT(this.nameStart_ === Param.invalid);
        this.nameStart_ = p;
        break;
      case Param.attributeValue:
        ASSERT(this.nameStart_ === Param.invalid);
        this.nameStart_ = p;
        ASSERT(this.digit_ === Param.invalid);
        this.digit_ = p;
        ASSERT(this.nmchar_ === Param.invalid);
        this.nmchar_ = p;
        break;
      default:
        if (p < Param.indicatedReservedName) {
          ASSERT(
            this.nameStart_ === Param.invalid ||
              this.nameStart_ === Param.reservedName
          );
          ASSERT(this.rni_ === false);
          this.nameStart_ = Param.reservedName;
          this.reservedNames_[p - Param.reservedName] = true;
        } else {
          ASSERT(this.nameStart_ !== Param.reservedName);
          this.rni_ = true;
          this.reservedNames_[p - Param.indicatedReservedName] = true;
        }
        break;
    }
  }

  mainMode(): Mode {
    return this.mainMode_;
  }

  mdc(): Boolean {
    return this.mdc_;
  }

  rni(): Boolean {
    return this.rni_;
  }

  dso(): Boolean {
    return this.dso_;
  }

  inclusions(): Boolean {
    return this.inclusions_;
  }

  exclusions(): Boolean {
    return this.exclusions_;
  }

  reservedName(i: number): Boolean {
    return this.reservedNames_[i];
  }

  group(): ParamType {
    return this.group_;
  }

  nameStart(): ParamType {
    return this.nameStart_;
  }

  digit(): ParamType {
    return this.digit_;
  }

  nmchar(): ParamType {
    return this.nmchar_;
  }

  literal(): ParamType {
    return this.literal_;
  }

  silent(): Boolean {
    return this.silent_;
  }

  extraDelimiter(): ParamType {
    return this.extraDelimiter_;
  }
}

/**
 * Message argument for displaying allowed parameters in error messages.
 * Simplified implementation - full version needs additional message fragments.
 */
export class AllowedParamsMessageArg implements MessageArg {
  private allow_: AllowedParams;
  private syntax_: ConstPtr<Syntax>;

  constructor(allow: AllowedParams, syntax: ConstPtr<Syntax>) {
    this.allow_ = allow;
    this.syntax_ = syntax;
  }

  copy(): MessageArg {
    return new AllowedParamsMessageArg(this.allow_, this.syntax_);
  }

  append(builder: MessageBuilder): void {
    // Simplified implementation - just output a generic description
    // Full implementation requires additional ParserMessages fragments
    const syntax = this.syntax_.pointer();
    if (!syntax) return;

    const parts: string[] = [];

    if (this.allow_.mdc()) {
      parts.push('MDC');
    }
    if (this.allow_.dso()) {
      parts.push('DSO');
    }
    if (this.allow_.inclusions()) {
      parts.push('inclusions');
    }
    if (this.allow_.exclusions()) {
      parts.push('exclusions');
    }
    if (this.allow_.literal() !== Param.invalid) {
      parts.push('literal');
    }
    if (this.allow_.nameStart() !== Param.invalid) {
      parts.push('name');
    }
    if (this.allow_.digit() === Param.number) {
      parts.push('number');
    }
    if (this.allow_.group() !== Param.invalid) {
      parts.push('group');
    }

    // Convert to Char array and append
    const msg = parts.join(', ');
    const chars = new Array<Char>(msg.length);
    for (let i = 0; i < msg.length; i++) {
      chars[i] = msg.charCodeAt(i);
    }
    builder.appendChars(chars, chars.length);
  }
}
