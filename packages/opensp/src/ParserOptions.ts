// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Number } from './types';
import { PackedBoolean } from './Boolean';
import { EventsWanted } from './EventsWanted';
import { Vector } from './Vector';
import { StringC } from './StringC';

export class Warnings {
  warnSgmlDecl: PackedBoolean;
  warnDuplicateEntity: PackedBoolean;
  warnShould: PackedBoolean;
  warnUndefinedElement: PackedBoolean;
  warnDefaultEntityReference: PackedBoolean;
  warnMixedContent: PackedBoolean;
  warnEmptyTag: PackedBoolean;
  warnUnusedMap: PackedBoolean;
  warnUnusedParam: PackedBoolean;
  warnNotationSystemId: PackedBoolean;
  warnInclusion: PackedBoolean;
  warnExclusion: PackedBoolean;
  warnRcdataContent: PackedBoolean;
  warnCdataContent: PackedBoolean;
  warnPsComment: PackedBoolean;
  warnElementGroupDecl: PackedBoolean;
  warnAttlistGroupDecl: PackedBoolean;
  warnPiEntity: PackedBoolean;
  warnInternalSdataEntity: PackedBoolean;
  warnInternalCdataEntity: PackedBoolean;
  warnExternalSdataEntity: PackedBoolean;
  warnExternalCdataEntity: PackedBoolean;
  warnBracketEntity: PackedBoolean;
  warnDataAttributes: PackedBoolean;
  warnMissingSystemId: PackedBoolean;
  warnConref: PackedBoolean;
  warnCurrent: PackedBoolean;
  warnNutokenDeclaredValue: PackedBoolean;
  warnNumberDeclaredValue: PackedBoolean;
  warnNameDeclaredValue: PackedBoolean;
  warnNamedCharRef: PackedBoolean;
  warnRefc: PackedBoolean;
  warnTempMarkedSection: PackedBoolean;
  warnRcdataMarkedSection: PackedBoolean;
  warnInstanceIncludeMarkedSection: PackedBoolean;
  warnInstanceIgnoreMarkedSection: PackedBoolean;
  warnAndGroup: PackedBoolean;
  warnRank: PackedBoolean;
  warnEmptyCommentDecl: PackedBoolean;
  warnAttributeValueNotLiteral: PackedBoolean;
  warnMissingAttributeName: PackedBoolean;
  warnCommentDeclS: PackedBoolean;
  warnCommentDeclMultiple: PackedBoolean;
  warnMissingStatusKeyword: PackedBoolean;
  warnMultipleStatusKeyword: PackedBoolean;
  warnInstanceParamEntityRef: PackedBoolean;
  warnMinimizationParam: PackedBoolean;
  warnMixedContentRepOrGroup: PackedBoolean;
  warnNameGroupNotOr: PackedBoolean;
  warnPiMissingName: PackedBoolean;
  warnInstanceStatusKeywordSpecS: PackedBoolean;
  warnExternalDataEntityRef: PackedBoolean;
  warnAttributeValueExternalEntityRef: PackedBoolean;
  warnDataDelim: PackedBoolean;
  warnExplicitSgmlDecl: PackedBoolean;
  warnInternalSubsetMarkedSection: PackedBoolean;
  warnDefaultEntityDecl: PackedBoolean;
  warnNonSgmlCharRef: PackedBoolean;
  warnInternalSubsetPsParamEntityRef: PackedBoolean;
  warnInternalSubsetTsParamEntityRef: PackedBoolean;
  warnInternalSubsetLiteralParamEntityRef: PackedBoolean;
  warnImmediateRecursion: PackedBoolean;

  constructor() {
    // Initialize all warnings to false - memset equivalent
    this.warnSgmlDecl = false;
    this.warnDuplicateEntity = false;
    this.warnShould = false;
    this.warnUndefinedElement = false;
    this.warnDefaultEntityReference = false;
    this.warnMixedContent = false;
    this.warnEmptyTag = false;
    this.warnUnusedMap = false;
    this.warnUnusedParam = false;
    this.warnNotationSystemId = false;
    this.warnInclusion = false;
    this.warnExclusion = false;
    this.warnRcdataContent = false;
    this.warnCdataContent = false;
    this.warnPsComment = false;
    this.warnElementGroupDecl = false;
    this.warnAttlistGroupDecl = false;
    this.warnPiEntity = false;
    this.warnInternalSdataEntity = false;
    this.warnInternalCdataEntity = false;
    this.warnExternalSdataEntity = false;
    this.warnExternalCdataEntity = false;
    this.warnBracketEntity = false;
    this.warnDataAttributes = false;
    this.warnMissingSystemId = false;
    this.warnConref = false;
    this.warnCurrent = false;
    this.warnNutokenDeclaredValue = false;
    this.warnNumberDeclaredValue = false;
    this.warnNameDeclaredValue = false;
    this.warnNamedCharRef = false;
    this.warnRefc = false;
    this.warnTempMarkedSection = false;
    this.warnRcdataMarkedSection = false;
    this.warnInstanceIncludeMarkedSection = false;
    this.warnInstanceIgnoreMarkedSection = false;
    this.warnAndGroup = false;
    this.warnRank = false;
    this.warnEmptyCommentDecl = false;
    this.warnAttributeValueNotLiteral = false;
    this.warnMissingAttributeName = false;
    this.warnCommentDeclS = false;
    this.warnCommentDeclMultiple = false;
    this.warnMissingStatusKeyword = false;
    this.warnMultipleStatusKeyword = false;
    this.warnInstanceParamEntityRef = false;
    this.warnMinimizationParam = false;
    this.warnMixedContentRepOrGroup = false;
    this.warnNameGroupNotOr = false;
    this.warnPiMissingName = false;
    this.warnInstanceStatusKeywordSpecS = false;
    this.warnExternalDataEntityRef = false;
    this.warnAttributeValueExternalEntityRef = false;
    this.warnDataDelim = false;
    this.warnExplicitSgmlDecl = false;
    this.warnInternalSubsetMarkedSection = false;
    this.warnDefaultEntityDecl = false;
    this.warnNonSgmlCharRef = false;
    this.warnInternalSubsetPsParamEntityRef = false;
    this.warnInternalSubsetTsParamEntityRef = false;
    this.warnInternalSubsetLiteralParamEntityRef = false;
    this.warnImmediateRecursion = false;
  }
}

export enum Quantity {
  ATTCNT,
  ATTSPLEN,
  BSEQLEN,
  DTAGLEN,
  DTEMPLEN,
  ENTLVL,
  GRPCNT,
  GRPGTCNT,
  GRPLVL,
  LITLEN,
  NAMELEN,
  NORMSEP,
  PILEN,
  TAGLEN,
  TAGLVL
}

export class ParserOptions extends Warnings {
  static readonly sgmlDeclTypeValid = -1;
  static readonly nQuantity = Quantity.TAGLVL + 1;

  eventsWanted: EventsWanted;
  datatag: PackedBoolean;
  omittag: PackedBoolean;
  rank: PackedBoolean;
  shorttag: PackedBoolean;
  emptynrm: PackedBoolean;
  linkSimple: Number;
  linkImplicit: PackedBoolean;
  linkExplicit: Number;
  concur: Number;
  subdoc: Number;
  formal: PackedBoolean;
  shortref: PackedBoolean;
  typeValid: number;
  quantity: Number[];
  errorIdref: PackedBoolean;
  errorSignificant: PackedBoolean;
  errorAfdr: PackedBoolean;
  noUnclosedTag: PackedBoolean;
  noNet: PackedBoolean;
  fullyDeclared: PackedBoolean;
  fullyTagged: PackedBoolean;
  amplyTagged: PackedBoolean;
  amplyTaggedAnyother: PackedBoolean;
  valid: PackedBoolean;
  entityRef: PackedBoolean;
  externalEntityRef: PackedBoolean;
  integral: PackedBoolean;
  includes: Vector<StringC>;

  constructor() {
    super();
    this.eventsWanted = new EventsWanted();
    this.datatag = false;
    this.omittag = true;
    this.rank = true;
    this.shorttag = true;
    this.emptynrm = false;
    this.linkSimple = 1000;
    this.linkImplicit = true;
    this.linkExplicit = 1;
    this.concur = 0;
    this.subdoc = 99999999;
    this.formal = true;
    this.typeValid = ParserOptions.sgmlDeclTypeValid;
    this.shortref = true;
    this.errorIdref = false; // Default to false to match original onsgmls behavior
    this.errorSignificant = true;
    this.errorAfdr = true;
    this.noUnclosedTag = false;
    this.noNet = false;
    this.fullyDeclared = false;
    this.fullyTagged = false;
    this.amplyTagged = false;
    this.amplyTaggedAnyother = false;
    this.valid = false;
    this.entityRef = false;
    this.externalEntityRef = false;
    this.integral = false;
    this.includes = new Vector<StringC>();

    // Initialize quantity array
    this.quantity = new Array<Number>(ParserOptions.nQuantity);
    for (let i = 0; i < ParserOptions.nQuantity; i++) {
      this.quantity[i] = 99999999;
    }
    this.quantity[Quantity.BSEQLEN] = 960;
    this.quantity[Quantity.NORMSEP] = 2;
    this.quantity[Quantity.LITLEN] = 24000;
    this.quantity[Quantity.PILEN] = 24000;
    this.quantity[Quantity.DTEMPLEN] = 24000;
  }
}
