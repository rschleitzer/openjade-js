// Copyright (c) 1994, 1995, 1996 James Clark
// See the file COPYING for copying permission.

import { Char, Index } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Resource } from './Resource';
import { EntityManager } from './EntityManager';
import { EntityCatalog } from './EntityCatalog';
import { ConstPtr, Ptr } from './Ptr';
import { InputSource } from './InputSource';
import { InputSourceOrigin, Location } from './Location';
import { CharsetInfo } from './CharsetInfo';
import { Vector } from './Vector';
import { Owner } from './Owner';

// Forward declarations
export interface Messenger {
  // Defined in Message.ts
}

// StorageObjectSpec - specification for a storage object (file, URL, etc.)
export class StorageObjectSpec {
  storageManager: StorageManager | null;
  codingSystem: InputCodingSystem | null;
  codingSystemName: StringC;
  id: StringC;
  baseId: StringC;
  records: number; // RecordType enum
  zapEof: PackedBoolean;
  search: PackedBoolean;
  isNdata: PackedBoolean;

  static readonly RecordType = {
    find: 0,
    cr: 1,
    lf: 2,
    crlf: 3,
    asis: 4
  } as const;

  constructor() {
    this.storageManager = null;
    this.codingSystem = null;
    this.codingSystemName = new StringOf<Char>();
    this.id = new StringOf<Char>();
    this.baseId = new StringOf<Char>();
    this.records = StorageObjectSpec.RecordType.find;
    this.zapEof = true;
    this.search = false;
    this.isNdata = false;
  }
}

// ParsedSystemId - parsed form of a system identifier
export class ParsedSystemId extends Vector<StorageObjectSpec> {
  private maps_: Vector<StorageObjectSpec[]>;

  constructor() {
    super();
    this.maps_ = new Vector<StorageObjectSpec[]>();
  }

  // FSI map handling
  addMap(map: StorageObjectSpec[]): void {
    this.maps_.push_back(map);
  }

  nMaps(): number {
    return this.maps_.size();
  }

  getMap(i: number): StorageObjectSpec[] {
    return this.maps_.get(i);
  }
}

// StorageManager - abstract base class for storage access
export abstract class StorageManager extends Resource {
  abstract makeStorageObject(
    id: StringC,
    baseId: StringC,
    search: Boolean,
    mayRewind: Boolean,
    messenger: Messenger,
    result: { object: StorageObject | null }
  ): Boolean;

  abstract idCharset(): CharsetInfo;

  abstract resolveRelative(
    base: StringC,
    relative: StringC,
    isNdata: Boolean
  ): Boolean;

  abstract guessIsId(id: StringC, charset: CharsetInfo): Boolean;
}

// StorageObject - abstract base class for storage access
export abstract class StorageObject {
  abstract read(buf: Uint8Array, maxBytes: number, result: { bytesRead: number }): Boolean;
  abstract rewind(messenger: Messenger): Boolean;
  abstract getSystemId(result: { id: StringC }): Boolean;
}

// InputCodingSystem - handles character encoding
export interface InputCodingSystem {
  makeDecoder(): Decoder;
  // Name of the coding system
  name(): string;
}

// Decoder - decodes bytes to characters
export interface Decoder {
  decode(
    input: Uint8Array,
    inputOffset: number,
    inputLength: number,
    output: Char[],
    outputOffset: number,
    result: { bytesUsed: number; charsWritten: number }
  ): void;
  // Returns minimum bytes per character
  minBytesPerChar(): number;
}

// UTF-8 Decoder implementation
export class Utf8Decoder implements Decoder {
  decode(
    input: Uint8Array,
    inputOffset: number,
    inputLength: number,
    output: Char[],
    outputOffset: number,
    result: { bytesUsed: number; charsWritten: number }
  ): void {
    let bytesUsed = 0;
    let charsWritten = 0;
    let i = inputOffset;
    const end = inputOffset + inputLength;

    while (i < end) {
      const b = input[i];
      let codePoint: number;
      let bytesNeeded: number;

      if ((b & 0x80) === 0) {
        // ASCII
        codePoint = b;
        bytesNeeded = 1;
      } else if ((b & 0xe0) === 0xc0) {
        // 2-byte sequence
        if (i + 1 >= end) break;
        codePoint = ((b & 0x1f) << 6) | (input[i + 1] & 0x3f);
        bytesNeeded = 2;
      } else if ((b & 0xf0) === 0xe0) {
        // 3-byte sequence
        if (i + 2 >= end) break;
        codePoint = ((b & 0x0f) << 12) | ((input[i + 1] & 0x3f) << 6) | (input[i + 2] & 0x3f);
        bytesNeeded = 3;
      } else if ((b & 0xf8) === 0xf0) {
        // 4-byte sequence
        if (i + 3 >= end) break;
        codePoint = ((b & 0x07) << 18) | ((input[i + 1] & 0x3f) << 12) |
                    ((input[i + 2] & 0x3f) << 6) | (input[i + 3] & 0x3f);
        bytesNeeded = 4;
      } else {
        // Invalid UTF-8, use replacement character
        codePoint = 0xFFFD;
        bytesNeeded = 1;
      }

      output[outputOffset + charsWritten] = codePoint;
      charsWritten++;
      bytesUsed += bytesNeeded;
      i += bytesNeeded;
    }

    result.bytesUsed = bytesUsed;
    result.charsWritten = charsWritten;
  }

  minBytesPerChar(): number {
    return 1;
  }
}

// UTF-8 Coding System
export class Utf8CodingSystem implements InputCodingSystem {
  makeDecoder(): Decoder {
    return new Utf8Decoder();
  }

  name(): string {
    return 'UTF-8';
  }
}

// Latin-1 (ISO-8859-1) Decoder
export class Latin1Decoder implements Decoder {
  decode(
    input: Uint8Array,
    inputOffset: number,
    inputLength: number,
    output: Char[],
    outputOffset: number,
    result: { bytesUsed: number; charsWritten: number }
  ): void {
    for (let i = 0; i < inputLength; i++) {
      output[outputOffset + i] = input[inputOffset + i];
    }
    result.bytesUsed = inputLength;
    result.charsWritten = inputLength;
  }

  minBytesPerChar(): number {
    return 1;
  }
}

// Latin-1 Coding System
export class Latin1CodingSystem implements InputCodingSystem {
  makeDecoder(): Decoder {
    return new Latin1Decoder();
  }

  name(): string {
    return 'ISO-8859-1';
  }
}

// FileStorageObject - reads from Node.js file system
export class FileStorageObject extends StorageObject {
  private buffer_: Uint8Array | null;
  private position_: number;
  private systemId_: StringC;

  constructor(contents: Uint8Array, systemId: StringC) {
    super();
    this.buffer_ = contents;
    this.position_ = 0;
    this.systemId_ = systemId;
  }

  read(buf: Uint8Array, maxBytes: number, result: { bytesRead: number }): Boolean {
    if (!this.buffer_) {
      result.bytesRead = 0;
      return false;
    }

    const remaining = this.buffer_.length - this.position_;
    const toRead = Math.min(maxBytes, remaining);

    if (toRead > 0) {
      buf.set(this.buffer_.subarray(this.position_, this.position_ + toRead));
      this.position_ += toRead;
    }

    result.bytesRead = toRead;
    return true;
  }

  rewind(messenger: Messenger): Boolean {
    this.position_ = 0;
    return true;
  }

  getSystemId(result: { id: StringC }): Boolean {
    result.id = this.systemId_;
    return true;
  }
}

// FileStorageManager - manages file system access
export class FileStorageManager extends StorageManager {
  private charset_: CharsetInfo;
  private fileReader_: ((path: string) => Uint8Array | null) | null;

  constructor(charset: CharsetInfo, fileReader?: (path: string) => Uint8Array | null) {
    super();
    this.charset_ = charset;
    this.fileReader_ = fileReader || null;
  }

  setFileReader(reader: (path: string) => Uint8Array | null): void {
    this.fileReader_ = reader;
  }

  makeStorageObject(
    id: StringC,
    baseId: StringC,
    search: Boolean,
    mayRewind: Boolean,
    messenger: Messenger,
    result: { object: StorageObject | null }
  ): Boolean {
    // Convert StringC to JavaScript string for file path
    const path = this.stringCToPath(id);

    if (!this.fileReader_) {
      result.object = null;
      return false;
    }

    const contents = this.fileReader_(path);
    if (!contents) {
      result.object = null;
      return false;
    }

    result.object = new FileStorageObject(contents, id);
    return true;
  }

  idCharset(): CharsetInfo {
    return this.charset_;
  }

  resolveRelative(base: StringC, relative: StringC, isNdata: Boolean): Boolean {
    // Simple relative path resolution
    // Full implementation would handle .. and . paths
    return true;
  }

  guessIsId(id: StringC, charset: CharsetInfo): Boolean {
    // Check if it looks like a file path
    return id.size() > 0;
  }

  private stringCToPath(str: StringC): string {
    let result = '';
    for (let i = 0; i < str.size(); i++) {
      result += String.fromCodePoint(str.get(i));
    }
    return result;
  }
}

// ExtendEntityManager - concrete implementation of EntityManager
export class ExtendEntityManager extends EntityManager {
  private defaultStorageManager_: StorageManager | null;
  private defaultCodingSystem_: InputCodingSystem;
  private internalCharsetIsDocCharset_: PackedBoolean;
  private charset_: CharsetInfo;
  private catalogManager_: CatalogManager | null;
  private storageManagers_: StorageManager[];

  constructor(
    defaultStorageManager: StorageManager | null,
    defaultCodingSystem: InputCodingSystem,
    charset: CharsetInfo,
    internalCharsetIsDocCharset: Boolean
  ) {
    super();
    this.defaultStorageManager_ = defaultStorageManager;
    this.defaultCodingSystem_ = defaultCodingSystem;
    this.charset_ = charset;
    this.internalCharsetIsDocCharset_ = internalCharsetIsDocCharset;
    this.catalogManager_ = null;
    this.storageManagers_ = [];
  }

  setCatalogManager(catalogManager: CatalogManager): void {
    this.catalogManager_ = catalogManager;
  }

  registerStorageManager(sm: StorageManager): void {
    this.storageManagers_.push(sm);
  }

  internalCharsetIsDocCharset(): Boolean {
    return this.internalCharsetIsDocCharset_;
  }

  charset(): CharsetInfo {
    return this.charset_;
  }

  open(
    sysid: StringC,
    docCharset: CharsetInfo,
    origin: InputSourceOrigin | null,
    flags: number,
    mgr: Messenger
  ): InputSource | null {
    // Parse the system identifier
    const parsedSysid = new ParsedSystemId();

    // Simple implementation: treat sysid as a file path
    const spec = new StorageObjectSpec();
    spec.id = sysid;
    spec.storageManager = this.defaultStorageManager_;
    spec.codingSystem = this.defaultCodingSystem_;
    parsedSysid.push_back(spec);

    // Try to open via storage manager
    if (this.defaultStorageManager_) {
      const result = { object: null as StorageObject | null };
      const mayRewind = (flags & EntityManager.mayRewind) !== 0;

      if (this.defaultStorageManager_.makeStorageObject(
        sysid,
        new StringOf<Char>(),
        false,
        mayRewind,
        mgr,
        result
      )) {
        if (result.object) {
          // Create ExternalInputSource
          return new ExternalInputSource(
            parsedSysid,
            this.charset_,
            docCharset,
            this.internalCharsetIsDocCharset_,
            0xFFFD, // replacement character
            origin
          );
        }
      }
    }

    return null;
  }

  makeCatalog(
    systemId: StringC,
    charset: CharsetInfo,
    mgr: Messenger
  ): ConstPtr<EntityCatalog> {
    // Return a default catalog
    // Full implementation would parse SGML Open catalogs
    return new ConstPtr<EntityCatalog>(new DefaultEntityCatalog());
  }
}

// CatalogManager - manages entity catalogs
export interface CatalogManager {
  makeCatalog(systemId: StringC, charset: CharsetInfo, mgr: Messenger): EntityCatalog | null;
}

// DefaultEntityCatalog - simple default catalog implementation
export class DefaultEntityCatalog extends EntityCatalog {
  lookup(
    entity: any,
    syntax: any,
    charset: CharsetInfo,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    // Default implementation: no catalog lookup
    return false;
  }

  lookupPublic(
    publicId: StringC,
    charset: CharsetInfo,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    return false;
  }

  lookupDoctype(
    name: StringC,
    charset: CharsetInfo,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    return false;
  }

  lookupSgmlDecl(
    charset: CharsetInfo,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    return false;
  }
}

// ExternalInputSource - input source for external entities
export class ExternalInputSource extends InputSource {
  private parsedSysid_: ParsedSystemId;
  private internalCharset_: CharsetInfo;
  private docCharset_: CharsetInfo;
  private internalCharsetIsDocCharset_: Boolean;
  private replacementChar_: Char;

  constructor(
    parsedSysid: ParsedSystemId,
    internalCharset: CharsetInfo,
    docCharset: CharsetInfo,
    internalCharsetIsDocCharset: Boolean,
    replacementChar: Char,
    origin: InputSourceOrigin | null
  ) {
    super(origin, null, 0, 0);
    this.parsedSysid_ = parsedSysid;
    this.internalCharset_ = internalCharset;
    this.docCharset_ = docCharset;
    this.internalCharsetIsDocCharset_ = internalCharsetIsDocCharset;
    this.replacementChar_ = replacementChar;
  }

  pushCharRef(ch: Char, ref: any): void {
    // Character reference handling
  }

  rewind(mgr: Messenger): Boolean {
    return false;
  }

  protected fill(mgr: Messenger): number {
    // End of input
    return InputSource.eE;
  }
}

// Factory function to create a standard entity manager
export function createExtendEntityManager(
  charset: CharsetInfo,
  fileReader?: (path: string) => Uint8Array | null
): ExtendEntityManager {
  const storageManager = new FileStorageManager(charset, fileReader);
  const codingSystem = new Utf8CodingSystem();

  return new ExtendEntityManager(
    storageManager,
    codingSystem,
    charset,
    true // internalCharsetIsDocCharset
  );
}
