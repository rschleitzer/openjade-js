// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

// This file defines the Identifier interface - equivalent to C++ forward declaration.
// The actual implementation is IdentifierImpl in Interpreter.ts

import { Location, StringC } from '@openjade-js/opensp';

// Forward declarations using type-only imports
import type { ELObj } from './ELObj';
import type { InheritedC } from './Style';
import type { FlowObj } from './SosofoObj';

// Syntactic key enum - matches C++ Identifier::SyntacticKey
export enum SyntacticKey {
  notKey = 0,
  keyQuote,
  keyLambda,
  keyIf,
  keyCond,
  keyAnd,
  keyOr,
  keyCase,
  keyLet,
  keyLetStar,
  keyLetrec,
  keyQuasiquote,
  keyUnquote,
  keyUnquoteSplicing,
  keyDefine,
  keyElse,
  keyArrow,
  keySet,
  keyBegin,
  keyThereExists,
  keyForAll,
  keySelectEach,
  keyUnionForEach,
  keyMake,
  keyStyle,
  keyWithMode,
  keyDefineUnit,
  keyQuery,
  keyElement,
  keyDefault,
  keyRoot,
  keyId,
  keyMode,
  keyDeclareInitialValue,
  keyDeclareCharacteristic,
  keyDeclareFlowObjectClass,
  keyDeclareCharCharacteristicAndProperty,
  keyDeclareReferenceValueType,
  keyDeclareDefaultLanguage,
  keyDeclareCharProperty,
  keyDefinePageModel,
  keyDefineColumnSetModel,
  keyDefineLanguage,
  keyAddCharProperties,
  keyUse,
  keyLabel,
  keyContentMap,
  keyIsKeepWithPrevious,
  keyIsKeepWithNext,
  keySpaceBefore,
  keySpaceAfter,
  keyLeftHeader,
  keyCenterHeader,
  keyRightHeader,
  keyLeftFooter,
  keyCenterFooter,
  keyRightFooter,
  keyDestination,
  keyType,
  keyCoalesceId,
  keyIsDisplay,
  keyScale,
  keyScaleType,
  keyMaxWidth,
  keyMaxHeight,
  keyEntitySystemId,
  keyNotationSystemId,
  keyPositionPointX,
  keyPositionPointY,
  keyEscapementDirection,
  keyBreakBeforePriority,
  keyBreakAfterPriority,
  keyOrientation,
  keyLength,
  keyChar,
  keyGlyphId,
  keyIsSpace,
  keyIsRecordEnd,
  keyIsInputTab,
  keyIsInputWhitespace,
  keyIsPunct,
  keyIsDropAfterLineBreak,
  keyIsDropUnlessBeforeLineBreak,
  keyMathClass,
  keyMathFontPosture,
  keyScript,
  keyStretchFactor,
  keyKeep,
  keyBreakBefore,
  keyBreakAfter,
  keyIsMayViolateKeepBefore,
  keyIsMayViolateKeepAfter,
  keyBeforeRowBorder,
  keyAfterRowBorder,
  keyBeforeColumnBorder,
  keyAfterColumnBorder,
  keyColumnNumber,
  keyRowNumber,
  keyNColumnsSpanned,
  keyNRowsSpanned,
  keyWidth,
  keyIsStartsRow,
  keyIsEndsRow,
  keyTableWidth,
  keyMultiModes,
  keyNamedModes,
  keyPrincipalMode,
  keyColumnIndex,
  keyData,
  keyMin,
  keyMax,
  keyIsConditional,
  keyPriority,
  keyGridNRows,
  keyGridNColumns,
  keyRadical,
  keyNull,
  keyIsRcs,
  keyParent,
  keyActive,
  keyAttributes,
  keyChildren,
  keyRepeat,
  keyPosition,
  keyOnly,
  keyClass,
  keyImportance,
  keyDeclareClassAttribute,
  keyDeclareIdAttribute,
  keyDeclareFlowObjectMacro,
  keyOrElement,
  keyPositionPreference,
  keyCollate,
  keyToupper,
  keyTolower,
  keySymbol,
  keyOrder,
  keyForward,
  keyBackward,
  keyWhitePoint,
  keyBlackPoint,
  keyRange,
  keyRangeAbc,
  keyRangeLmn,
  keyRangeA,
  keyDecodeAbc,
  keyDecodeLmn,
  keyDecodeA,
  keyMatrixAbc,
  keyMatrixLmn,
  keyMatrixA,
  keyArchitecture
}

export const lastSyntacticKey = SyntacticKey.keyWithMode;

// Identifier interface - the actual implementation is IdentifierImpl in Interpreter.ts
// This matches the C++ forward declaration pattern: "class Identifier;"
// Forward declaration for Interpreter (to avoid circular dependency)
export interface InterpreterLike {
  makeError(): ELObj;
  setNextLocation(loc: Location): void;
  message(msgType: string, ...args: unknown[]): void;
}

export interface Identifier {
  name(): StringC;
  syntacticKey(sk: { value: SyntacticKey }): boolean;
  setSyntacticKey(sk: SyntacticKey): void;
  defined(part: { value: number }, loc: { value: Location | null }): boolean;
  setValue(val: ELObj, defPart?: number): void;
  evaluated(): boolean;
  inheritedC(): InheritedC | null;
  setInheritedC(ic: InheritedC | null, part?: number, loc?: Location): void;
  flowObj(): FlowObj | null;
  setFlowObj(fo: FlowObj | null, part?: number, loc?: Location): void;
  setCharNIC(part: number, loc: Location): void;
  computeValue(force: boolean, interp: InterpreterLike): ELObj | null;
}
