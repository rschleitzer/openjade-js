// Copyright (c) 1996 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { MessageType, MessageFragment } from './Message';

// ArcEngine message types - ported from ArcEngineMessages.msg
// Message numbers start at 3000

export const ArcEngineMessages = {
  arcGenerateSystemId: new MessageType(
    MessageType.Severity.error,
    'no system identifier could be generated for meta-DTD for architecture %1',
    3000
  ),
  undefinedElement: new MessageType(
    MessageType.Severity.error,
    'element type %1 not defined in meta-DTD',
    3001
  ),
  elementExcluded: new MessageType(
    MessageType.Severity.error,
    'element %1 invalid in meta-DTD because excluded',
    3002
  ),
  invalidElement: new MessageType(
    MessageType.Severity.error,
    'meta-DTD does not allow element %1 at this point',
    3003
  ),
  documentElementNotArc: new MessageType(
    MessageType.Severity.error,
    'document element must be instance of %1 element type form',
    3004
  ),
  unfinishedElement: new MessageType(
    MessageType.Severity.error,
    'element %1 unfinished in meta-DTD',
    3005
  ),
  renameMissingAttName: new MessageType(
    MessageType.Severity.error,
    'missing substitute name',
    3006
  ),
  renameToInvalid: new MessageType(
    MessageType.Severity.error,
    'substitute for non-existent architecture attribute %1',
    3007
  ),
  renameToDuplicate: new MessageType(
    MessageType.Severity.error,
    'substitute name for %1 already defined',
    3008
  ),
  renameFromInvalid: new MessageType(
    MessageType.Severity.error,
    'substitute name %1 is not the name of an attribute',
    3009
  ),
  missingId: new MessageType(
    MessageType.Severity.idrefError,
    'reference in architecture to non-existent ID %1',
    3010
  ),
  invalidArcContent: new MessageType(
    MessageType.Severity.error,
    'architectural content specified with #ARCCONT not allowed by meta-DTD',
    3011
  ),
  invalidSuppress: new MessageType(
    MessageType.Severity.error,
    'invalid value %1 for ArcSupr attribute',
    3012
  ),
  arcDtdNotDeclaredParameter: new MessageType(
    MessageType.Severity.error,
    'no declaration for meta-DTD parameter entity %1',
    3013
  ),
  arcDtdNotDeclaredGeneral: new MessageType(
    MessageType.Severity.error,
    'no declaration for meta-DTD general entity %1',
    3014
  ),
  arcDtdNotExternal: new MessageType(
    MessageType.Severity.error,
    'meta-DTD entity %1 must be external',
    3015
  ),
  noArcDTDAtt: new MessageType(
    MessageType.Severity.warning,
    'no ArcDTD architecture support attribute specified',
    3016
  ),
  noArcDataF: new MessageType(
    MessageType.Severity.error,
    'ArcDataF notation %1 not defined in meta-DTD',
    3017
  ),
  idMismatch: new MessageType(
    MessageType.Severity.error,
    'ID attribute %1 in meta-DTD not declared as ID in DTD',
    3018
  ),
  invalidArcAuto: new MessageType(
    MessageType.Severity.error,
    'invalid value %1 for ArcAuto architectural support attribute',
    3019
  ),
  noArcNotation: new MessageType(
    MessageType.Severity.error,
    'no notation declaration for architecture %1',
    3020
  ),
  invalidData: new MessageType(
    MessageType.Severity.error,
    'meta-DTD does not allow data at this point',
    3021
  ),
  invalidIgnD: new MessageType(
    MessageType.Severity.error,
    'invalid value %1 for ArcIgnD attribute',
    3022
  ),
  invalidQuantity: new MessageType(
    MessageType.Severity.error,
    'unrecognized quantity name %1',
    3024
  ),
  missingQuantityValue: new MessageType(
    MessageType.Severity.error,
    'no value specified for quantity %1',
    3025
  ),
  quantityValueTooLong: new MessageType(
    MessageType.Severity.error,
    'length of value %1 for quantity is too long',
    3026
  ),
  invalidDigit: new MessageType(
    MessageType.Severity.error,
    'invalid digit %1',
    3027
  ),
  arcIndrNotSupported: new MessageType(
    MessageType.Severity.error,
    'only value of nArcIndr for ArcIndr attribute supported',
    3028
  ),
  arcContDuplicate: new MessageType(
    MessageType.Severity.error,
    '#ARCCONT attribute already specified',
    3029
  ),
  arcContInvalid: new MessageType(
    MessageType.Severity.error,
    'invalid value %1 for #ARCCONT',
    3030
  ),
  renameFromDuplicate: new MessageType(
    MessageType.Severity.error,
    '%1 already used as a substitute name',
    3031
  ),
  contentDuplicate: new MessageType(
    MessageType.Severity.error,
    'substitute name #CONTENT already specified',
    3032
  ),
  is10744PiKeywordMissing: new MessageType(
    MessageType.Severity.error,
    'IS10744 PI keyword missing',
    3033
  ),
  is10744PiKeywordInvalid: new MessageType(
    MessageType.Severity.error,
    'invalid IS10744 PI keyword %1',
    3034
  ),
  duplicateArcDecl: new MessageType(
    MessageType.Severity.error,
    'architecture %1 already defined',
    3035
  ),
  ignoringPiArcDecl: new MessageType(
    MessageType.Severity.warning,
    'ignoring PI declaration of architecture %1',
    3036
  ),
  ignoringArcBaseArcDecl: new MessageType(
    MessageType.Severity.warning,
    'ignoring ArcBase declaration of architecture %1',
    3037
  )
};
