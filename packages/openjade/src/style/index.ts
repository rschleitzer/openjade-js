// Copyright (c) 1996, 1997 James Clark
// See the file copying.txt for copying permission.

// Style module exports

export * from './Collector';
export * from './FOTBuilder';
// Re-export from ELObj with explicit names to avoid collision with FOTBuilder.LengthSpec
export {
  Interpreter,
  EvalContext,
  Unit,
  Identifier,
  OutputCharStream,
  QuantityType,
  ELObj,
  ErrorObj,
  UnspecifiedObj,
  NilObj,
  TrueObj,
  FalseObj,
  SymbolObj,
  KeywordObj,
  PairObj,
  VectorObj,
  CharObj,
  StringObj,
  IntegerObj,
  RealObj,
  LengthObj,
  QuantityObj,
  LengthSpec as ELObjLengthSpec,
  LengthSpecObj,
  DisplaySpaceObj,
  InlineSpaceObj,
  UnresolvedQuantityObj,
  UnresolvedLengthObj,
  GlyphIdObj,
  GlyphSubstTableObj,
  AddressObj,
  NodeListObj,
  NamedNodeListObj,
  NodePtrNodeListObj,
  EmptyNodeListObj,
  PairNodeListObj,
  FunctionObj,
  SosofoObj,
  AppendSosofoObj,
  ColorObj,
  ColorSpaceObj,
  StyleObj,
  BoxObj,
  LanguageObj,
  Signature,
  InsnPtr as ELObjInsnPtr,
  InheritedC,
  FlowObj as ELObjFlowObj
} from './ELObj';

// Export Expression module
export * from './Expression';

// Export SgmlFOTBuilder
export { SgmlFOTBuilder, makeSgmlFOTBuilder } from './SgmlFOTBuilder';

// Export DssslApp - the main application class
export { DssslApp } from './DssslApp';

// Export StyleEngine and related interfaces
export { StyleEngine, FOTBuilderExtension, GroveManager } from './StyleEngine';

// Export TransformFOTBuilder and output streams
export {
  TransformFOTBuilder,
  makeTransformFOTBuilder,
  FileOutputStream,
  StringOutputStream,
  RecordOutputStream,
  OutputCharStream as TransformOutputCharStream,
  DocumentTypeNIC,
  ElementNIC
} from './TransformFOTBuilder';

// Export RtfFOTBuilder
export { RtfFOTBuilder, makeRtfFOTBuilder } from './RtfFOTBuilder';

// Export TeXFOTBuilder
export { TeXFOTBuilder, makeTeXFOTBuilder } from './TeXFOTBuilder';

// Export MifFOTBuilder
export { MifFOTBuilder, makeMifFOTBuilder } from './MifFOTBuilder';
