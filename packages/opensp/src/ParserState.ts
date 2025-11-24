// Copyright (c) 1994 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Allocator } from './Allocator';
import { AttributeList, AttributeValue, AttributeDefinitionList, AttributeContext } from './Attribute';
import { Boolean, PackedBoolean } from './Boolean';
import { Vector } from './Vector';
import { StringC } from './StringC';
import { String } from './StringOf';
import { Dtd } from './Dtd';
import { Entity, InternalEntity, ExternalEntity, InternalTextEntity, PredefinedEntity } from './Entity';
import { EntityDecl } from './EntityDecl';
import { EntityOrigin } from './Location';
import { EntityCatalog } from './EntityCatalog';
import { EntityManager } from './EntityManager';
import { Event, MessageEvent, EntityDefaultedEvent } from './Event';
import { EventQueue, Pass1EventHandler } from './EventQueue';
import { Id } from './Id';
import { InputSource } from './InputSource';
import { IList } from './IList';
import { IListIter } from './IListIter';
import { IQueue } from './IQueue';
import { Location } from './Location';
import { Message, Messenger } from './Message';
import { StringMessageArg, NumberMessageArg } from './MessageArg';
import { Mode, nModes } from './Mode';
import { OpenElement } from './OpenElement';
import { OutputState } from './OutputState';
import { ParserOptions } from './ParserOptions';
import { EventsWanted } from './EventsWanted';
import { Ptr, ConstPtr } from './Ptr';
import { Recognizer } from './Recognizer';
import { Sd } from './Sd';
import { Syntax } from './Syntax';
import { NCVector } from './NCVector';
import { Owner } from './Owner';
import { Lpd, ComplexLpd } from './Lpd';
import { LpdEntityRef } from './LpdEntityRef';
import { Markup } from './Markup';
import { ContentState } from './ContentState';
import { Xchar, Char, Token, Offset } from './types';
import { XcharMap } from './XcharMap';
import { OwnerTable, OwnerTableIter } from './OwnerTable';
import { SubstTable } from './SubstTable';
import { NamedTable, NamedTableIter } from './NamedTable';
import { NamedResourceTable } from './NamedResourceTable';
import { Notation } from './Notation';
import { ExternalId } from './ExternalId';
import { Text } from './Text';
import { RankStem } from './ElementType';
import { ExternalTextEntity } from './Entity';
import { ASSERT, SIZEOF } from './macros';
import { InternalInputSource } from './InternalInputSource';
import { Undo, UndoStartTag, UndoEndTag, UndoTransition, ParserState as ParserStateInterface } from './Undo';
import * as ParserMessages from './ParserMessages';

export enum Phase {
  noPhase,
  initPhase,
  prologPhase,
  declSubsetPhase,
  instanceStartPhase,
  contentPhase
}

// Simplified - just use PointerTable directly since OwnerTable type constraints are complex
type LpdEntityRefSet = any; // OwnerTable<LpdEntityRef, ...>
type LpdEntityRefSetIter = any; // OwnerTableIter<LpdEntityRef, ...>

export class ParserState extends ContentState implements ParserStateInterface {
  private static nullLocation_: Location = new Location();
  private static dummyCancel_: number = 0;

  // Messenger fields (ParserState acts as its own Messenger via AttributeContext inheritance simulation)
  private haveNextLocation_: PackedBoolean;
  private nextLocation_: Location;

  private options_: ParserOptions;
  private handler_: any; // EventHandler
  private pass1Handler_: Pass1EventHandler;
  private allowPass2_: Boolean;
  private pass2StartOffset_: Offset;
  private hadPass2Start_: Boolean;
  private eventQueue_: EventQueue;
  private outputState_: OutputState;
  private prologSyntax_: ConstPtr<Syntax>;
  private instanceSyntax_: ConstPtr<Syntax>;
  private sd_: ConstPtr<Sd>;
  private subdocLevel_: number;
  private entityManager_: Ptr<EntityManager>;
  private entityCatalog_: ConstPtr<EntityCatalog>;
  private phase_: Phase;
  private finalPhase_: Phase;
  private inInstance_: Boolean;
  private inStartTag_: Boolean;
  private inEndTag_: Boolean;
  private defDtd_: Ptr<Dtd>;
  private defLpd_: Ptr<Lpd>;
  private allLpd_: Vector<ConstPtr<Lpd>>;
  private lpd_: Vector<ConstPtr<Lpd>>; // active LPDs
  private activeLinkTypes_: Vector<StringC>;
  private activeLinkTypesSubsted_: Boolean;
  private hadLpd_: Boolean;
  private resultAttributeSpecMode_: Boolean;
  private pass2_: Boolean;
  private lpdEntityRefs_: LpdEntityRefSet;
  private dsEntity_: ConstPtr<Entity>;
  private eventAllocator_: Allocator;
  private internalAllocator_: Allocator;
  private attributeLists_: NCVector<Owner<AttributeList>>;
  private nameBuffer_: StringC;
  private keepingMessages_: Boolean;
  private keptMessages_: IQueue<MessageEvent>;
  private currentMode_: Mode;
  private pcdataRecovering_: Boolean;
  private specialParseInputLevel_: number;
  private specialParseMode_: Mode;
  private markedSectionLevel_: number;
  private markedSectionSpecialLevel_: number;
  private markedSectionStartLocation_: Vector<Location>;
  private recognizers_: (ConstPtr<Recognizer> | null)[];
  private normalMap_: XcharMap<PackedBoolean>;
  private inputLevel_: number;
  private inputStack_: IList<InputSource>;
  private inputLevelElementIndex_: Vector<number>;
  private currentDtd_: Ptr<Dtd>;
  private currentDtdConst_: ConstPtr<Dtd>;
  private dtd_: Vector<Ptr<Dtd>>;
  private pass1Dtd_: Ptr<Dtd>;
  private instantiatedDtds_: number;
  private syntax_: ConstPtr<Syntax>;
  private currentRank_: Vector<StringC>;
  private idTable_: NamedTable<Id>;
  private instanceDefaultedEntityTable_: NamedResourceTable<Entity>;
  private undefinedEntityTable_: NamedResourceTable<Entity>;
  private currentAttributes_: Vector<ConstPtr<AttributeValue>>;
  private currentMarkup_: Markup | null;
  private markup_: Markup;
  private markupLocation_: Location;
  private hadAfdrDecl_: Boolean;
  private implydefElement_: number;
  private implydefAttlist_: Boolean;
  private cancelPtr_: number;

  constructor(
    em: Ptr<EntityManager>,
    opt: ParserOptions,
    subdocLevel: number,
    finalPhase: Phase
  ) {
    super();

    // Initialize Messenger fields
    this.haveNextLocation_ = false;
    this.nextLocation_ = new Location();

    // Compute max event size - simplified for TypeScript
    const eventMaxSize = 1024; // Placeholder for max event size
    const internalMaxSize = Math.max(512, EntityOrigin.allocSize || 512); // Placeholder

    this.entityManager_ = em;
    this.options_ = opt;
    this.inInstance_ = false;
    this.inStartTag_ = false;
    this.inEndTag_ = false;
    this.keepingMessages_ = false;
    this.eventAllocator_ = new Allocator(eventMaxSize, 50);
    this.internalAllocator_ = new Allocator(internalMaxSize, 50);
    this.eventQueue_ = new EventQueue();
    this.handler_ = this.eventQueue_;
    this.pass1Handler_ = new Pass1EventHandler();
    this.subdocLevel_ = subdocLevel;
    this.inputLevel_ = 0;
    this.specialParseInputLevel_ = 0;
    this.markedSectionLevel_ = 0;
    this.markedSectionSpecialLevel_ = 0;
    this.currentMode_ = Mode.proMode;
    this.hadLpd_ = false;
    this.resultAttributeSpecMode_ = false;
    this.pass2_ = false;
    this.activeLinkTypesSubsted_ = false;
    this.allowPass2_ = false;
    this.hadPass2Start_ = false;
    this.pcdataRecovering_ = false;
    this.currentMarkup_ = null;
    this.cancelPtr_ = 0;
    this.finalPhase_ = finalPhase;
    this.hadAfdrDecl_ = false;
    this.instantiatedDtds_ = 0;
    this.phase_ = Phase.noPhase;
    this.pass2StartOffset_ = 0;

    this.prologSyntax_ = new ConstPtr<Syntax>();
    this.instanceSyntax_ = new ConstPtr<Syntax>();
    this.sd_ = new ConstPtr<Sd>();
    this.entityCatalog_ = new ConstPtr<EntityCatalog>();
    this.defDtd_ = new Ptr<Dtd>();
    this.defLpd_ = new Ptr<Lpd>();
    this.allLpd_ = new Vector<ConstPtr<Lpd>>();
    this.lpd_ = new Vector<ConstPtr<Lpd>>();
    this.activeLinkTypes_ = new Vector<StringC>();
    this.lpdEntityRefs_ = new OwnerTable(
      LpdEntityRef.hash as any,
      LpdEntityRef.key as any
    ) as any;
    this.dsEntity_ = new ConstPtr<Entity>();
    this.attributeLists_ = new NCVector<Owner<AttributeList>>();
    this.nameBuffer_ = new String<Char>();
    this.activeLinkTypes_ = new Vector<StringC>();
    this.keptMessages_ = new IQueue<MessageEvent>();
    this.markedSectionStartLocation_ = new Vector<Location>();
    this.recognizers_ = new Array(nModes).fill(null);
    this.normalMap_ = new XcharMap<PackedBoolean>();
    this.inputStack_ = new IList<InputSource>();
    this.inputLevelElementIndex_ = new Vector<number>();
    this.currentDtd_ = new Ptr<Dtd>();
    this.currentDtdConst_ = new ConstPtr<Dtd>();
    this.dtd_ = new Vector<Ptr<Dtd>>();
    this.pass1Dtd_ = new Ptr<Dtd>();
    this.syntax_ = new ConstPtr<Syntax>();
    this.currentRank_ = new Vector<StringC>();
    this.idTable_ = new NamedTable<Id>();
    this.instanceDefaultedEntityTable_ = new NamedResourceTable<Entity>();
    this.undefinedEntityTable_ = new NamedResourceTable<Entity>();
    this.currentAttributes_ = new Vector<ConstPtr<AttributeValue>>();
    this.markup_ = new Markup();
    this.markupLocation_ = new Location();
    this.implydefElement_ = Sd.ImplydefElement.implydefElementNo;
    this.implydefAttlist_ = false;
    this.outputState_ = new OutputState();
  }

  inheritActiveLinkTypes(parent: ParserState): void {
    this.activeLinkTypes_ = parent.activeLinkTypes_;
    this.activeLinkTypesSubsted_ = parent.activeLinkTypesSubsted_;
  }

  allDone(): void {
    this.phase_ = Phase.noPhase;
  }

  setPass2Start(): void {
    ASSERT(this.inputLevel_ === 1);
    if (this.hadPass2Start_) {
      return;
    }
    this.hadPass2Start_ = true;
    if (!this.pass2() && this.sd().link() && this.activeLinkTypes_.size() > 0) {
      this.allowPass2_ = true;
      this.pass1Handler_.init(this.handler_);
      this.handler_ = this.pass1Handler_;
      const p = this.currentLocation().origin()?.pointer()?.asInputSourceOrigin();
      if (p) {
        this.pass2StartOffset_ = p.startOffset(this.currentLocation().index());
      }
    } else {
      this.allowPass2_ = false;
      const input = this.currentInput();
      if (input) {
        input.willNotRewind();
      }
    }
  }

  allLinkTypesActivated(): void {
    if (this.activeLinkTypes_.size() === 0 && this.inputLevel_ === 1) {
      const input = this.currentInput();
      if (input) {
        input.willNotRewind();
      }
    }
  }

  maybeStartPass2(): Boolean {
    if (this.pass2_ || !this.allowPass2_) {
      return false;
    }
    this.handler_ = this.pass1Handler_.origHandler();
    if (!this.nActiveLink() || this.pass1Handler_.hadError()) {
      while (!this.pass1Handler_.empty()) {
        if (this.cancelled()) {
          return false;
        }
        const event = this.pass1Handler_.get();
        if (event) {
          event.handle(this.handler_);
        }
      }
      let top: InputSource | null = null;
      const iter = new IListIter<InputSource>(this.inputStack_);
      while (!iter.done()) {
        top = iter.cur();
        iter.next();
      }
      if (top) {
        top.willNotRewind();
      }
      return false;
    }
    this.pass1Handler_.clear();
    while (this.inputLevel_ > 1) {
      const p = this.inputStack_.get();
      this.inputLevel_--;
      // Delete input source (JS GC will handle it)
    }
    if (this.inputLevel_ === 0) {
      return false;
    }
    const head = this.inputStack_.head();
    if (!head || !head.rewind(this)) {
      this.inputLevel_ = 0;
      this.inputStack_.get();
      return false;
    }
    head.willNotRewind();
    for (; this.pass2StartOffset_ > 0; this.pass2StartOffset_--) {
      const h = this.inputStack_.head();
      if (h && h.get(this.messenger()) === InputSource.eE) {
        this.message(ParserMessages.pass2Ee);
        this.inputLevel_ = 0;
        this.inputStack_.get();
        return false;
      }
    }
    this.specialParseInputLevel_ = 0;
    this.markedSectionLevel_ = 0;
    this.markedSectionSpecialLevel_ = 0;
    this.currentMode_ = Mode.proMode;
    this.hadLpd_ = false;
    this.allowPass2_ = false;
    this.hadPass2Start_ = false;
    this.currentMarkup_ = null;
    this.inputLevel_ = 1;
    this.inInstance_ = false;
    this.inStartTag_ = false;
    this.inEndTag_ = false;
    this.defDtd_.clear();
    this.defLpd_.clear();
    this.dtd_[0].swap(this.pass1Dtd_);
    this.dtd_.clear();
    this.dsEntity_.clear();
    this.currentDtd_.clear();
    this.currentDtdConst_.clear();
    this.phase_ = Phase.noPhase;
    this.pass2_ = true;
    this.lpd_.clear();
    this.allLpd_.clear();
    return true;
  }

  referenceDsEntity(loc: Location): Boolean {
    if (this.dsEntity_.isNull()) {
      return false;
    }
    const entity = this.dsEntity_.pointer();
    if (entity) {
      const originObj = EntityOrigin.makeEntity(this.internalAllocator(), this.dsEntity_, loc);
      const origin = new Ptr(originObj);
      entity.dsReference(this, origin);
    }
    this.dsEntity_.clear();
    return this.inputLevel() > 1;
  }

  startDtd(name: StringC): void {
    this.defDtd_ = new Ptr<Dtd>(new Dtd(name, this.dtd_.size() === 0));
    this.defLpd_.clear();

    for (let i = 0; i < this.options().includes.size(); i++) {
      let name = this.options().includes[i];
      const substTable = this.syntax().entitySubstTable();
      if (substTable) {
        substTable.subst(name);
      }
      const text = new Text();
      text.addChars(this.syntax().reservedName(Syntax.ReservedName.rINCLUDE), new Location());
      const entity = new InternalTextEntity(
        name,
        EntityDecl.DeclType.parameterEntity,
        new Location(),
        text,
        InternalTextEntity.Bracketed.none
      );
      entity.setUsed();
      const dtd = this.defDtd_.pointer();
      if (dtd) {
        dtd.insertEntity(new Ptr<Entity>(entity));
      }
    }

    const nEntities = this.instanceSyntax_.pointer()?.nEntities() || 0;
    for (let i = 0; i < nEntities; i++) {
      const instSyntax = this.instanceSyntax_.pointer();
      if (!instSyntax) continue;
      const text = new Text();
      text.addChar(instSyntax.entityChar(i), new Location());
      const entity = new PredefinedEntity(
        instSyntax.entityName(i),
        new Location(),
        text
      );
      const dtd = this.defDtd_.pointer();
      if (dtd) {
        dtd.insertEntity(new Ptr<Entity>(entity));
      }
    }

    this.currentDtd_ = this.defDtd_;
    this.currentDtdConst_ = this.defDtd_.asConst();
    this.currentMode_ = Mode.dsMode;
  }

  enterTag(start: Boolean): void {
    if (start) {
      this.inStartTag_ = true;
    } else {
      this.inEndTag_ = true;
    }
  }

  leaveTag(): void {
    this.inStartTag_ = false;
    this.inEndTag_ = false;
  }

  inTag(start: { value: Boolean }): Boolean {
    start.value = this.inStartTag_;
    return this.inStartTag_ || this.inEndTag_;
  }

  endDtd(): void {
    this.dtd_.push_back(this.defDtd_);
    this.defDtd_.clear();
    this.currentDtd_.clear();
    this.currentDtdConst_.clear();
    this.currentMode_ = Mode.proMode;
  }

  startLpd(lpd: Ptr<Lpd>): void {
    this.defLpd_ = lpd;
    const lpdPtr = this.defLpd_.pointer();
    if (lpdPtr) {
      this.defDtd_ = lpdPtr.sourceDtd();
      this.currentDtd_ = lpdPtr.sourceDtd();
      this.currentDtdConst_ = lpdPtr.sourceDtd().asConst();
    }
    this.currentMode_ = Mode.dsMode;
  }

  endLpd(): void {
    this.hadLpd_ = true;
    const lpdPtr = this.defLpd_.pointer();
    if (lpdPtr && lpdPtr.active()) {
      this.lpd_.push_back(this.defLpd_.asConst());
    }
    this.allLpd_.push_back(this.defLpd_.asConst());
    this.defLpd_.clear();
    this.currentDtd_.clear();
    this.currentDtdConst_.clear();
    this.currentMode_ = Mode.proMode;
  }

  popInputStack(): void {
    ASSERT(this.inputLevel_ > 0);
    const p = this.inputStack_.get();

    if (this.handler_ && this.inputLevel_ > 1 && p) {
      this.handler_.inputClosed(p);
    }

    this.inputLevel_--;
    // Delete input source (JS GC will handle it)

    if (this.specialParseInputLevel_ > 0 && this.inputLevel_ === this.specialParseInputLevel_) {
      this.currentMode_ = this.specialParseMode_;
    }
    if (this.currentMode_ === Mode.dsiMode &&
        this.inputLevel_ === 1 &&
        this.markedSectionLevel_ === 0) {
      this.currentMode_ = Mode.dsMode;
    }
    if (this.inputLevelElementIndex_.size()) {
      this.inputLevelElementIndex_.resize(this.inputLevelElementIndex_.size() - 1);
    }
  }

  setSd(sd: ConstPtr<Sd>): void {
    this.sd_ = sd;
    const sdPtr = this.sd_.pointer();
    if (sdPtr) {
      this.mayDefaultAttribute_ = (sdPtr.omittag() || sdPtr.attributeDefault());
      this.validate_ = sdPtr.typeValid();
      this.implydefElement_ = sdPtr.implydefElement();
      this.implydefAttlist_ = sdPtr.implydefAttlist();
    }
  }

  setSyntax(syntax: ConstPtr<Syntax>): void {
    this.syntax_ = syntax;
    this.prologSyntax_ = syntax;
    this.instanceSyntax_ = syntax;
  }

  setSyntaxes(prologSyntax: ConstPtr<Syntax>, instanceSyntax: ConstPtr<Syntax>): void {
    this.syntax_ = prologSyntax;
    this.prologSyntax_ = prologSyntax;
    this.instanceSyntax_ = instanceSyntax;
  }

  pushInput(input: InputSource | null): void {
    if (!input) {
      return;
    }

    if (this.handler_ && this.inputLevel_ > 0) {
      this.handler_.inputOpened(input);
    }

    const syntaxPtr = this.syntax_.pointer();
    if (syntaxPtr && syntaxPtr.multicode()) {
      input.setMarkupScanTable(syntaxPtr.markupScanTable());
    }
    this.inputStack_.insert(input);
    this.inputLevel_++;

    if (this.specialParseInputLevel_ > 0 && this.inputLevel_ > this.specialParseInputLevel_) {
      this.currentMode_ = Mode.rcconeMode;
    } else if (this.currentMode_ === Mode.dsMode) {
      this.currentMode_ = Mode.dsiMode;
    }

    const sdPtr = this.sd_.pointer();
    if (this.inInstance_ && sdPtr && sdPtr.integrallyStored()) {
      this.inputLevelElementIndex_.push_back(
        this.tagLevel() ? this.currentElement().index() : 0
      );
    }
  }

  startMarkedSection(loc: Location): void {
    this.markedSectionLevel_++;
    this.markedSectionStartLocation_.push_back(loc);
    if (this.currentMode_ === Mode.dsMode) {
      this.currentMode_ = Mode.dsiMode;
    }
    if (this.markedSectionSpecialLevel_) {
      this.markedSectionSpecialLevel_++;
    }
  }

  startSpecialMarkedSection(mode: Mode, loc: Location): void {
    this.markedSectionLevel_++;
    this.markedSectionStartLocation_.push_back(loc);
    this.specialParseInputLevel_ = this.inputLevel_;
    this.markedSectionSpecialLevel_ = 1;
    this.specialParseMode_ = this.currentMode_ = mode;
  }

  endMarkedSection(): void {
    ASSERT(this.markedSectionLevel_ > 0);
    this.markedSectionLevel_--;
    this.markedSectionStartLocation_.resize(this.markedSectionStartLocation_.size() - 1);

    if (this.markedSectionSpecialLevel_ > 0) {
      this.markedSectionSpecialLevel_--;
      if (this.markedSectionSpecialLevel_ > 0) {
        return;
      }
      this.specialParseInputLevel_ = 0;
      if (this.inInstance_) {
        this.currentMode_ = this.contentMode();
      } else {
        this.currentMode_ = Mode.dsiMode;
      }
    }

    if (this.currentMode_ === Mode.dsiMode &&
        this.inputLevel_ === 1 &&
        this.markedSectionLevel_ === 0) {
      this.currentMode_ = Mode.dsMode;
    }
  }

  pushElement(e: OpenElement): void {
    super.pushElement(e);
    this.pcdataRecovering_ = false;

    if (this.markedSectionSpecialLevel_ === 0) {
      this.currentMode_ = this.contentMode();
      if (e.requiresSpecialParse()) {
        this.specialParseMode_ = this.currentMode_;
        this.specialParseInputLevel_ = this.inputLevel_;
      }
    }
  }

  pcdataRecover(): void {
    switch (this.currentMode_) {
      case Mode.econMode:
        this.currentMode_ = Mode.mconMode;
        break;
      case Mode.econnetMode:
        this.currentMode_ = Mode.mconnetMode;
        break;
      default:
        break;
    }
    this.pcdataRecovering_ = true;
  }

  popSaveElement(): OpenElement | null {
    const e = super.popSaveElement();

    if (this.markedSectionSpecialLevel_ === 0) {
      this.currentMode_ = this.contentMode();
      this.specialParseInputLevel_ = 0;
    }
    this.pcdataRecovering_ = false;
    return e;
  }

  popElement(): void {
    const e = this.popSaveElement();
    // Delete element (JS GC will handle it)
  }

  entityIsOpen(entityDecl: EntityDecl | null): Boolean {
    const iter = new IListIter<InputSource>(this.inputStack_);
    while (!iter.done()) {
      const cur = iter.cur();
      const originPtr = cur?.currentLocation().origin();
      if (cur && originPtr && originPtr.pointer()?.entityDecl() === entityDecl) {
        return true;
      }
      iter.next();
    }
    return false;
  }

  startInstance(): void {
    if (!this.instanceSyntax_.isNull()) {
      this.syntax_ = this.instanceSyntax_;
    }
    this.currentMode_ = Mode.econMode;

    this.currentDtd_.clear();
    for (let i = 0; i < this.dtd_.size(); i++) {
      const dtdPtr = this.dtd_[i].pointer();
      if (dtdPtr && this.shouldActivateLink(dtdPtr.name())) {
        if (this.nActiveLink() > 0) {
          this.message(ParserMessages.activeDocLink);
          break;
        } else if (!this.currentDtd_.isNull()) {
          this.message(ParserMessages.sorryActiveDoctypes);
          break;
        } else {
          this.currentDtd_ = this.dtd_[i];
        }
      }
    }

    if (this.currentDtd_.isNull()) {
      this.currentDtd_ = this.dtd_[0];
    }
    this.currentDtdConst_ = this.currentDtd_.asConst();

    this.startContent(this.currentDtd());
    this.inInstance_ = true;

    const sdPtr = this.sdPointer().pointer();
    if (sdPtr && sdPtr.rank()) {
      this.currentRank_.assign(this.currentDtd().nRankStem(), new String<Char>());
    }

    this.currentAttributes_.clear();
    this.currentAttributes_.resize(this.currentDtd().nCurrentAttribute());
    this.idTable_.clear();
  }

  private lookupCreateId(name: StringC): Id {
    let id = this.idTable_.lookup(name);
    if (!id) {
      id = new Id(name);
      this.idTable_.insert(id);
    }
    return id;
  }

  lookupEntity(
    isParameter: Boolean,
    name: StringC,
    useLocation: Location,
    referenced: Boolean
  ): ConstPtr<Entity> {
    // This is a very complex method - implementing the full logic
    let dtd: Dtd | null;
    if (this.resultAttributeSpecMode_) {
      dtd = this.defComplexLpd().resultDtd().pointer();
    } else {
      dtd = this.currentDtd_.pointer();
    }

    if (dtd) {
      let entity = dtd.lookupEntity(isParameter, name);

      // Complex pass1/pass2 logic omitted for brevity - would need full implementation
      // ... (see C++ code lines 500-577)

      if (entity && !entity.isNull()) {
        const entityPtr = entity.pointer();
        if (entityPtr) {
          entityPtr.setUsed();
          this.eventHandler().entityDefaulted(
            new EntityDefaultedEvent(entity.asConst(), useLocation)
          );
        }
        return entity.asConst();
      }

      if (!isParameter) {
        let entity = dtd.defaultEntity();
        // ... default entity logic
        return entity || this.undefinedEntityTable_.lookupConst(name);
      }
    }

    return new ConstPtr<Entity>();
  }

  createUndefinedEntity(name: StringC, loc: Location): ConstPtr<Entity> {
    const extid = new ExternalId();
    const entity = new Ptr<Entity>(
      new ExternalTextEntity(name, EntityDecl.DeclType.generalEntity, loc, extid)
    );
    this.undefinedEntityTable_.insert(entity);
    const entityPtr = entity.pointer();
    if (entityPtr) {
      entityPtr.generateSystemId(this);
    }
    return entity.asConst();
  }

  noteReferencedEntity(
    entity: ConstPtr<Entity>,
    foundInPass1Dtd: Boolean,
    lookedAtDefault: Boolean
  ): void {
    const ref = new LpdEntityRef();
    ref.entity = entity;
    ref.lookedAtDefault = lookedAtDefault;
    ref.foundInPass1Dtd = foundInPass1Dtd;
    const old = this.lpdEntityRefs_.lookup(ref);
    if (!old) {
      this.lpdEntityRefs_.insert(ref);
    }
  }

  checkEntityStability(): void {
    const iter = new OwnerTableIter(this.lpdEntityRefs_) as any;
    let ref: LpdEntityRef | null;
    while ((ref = iter.next()) !== null) {
      // Entity stability checking logic
      // ... (see C++ code lines 647-672)
    }
    // Clear the refs
    const tem = new OwnerTable(
      LpdEntityRef.hash as any,
      LpdEntityRef.key as any
    ) as any;
    this.lpdEntityRefs_.swap(tem);
  }

  appendCurrentRank(str: StringC, stem: RankStem | null): Boolean {
    if (!stem) return false;
    const suffix = this.currentRank_[stem.index()];
    if (suffix.size() > 0) {
      // StringC.append needs array and length
      if (suffix.data()) {
        str.append(suffix.data()!, suffix.size());
      }
      return true;
    }
    return false;
  }

  setCurrentRank(stem: RankStem | null, suffix: StringC): void {
    if (stem) {
      this.currentRank_[stem.index()] = suffix;
    }
  }

  getCurrentToken(arg1: StringC | SubstTable | null, arg2?: StringC): void {
    if (arg2 !== undefined && arg1 instanceof SubstTable) {
      // getCurrentToken(const SubstTable *, StringC &) version
      const subst = arg1;
      const str = arg2;
      const input = this.currentInput();
      if (!input) return;
      const p = input.currentTokenStart();
      let count = input.currentTokenLength();
      str.resize(count);
      const strData = str.data();
      if (strData && p) {
        for (let i = 0; i < count; i++) {
          strData[i] = subst.get(p[i]);
        }
      }
    } else if (arg1 instanceof String) {
      // getCurrentToken(StringC &) version
      const str = arg1;
      const input = this.currentInput();
      if (input) {
        str.assign(input.currentTokenStart(), input.currentTokenLength());
      }
    }
  }

  private queueMessage(event: MessageEvent | null): void {
    if (this.cancelled()) {
      // Delete event (JS GC will handle it)
      return;
    }
    if (this.keepingMessages_ && event) {
      this.keptMessages_.append(event);
    } else if (event) {
      this.handler_.message(event);
    }
  }

  releaseKeptMessages(): void {
    this.keepingMessages_ = false;
    while (!this.keptMessages_.empty()) {
      if (this.cancelled()) {
        this.allDone();
        return;
      }
      this.handler_.message(this.keptMessages_.get());
    }
  }

  discardKeptMessages(): void {
    this.keepingMessages_ = false;
    this.keptMessages_.clear();
  }

  private initMessage(msg: Message): void {
    if (this.inInstance()) {
      let rniPcdata = this.syntax().delimGeneral(Syntax.DelimGeneral.dRNI);
      rniPcdata.appendString(this.syntax().reservedName(Syntax.ReservedName.rPCDATA));
      this.getOpenElementInfo(msg.openElementInfo, rniPcdata);
    }
    msg.loc = this.currentLocation();
  }

  dispatchMessage(msg: Message): void {
    this.queueMessage(new MessageEvent(msg));
  }

  allocAttributeList(
    def: ConstPtr<AttributeDefinitionList>,
    i: number
  ): AttributeList | null {
    if (i < this.attributeLists_.size()) {
      const attrList = this.attributeLists_[i].pointer();
      if (attrList) {
        attrList.init(def);
      }
      return attrList;
    } else {
      this.attributeLists_.resize(i + 1);
      this.attributeLists_[i] = new Owner<AttributeList>(new AttributeList());
      return this.attributeLists_[i].pointer();
    }
  }

  activateLinkType(name: StringC): void {
    if (!this.hadPass2Start_ && !this.pass2_) {
      this.activeLinkTypes_.push_back(name);
    } else {
      this.message(ParserMessages.linkActivateTooLate);
    }
  }

  shouldActivateLink(name: StringC): Boolean {
    if (!this.activeLinkTypesSubsted_) {
      for (let i = 0; i < this.activeLinkTypes_.size(); i++) {
        const substTable = this.syntax().generalSubstTable();
        if (substTable) {
          substTable.subst(this.activeLinkTypes_[i]);
        }
      }
      this.activeLinkTypesSubsted_ = true;
    }
    for (let i = 0; i < this.activeLinkTypes_.size(); i++) {
      if (name.equals(this.activeLinkTypes_[i])) {
        return true;
      }
    }
    return false;
  }

  lookupDtd(name: StringC): Ptr<Dtd> {
    for (let i = 0; i < this.dtd_.size(); i++) {
      const dtdPtr = this.dtd_[i].pointer();
      if (dtdPtr && dtdPtr.name().equals(name)) {
        return this.dtd_[i];
      }
    }
    return new Ptr<Dtd>();
  }

  lookupLpd(name: StringC): ConstPtr<Lpd> {
    for (let i = 0; i < this.allLpd_.size(); i++) {
      const lpdPtr = this.allLpd_[i].pointer();
      if (lpdPtr && lpdPtr.name().equals(name)) {
        return this.allLpd_[i];
      }
    }
    return new ConstPtr<Lpd>();
  }

  getAttributeNotation(name: StringC, loc: Location): ConstPtr<Notation> {
    let notation = new ConstPtr<Notation>();
    if (this.haveCurrentDtd()) {
      const notationPtr = this.currentDtd().lookupNotation(name);
      notation = notationPtr.asConst();
      const sdPtr = this.sdPointer().pointer();
      if (notation.isNull() && sdPtr && sdPtr.implydefNotation()) {
        const nt = new Ptr<Notation>(
          new Notation(name, this.currentDtd().namePointer(), this.currentDtd().isBase())
        );
        const ntPtr = nt.pointer();
        if (ntPtr) {
          const id = new ExternalId();
          ntPtr.setExternalId(id, new Location());
          ntPtr.generateSystemId(this);
          ntPtr.setAttributeDef(this.currentDtdNonConst().implicitNotationAttributeDef());
          this.currentDtdNonConst().insertNotation(nt);
          const notationPtr2 = this.currentDtd().lookupNotation(name);
          notation = notationPtr2.asConst();
        }
      }
    } else if (this.resultAttributeSpecMode_) {
      const resultDtd = this.defComplexLpd().resultDtd().pointer();
      if (resultDtd) {
        const notationPtr3 = resultDtd.lookupNotation(name);
        notation = notationPtr3.asConst();
      }
    }
    return notation;
  }

  getAttributeEntity(str: StringC, loc: Location): ConstPtr<Entity> {
    const entity = this.lookupEntity(false, str, loc, false);
    const entityPtr = entity.pointer();
    if (entityPtr && entityPtr.defaulted() && this.options().warnDefaultEntityReference) {
      this.setNextLocation(loc);
      this.message(ParserMessages.defaultEntityInAttribute, new StringMessageArg(str));
    }
    return entity;
  }

  defineId(str: StringC, loc: Location, prevLoc: Location): Boolean {
    if (!this.inInstance() || !this.validate()) {
      return true;
    }
    const id = this.lookupCreateId(str);
    if (id.defined()) {
      // prevLoc = id.defLocation(); // Assignment to reference - need to handle differently
      return false;
    }
    id.define(loc);
    return true;
  }

  noteIdref(str: StringC, loc: Location): void {
    if (!this.inInstance() || !this.options().errorIdref || !this.validate()) {
      return;
    }
    const id = this.lookupCreateId(str);
    if (!id.defined()) {
      id.addPendingRef(loc);
    }
  }

  noteCurrentAttribute(i: number, value: AttributeValue | null): void {
    if (this.inInstance()) {
      this.currentAttributes_[i] = new ConstPtr<AttributeValue>(value);
    }
  }

  getCurrentAttribute(i: number): ConstPtr<AttributeValue> {
    if (!this.inInstance()) {
      return new ConstPtr<AttributeValue>();
    }
    return this.currentAttributes_[i];
  }

  attributeSyntax(): Syntax {
    return this.syntax();
  }

  instantiateDtd(dtd: Ptr<Dtd>): number {
    const dtdPtr = dtd.pointer();
    if (dtdPtr && !dtdPtr.isInstantiated()) {
      dtdPtr.instantiate();
      const sdPtr = this.sdPointer().pointer();
      if (this.instantiatedDtds_ === sdPtr?.concur()) {
        this.message(
          ParserMessages.concurrentInstances,
          new NumberMessageArg(sdPtr.concur())
        );
      }
      this.instantiatedDtds_++;
    }
    return this.instantiatedDtds_;
  }

  // Inline methods from header

  messenger(): Messenger {
    return this as any as Messenger;
  }

  // Messenger methods
  setNextLocation(loc: Location): void {
    this.haveNextLocation_ = true;
    this.nextLocation_ = loc;
  }

  private doInitMessage(msg: Message): void {
    this.initMessage(msg);
    if (this.haveNextLocation_) {
      msg.loc = this.nextLocation_;
      this.haveNextLocation_ = false;
    }
  }

  message(...args: any[]): void {
    // Stub - should properly dispatch messages
    console.warn('ParserState.message() stub called');
  }

  validate(): Boolean {
    // Stub - from ContentState
    return this.validate_ || false;
  }

  private validate_: Boolean = false;
  private mayDefaultAttribute_: Boolean = false;

  wantMarkup(): Boolean {
    return this.inInstance_
      ? this.options_.eventsWanted.wantInstanceMarkup()
      : this.options_.eventsWanted.wantPrologMarkup();
  }

  eventsWanted(): EventsWanted {
    return this.options_.eventsWanted;
  }

  currentInput(): InputSource | null {
    return this.inputStack_.head();
  }

  currentLocation(): Location {
    const input = this.currentInput();
    return input ? input.currentLocation() : ParserState.nullLocation_;
  }

  pcdataRecovering(): Boolean {
    return this.pcdataRecovering_;
  }

  inputLevel(): number {
    return this.inputLevel_;
  }

  specialParseInputLevel(): number {
    return this.specialParseInputLevel_;
  }

  markedSectionLevel(): number {
    return this.markedSectionLevel_;
  }

  markedSectionSpecialLevel(): number {
    return this.markedSectionSpecialLevel_;
  }

  currentMarkedSectionStartLocation(): Location {
    return this.markedSectionStartLocation_.back();
  }

  currentInputElementIndex(): number {
    return this.inputLevelElementIndex_.back();
  }

  currentChar(): Char {
    const input = this.currentInput();
    return input ? input.currentTokenStart()[0] : 0;
  }

  currentToken(): StringC {
    const input = this.currentInput();
    if (!input) return new String<Char>();
    return new String<Char>(input.currentTokenStart(), input.currentTokenLength());
  }

  setRecognizer(mode: Mode, p: ConstPtr<Recognizer>): void {
    this.recognizers_[mode] = p;
  }

  setNormalMap(map: XcharMap<PackedBoolean>): void {
    this.normalMap_ = map;
  }

  normalMap(): XcharMap<PackedBoolean> {
    return this.normalMap_;
  }

  haveDefLpd(): Boolean {
    return !this.defLpd_.isNull();
  }

  haveCurrentDtd(): Boolean {
    return !this.currentDtd_.isNull();
  }

  defDtd(): Dtd {
    const dtd = this.defDtd_.pointer();
    if (!dtd) throw new Error('defDtd is null');
    return dtd;
  }

  currentDtd(): Dtd {
    const dtd = this.currentDtd_.pointer();
    if (!dtd) throw new Error('currentDtd is null');
    return dtd;
  }

  currentDtdNonConst(): Dtd {
    const dtd = this.currentDtd_.pointer();
    if (!dtd) throw new Error('currentDtd is null');
    return dtd;
  }

  defDtdPointer(): Ptr<Dtd> {
    return this.defDtd_;
  }

  currentDtdPointer(): ConstPtr<Dtd> {
    return this.currentDtdConst_;
  }

  inInstance(): Boolean {
    return this.inInstance_;
  }

  syntax(): Syntax {
    const syn = this.syntax_.pointer();
    if (!syn) throw new Error('syntax is null');
    return syn;
  }

  instanceSyntax(): Syntax {
    const syn = this.instanceSyntax_.pointer();
    if (!syn) throw new Error('instanceSyntax is null');
    return syn;
  }

  syntaxPointer(): ConstPtr<Syntax> {
    return this.syntax_;
  }

  instanceSyntaxPointer(): ConstPtr<Syntax> {
    return this.instanceSyntax_;
  }

  prologSyntaxPointer(): ConstPtr<Syntax> {
    return this.prologSyntax_;
  }

  sd(): Sd {
    const sdPtr = this.sd_.pointer();
    if (!sdPtr) throw new Error('sd is null');
    return sdPtr;
  }

  sdPointer(): ConstPtr<Sd> {
    return this.sd_;
  }

  setPhase(phase: Phase): void {
    this.phase_ = phase;
  }

  currentMode(): Mode {
    return this.currentMode_;
  }

  getChar(): Xchar {
    const head = this.inputStack_.head();
    return head ? head.get(this.messenger()) : 0;
  }

  skipChar(): void {
    this.getChar();
  }

  getToken(mode: Mode): Token {
    const recognizer = this.recognizers_[mode];
    const head = this.inputStack_.head();
    return recognizer && head ? recognizer.pointer()?.recognize(head, this.messenger()) || 0 : 0;
  }

  hadDtd(): Boolean {
    return this.dtd_.size() > 0;
  }

  eventQueueEmpty(): Boolean {
    return this.eventQueue_.empty();
  }

  eventQueueGet(): Event | null {
    return this.eventQueue_.get();
  }

  phase(): Phase {
    return this.phase_;
  }

  finalPhase(): Phase {
    return this.finalPhase_;
  }

  entityManager(): EntityManager {
    const em = this.entityManager_.pointer();
    if (!em) throw new Error('entityManager is null');
    return em;
  }

  entityManagerPtr(): Ptr<EntityManager> {
    return this.entityManager_;
  }

  entityCatalog(): EntityCatalog {
    const cat = this.entityCatalog_.pointer();
    if (!cat) throw new Error('entityCatalog is null');
    return cat;
  }

  entityCatalogPtr(): ConstPtr<EntityCatalog> {
    return this.entityCatalog_;
  }

  setEntityCatalog(catalog: ConstPtr<EntityCatalog>): void {
    this.entityCatalog_ = catalog;
  }

  setDsEntity(entity: ConstPtr<Entity>): void {
    this.dsEntity_ = entity;
  }

  eventAllocator(): Allocator {
    return this.eventAllocator_;
  }

  internalAllocator(): Allocator {
    return this.internalAllocator_;
  }

  nameBuffer(): StringC {
    return this.nameBuffer_;
  }

  setHandler(handler: any, cancelPtr: number | null): void {
    this.handler_ = handler;
    this.cancelPtr_ = cancelPtr !== null ? cancelPtr : 0;
  }

  unsetHandler(): void {
    this.handler_ = this.eventQueue_;
    this.cancelPtr_ = 0;
  }

  queueRe(location: Location): void {
    this.outputState_.handleRe(
      this.handler_,
      this.eventAllocator_,
      this.options_.eventsWanted,
      this.syntax().standardFunction(Syntax.StandardFunction.fRE),
      location
    );
  }

  noteMarkup(): void {
    if (this.inInstance_) {
      this.outputState_.noteMarkup(
        this.handler_,
        this.eventAllocator_,
        this.options_.eventsWanted
      );
    }
  }

  noteRs(): void {
    this.outputState_.noteRs(
      this.handler_,
      this.eventAllocator_,
      this.options_.eventsWanted
    );
  }

  noteStartElement(included: Boolean): void {
    this.outputState_.noteStartElement(
      included,
      this.handler_,
      this.eventAllocator_,
      this.options_.eventsWanted
    );
  }

  noteEndElement(included: Boolean): void {
    this.outputState_.noteEndElement(
      included,
      this.handler_,
      this.eventAllocator_,
      this.options_.eventsWanted
    );
  }

  noteData(): void {
    this.outputState_.noteData(
      this.handler_,
      this.eventAllocator_,
      this.options_.eventsWanted
    );
  }

  subdocLevel(): number {
    return this.subdocLevel_;
  }

  eventHandler(): any {
    return this.handler_;
  }

  idTableIter(): NamedTableIter<Id> {
    return new NamedTableIter<Id>(this.idTable_);
  }

  options(): ParserOptions {
    return this.options_;
  }

  implydefElement(): number {
    return this.implydefElement_;
  }

  implydefAttlist(): Boolean {
    return this.implydefAttlist_;
  }

  enableImplydef(): void {
    this.implydefElement_ = Sd.ImplydefElement.implydefElementYes;
    this.implydefAttlist_ = true;
  }

  keepMessages(): void {
    this.keepingMessages_ = true;
  }

  haveApplicableDtd(): Boolean {
    return !this.currentDtd_.isNull();
  }

  hadLpd(): Boolean {
    return this.hadLpd_;
  }

  pass2(): Boolean {
    return this.pass2_;
  }

  nActiveLink(): number {
    return this.lpd_.size();
  }

  activeLpd(i: number): Lpd {
    const lpd = this.lpd_[i].pointer();
    if (!lpd) throw new Error('activeLpd is null');
    return lpd;
  }

  defLpd(): Lpd {
    const lpd = this.defLpd_.pointer();
    if (!lpd) throw new Error('defLpd is null');
    return lpd;
  }

  defLpdPointer(): Ptr<Lpd> {
    return this.defLpd_;
  }

  defComplexLpdPointer(): Ptr<ComplexLpd> {
    return this.defLpd_ as any as Ptr<ComplexLpd>; // Type cast
  }

  defComplexLpd(): ComplexLpd {
    return this.defLpd() as any as ComplexLpd; // Type cast
  }

  baseDtd(): Ptr<Dtd> {
    if (this.dtd_.size() > 0) {
      return this.dtd_[0];
    } else {
      return new Ptr<Dtd>();
    }
  }

  setResultAttributeSpecMode(): void {
    this.resultAttributeSpecMode_ = true;
  }

  clearResultAttributeSpecMode(): void {
    this.resultAttributeSpecMode_ = false;
  }

  currentMarkup(): Markup | null {
    return this.currentMarkup_;
  }

  markupLocation(): Location {
    return this.markupLocation_;
  }

  startMarkup(storing: Boolean, loc: Location): Markup | null {
    this.markupLocation_ = loc;
    if (storing) {
      this.markup_.clear();
      return this.currentMarkup_ = this.markup_;
    } else {
      return this.currentMarkup_ = null;
    }
  }

  cancelled(): Boolean {
    return this.cancelPtr_ !== 0;
  }

  setHadAfdrDecl(): void {
    this.hadAfdrDecl_ = true;
  }

  hadAfdrDecl(): Boolean {
    return this.hadAfdrDecl_;
  }

  dsEntity(): ConstPtr<Entity> {
    return this.dsEntity_;
  }

  static freeEvent(ptr: any): void {
    // Static method for freeing events - handled by GC in TypeScript
  }

  // Parsing phase methods - to be implemented from parse*.cxx files
  protected doInit(): void {
    // Minimal implementation of doInit() - implies SGML declaration
    // Full implementation from parseSd.cxx includes:
    // - scanForSgmlDecl() to detect explicit SGML declaration
    // - parseSgmlDecl() to parse explicit declaration
    // - findMissingMinimum() to check character set completeness
    // For now, we just imply a standard SGML declaration

    if (this.cancelled()) {
      this.allDone();
      return;
    }

    // Check if document entity exists
    const input = this.currentInput();
    if (input) {
      const c = input.get(this);
      if (c === -1) { // InputSource.eE
        if (input.accessError()) {
          this.allDone();
          return;
        }
      } else {
        input.ungetToken();
      }
    }

    // For now: always imply SGML declaration (skip explicit parsing)
    // TODO: Implement full parseSgmlDecl() and scanForSgmlDecl()
    if (!this.implySgmlDecl()) {
      this.giveUp();
      return;
    }

    // Mark that document charset won't be changed
    if (input) {
      input.willNotSetDocCharset();
    }

    // TODO: Queue an SGML declaration event

    // Proceed to prolog phase
    this.compilePrologModes();
    this.setPhase(Phase.prologPhase);
  }

  private implySgmlDecl(): boolean {
    // Simplified version of implySgmlDecl() from parseSd.cxx
    // Full implementation would set up Syntax with proper character sets,
    // delimiters, quantities, etc.
    // For now, assume syntax is already set up
    // TODO: Port full implySgmlDecl() implementation
    return true;
  }

  protected giveUp(): void {
    if (this.subdocLevel() > 0) {
      // FIXME might be subdoc if level == 0
      this.message(ParserMessages.subdocGiveUp);
    } else {
      this.message(ParserMessages.giveUp);
    }
    this.allDone();
  }

  protected doProlog(): void {
    // Minimal implementation of doProlog() from parseDecl.cxx
    // Full implementation processes prolog markup declarations:
    // - DOCTYPE declarations (parseDoctypeDeclStart)
    // - LINKTYPE declarations (parseLinktypeDeclStart)
    // - Processing instructions (parseProcessingInstruction)
    // - Comments (parseCommentDecl)
    // - Whitespace (extendS)

    // For now: skip prolog processing and move directly to instance
    // This assumes no DTD is explicitly declared (will be implied)

    if (this.cancelled()) {
      this.allDone();
      return;
    }

    // Check if we have input
    const input = this.currentInput();
    if (!input) {
      this.allDone();
      return;
    }

    // TODO: Implement full prolog token processing loop
    // For now, just transition to instance start
    // This will fail on real documents but allows the structure to work

    this.endProlog();
  }

  private endProlog(): void {
    // Simplified endProlog() from parseDecl.cxx
    // Full version checks DTD, activates link types, compiles modes, etc.

    // TODO: Check DTD validity
    // TODO: Activate link types
    // TODO: Check ID references

    // Compile instance modes (needed for content parsing)
    this.compileInstanceModes();

    // Queue end prolog event
    // TODO: eventHandler().endProlog(...)

    // Move to instance start phase
    this.setPhase(Phase.instanceStartPhase);
  }

  protected doDeclSubset(): void {
    // TODO: Port from parseDeclSubset section in parse*.cxx
    throw new Error('doDeclSubset not yet implemented');
  }

  protected doInstanceStart(): void {
    // Minimal implementation of doInstanceStart() from parseInstance.cxx
    // Full version checks for valid DTD, handles omitted tags, queues events

    if (this.cancelled()) {
      this.allDone();
      return;
    }

    // Compile instance modes if not already done
    this.compileInstanceModes();

    // Move to content phase
    this.setPhase(Phase.contentPhase);

    // TODO: Handle omitted start tags (tryImplyTag)
    // TODO: Process initial token (getToken, ungetToken)
    // For now, just move to content phase
  }

  protected doContent(): void {
    // Minimal implementation of doContent() from parseInstance.cxx
    // Full version is a complex token-processing loop handling:
    // - Entity references (tokenEro*)
    // - Character references (tokenCro*, tokenHcro*)
    // - Start tags (tokenStago*)
    // - End tags (tokenEtago*)
    // - Processing instructions (tokenPio)
    // - Comments (tokenMdo*)
    // - Marked sections (tokenMdoDso, tokenMscMdc)
    // - Character data (tokenChar, tokenRe, tokenRs, tokenS)
    // - Entity boundaries (tokenEe)

    if (this.cancelled()) {
      this.allDone();
      return;
    }

    // For now: immediately end the instance
    // A real implementation would loop calling getToken(currentMode())
    // and dispatching on token types

    // TODO: Implement full content parsing loop
    // TODO: Parse start tags (parseStartTag)
    // TODO: Parse end tags (parseEndTag)
    // TODO: Parse character data (acceptPcdata)
    // TODO: Parse entity references (parseEntityReference)
    // TODO: Parse processing instructions (parseProcessingInstruction)

    // Check if at document entity end
    if (this.inputLevel() === 1) {
      this.endInstance();
      return;
    }

    // Otherwise continue (in a real implementation, this would loop)
    this.allDone();
  }

  private endInstance(): void {
    // Simplified endInstance() from parseInstance.cxx

    // TODO: endAllElements()
    // TODO: Check unclosed marked sections
    // TODO: checkIdrefs()

    // Pop the document entity from the input stack
    this.popInputStack();

    // Done parsing
    this.allDone();
  }

  protected compilePrologModes(): void {
    // TODO: Port from Parser compilation methods
    throw new Error('compilePrologModes not yet implemented');
  }

  protected compileInstanceModes(): void {
    // TODO: Port from Parser compilation methods
    throw new Error('compileInstanceModes not yet implemented');
  }

  protected compileSdModes(): void {
    // TODO: Port from Parser compilation methods
    throw new Error('compileSdModes not yet implemented');
  }
}
