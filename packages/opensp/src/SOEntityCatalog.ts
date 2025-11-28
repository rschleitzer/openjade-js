// Copyright (c) 1994, 1995, 1996 James Clark
// See the file COPYING for copying permission.

import { Char, UnivChar } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Location, InputSourceOrigin } from './Location';
import { Vector } from './Vector';
import { HashTable } from './HashTable';
import { EntityCatalog } from './EntityCatalog';
import { EntityDecl } from './EntityDecl';
import { CharsetInfo } from './CharsetInfo';
import { SubstTable } from './SubstTable';
import { Syntax } from './Syntax';
import { XcharMap } from './XcharMap';
import { InputSource } from './InputSource';
import { ConstPtr, Ptr } from './Ptr';
import { Resource } from './Resource';
import { ExtendEntityManager, mayNotExist } from './ExtendEntityManager';

// Forward declarations
export interface Messenger {
  message(type: any, ...args: any[]): void;
  setNextLocation?(loc: Location): void;
  dispatchMessage?(msg: any): void;
}

// CatalogEntry - entry in an entity catalog
export class CatalogEntry {
  to: StringC;
  loc: Location;
  catalogNumber: number;
  baseNumber: number;
  serial: number;
  // Store the catalog's base path for resolving relative system IDs
  catalogBasePath: StringC;

  constructor() {
    this.to = new StringOf<Char>();
    this.loc = new Location();
    this.catalogNumber = 0;
    this.baseNumber = 0;
    this.serial = 0;
    this.catalogBasePath = new StringOf<Char>();
  }

  copy(): CatalogEntry {
    const entry = new CatalogEntry();
    entry.to = this.to;
    entry.loc = this.loc;
    entry.catalogNumber = this.catalogNumber;
    entry.baseNumber = this.baseNumber;
    entry.serial = this.serial;
    entry.catalogBasePath = this.catalogBasePath;
    return entry;
  }
}

// CatalogMessages - messages for catalog parsing errors
export const CatalogMessages = {
  nameExpected: { text: 'name expected' },
  literalExpected: { text: 'literal expected' },
  nameOrLiteralExpected: { text: 'name or literal expected' },
  nulChar: { text: 'nul character' },
  minimumData: { text: 'not a minimum data character' },
  eofInComment: { text: 'end of entity in comment' },
  eofInLiteral: { text: 'end of entity in literal' },
  overrideYesOrNo: { text: 'OVERRIDE requires argument of YES or NO' },
  inLoop: { text: 'CATALOG entries cause loop' },
  systemShouldQuote: { text: 'second argument for SYSTEM entry should be quoted to avoid ambiguity' },
  noDocumentEntry: { text: 'no DOCUMENT entry in catalog %1' },
  noPublicEntry: { text: 'no entry for public identifier %1 in catalog %2' },
};

// Table - hash table with override support
class CatalogTable {
  private overrideEntries_: HashTable<StringC, CatalogEntry>;
  private normalEntries_: HashTable<StringC, CatalogEntry>;

  constructor() {
    this.overrideEntries_ = new HashTable<StringC, CatalogEntry>();
    this.normalEntries_ = new HashTable<StringC, CatalogEntry>();
  }

  lookup(key: StringC, overrideOnly: Boolean): CatalogEntry | null {
    if (overrideOnly) {
      return this.overrideEntries_.lookup(key);
    }
    const normal = this.normalEntries_.lookup(key);
    if (normal) {
      return normal;
    }
    return this.overrideEntries_.lookup(key);
  }

  lookupWithSubst(
    key: StringC,
    substTable: SubstTable,
    overrideOnly: Boolean
  ): CatalogEntry | null {
    // Apply substitution table to key
    const substKey = new StringOf<Char>();
    for (let i = 0; i < key.size(); i++) {
      substKey.append([substTable.subst(key.get(i))], 1);
    }
    return this.lookup(substKey, overrideOnly);
  }

  insert(key: StringC, entry: CatalogEntry, override: Boolean): void {
    if (override) {
      if (!this.overrideEntries_.lookup(key)) {
        this.overrideEntries_.insert(key, entry);
      }
    } else {
      if (!this.normalEntries_.lookup(key)) {
        this.normalEntries_.insert(key, entry);
      }
    }
  }

  count(): number {
    return this.overrideEntries_.count() + this.normalEntries_.count();
  }
}

// SOEntityCatalog - SGML Open Entity Catalog implementation
export class SOEntityCatalog extends EntityCatalog {
  private publicIds_: CatalogTable;
  private delegates_: CatalogTable;
  private dtdDecls_: HashTable<StringC, CatalogEntry>;
  private systemIds_: HashTable<StringC, CatalogEntry>;
  private names_: CatalogTable[]; // 5 tables for different entity types
  private catalogNumber_: number;
  private haveSgmlDecl_: PackedBoolean;
  private sgmlDecl_: StringC;
  private sgmlDeclLoc_: Location;
  private sgmlDeclBaseNumber_: number;
  private sgmlDeclCatalogPath_: StringC;
  private document_: StringC;
  private haveDocument_: PackedBoolean;
  private documentLoc_: Location;
  private documentBaseNumber_: number;
  private documentCatalogPath_: StringC;
  private haveCurrentBase_: PackedBoolean;
  private base_: Vector<Location>;
  private em_: ExtendEntityManager | null;
  private nextSerial_: number;
  // Current catalog path for resolving relative system IDs in entries
  private currentCatalogPath_: StringC;

  constructor(em: ExtendEntityManager | null) {
    super();
    this.publicIds_ = new CatalogTable();
    this.delegates_ = new CatalogTable();
    this.dtdDecls_ = new HashTable<StringC, CatalogEntry>();
    this.systemIds_ = new HashTable<StringC, CatalogEntry>();
    this.names_ = [];
    for (let i = 0; i < 5; i++) {
      this.names_.push(new CatalogTable());
    }
    this.catalogNumber_ = 0;
    this.haveSgmlDecl_ = false;
    this.sgmlDecl_ = new StringOf<Char>();
    this.sgmlDeclLoc_ = new Location();
    this.sgmlDeclBaseNumber_ = 0;
    this.sgmlDeclCatalogPath_ = new StringOf<Char>();
    this.document_ = new StringOf<Char>();
    this.haveDocument_ = false;
    this.documentLoc_ = new Location();
    this.documentBaseNumber_ = 0;
    this.documentCatalogPath_ = new StringOf<Char>();
    this.haveCurrentBase_ = false;
    this.base_ = new Vector<Location>();
    this.em_ = em;
    this.nextSerial_ = 0;
    this.currentCatalogPath_ = new StringOf<Char>();
  }

  // Set the current catalog path (called during catalog parsing)
  setCurrentCatalogPath(path: StringC): void {
    this.currentCatalogPath_ = new StringOf<Char>();
    this.currentCatalogPath_.assign(path.data(), path.size());
  }

  entityManager(): ExtendEntityManager | null {
    return this.em_;
  }

  // Main lookup function for entities
  lookup(
    entity: EntityDecl,
    syntax: Syntax,
    charset: CharsetInfo,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    let entry: CatalogEntry | null = null;
    let delegatedEntry: CatalogEntry | null = null;

    // Try system ID lookup first
    const sysId = entity.systemIdPointer ? entity.systemIdPointer() : null;
    if (sysId && sysId.size() > 0) {
      entry = this.systemIds_.lookup(sysId);
    }

    // Try public ID lookup
    const pubId = entity.publicIdPointer ? entity.publicIdPointer() : null;
    if (pubId && pubId.size() > 0) {
      const delegated = { value: false };
      const publicEntry = this.findBestPublicEntry(
        pubId,
        sysId !== null && sysId.size() > 0,
        charset,
        delegated
      );

      if (publicEntry && delegated.value) {
        delegatedEntry = publicEntry;
      }

      // Match for system ID has priority over match for public ID in same catalog
      if (publicEntry && (!entry || publicEntry.catalogNumber < entry.catalogNumber)) {
        entry = publicEntry;
      }
    }

    // Try entity name lookup
    const name = entity.name();
    if (name.size() > 0 && (!entry || entry.catalogNumber > 0)) {
      let tableIndex: number;
      const declType = entity.declType();

      if (declType >= EntityDecl.DeclType.parameterEntity) {
        tableIndex = declType - 1;
      } else {
        tableIndex = declType;
      }

      let lookupName = name;
      let subst: Boolean;

      switch (declType) {
        case EntityDecl.DeclType.parameterEntity:
          // Prepend PERO delimiter for parameter entities
          const tem = new StringOf<Char>();
          const pero = syntax.delimGeneral(Syntax.DelimGeneral.dPERO);
          for (let i = 0; i < pero.size(); i++) {
            tem.append([pero.get(i)], 1);
          }
          for (let i = 0; i < name.size(); i++) {
            tem.append([name.get(i)], 1);
          }
          lookupName = tem;
          subst = syntax.namecaseEntity();
          break;
        case EntityDecl.DeclType.generalEntity:
          subst = syntax.namecaseEntity();
          break;
        default:
          subst = syntax.namecaseGeneral();
          break;
      }

      let entityEntry: CatalogEntry | null;
      if (!subst) {
        entityEntry = this.names_[tableIndex].lookup(
          lookupName,
          sysId !== null && sysId.size() > 0
        );
      } else {
        entityEntry = this.names_[tableIndex].lookupWithSubst(
          lookupName,
          syntax.upperSubstTable(),
          sysId !== null && sysId.size() > 0
        );
      }

      // Match for public ID has priority over match for entity in same catalog
      if (entityEntry && (!entry || entityEntry.catalogNumber < entry.catalogNumber)) {
        entry = entityEntry;
      }
    }

    if (entry) {
      return this.expandCatalogSystemId(
        entry.to,
        entry.loc,
        entry.baseNumber,
        entry.catalogBasePath,
        entity.dataType() === EntityDecl.DataType.ndata,
        charset,
        entry === delegatedEntry && pubId ? pubId : null,
        mgr,
        result
      );
    }

    if (sysId && sysId.size() > 0 && this.em_) {
      return this.em_.expandSystemId(
        sysId,
        entity.defLocation(),
        entity.dataType() === EntityDecl.DataType.ndata,
        charset,
        null,
        mgr,
        result
      );
    }

    return false;
  }

  // Lookup by public ID only
  lookupPublic(
    publicId: StringC,
    charset: CharsetInfo,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    const delegated = { value: false };
    const entry = this.findBestPublicEntry(publicId, false, charset, delegated);

    if (entry) {
      return this.expandCatalogSystemId(
        entry.to,
        entry.loc,
        entry.baseNumber,
        entry.catalogBasePath,
        false,
        charset,
        delegated.value ? publicId : null,
        mgr,
        result
      );
    }

    return false;
  }

  // Lookup character entity
  lookupChar(
    name: StringC,
    charset: CharsetInfo,
    mgr: Messenger,
    result: { value: UnivChar }
  ): Boolean {
    const delegated = { value: false };
    const entry = this.findBestPublicEntry(name, false, charset, delegated);

    if (!entry || delegated.value) {
      return false;
    }

    const number = entry.to;
    if (number.size() === 0) {
      return false;
    }

    let n: UnivChar = 0;
    for (let i = 0; i < number.size(); i++) {
      const d = charset.digitWeight(number.get(i));
      if (d < 0) {
        return false;
      }
      n = n * 10 + d;
    }

    result.value = n;
    return true;
  }

  // Lookup DOCTYPE
  lookupDoctype(
    name: StringC,
    charset: CharsetInfo,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    const entry = this.dtdDecls_.lookup(name);
    if (entry) {
      return this.expandCatalogSystemId(
        entry.to,
        entry.loc,
        entry.baseNumber,
        entry.catalogBasePath,
        false,
        charset,
        null,
        mgr,
        result
      );
    }
    return false;
  }

  // Override base class sgmlDecl method
  // Port of SOEntityCatalog::sgmlDecl from SOEntityCatalog.cxx
  override sgmlDecl(
    charset: CharsetInfo,
    mgr: Messenger,
    _sysid: StringC,
    result: StringC
  ): Boolean {
    return this.lookupSgmlDecl(charset, mgr, result);
  }

  // Lookup SGML declaration
  lookupSgmlDecl(
    charset: CharsetInfo,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    if (this.haveSgmlDecl_) {
      return this.expandCatalogSystemId(
        this.sgmlDecl_,
        this.sgmlDeclLoc_,
        this.sgmlDeclBaseNumber_,
        this.sgmlDeclCatalogPath_,
        false,
        charset,
        null,
        mgr,
        result
      );
    }
    return false;
  }

  // Get DOCUMENT entry
  document(charset: CharsetInfo, mgr: Messenger, result: StringC): Boolean {
    if (this.haveDocument_) {
      return this.expandCatalogSystemId(
        this.document_,
        this.documentLoc_,
        this.documentBaseNumber_,
        this.documentCatalogPath_,
        false,
        charset,
        null,
        mgr,
        result
      );
    }
    return false;
  }

  // Add a PUBLIC entry
  addPublicId(publicId: StringC, systemId: StringC, loc: Location, override: Boolean): void {
    const entry = new CatalogEntry();
    // Must copy systemId since it's often this.param_ which gets reused
    entry.to.assign(systemId.data(), systemId.size());
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;
    // Store the catalog path for resolving relative system IDs
    entry.catalogBasePath.assign(this.currentCatalogPath_.data(), this.currentCatalogPath_.size());
    // Must copy publicId for the same reason
    const publicIdCopy = new StringOf<Char>();
    publicIdCopy.assign(publicId.data(), publicId.size());
    this.publicIds_.insert(publicIdCopy, entry, override);
  }

  // Add a DELEGATE entry
  addDelegate(prefix: StringC, systemId: StringC, loc: Location, override: Boolean): void {
    const entry = new CatalogEntry();
    entry.to.assign(systemId.data(), systemId.size());
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;
    entry.catalogBasePath.assign(this.currentCatalogPath_.data(), this.currentCatalogPath_.size());
    const prefixCopy = new StringOf<Char>();
    prefixCopy.assign(prefix.data(), prefix.size());
    this.delegates_.insert(prefixCopy, entry, override);
  }

  // Add a DTDDECL entry
  addDtdDecl(publicId: StringC, systemId: StringC, loc: Location, override: Boolean): void {
    const entry = new CatalogEntry();
    entry.to.assign(systemId.data(), systemId.size());
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;
    entry.catalogBasePath.assign(this.currentCatalogPath_.data(), this.currentCatalogPath_.size());

    const publicIdCopy = new StringOf<Char>();
    publicIdCopy.assign(publicId.data(), publicId.size());
    if (!this.dtdDecls_.lookup(publicIdCopy)) {
      this.dtdDecls_.insert(publicIdCopy, entry);
    }
  }

  // Add a SYSTEM entry
  addSystemId(systemId: StringC, replSystemId: StringC, loc: Location): void {
    const entry = new CatalogEntry();
    entry.to.assign(replSystemId.data(), replSystemId.size());
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;
    entry.catalogBasePath.assign(this.currentCatalogPath_.data(), this.currentCatalogPath_.size());

    const systemIdCopy = new StringOf<Char>();
    systemIdCopy.assign(systemId.data(), systemId.size());
    if (!this.systemIds_.lookup(systemIdCopy)) {
      this.systemIds_.insert(systemIdCopy, entry);
    }
  }

  // Add an entity name entry (ENTITY, DOCTYPE, LINKTYPE, NOTATION)
  addName(
    name: StringC,
    declType: number,
    systemId: StringC,
    loc: Location,
    override: Boolean
  ): void {
    const entry = new CatalogEntry();
    entry.to.assign(systemId.data(), systemId.size());
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;
    entry.catalogBasePath.assign(this.currentCatalogPath_.data(), this.currentCatalogPath_.size());

    let tableIndex: number;
    if (declType >= EntityDecl.DeclType.parameterEntity) {
      tableIndex = declType - 1;
    } else {
      tableIndex = declType;
    }

    const nameCopy = new StringOf<Char>();
    nameCopy.assign(name.data(), name.size());
    if (tableIndex >= 0 && tableIndex < 5) {
      this.names_[tableIndex].insert(nameCopy, entry, override);
    }
  }

  // Set SGMLDECL entry
  setSgmlDecl(str: StringC, loc: Location): void {
    if (!this.haveSgmlDecl_) {
      // Make a copy of the string since str may be reused by the caller
      this.sgmlDecl_ = new StringOf<Char>();
      this.sgmlDecl_.assign(str.data(), str.size());
      this.sgmlDeclLoc_ = new Location(loc);
      this.sgmlDeclBaseNumber_ = this.haveCurrentBase_ ? this.base_.size() : 0;
      this.sgmlDeclCatalogPath_.assign(this.currentCatalogPath_.data(), this.currentCatalogPath_.size());
      this.haveSgmlDecl_ = true;

    }
  }

  // Set DOCUMENT entry
  setDocument(str: StringC, loc: Location): void {
    if (!this.haveDocument_) {
      // Make a copy of the string since str may be reused by the caller
      this.document_ = new StringOf<Char>();
      this.document_.assign(str.data(), str.size());
      this.documentLoc_ = new Location(loc);
      this.documentBaseNumber_ = this.haveCurrentBase_ ? this.base_.size() : 0;
      this.documentCatalogPath_.assign(this.currentCatalogPath_.data(), this.currentCatalogPath_.size());
      this.haveDocument_ = true;
    }
  }

  // Set BASE for relative system identifiers
  setBase(loc: Location): void {
    this.base_.push_back(loc);
    this.haveCurrentBase_ = true;
  }

  // End of current catalog file
  endCatalog(): void {
    this.catalogNumber_++;
    this.haveCurrentBase_ = false;
  }

  // Find best public entry with delegation support
  private findBestPublicEntry(
    publicId: StringC,
    overrideOnly: Boolean,
    charset: CharsetInfo,
    delegated: { value: boolean }
  ): CatalogEntry | null {
    const slash = charset.execToDesc('/');
    const colon = charset.execToDesc(':');
    let bestEntry: CatalogEntry | null = null;

    // Check for delegate matches (partial public ID prefix)
    for (let i = 0; i <= publicId.size(); i++) {
      // Check for // or :: delimiter patterns
      if (
        (i + 1 < publicId.size() &&
          (publicId.get(i) === slash || publicId.get(i) === colon) &&
          publicId.get(i + 1) === publicId.get(i)) ||
        (i >= 2 &&
          (publicId.get(i - 1) === slash || publicId.get(i - 1) === colon) &&
          publicId.get(i - 2) === publicId.get(i - 1))
      ) {
        const prefix = new StringOf<Char>();
        for (let j = 0; j < i; j++) {
          prefix.append([publicId.get(j)], 1);
        }

        const entry = this.delegates_.lookup(prefix, overrideOnly);
        if (entry && (!bestEntry || entry.catalogNumber <= bestEntry.catalogNumber)) {
          bestEntry = entry;
          delegated.value = true;
        }
      }
    }

    // Check for exact public ID match
    const entry = this.publicIds_.lookup(publicId, overrideOnly);
    if (entry && (!bestEntry || entry.catalogNumber <= bestEntry.catalogNumber)) {
      bestEntry = entry;
      delegated.value = false;
    }

    return bestEntry;
  }

  // Expand a system ID from the catalog
  private expandCatalogSystemId(
    str: StringC,
    loc: Location,
    baseNumber: number,
    catalogBasePath: StringC,
    isNdata: Boolean,
    charset: CharsetInfo,
    lookupPublicId: StringC | null,
    mgr: Messenger,
    result: StringC
  ): Boolean {
    if (!this.em_) {
      // No entity manager, just copy the string
      result.assign(str.data(), str.size());
      return true;
    }

    // If baseNumber is 0 (no BASE directive), use the catalog's path as the base
    // for resolving relative system IDs
    if (baseNumber === 0 && catalogBasePath.size() > 0) {
      // Temporarily set the entity manager's base ID to the catalog path
      const savedBaseId = this.em_.currentBaseId();
      const savedBaseIdCopy = new StringOf<Char>();
      savedBaseIdCopy.assign(savedBaseId.data(), savedBaseId.size());
      this.em_.setCurrentBaseId(catalogBasePath);

      const success = this.em_.expandSystemId(
        str,
        loc,
        isNdata,
        charset,
        lookupPublicId,
        mgr,
        result
      );

      // Restore the previous base ID
      this.em_.setCurrentBaseId(savedBaseIdCopy);
      return success;
    }

    const baseLoc = baseNumber > 0 ? this.base_.get(baseNumber - 1) : loc;

    return this.em_.expandSystemId(
      str,
      baseLoc,
      isNdata,
      charset,
      lookupPublicId,
      mgr,
      result
    );
  }
}

// CatalogParser - parses SGML Open catalog files
// Port of CatalogParser from SOEntityCatalog.cxx
export class CatalogParser {
  // Param enum
  static readonly Param = {
    eofParam: 0,
    literalParam: 1,
    nameParam: 2,
    percentParam: 3
  } as const;

  // Flags
  private static readonly minimumLiteral = 0o1;

  private charset_: CharsetInfo;
  private in_: InputSource | null;
  private catalog_: SOEntityCatalog | null;
  private mgr_: Messenger | null;
  private param_: StringC;
  private paramLoc_: Location;
  private override_: PackedBoolean;

  // Character category table
  private categoryTable_: XcharMap<number>;
  private substTable_: SubstTable;

  // Special characters
  private minus_: Char;
  private tab_: Char;
  private rs_: Char;
  private re_: Char;
  private space_: Char;

  // Keywords
  private publicKey_: StringC;
  private systemKey_: StringC;
  private entityKey_: StringC;
  private doctypeKey_: StringC;
  private linktypeKey_: StringC;
  private notationKey_: StringC;
  private overrideKey_: StringC;
  private sgmlDeclKey_: StringC;
  private documentKey_: StringC;
  private catalogKey_: StringC;
  private yesKey_: StringC;
  private noKey_: StringC;
  private baseKey_: StringC;
  private delegateKey_: StringC;
  private dtddeclKey_: StringC;
  private sgmlKey_: StringC;

  // Category constants
  private static readonly CAT_DATA = 0;
  private static readonly CAT_EOF = 1;
  private static readonly CAT_NUL = 2;
  private static readonly CAT_LIT = 3;
  private static readonly CAT_LITA = 4;
  private static readonly CAT_MINUS = 5;
  private static readonly CAT_S = 6;
  private static readonly CAT_MIN = 7;

  constructor(charset: CharsetInfo) {
    this.charset_ = charset;
    this.in_ = null;
    this.catalog_ = null;
    this.mgr_ = null;
    this.param_ = new StringOf<Char>();
    this.paramLoc_ = new Location();
    this.override_ = false;
    this.categoryTable_ = new XcharMap<number>(CatalogParser.CAT_DATA);
    this.substTable_ = new SubstTable();

    // Initialize special characters
    this.minus_ = charset.execToDesc('-');
    this.tab_ = charset.execToDesc('\t');
    this.rs_ = charset.execToDesc('\n');
    this.re_ = charset.execToDesc('\r');
    this.space_ = charset.execToDesc(' ');

    // Initialize keywords
    this.publicKey_ = this.makeKeyword('PUBLIC');
    this.systemKey_ = this.makeKeyword('SYSTEM');
    this.entityKey_ = this.makeKeyword('ENTITY');
    this.doctypeKey_ = this.makeKeyword('DOCTYPE');
    this.linktypeKey_ = this.makeKeyword('LINKTYPE');
    this.notationKey_ = this.makeKeyword('NOTATION');
    this.overrideKey_ = this.makeKeyword('OVERRIDE');
    this.sgmlDeclKey_ = this.makeKeyword('SGMLDECL');
    this.documentKey_ = this.makeKeyword('DOCUMENT');
    this.catalogKey_ = this.makeKeyword('CATALOG');
    this.yesKey_ = this.makeKeyword('YES');
    this.noKey_ = this.makeKeyword('NO');
    this.baseKey_ = this.makeKeyword('BASE');
    this.delegateKey_ = this.makeKeyword('DELEGATE');
    this.dtddeclKey_ = this.makeKeyword('DTDDECL');
    this.sgmlKey_ = this.makeKeyword('SGML');

    // Set up category table
    this.categoryTable_.setChar(InputSource.eE, CatalogParser.CAT_EOF);
    this.categoryTable_.setChar(0, CatalogParser.CAT_NUL);
    this.categoryTable_.setChar(charset.execToDesc('"'), CatalogParser.CAT_LIT);
    this.categoryTable_.setChar(charset.execToDesc("'"), CatalogParser.CAT_LITA);
    this.categoryTable_.setChar(this.minus_, CatalogParser.CAT_MINUS);
    this.categoryTable_.setChar(this.space_, CatalogParser.CAT_S);
    this.categoryTable_.setChar(this.tab_, CatalogParser.CAT_S);
    this.categoryTable_.setChar(this.rs_, CatalogParser.CAT_S);
    this.categoryTable_.setChar(this.re_, CatalogParser.CAT_S);

    // Set minimum data characters
    const lcletters = 'abcdefghijklmnopqrstuvwxyz';
    const ucletters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const minChars = "0123456789-.'()+,/:=?";

    // Set up substitution table and minimum data
    for (let i = 0; i < 26; i++) {
      const lc = charset.execToDesc(lcletters.charAt(i));
      const uc = charset.execToDesc(ucletters.charAt(i));
      this.substTable_.addSubst(lc, uc);
      this.categoryTable_.setChar(lc, CatalogParser.CAT_MIN);
      this.categoryTable_.setChar(uc, CatalogParser.CAT_MIN);
    }
    for (let i = 0; i < minChars.length; i++) {
      this.categoryTable_.setChar(charset.execToDesc(minChars.charAt(i)), CatalogParser.CAT_MIN);
    }
  }

  private makeKeyword(s: string): StringC {
    const result = new StringOf<Char>();
    for (let i = 0; i < s.length; i++) {
      result.append([this.charset_.execToDesc(s.charAt(i))], 1);
    }
    return result;
  }

  // Check if character is minimum data
  private isMinimumData(c: number): Boolean {
    const cat = this.categoryTable_.get(c);
    return cat === CatalogParser.CAT_MIN ||
      (cat === CatalogParser.CAT_S && c !== this.tab_) ||
      cat === CatalogParser.CAT_MINUS ||
      cat === CatalogParser.CAT_LITA;
  }

  private get(): number {
    if (!this.in_ || !this.mgr_) return InputSource.eE;
    return this.in_.get(this.mgr_ as any);
  }

  private unget(): void {
    if (this.in_) {
      this.in_.ungetToken();
    }
  }

  private message(msg: { text: string }): void {
    if (this.mgr_) {
      this.mgr_.message(msg);
    }
  }

  // Parse a catalog file - full implementation from upstream
  parseCatalog(
    sysid: StringC,
    mustExist: Boolean,
    sysidCharset: CharsetInfo,
    catalogCharset: CharsetInfo,
    origin: InputSourceOrigin | null,
    catalog: SOEntityCatalog,
    mgr: Messenger
  ): void {
    const em = catalog.entityManager();
    if (!em) {
      // No entity manager - can't open catalog file
      catalog.endCatalog();
      return;
    }

    this.in_ = em.open(
      sysid,
      sysidCharset,
      origin,
      mustExist ? 0 : mayNotExist,
      mgr
    );

    if (!this.in_) {
      catalog.endCatalog();
      return;
    }

    // Store the catalog path so entries can be resolved relative to it
    catalog.setCurrentCatalogPath(sysid);

    this.catalog_ = catalog;
    this.mgr_ = mgr;
    this.override_ = false;

    let recovering = false;
    const subSysids: StringC[] = [];
    const subSysidLocs: Location[] = [];

    for (;;) {
      const parm = this.parseParam(0);
      if (parm === CatalogParser.Param.nameParam) {
        this.upcase(this.param_);
        const wasRecovering = recovering;
        recovering = false;

        if (this.param_.equals(this.publicKey_)) {
          this.parsePublic();
        } else if (this.param_.equals(this.systemKey_)) {
          this.parseSystem();
        } else if (this.param_.equals(this.entityKey_)) {
          this.parseNameMap(EntityDecl.DeclType.generalEntity);
        } else if (this.param_.equals(this.doctypeKey_)) {
          this.parseNameMap(EntityDecl.DeclType.doctype);
        } else if (this.param_.equals(this.linktypeKey_)) {
          this.parseNameMap(EntityDecl.DeclType.linktype);
        } else if (this.param_.equals(this.notationKey_)) {
          this.parseNameMap(EntityDecl.DeclType.notation);
        } else if (this.param_.equals(this.sgmlKey_)) {
          this.parseNameMap(EntityDecl.DeclType.sgml);
        } else if (this.param_.equals(this.sgmlDeclKey_)) {
          if (this.parseArg()) {
            this.catalog_!.setSgmlDecl(this.param_, this.paramLoc_);
          }
        } else if (this.param_.equals(this.documentKey_)) {
          if (this.parseArg()) {
            this.catalog_!.setDocument(this.param_, this.paramLoc_);
          }
        } else if (this.param_.equals(this.overrideKey_)) {
          this.parseOverride();
        } else if (this.param_.equals(this.catalogKey_)) {
          if (this.parseArg()) {
            if (this.inLoop(this.paramLoc_)) {
              break;
            }
            const sysidCopy = new StringOf<Char>();
            sysidCopy.assign(this.param_.data(), this.param_.size());
            subSysids.push(sysidCopy);
            subSysidLocs.push(this.paramLoc_);
          }
        } else if (this.param_.equals(this.baseKey_)) {
          if (this.parseArg()) {
            const loc = new Location();
            // BASE sets the base for relative system IDs
            // In full implementation, this would open the file to get its location
            this.catalog_!.setBase(this.paramLoc_);
          }
        } else if (this.param_.equals(this.delegateKey_)) {
          this.parseDelegate();
        } else if (this.param_.equals(this.dtddeclKey_)) {
          this.parseDtddecl();
        } else {
          // Unknown keyword - try to recover
          if (!wasRecovering && this.parseParam(0) === CatalogParser.Param.eofParam) {
            break;
          }
          recovering = true;
        }
      } else if (parm === CatalogParser.Param.eofParam) {
        break;
      } else if (!recovering) {
        recovering = true;
        this.message(CatalogMessages.nameExpected);
      }
    }

    this.in_ = null;
    catalog.endCatalog();

    // Parse sub-catalogs
    // Set the base ID to the current catalog's path for resolving relative CATALOG entries
    // This is needed because expandSystemId uses currentBaseId_ to resolve relative paths
    const savedBaseId = em.currentBaseId();
    const savedBaseIdCopy = new StringOf<Char>();
    savedBaseIdCopy.assign(savedBaseId.data(), savedBaseId.size());
    em.setCurrentBaseId(sysid);

    for (let i = 0; i < subSysids.length; i++) {
      const tem = new StringOf<Char>();
      if (em.expandSystemId(
        subSysids[i],
        subSysidLocs[i],
        false,
        catalogCharset,
        null,
        mgr,
        tem
      )) {
        this.parseCatalog(
          tem,
          true,
          catalogCharset,
          catalogCharset,
          InputSourceOrigin.makeWithLocation(subSysidLocs[i]),
          catalog,
          mgr
        );
      }
    }

    // Restore the base ID
    em.setCurrentBaseId(savedBaseIdCopy);
  }

  // Check for loop in catalog references
  private inLoop(loc: Location): Boolean {
    // Simplified loop detection - in full implementation this would
    // check the parent chain of locations for matching storage IDs
    return false;
  }

  // Parse a parameter
  private parseParam(flags: number): number {
    for (;;) {
      const c = this.get();
      const cat = this.categoryTable_.get(c);
      switch (cat) {
        case CatalogParser.CAT_EOF:
          return CatalogParser.Param.eofParam;
        case CatalogParser.CAT_LIT:
        case CatalogParser.CAT_LITA:
          this.parseLiteral(c, flags);
          return CatalogParser.Param.literalParam;
        case CatalogParser.CAT_S:
          break;
        case CatalogParser.CAT_NUL:
          this.message(CatalogMessages.nulChar);
          break;
        case CatalogParser.CAT_MINUS:
          {
            const c2 = this.get();
            if (c2 === this.minus_) {
              this.skipComment();
              break;
            }
            this.unget();
          }
          // fall through
        default:
          this.parseName();
          return CatalogParser.Param.nameParam;
      }
    }
  }

  // Parse a literal (quoted string)
  private parseLiteral(delim: Char, flags: number): void {
    this.paramLoc_ = this.in_ ? this.in_.currentLocation() : new Location();
    let skipping: number = 1; // yesBegin
    this.param_.resize(0);

    for (;;) {
      const c = this.get();
      if (c === InputSource.eE) {
        this.message(CatalogMessages.eofInLiteral);
        break;
      }
      if (c === delim) {
        break;
      }
      if (flags & CatalogParser.minimumLiteral) {
        if (!this.isMinimumData(c)) {
          this.message(CatalogMessages.minimumData);
        }
        if (c === this.rs_) {
          // Ignore RS
        } else if (c === this.space_ || c === this.re_) {
          if (skipping === 0) { // no
            this.param_.append([this.space_], 1);
            skipping = 2; // yesMiddle
          }
        } else {
          skipping = 0; // no
          this.param_.append([c], 1);
        }
      } else {
        this.param_.append([c], 1);
      }
    }
    // Remove trailing space
    if (skipping === 2 && this.param_.size() > 0) { // yesMiddle
      this.param_.resize(this.param_.size() - 1);
    }
  }

  // Parse a name (unquoted token)
  private parseName(): void {
    this.paramLoc_ = this.in_ ? this.in_.currentLocation() : new Location();
    let length = 1;

    for (;;) {
      const c = this.in_ ? this.in_.tokenChar(this.mgr_ as any) : InputSource.eE;
      const cat = this.categoryTable_.get(c);
      if (cat === CatalogParser.CAT_EOF || cat === CatalogParser.CAT_S) {
        break;
      }
      if (cat === CatalogParser.CAT_NUL) {
        this.message(CatalogMessages.nulChar);
      }
      length++;
    }

    if (this.in_) {
      this.in_.endToken(length);
      const start = this.in_.currentTokenStart();
      const startIdx = this.in_.currentTokenStartIndex();
      const len = this.in_.currentTokenLength();
      this.param_.resize(0);
      for (let i = 0; i < len; i++) {
        this.param_.append([start[startIdx + i]], 1);
      }
    }
  }

  // Skip a comment
  private skipComment(): void {
    for (;;) {
      const c = this.get();
      if (c === this.minus_) {
        const c2 = this.get();
        if (c2 === this.minus_) {
          break;
        }
      }
      if (c === InputSource.eE) {
        this.message(CatalogMessages.eofInComment);
        break;
      }
    }
  }

  // Parse an argument (name or literal)
  private parseArg(): Boolean {
    const parm = this.parseParam(0);
    if (parm !== CatalogParser.Param.nameParam &&
        parm !== CatalogParser.Param.literalParam) {
      this.message(CatalogMessages.nameOrLiteralExpected);
      return false;
    }
    return true;
  }

  // Parse OVERRIDE keyword
  private parseOverride(): void {
    if (this.parseParam(0) !== CatalogParser.Param.nameParam) {
      this.message(CatalogMessages.overrideYesOrNo);
      return;
    }
    this.upcase(this.param_);
    if (this.param_.equals(this.yesKey_)) {
      this.override_ = true;
    } else if (this.param_.equals(this.noKey_)) {
      this.override_ = false;
    } else {
      this.message(CatalogMessages.overrideYesOrNo);
    }
  }

  // Parse PUBLIC entry
  private parsePublic(): void {
    if (this.parseParam(CatalogParser.minimumLiteral) !== CatalogParser.Param.literalParam) {
      this.message(CatalogMessages.literalExpected);
      return;
    }
    const publicId = new StringOf<Char>();
    publicId.assign(this.param_.data(), this.param_.size());

    if (!this.parseArg()) {
      return;
    }
    this.catalog_!.addPublicId(publicId, this.param_, this.paramLoc_, this.override_);
  }

  // Parse DELEGATE entry
  private parseDelegate(): void {
    if (this.parseParam(CatalogParser.minimumLiteral) !== CatalogParser.Param.literalParam) {
      this.message(CatalogMessages.literalExpected);
      return;
    }
    const publicId = new StringOf<Char>();
    publicId.assign(this.param_.data(), this.param_.size());

    if (!this.parseArg()) {
      return;
    }
    this.catalog_!.addDelegate(publicId, this.param_, this.paramLoc_, this.override_);
  }

  // Parse DTDDECL entry
  private parseDtddecl(): void {
    if (this.parseParam(CatalogParser.minimumLiteral) !== CatalogParser.Param.literalParam) {
      this.message(CatalogMessages.literalExpected);
      return;
    }
    const publicId = new StringOf<Char>();
    publicId.assign(this.param_.data(), this.param_.size());

    if (!this.parseArg()) {
      return;
    }
    this.catalog_!.addDtdDecl(publicId, this.param_, this.paramLoc_, this.override_);
  }

  // Parse SYSTEM entry
  private parseSystem(): void {
    if (!this.parseArg()) {
      return;
    }
    const systemId = new StringOf<Char>();
    systemId.assign(this.param_.data(), this.param_.size());

    const parm = this.parseParam(0);
    if (parm === CatalogParser.Param.nameParam) {
      this.message(CatalogMessages.systemShouldQuote);
    } else if (parm !== CatalogParser.Param.literalParam) {
      this.message(CatalogMessages.literalExpected);
      return;
    }
    this.catalog_!.addSystemId(systemId, this.param_, this.paramLoc_);
  }

  // Parse ENTITY, DOCTYPE, LINKTYPE, NOTATION entries
  private parseNameMap(declType: number): void {
    if (!this.parseArg()) {
      return;
    }
    const name = new StringOf<Char>();
    name.assign(this.param_.data(), this.param_.size());

    if (!this.parseArg()) {
      return;
    }
    this.catalog_!.addName(name, declType, this.param_, this.paramLoc_, this.override_);
  }

  // Upcase a string using the substitution table
  private upcase(str: StringC): void {
    for (let i = 0; i < str.size(); i++) {
      str.set(i, this.substTable_.subst(str.get(i)));
    }
  }
}

// SOCatalogManager - factory for creating entity catalogs
export class SOCatalogManager {
  private systemCatalogs_: Vector<StringC>;
  private nSystemCatalogsMustExist_: number;
  private sysidCharset_: CharsetInfo | null;
  private catalogCharset_: CharsetInfo | null;
  private useDocCatalog_: PackedBoolean;

  constructor(
    sysids: Vector<StringC>,
    nSysidsMustExist: number,
    sysidCharset: CharsetInfo | null,
    catalogCharset: CharsetInfo | null,
    useDocCatalog: Boolean
  ) {
    this.systemCatalogs_ = sysids;
    this.nSystemCatalogsMustExist_ = nSysidsMustExist;
    this.sysidCharset_ = sysidCharset;
    this.catalogCharset_ = catalogCharset;
    this.useDocCatalog_ = useDocCatalog;
  }

  makeCatalog(
    systemId: StringC,
    charset: CharsetInfo,
    em: ExtendEntityManager | null,
    mgr: Messenger
  ): ConstPtr<EntityCatalog> {
    const entityCatalog = new SOEntityCatalog(em);

    if (this.catalogCharset_) {
      const parser = new CatalogParser(this.catalogCharset_);

      // Parse system catalogs that must exist
      for (let i = 0; i < this.nSystemCatalogsMustExist_; i++) {
        parser.parseCatalog(
          this.systemCatalogs_.get(i),
          true,
          this.sysidCharset_!,
          this.catalogCharset_!,
          InputSourceOrigin.make(),
          entityCatalog,
          mgr
        );
      }

      // Port of SOCatalogManagerImpl::addCatalogsForDocument from SOEntityCatalog.cxx lines 342-395
      // Load catalog from the document's directory if useDocCatalog_ is true
      if (this.useDocCatalog_ && systemId.size() > 0) {
        this.addCatalogsForDocument(parser, systemId, entityCatalog, charset, mgr);
      }

      // Parse optional system catalogs
      for (let i = this.nSystemCatalogsMustExist_; i < this.systemCatalogs_.size(); i++) {
        parser.parseCatalog(
          this.systemCatalogs_.get(i),
          false,
          this.sysidCharset_!,
          this.catalogCharset_!,
          InputSourceOrigin.make(),
          entityCatalog,
          mgr
        );
      }
    }

    return new ConstPtr<EntityCatalog>(entityCatalog);
  }

  // Port of SOCatalogManagerImpl::addCatalogsForDocument from SOEntityCatalog.cxx lines 342-395
  // This function looks for a catalog file in the same directory as the document and parses it
  private addCatalogsForDocument(
    parser: CatalogParser,
    sysid: StringC,
    entityCatalog: SOEntityCatalog,
    charset: CharsetInfo,
    mgr: Messenger
  ): void {
    // Convert StringC to JavaScript string to work with paths
    let sysidStr = '';
    for (let i = 0; i < sysid.size(); i++) {
      sysidStr += String.fromCharCode(sysid.get(i));
    }

    // Get the directory from the system ID
    // Following C++ logic: resolve relative to the base, then look for "catalog"
    let lastSlash = sysidStr.lastIndexOf('/');
    if (lastSlash < 0) {
      lastSlash = sysidStr.lastIndexOf('\\');
    }

    let catalogPath: string;
    if (lastSlash >= 0) {
      catalogPath = sysidStr.substring(0, lastSlash + 1) + 'catalog';
    } else {
      // No directory component, try current directory
      catalogPath = 'catalog';
    }

    // Create a StringC for the catalog path
    const catalogSysid = new StringOf<Char>();
    for (let i = 0; i < catalogPath.length; i++) {
      catalogSysid.append([catalogPath.charCodeAt(i)], 1);
    }

    // Try to parse the catalog file (don't require it to exist - use mustExist = false)
    parser.parseCatalog(
      catalogSysid,
      false, // mustExist = false, as per C++ implementation which uses 0
      this.sysidCharset_ || charset,
      this.catalogCharset_!,
      InputSourceOrigin.make(),
      entityCatalog,
      mgr
    );
  }

  // Factory method
  static make(
    sysids: Vector<StringC>,
    nSysidsMustExist: number,
    sysidCharset: CharsetInfo | null,
    catalogCharset: CharsetInfo | null,
    useDocCatalog: Boolean
  ): SOCatalogManager {
    return new SOCatalogManager(
      sysids,
      nSysidsMustExist,
      sysidCharset,
      catalogCharset,
      useDocCatalog
    );
  }
}
