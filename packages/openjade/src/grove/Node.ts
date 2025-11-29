// Copyright (c) 1996 James Clark
// See the file COPYING for copying permission.

// Supports the following modules:
// baseabs prlgabs0 prlgabs1 instabs basesds0 instsds0 subdcabs

// GroveChar is a 32-bit character code point
export type GroveChar = number;

export enum AccessResult {
  accessOK = 0,           // success
  accessNull = 1,         // value is null
  accessTimeout = 2,      // timed out waiting for property
  accessNotInClass = 3    // property is not defined for class
}

export namespace ComponentName {
  export enum Id {
    noId = -1,
    idAllPropertyNames = 0,
    idAnd,
    idAny,
    idApplicationInfo,
    idAttributeAssignment,
    idAttributeDef,
    idAttributeDefs,
    idAttributes,
    idAttributeValueToken,
    idCdata,
    idChar,
    idChildrenPropertyName,
    idClassName,
    idConnector,
    idConref,
    idContent,
    idContentTokens,
    idContentType,
    idCurrent,
    idCurrentAttributeIndex,
    idCurrentGroup,
    idDataChar,
    idDataPropertyName,
    idDataSepPropertyName,
    idDeclValueType,
    idDefaulted,
    idDefaultedEntities,
    idDefaultEntity,
    idDefaultValue,
    idDefaultValueType,
    idDoctypesAndLinktypes,
    idDocumentElement,
    idDocumentType,
    idElement,
    idElements,
    idElementToken,
    idElementType,
    idElementTypes,
    idEmpty,
    idEntities,
    idEntity,
    idEntityName,
    idEntityType,
    idEpilog,
    idExclusions,
    idExternalData,
    idExternalId,
    idFixed,
    idGeneralEntities,
    idGeneratedSystemId,
    idGi,
    idGoverning,
    idGoverningDoctype,
    idGroveRoot,
    idId,
    idIdref,
    idIdrefs,
    idImplied,
    idIncluded,
    idInclusions,
    idModelGroup,
    idMustOmitEndTag,
    idName,
    idNames,
    idNdata,
    idNmtkgrp,
    idNmtoken,
    idNmtokens,
    idNotation,
    idNotationName,
    idNotations,
    idNumber,
    idNumbers,
    idNutoken,
    idNutokens,
    idOccurenceIndicator,
    idOmitEndTag,
    idOmitStartTag,
    idOpt,
    idOr,
    idOrigin,
    idOriginToSubnodeRelPropertyName,
    idParameterEntities,
    idParent,
    idPcdataToken,
    idPi,
    idPlus,
    idProlog,
    idPublicId,
    idRcdata,
    idReferent,
    idRep,
    idRequired,
    idSdata,
    idSeq,
    idSgmlConstants,
    idSgmlDocument,
    idSubdocument,
    idSubnodePropertyNames,
    idSystemData,
    idSystemId,
    idText,
    idToken,
    idTokens,
    idTokenSep,
    idTreeRoot,
    idValue
  }

  export const nIds = Id.idValue + 1;

  const rcsNames: string[] = [
    "allpns",
    "and",
    "any",
    "appinfo",
    "attasgn",
    "attdef",
    "attdefs",
    "atts",
    "attvaltk",
    "cdata",
    "char",
    "childpn",
    "classnm",
    "connect",
    "conref",
    "content",
    "tokens",
    "contype",
    "current",
    "curattix",
    "curgrp",
    "datachar",
    "datapn",
    "dseppn",
    "dcltype",
    "dflted",
    "dfltents",
    "dfltent",
    "dfltval",
    "dflttype",
    "dtlts",
    "docelem",
    "doctype",
    "element",
    "elements",
    "elemtk",
    "elemtype",
    "elemtps",
    "empty",
    "entities",
    "entity",
    "entname",
    "enttype",
    "epilog",
    "excls",
    "extdata",
    "extid",
    "fixed",
    "genents",
    "gensysid",
    "gi",
    "govrning",
    "govdt",
    "grovroot",
    "id",
    "idref",
    "idrefs",
    "implied",
    "included",
    "incls",
    "modelgrp",
    "momitend",
    "name",
    "names",
    "ndata",
    "nmtkgrp",
    "nmtoken",
    "nmtokens",
    "notation",
    "notname",
    "nots",
    "number",
    "numbers",
    "nutoken",
    "nutokens",
    "occur",
    "omitend",
    "omitstrt",
    "opt",
    "or",
    "origin",
    "otsrelpn",
    "parments",
    "parent",
    "pcdatatk",
    "pi",
    "plus",
    "prolog",
    "pubid",
    "rcdata",
    "referent",
    "rep",
    "required",
    "sdata",
    "seq",
    "sgmlcsts",
    "sgmldoc",
    "subdoc",
    "subpns",
    "sysdata",
    "sysid",
    "text",
    "token",
    "tokens",
    "tokensep",
    "treeroot",
    "value"
  ];

  const sdqlNames: string[] = [
    "all-property-names",
    "and",
    "any",
    "application-info",
    "attribute-assignment",
    "attribute-def",
    "attribute-defs",
    "attributes",
    "attribute-value-token",
    "cdata",
    "char",
    "children-property-name",
    "class-name",
    "connector",
    "conref",
    "content",
    "content-tokens",
    "content-type",
    "current",
    "current-attribute-index",
    "current-group",
    "data-char",
    "data-property-name",
    "data-sep-property-name",
    "decl-value-type",
    "defaulted?",
    "defaulted-entities",
    "default-entity",
    "default-value",
    "default-value-type",
    "doctypes-and-linktypes",
    "document-element",
    "document-type",
    "element",
    "elements",
    "element-token",
    "element-type",
    "element-types",
    "empty",
    "entities",
    "entity",
    "entity-name",
    "entity-type",
    "epilog",
    "exclusions",
    "external-data",
    "external-id",
    "fixed",
    "general-entities",
    "generated-system-id",
    "gi",
    "governing?",
    "governing-doctype",
    "grove-root",
    "id",
    "idref",
    "idrefs",
    "implied?",
    "included?",
    "inclusions",
    "model-group",
    "must-omit-end-tag?",
    "name",
    "names",
    "ndata",
    "name-token-group",
    "nmtoken",
    "nmtokens",
    "notation",
    "notation-name",
    "notations",
    "number",
    "numbers",
    "nutoken",
    "nutokens",
    "occur-indicator",
    "omit-end-tag?",
    "omit-start-tag?",
    "opt",
    "or",
    "origin",
    "origin-to-subnode-rel-property-name",
    "parameter-entities",
    "parent",
    "pcdata-token",
    "pi",
    "plus",
    "prolog",
    "public-id",
    "rcdata",
    "referent",
    "rep",
    "required",
    "sdata",
    "seq",
    "sgml-constants",
    "sgml-document",
    "subdocument",
    "subnode-property-names",
    "system-data",
    "system-id",
    "text",
    "token",
    "tokens",
    "token-sep",
    "tree-root",
    "value"
  ];

  export function rcsName(id: Id): string | null {
    if (id < 0 || id >= rcsNames.length)
      return null;
    return rcsNames[id];
  }

  export function sdqlName(id: Id): string | null {
    if (id < 0 || id >= sdqlNames.length)
      return null;
    return sdqlNames[id];
  }
}

// Forward declarations - TypeScript handles circular references automatically

export class ClassDef {
  className: ComponentName.Id;
  allPropertyNames: ComponentName.Id[];
  subnodePropertyNames: ComponentName.Id[];
  childrenPropertyName: ComponentName.Id;
  dataPropertyName: ComponentName.Id;
  dataSepPropertyName: ComponentName.Id;

  constructor(
    className: ComponentName.Id,
    allPropertyNames: ComponentName.Id[],
    subnodePropertyNames: ComponentName.Id[],
    childrenPropertyName: ComponentName.Id,
    dataPropertyName: ComponentName.Id,
    dataSepPropertyName: ComponentName.Id
  ) {
    this.className = className;
    this.allPropertyNames = allPropertyNames;
    this.subnodePropertyNames = subnodePropertyNames;
    this.childrenPropertyName = childrenPropertyName;
    this.dataPropertyName = dataPropertyName;
    this.dataSepPropertyName = dataSepPropertyName;
  }

  // Static class definitions - initialized at end of file
  static sgmlDocument: ClassDef;
  static sgmlConstants: ClassDef;
  static dataChar: ClassDef;
  static element: ClassDef;
  static attributeAssignment: ClassDef;
  static attributeDef: ClassDef;
  static attributeValueToken: ClassDef;
  static pi: ClassDef;
  static sdata: ClassDef;
  static documentType: ClassDef;
  static entity: ClassDef;
  static notation: ClassDef;
  static externalId: ClassDef;
  static externalData: ClassDef;
  static subdocument: ClassDef;
  static nonSgml: ClassDef;
  static message: ClassDef;
  static elementType: ClassDef;
  static modelGroup: ClassDef;
  static elementToken: ClassDef;
  static pcdataToken: ClassDef;
  static defaultEntity: ClassDef;
}

export class GroveString {
  private data_: Uint32Array | null;
  private offset_: number;
  private size_: number;

  constructor(data?: Uint32Array | null, size?: number, offset?: number) {
    this.data_ = data ?? null;
    this.offset_ = offset ?? 0;
    this.size_ = size ?? 0;
  }

  size(): number {
    return this.size_;
  }

  data(): Uint32Array | null {
    return this.data_;
  }

  offset(): number {
    return this.offset_;
  }

  assign(data: Uint32Array | null, size: number, offset: number = 0): void {
    this.data_ = data;
    this.offset_ = offset;
    this.size_ = size;
  }

  equals(str: GroveString): boolean {
    if (this.size() !== str.size())
      return false;
    if (this.size() === 0)
      return true;
    if (this.data_ === null || str.data_ === null)
      return false;
    for (let i = 0; i < this.size_; i++) {
      if (this.data_[this.offset_ + i] !== str.data_![str.offset_ + i])
        return false;
    }
    return true;
  }

  notEquals(str: GroveString): boolean {
    return !this.equals(str);
  }

  get(i: number): GroveChar {
    return this.data_![this.offset_ + i];
  }

  *[Symbol.iterator](): Iterator<GroveChar> {
    if (this.data_) {
      for (let i = 0; i < this.size_; i++) {
        yield this.data_[this.offset_ + i];
      }
    }
  }
}

export class SdataMapper {
  // Returns a pointer to a single character or null
  sdataMap(name: GroveString, text: GroveString): { result: boolean; ch: GroveChar } {
    return { result: false, ch: 0 };
  }
}

// Forward declaration of NodeVisitor
export abstract class NodeVisitor {
  sgmlDocument(nd: Node): void { }
  sgmlConstants(nd: Node): void { }
  dataChar(nd: Node): void { }
  element(nd: Node): void { }
  attributeAssignment(nd: Node): void { }
  attributeDef(nd: Node): void { }
  attributeValueToken(nd: Node): void { }
  pi(nd: Node): void { }
  sdata(nd: Node): void { }
  documentType(nd: Node): void { }
  entity(nd: Node): void { }
  notation(nd: Node): void { }
  externalId(nd: Node): void { }
  externalData(nd: Node): void { }
  subdocument(nd: Node): void { }
  nonSgml(nd: Node): void { }
  message(nd: Node): void { }
  elementType(nd: Node): void { }
  modelGroup(nd: Node): void { }
  elementToken(nd: Node): void { }
  pcdataToken(nd: Node): void { }
  defaultEntity(nd: Node): void { }
}

export abstract class PropertyValue {
  abstract setNode(value: NodePtr): void;
  abstract setNodeList(value: NodeListPtr): void;
  abstract setNamedNodeList(value: NamedNodeListPtr): void;
  abstract setBoolean(value: boolean): void;
  abstract setChar(value: GroveChar): void;
  abstract setString(value: GroveString): void;
  abstract setComponentNameId(value: ComponentName.Id): void;
  abstract setStringList(value: GroveStringListPtr): void;
  abstract setComponentNameIdList(value: ComponentName.Id[]): void;
  abstract setLong(value: number): void;
}

export namespace OccurIndicator {
  export enum Enum { opt, plus, rep }
}

export namespace EntityType {
  export enum Enum { text, cdata, sdata, ndata, subdocument, pi }
}

export namespace DeclValueType {
  export enum Enum {
    cdata, entity, entities, id, idref, idrefs, name, names, nmtoken,
    nmtokens, number, numbers, nutoken, nutokens, notation, nmtkgrp
  }
}

export namespace DefaultValueType {
  export enum Enum { value, fixed, required, current, conref, implied }
}

export namespace ContentType {
  export enum Enum { cdata, rcdata, empty, any, modelgrp }
}

export namespace Connector {
  export enum Enum { and_, or_, seq }
}

export namespace Severity {
  export enum Enum { info, warning, error }
}

export abstract class Node {
  protected refCount_: number = 0;

  // Intrinsic properties
  getOrigin(ptr: NodePtr): AccessResult {
    return AccessResult.accessNull;
  }

  getParent(ptr: NodePtr): AccessResult {
    return AccessResult.accessNull;
  }

  getGroveRoot(ptr: NodePtr): AccessResult {
    return AccessResult.accessNull;
  }

  getTreeRoot(nd: NodePtr): AccessResult {
    nd.assign(this);
    for (;;) {
      const res = nd.node()!.getParent(nd);
      if (res !== AccessResult.accessOK) {
        if (res === AccessResult.accessTimeout)
          return res;
        break;
      }
    }
    return AccessResult.accessOK;
  }

  abstract getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id };

  getClassName(): { result: AccessResult; name: ComponentName.Id } {
    return { result: AccessResult.accessOK, name: this.classDef().className };
  }

  getChildrenPropertyName(): { result: AccessResult; name: ComponentName.Id } {
    const def = this.classDef();
    if (def.childrenPropertyName === ComponentName.Id.noId)
      return { result: AccessResult.accessNull, name: ComponentName.Id.noId };
    return { result: AccessResult.accessOK, name: def.childrenPropertyName };
  }

  getDataPropertyName(): { result: AccessResult; name: ComponentName.Id } {
    const def = this.classDef();
    if (def.dataPropertyName === ComponentName.Id.noId)
      return { result: AccessResult.accessNull, name: ComponentName.Id.noId };
    return { result: AccessResult.accessOK, name: def.dataPropertyName };
  }

  getDataSepPropertyName(): { result: AccessResult; name: ComponentName.Id } {
    const def = this.classDef();
    if (def.dataSepPropertyName === ComponentName.Id.noId)
      return { result: AccessResult.accessNull, name: ComponentName.Id.noId };
    return { result: AccessResult.accessOK, name: def.dataSepPropertyName };
  }

  getSubnodePropertyNames(): { result: AccessResult; names: ComponentName.Id[] } {
    return { result: AccessResult.accessOK, names: this.classDef().subnodePropertyNames };
  }

  getAllPropertyNames(): { result: AccessResult; names: ComponentName.Id[] } {
    return { result: AccessResult.accessOK, names: this.classDef().allPropertyNames };
  }

  // Visitor pattern
  abstract accept(visitor: NodeVisitor): void;
  abstract classDef(): ClassDef;

  // Navigation
  abstract children(ptr: NodeListPtr): AccessResult;
  abstract follow(ptr: NodeListPtr): AccessResult;

  nextSibling(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  nextChunkSibling(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  nextChunkAfter(nd: NodePtr): AccessResult {
    let ret = this.firstChild(nd);
    switch (ret) {
      case AccessResult.accessOK:
      case AccessResult.accessTimeout:
        return ret;
      default:
        break;
    }
    for (;;) {
      ret = nd.node()!.nextChunkSibling(nd);
      switch (ret) {
        case AccessResult.accessOK:
        case AccessResult.accessTimeout:
          return ret;
        default:
          break;
      }
      ret = this.getParent(nd);
      if (ret !== AccessResult.accessOK)
        break;
    }
    return ret;
  }

  charChunk(mapper: SdataMapper): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  firstChild(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  firstSibling(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  siblingsIndex(): { result: AccessResult; index: number } {
    return { result: AccessResult.accessNotInClass, index: 0 };
  }

  attributeRef(n: number, ptr: NodePtr): AccessResult {
    const attsResult = this.getAttributes();
    if (attsResult.result !== AccessResult.accessOK)
      return attsResult.result;
    return attsResult.atts!.nodeList().list()!.ref(n, ptr);
  }

  followSiblingRef(n: number, ptr: NodePtr): AccessResult {
    if (n === 0)
      return this.nextSibling(ptr);
    const tem = new NodePtr();
    let ret = this.nextSibling(tem);
    if (ret !== AccessResult.accessOK)
      return ret;
    while (--n > 0) {
      ret = tem.assignNextSibling();
      if (ret !== AccessResult.accessOK)
        return ret;
    }
    return tem.node()!.nextSibling(ptr);
  }

  tokens(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  elementIndex(): { result: AccessResult; index: number } {
    return { result: AccessResult.accessNotInClass, index: 0 };
  }

  hash(): number {
    return 0;
  }

  abstract equals(node: Node): boolean;

  notEquals(node: Node): boolean {
    return !this.equals(node);
  }

  chunkContains(nd: Node): boolean {
    return this.equals(nd);
  }

  sameGrove(node: Node): boolean {
    return this.groveIndex() === node.groveIndex();
  }

  queryInterface(iid: string): { result: boolean; ptr: any } {
    return { result: false, ptr: null };
  }

  getMessages(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getSeverity(): { result: AccessResult; severity: Severity.Enum } {
    return { result: AccessResult.accessNotInClass, severity: Severity.Enum.info };
  }

  abstract groveIndex(): number;

  addRef(): void {
    this.refCount_++;
  }

  release(): void {
    if (--this.refCount_ === 0) {
      // GC will handle cleanup
    }
  }

  // Special method implemented in terms of charChunk
  getChar(mapper: SdataMapper): { result: AccessResult; c: GroveChar } {
    const chunkResult = this.charChunk(mapper);
    if (chunkResult.result === AccessResult.accessOK)
      return { result: AccessResult.accessOK, c: chunkResult.str.get(0) };
    return { result: chunkResult.result, c: 0 };
  }

  // Properties common to several node classes
  getAttributes(): { result: AccessResult; atts: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, atts: null };
  }

  getName(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getSystemData(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getEntity(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getEntityName(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getExternalId(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getNotation(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getGi(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getOccurIndicator(): { result: AccessResult; indicator: OccurIndicator.Enum } {
    return { result: AccessResult.accessNotInClass, indicator: OccurIndicator.Enum.opt };
  }

  getAttributeDefs(): { result: AccessResult; defs: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, defs: null };
  }

  getText(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getNotationName(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getEntityType(): { result: AccessResult; entityType: EntityType.Enum } {
    return { result: AccessResult.accessNotInClass, entityType: EntityType.Enum.text };
  }

  // Properties only on entity
  getDefaulted(): { result: AccessResult; defaulted: boolean } {
    return { result: AccessResult.accessNotInClass, defaulted: false };
  }

  // Properties only on externalId
  getPublicId(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getSystemId(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getGeneratedSystemId(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  // Properties only on attributeAssignment
  getValue(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getTokenSep(): { result: AccessResult; sep: GroveChar } {
    return { result: AccessResult.accessNotInClass, sep: 0 };
  }

  getImplied(): { result: AccessResult; implied: boolean } {
    return { result: AccessResult.accessNotInClass, implied: false };
  }

  getAttributeDef(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  // Properties only on attributeDef
  getCurrentAttributeIndex(): { result: AccessResult; index: number } {
    return { result: AccessResult.accessNotInClass, index: 0 };
  }

  getCurrentGroup(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getDeclValueType(): { result: AccessResult; valueType: DeclValueType.Enum } {
    return { result: AccessResult.accessNotInClass, valueType: DeclValueType.Enum.cdata };
  }

  getDefaultValueType(): { result: AccessResult; valueType: DefaultValueType.Enum } {
    return { result: AccessResult.accessNotInClass, valueType: DefaultValueType.Enum.value };
  }

  getDefaultValue(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getTokens(): { result: AccessResult; tokens: GroveStringList | null } {
    return { result: AccessResult.accessNotInClass, tokens: null };
  }

  // Properties only on element
  hasGi(gi: GroveString): boolean {
    return false;
  }

  getId(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getContent(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getIncluded(): { result: AccessResult; included: boolean } {
    return { result: AccessResult.accessNotInClass, included: false };
  }

  getMustOmitEndTag(): { result: AccessResult; mustOmit: boolean } {
    return { result: AccessResult.accessNotInClass, mustOmit: false };
  }

  getElementType(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  // Properties only on elementType
  getContentType(): { result: AccessResult; contentType: ContentType.Enum } {
    return { result: AccessResult.accessNotInClass, contentType: ContentType.Enum.any };
  }

  getExclusions(): { result: AccessResult; exclusions: GroveStringList | null } {
    return { result: AccessResult.accessNotInClass, exclusions: null };
  }

  getInclusions(): { result: AccessResult; inclusions: GroveStringList | null } {
    return { result: AccessResult.accessNotInClass, inclusions: null };
  }

  getModelGroup(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getOmitEndTag(): { result: AccessResult; omit: boolean } {
    return { result: AccessResult.accessNotInClass, omit: false };
  }

  getOmitStartTag(): { result: AccessResult; omit: boolean } {
    return { result: AccessResult.accessNotInClass, omit: false };
  }

  // Properties only on modelGroup
  getConnector(): { result: AccessResult; connector: Connector.Enum } {
    return { result: AccessResult.accessNotInClass, connector: Connector.Enum.seq };
  }

  getContentTokens(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  // Properties only on attributeValueToken
  getToken(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getReferent(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  // Properties only on doctype
  getGoverning(): { result: AccessResult; governing: boolean } {
    return { result: AccessResult.accessNotInClass, governing: false };
  }

  getGeneralEntities(): { result: AccessResult; entities: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, entities: null };
  }

  getNotations(): { result: AccessResult; notations: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, notations: null };
  }

  getElementTypes(): { result: AccessResult; types: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, types: null };
  }

  getDefaultEntity(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getParameterEntities(): { result: AccessResult; entities: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, entities: null };
  }

  // Properties only on sgmlDocument
  getSgmlConstants(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getApplicationInfo(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNotInClass, str: new GroveString() };
  }

  getProlog(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getEpilog(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getDocumentElement(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getElements(): { result: AccessResult; elements: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, elements: null };
  }

  getEntities(): { result: AccessResult; entities: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, entities: null };
  }

  getDefaultedEntities(): { result: AccessResult; entities: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, entities: null };
  }

  getGoverningDoctype(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  getDoctypesAndLinktypes(): { result: AccessResult; list: NamedNodeList | null } {
    return { result: AccessResult.accessNotInClass, list: null };
  }

  // Properties only on dataChar
  getNonSgml(): { result: AccessResult; value: number } {
    return { result: AccessResult.accessNotInClass, value: 0 };
  }

  property(id: ComponentName.Id, mapper: SdataMapper, value: PropertyValue): AccessResult {
    let ret: AccessResult;
    switch (id) {
      case ComponentName.Id.idEntityType: {
        const typeResult = this.getEntityType();
        ret = typeResult.result;
        if (ret === AccessResult.accessOK) {
          switch (typeResult.entityType) {
            case EntityType.Enum.text: value.setComponentNameId(ComponentName.Id.idText); break;
            case EntityType.Enum.cdata: value.setComponentNameId(ComponentName.Id.idCdata); break;
            case EntityType.Enum.sdata: value.setComponentNameId(ComponentName.Id.idSdata); break;
            case EntityType.Enum.ndata: value.setComponentNameId(ComponentName.Id.idNdata); break;
            case EntityType.Enum.pi: value.setComponentNameId(ComponentName.Id.idPi); break;
            case EntityType.Enum.subdocument: value.setComponentNameId(ComponentName.Id.idSubdocument); break;
            default:
              ret = AccessResult.accessNotInClass;
          }
        }
        break;
      }
      case ComponentName.Id.idDeclValueType: {
        const typeResult = this.getDeclValueType();
        ret = typeResult.result;
        if (ret === AccessResult.accessOK) {
          switch (typeResult.valueType) {
            case DeclValueType.Enum.cdata: value.setComponentNameId(ComponentName.Id.idCdata); break;
            case DeclValueType.Enum.entity: value.setComponentNameId(ComponentName.Id.idEntity); break;
            case DeclValueType.Enum.entities: value.setComponentNameId(ComponentName.Id.idEntities); break;
            case DeclValueType.Enum.id: value.setComponentNameId(ComponentName.Id.idId); break;
            case DeclValueType.Enum.idref: value.setComponentNameId(ComponentName.Id.idIdref); break;
            case DeclValueType.Enum.idrefs: value.setComponentNameId(ComponentName.Id.idIdrefs); break;
            case DeclValueType.Enum.name: value.setComponentNameId(ComponentName.Id.idName); break;
            case DeclValueType.Enum.names: value.setComponentNameId(ComponentName.Id.idNames); break;
            case DeclValueType.Enum.nmtoken: value.setComponentNameId(ComponentName.Id.idNmtoken); break;
            case DeclValueType.Enum.nmtokens: value.setComponentNameId(ComponentName.Id.idNmtokens); break;
            case DeclValueType.Enum.number: value.setComponentNameId(ComponentName.Id.idNumber); break;
            case DeclValueType.Enum.numbers: value.setComponentNameId(ComponentName.Id.idNumbers); break;
            case DeclValueType.Enum.nutoken: value.setComponentNameId(ComponentName.Id.idNutoken); break;
            case DeclValueType.Enum.nutokens: value.setComponentNameId(ComponentName.Id.idNutokens); break;
            case DeclValueType.Enum.notation: value.setComponentNameId(ComponentName.Id.idNotation); break;
            case DeclValueType.Enum.nmtkgrp: value.setComponentNameId(ComponentName.Id.idNmtkgrp); break;
            default:
              ret = AccessResult.accessNotInClass;
          }
        }
        break;
      }
      case ComponentName.Id.idDefaultValueType: {
        const typeResult = this.getDefaultValueType();
        ret = typeResult.result;
        if (ret === AccessResult.accessOK) {
          switch (typeResult.valueType) {
            case DefaultValueType.Enum.value: value.setComponentNameId(ComponentName.Id.idValue); break;
            case DefaultValueType.Enum.fixed: value.setComponentNameId(ComponentName.Id.idFixed); break;
            case DefaultValueType.Enum.required: value.setComponentNameId(ComponentName.Id.idRequired); break;
            case DefaultValueType.Enum.current: value.setComponentNameId(ComponentName.Id.idCurrent); break;
            case DefaultValueType.Enum.conref: value.setComponentNameId(ComponentName.Id.idConref); break;
            case DefaultValueType.Enum.implied: value.setComponentNameId(ComponentName.Id.idImplied); break;
            default:
              ret = AccessResult.accessNotInClass;
          }
        }
        break;
      }
      case ComponentName.Id.idContentType: {
        const typeResult = this.getContentType();
        ret = typeResult.result;
        if (ret === AccessResult.accessOK) {
          switch (typeResult.contentType) {
            case ContentType.Enum.cdata: value.setComponentNameId(ComponentName.Id.idCdata); break;
            case ContentType.Enum.rcdata: value.setComponentNameId(ComponentName.Id.idRcdata); break;
            case ContentType.Enum.empty: value.setComponentNameId(ComponentName.Id.idEmpty); break;
            case ContentType.Enum.any: value.setComponentNameId(ComponentName.Id.idAny); break;
            case ContentType.Enum.modelgrp: value.setComponentNameId(ComponentName.Id.idModelGroup); break;
            default:
              ret = AccessResult.accessNotInClass;
          }
        }
        break;
      }
      case ComponentName.Id.idConnector: {
        const typeResult = this.getConnector();
        ret = typeResult.result;
        if (ret === AccessResult.accessOK) {
          switch (typeResult.connector) {
            case Connector.Enum.and_: value.setComponentNameId(ComponentName.Id.idAnd); break;
            case Connector.Enum.or_: value.setComponentNameId(ComponentName.Id.idOr); break;
            case Connector.Enum.seq: value.setComponentNameId(ComponentName.Id.idSeq); break;
            default:
              ret = AccessResult.accessNotInClass;
          }
        }
        break;
      }
      case ComponentName.Id.idChar: {
        const charResult = this.getChar(mapper);
        ret = charResult.result;
        if (ret === AccessResult.accessOK)
          value.setChar(charResult.c);
        break;
      }
      case ComponentName.Id.idClassName: {
        const classResult = this.getClassName();
        ret = classResult.result;
        if (ret === AccessResult.accessOK)
          value.setComponentNameId(classResult.name);
        break;
      }
      case ComponentName.Id.idChildrenPropertyName: {
        const childResult = this.getChildrenPropertyName();
        ret = childResult.result;
        if (ret === AccessResult.accessOK)
          value.setComponentNameId(childResult.name);
        break;
      }
      case ComponentName.Id.idDataPropertyName: {
        const dataResult = this.getDataPropertyName();
        ret = dataResult.result;
        if (ret === AccessResult.accessOK)
          value.setComponentNameId(dataResult.name);
        break;
      }
      case ComponentName.Id.idDataSepPropertyName: {
        const sepResult = this.getDataSepPropertyName();
        ret = sepResult.result;
        if (ret === AccessResult.accessOK)
          value.setComponentNameId(sepResult.name);
        break;
      }
      case ComponentName.Id.idOriginToSubnodeRelPropertyName: {
        const otsResult = this.getOriginToSubnodeRelPropertyName();
        ret = otsResult.result;
        if (ret === AccessResult.accessOK)
          value.setComponentNameId(otsResult.id);
        break;
      }
      case ComponentName.Id.idSubnodePropertyNames: {
        const subResult = this.getSubnodePropertyNames();
        ret = subResult.result;
        if (ret === AccessResult.accessOK)
          value.setComponentNameIdList(subResult.names);
        break;
      }
      case ComponentName.Id.idAllPropertyNames: {
        const allResult = this.getAllPropertyNames();
        ret = allResult.result;
        if (ret === AccessResult.accessOK)
          value.setComponentNameIdList(allResult.names);
        break;
      }
      case ComponentName.Id.idDefaulted: {
        const defResult = this.getDefaulted();
        ret = defResult.result;
        if (ret === AccessResult.accessOK)
          value.setBoolean(defResult.defaulted);
        break;
      }
      case ComponentName.Id.idGoverning: {
        const govResult = this.getGoverning();
        ret = govResult.result;
        if (ret === AccessResult.accessOK)
          value.setBoolean(govResult.governing);
        break;
      }
      case ComponentName.Id.idImplied: {
        const impResult = this.getImplied();
        ret = impResult.result;
        if (ret === AccessResult.accessOK)
          value.setBoolean(impResult.implied);
        break;
      }
      case ComponentName.Id.idIncluded: {
        const incResult = this.getIncluded();
        ret = incResult.result;
        if (ret === AccessResult.accessOK)
          value.setBoolean(incResult.included);
        break;
      }
      case ComponentName.Id.idMustOmitEndTag: {
        const mustResult = this.getMustOmitEndTag();
        ret = mustResult.result;
        if (ret === AccessResult.accessOK)
          value.setBoolean(mustResult.mustOmit);
        break;
      }
      case ComponentName.Id.idOmitEndTag: {
        const omitResult = this.getOmitEndTag();
        ret = omitResult.result;
        if (ret === AccessResult.accessOK)
          value.setBoolean(omitResult.omit);
        break;
      }
      case ComponentName.Id.idOmitStartTag: {
        const omitResult = this.getOmitStartTag();
        ret = omitResult.result;
        if (ret === AccessResult.accessOK)
          value.setBoolean(omitResult.omit);
        break;
      }
      case ComponentName.Id.idTokenSep: {
        const sepResult = this.getTokenSep();
        ret = sepResult.result;
        if (ret === AccessResult.accessOK)
          value.setChar(sepResult.sep);
        break;
      }
      case ComponentName.Id.idAttributes: {
        const attsResult = this.getAttributes();
        ret = attsResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(attsResult.atts));
        break;
      }
      case ComponentName.Id.idDefaultedEntities: {
        const entResult = this.getDefaultedEntities();
        ret = entResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(entResult.entities));
        break;
      }
      case ComponentName.Id.idDoctypesAndLinktypes: {
        const dtResult = this.getDoctypesAndLinktypes();
        ret = dtResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(dtResult.list));
        break;
      }
      case ComponentName.Id.idElements: {
        const elemsResult = this.getElements();
        ret = elemsResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(elemsResult.elements));
        break;
      }
      case ComponentName.Id.idEntities: {
        const entsResult = this.getEntities();
        ret = entsResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(entsResult.entities));
        break;
      }
      case ComponentName.Id.idGeneralEntities: {
        const gentsResult = this.getGeneralEntities();
        ret = gentsResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(gentsResult.entities));
        break;
      }
      case ComponentName.Id.idNotations: {
        const notsResult = this.getNotations();
        ret = notsResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(notsResult.notations));
        break;
      }
      case ComponentName.Id.idAttributeDefs: {
        const defsResult = this.getAttributeDefs();
        ret = defsResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(defsResult.defs));
        break;
      }
      case ComponentName.Id.idElementTypes: {
        const typesResult = this.getElementTypes();
        ret = typesResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(typesResult.types));
        break;
      }
      case ComponentName.Id.idParameterEntities: {
        const pentsResult = this.getParameterEntities();
        ret = pentsResult.result;
        if (ret === AccessResult.accessOK)
          value.setNamedNodeList(new NamedNodeListPtr(pentsResult.entities));
        break;
      }
      case ComponentName.Id.idDocumentElement: {
        const elemPtr = new NodePtr();
        ret = this.getDocumentElement(elemPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(elemPtr);
        break;
      }
      case ComponentName.Id.idEntity: {
        const entPtr = new NodePtr();
        ret = this.getEntity(entPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(entPtr);
        break;
      }
      case ComponentName.Id.idExternalId: {
        const extPtr = new NodePtr();
        ret = this.getExternalId(extPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(extPtr);
        break;
      }
      case ComponentName.Id.idGoverningDoctype: {
        const govPtr = new NodePtr();
        ret = this.getGoverningDoctype(govPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(govPtr);
        break;
      }
      case ComponentName.Id.idGroveRoot: {
        const rootPtr = new NodePtr();
        ret = this.getGroveRoot(rootPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(rootPtr);
        break;
      }
      case ComponentName.Id.idNotation: {
        const notPtr = new NodePtr();
        ret = this.getNotation(notPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(notPtr);
        break;
      }
      case ComponentName.Id.idOrigin: {
        const origPtr = new NodePtr();
        ret = this.getOrigin(origPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(origPtr);
        break;
      }
      case ComponentName.Id.idParent: {
        const parPtr = new NodePtr();
        ret = this.getParent(parPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(parPtr);
        break;
      }
      case ComponentName.Id.idReferent: {
        const refPtr = new NodePtr();
        ret = this.getReferent(refPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(refPtr);
        break;
      }
      case ComponentName.Id.idSgmlConstants: {
        const constPtr = new NodePtr();
        ret = this.getSgmlConstants(constPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(constPtr);
        break;
      }
      case ComponentName.Id.idTreeRoot: {
        const treePtr = new NodePtr();
        ret = this.getTreeRoot(treePtr);
        if (ret === AccessResult.accessOK)
          value.setNode(treePtr);
        break;
      }
      case ComponentName.Id.idModelGroup: {
        const mgPtr = new NodePtr();
        ret = this.getModelGroup(mgPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(mgPtr);
        break;
      }
      case ComponentName.Id.idDefaultEntity: {
        const defEntPtr = new NodePtr();
        ret = this.getDefaultEntity(defEntPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(defEntPtr);
        break;
      }
      case ComponentName.Id.idElementType: {
        const etPtr = new NodePtr();
        ret = this.getElementType(etPtr);
        if (ret === AccessResult.accessOK)
          value.setNode(etPtr);
        break;
      }
      case ComponentName.Id.idContent: {
        const contentPtr = new NodeListPtr();
        ret = this.getContent(contentPtr);
        if (ret === AccessResult.accessOK)
          value.setNodeList(contentPtr);
        break;
      }
      case ComponentName.Id.idEpilog: {
        const epilogPtr = new NodeListPtr();
        ret = this.getEpilog(epilogPtr);
        if (ret === AccessResult.accessOK)
          value.setNodeList(epilogPtr);
        break;
      }
      case ComponentName.Id.idProlog: {
        const prologPtr = new NodeListPtr();
        ret = this.getProlog(prologPtr);
        if (ret === AccessResult.accessOK)
          value.setNodeList(prologPtr);
        break;
      }
      case ComponentName.Id.idValue: {
        const valuePtr = new NodeListPtr();
        ret = this.getValue(valuePtr);
        if (ret === AccessResult.accessOK)
          value.setNodeList(valuePtr);
        break;
      }
      case ComponentName.Id.idContentTokens: {
        const ctPtr = new NodeListPtr();
        ret = this.getContentTokens(ctPtr);
        if (ret === AccessResult.accessOK)
          value.setNodeList(ctPtr);
        break;
      }
      case ComponentName.Id.idDefaultValue: {
        const dvPtr = new NodeListPtr();
        ret = this.getDefaultValue(dvPtr);
        if (ret === AccessResult.accessOK)
          value.setNodeList(dvPtr);
        break;
      }
      case ComponentName.Id.idCurrentGroup: {
        const cgPtr = new NodeListPtr();
        ret = this.getCurrentGroup(cgPtr);
        if (ret === AccessResult.accessOK)
          value.setNodeList(cgPtr);
        break;
      }
      case ComponentName.Id.idApplicationInfo: {
        const appResult = this.getApplicationInfo();
        ret = appResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(appResult.str);
        break;
      }
      case ComponentName.Id.idEntityName: {
        const enResult = this.getEntityName();
        ret = enResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(enResult.str);
        break;
      }
      case ComponentName.Id.idGeneratedSystemId: {
        const gsidResult = this.getGeneratedSystemId();
        ret = gsidResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(gsidResult.str);
        break;
      }
      case ComponentName.Id.idGi: {
        const giResult = this.getGi();
        ret = giResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(giResult.str);
        break;
      }
      case ComponentName.Id.idId: {
        const idResult = this.getId();
        ret = idResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(idResult.str);
        break;
      }
      case ComponentName.Id.idName: {
        const nameResult = this.getName();
        ret = nameResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(nameResult.str);
        break;
      }
      case ComponentName.Id.idNotationName: {
        const nnResult = this.getNotationName();
        ret = nnResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(nnResult.str);
        break;
      }
      case ComponentName.Id.idPublicId: {
        const pubResult = this.getPublicId();
        ret = pubResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(pubResult.str);
        break;
      }
      case ComponentName.Id.idSystemData: {
        const sdResult = this.getSystemData();
        ret = sdResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(sdResult.str);
        break;
      }
      case ComponentName.Id.idSystemId: {
        const sidResult = this.getSystemId();
        ret = sidResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(sidResult.str);
        break;
      }
      case ComponentName.Id.idText: {
        const txtResult = this.getText();
        ret = txtResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(txtResult.str);
        break;
      }
      case ComponentName.Id.idToken: {
        const tokResult = this.getToken();
        ret = tokResult.result;
        if (ret === AccessResult.accessOK)
          value.setString(tokResult.str);
        break;
      }
      case ComponentName.Id.idExclusions: {
        const exclResult = this.getExclusions();
        ret = exclResult.result;
        if (ret === AccessResult.accessOK)
          value.setStringList(new GroveStringListPtr(exclResult.exclusions));
        break;
      }
      case ComponentName.Id.idInclusions: {
        const inclResult = this.getInclusions();
        ret = inclResult.result;
        if (ret === AccessResult.accessOK)
          value.setStringList(new GroveStringListPtr(inclResult.inclusions));
        break;
      }
      case ComponentName.Id.idTokens: {
        const toksResult = this.getTokens();
        ret = toksResult.result;
        if (ret === AccessResult.accessOK)
          value.setStringList(new GroveStringListPtr(toksResult.tokens));
        break;
      }
      case ComponentName.Id.idCurrentAttributeIndex: {
        const caiResult = this.getCurrentAttributeIndex();
        ret = caiResult.result;
        if (ret === AccessResult.accessOK)
          value.setLong(caiResult.index);
        break;
      }
      default:
        ret = AccessResult.accessNotInClass;
        break;
    }
    return ret;
  }
}

export abstract class NodeList {
  protected refCount_: number = 0;

  abstract first(ptr: NodePtr): AccessResult;
  abstract rest(ptr: NodeListPtr): AccessResult;
  abstract chunkRest(ptr: NodeListPtr): AccessResult;

  // i is a zero based index
  ref(n: number, ptr: NodePtr): AccessResult {
    if (n === 0)
      return this.first(ptr);
    const tem = new NodeListPtr();
    let ret = this.rest(tem);
    if (ret !== AccessResult.accessOK)
      return ret;
    while (--n > 0) {
      ret = tem.assignRest();
      if (ret !== AccessResult.accessOK)
        return ret;
    }
    return tem.list()!.first(ptr);
  }

  addRef(): void {
    this.refCount_++;
  }

  release(): void {
    if (--this.refCount_ === 0) {
      // GC will handle cleanup
    }
  }
}

export enum NamedNodeListType {
  elements,
  attributes,
  entities,
  notations,
  doctypesAndLinktypes,
  elementTypes,
  attributeDefs
}

class NodeNameNodeVisitor extends NodeVisitor {
  ret: AccessResult = AccessResult.accessNotInClass;
  nameStr: GroveString = new GroveString();
  type: NamedNodeListType;

  constructor(t: NamedNodeListType) {
    super();
    this.type = t;
  }

  element(nd: Node): void {
    if (this.type === NamedNodeListType.elements) {
      const result = nd.getId();
      this.ret = result.result;
      this.nameStr = result.str;
    }
  }

  attributeAssignment(nd: Node): void {
    if (this.type === NamedNodeListType.attributes) {
      const result = nd.getName();
      this.ret = result.result;
      this.nameStr = result.str;
    }
  }

  documentType(nd: Node): void {
    if (this.type === NamedNodeListType.doctypesAndLinktypes) {
      const result = nd.getName();
      this.ret = result.result;
      this.nameStr = result.str;
    }
  }

  entity(nd: Node): void {
    if (this.type === NamedNodeListType.entities) {
      const result = nd.getName();
      this.ret = result.result;
      this.nameStr = result.str;
    }
  }

  notation(nd: Node): void {
    if (this.type === NamedNodeListType.notations) {
      const result = nd.getName();
      this.ret = result.result;
      this.nameStr = result.str;
    }
  }

  elementType(nd: Node): void {
    if (this.type === NamedNodeListType.elementTypes) {
      const result = nd.getGi();
      this.ret = result.result;
      this.nameStr = result.str;
    }
  }

  attributeDef(nd: Node): void {
    if (this.type === NamedNodeListType.attributeDefs) {
      const result = nd.getName();
      this.ret = result.result;
      this.nameStr = result.str;
    }
  }
}

export abstract class NamedNodeList {
  protected refCount_: number = 0;

  abstract namedNode(name: GroveString, ptr: NodePtr): AccessResult;
  abstract normalize(chars: Uint32Array, size: number): number;
  abstract nodeList(): NodeListPtr;

  nodeListNoOrder(): NodeListPtr {
    return this.nodeList();
  }

  abstract type(): NamedNodeListType;

  nodeName(node: NodePtr): { result: AccessResult; name: GroveString } {
    const v = new NodeNameNodeVisitor(this.type());
    node.node()!.accept(v);
    return { result: v.ret, name: v.nameStr };
  }

  addRef(): void {
    this.refCount_++;
  }

  release(): void {
    if (--this.refCount_ === 0) {
      // GC will handle cleanup
    }
  }
}

export class NodePtr {
  private node_: Node | null;

  constructor(node?: Node | null) {
    this.node_ = node ?? null;
    this.addRef();
  }

  node(): Node | null {
    return this.node_;
  }

  assignOrigin(): AccessResult {
    return this.node_!.getOrigin(this);
  }

  assignFirstChild(): AccessResult {
    return this.node_!.firstChild(this);
  }

  assignNextSibling(): AccessResult {
    return this.node_!.nextSibling(this);
  }

  assignNextChunkSibling(): AccessResult {
    return this.node_!.nextChunkSibling(this);
  }

  assignNextChunkAfter(): AccessResult {
    return this.node_!.nextChunkAfter(this);
  }

  assignFirstSibling(): AccessResult {
    return this.node_!.firstSibling(this);
  }

  assign(node: Node | null): void {
    if (node)
      node.addRef();
    this.release();
    this.node_ = node;
  }

  clear(): void {
    this.release();
    this.node_ = null;
  }

  // Compare if two NodePtrs point to the same node
  // Following upstream operator== for NodePtr (which uses Node::operator==)
  sameNode(other: NodePtr): boolean {
    if (!this.node_ || !other.node_) {
      return this.node_ === other.node_;
    }
    // Use equals() method to properly compare grove nodes
    return this.node_.equals(other.node_);
  }

  toBoolean(): boolean {
    return this.node_ !== null;
  }

  // Convenience methods for Pattern.ts compatibility
  gi(): GroveString | null {
    if (!this.node_) return null;
    const result = this.node_.getGi();
    if (result.result !== AccessResult.accessOK) return null;
    return result.str;
  }

  parent(): NodePtr | null {
    if (!this.node_) return null;
    const ptr = new NodePtr();
    const result = this.node_.getParent(ptr);
    if (result !== AccessResult.accessOK) return null;
    return ptr;
  }

  previousSibling(): NodePtr | null {
    if (!this.node_) return null;
    // Node doesn't have a direct previousSibling method
    // We need to go to firstSibling and iterate
    const firstPtr = new NodePtr();
    const result = this.node_.firstSibling(firstPtr);
    if (result !== AccessResult.accessOK) return null;

    // If we're the first sibling, there's no previous
    if (firstPtr.node_?.equals(this.node_)) return null;

    // Iterate through siblings to find the one before us
    let prev = firstPtr;
    let current = new NodePtr();
    let nextResult = prev.node_!.nextSibling(current);

    while (nextResult === AccessResult.accessOK && current.node_) {
      if (current.node_.equals(this.node_)) {
        return prev;
      }
      prev = current;
      current = new NodePtr();
      nextResult = prev.node_!.nextSibling(current);
    }

    return null;
  }

  nextSibling(): NodePtr | null {
    if (!this.node_) return null;
    const ptr = new NodePtr();
    const result = this.node_.nextSibling(ptr);
    if (result !== AccessResult.accessOK) return null;
    return ptr;
  }

  firstChild(): NodePtr | null {
    if (!this.node_) return null;
    const ptr = new NodePtr();
    const result = this.node_.firstChild(ptr);
    if (result !== AccessResult.accessOK) return null;
    return ptr;
  }

  getAttribute(name: GroveString): GroveString | null {
    if (!this.node_) return null;
    const attsResult = this.node_.getAttributes();
    if (attsResult.result !== AccessResult.accessOK || !attsResult.atts) return null;

    const nodePtr = new NodePtr();
    const result = attsResult.atts.namedNode(name, nodePtr);
    if (result !== AccessResult.accessOK || !nodePtr.node_) return null;

    // Get the value from the attribute node
    const valueListPtr = new NodeListPtr();
    const valueResult = nodePtr.node_.getValue(valueListPtr);
    if (valueResult !== AccessResult.accessOK || !valueListPtr.list()) return null;

    // Get first node from value list and extract its data
    const valueNodePtr = new NodePtr();
    const firstResult = valueListPtr.list()!.first(valueNodePtr);
    if (firstResult !== AccessResult.accessOK || !valueNodePtr.node_) return null;

    // The value is typically character data, get the tokens/text
    const tokResult = valueNodePtr.node_.tokens();
    if (tokResult.result === AccessResult.accessOK) {
      return tokResult.str;
    }

    // Fallback: try getText
    const textResult = valueNodePtr.node_.getText();
    if (textResult.result === AccessResult.accessOK) {
      return textResult.str;
    }

    return null;
  }

  // Get character chunk from node with SDATA mapper
  charChunk(mapper: SdataMapper): { data: Uint32Array; size: number } | null {
    if (!this.node_) return null;
    const result = this.node_.charChunk(mapper);
    if (result.result !== AccessResult.accessOK) return null;
    const str = result.str;
    if (str.size() === 0 || !str.data()) return null;
    // Apply the offset to get the correct slice of data
    const offset = str.offset();
    const data = str.data()!.subarray(offset, offset + str.size());
    return { data, size: str.size() };
  }

  // Get element index for loop detection
  elementIndex(): number | null {
    if (!this.node_) return null;
    const result = this.node_.elementIndex();
    if (result.result !== AccessResult.accessOK) return null;
    return result.index;
  }

  // Get grove index for loop detection
  groveIndex(): number {
    if (!this.node_) return 0;
    return this.node_.groveIndex();
  }

  // Get next chunk sibling
  nextChunkSibling(): NodePtr | null {
    if (!this.node_) return null;
    const ptr = new NodePtr();
    const result = this.node_.nextChunkSibling(ptr);
    if (result !== AccessResult.accessOK) return null;
    if (!ptr.node_) return null;
    return ptr;
  }

  // Get document element from SGML document node
  getDocumentElement(): NodePtr | null {
    if (!this.node_) return null;
    const ptr = new NodePtr();
    const result = this.node_.getDocumentElement(ptr);
    if (result !== AccessResult.accessOK) return null;
    if (!ptr.node_) return null;
    return ptr;
  }

  // Get generic identifier (element name)
  getGi(): GroveString | null {
    if (!this.node_) return null;
    const result = this.node_.getGi();
    if (result.result !== AccessResult.accessOK) return null;
    return result.str;
  }

  private addRef(): void {
    if (this.node_) this.node_.addRef();
  }

  private release(): void {
    if (this.node_) this.node_.release();
  }
}

export class NodeListPtr {
  private list_: NodeList | null;

  constructor(list?: NodeList | null) {
    this.list_ = list ?? null;
    this.addRef();
  }

  list(): NodeList | null {
    return this.list_;
  }

  assignRest(): AccessResult {
    return this.list_!.rest(this);
  }

  assignChunkRest(): AccessResult {
    return this.list_!.chunkRest(this);
  }

  assign(list: NodeList | null): void {
    if (list)
      list.addRef();
    this.release();
    this.list_ = list;
  }

  clear(): void {
    this.release();
    this.list_ = null;
  }

  toBoolean(): boolean {
    return this.list_ !== null;
  }

  private addRef(): void {
    if (this.list_) this.list_.addRef();
  }

  private release(): void {
    if (this.list_) this.list_.release();
  }
}

export class NamedNodeListPtr {
  private list_: NamedNodeList | null;

  constructor(list?: NamedNodeList | null) {
    this.list_ = list ?? null;
    this.addRef();
  }

  list(): NamedNodeList | null {
    return this.list_;
  }

  assign(list: NamedNodeList | null): void {
    if (list)
      list.addRef();
    this.release();
    this.list_ = list;
  }

  clear(): void {
    this.release();
    this.list_ = null;
  }

  toBoolean(): boolean {
    return this.list_ !== null;
  }

  private addRef(): void {
    if (this.list_) this.list_.addRef();
  }

  private release(): void {
    if (this.list_) this.list_.release();
  }
}

export class GroveStringLink {
  data_: GroveString;
  next_: GroveStringLink | null;

  constructor(gs: GroveString) {
    this.data_ = gs;
    this.next_ = null;
  }
}

export class ConstGroveStringListIter {
  private link_: GroveStringLink | null;

  constructor(list?: GroveStringList) {
    this.link_ = list ? list.head() : null;
  }

  done(): boolean {
    return this.link_ === null;
  }

  cur(): GroveString {
    return this.link_!.data_;
  }

  next(): void {
    this.link_ = this.link_!.next_;
  }

  attach(link: GroveStringLink | null): void {
    this.link_ = link;
  }
}

export class GroveStringList {
  protected refCount_: number = 0;
  private head_: GroveStringLink | null = null;
  private iter_: ConstGroveStringListIter;

  constructor() {
    this.iter_ = new ConstGroveStringListIter();
  }

  head(): GroveStringLink | null {
    return this.head_;
  }

  append(gs: GroveString): void {
    let pp: { link: GroveStringLink | null } = { link: this.head_ };
    let lastPtr: GroveStringLink | null = null;

    // Find the end of the list
    while (pp.link !== null) {
      lastPtr = pp.link;
      pp.link = pp.link.next_;
    }

    const newLink = new GroveStringLink(gs);
    if (lastPtr === null) {
      this.head_ = newLink;
    } else {
      lastPtr.next_ = newLink;
    }

    if (this.iter_.done())
      this.iter_.attach(this.head_);
  }

  first(): { result: AccessResult; str: GroveString } {
    if (this.head_ === null)
      return { result: AccessResult.accessNull, str: new GroveString() };
    return { result: AccessResult.accessOK, str: this.head_.data_ };
  }

  rest(ptr: GroveStringListPtr): AccessResult {
    if (this.canReuse(ptr)) {
      if (this.iter_.done())
        return AccessResult.accessNull;
      this.iter_.next();
      return AccessResult.accessOK;
    }
    const newList = new GroveStringList();
    ptr.assign(newList);
    const iter = new ConstGroveStringListIter(this);
    if (iter.done())
      return AccessResult.accessNull;
    iter.next();
    while (!iter.done()) {
      newList.append(iter.cur());
      iter.next();
    }
    return AccessResult.accessOK;
  }

  iter(): ConstGroveStringListIter {
    return this.iter_;
  }

  addRef(): void {
    this.refCount_++;
  }

  release(): void {
    if (--this.refCount_ === 0) {
      // GC will handle cleanup
    }
  }

  private canReuse(ptr: GroveStringListPtr): boolean {
    return ptr.list() === this && this.refCount_ === 1;
  }
}

export class GroveStringListPtr {
  private list_: GroveStringList | null;

  constructor(list?: GroveStringList | null) {
    this.list_ = list ?? null;
    this.addRef();
  }

  list(): GroveStringList | null {
    return this.list_;
  }

  assign(list: GroveStringList | null): void {
    if (list)
      list.addRef();
    this.release();
    this.list_ = list;
  }

  clear(): void {
    this.release();
    this.list_ = null;
  }

  toBoolean(): boolean {
    return this.list_ !== null;
  }

  private addRef(): void {
    if (this.list_) this.list_.addRef();
  }

  private release(): void {
    if (this.list_) this.list_.release();
  }
}

// Initialize static ClassDef instances
const noProps: ComponentName.Id[] = [ComponentName.Id.noId];

const INTRINSIC_PROPS: ComponentName.Id[] = [
  ComponentName.Id.idClassName,
  ComponentName.Id.idGroveRoot,
  ComponentName.Id.idSubnodePropertyNames,
  ComponentName.Id.idAllPropertyNames,
  ComponentName.Id.idChildrenPropertyName,
  ComponentName.Id.idDataPropertyName,
  ComponentName.Id.idDataSepPropertyName,
  ComponentName.Id.idParent,
  ComponentName.Id.idTreeRoot,
  ComponentName.Id.idOrigin,
  ComponentName.Id.idOriginToSubnodeRelPropertyName
];

const allProps_externalId = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idPublicId,
  ComponentName.Id.idSystemId,
  ComponentName.Id.idGeneratedSystemId,
  ComponentName.Id.noId
];
ClassDef.externalId = new ClassDef(
  ComponentName.Id.idExternalId,
  allProps_externalId,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_documentType = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idName,
  ComponentName.Id.idElementTypes,
  ComponentName.Id.idGoverning,
  ComponentName.Id.idGeneralEntities,
  ComponentName.Id.idNotations,
  ComponentName.Id.idDefaultEntity,
  ComponentName.Id.idParameterEntities,
  ComponentName.Id.noId
];
const subnodeProps_documentType = [
  ComponentName.Id.idGeneralEntities,
  ComponentName.Id.idNotations,
  ComponentName.Id.idElementTypes,
  ComponentName.Id.idDefaultEntity,
  ComponentName.Id.idParameterEntities,
  ComponentName.Id.noId
];
ClassDef.documentType = new ClassDef(
  ComponentName.Id.idDocumentType,
  allProps_documentType,
  subnodeProps_documentType,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_attributeValueToken = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idToken,
  ComponentName.Id.idEntity,
  ComponentName.Id.idNotation,
  ComponentName.Id.idReferent,
  ComponentName.Id.noId
];
ClassDef.attributeValueToken = new ClassDef(
  ComponentName.Id.idAttributeValueToken,
  allProps_attributeValueToken,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.idToken,
  ComponentName.Id.noId
);

const allProps_sgmlDocument = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idSgmlConstants,
  ComponentName.Id.idApplicationInfo,
  ComponentName.Id.idProlog,
  ComponentName.Id.idEpilog,
  ComponentName.Id.idGoverningDoctype,
  ComponentName.Id.idDoctypesAndLinktypes,
  ComponentName.Id.idDocumentElement,
  ComponentName.Id.idElements,
  ComponentName.Id.idEntities,
  ComponentName.Id.idDefaultedEntities,
  ComponentName.Id.noId
];
const subnodeProps_sgmlDocument = [
  ComponentName.Id.idSgmlConstants,
  ComponentName.Id.idProlog,
  ComponentName.Id.idEpilog,
  ComponentName.Id.idDoctypesAndLinktypes,
  ComponentName.Id.idDocumentElement,
  ComponentName.Id.idDefaultedEntities,
  ComponentName.Id.noId
];
ClassDef.sgmlDocument = new ClassDef(
  ComponentName.Id.idSgmlDocument,
  allProps_sgmlDocument,
  subnodeProps_sgmlDocument,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_dataChar = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idChar,
  ComponentName.Id.noId
];
ClassDef.dataChar = new ClassDef(
  ComponentName.Id.idDataChar,
  allProps_dataChar,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.idChar,
  ComponentName.Id.noId
);

const allProps_subdocument = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idEntityName,
  ComponentName.Id.idEntity,
  ComponentName.Id.noId
];
ClassDef.subdocument = new ClassDef(
  ComponentName.Id.idSubdocument,
  allProps_subdocument,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_pi = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idSystemData,
  ComponentName.Id.idEntityName,
  ComponentName.Id.idEntity,
  ComponentName.Id.noId
];
ClassDef.pi = new ClassDef(
  ComponentName.Id.idPi,
  allProps_pi,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_element = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idGi,
  ComponentName.Id.idId,
  ComponentName.Id.idAttributes,
  ComponentName.Id.idContent,
  ComponentName.Id.idIncluded,
  ComponentName.Id.idMustOmitEndTag,
  ComponentName.Id.idElementType,
  ComponentName.Id.noId
];
const subnodeProps_element = [
  ComponentName.Id.idAttributes,
  ComponentName.Id.idContent,
  ComponentName.Id.noId
];
ClassDef.element = new ClassDef(
  ComponentName.Id.idElement,
  allProps_element,
  subnodeProps_element,
  ComponentName.Id.idContent,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_notation = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idName,
  ComponentName.Id.idExternalId,
  ComponentName.Id.idAttributeDefs,
  ComponentName.Id.noId
];
const subnodeProps_notation = [
  ComponentName.Id.idExternalId,
  ComponentName.Id.idAttributeDefs,
  ComponentName.Id.noId
];
ClassDef.notation = new ClassDef(
  ComponentName.Id.idNotation,
  allProps_notation,
  subnodeProps_notation,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_externalData = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idEntityName,
  ComponentName.Id.idEntity,
  ComponentName.Id.noId
];
ClassDef.externalData = new ClassDef(
  ComponentName.Id.idExternalData,
  allProps_externalData,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_attributeAssignment = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idAttributeDef,
  ComponentName.Id.idValue,
  ComponentName.Id.idName,
  ComponentName.Id.idImplied,
  ComponentName.Id.idTokenSep,
  ComponentName.Id.noId
];
const subnodeProps_attributeAssignment = [
  ComponentName.Id.idValue,
  ComponentName.Id.noId
];
ClassDef.attributeAssignment = new ClassDef(
  ComponentName.Id.idAttributeAssignment,
  allProps_attributeAssignment,
  subnodeProps_attributeAssignment,
  ComponentName.Id.idValue,
  ComponentName.Id.noId,
  ComponentName.Id.idTokenSep
);

const allProps_sdata = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idSystemData,
  ComponentName.Id.idChar,
  ComponentName.Id.idEntityName,
  ComponentName.Id.idEntity,
  ComponentName.Id.noId
];
ClassDef.sdata = new ClassDef(
  ComponentName.Id.idSdata,
  allProps_sdata,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.idChar,
  ComponentName.Id.noId
);

const allProps_entity = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idName,
  ComponentName.Id.idEntityType,
  ComponentName.Id.idText,
  ComponentName.Id.idExternalId,
  ComponentName.Id.idAttributes,
  ComponentName.Id.idNotationName,
  ComponentName.Id.idNotation,
  ComponentName.Id.idDefaulted,
  ComponentName.Id.noId
];
const subnodeProps_entity = [
  ComponentName.Id.idExternalId,
  ComponentName.Id.idAttributes,
  ComponentName.Id.noId
];
ClassDef.entity = new ClassDef(
  ComponentName.Id.idEntity,
  allProps_entity,
  subnodeProps_entity,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

ClassDef.sgmlConstants = new ClassDef(
  ComponentName.Id.idSgmlConstants,
  noProps,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

// FIXME
ClassDef.nonSgml = new ClassDef(
  ComponentName.Id.noId,
  noProps,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

// FIXME
ClassDef.message = new ClassDef(
  ComponentName.Id.noId,
  noProps,
  noProps,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_attributeDef = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idCurrentAttributeIndex,
  ComponentName.Id.idCurrentGroup,
  ComponentName.Id.idDeclValueType,
  ComponentName.Id.idDefaultValueType,
  ComponentName.Id.idDefaultValue,
  ComponentName.Id.idName,
  ComponentName.Id.idTokens,
  ComponentName.Id.noId
];
const subnodeProps_attributeDef = [
  ComponentName.Id.idDefaultValue,
  ComponentName.Id.noId
];
ClassDef.attributeDef = new ClassDef(
  ComponentName.Id.idAttributeDef,
  allProps_attributeDef,
  subnodeProps_attributeDef,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_elementType = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idAttributeDefs,
  ComponentName.Id.idContentType,
  ComponentName.Id.idExclusions,
  ComponentName.Id.idGi,
  ComponentName.Id.idInclusions,
  ComponentName.Id.idModelGroup,
  ComponentName.Id.idOmitEndTag,
  ComponentName.Id.idOmitStartTag,
  ComponentName.Id.noId
];
const subnodeProps_elementType = [
  ComponentName.Id.idAttributeDefs,
  ComponentName.Id.idModelGroup,
  ComponentName.Id.noId
];
ClassDef.elementType = new ClassDef(
  ComponentName.Id.idElementType,
  allProps_elementType,
  subnodeProps_elementType,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_modelGroup = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idConnector,
  ComponentName.Id.idOccurenceIndicator,
  ComponentName.Id.idContentTokens,
  ComponentName.Id.noId
];
const subnodeProps_modelGroup = [
  ComponentName.Id.idContentTokens,
  ComponentName.Id.noId
];
ClassDef.modelGroup = new ClassDef(
  ComponentName.Id.idModelGroup,
  allProps_modelGroup,
  subnodeProps_modelGroup,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_elementToken = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idGi,
  ComponentName.Id.idOccurenceIndicator,
  ComponentName.Id.noId
];
const subnodeProps_elementToken = [
  ComponentName.Id.noId
];
ClassDef.elementToken = new ClassDef(
  ComponentName.Id.idElementToken,
  allProps_elementToken,
  subnodeProps_elementToken,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_pcdataToken = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.noId
];
const subnodeProps_pcdataToken = [
  ComponentName.Id.noId
];
ClassDef.pcdataToken = new ClassDef(
  ComponentName.Id.idPcdataToken,
  allProps_pcdataToken,
  subnodeProps_pcdataToken,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);

const allProps_defaultEntity = [
  ...INTRINSIC_PROPS,
  ComponentName.Id.idName,
  ComponentName.Id.idEntityType,
  ComponentName.Id.idText,
  ComponentName.Id.idExternalId,
  ComponentName.Id.idAttributes,
  ComponentName.Id.idNotationName,
  ComponentName.Id.idNotation,
  ComponentName.Id.noId
];
const subnodeProps_defaultEntity = [
  ComponentName.Id.idExternalId,
  ComponentName.Id.idAttributes,
  ComponentName.Id.noId
];
ClassDef.defaultEntity = new ClassDef(
  ComponentName.Id.idDefaultEntity,
  allProps_defaultEntity,
  subnodeProps_defaultEntity,
  ComponentName.Id.noId,
  ComponentName.Id.noId,
  ComponentName.Id.noId
);
