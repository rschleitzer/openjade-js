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

  // Port of EntityManagerImpl::open from ExtendEntityManager.cxx lines 312-329
  open(
    sysid: StringC,
    docCharset: CharsetInfo,
    origin: InputSourceOrigin | null,
    flags: number,
    mgr: Messenger
  ): InputSource | null {
    // Parse the system identifier into ParsedSystemId
    // Port of parseSystemId call from line 319-321
    const parsedSysid = new ParsedSystemId();

    // Simple implementation: treat sysid as a file path
    const spec = new StorageObjectSpec();
    spec.id = sysid;
    spec.baseId = new StringOf<Char>();
    spec.storageManager = this.defaultStorageManager_;
    spec.codingSystem = this.defaultCodingSystem_;
    spec.records = StorageObjectSpec.RecordType.find;
    spec.search = false;
    parsedSysid.push_back(spec);

    // Check we have a storage manager
    if (!this.defaultStorageManager_) {
      return null;
    }

    // Create ExternalInputSource - it will lazily open the file in fill()
    // Port of line 323-328
    return new ExternalInputSource(
      parsedSysid,
      this.charset_,
      docCharset,
      this.internalCharsetIsDocCharset_,
      0xFFFD, // replacement character
      origin,
      flags
    );
  }

  makeCatalog(
    systemId: StringC,
    charset: CharsetInfo,
    mgr: Messenger
  ): ConstPtr<EntityCatalog> {
    // Port of EntityManagerImpl::makeCatalog from ExtendEntityManager.cxx
    // If we have a catalog manager, delegate to it
    if (this.catalogManager_) {
      const catalog = this.catalogManager_.makeCatalog(systemId, charset, this, mgr);
      if (catalog) {
        return catalog;
      }
    }
    // Return a default catalog
    return new ConstPtr<EntityCatalog>(new DefaultEntityCatalog());
  }

  // Port of EntityManagerImpl::expandSystemId from ExtendEntityManager.cxx
  // Expands a system ID relative to a base location
  expandSystemId(
    str: StringC,
    loc: Location,
    isNdata: Boolean,
    charset: CharsetInfo,
    lookupPublicId: StringC | null,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    // Simple implementation: if str is an absolute path or no location, use as-is
    // Otherwise resolve relative to the location's storage object
    if (str.size() === 0) {
      return false;
    }

    // For now, just copy the system ID to result (simple file path handling)
    // Full implementation would handle relative path resolution, storage manager lookup, etc.
    result.assign(str.data(), str.size());
    return true;
  }
}

// Flag for open() - entity may not exist
export const mayNotExist = 0o1;

// CatalogManager - manages entity catalogs
export interface CatalogManager {
  makeCatalog(systemId: StringC, charset: CharsetInfo, em: ExtendEntityManager | null, mgr: Messenger): ConstPtr<EntityCatalog> | null;
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
// Port of ExternalInputSource from ExtendEntityManager.cxx (lines 144-203, 576-1015)
export class ExternalInputSource extends InputSource {
  private parsedSysid_: ParsedSystemId;
  private internalCharset_: CharsetInfo;
  private docCharset_: CharsetInfo;
  private internalCharsetIsDocCharset_: Boolean;
  private replacementChar_: Char;
  private mayRewind_: Boolean;
  private mayNotExist_: Boolean;

  // Storage object vector and current storage object
  // Port of NCVector<Owner<StorageObject>> sov_ and StorageObject *so_
  private sov_: (StorageObject | null)[];
  private so_: StorageObject | null;
  private soIndex_: number;

  // RS (Record Start) insertion tracking
  private insertRS_: Boolean;

  // Record type handling
  private static readonly RecordType = {
    unknown: 0,
    crUnknown: 1,
    crlf: 2,
    lf: 3,
    cr: 4,
    asis: 5
  } as const;
  private recordType_: number;

  constructor(
    parsedSysid: ParsedSystemId,
    internalCharset: CharsetInfo,
    docCharset: CharsetInfo,
    internalCharsetIsDocCharset: Boolean,
    replacementChar: Char,
    origin: InputSourceOrigin | null,
    flags: number = 0
  ) {
    super(origin, null, 0, 0);
    this.parsedSysid_ = parsedSysid;
    this.internalCharset_ = internalCharset;
    this.docCharset_ = docCharset;
    this.internalCharsetIsDocCharset_ = internalCharsetIsDocCharset;
    this.replacementChar_ = replacementChar;
    this.mayRewind_ = (flags & EntityManager.mayRewind) !== 0;
    this.mayNotExist_ = false;

    // Initialize storage object vector with nulls (lazy loading)
    // Port of sov_(parsedSysid.size()) and for loop setting sov_[i] = 0
    this.sov_ = new Array(parsedSysid.size());
    for (let i = 0; i < this.sov_.length; i++) {
      this.sov_[i] = null;
    }

    // Initialize state
    this.init();
  }

  // Port of ExternalInputSource::init() from ExtendEntityManager.cxx lines 673-684
  private init(): void {
    this.so_ = null;
    this.insertRS_ = true;
    this.soIndex_ = 0;
    this.recordType_ = ExternalInputSource.RecordType.unknown;
    // Reset base class buffer state
    this.buffer_ = [];
    this.start_ = 0;
    this.cur_ = 0;
    this.end_ = 0;
  }

  pushCharRef(ch: Char, ref: any): void {
    // Character reference handling - insert character into stream
  }

  rewind(mgr: Messenger): Boolean {
    if (!this.mayRewind_) return false;
    this.init();
    for (let i = 0; i < this.soIndex_; i++) {
      if (this.sov_[i] && !this.sov_[i]!.rewind(mgr)) {
        return false;
      }
    }
    return true;
  }

  // Port of ExternalInputSource::fill() from ExtendEntityManager.cxx lines 744-1015
  // This version properly uses the base class buffer_ for compatibility with ungetToken()
  protected fill(mgr: Messenger): number {
    // fill() is called when cur_ >= end_, meaning we've consumed all buffered data
    // We need to read more data into buffer_ and return the next character

    // Need more data - loop until we get data or reach end
    while (true) {
      // Lazy create storage object if needed
      while (this.so_ === null) {
        if (this.soIndex_ >= this.sov_.length) {
          return InputSource.eE; // End of all storage objects
        }

        const spec = this.parsedSysid_.get(this.soIndex_);
        if (!spec || !spec.storageManager) {
          this.soIndex_++;
          continue;
        }

        // Create storage object if not already created
        // Port of spec.storageManager->makeStorageObject(...) from line 760-768
        if (!this.sov_[this.soIndex_]) {
          const result = { object: null as StorageObject | null };
          const id = new StringOf<Char>();
          if (spec.storageManager.makeStorageObject(
            spec.id,
            spec.baseId,
            spec.search,
            this.mayRewind_,
            mgr,
            result
          )) {
            this.sov_[this.soIndex_] = result.object;
          }
        }

        this.so_ = this.sov_[this.soIndex_];
        if (this.so_) {
          this.soIndex_++;
          break;
        } else {
          this.setAccessError();
          this.soIndex_++;
        }
      }

      if (!this.so_) {
        return InputSource.eE;
      }

      // Read bytes from storage object
      const readBuf = new Uint8Array(4096);
      const result = { bytesRead: 0 };
      if (!this.so_.read(readBuf, readBuf.length, result) || result.bytesRead === 0) {
        this.so_ = null;
        continue; // Try next storage object
      }

      // Keep data from start_ to cur_ (current token being built)
      // In the original C++, this is: size_t keepSize = end() - start()
      // After a read completes, start_ and cur_ might point to data we need to keep
      const keepSize = this.end_ - this.start_;

      // Create new buffer with kept data + new decoded data
      const newChars: Char[] = [];

      // Copy kept data first (data from start_ to end_ that's part of current token)
      for (let j = this.start_; j < this.end_; j++) {
        newChars.push(this.buffer_[j]);
      }

      // Track where new data starts (for adjusting cur_ if needed)
      const newDataStartIdx = newChars.length;

      // Insert RS at start of storage object if needed
      if (this.insertRS_) {
        newChars.push(10); // RS = newline (record start)
        this.insertRS_ = false;
      }

      // Simple UTF-8 decoding
      let i = 0;
      while (i < result.bytesRead) {
        const byte = readBuf[i];
        let codePoint: number;

        if (byte < 0x80) {
          // ASCII
          codePoint = byte;
          i++;
        } else if ((byte & 0xE0) === 0xC0) {
          // 2-byte sequence
          if (i + 1 < result.bytesRead) {
            codePoint = ((byte & 0x1F) << 6) | (readBuf[i + 1] & 0x3F);
            i += 2;
          } else {
            codePoint = this.replacementChar_;
            i++;
          }
        } else if ((byte & 0xF0) === 0xE0) {
          // 3-byte sequence
          if (i + 2 < result.bytesRead) {
            codePoint = ((byte & 0x0F) << 12) | ((readBuf[i + 1] & 0x3F) << 6) | (readBuf[i + 2] & 0x3F);
            i += 3;
          } else {
            codePoint = this.replacementChar_;
            i++;
          }
        } else if ((byte & 0xF8) === 0xF0) {
          // 4-byte sequence
          if (i + 3 < result.bytesRead) {
            codePoint = ((byte & 0x07) << 18) | ((readBuf[i + 1] & 0x3F) << 12) |
                        ((readBuf[i + 2] & 0x3F) << 6) | (readBuf[i + 3] & 0x3F);
            i += 4;
          } else {
            codePoint = this.replacementChar_;
            i++;
          }
        } else {
          codePoint = this.replacementChar_;
          i++;
        }

        // Handle record separators (simplified: treat LF as RE, insert RS after)
        if (codePoint === 10) { // LF
          // If we have a pending RS from a previous line ending, insert it first.
          // This handles consecutive line endings (blank lines) correctly:
          // Input: LF LF -> Output: RE RS RE RS (not RE RE RS)
          if (this.insertRS_) {
            newChars.push(10); // RS (record start)
            this.insertRS_ = false;
          }
          newChars.push(13); // RE (carriage return in SGML terminology)
          this.insertRS_ = true;
        } else if (codePoint === 13) { // CR
          // Skip CR, will be handled with following LF if CRLF
          if (i < result.bytesRead && readBuf[i] === 10) {
            // CRLF - skip the CR, LF will be converted
            continue;
          }
          // If we have a pending RS from a previous line ending, insert it first.
          if (this.insertRS_) {
            newChars.push(10); // RS (record start)
            this.insertRS_ = false;
          }
          newChars.push(13); // RE
          this.insertRS_ = true;
        } else {
          if (this.insertRS_) {
            newChars.push(10); // RS (record start)
            this.insertRS_ = false;
          }
          newChars.push(codePoint);
        }
      }

      // Update buffer if we got new characters
      if (newChars.length > keepSize) {
        // Replace buffer with new data
        this.buffer_ = newChars;
        // Adjust indices: start_ and cur_ relative to old buffer become 0-based
        // cur_ was at end_ (all consumed), so cur_ - start_ gives offset into kept data
        const curOffset = this.cur_ - this.start_;
        this.start_ = 0;
        this.cur_ = curOffset; // Should equal keepSize (pointing to first new char)
        this.end_ = newChars.length;

        // Return next character via nextChar() which reads buffer_[cur_++]
        return this.nextChar();
      }
    }
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
