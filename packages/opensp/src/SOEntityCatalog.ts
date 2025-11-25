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

// Forward declarations
export interface Messenger {
  message(type: any, ...args: any[]): void;
}

export interface ExtendEntityManager {
  expandSystemId(
    str: StringC,
    loc: Location,
    isNdata: Boolean,
    charset: CharsetInfo,
    lookupPublicId: StringC | null,
    mgr: Messenger,
    result: StringC
  ): Boolean;
  parseSystemId(
    str: StringC,
    charset: CharsetInfo,
    isNdata: Boolean,
    def: any,
    mgr: Messenger,
    result: any
  ): Boolean;
}

// CatalogEntry - entry in an entity catalog
export class CatalogEntry {
  to: StringC;
  loc: Location;
  catalogNumber: number;
  baseNumber: number;
  serial: number;

  constructor() {
    this.to = new StringOf<Char>();
    this.loc = new Location();
    this.catalogNumber = 0;
    this.baseNumber = 0;
    this.serial = 0;
  }

  copy(): CatalogEntry {
    const entry = new CatalogEntry();
    entry.to = this.to;
    entry.loc = this.loc;
    entry.catalogNumber = this.catalogNumber;
    entry.baseNumber = this.baseNumber;
    entry.serial = this.serial;
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
  private document_: StringC;
  private haveDocument_: PackedBoolean;
  private documentLoc_: Location;
  private documentBaseNumber_: number;
  private haveCurrentBase_: PackedBoolean;
  private base_: Vector<Location>;
  private em_: ExtendEntityManager | null;
  private nextSerial_: number;

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
    this.document_ = new StringOf<Char>();
    this.haveDocument_ = false;
    this.documentLoc_ = new Location();
    this.documentBaseNumber_ = 0;
    this.haveCurrentBase_ = false;
    this.base_ = new Vector<Location>();
    this.em_ = em;
    this.nextSerial_ = 0;
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
        false,
        charset,
        null,
        mgr,
        result
      );
    }
    return false;
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
    entry.to = systemId;
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;
    this.publicIds_.insert(publicId, entry, override);
  }

  // Add a DELEGATE entry
  addDelegate(prefix: StringC, systemId: StringC, loc: Location, override: Boolean): void {
    const entry = new CatalogEntry();
    entry.to = systemId;
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;
    this.delegates_.insert(prefix, entry, override);
  }

  // Add a DTDDECL entry
  addDtdDecl(publicId: StringC, systemId: StringC, loc: Location, override: Boolean): void {
    const entry = new CatalogEntry();
    entry.to = systemId;
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;

    if (!this.dtdDecls_.lookup(publicId)) {
      this.dtdDecls_.insert(publicId, entry);
    }
  }

  // Add a SYSTEM entry
  addSystemId(systemId: StringC, replSystemId: StringC, loc: Location): void {
    const entry = new CatalogEntry();
    entry.to = replSystemId;
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;

    if (!this.systemIds_.lookup(systemId)) {
      this.systemIds_.insert(systemId, entry);
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
    entry.to = systemId;
    entry.loc = loc;
    entry.catalogNumber = this.catalogNumber_;
    entry.baseNumber = this.haveCurrentBase_ ? this.base_.size() : 0;
    entry.serial = this.nextSerial_++;

    let tableIndex: number;
    if (declType >= EntityDecl.DeclType.parameterEntity) {
      tableIndex = declType - 1;
    } else {
      tableIndex = declType;
    }

    if (tableIndex >= 0 && tableIndex < 5) {
      this.names_[tableIndex].insert(name, entry, override);
    }
  }

  // Set SGMLDECL entry
  setSgmlDecl(str: StringC, loc: Location): void {
    if (!this.haveSgmlDecl_) {
      this.sgmlDecl_ = str;
      this.sgmlDeclLoc_ = loc;
      this.sgmlDeclBaseNumber_ = this.haveCurrentBase_ ? this.base_.size() : 0;
      this.haveSgmlDecl_ = true;
    }
  }

  // Set DOCUMENT entry
  setDocument(str: StringC, loc: Location): void {
    if (!this.haveDocument_) {
      this.document_ = str;
      this.documentLoc_ = loc;
      this.documentBaseNumber_ = this.haveCurrentBase_ ? this.base_.size() : 0;
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
export class CatalogParser {
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

    // Set up uppercase substitution table
    for (let i = 0; i < 26; i++) {
      const lc = charset.execToDesc(String.fromCharCode('a'.charCodeAt(0) + i));
      const uc = charset.execToDesc(String.fromCharCode('A'.charCodeAt(0) + i));
      this.substTable_.addSubst(lc, uc);
    }
  }

  private makeKeyword(s: string): StringC {
    const result = new StringOf<Char>();
    for (let i = 0; i < s.length; i++) {
      result.append([this.charset_.execToDesc(s.charAt(i))], 1);
    }
    return result;
  }

  // Parse a catalog file
  parseCatalog(
    sysid: StringC,
    mustExist: Boolean,
    sysidCharset: CharsetInfo,
    catalogCharset: CharsetInfo,
    origin: InputSourceOrigin | null,
    catalog: SOEntityCatalog,
    mgr: Messenger
  ): void {
    this.catalog_ = catalog;
    this.mgr_ = mgr;
    this.override_ = false;

    // TODO: Open input source for sysid and parse
    // For now, just end the catalog
    catalog.endCatalog();
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
