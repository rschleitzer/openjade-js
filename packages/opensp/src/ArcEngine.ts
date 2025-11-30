// Copyright (c) 1996 James Clark, 2000 Matthias Clasen
// Copyright (c) 2001 Epremis Corp.
// See the file COPYING for copying permission.

import { Event, EventHandler, MessageEvent, LocatedEvent } from './Event';
import {
  StartElementEvent,
  EndElementEvent,
  DataEvent,
  SdataEntityEvent,
  ExternalDataEntityEvent,
  PiEvent,
  EndPrologEvent,
  StartDtdEvent,
  EndDtdEvent,
  StartLpdEvent,
  EndLpdEvent,
  SgmlDeclEvent,
  AppinfoEvent,
  UselinkEvent
} from './Event';
import { Vector } from './Vector';
import { NCVector } from './NCVector';
import { IQueue } from './IQueue';
import { SgmlParser } from './SgmlParser';
import { Messenger, Message } from './Message';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Char } from './types';
import { Location } from './Location';
import { Notation } from './Notation';
import { SubstTable } from './SubstTable';
import { Ptr, ConstPtr } from './Ptr';
import { Sd } from './Sd';
import { Syntax } from './Syntax';
import { Dtd } from './Dtd';
import { ElementType } from './ElementType';
import { Allocator } from './Allocator';
import { Text } from './Text';
import { Entity } from './Entity';
import { AttributeList, AttributeDefinitionList, AttributeValue } from './Attribute';
import { Attributed } from './Attributed';
import { ContentState } from './ContentState';
import { Id } from './Id';
import { NamedTable } from './NamedTable';
import { PackedBoolean } from './Boolean';
import { ArcEngineMessages } from './ArcEngineMessages';
import { StringMessageArg } from './MessageArg';
import { CopyOwner } from './CopyOwner';

// Helper to create StringC from string
function makeStringC(s: string): StringC {
  const arr: Char[] = [];
  for (let i = 0; i < s.length; i++) {
    arr.push(s.charCodeAt(i));
  }
  return new StringOf<Char>(arr, arr.length);
}

// Helper to convert StringC to string
function stringCToString(sc: StringC): string {
  if (!sc.ptr_ || sc.length_ === 0) return '';
  let result = '';
  for (let i = 0; i < sc.length_; i++) {
    result += String.fromCharCode(sc.ptr_[i]);
  }
  return result;
}

// ArcDirector interface - implemented by classes that want to receive architectural events
export abstract class ArcDirector {
  abstract arcEventHandler(
    arcPublicId: StringC | null,
    notation: Notation | null,
    name: Vector<StringC>,
    table: SubstTable | null
  ): EventHandler | null;
}

// SelectOneArcDirector - selects a single architecture by name
export class SelectOneArcDirector extends ArcDirector {
  private select_: Vector<StringC>;
  private eh_: EventHandler;

  constructor(select: Vector<StringC>, eh: EventHandler) {
    super();
    this.select_ = select;
    this.eh_ = eh;
  }

  arcEventHandler(
    _arcPublicId: StringC | null,
    _notation: Notation | null,
    name: Vector<StringC>,
    table: SubstTable | null
  ): EventHandler | null {
    if (name.size() !== this.select_.size()) {
      return null;
    }
    for (let i = 0; i < name.size(); i++) {
      const tem = new StringOf<Char>(this.select_.get(i).ptr_?.slice() || [], this.select_.get(i).length_);
      if (table) {
        table.subst(tem);
      }
      if (!name.get(i).equals(tem)) {
        return null;
      }
    }
    return this.eh_;
  }

  dispatchMessage(msg: Message): void {
    this.eh_.message(new MessageEvent(msg));
  }
}

// NullEventHandler - passes through messages but ignores other events
class NullEventHandler extends EventHandler {
  private mgr_: Messenger;

  constructor(mgr: Messenger) {
    super();
    this.mgr_ = mgr;
  }

  override message(event: MessageEvent): void {
    this.mgr_.dispatchMessage(event.message());
  }
}

// DelegateEventHandler - delegates all events to another handler
class DelegateEventHandler extends EventHandler {
  protected delegateTo_: EventHandler | null = null;

  override message(event: MessageEvent): void {
    if (this.delegateTo_) this.delegateTo_.message(event);
  }
  override startElement(event: StartElementEvent): void {
    if (this.delegateTo_) this.delegateTo_.startElement(event);
  }
  override endElement(event: EndElementEvent): void {
    if (this.delegateTo_) this.delegateTo_.endElement(event);
  }
  override data(event: DataEvent): void {
    if (this.delegateTo_) this.delegateTo_.data(event);
  }
  override sdataEntity(event: SdataEntityEvent): void {
    if (this.delegateTo_) this.delegateTo_.sdataEntity(event);
  }
  override pi(event: PiEvent): void {
    if (this.delegateTo_) this.delegateTo_.pi(event);
  }
  override externalDataEntity(event: ExternalDataEntityEvent): void {
    if (this.delegateTo_) this.delegateTo_.externalDataEntity(event);
  }
  override endProlog(event: EndPrologEvent): void {
    if (this.delegateTo_) this.delegateTo_.endProlog(event);
  }
  override startDtd(event: StartDtdEvent): void {
    if (this.delegateTo_) this.delegateTo_.startDtd(event);
  }
  override endDtd(event: EndDtdEvent): void {
    if (this.delegateTo_) this.delegateTo_.endDtd(event);
  }
  override startLpd(event: StartLpdEvent): void {
    if (this.delegateTo_) this.delegateTo_.startLpd(event);
  }
  override endLpd(event: EndLpdEvent): void {
    if (this.delegateTo_) this.delegateTo_.endLpd(event);
  }
  override sgmlDecl(event: SgmlDeclEvent): void {
    if (this.delegateTo_) this.delegateTo_.sgmlDecl(event);
  }
  override appinfo(event: AppinfoEvent): void {
    if (this.delegateTo_) this.delegateTo_.appinfo(event);
  }
  override uselink(event: UselinkEvent): void {
    if (this.delegateTo_) this.delegateTo_.uselink(event);
  }
}

// Constants for pseudo-attribute indices
const invalidAtt = 0xFFFFFFFF;
const contentPseudoAtt = 0xFFFFFFFE;

// MetaMap - maps document attributes to architectural attributes
export interface MetaMap {
  attributed: Attributed | null;
  suppressFlags: number;
  attMapFrom: Vector<number>;
  attMapTo: Vector<number>;
  attTokenMapBase: Vector<number>;
  tokenMapFrom: Vector<StringC>;
  tokenMapTo: Vector<StringC>;
}

function createMetaMap(): MetaMap {
  const map: MetaMap = {
    attributed: null,
    suppressFlags: 0,
    attMapFrom: new Vector<number>(),
    attMapTo: new Vector<number>(),
    attTokenMapBase: new Vector<number>(),
    tokenMapFrom: new Vector<StringC>(),
    tokenMapTo: new Vector<StringC>()
  };
  map.attTokenMapBase.push_back(0);
  return map;
}

function clearMetaMap(map: MetaMap): void {
  map.attMapFrom.clear();
  map.attMapTo.clear();
  map.attTokenMapBase.clear();
  map.tokenMapFrom.clear();
  map.tokenMapTo.clear();
  map.attributed = null;
  map.attTokenMapBase.push_back(0);
}

// MetaMapCache - caches MetaMap entries
interface MetaMapCache {
  map: MetaMap;
  noSpec: number[];
  suppressFlags: number;
  linkAtts: AttributeList | null;
}

const nNoSpec = 4;

function createMetaMapCache(): MetaMapCache {
  return {
    map: createMetaMap(),
    noSpec: [invalidAtt, invalidAtt, invalidAtt, invalidAtt],
    suppressFlags: 0,
    linkAtts: null
  };
}

function clearMetaMapCache(cache: MetaMapCache): void {
  for (let i = 0; i < nNoSpec; i++) {
    cache.noSpec[i] = invalidAtt;
  }
  cache.linkAtts = null;
  clearMetaMap(cache.map);
}

// Suppress flags
const isArc = 0x01;
const suppressForm = 0x02;
const suppressSupr = 0x04;
const ignoreData = 0x08;
const condIgnoreData = 0x10;
const recoverData = 0x20;

// Reserved attribute names
enum ReservedName {
  rArcName = 0,
  rArcPubid = 1,
  rArcFormA = 2,
  rArcNamrA = 3,
  rArcSuprA = 4,
  rArcIgnDA = 5,
  rArcDocF = 6,
  rArcSuprF = 7,
  rArcBridF = 8,
  rArcDataF = 9,
  rArcAuto = 10,
  rArcDTD = 11,
  rArcDtdPubid = 12,
  rArcDtdSysid = 13,
  rArcQuant = 14
}
const nReserve = ReservedName.rArcQuant + 1;

// ArcProcessor - processor for a single architecture
export class ArcProcessor {
  private valid_: boolean = false;
  private name_: StringC = makeStringC('');
  private mgr_: Messenger | null = null;
  private docDtd_: ConstPtr<Dtd> | null = null;
  private metaDtd_: Ptr<Dtd> | null = null;
  private docSyntax_: ConstPtr<Syntax> | null = null;
  private metaSyntax_: ConstPtr<Syntax> | null = null;
  private docSd_: ConstPtr<Sd> | null = null;
  private supportAtts_: StringC[] = [];
  private supportAttsText_: (Text | null)[] = [];
  private piDecl_: boolean = false;
  private declLoc_: Location = new Location();
  private piDeclAttspecText_: StringC = makeStringC('');
  private piDeclAttspecIndex_: number = 0;
  private archPiAttributeDefs_: ConstPtr<AttributeDefinitionList> | null = null;
  private arcDtdIsParam_: boolean = false;
  private arcAuto_: boolean = true;
  private arcOpts_: Vector<StringC> = new Vector<StringC>();
  private rniContent_: StringC = makeStringC('');
  private rniArcCont_: StringC = makeStringC('');
  private rniDefault_: StringC = makeStringC('');
  private rniMaptoken_: StringC = makeStringC('');
  private openElementFlags_: Vector<number> = new Vector<number>();
  private attributeList_: AttributeList = new AttributeList();
  private metaMapCache_: (MetaMapCache | null)[] = [];
  private noCacheMetaMap_: MetaMap = createMetaMap();
  private idTable_: NamedTable<Id> = new NamedTable<Id>();
  private currentAttributes_: (ConstPtr<AttributeValue> | null)[] = [];
  private defaultNotation_: ConstPtr<Notation> | null = null;
  private errorIdref_: boolean = true;
  private director_: ArcDirector | null = null;
  private docHandler_: EventHandler | null = null;
  private ownEventHandler_: EventHandler | null = null;
  private docIndex_: number = 0;
  private mayDefaultAttribute_: boolean = true;

  constructor() {
    for (let i = 0; i < nReserve; i++) {
      this.supportAtts_.push(makeStringC(''));
      this.supportAttsText_.push(null);
    }
  }

  setName(name: StringC, loc: Location): void {
    this.piDecl_ = false;
    this.name_ = name;
    this.declLoc_ = loc;
  }

  name(): StringC {
    return this.name_;
  }

  piDecl(): boolean {
    return this.piDecl_;
  }

  valid(): boolean {
    return this.valid_;
  }

  dtdPointer(): ConstPtr<Dtd> | null {
    return this.metaDtd_ ? new ConstPtr(this.metaDtd_.pointer()) : null;
  }

  docHandler(): EventHandler {
    return this.docHandler_!;
  }

  setPiDecl(
    loc: Location,
    attspecText: StringC,
    attspecIndex: number,
    archPiAttributeDefs: ConstPtr<AttributeDefinitionList>
  ): void {
    this.piDecl_ = true;
    this.declLoc_ = loc;
    this.piDeclAttspecText_ = attspecText;
    this.piDeclAttspecIndex_ = attspecIndex;
    this.archPiAttributeDefs_ = archPiAttributeDefs;
  }

  private lookupCreateId(name: StringC): Id {
    let id = this.idTable_.lookup(name);
    if (!id) {
      id = new Id(name);
      this.idTable_.insert(id);
    }
    return id;
  }

  checkIdrefs(): void {
    // Check for unresolved ID references
    // Simplified - full version iterates idTable_
  }

  message(type: any, ...args: any[]): void {
    const msg = new Message(type);
    for (const arg of args) {
      const co = new CopyOwner<any>(arg);
      msg.args.push_back(co);
    }
    if (this.mgr_) {
      this.mgr_.dispatchMessage(msg);
    }
  }

  // Main processing methods
  // Simplified implementation - the full upstream version is ~400 lines
  // For DSSSL, we just forward events directly to docHandler_
  processStartElement(
    event: StartElementEvent,
    linkAttributes: AttributeList | null,
    content: Text | null,
    alloc: Allocator
  ): boolean {
    // Track that we're in an architectural element
    this.openElementFlags_.push_back(isArc);

    // Forward the event to docHandler_
    if (this.docHandler_) {
      this.docHandler_.startElement(event);
    }
    return true;
  }

  processEndElement(event: EndElementEvent, alloc: Allocator): void {
    // Pop the element flag
    if (this.openElementFlags_.size() > 0) {
      this.openElementFlags_.resize(this.openElementFlags_.size() - 1);
    }

    // Forward the event to docHandler_
    if (this.docHandler_) {
      this.docHandler_.endElement(event);
    }
  }

  processData(): boolean {
    // Check if we should process data
    if (this.openElementFlags_.size() > 0 &&
        (this.openElementFlags_.back() & ignoreData)) {
      return false;
    }
    return true;
  }

  // Initialize the processor
  // Port of ArcProcessor::init from ArcEngine.cxx
  init(
    event: EndPrologEvent,
    sd: ConstPtr<Sd>,
    syntax: ConstPtr<Syntax>,
    parser: SgmlParser,
    mgr: Messenger,
    superName: Vector<StringC>,
    arcProcessors: NCVector<ArcProcessor>,
    director: ArcDirector,
    cancelPtr: { value: number } | null
  ): void {
    this.director_ = director;
    this.mgr_ = mgr;
    this.docSyntax_ = syntax;
    this.docSd_ = sd;
    this.valid_ = false;
    this.docDtd_ = event.dtdPointer();
    this.metaSyntax_ = this.docSyntax_;
    this.mayDefaultAttribute_ = true;

    let notation: Notation | null = null;
    let arcPublicId: StringC | null = null;

    // Apply case substitution to name if not from PI
    if (!this.piDecl_) {
      const substTable = this.docSyntax_?.pointer()?.generalSubstTable();
      if (substTable) {
        substTable.subst(this.name_);
      }
    }

    // Check for duplicate architecture declarations
    for (let i = 0; i < arcProcessors.size(); i++) {
      const p = arcProcessors.get(i);
      if (p === this) break;
      if (this.name_.equals(p.name())) {
        if ((this.piDecl_ && p.piDecl()) || (!this.piDecl_ && !p.piDecl())) {
          // Duplicate declaration
          return;
        }
        // One is PI, one is notation - PI is ignored if notation exists
        if (this.piDecl_) {
          return;
        }
      }
    }

    // Look up notation and get public ID
    if (this.piDecl_) {
      // PI-based declaration - arcPublicId comes from PI attributes
      // TODO: parse PI attributes for public-id
    } else {
      // Notation-based declaration
      if (this.docDtd_) {
        notation = this.docDtd_.pointer()?.lookupNotation(this.name_).pointer() || null;
        if (notation) {
          arcPublicId = notation.externalId().publicIdString() || null;
        } else {
          // No notation declaration found for this architecture
          mgr.message(ArcEngineMessages.noArcNotation, new StringMessageArg(this.name_));
          return;
        }
      }
    }

    // Build the document name (architecture path)
    const docName = new Vector<StringC>();
    for (let i = 0; i < superName.size(); i++) {
      docName.push_back(superName.get(i));
    }
    docName.push_back(this.name_);

    // Create a new ArcEngineImpl for this architecture
    // This calls director.arcEventHandler with the notation
    const engine = new ArcEngineImpl(
      mgr,
      parser,
      director,
      cancelPtr,
      arcPublicId,
      notation,
      docName,
      this.docSyntax_?.pointer()?.generalSubstTable() || null
    );

    this.docHandler_ = engine;
    this.ownEventHandler_ = engine;

    // For DSSSL, we don't need to parse a meta-DTD
    // The director's arcEventHandler will handle validation
    this.valid_ = true;
  }
}

// ArcEngineImpl - main implementation of architectural processing
class ArcEngineImpl extends DelegateEventHandler {
  private eventHandler_: EventHandler;
  private arcProcessors_: NCVector<ArcProcessor> = new NCVector<ArcProcessor>();
  private sd_: ConstPtr<Sd> | null = null;
  private syntax_: ConstPtr<Syntax> | null = null;
  private is10744_: StringC = makeStringC('');
  private arcBase_: StringC = makeStringC('');
  private namespaceDelim_: StringC = makeStringC('');
  private arch_: StringC = makeStringC('');
  private uselex_: StringC = makeStringC('');
  private archPiAttributeDefs_: ConstPtr<AttributeDefinitionList> | null = null;
  private stage_: number = 0;
  private eventQueue_: IQueue<Event> = new IQueue<Event>();
  private nullHandler_: NullEventHandler;
  private parser_: SgmlParser;
  private currentLocation_: Location = new Location();
  private gatheringContent_: number = 0;
  private content_: Text = new Text();
  private startAgain_: number = 0;
  private alloc_: Allocator;
  private appinfo_: StringC = makeStringC('');
  private linkAttributes_: AttributeList | null = null;
  private haveLinkProcess_: boolean = false;
  private docName_: Vector<StringC>;
  private director_: ArcDirector;
  private mgr_: Messenger;
  private cancelPtr_: { value: number } | null;

  constructor(
    mgr: Messenger,
    parser: SgmlParser,
    director: ArcDirector,
    cancelPtr: { value: number } | null,
    arcPublicId: StringC | null,
    notation: Notation | null,
    docName: Vector<StringC>,
    table: SubstTable | null
  ) {
    super();
    this.director_ = director;
    this.mgr_ = mgr;
    this.cancelPtr_ = cancelPtr;
    this.parser_ = parser;
    this.stage_ = 0;
    this.gatheringContent_ = 0;
    this.startAgain_ = 0;
    this.haveLinkProcess_ = false;
    this.alloc_ = new Allocator(256, 50);
    this.nullHandler_ = new NullEventHandler(mgr);
    this.docName_ = docName;

    const eh = director.arcEventHandler(arcPublicId, notation, docName, table);
    this.eventHandler_ = eh || this.nullHandler_;
    this.delegateTo_ = this.eventHandler_;
  }

  nBases(): number {
    return this.arcProcessors_.size();
  }

  delegateHandler(): EventHandler {
    return this.eventHandler_;
  }

  // Event handlers
  override appinfo(event: AppinfoEvent): void {
    const strRef: { value: StringC | null } = { value: null };
    if (event.literal(strRef) && strRef.value) {
      this.appinfo_ = strRef.value;
    }
    super.appinfo(event);
  }

  override pi(event: PiEvent): void {
    this.currentLocation_ = event.location();

    // PI processing for IS10744 architecture declarations
    // Look for <?IS10744 ArcBase name1 name2...?> or <?IS10744:arch ...?>
    if (this.stage_ === 1 && event.dataLength() > this.is10744_.size() + 1) {
      const data = event.data();
      const syntax = this.syntax_?.pointer();
      const substTable = syntax?.generalSubstTable();

      if (!substTable) {
        super.pi(event);
        return;
      }

      // Check for IS10744 prefix
      let match = true;
      let i = 0;
      for (let j = 0; j < this.is10744_.size() && match; i++, j++) {
        const dataCh = substTable.subst(data[i]);
        const refCh = this.is10744_.data()[j];
        if (dataCh !== refCh) {
          match = false;
        }
      }

      if (match) {
        // Check for namespace delimiter or whitespace
        let hasNamespaceDelim = false;
        if ((event.dataLength() - i) >= this.namespaceDelim_.size()) {
          hasNamespaceDelim = true;
          for (let j = 0; j < this.namespaceDelim_.size() && hasNamespaceDelim; j++) {
            if (substTable.subst(data[i + j]) !== this.namespaceDelim_.data()[j]) {
              hasNamespaceDelim = false;
            }
          }
        }

        if (hasNamespaceDelim || syntax!.isS(data[i])) {
          if (hasNamespaceDelim) {
            i += this.namespaceDelim_.size();
          } else {
            // Skip whitespace
            do {
              i++;
            } while (i < event.dataLength() && syntax!.isS(data[i]));
          }

          if (i < event.dataLength()) {
            // Parse the keyword token
            const tokenChars: Char[] = [];
            do {
              tokenChars.push(substTable.subst(data[i++]));
            } while (i < event.dataLength() && !syntax!.isS(data[i]));
            const token = new StringOf<Char>(tokenChars, tokenChars.length);

            // Check for ArcBase - <?IS10744 ArcBase name1 name2...?>
            if (!hasNamespaceDelim && token.equals(this.arcBase_)) {
              const dataLength = event.dataLength();
              // Parse architecture names
              for (;;) {
                while (i < dataLength && syntax!.isS(data[i])) i++;
                if (i >= dataLength) break;
                const start = i++;
                while (i < dataLength && !syntax!.isS(data[i])) i++;
                const nameChars: Char[] = [];
                for (let k = start; k < i; k++) {
                  nameChars.push(substTable.subst(data[k]));
                }
                const name = new StringOf<Char>(nameChars, nameChars.length);
                // Add to arc processors
                const proc = new ArcProcessor();
                const loc = event.location();
                // TODO: loc += start;
                proc.setName(name, loc);
                this.arcProcessors_.push_back(proc);
              }
            }
            // Check for arch - <?IS10744:arch name=X ...?>
            else if (token.equals(this.arch_)) {
              // PI-based architecture declaration
              const proc = new ArcProcessor();
              const remainingText = new StringOf<Char>();
              for (let k = i; k < event.dataLength(); k++) {
                remainingText.appendChar(data[k]);
              }
              proc.setPiDecl(
                event.location(),
                remainingText,
                i,
                this.archPiAttributeDefs_
              );
              this.arcProcessors_.push_back(proc);
            }
          }
        }
      }
    }

    super.pi(event);
  }

  override sgmlDecl(event: SgmlDeclEvent): void {
    this.currentLocation_ = event.location();
    this.sd_ = event.sdPointer();
    // Use instance syntax if available, otherwise fall back to prolog syntax
    this.syntax_ = event.instanceSyntaxPointer();
    if (!this.syntax_.pointer()) {
      this.syntax_ = event.prologSyntaxPointer();
    }

    if (this.sd_ && this.sd_.pointer()) {
      const sd = this.sd_.pointer()!;
      this.arcBase_ = sd.execToInternal('ArcBase');
      if (this.syntax_ && this.syntax_.pointer()) {
        this.syntax_.pointer()!.generalSubstTable()?.subst(this.arcBase_);
      }
      this.is10744_ = sd.execToInternal('IS10744');
      this.arch_ = sd.execToInternal('arch');
      if (this.syntax_ && this.syntax_.pointer()) {
        this.syntax_.pointer()!.generalSubstTable()?.subst(this.arch_);
      }
      this.uselex_ = sd.execToInternal('USELEX');
      this.namespaceDelim_ = sd.execToInternal(':');
    }
    super.sgmlDecl(event);
  }

  override startDtd(event: StartDtdEvent): void {
    this.stage_++;
    super.startDtd(event);
  }

  override endDtd(event: EndDtdEvent): void {
    this.stage_++;
    super.endDtd(event);
  }

  override startLpd(event: StartLpdEvent): void {
    if (event.active()) {
      this.stage_ = 1;
    }
    super.startLpd(event);
  }

  override endLpd(event: EndLpdEvent): void {
    this.stage_++;
    super.endLpd(event);
  }

  override endProlog(event: EndPrologEvent): void {
    this.currentLocation_ = event.location();

    // Initialize all arc processors
    for (let i = 0; i < this.arcProcessors_.size(); i++) {
      const proc = this.arcProcessors_.get(i);
      proc.init(
        event,
        this.sd_!,
        this.syntax_!,
        this.parser_,
        this.mgr_,
        this.docName_,
        this.arcProcessors_,
        this.director_,
        this.cancelPtr_
      );
    }

    // Handle link process if present
    if (event.lpdPointer() && !event.lpdPointer().isNull()) {
      this.haveLinkProcess_ = true;
    }

    super.endProlog(event);
  }

  override startElement(event: StartElementEvent): void {
    if (this.gatheringContent_) {
      this.gatheringContent_++;
      super.startElement(event);
      return;
    }

    this.currentLocation_ = event.location();

    // Process through arc processors
    for (let i = 0; i < this.arcProcessors_.size(); i++) {
      const proc = this.arcProcessors_.get(i);
      if (proc.valid()) {
        if (!proc.processStartElement(event, this.linkAttributes_, this.content_, this.alloc_)) {
          this.startAgain_ = i + 1;
          this.gatheringContent_ = 1;
          // Queue events while gathering content
          return;
        }
      }
    }

    this.content_.clear();
    super.startElement(event);
  }

  override endElement(event: EndElementEvent): void {
    while (this.gatheringContent_) {
      if (--this.gatheringContent_ > 0) {
        super.endElement(event);
        return;
      }
      this.delegateTo_ = this.delegateHandler();
      // Process queued events
      while (!this.eventQueue_.empty()) {
        const ev = this.eventQueue_.get();
        if (ev) {
          ev.handle(this);
        }
      }
    }

    this.currentLocation_ = event.location();

    for (let i = 0; i < this.arcProcessors_.size(); i++) {
      const proc = this.arcProcessors_.get(i);
      if (proc.valid()) {
        proc.processEndElement(event, this.alloc_);
      }
    }

    super.endElement(event);
  }

  override data(event: DataEvent): void {
    if (this.gatheringContent_) {
      // Accumulate content
      const dataArr = event.data();
      const dataLen = event.dataLength();
      const arr: number[] = [];
      for (let i = 0; i < dataLen; i++) {
        arr.push(dataArr[i]);
      }
      this.content_.addChars(
        arr,
        dataLen,
        event.location()
      );
    } else {
      this.currentLocation_ = event.location();
      for (let i = 0; i < this.arcProcessors_.size(); i++) {
        const proc = this.arcProcessors_.get(i);
        if (proc.valid() && proc.processData()) {
          // Forward data to architecture handler
          proc.docHandler()?.data(event);
        }
      }
    }
    super.data(event);
  }

  override sdataEntity(event: SdataEntityEvent): void {
    if (this.gatheringContent_) {
      return;
    }
    this.currentLocation_ = event.location();
    for (let i = 0; i < this.arcProcessors_.size(); i++) {
      const proc = this.arcProcessors_.get(i);
      if (proc.valid() && proc.processData()) {
        // Pass sdata to architecture
      }
    }
    super.sdataEntity(event);
  }

  override externalDataEntity(event: ExternalDataEntityEvent): void {
    if (!this.gatheringContent_) {
      this.currentLocation_ = event.location();
      // Process external data entity through architectures
    }
    super.externalDataEntity(event);
  }

  override uselink(event: UselinkEvent): void {
    super.uselink(event);
  }
}

// Main ArcEngine class
export class ArcEngine {
  private constructor() {
    // Private constructor - use static parseAll
  }

  static parseAll(
    parser: SgmlParser,
    mgr: Messenger,
    director: ArcDirector,
    cancelPtr: number | null = null
  ): void {
    const wrap = new ArcEngineImpl(
      mgr,
      parser,
      director,
      cancelPtr !== null ? { value: cancelPtr } : null,
      null,
      null,
      new Vector<StringC>(),
      null
    );
    parser.parseAll(wrap, cancelPtr !== null ? cancelPtr : undefined);
  }
}
