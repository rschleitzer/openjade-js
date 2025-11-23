// OpenSP TypeScript Port - Main Exports
// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

// Core types
export * from './types';
export * from './Boolean';

// String classes
export { String } from './StringOf';
export { StringC } from './StringC';

// Container classes
export { Vector } from './Vector';
export { NCVector } from './NCVector';
export { Link } from './Link';
export { IListBase } from './IListBase';
export { IList } from './IList';
export { IListIterBase } from './IListIterBase';
export { IListIter } from './IListIter';
export { List, ListItem, ListIter } from './List';
export { IQueue, IQueueBase } from './IQueue';

// Smart pointers and resource management
export { Resource } from './Resource';
export { Ptr, ConstPtr } from './Ptr';
export { Owner } from './Owner';
export { CopyOwner, Copyable } from './CopyOwner';

// Named resources
export { Named } from './Named';
export { NamedResource } from './NamedResource';

// Utilities
export { Hash } from './Hash';
export { HashTable, HashTableIter, Hashable } from './HashTable';
export * from './constant';
export { Mode, nModes, minShortrefMode } from './Mode';
export { StringResource } from './StringResource';
export { SubstTable } from './SubstTable';
export { TypeId } from './TypeId';
export { ASSERT, CANNOT_HAPPEN, SIZEOF } from './macros';
export * from './sptchar';

// Location and origin tracking
export {
  Location,
  Origin,
  ProxyOrigin,
  BracketOrigin,
  ReplacementOrigin,
  MultiReplacementOrigin,
  InputSourceOrigin,
  EntityOrigin,
  ExternalInfo,
  NamedCharRef,
  InputSourceOriginNamedCharRef
} from './Location';
export { EntityDecl } from './EntityDecl';
export { EntityCatalog } from './EntityCatalog';
export { EntityManager } from './EntityManager';
export { Attributed } from './Attributed';
export { Notation } from './Notation';

// Text with location tracking
export { Text, TextItem, TextIter } from './Text';

// Character mapping utilities
export { CharMap, CharMapResource } from './CharMap';
export { XcharMap } from './XcharMap';
export { UnivCharsetDesc, UnivCharsetDescIter } from './UnivCharsetDesc';
export { CharsetInfo } from './CharsetInfo';
export { PublicId, ExternalId } from './ExternalId';

// Set and range utilities
export { ISet, ISetRange, ISetIter } from './ISet';
export { RangeMap, RangeMapRange, RangeMapIter } from './RangeMap';

// I/O streams
export { OutputByteStream, StrOutputByteStream, FileOutputByteStream } from './OutputByteStream';
export { InputSource } from './InputSource';
export { MarkupScan } from './MarkupScan';

// Coding systems
export { Decoder, Encoder, RecoveringEncoder, InputCodingSystem, OutputCodingSystem, CodingSystem } from './CodingSystem';
export { IdentityCodingSystem } from './IdentityCodingSystem';

// Message system
export { MessageBuilder } from './MessageBuilder';
export {
  MessageArg,
  StringMessageArg,
  NumberMessageArg,
  OrdinalMessageArg,
  OtherMessageArg,
  StringVectorMessageArg
} from './MessageArg';
export {
  MessageModule,
  libModule,
  appModule,
  MessageFragment,
  MessageType,
  MessageType0,
  MessageType1,
  MessageType2,
  MessageType3,
  MessageType4,
  MessageType5,
  MessageType6,
  MessageType0L,
  MessageType1L,
  OpenElementInfo,
  Message,
  Messenger,
  ForwardingMessenger,
  ParentLocationMessenger,
  NullMessenger
} from './Message';

// Parser and command-line options
export { EventsWanted } from './EventsWanted';
export { Warnings, ParserOptions, Quantity } from './ParserOptions';
export { Options, LongOption } from './Options';

// Table utilities
export { PointerTable, PointerTableIter, HashFunction, KeyFunction } from './PointerTable';
export { OwnerTable, OwnerTableIter, CopyOwnerTable } from './OwnerTable';
export { NamedTable, NamedTableIter, ConstNamedTableIter, NamedTableKeyFunction } from './NamedTable';
export { NamedResourceTable, NamedResourceTableIter, ConstNamedResourceTableIter, NamedResourceKeyFunction } from './NamedResourceTable';
