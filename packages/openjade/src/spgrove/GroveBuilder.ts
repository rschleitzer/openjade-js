// Copyright (c) 1996, 1997 James Clark
// See the file COPYING for copying permission.

import {
  Messenger,
  ErrorCountEventHandler,
  MessageFormatter,
  Sd,
  Syntax,
  Dtd,
  Entity,
  EntityDecl,
  ElementTypeFromElementType as ElementType,
  AttributeDefinitionList,
  AttributeValue,
  SubstTable,
  Location,
  Origin,
  StringC,
  StartElementEvent,
  EndElementEvent,
  DataEvent,
  SdataEntityEvent,
  NonSgmlCharEvent,
  ExternalDataEntityEvent,
  SubdocEntityEvent,
  PiEvent,
  EndPrologEvent,
  AppinfoEvent,
  SgmlDeclEvent,
  EntityDefaultedEvent,
  MessageEvent,
  Char,
  Index,
  ConstPtr
} from '@openjade-js/opensp';

import {
  AccessResult,
  ComponentName,
  ClassDef,
  Node,
  NodeList,
  NodePtr,
  NodeListPtr,
  GroveString,
  SdataMapper,
  NodeVisitor,
  Severity,
  EntityType
} from '../grove/Node';

import { LocNode } from '../grove/LocNode';
import { SdNode } from './SdNode';

// Configuration
let blockingAccess = true;

// Utility function
function roundUp(n: number): number {
  const ptrSize = 8; // Assume 64-bit pointers
  return (n + (ptrSize - 1)) & ~(ptrSize - 1);
}

function setString(to: GroveString, from: StringC): void {
  if (from && from.data()) {
    // Convert StringC data to Uint32Array for GroveString
    const srcData = from.data();
    const size = from.size();
    const dest = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      dest[i] = srcData[i];
    }
    to.assign(dest, size);
  }
}

// MessageItem for storing parser messages
class MessageItem {
  private severity_: Severity.Enum;
  private text_: StringC;
  private loc_: Location;
  private next_: MessageItem | null = null;

  constructor(severity: Severity.Enum, text: StringC, loc: Location) {
    this.severity_ = severity;
    this.text_ = text;
    this.loc_ = loc;
  }

  severity(): Severity.Enum { return this.severity_; }
  loc(): Location { return this.loc_; }
  text(): StringC { return this.text_; }
  next(): MessageItem | null { return this.next_; }
  setNext(next: MessageItem | null): void { this.next_ = next; }
}

// Chunk base class
abstract class Chunk {
  origin: ParentChunk | null = null;
  // Track allocation order to emulate C++ pointer arithmetic for after()
  nextInAllocationOrder_: Chunk | null = null;

  abstract setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult;

  // Returns the next chunk in allocation order (emulates C++ this+1 pointer arithmetic)
  after(): Chunk | null {
    return this.nextInAllocationOrder_;
  }

  setNodePtrFirstElement(ptr: NodePtr, node: ElementNode): AccessResult {
    return this.setNodePtrFirst(ptr, node);
  }

  setNodePtrFirstData(ptr: NodePtr, node: DataNode): AccessResult {
    return this.setNodePtrFirst(ptr, node);
  }

  getFollowing(_grove: GroveImpl): { result: AccessResult; chunk: Chunk | null; nNodes: number } {
    return { result: AccessResult.accessNotInClass, chunk: null, nNodes: 0 };
  }

  getFirstSibling(_grove: GroveImpl): { result: AccessResult; chunk: Chunk | null } {
    return { result: AccessResult.accessNotInClass, chunk: null };
  }

  id(): StringC | null {
    return null;
  }

  getLocOrigin(): { result: boolean; origin: Origin | null } {
    return { result: false, origin: null };
  }
}

// LocChunk with location index
class LocChunk extends Chunk {
  locIndex: Index = 0;

  setNodePtrFirst(_ptr: NodePtr, _node: BaseNode): AccessResult {
    return AccessResult.accessNotInClass;
  }
}

// ParentChunk with sibling pointer
class ParentChunk extends LocChunk {
  nextSibling: Chunk | null = null;
}

// ElementChunk
class ElementChunk extends ParentChunk {
  type: ElementType | null = null;
  elementIndex: number = 0;

  attributeValue(_attIndex: number, _grove: GroveImpl): AttributeValue | null {
    return null;
  }

  mustOmitEndTag(): boolean {
    return false;
  }

  included(): boolean {
    return false;
  }

  attDefList(): AttributeDefinitionList | null {
    return this.type?.attributeDefTemp() ?? null;
  }

  override setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult {
    ptr.assign(new ElementNode(node.grove(), this));
    return AccessResult.accessOK;
  }

  static key(chunk: ElementChunk): StringC | null {
    return chunk.id();
  }
}

// SgmlDocumentChunk
class SgmlDocumentChunk extends ParentChunk {
  prolog: Chunk | null = null;
  documentElement: Chunk | null = null;
  epilog: Chunk | null = null;

  override setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult {
    ptr.assign(new SgmlDocumentNode(node.grove(), this));
    return AccessResult.accessOK;
  }
}

// DataChunk - stores character data
class DataChunk extends LocChunk {
  size: number = 0;
  private data_: Uint32Array = new Uint32Array(0);

  setData(data: Uint32Array): void {
    this.data_ = data;
  }

  data(): Uint32Array {
    return this.data_;
  }

  override setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult {
    ptr.assign(new DataNode(node.grove(), this, 0));
    return AccessResult.accessOK;
  }

  override setNodePtrFirstData(ptr: NodePtr, node: DataNode): AccessResult {
    if (node.canReuse(ptr)) {
      (node as DataNode).reuseFor(this, 0);
      return AccessResult.accessOK;
    }
    return this.setNodePtrFirst(ptr, node);
  }

  get nextSibling(): Chunk | null {
    return (this as any)._nextSibling ?? null;
  }

  set nextSibling(chunk: Chunk | null) {
    (this as any)._nextSibling = chunk;
  }

  static allocSize(nChars: number): number {
    return roundUp(16 + nChars * 4); // Approximate size
  }
}

// CharsChunk - stores inline character data (for PI)
class CharsChunk extends LocChunk {
  size: number = 0;
  private data_: Uint32Array = new Uint32Array(0);

  setData(data: Uint32Array): void {
    this.data_ = data;
  }

  data(): Uint32Array {
    return this.data_;
  }

  override setNodePtrFirst(_ptr: NodePtr, _node: BaseNode): AccessResult {
    return AccessResult.accessNotInClass;
  }

  get nextSibling(): Chunk | null {
    return (this as any)._nextSibling ?? null;
  }

  set nextSibling(chunk: Chunk | null) {
    (this as any)._nextSibling = chunk;
  }

  static allocSize(nChars: number): number {
    return roundUp(16 + nChars * 4);
  }
}

// PiChunk - chunk for processing instructions
class PiChunk extends CharsChunk {
  override setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult {
    ptr.assign(new PiNode(node.grove(), this));
    return AccessResult.accessOK;
  }
}

// PrologPiChunk - PI in prolog
class PrologPiChunk extends PiChunk {
  override getFirstSibling(grove: GroveImpl): { result: AccessResult; chunk: Chunk | null } {
    const prolog = grove.root().prolog;
    if (prolog) {
      return { result: AccessResult.accessOK, chunk: prolog };
    }
    return { result: AccessResult.accessNull, chunk: null };
  }
}

// EpilogPiChunk - PI in epilog
class EpilogPiChunk extends PiChunk {
  override getFirstSibling(grove: GroveImpl): { result: AccessResult; chunk: Chunk | null } {
    const epilog = grove.root().epilog;
    if (epilog) {
      return { result: AccessResult.accessOK, chunk: epilog };
    }
    return { result: AccessResult.accessNull, chunk: null };
  }
}

// EntityRefChunk - base chunk for entity references
class EntityRefChunk extends LocChunk {
  entity: Entity | null = null;

  override setNodePtrFirst(_ptr: NodePtr, _node: BaseNode): AccessResult {
    return AccessResult.accessNotInClass;
  }

  get nextSibling(): Chunk | null {
    return (this as any)._nextSibling ?? null;
  }

  set nextSibling(chunk: Chunk | null) {
    (this as any)._nextSibling = chunk;
  }
}

// SdataChunk - chunk for SDATA entities
class SdataChunk extends EntityRefChunk {
  override setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult {
    ptr.assign(new SdataNode(node.grove(), this));
    return AccessResult.accessOK;
  }
}

// NonSgmlChunk - chunk for non-SGML characters
class NonSgmlChunk extends LocChunk {
  c: Char = 0;

  override setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult {
    ptr.assign(new NonSgmlNode(node.grove(), this));
    return AccessResult.accessOK;
  }

  get nextSibling(): Chunk | null {
    return (this as any)._nextSibling ?? null;
  }

  set nextSibling(chunk: Chunk | null) {
    (this as any)._nextSibling = chunk;
  }
}

// ExternalDataChunk - chunk for external data entities
class ExternalDataChunk extends EntityRefChunk {
  override setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult {
    ptr.assign(new ExternalDataNode(node.grove(), this));
    return AccessResult.accessOK;
  }
}

// SubdocChunk - chunk for subdocument entities
class SubdocChunk extends EntityRefChunk {
  override setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult {
    ptr.assign(new SubdocNode(node.grove(), this));
    return AccessResult.accessOK;
  }
}

// PiEntityChunk - chunk for PI entities
class PiEntityChunk extends EntityRefChunk {
  override setNodePtrFirst(ptr: NodePtr, node: BaseNode): AccessResult {
    ptr.assign(new PiEntityNode(node.grove(), this));
    return AccessResult.accessOK;
  }
}

// TailTarget - tracks where to link next sibling (emulates C++ Chunk** tailPtr_)
interface TailTarget {
  obj: any;
  prop: 'nextSibling' | 'prolog' | 'epilog' | 'documentElement';
}

// GroveImpl - the main grove implementation
class GroveImpl {
  private groveIndex_: number;
  private root_: SgmlDocumentChunk;
  private origin_: ParentChunk;
  private pendingData_: DataChunk | null = null;
  private tailTarget_: TailTarget | null = null;

  private dtd_: Dtd | null = null;
  private sd_: Sd | null = null;
  private prologSyntax_: Syntax | null = null;
  private instanceSyntax_: Syntax | null = null;

  private hasDefaultEntity_: boolean = false;
  private haveAppinfo_: boolean = false;
  private appinfo_: StringC | null = null;

  private complete_: boolean = false;
  private completeLimit_: any = null;
  private completeLimitWithLocChunkAfter_: any = null;
  private currentLocOrigin_: Origin | null = null;

  private refCount_: number = 0;
  private nEvents_: number = 0;
  private nElements_: number = 0;
  private nChunksSinceLocOrigin_: number = 0;
  private messageList_: MessageItem | null = null;

  // Storage
  private chunks_: Chunk[] = [];
  private defaultedEntityTable_: Map<string, Entity> = new Map();
  // Track the last allocated chunk to maintain allocation order (for after())
  private lastAllocatedChunk_: Chunk | null = null;

  constructor(groveIndex: number) {
    this.groveIndex_ = groveIndex;
    this.root_ = new SgmlDocumentChunk();
    this.root_.origin = null;
    this.root_.locIndex = 0;
    this.origin_ = this.root_;
    // tailTarget_ starts pointing at root_->prolog (matching C++ tailPtr_ = &root_->prolog)
    this.tailTarget_ = { obj: this.root_, prop: 'prolog' };
    // Root is the first "allocated" chunk for allocation order tracking
    this.lastAllocatedChunk_ = this.root_;
  }

  // Reference counting
  addRef(): void {
    this.refCount_++;
  }

  release(): void {
    if (--this.refCount_ === 0) {
      // GC handles cleanup
    }
  }

  // Accessors
  groveIndex(): number { return this.groveIndex_; }
  root(): SgmlDocumentChunk { return this.root_; }
  governingDtd(): Dtd | null { return this.dtd_; }
  complete(): boolean { return this.complete_; }
  completeLimit(): any { return this.completeLimit_; }
  completeLimitWithLocChunkAfter(): any { return this.completeLimitWithLocChunkAfter_; }
  currentLocOrigin(): Origin | null { return this.currentLocOrigin_; }
  hasDefaultEntity(): boolean { return this.hasDefaultEntity_; }
  messageList(): MessageItem | null { return this.messageList_; }

  generalSubstTable(): SubstTable | null {
    return this.instanceSyntax_?.generalSubstTable() ?? null;
  }

  entitySubstTable(): SubstTable | null {
    return this.instanceSyntax_?.entitySubstTable() ?? null;
  }

  getAppinfo(): { available: boolean; appinfo: StringC | null } {
    if (!this.haveAppinfo_) {
      if (!this.complete_ && this.sd_ === null)
        return { available: false, appinfo: null };
      return { available: true, appinfo: null };
    }
    return { available: true, appinfo: this.appinfo_ };
  }

  // Modifiers
  setAppinfo(appinfo: StringC): void {
    this.appinfo_ = appinfo;
    this.haveAppinfo_ = true;
  }

  setDtd(dtd: Dtd): void {
    this.dtd_ = dtd;
    this.hasDefaultEntity_ = dtd.defaultEntity() !== null;
    this.finishProlog();
    this.pulse();
  }

  setSd(sd: Sd, prologSyntax: Syntax, instanceSyntax: Syntax): void {
    this.sd_ = sd;
    this.prologSyntax_ = prologSyntax;
    this.instanceSyntax_ = instanceSyntax;
  }

  getSd(): { sd: Sd | null; prologSyntax: Syntax | null; instanceSyntax: Syntax | null } {
    return {
      sd: this.sd_,
      prologSyntax: this.prologSyntax_,
      instanceSyntax: this.instanceSyntax_
    };
  }

  setComplete(): void {
    this.completeLimit_ = null;
    this.completeLimitWithLocChunkAfter_ = null;
    // Flush any pending data before completing
    if (this.pendingData_ && this.tailTarget_) {
      this.tailTarget_.obj[this.tailTarget_.prop] = this.pendingData_;
    }
    this.tailTarget_ = null;
    this.pendingData_ = null;
    this.complete_ = true;
  }

  appendMessage(item: MessageItem): void {
    if (this.messageList_ === null) {
      this.messageList_ = item;
    } else {
      let current = this.messageList_;
      while (current.next() !== null) {
        current = current.next()!;
      }
      current.setNext(item);
    }
    this.pulse();
  }

  // Grove building
  pendingData(): DataChunk | null { return this.pendingData_; }

  push(chunk: ElementChunk, _hasId: boolean): void {
    // Flush pending data first
    if (this.pendingData_) {
      if (this.tailTarget_) {
        this.tailTarget_.obj[this.tailTarget_.prop] = this.pendingData_;
        this.tailTarget_ = null;
      }
      this.pendingData_ = null;
    }
    chunk.elementIndex = this.nElements_++;
    chunk.origin = this.origin_;
    // Must set origin_ to chunk before advancing completeLimit_
    this.origin_ = chunk;

    // Set as document element if appropriate, or link via tailTarget_
    if (chunk.origin === this.root_ && this.root_.documentElement === null) {
      this.root_.documentElement = chunk;
    } else if (this.tailTarget_) {
      this.tailTarget_.obj[this.tailTarget_.prop] = chunk;
      this.tailTarget_ = null;
    }

    this.maybePulse();
  }

  pop(): void {
    // Flush pending data first
    if (this.pendingData_) {
      if (this.tailTarget_) {
        this.tailTarget_.obj[this.tailTarget_.prop] = this.pendingData_;
        this.tailTarget_ = null;
      }
      this.pendingData_ = null;
    }
    // tailTarget_ now points to origin_->nextSibling (matching C++ tailPtr_ = &origin_->nextSibling)
    this.tailTarget_ = { obj: this.origin_, prop: 'nextSibling' };
    this.origin_ = this.origin_.origin!;
    if (this.origin_ === this.root_) {
      this.finishDocumentElement();
    }
    this.maybePulse();
  }

  appendSibling(chunk: Chunk): void {
    // Flush pending data first
    if (this.pendingData_) {
      if (this.tailTarget_) {
        this.tailTarget_.obj[this.tailTarget_.prop] = this.pendingData_;
        this.tailTarget_ = null;
      }
      this.pendingData_ = null;
    }
    chunk.origin = this.origin_;
    if (this.tailTarget_) {
      this.tailTarget_.obj[this.tailTarget_.prop] = chunk;
      this.tailTarget_ = null;
    }
    this.pendingData_ = null;
    this.maybePulse();
  }

  appendDataSibling(chunk: DataChunk): void {
    // Flush previous pending data first
    if (this.pendingData_) {
      if (this.tailTarget_) {
        this.tailTarget_.obj[this.tailTarget_.prop] = this.pendingData_;
        this.tailTarget_ = null;
      }
    }
    chunk.origin = this.origin_;
    this.pendingData_ = chunk;
    this.maybePulse();
  }

  setLocOrigin(locOrigin: Origin): void {
    if (locOrigin !== this.currentLocOrigin_ ||
        this.nChunksSinceLocOrigin_ >= 100) {
      this.storeLocOrigin(locOrigin);
    }
  }

  haveRootOrigin(): boolean {
    return this.origin_ === this.root_;
  }

  maybeMoreSiblings(chunk: ParentChunk): boolean {
    if (this.complete_) {
      return chunk.nextSibling !== null;
    }
    return this.origin_ === chunk || this.maybeMoreSiblings1(chunk);
  }

  waitForMoreNodes(): boolean {
    // In JS we don't have blocking - return false
    return false;
  }

  allocChunk<T extends Chunk>(ChunkClass: new () => T): T {
    this.nChunksSinceLocOrigin_++;
    const chunk = new ChunkClass();
    this.chunks_.push(chunk);
    // Link in allocation order (emulates C++ pointer arithmetic for after())
    if (this.lastAllocatedChunk_) {
      this.lastAllocatedChunk_.nextInAllocationOrder_ = chunk;
    }
    this.lastAllocatedChunk_ = chunk;
    return chunk;
  }

  addDefaultedEntity(entityPtr: ConstPtr<Entity>): void {
    const entity = entityPtr.pointer();
    if (entity) {
      const nameStr = entity.name();
      const name = nameStr.toString();
      this.defaultedEntityTable_.set(name, entity);
    }
    this.pulse();
  }

  lookupDefaultedEntity(name: StringC): Entity | null {
    const nameKey = name.toString();
    return this.defaultedEntityTable_.get(nameKey) ?? null;
  }

  private finishProlog(): void {
    this.tailTarget_ = null;
  }

  private finishDocumentElement(): void {
    // Be robust in the case of erroneous documents.
    if (this.root_.epilog === null) {
      // tailTarget_ now points to root_->epilog (matching C++ tailPtr_ = &root_->epilog)
      this.tailTarget_ = { obj: this.root_, prop: 'epilog' };
    }
  }

  private pulse(): void {
    // In JS, this is a no-op (no threading)
  }

  private maybePulse(): void {
    this.nEvents_++;
    // In JS, this is a no-op (no threading)
  }

  private storeLocOrigin(locOrigin: Origin): void {
    this.currentLocOrigin_ = locOrigin;
    this.nChunksSinceLocOrigin_ = 0;
  }

  private maybeMoreSiblings1(chunk: ParentChunk): boolean {
    for (let open: ParentChunk | null = this.origin_; open; open = open.origin) {
      if (open === chunk) return true;
    }
    return chunk.nextSibling !== null;
  }
}

// BaseNode - abstract base class for all nodes
abstract class BaseNode extends Node implements LocNode {
  private grove_: GroveImpl;

  constructor(grove: GroveImpl) {
    super();
    this.grove_ = grove;
  }

  grove(): GroveImpl { return this.grove_; }

  canReuse(ptr: NodePtr): boolean {
    return ptr.node() === this && this.refCount_ === 1;
  }

  override groveIndex(): number {
    return this.grove_.groveIndex();
  }

  override equals(node: Node): boolean {
    if (!(node instanceof BaseNode)) return false;
    return this.same(node);
  }

  abstract same(node: BaseNode): boolean;

  // LocNode interface
  getLocation(): { result: AccessResult; location: Location } {
    return { result: AccessResult.accessNull, location: new Location() };
  }

  override queryInterface(iid: string): { result: boolean; ptr: any } {
    if (iid === LocNode.iid) {
      return { result: true, ptr: this };
    }
    return { result: false, ptr: null };
  }

  override nextSibling(_ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(_ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override children(_ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override getOrigin(_ptr: NodePtr): AccessResult {
    return AccessResult.accessNull;
  }

  override getGroveRoot(ptr: NodePtr): AccessResult {
    ptr.assign(new SgmlDocumentNode(this.grove_, this.grove_.root()));
    return AccessResult.accessOK;
  }

  inChunk(_node: DataNode): boolean {
    return false;
  }

  inChunkCdata(_node: CdataAttributeValueNode): boolean {
    return false;
  }
}

// ChunkNode - base class for chunk-based nodes
abstract class ChunkNode extends BaseNode {
  protected chunk_: LocChunk;

  constructor(grove: GroveImpl, chunk: LocChunk) {
    super(grove);
    this.chunk_ = chunk;
  }

  chunk(): LocChunk { return this.chunk_; }

  override same(node: BaseNode): boolean {
    if (!(node instanceof ChunkNode)) return false;
    return this.chunk_ === node.chunk_;
  }

  override hash(): number {
    // Simple hash based on chunk identity
    return 0;
  }

  override getParent(ptr: NodePtr): AccessResult {
    if (this.chunk_.origin) {
      return this.chunk_.origin.setNodePtrFirst(ptr, this);
    }
    return AccessResult.accessNull;
  }

  override getOrigin(ptr: NodePtr): AccessResult {
    return this.getParent(ptr);
  }

  override getLocation(): { result: AccessResult; location: Location } {
    // TODO: Implement proper location tracking
    return { result: AccessResult.accessNull, location: new Location() };
  }

  override nextChunkSibling(ptr: NodePtr): AccessResult {
    // Traverse allocation order to find next sibling (chunk with same origin/parent)
    let p: Chunk | null = this.chunk_.after();
    const myOrigin = this.chunk_.origin;
    while (p) {
      if (p.origin === myOrigin) {
        // Found a sibling
        return p.setNodePtrFirst(ptr, this);
      }
      // If this chunk's origin is an ancestor of our origin, we've gone past our siblings
      // (This happens when we traverse past the end of our parent's content)
      if (this.isAncestorOf(p.origin, myOrigin)) {
        break;
      }
      p = p.after();
    }
    return AccessResult.accessNull;
  }

  // Check if 'ancestor' is an ancestor of 'descendant'
  private isAncestorOf(ancestor: ParentChunk | null, descendant: ParentChunk | null): boolean {
    let current = descendant;
    while (current) {
      if (current === ancestor) return true;
      current = current.origin;
    }
    return false;
  }

  override firstSibling(ptr: NodePtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override siblingsIndex(): { result: AccessResult; index: number } {
    return { result: AccessResult.accessNotInClass, index: 0 };
  }
}

// SgmlDocumentNode
class SgmlDocumentNode extends ChunkNode implements SdNode {
  constructor(grove: GroveImpl, chunk: SgmlDocumentChunk) {
    super(grove, chunk);
  }

  private docChunk(): SgmlDocumentChunk {
    return this.chunk_ as SgmlDocumentChunk;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.sgmlDocument(this);
  }

  override classDef(): ClassDef {
    return ClassDef.sgmlDocument;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessNull, id: ComponentName.Id.noId };
  }

  override getDocumentElement(ptr: NodePtr): AccessResult {
    const chunk = this.docChunk();
    if (chunk.documentElement) {
      return chunk.documentElement.setNodePtrFirst(ptr, this);
    }
    return AccessResult.accessNull;
  }

  override getProlog(_ptr: NodeListPtr): AccessResult {
    // TODO: Implement prolog
    return AccessResult.accessNull;
  }

  override getEpilog(_ptr: NodeListPtr): AccessResult {
    // TODO: Implement epilog
    return AccessResult.accessNull;
  }

  override getSgmlConstants(ptr: NodePtr): AccessResult {
    ptr.assign(new SgmlConstantsNode(this.grove()));
    return AccessResult.accessOK;
  }

  override getApplicationInfo(): { result: AccessResult; str: GroveString } {
    const appinfo = this.grove().getAppinfo();
    if (!appinfo.available) {
      return { result: AccessResult.accessTimeout, str: new GroveString() };
    }
    if (appinfo.appinfo === null) {
      return { result: AccessResult.accessNull, str: new GroveString() };
    }
    const str = new GroveString();
    setString(str, appinfo.appinfo);
    return { result: AccessResult.accessOK, str };
  }

  override getGoverningDoctype(ptr: NodePtr): AccessResult {
    const dtd = this.grove().governingDtd();
    if (dtd) {
      ptr.assign(new DocumentTypeNode(this.grove(), dtd));
      return AccessResult.accessOK;
    }
    return AccessResult.accessNull;
  }

  override children(ptr: NodeListPtr): AccessResult {
    // Return document element as the only child
    const docElement = this.docChunk().documentElement;
    if (docElement) {
      const nodePtr = new NodePtr();
      docElement.setNodePtrFirst(nodePtr, this);
      ptr.assign(new SiblingNodeList(nodePtr));
      return AccessResult.accessOK;
    }
    return AccessResult.accessNull;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNull;
  }

  // SdNode interface
  getSd(): {
    result: AccessResult;
    sd: Sd | null;
    prologSyntax: Syntax | null;
    instanceSyntax: Syntax | null;
  } {
    const sdInfo = this.grove().getSd();
    if (sdInfo.sd === null) {
      return {
        result: AccessResult.accessNull,
        sd: null,
        prologSyntax: null,
        instanceSyntax: null
      };
    }
    return {
      result: AccessResult.accessOK,
      ...sdInfo
    };
  }

  override queryInterface(iid: string): { result: boolean; ptr: any } {
    if (iid === SdNode.iid) {
      return { result: true, ptr: this };
    }
    return super.queryInterface(iid);
  }
}

// ElementNode
class ElementNode extends ChunkNode {
  constructor(grove: GroveImpl, chunk: ElementChunk) {
    super(grove, chunk);
  }

  private elemChunk(): ElementChunk {
    return this.chunk_ as ElementChunk;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.element(this);
  }

  override classDef(): ClassDef {
    return ClassDef.element;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idContent };
  }

  override getGi(): { result: AccessResult; str: GroveString } {
    const chunk = this.elemChunk();
    if (chunk.type) {
      const str = new GroveString();
      setString(str, chunk.type.name());
      return { result: AccessResult.accessOK, str };
    }
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  override hasGi(gi: GroveString): boolean {
    const result = this.getGi();
    if (result.result !== AccessResult.accessOK) return false;
    return result.str.equals(gi);
  }

  override getId(): { result: AccessResult; str: GroveString } {
    const chunk = this.elemChunk();
    const id = chunk.id();
    if (id) {
      const str = new GroveString();
      setString(str, id);
      return { result: AccessResult.accessOK, str };
    }
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  override getMustOmitEndTag(): { result: AccessResult; mustOmit: boolean } {
    return { result: AccessResult.accessOK, mustOmit: this.elemChunk().mustOmitEndTag() };
  }

  override getIncluded(): { result: AccessResult; included: boolean } {
    return { result: AccessResult.accessOK, included: this.elemChunk().included() };
  }

  override elementIndex(): { result: AccessResult; index: number } {
    return { result: AccessResult.accessOK, index: this.elemChunk().elementIndex };
  }

  override firstChild(ptr: NodePtr): AccessResult {
    const chunk = this.elemChunk();
    // Use after() to get the next chunk in allocation order (emulates C++ pointer arithmetic)
    const p = chunk.after();
    if (p && p.origin === chunk) {
      return p.setNodePtrFirst(ptr, this);
    }
    return AccessResult.accessNull;
  }

  override children(ptr: NodeListPtr): AccessResult {
    const firstChildPtr = new NodePtr();
    const result = this.firstChild(firstChildPtr);
    if (result === AccessResult.accessOK) {
      ptr.assign(new SiblingNodeList(firstChildPtr));
      return AccessResult.accessOK;
    }
    ptr.assign(new BaseNodeList());
    return AccessResult.accessOK;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    const nextPtr = new NodePtr();
    const result = this.nextChunkSibling(nextPtr);
    if (result === AccessResult.accessOK) {
      ptr.assign(new SiblingNodeList(nextPtr));
      return AccessResult.accessOK;
    }
    ptr.assign(new BaseNodeList());
    return AccessResult.accessOK;
  }

  reuseFor(chunk: ElementChunk): void {
    this.chunk_ = chunk;
  }

  static add(grove: GroveImpl, event: StartElementEvent): void {
    const origin = event.location().origin();
    if (origin && origin.pointer()) {
      grove.setLocOrigin(origin.pointer()!);
    }
    const chunk = grove.allocChunk(ElementChunk);
    chunk.type = event.elementType();
    chunk.locIndex = event.location().index();
    const hasId = false; // TODO: Check for ID attribute
    grove.push(chunk, hasId);
  }
}

// DataNode
class DataNode extends ChunkNode {
  private index_: number;

  constructor(grove: GroveImpl, chunk: DataChunk, index: number) {
    super(grove, chunk);
    this.index_ = index;
  }

  private dataChunk(): DataChunk {
    return this.chunk_ as DataChunk;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.dataChar(this);
  }

  override classDef(): ClassDef {
    return ClassDef.dataChar;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idContent };
  }

  override same(node: BaseNode): boolean {
    if (!(node instanceof DataNode)) return false;
    return this.chunk_ === node.chunk_ && this.index_ === node.index_;
  }

  override charChunk(mapper: SdataMapper): { result: AccessResult; str: GroveString } {
    const chunk = this.dataChunk();
    const str = new GroveString(chunk.data(), chunk.size - this.index_, this.index_);
    return { result: AccessResult.accessOK, str };
  }

  override nextSibling(ptr: NodePtr): AccessResult {
    const chunk = this.dataChunk();
    if (this.index_ + 1 < chunk.size) {
      ptr.assign(new DataNode(this.grove(), chunk, this.index_ + 1));
      return AccessResult.accessOK;
    }
    return this.nextChunkSibling(ptr);
  }

  override nextChunkSibling(ptr: NodePtr): AccessResult {
    const p = this.chunk_.after();
    if (!p) return AccessResult.accessNull;
    if (p.origin !== this.chunk_.origin) return AccessResult.accessNull;
    return p.setNodePtrFirstData(ptr, this);
  }

  override children(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    const nextPtr = new NodePtr();
    const result = this.nextChunkSibling(nextPtr);
    if (result === AccessResult.accessOK) {
      ptr.assign(new SiblingNodeList(nextPtr));
      return AccessResult.accessOK;
    }
    ptr.assign(new BaseNodeList());
    return AccessResult.accessOK;
  }

  reuseFor(chunk: DataChunk, index: number): void {
    this.chunk_ = chunk;
    this.index_ = index;
  }

  static add(grove: GroveImpl, event: DataEvent): void {
    const dataLen = event.dataLength();
    if (dataLen > 0) {
      const origin = event.location().origin();
      if (origin && origin.pointer()) {
        grove.setLocOrigin(origin.pointer()!);
      }
      const chunk = grove.allocChunk(DataChunk);
      chunk.size = dataLen;
      chunk.locIndex = event.location().index();
      // Copy data
      const eventData = event.data();
      const data = new Uint32Array(dataLen);
      for (let i = 0; i < dataLen; i++) {
        data[i] = eventData[i];
      }
      chunk.setData(data);
      grove.appendDataSibling(chunk);
    }
  }
}

// SgmlConstantsNode
class SgmlConstantsNode extends BaseNode {
  constructor(grove: GroveImpl) {
    super(grove);
  }

  override accept(visitor: NodeVisitor): void {
    visitor.sgmlConstants(this);
  }

  override classDef(): ClassDef {
    return ClassDef.sgmlConstants;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idSgmlConstants };
  }

  override same(node: BaseNode): boolean {
    return node instanceof SgmlConstantsNode && this.grove() === node.grove();
  }

  override getOrigin(ptr: NodePtr): AccessResult {
    ptr.assign(new SgmlDocumentNode(this.grove(), this.grove().root()));
    return AccessResult.accessOK;
  }

  override children(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }
}

// DocumentTypeNode
class DocumentTypeNode extends BaseNode {
  private dtd_: Dtd;

  constructor(grove: GroveImpl, dtd: Dtd) {
    super(grove);
    this.dtd_ = dtd;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.documentType(this);
  }

  override classDef(): ClassDef {
    return ClassDef.documentType;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idDoctypesAndLinktypes };
  }

  override same(node: BaseNode): boolean {
    return node instanceof DocumentTypeNode && this.dtd_ === node.dtd_;
  }

  override getName(): { result: AccessResult; str: GroveString } {
    const str = new GroveString();
    setString(str, this.dtd_.name());
    return { result: AccessResult.accessOK, str };
  }

  override getGoverning(): { result: AccessResult; governing: boolean } {
    return { result: AccessResult.accessOK, governing: true };
  }

  override getOrigin(ptr: NodePtr): AccessResult {
    ptr.assign(new SgmlDocumentNode(this.grove(), this.grove().root()));
    return AccessResult.accessOK;
  }

  override children(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }
}

// CdataAttributeValueNode placeholder
class CdataAttributeValueNode extends BaseNode {
  constructor(grove: GroveImpl) {
    super(grove);
  }

  override same(node: BaseNode): boolean {
    return false;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.dataChar(this);
  }

  override classDef(): ClassDef {
    return ClassDef.dataChar;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idValue };
  }

  override children(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }
}

// EntityRefNode - base class for entity reference nodes
class EntityRefNode extends ChunkNode {
  constructor(grove: GroveImpl, chunk: EntityRefChunk) {
    super(grove, chunk);
  }

  protected entityRefChunk(): EntityRefChunk {
    return this.chunk_ as EntityRefChunk;
  }

  override accept(visitor: NodeVisitor): void {
    // Subclasses override this
  }

  override classDef(): ClassDef {
    return ClassDef.entity;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idContent };
  }

  override getEntity(ptr: NodePtr): AccessResult {
    const entity = this.entityRefChunk().entity;
    if (entity) {
      ptr.assign(new EntityNode(this.grove(), entity));
      return AccessResult.accessOK;
    }
    return AccessResult.accessNull;
  }

  override getEntityName(): { result: AccessResult; str: GroveString } {
    const entity = this.entityRefChunk().entity;
    if (entity) {
      const str = new GroveString();
      setString(str, entity.name());
      return { result: AccessResult.accessOK, str };
    }
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  override children(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    const nextPtr = new NodePtr();
    const result = this.nextChunkSibling(nextPtr);
    if (result === AccessResult.accessOK) {
      ptr.assign(new SiblingNodeList(nextPtr));
      return AccessResult.accessOK;
    }
    ptr.assign(new BaseNodeList());
    return AccessResult.accessOK;
  }
}

// EntityNodeBase - base class for entity nodes
class EntityNodeBase extends BaseNode {
  protected entity_: Entity;

  constructor(grove: GroveImpl, entity: Entity) {
    super(grove);
    this.entity_ = entity;
  }

  override same(node: BaseNode): boolean {
    if (!(node instanceof EntityNodeBase)) return false;
    return this.entity_ === node.entity_;
  }

  override getName(): { result: AccessResult; str: GroveString } {
    const str = new GroveString();
    setString(str, this.entity_.name());
    return { result: AccessResult.accessOK, str };
  }

  override getExternalId(ptr: NodePtr): AccessResult {
    const external = this.entity_.asExternalEntity();
    if (external) {
      ptr.assign(new ExternalIdNode(this.grove(), external.externalId()));
      return AccessResult.accessOK;
    }
    return AccessResult.accessNull;
  }

  override getText(): { result: AccessResult; str: GroveString } {
    const internal = this.entity_.asInternalEntity();
    if (internal) {
      const str = new GroveString();
      setString(str, internal.string());
      return { result: AccessResult.accessOK, str };
    }
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  override getEntityType(): { result: AccessResult; entityType: EntityType.Enum } {
    // Use EntityDecl.DataType to determine entity type
    const dataType = this.entity_.dataType();
    switch (dataType) {
      case EntityDecl.DataType.sdata:
        return { result: AccessResult.accessOK, entityType: EntityType.Enum.sdata };
      case EntityDecl.DataType.cdata:
        return { result: AccessResult.accessOK, entityType: EntityType.Enum.cdata };
      case EntityDecl.DataType.pi:
        return { result: AccessResult.accessOK, entityType: EntityType.Enum.pi };
      case EntityDecl.DataType.ndata:
        return { result: AccessResult.accessOK, entityType: EntityType.Enum.ndata };
      case EntityDecl.DataType.subdoc:
        return { result: AccessResult.accessOK, entityType: EntityType.Enum.subdocument };
      case EntityDecl.DataType.sgmlText:
      default:
        return { result: AccessResult.accessOK, entityType: EntityType.Enum.text };
    }
  }

  override accept(visitor: NodeVisitor): void {
    visitor.entity(this);
  }

  override classDef(): ClassDef {
    return ClassDef.entity;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idGeneralEntities };
  }

  override children(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }
}

// EntityNode - for entity nodes
class EntityNode extends EntityNodeBase {
  constructor(grove: GroveImpl, entity: Entity) {
    super(grove, entity);
  }

  override getOrigin(ptr: NodePtr): AccessResult {
    const dtd = this.grove().governingDtd();
    if (dtd) {
      ptr.assign(new DocumentTypeNode(this.grove(), dtd));
      return AccessResult.accessOK;
    }
    return AccessResult.accessNull;
  }

  override getDefaulted(): { result: AccessResult; defaulted: boolean } {
    return { result: AccessResult.accessOK, defaulted: this.entity_.defaulted() };
  }

  override accept(visitor: NodeVisitor): void {
    visitor.entity(this);
  }

  override classDef(): ClassDef {
    return ClassDef.entity;
  }
}

// ExternalIdNode - for external ID nodes
class ExternalIdNode extends BaseNode {
  private externalId_: any; // ExternalId type

  constructor(grove: GroveImpl, externalId: any) {
    super(grove);
    this.externalId_ = externalId;
  }

  override same(node: BaseNode): boolean {
    if (!(node instanceof ExternalIdNode)) return false;
    return this.externalId_ === node.externalId_;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.externalId(this);
  }

  override classDef(): ClassDef {
    return ClassDef.externalId;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idExternalId };
  }

  override getPublicId(): { result: AccessResult; str: GroveString } {
    if (this.externalId_ && this.externalId_.publicIdString()) {
      const str = new GroveString();
      setString(str, this.externalId_.publicIdString());
      return { result: AccessResult.accessOK, str };
    }
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  override getSystemId(): { result: AccessResult; str: GroveString } {
    if (this.externalId_ && this.externalId_.systemIdString()) {
      const str = new GroveString();
      setString(str, this.externalId_.systemIdString());
      return { result: AccessResult.accessOK, str };
    }
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  override children(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }
}

// PiNode - for processing instructions
class PiNode extends ChunkNode {
  constructor(grove: GroveImpl, chunk: PiChunk) {
    super(grove, chunk);
  }

  private piChunk(): PiChunk {
    return this.chunk_ as PiChunk;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.pi(this);
  }

  override classDef(): ClassDef {
    return ClassDef.pi;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idContent };
  }

  override getSystemData(): { result: AccessResult; str: GroveString } {
    const chunk = this.piChunk();
    const str = new GroveString(chunk.data(), chunk.size);
    return { result: AccessResult.accessOK, str };
  }

  override getEntityName(): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  override getEntity(ptr: NodePtr): AccessResult {
    return AccessResult.accessNull;
  }

  override children(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    const nextPtr = new NodePtr();
    const result = this.nextChunkSibling(nextPtr);
    if (result === AccessResult.accessOK) {
      ptr.assign(new SiblingNodeList(nextPtr));
      return AccessResult.accessOK;
    }
    ptr.assign(new BaseNodeList());
    return AccessResult.accessOK;
  }

  static add(grove: GroveImpl, event: PiEvent): void {
    const entity = event.entity();
    if (entity) {
      PiEntityNode.add(grove, entity, event.location());
    } else {
      const origin = event.location().origin();
      if (origin && origin.pointer()) {
        grove.setLocOrigin(origin.pointer()!);
      }
      const dataLen = event.dataLength();
      let chunk: PiChunk;
      if (grove.haveRootOrigin()) {
        if (grove.root().documentElement) {
          chunk = grove.allocChunk(EpilogPiChunk);
        } else {
          chunk = grove.allocChunk(PrologPiChunk);
        }
      } else {
        chunk = grove.allocChunk(PiChunk);
      }
      chunk.size = dataLen;
      chunk.locIndex = event.location().index();
      // Copy data
      const eventData = event.data();
      const data = new Uint32Array(dataLen);
      for (let i = 0; i < dataLen; i++) {
        data[i] = eventData[i];
      }
      chunk.setData(data);
      grove.appendSibling(chunk);
    }
  }
}

// PiEntityNode - for PI entities
class PiEntityNode extends EntityRefNode {
  constructor(grove: GroveImpl, chunk: PiEntityChunk) {
    super(grove, chunk);
  }

  private piEntityChunk(): PiEntityChunk {
    return this.chunk_ as PiEntityChunk;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.pi(this);
  }

  override classDef(): ClassDef {
    return ClassDef.pi;
  }

  override getSystemData(): { result: AccessResult; str: GroveString } {
    const entity = this.piEntityChunk().entity;
    if (entity) {
      const internal = entity.asInternalEntity();
      if (internal) {
        const str = new GroveString();
        setString(str, internal.string());
        return { result: AccessResult.accessOK, str };
      }
    }
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  static add(grove: GroveImpl, entity: Entity, loc: Location): void {
    const origin = loc.origin();
    if (origin && origin.pointer()) {
      grove.setLocOrigin(origin.pointer()!);
    }
    const chunk = grove.allocChunk(PiEntityChunk);
    chunk.entity = entity;
    chunk.locIndex = loc.index();
    grove.appendSibling(chunk);
  }
}

// SdataNode - for SDATA entities
class SdataNode extends EntityRefNode {
  private c_: Char = 0;

  constructor(grove: GroveImpl, chunk: SdataChunk) {
    super(grove, chunk);
  }

  private sdataChunk(): SdataChunk {
    return this.chunk_ as SdataChunk;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.sdata(this);
  }

  override classDef(): ClassDef {
    return ClassDef.sdata;
  }

  override charChunk(mapper: SdataMapper): { result: AccessResult; str: GroveString } {
    const entity = this.sdataChunk().entity;
    if (entity) {
      const name = entity.name();
      const internal = entity.asInternalEntity();
      if (internal) {
        const text = internal.string();
        const nameGs = new GroveString();
        setString(nameGs, name);
        const textGs = new GroveString();
        setString(textGs, text);
        const mapResult = mapper.sdataMap(nameGs, textGs);
        if (mapResult.result) {
          this.c_ = mapResult.ch;
          const data = new Uint32Array(1);
          data[0] = this.c_;
          const str = new GroveString(data, 1);
          return { result: AccessResult.accessOK, str };
        }
      }
    }
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  override getSystemData(): { result: AccessResult; str: GroveString } {
    const entity = this.sdataChunk().entity;
    if (entity) {
      const internal = entity.asInternalEntity();
      if (internal) {
        const str = new GroveString();
        setString(str, internal.string());
        return { result: AccessResult.accessOK, str };
      }
    }
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  static add(grove: GroveImpl, event: SdataEntityEvent): void {
    const loc = event.location();
    const parentOrigin = loc.origin();
    if (parentOrigin && parentOrigin.pointer()) {
      const parent = parentOrigin.pointer()!.parent();
      if (parent.origin() && parent.origin()!.pointer()) {
        grove.setLocOrigin(parent.origin()!.pointer()!);
      }
    }
    const chunk = grove.allocChunk(SdataChunk);
    chunk.entity = event.entity();
    chunk.locIndex = loc.index();
    grove.appendSibling(chunk);
  }
}

// NonSgmlNode - for non-SGML characters
class NonSgmlNode extends ChunkNode {
  constructor(grove: GroveImpl, chunk: NonSgmlChunk) {
    super(grove, chunk);
  }

  private nonSgmlChunk(): NonSgmlChunk {
    return this.chunk_ as NonSgmlChunk;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.nonSgml(this);
  }

  override classDef(): ClassDef {
    return ClassDef.nonSgml;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idContent };
  }

  override charChunk(mapper: SdataMapper): { result: AccessResult; str: GroveString } {
    return { result: AccessResult.accessNull, str: new GroveString() };
  }

  override getNonSgml(): { result: AccessResult; value: number } {
    return { result: AccessResult.accessOK, value: this.nonSgmlChunk().c };
  }

  override children(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNotInClass;
  }

  override follow(ptr: NodeListPtr): AccessResult {
    const nextPtr = new NodePtr();
    const result = this.nextChunkSibling(nextPtr);
    if (result === AccessResult.accessOK) {
      ptr.assign(new SiblingNodeList(nextPtr));
      return AccessResult.accessOK;
    }
    ptr.assign(new BaseNodeList());
    return AccessResult.accessOK;
  }

  static add(grove: GroveImpl, event: NonSgmlCharEvent): void {
    const origin = event.location().origin();
    if (origin && origin.pointer()) {
      grove.setLocOrigin(origin.pointer()!);
    }
    const chunk = grove.allocChunk(NonSgmlChunk);
    chunk.c = event.character();
    chunk.locIndex = event.location().index();
    grove.appendSibling(chunk);
  }
}

// ExternalDataNode - for external data entities
class ExternalDataNode extends EntityRefNode {
  constructor(grove: GroveImpl, chunk: ExternalDataChunk) {
    super(grove, chunk);
  }

  private externalDataChunk(): ExternalDataChunk {
    return this.chunk_ as ExternalDataChunk;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.externalData(this);
  }

  override classDef(): ClassDef {
    return ClassDef.externalData;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idContent };
  }

  static add(grove: GroveImpl, event: ExternalDataEntityEvent): void {
    const origin = event.location().origin();
    if (origin && origin.pointer()) {
      grove.setLocOrigin(origin.pointer()!);
    }
    const chunk = grove.allocChunk(ExternalDataChunk);
    chunk.entity = event.entity();
    chunk.locIndex = event.location().index();
    grove.appendSibling(chunk);
  }
}

// SubdocNode - for subdocument entities
class SubdocNode extends EntityRefNode {
  constructor(grove: GroveImpl, chunk: SubdocChunk) {
    super(grove, chunk);
  }

  private subdocChunk(): SubdocChunk {
    return this.chunk_ as SubdocChunk;
  }

  override accept(visitor: NodeVisitor): void {
    visitor.subdocument(this);
  }

  override classDef(): ClassDef {
    return ClassDef.subdocument;
  }

  override getOriginToSubnodeRelPropertyName(): { result: AccessResult; id: ComponentName.Id } {
    return { result: AccessResult.accessOK, id: ComponentName.Id.idContent };
  }

  static add(grove: GroveImpl, event: SubdocEntityEvent): void {
    const origin = event.location().origin();
    if (origin && origin.pointer()) {
      grove.setLocOrigin(origin.pointer()!);
    }
    const chunk = grove.allocChunk(SubdocChunk);
    chunk.entity = event.entity();
    chunk.locIndex = event.location().index();
    grove.appendSibling(chunk);
  }
}

// BaseNodeList
class BaseNodeList extends NodeList {
  canReuse(ptr: NodeListPtr): boolean {
    return ptr.list() === this && this.refCount_ === 1;
  }

  override first(ptr: NodePtr): AccessResult {
    return AccessResult.accessNull;
  }

  override rest(ptr: NodeListPtr): AccessResult {
    return this.chunkRest(ptr);
  }

  override chunkRest(ptr: NodeListPtr): AccessResult {
    return AccessResult.accessNull;
  }
}

// SiblingNodeList
class SiblingNodeList extends BaseNodeList {
  private first_: NodePtr;

  constructor(first: NodePtr) {
    super();
    this.first_ = first;
  }

  override first(ptr: NodePtr): AccessResult {
    ptr.assign(this.first_.node());
    return AccessResult.accessOK;
  }

  override rest(ptr: NodeListPtr): AccessResult {
    if (this.canReuse(ptr)) {
      const ret = this.first_.assignNextSibling();
      if (ret === AccessResult.accessOK) return ret;
    } else {
      const next = new NodePtr();
      const ret = this.first_.node()!.nextSibling(next);
      if (ret === AccessResult.accessOK) {
        ptr.assign(new SiblingNodeList(next));
        return ret;
      }
    }
    ptr.assign(new BaseNodeList());
    return AccessResult.accessOK;
  }

  override chunkRest(ptr: NodeListPtr): AccessResult {
    if (this.canReuse(ptr)) {
      const ret = this.first_.assignNextChunkSibling();
      if (ret === AccessResult.accessOK) return ret;
    } else {
      const next = new NodePtr();
      const ret = this.first_.node()!.nextChunkSibling(next);
      if (ret === AccessResult.accessOK) {
        ptr.assign(new SiblingNodeList(next));
        return ret;
      }
    }
    ptr.assign(new BaseNodeList());
    return AccessResult.accessOK;
  }

  override ref(n: number, ptr: NodePtr): AccessResult {
    if (n === 0) {
      ptr.assign(this.first_.node());
      return AccessResult.accessOK;
    }
    return this.first_.node()!.followSiblingRef(n - 1, ptr);
  }
}

// Event handlers
class GroveBuilderMessageEventHandler extends ErrorCountEventHandler {
  protected grove_: GroveImpl;
  private mgr_: Messenger;
  private msgFmt_: MessageFormatter;

  constructor(groveIndex: number, mgr: Messenger, msgFmt: MessageFormatter) {
    super();
    this.mgr_ = mgr;
    this.msgFmt_ = msgFmt;
    this.grove_ = new GroveImpl(groveIndex);
    this.grove_.addRef();
  }

  destroy(): void {
    this.grove_.setComplete();
    this.grove_.release();
  }

  makeInitialRoot(root: NodePtr): void {
    root.assign(new SgmlDocumentNode(this.grove_, this.grove_.root()));
  }

  setSd(sd: Sd, prologSyntax: Syntax, instanceSyntax: Syntax): void {
    this.grove_.setSd(sd, prologSyntax, instanceSyntax);
  }

  override message(event: MessageEvent): void {
    this.mgr_.dispatchMessage(event.message());
    // TODO: Format and store message
    super.message(event);
  }

  override sgmlDecl(event: SgmlDeclEvent): void {
    const sd = event.sdPointer();
    const prologSyntax = event.prologSyntaxPointer();
    const instanceSyntax = event.instanceSyntaxPointer();
    if (sd && sd.pointer() && prologSyntax && prologSyntax.pointer() && instanceSyntax && instanceSyntax.pointer()) {
      this.grove_.setSd(
        sd.pointer()!,
        prologSyntax.pointer()!,
        instanceSyntax.pointer()!
      );
    }
  }
}

class GroveBuilderEventHandler extends GroveBuilderMessageEventHandler {
  constructor(groveIndex: number, mgr: Messenger, msgFmt: MessageFormatter) {
    super(groveIndex, mgr, msgFmt);
  }

  override appinfo(event: AppinfoEvent): void {
    const strRef: { value: StringC | null } = { value: null };
    if (event.literal(strRef) && strRef.value) {
      this.grove_.setAppinfo(strRef.value);
    }
  }

  override endProlog(event: EndPrologEvent): void {
    const dtd = event.dtdPointer();
    if (dtd && dtd.pointer()) {
      this.grove_.setDtd(dtd.pointer()!);
    }
  }

  override startElement(event: StartElementEvent): void {
    ElementNode.add(this.grove_, event);
  }

  override endElement(event: EndElementEvent): void {
    this.grove_.pop();
  }

  override data(event: DataEvent): void {
    DataNode.add(this.grove_, event);
  }

  override sdataEntity(event: SdataEntityEvent): void {
    SdataNode.add(this.grove_, event);
  }

  override nonSgmlChar(event: NonSgmlCharEvent): void {
    NonSgmlNode.add(this.grove_, event);
  }

  override externalDataEntity(event: ExternalDataEntityEvent): void {
    ExternalDataNode.add(this.grove_, event);
  }

  override subdocEntity(event: SubdocEntityEvent): void {
    SubdocNode.add(this.grove_, event);
  }

  override pi(event: PiEvent): void {
    PiNode.add(this.grove_, event);
  }

  override entityDefaulted(event: EntityDefaultedEvent): void {
    this.grove_.addDefaultedEntity(event.entityPointer());
  }
}

// GroveBuilder - the main factory class
export class GroveBuilder {
  private constructor() {
    // Private constructor - use static methods
  }

  static setBlocking(b: boolean): boolean {
    const prev = blockingAccess;
    blockingAccess = b;
    return prev;
  }

  static make(
    index: number,
    mgr: Messenger,
    msgFmt: MessageFormatter,
    validateOnly: boolean,
    root: NodePtr
  ): ErrorCountEventHandler {
    let eh: GroveBuilderMessageEventHandler;
    if (validateOnly) {
      eh = new GroveBuilderMessageEventHandler(index, mgr, msgFmt);
    } else {
      eh = new GroveBuilderEventHandler(index, mgr, msgFmt);
    }
    eh.makeInitialRoot(root);
    return eh;
  }

  static makeWithSd(
    index: number,
    mgr: Messenger,
    msgFmt: MessageFormatter,
    validateOnly: boolean,
    sd: Sd,
    prologSyntax: Syntax,
    instanceSyntax: Syntax,
    root: NodePtr
  ): ErrorCountEventHandler {
    let eh: GroveBuilderMessageEventHandler;
    if (validateOnly) {
      eh = new GroveBuilderMessageEventHandler(index, mgr, msgFmt);
    } else {
      eh = new GroveBuilderEventHandler(index, mgr, msgFmt);
    }
    eh.makeInitialRoot(root);
    eh.setSd(sd, prologSyntax, instanceSyntax);
    return eh;
  }
}

// Export internal classes for use by other modules
export {
  GroveImpl,
  BaseNode,
  ChunkNode,
  SgmlDocumentNode,
  ElementNode,
  DataNode,
  SgmlConstantsNode,
  DocumentTypeNode,
  BaseNodeList,
  SiblingNodeList,
  Chunk,
  ParentChunk,
  ElementChunk,
  DataChunk,
  SgmlDocumentChunk,
  // New node types
  PiNode,
  PiEntityNode,
  SdataNode,
  NonSgmlNode,
  ExternalDataNode,
  SubdocNode,
  EntityNode,
  EntityRefNode,
  ExternalIdNode,
  // New chunk types
  PiChunk,
  PrologPiChunk,
  EpilogPiChunk,
  SdataChunk,
  NonSgmlChunk,
  ExternalDataChunk,
  SubdocChunk,
  PiEntityChunk,
  EntityRefChunk,
  CharsChunk
};
