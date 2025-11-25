// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, SyntaxChar, Number as NumType } from './types';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Text } from './Text';
import { Boolean } from './Boolean';
import { Sd } from './Sd';
import { Syntax } from './Syntax';
import { MessageArg } from './MessageArg';
import { MessageBuilder } from './MessageBuilder';
import { ConstPtr } from './Ptr';

/**
 * SdParam - represents a parameter in an SGML declaration
 */
export class SdParam {
  static readonly Type = {
    invalid: 0,
    eE: 1,
    minimumLiteral: 2,
    mdc: 3,
    minus: 4,
    number: 5,
    capacityName: 6,
    name: 7,
    paramLiteral: 8,
    systemIdentifier: 9,
    generalDelimiterName: 10,
    referenceReservedName: 11,
    quantityName: 12,
    reservedName: 13  // Sd::ReservedName is added to this
  } as const;

  type: number;
  token: StringC;
  literalText: Text;
  paramLiteralText: StringOf<SyntaxChar>;

  // Union members - in TypeScript we just have all of them
  n: NumType;
  capacityIndex: number;  // Sd.Capacity
  quantityIndex: number;  // Syntax.Quantity
  reservedNameIndex: number;  // Syntax.ReservedName
  delimGeneralIndex: number;  // Syntax.DelimGeneral

  constructor() {
    this.type = SdParam.Type.invalid;
    this.token = new StringOf<Char>();
    this.literalText = new Text();
    this.paramLiteralText = new StringOf<SyntaxChar>();
    this.n = 0;
    this.capacityIndex = 0;
    this.quantityIndex = 0;
    this.reservedNameIndex = 0;
    this.delimGeneralIndex = 0;
  }
}

/**
 * AllowedSdParams - specifies which parameter types are allowed at a given point
 */
export class AllowedSdParams {
  private static readonly maxAllow = 6;
  private allow_: number[];

  constructor(
    t1: number,
    t2: number = SdParam.Type.invalid,
    t3: number = SdParam.Type.invalid,
    t4: number = SdParam.Type.invalid,
    t5: number = SdParam.Type.invalid,
    t6: number = SdParam.Type.invalid
  ) {
    this.allow_ = [t1, t2, t3, t4, t5, t6];
  }

  param(t: number): Boolean {
    for (let i = 0; i < AllowedSdParams.maxAllow; i++) {
      if (this.allow_[i] === t) {
        return true;
      }
      if (this.allow_[i] === SdParam.Type.invalid) {
        break;
      }
    }
    return false;
  }

  get(i: number): number {
    if (i >= 0 && i < AllowedSdParams.maxAllow) {
      return this.allow_[i];
    }
    return SdParam.Type.invalid;
  }
}

/**
 * AllowedSdParamsMessageArg - message argument for allowed parameters
 */
export class AllowedSdParamsMessageArg extends MessageArg {
  private allow_: AllowedSdParams;
  private sd_: ConstPtr<Sd>;

  constructor(allow: AllowedSdParams, sd: ConstPtr<Sd>) {
    super();
    this.allow_ = allow;
    this.sd_ = sd;
  }

  copy(): MessageArg {
    return new AllowedSdParamsMessageArg(this.allow_, this.sd_);
  }

  append(builder: MessageBuilder): void {
    // Build a list of allowed parameter types
    let first = true;
    for (let i = 0; ; i++) {
      const t = this.allow_.get(i);
      if (t === SdParam.Type.invalid) {
        break;
      }
      if (!first) {
        this.appendString(builder, ', ');
      }
      first = false;
      this.appendParamType(builder, t);
    }
  }

  private appendString(builder: MessageBuilder, s: string): void {
    const chars: Char[] = [];
    for (let i = 0; i < s.length; i++) {
      chars.push(s.charCodeAt(i));
    }
    builder.appendChars(chars, chars.length);
  }

  private appendParamType(builder: MessageBuilder, t: number): void {
    switch (t) {
      case SdParam.Type.eE:
        this.appendString(builder, 'end of entity');
        break;
      case SdParam.Type.minimumLiteral:
        this.appendString(builder, 'minimum literal');
        break;
      case SdParam.Type.mdc:
        this.appendString(builder, '>');
        break;
      case SdParam.Type.minus:
        this.appendString(builder, '-');
        break;
      case SdParam.Type.number:
        this.appendString(builder, 'number');
        break;
      case SdParam.Type.capacityName:
        this.appendString(builder, 'capacity name');
        break;
      case SdParam.Type.name:
        this.appendString(builder, 'name');
        break;
      case SdParam.Type.paramLiteral:
        this.appendString(builder, 'parameter literal');
        break;
      case SdParam.Type.systemIdentifier:
        this.appendString(builder, 'system identifier');
        break;
      case SdParam.Type.generalDelimiterName:
        this.appendString(builder, 'general delimiter name');
        break;
      case SdParam.Type.referenceReservedName:
        this.appendString(builder, 'reference reserved name');
        break;
      case SdParam.Type.quantityName:
        this.appendString(builder, 'quantity name');
        break;
      default:
        if (t >= SdParam.Type.reservedName) {
          // It's a specific reserved name
          const sdReservedName = t - SdParam.Type.reservedName;
          const sd = this.sd_.pointer();
          if (sd) {
            const name = sd.reservedName(sdReservedName);
            builder.appendChars(name.data(), name.size());
          }
        }
        break;
    }
  }
}

/**
 * StandardSyntaxSpec - specification for standard syntax (core or reference)
 */
export interface StandardSyntaxSpec {
  addedFunction: StandardSyntaxSpec.AddedFunction[];
  nAddedFunction: number;
  shortref: Boolean;
}

export namespace StandardSyntaxSpec {
  export interface AddedFunction {
    name: string;
    functionClass: number;  // Syntax.FunctionClass
    syntaxChar: SyntaxChar;
  }
}

// Core syntax specification (minimal)
export const coreSyntax: StandardSyntaxSpec = {
  addedFunction: [
    { name: 'TAB', functionClass: Syntax.FunctionClass.cSEPCHAR, syntaxChar: 9 }
  ],
  nAddedFunction: 1,
  shortref: false
};

// Reference syntax specification (with shortrefs)
export const refSyntax: StandardSyntaxSpec = {
  addedFunction: [
    { name: 'TAB', functionClass: Syntax.FunctionClass.cSEPCHAR, syntaxChar: 9 }
  ],
  nAddedFunction: 1,
  shortref: true
};
