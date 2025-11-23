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
export { Link } from './Link';
export { IListBase } from './IListBase';
export { IList } from './IList';

// Smart pointers and resource management
export { Resource } from './Resource';
export { Ptr, ConstPtr } from './Ptr';
export { Owner } from './Owner';
export { CopyOwner, Copyable } from './CopyOwner';

// Named resources
export { Named } from './Named';
export { NamedResource } from './NamedResource';
