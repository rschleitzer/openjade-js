// Copyright (c) 1994 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Allocator } from './Allocator';
import { AttributeList, AttributeValue, AttributeDefinitionList, AttributeContext } from './Attribute';
import { Boolean, PackedBoolean } from './Boolean';
import { Vector } from './Vector';
import { StringC } from './StringC';
import { String } from './StringOf';
import { Dtd } from './Dtd';
import { Entity, InternalEntity, ExternalEntity, InternalTextEntity, PredefinedEntity, IgnoredEntity } from './Entity';
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
import { Location, ReplacementOrigin } from './Location';
import { Message, Messenger } from './Message';
import { StringMessageArg, NumberMessageArg, TokenMessageArg } from './MessageArg';
import { Mode, nModes } from './Mode';
import { Token as TokenEnum } from './Token';
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
import { RankStem, ElementType } from './ElementType';
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

  // Inherited from ContentState - no need to override
  // afterDocumentElement() is already available

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
    // Port of doInstanceStart from parseInstance.cxx (lines 16-54)
    if (this.cancelled()) {
      this.allDone();
      return;
    }

    // TODO: Check that we have a valid DTD
    this.compileInstanceModes();
    this.setPhase(Phase.contentPhase);

    const token = this.getToken(this.currentMode());
    switch (token) {
      case TokenEnum.tokenEe:
      case TokenEnum.tokenStagoNameStart:
      case TokenEnum.tokenStagoTagc:
      case TokenEnum.tokenStagoGrpo:
      case TokenEnum.tokenEtagoNameStart:
      case TokenEnum.tokenEtagoTagc:
      case TokenEnum.tokenEtagoGrpo:
        // These tokens are valid start tokens, continue
        break;

      default:
        if (this.sd().omittag()) {
          // TODO: Implement tryImplyTag and queueElementEvents
          // let startImpliedCount = 0;
          // let attributeListIndex = 0;
          // const undoList = new IList<Undo>();
          // const eventList = new IList<Event>();
          // if (!this.tryImplyTag(this.currentLocation(), startImpliedCount, attributeListIndex, undoList, eventList)) {
          //   CANNOT_HAPPEN();
          // }
          // this.queueElementEvents(eventList);
        } else {
          // TODO: Add instanceStartOmittag message
          // this.message(ParserMessages.instanceStartOmittag);
        }
        break;
    }

    const input = this.currentInput();
    if (input) {
      input.ungetToken();
    }
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

    // Port of full doContent() from parseInstance.cxx (lines 82-300)
    do {
      if (this.cancelled()) {
        this.allDone();
        return;
      }

      const token = this.getToken(this.currentMode());

      switch (token) {
        case TokenEnum.tokenEe:
          // Entity end
          if (this.inputLevel() === 1) {
            this.endInstance();
            return;
          }
          // TODO: Check specialParseInputLevel()
          // TODO: Fire entityEnd event if eventsWanted().wantInstanceMarkup()
          if (this.afterDocumentElement()) {
            this.message(ParserMessages.afterDocumentElementEntityEnd);
          }
          if (this.sd().integrallyStored() &&
              this.tagLevel() &&
              this.currentElement().index() !== this.currentInputElementIndex()) {
            this.message(ParserMessages.contentAsyncEntityRef);
          }
          this.popInputStack();
          break;

        case TokenEnum.tokenCroDigit:
        case TokenEnum.tokenHcroHexDigit:
          // Numeric character reference
          {
            if (this.afterDocumentElement()) {
              this.message(ParserMessages.characterReferenceAfterDocumentElement);
            }
            const result = this.parseNumericCharRef(token === TokenEnum.tokenHcroHexDigit);
            if (result.valid && result.char !== undefined && result.location) {
              // TODO: acceptPcdata(result.location)
              this.noteData();
              const translateResult = this.translateNumericCharRef(result.char);
              if (translateResult.valid && translateResult.char !== undefined) {
                // TODO: Fire data event or nonSgmlChar event based on isSgmlChar
                // if (translateResult.isSgmlChar) {
                //   eventHandler().data(new ImmediateDataEvent(...))
                // } else {
                //   eventHandler().nonSgmlChar(new NonSgmlCharEvent(...))
                // }
              }
            }
          }
          break;

        case TokenEnum.tokenCroNameStart:
          // Named character reference
          if (this.afterDocumentElement()) {
            this.message(ParserMessages.characterReferenceAfterDocumentElement);
          }
          this.parseNamedCharRef();
          break;

        case TokenEnum.tokenEroGrpo:
        case TokenEnum.tokenEroNameStart:
          // Entity reference
          {
            if (this.afterDocumentElement()) {
              this.message(ParserMessages.entityReferenceAfterDocumentElement);
            }
            const result = this.parseEntityReference(false, token === TokenEnum.tokenEroGrpo ? 1 : 0);
            if (result.valid && result.entity && !result.entity.isNull() && result.origin) {
              const entity = result.entity.pointer()!;
              if (entity.isCharacterData()) {
                this.acceptPcdata(new Location(result.origin.pointer(), 0));
              }
              entity.contentReference(this, result.origin);
            }
          }
          break;

        case TokenEnum.tokenEtagoNameStart:
          // End tag
          {
            const event = this.parseEndTag();
            this.acceptEndTag(event);
          }
          break;

        case TokenEnum.tokenEtagoTagc:
          // Empty end tag
          this.parseEmptyEndTag();
          break;

        case TokenEnum.tokenEtagoGrpo:
          // Group end tag
          this.parseGroupEndTag();
          break;

        case TokenEnum.tokenStagoNameStart:
          // Start tag
          this.parseStartTag();
          break;

        case TokenEnum.tokenStagoTagc:
          // Empty start tag
          this.parseEmptyStartTag();
          break;

        case TokenEnum.tokenStagoGrpo:
          // Group start tag
          this.parseGroupStartTag();
          break;

        case TokenEnum.tokenMdoNameStart:
          // Declaration (DOCTYPE, USEMAP, USELINK, etc.)
          {
            const markup = this.startMarkup(this.eventsWanted().wantInstanceMarkup(), this.currentLocation());
            if (markup) {
              markup.addDelim(Syntax.DelimGeneral.dMDO);
            }

            const startLevel = this.inputLevel();
            const result = this.parseDeclarationName();

            if (result.valid) {
              // TODO: Handle different declaration types based on result.name
              // - Syntax.rUSEMAP: parseUsemapDecl()
              // - Syntax.rUSELINK: parseUselinkDecl()
              // - Syntax.rDOCTYPE, rELEMENT, rATTLIST, etc.: error in instance
              // - default: noSuchDeclarationType error
            } else {
              this.skipDeclaration(startLevel);
            }

            this.noteMarkup();
          }
          break;

        case TokenEnum.tokenMdoMdc:
          // Empty comment
          this.emptyCommentDecl();
          this.noteMarkup();
          break;

        case TokenEnum.tokenMdoCom:
          // Comment declaration
          this.parseCommentDecl();
          this.noteMarkup();
          break;

        case TokenEnum.tokenMdoDso:
          // Marked section start
          if (this.afterDocumentElement()) {
            this.message(ParserMessages.markedSectionAfterDocumentElement);
          }
          this.parseMarkedSectionDeclStart();
          this.noteMarkup();
          break;

        case TokenEnum.tokenMscMdc:
          // Marked section end
          this.handleMarkedSectionEnd();
          this.noteMarkup();
          break;

        case TokenEnum.tokenNet:
          // Null end tag
          this.parseNullEndTag();
          break;

        case TokenEnum.tokenPio:
          // Processing instruction
          this.parseProcessingInstruction();
          break;

        case TokenEnum.tokenRe:
          // Record end
          // TODO: acceptPcdata(currentLocation())
          this.queueRe(this.currentLocation());
          break;

        case TokenEnum.tokenRs:
          // Record start
          // TODO: acceptPcdata(currentLocation())
          this.noteRs();
          // TODO: Fire ignoredRs event if eventsWanted().wantInstanceMarkup()
          break;

        case TokenEnum.tokenS:
          // Separator (whitespace)
          this.extendContentS();
          // TODO: Fire sSep event if eventsWanted().wantInstanceMarkup()
          break;

        case TokenEnum.tokenIgnoredChar:
          // Character in ignored marked section
          this.extendData();
          // TODO: Fire ignoredChars event if eventsWanted().wantMarkedSections()
          break;

        case TokenEnum.tokenUnrecognized:
          // Non-SGML character
          this.reportNonSgmlCharacter();
          this.parsePcdata();
          break;

        case TokenEnum.tokenCharDelim:
          // Data character that starts a delimiter
          // Port of tokenCharDelim case from parseInstance.cxx lines 285-287
          {
            const input = this.currentInput();
            if (input) {
              const start = input.currentTokenStart();
              const len = input.currentTokenLength();
              const str = new String<Char>(start, len);
              this.message(ParserMessages.dataCharDelim, new StringMessageArg(str));
            }
          }
          // Fall through to tokenChar
          this.parsePcdata();
          break;

        case TokenEnum.tokenChar:
          // Regular character data
          this.parsePcdata();
          break;

        default:
          // Shortref tokens start at tokenFirstShortref
          if (token >= TokenEnum.tokenFirstShortref) {
            this.handleShortref(token - TokenEnum.tokenFirstShortref);
          }
          break;
      }
    } while (this.eventQueueEmpty());
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
    // Simplified compilePrologModes() from parseMode.cxx
    // Full implementation:
    // - Builds recognizers for prolog modes based on SGML declaration
    // - Handles different scope settings (scopeInstance)
    // - Compiles shortref table if needed
    // - Creates MarkupScan for each mode

    // For now: assume recognizers are already set up or not needed
    // TODO: Port full mode compilation from parseMode.cxx (~600 lines)

    // Stub: do nothing for now
  }

  protected compileInstanceModes(): void {
    // Simplified compileInstanceModes() from parseMode.cxx
    // Full implementation:
    // - Compiles normal character map
    // - Builds recognizers for instance modes
    // - Integrates shortref maps from DTD
    // - Handles different scope settings

    // For now: assume recognizers are already set up or not needed
    // TODO: Port full mode compilation from parseMode.cxx (~600 lines)

    // Stub: do nothing for now
  }

  protected compileSdModes(): void {
    // Simplified compileSdModes() from parseMode.cxx
    // Full implementation:
    // - Builds recognizers for SGML declaration parsing modes
    // - Sets up reference concrete syntax

    // For now: assume recognizers are already set up or not needed
    // TODO: Port full mode compilation from parseMode.cxx (~600 lines)

    // Stub: do nothing for now
  }

  // Core parsing utilities from parseCommon.cxx

  protected extendNameToken(maxLength: number, tooLongMessage: any): void {
    // Port of extendNameToken from parseCommon.cxx
    const input = this.currentInput();
    if (!input) return;

    let length = input.currentTokenLength();
    const syn = this.syntax();

    while (syn.isNameCharacter(input.tokenChar(this))) {
      length++;
    }

    if (length > maxLength) {
      this.message(tooLongMessage, new NumberMessageArg(maxLength));
    }

    input.endToken(length);
  }

  protected extendNumber(maxLength: number, tooLongMessage: any): void {
    // Port of extendNumber from parseCommon.cxx
    const input = this.currentInput();
    if (!input) return;

    let length = input.currentTokenLength();

    while (this.syntax().isDigit(input.tokenChar(this))) {
      length++;
    }

    if (length > maxLength) {
      this.message(tooLongMessage, new NumberMessageArg(maxLength));
    }

    input.endToken(length);
  }

  protected extendHexNumber(): void {
    // Port of extendHexNumber from parseCommon.cxx
    const input = this.currentInput();
    if (!input) return;

    let length = input.currentTokenLength();

    while (this.syntax().isHexDigit(input.tokenChar(this))) {
      length++;
    }

    if (length > this.syntax().namelen()) {
      this.message(ParserMessages.numberLength, new NumberMessageArg(this.syntax().namelen()));
    }

    input.endToken(length);
  }

  protected extendS(): void {
    // Port of extendS from parseCommon.cxx
    const input = this.currentInput();
    if (!input) return;

    let length = input.currentTokenLength();

    while (this.syntax().isS(input.tokenChar(this))) {
      length++;
    }

    input.endToken(length);
  }

  protected extendData(): void {
    // Simple data extension - just extend current token
    const input = this.currentInput();
    if (!input) return;

    let length = input.currentTokenLength();
    // Extend to include all available data
    // TODO: Implement proper data extension logic
    input.endToken(length);
  }

  protected extendContentS(): void {
    // Extend whitespace in content
    this.extendS();
  }

  protected reportNonSgmlCharacter(): boolean {
    // Port of reportNonSgmlCharacter from parseCommon.cxx
    const input = this.currentInput();
    if (!input) return false;

    // Get current character - either from current token or read next
    const c = input.currentTokenLength() ? this.currentChar() : this.getChar();

    if (!this.syntax().isSgmlChar(c)) {
      this.message(ParserMessages.nonSgmlCharacter, new NumberMessageArg(c));
      return true;
    }

    return false;
  }

  protected checkTaglen(tagStartIndex: number): void {
    // Port of checkTaglen from parseInstance.cxx (lines 499-509)
    // Validates that tag length doesn't exceed TAGLEN limit
    const originPtr = this.currentLocation().origin();
    if (!originPtr || !originPtr.pointer()) return;

    const originObj = originPtr.pointer();
    const origin = originObj.asInputSourceOrigin();
    if (!origin) return; // ASSERT in C++, but we'll just return

    const currentOffset = origin.startOffset(this.currentLocation().index());
    const tagStartOffset = origin.startOffset(
      tagStartIndex + this.syntax().delimGeneral(Syntax.DelimGeneral.dSTAGO).size()
    );

    if (currentOffset - tagStartOffset > this.syntax().taglen()) {
      this.message(ParserMessages.taglen, new NumberMessageArg(this.syntax().taglen()));
    }
  }

  protected completeRankStem(name: StringC): ElementType | null {
    // Port of completeRankStem from parseInstance.cxx (lines 475-487)
    // Completes a rank stem by appending current rank to get full element name
    const rankStem = this.currentDtd().lookupRankStem(name);
    if (rankStem) {
      const completeName = rankStem.name();
      if (!this.appendCurrentRank(completeName, rankStem)) {
        this.message(ParserMessages.noCurrentRank, new StringMessageArg(completeName));
      } else {
        return this.currentDtdNonConst().lookupElementType(completeName);
      }
    }
    return null;
  }

  protected handleRankedElement(e: ElementType): void {
    // Port of handleRankedElement from parseInstance.cxx (lines 488-497)
    // Sets current ranks for all rank stems in a ranked element
    const def = e.definition();
    if (!def) return;

    const rankSuffix = def.rankSuffix();
    const rankStem = e.rankedElementRankStem();
    if (!rankStem) return;

    for (let i = 0; i < rankStem.nDefinitions(); i++) {
      const elementDef = rankStem.definition(i);
      if (!elementDef) continue;

      for (let j = 0; j < elementDef.nRankStems(); j++) {
        const stem = elementDef.rankStem(j);
        this.setCurrentRank(stem, rankSuffix);
      }
    }
  }

  protected parseComment(mode: Mode): boolean {
    // Port of parseComment from parseCommon.cxx
    const startLoc = this.currentLocation();
    const markup = this.currentMarkup();

    if (markup) {
      markup.addCommentStart();
    }

    let token: Token;

    while ((token = this.getToken(mode)) !== TokenEnum.tokenCom) {
      switch (token) {
        case TokenEnum.tokenUnrecognized:
          if (!this.reportNonSgmlCharacter()) {
            this.message(ParserMessages.sdCommentSignificant,
              new StringMessageArg(this.currentToken()));
          }
          break;

        case TokenEnum.tokenEe:
          this.message(ParserMessages.commentEntityEnd);
          return false;

        default:
          if (markup) {
            markup.addCommentChar(this.currentChar());
          }
          break;
      }
    }

    return true;
  }

  protected parseProcessingInstruction(): boolean {
    // Port of parseProcessingInstruction from parseCommon.cxx (lines 17-61)
    const input = this.currentInput();
    if (!input) return false;

    input.startToken();
    const location = this.currentLocation();
    const buf = new String<Char>();

    for (;;) {
      const token = this.getToken(Mode.piMode);

      if (token === TokenEnum.tokenPic) {
        break;
      }

      switch (token) {
        case TokenEnum.tokenEe:
          this.message(ParserMessages.processingInstructionEntityEnd);
          return false;

        case TokenEnum.tokenUnrecognized:
          this.reportNonSgmlCharacter();
          // fall through

        case TokenEnum.tokenChar:
          const start = input.currentTokenStart();
          if (start && start.length > 0) {
            buf.append([start[0]], 1);
          }

          if (buf.size() / 2 > this.syntax().pilen()) {
            this.message(ParserMessages.processingInstructionLength,
              new NumberMessageArg(this.syntax().pilen()));
            this.message(ParserMessages.processingInstructionClose);
            return false;
          }
          break;
      }
    }

    if (buf.size() > this.syntax().pilen()) {
      this.message(ParserMessages.processingInstructionLength,
        new NumberMessageArg(this.syntax().pilen()));
    }

    if (this.options().warnPiMissingName) {
      let i = 0;
      if (buf.size() > 0 && this.syntax().isNameStartCharacter(buf.data()[0])) {
        for (i = 1; i < buf.size(); i++) {
          if (!this.syntax().isNameCharacter(buf.data()[i])) {
            break;
          }
        }
      }
      if (i === 0 || (i < buf.size() && !this.syntax().isS(buf.data()[i]))) {
        this.message(ParserMessages.piMissingName);
      }
    }

    this.noteMarkup();
    // TODO: Implement ImmediatePiEvent and eventHandler
    // this.eventHandler().pi(new ImmediatePiEvent(buf, location));

    return true;
  }

  protected parseNumericCharRef(isHex: boolean): { valid: boolean; char?: Char; location?: Location } {
    // Port of parseNumericCharRef from parseCommon.cxx (lines 282-357)
    const input = this.currentInput();
    if (!input) return { valid: false };

    const startLocation = this.currentLocation();
    input.discardInitial();
    let valid = true;
    let c: Char = 0;

    if (isHex) {
      this.extendHexNumber();
      const tokenStart = input.currentTokenStart();

      for (let i = 0; tokenStart && i < input.currentTokenLength(); i++) {
        const digitChar = tokenStart[i];
        const val = this.sd().hexDigitWeight(digitChar);
        const charMax = 0x10ffff; // From constant.h

        if (c <= charMax / 16 && (c *= 16) <= charMax - val) {
          c += val;
        } else {
          this.message(ParserMessages.characterNumber, new StringMessageArg(this.currentToken()));
          valid = false;
          break;
        }
      }
    } else {
      this.extendNumber(this.syntax().namelen(), ParserMessages.numberLength);
      const tokenStart = input.currentTokenStart();

      for (let i = 0; tokenStart && i < input.currentTokenLength(); i++) {
        const digitChar = tokenStart[i];
        const val = this.sd().digitWeight(digitChar);
        const charMax = 0x10ffff;

        if (c <= charMax / 10 && (c *= 10) <= charMax - val) {
          c += val;
        } else {
          this.message(ParserMessages.characterNumber, new StringMessageArg(this.currentToken()));
          valid = false;
          break;
        }
      }
    }

    // Check if character is declared in document charset
    if (valid && !this.sd().docCharsetDecl().charDeclared(c)) {
      valid = false;
      this.message(ParserMessages.characterNumber, new StringMessageArg(this.currentToken()));
    }

    // TODO: Handle markup tracking with Markup class
    // TODO: Handle REFC delimiter with getToken(refMode)
    // TODO: Implement NumericCharRefOrigin for location tracking

    if (valid) {
      // In C++ this creates a Location with NumericCharRefOrigin
      // For now, just return the character and start location
      return { valid: true, char: c, location: startLocation };
    }

    return { valid: false };
  }

  protected parseNamedCharRef(): boolean {
    // Port of parseNamedCharRef from parseCommon.cxx (lines 239-280)
    if (this.options().warnNamedCharRef) {
      this.message(ParserMessages.namedCharRef);
    }

    const input = this.currentInput();
    if (!input) return false;

    const startIndex = this.currentLocation().index();
    input.discardInitial();
    this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);

    let c: Char = 0;
    let valid = false;
    const name = new String<Char>();

    this.getCurrentToken(this.syntax().generalSubstTable(), name);

    const cResult = { value: 0 };
    if (!this.syntax().lookupFunctionChar(name, cResult)) {
      this.message(ParserMessages.functionName, new StringMessageArg(name));
      valid = false;
    } else {
      c = cResult.value;
      valid = true;
      if (this.wantMarkup()) {
        // Get the original name for markup tracking
        const originalName = new String<Char>();
        this.getCurrentToken(originalName);
      }
    }

    // Handle REFC delimiter
    const token = this.getToken(Mode.refMode);
    let refEndType: number;
    switch (token) {
      case TokenEnum.tokenRefc:
        refEndType = 0; // NamedCharRef.endRefc
        break;
      case TokenEnum.tokenRe:
        refEndType = 1; // NamedCharRef.endRE
        if (this.options().warnRefc) {
          this.message(ParserMessages.refc);
        }
        break;
      default:
        refEndType = 2; // NamedCharRef.endOmitted
        if (this.options().warnRefc) {
          this.message(ParserMessages.refc);
        }
        break;
    }

    input.startToken();
    // TODO: input.pushCharRef(c, NamedCharRef(...))
    // This requires NamedCharRef class and InputSource.pushCharRef method

    return true;
  }

  protected translateNumericCharRef(ch: Char): { valid: boolean; char?: Char; isSgmlChar?: boolean } {
    // Port of translateNumericCharRef from parseCommon.cxx (lines 365-425)
    // Translates character number from document charset to internal charset

    if (this.sd().internalCharsetIsDocCharset()) {
      if (this.options().warnNonSgmlCharRef && !this.syntax().isSgmlChar(ch)) {
        this.message(ParserMessages.nonSgmlCharRef);
      }
      return { valid: true, char: ch, isSgmlChar: true };
    }

    // TODO: Full charset translation logic requires:
    // - UnivChar type
    // - Charset.descToUniv() method
    // - CharsetDeclRange class
    // - Charset.univToDesc() method
    // For now, return simplified result assuming document charset = internal charset

    return { valid: true, char: ch, isSgmlChar: true };
  }

  // Literal parsing flags
  protected static readonly literalSingleSpace = 0o1;
  protected static readonly literalNoProcess = 0o2;
  protected static readonly literalNonSgml = 0o4;
  protected static readonly literalDelimInfo = 0o10;
  protected static readonly literalDataTag = 0o20;

  protected parseLiteral(
    litMode: Mode,
    liteMode: Mode,
    maxLength: number,
    tooLongMessage: any,
    flags: number,
    text: Text
  ): boolean {
    // Port of parseLiteral from parseCommon.cxx (lines 62-236)
    const startLevel = this.inputLevel();
    let currentMode = litMode;

    // If the literal gets to be longer than this, assume closing delimiter omitted
    const reallyMaxLength = maxLength > Number.MAX_SAFE_INTEGER / 2
      ? Number.MAX_SAFE_INTEGER
      : maxLength * 2;

    text.clear();
    const startLoc = this.currentLocation();

    if (flags & ParserState.literalDelimInfo) {
      text.addStartDelim(this.currentLocation());
    }

    for (;;) {
      const token = this.getToken(currentMode);

      switch (token) {
        case TokenEnum.tokenEe:
          if (this.inputLevel() === startLevel) {
            this.message(ParserMessages.literalLevel);
            return false;
          }
          text.addEntityEnd(this.currentLocation());
          this.popInputStack();
          if (this.inputLevel() === startLevel) {
            currentMode = litMode;
          }
          break;

        case TokenEnum.tokenUnrecognized:
          if (this.reportNonSgmlCharacter()) {
            break;
          }
          this.message(ParserMessages.literalMinimumData,
            new StringMessageArg(this.currentToken()));
          break;

        case TokenEnum.tokenRs:
          text.ignoreChar(this.currentChar(), this.currentLocation());
          break;

        case TokenEnum.tokenRe:
          if (text.size() > reallyMaxLength && this.inputLevel() === startLevel) {
            // Guess that the closing delimiter has been omitted
            this.setNextLocation(startLoc);
            this.message(ParserMessages.literalClosingDelimiter);
            return false;
          }
          // fall through
        case TokenEnum.tokenSepchar:
          if ((flags & ParserState.literalSingleSpace) &&
              (text.size() === 0 || text.lastChar() === this.syntax().space())) {
            text.ignoreChar(this.currentChar(), this.currentLocation());
          } else {
            text.addChar(this.syntax().space(),
              new Location(new ReplacementOrigin(this.currentLocation(), this.currentChar()), 0));
          }
          break;

        case TokenEnum.tokenSpace:
          if ((flags & ParserState.literalSingleSpace) &&
              (text.size() === 0 || text.lastChar() === this.syntax().space())) {
            text.ignoreChar(this.currentChar(), this.currentLocation());
          } else {
            text.addChar(this.currentChar(), this.currentLocation());
          }
          break;

        case TokenEnum.tokenCroDigit:
        case TokenEnum.tokenHcroHexDigit:
          {
            const charRefResult = this.parseNumericCharRef(token === TokenEnum.tokenHcroHexDigit);
            if (!charRefResult.valid) {
              return false;
            }
            const c = charRefResult.char!;
            const loc = charRefResult.location!;

            const translateResult = this.translateNumericCharRef(c);
            if (!translateResult.valid) {
              break;
            }

            if (!translateResult.isSgmlChar) {
              if (flags & ParserState.literalNonSgml) {
                text.addNonSgmlChar(c, loc);
              } else {
                this.message(ParserMessages.numericCharRefLiteralNonSgml,
                  new NumberMessageArg(c));
              }
              break;
            }

            const finalChar = translateResult.char!;
            if (flags & ParserState.literalDataTag) {
              if (!this.syntax().isSgmlChar(finalChar)) {
                this.message(ParserMessages.dataTagPatternNonSgml);
              } else {
                const functionCharSet = this.syntax().charSet(Syntax.Set.functionChar);
                if (functionCharSet && functionCharSet.contains(finalChar)) {
                  this.message(ParserMessages.dataTagPatternFunction);
                }
              }
            }

            if ((flags & ParserState.literalSingleSpace) &&
                finalChar === this.syntax().space() &&
                (text.size() === 0 || text.lastChar() === this.syntax().space())) {
              text.ignoreChar(finalChar, loc);
            } else {
              text.addChar(finalChar, loc);
            }
          }
          break;

        case TokenEnum.tokenCroNameStart:
          if (!this.parseNamedCharRef()) {
            return false;
          }
          break;

        case TokenEnum.tokenEroGrpo:
          this.message(this.inInstance() ? ParserMessages.eroGrpoStartTag : ParserMessages.eroGrpoProlog);
          break;

        case TokenEnum.tokenLit:
        case TokenEnum.tokenLita:
          if (flags & ParserState.literalDelimInfo) {
            text.addEndDelim(this.currentLocation(), token === TokenEnum.tokenLita);
          }
          // Done parsing literal
          if ((flags & ParserState.literalSingleSpace) &&
              text.size() > 0 &&
              text.lastChar() === this.syntax().space()) {
            text.ignoreLastChar();
          }
          if (text.size() > maxLength) {
            // Check if this is an attribute literal that should be handled as unterminated
            switch (litMode) {
              case Mode.alitMode:
              case Mode.alitaMode:
              case Mode.talitMode:
              case Mode.talitaMode:
                // TODO: AttributeValue.handleAsUnterminated(text, this)
                // For now, just report the error
                break;
              default:
                break;
            }
            this.message(tooLongMessage, new NumberMessageArg(maxLength));
          }
          return true;

        case TokenEnum.tokenPeroNameStart:
          if (this.options().warnInternalSubsetLiteralParamEntityRef &&
              this.inputLevel() === 1) {
            this.message(ParserMessages.internalSubsetLiteralParamEntityRef);
          }
          // fall through
        case TokenEnum.tokenEroNameStart:
          {
            const result = this.parseEntityReference(
              token === TokenEnum.tokenPeroNameStart,
              (flags & ParserState.literalNoProcess) ? 2 : 0
            );
            if (!result.valid) {
              return false;
            }
            if (result.entity && !result.entity.isNull() && result.origin) {
              result.entity.pointer()!.litReference(
                text,
                this,
                result.origin,
                (flags & ParserState.literalSingleSpace) !== 0
              );
            }
            if (this.inputLevel() > startLevel) {
              currentMode = liteMode;
            }
          }
          break;

        case TokenEnum.tokenPeroGrpo:
          this.message(ParserMessages.peroGrpoProlog);
          break;

        case TokenEnum.tokenCharDelim:
          {
            const input = this.currentInput();
            if (input) {
              const start = input.currentTokenStart();
              const len = input.currentTokenLength();
              const str = new String<Char>(start, len);
              this.message(ParserMessages.dataCharDelim, new StringMessageArg(str));
            }
          }
          // fall through
        case TokenEnum.tokenChar:
          if (text.size() > reallyMaxLength &&
              this.inputLevel() === startLevel &&
              this.currentChar() === this.syntax().standardFunction(Syntax.StandardFunction.fRE)) {
            // Guess that the closing delimiter has been omitted
            this.setNextLocation(startLoc);
            this.message(ParserMessages.literalClosingDelimiter);
            return false;
          }
          text.addChar(this.currentChar(), this.currentLocation());
          break;
      }
    }
  }

  protected parseEntityReference(
    isParameter: boolean,
    ignoreLevel: number
  ): { valid: boolean; entity?: ConstPtr<Entity>; origin?: Ptr<EntityOrigin> } {
    // Port of parseEntityReference from parseCommon.cxx (lines 428-540)
    const input = this.currentInput();
    if (!input) return { valid: false };

    const startLocation = new Location(input.currentLocation());
    let markupPtr: Owner<Markup> | null = null;

    if (this.wantMarkup()) {
      markupPtr = new Owner(new Markup());
      markupPtr.pointer()!.addDelim(isParameter ? Syntax.DelimGeneral.dPERO : Syntax.DelimGeneral.dERO);
    }

    if (ignoreLevel === 1) {
      const savedMarkup = new Markup();
      const savedCurrentMarkup = this.currentMarkup();
      if (savedCurrentMarkup) {
        savedCurrentMarkup.swap(savedMarkup);
      }
      const savedMarkupLocation = new Location(this.markupLocation());
      this.startMarkup(markupPtr !== null, startLocation);
      if (markupPtr) {
        markupPtr.pointer()!.addDelim(Syntax.DelimGeneral.dGRPO);
        markupPtr.pointer()!.swap(this.currentMarkup()!);
      }

      const ignoreResult = { value: false };
      if (!this.parseEntityReferenceNameGroup(ignoreResult)) {
        return { valid: false };
      }

      if (markupPtr) {
        this.currentMarkup()!.swap(markupPtr.pointer()!);
      }
      this.startMarkup(savedCurrentMarkup !== null, savedMarkupLocation);
      if (savedCurrentMarkup) {
        savedMarkup.swap(savedCurrentMarkup);
      }
      if (!ignoreResult.value) {
        ignoreLevel = 0;
      }

      input.startToken();
      const c = input.tokenChar(this);
      if (!this.syntax().isNameStartCharacter(c)) {
        this.message(ParserMessages.entityReferenceMissingName);
        return { valid: false };
      }
    }

    input.discardInitial();
    if (isParameter) {
      this.extendNameToken(this.syntax().penamelen(), ParserMessages.parameterEntityNameLength);
    } else {
      this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);
    }

    const name = this.nameBuffer();
    this.getCurrentToken(this.syntax().entitySubstTable(), name);

    let entity: ConstPtr<Entity>;
    if (ignoreLevel) {
      entity = new ConstPtr(new IgnoredEntity(
        name,
        isParameter ? EntityDecl.DeclType.parameterEntity : EntityDecl.DeclType.generalEntity
      ));
    } else {
      entity = this.lookupEntity(isParameter, name, startLocation, true);
      if (entity.isNull()) {
        if (this.haveApplicableDtd()) {
          if (!isParameter) {
            entity = this.createUndefinedEntity(name, startLocation);
            if (!this.sd().implydefEntity()) {
              this.message(ParserMessages.entityUndefined, new StringMessageArg(name));
            }
          } else {
            this.message(ParserMessages.parameterEntityUndefined, new StringMessageArg(name));
          }
        } else {
          this.message(ParserMessages.entityApplicableDtd);
        }
      } else if (entity.pointer() && entity.pointer()!.defaulted() && this.options().warnDefaultEntityReference) {
        this.message(ParserMessages.defaultEntityReference, new StringMessageArg(name));
      }
    }

    let origin: Ptr<EntityOrigin> | null = null;

    if (markupPtr) {
      markupPtr.pointer()!.addName(input);
      const refToken = this.getToken(Mode.refMode);
      switch (refToken) {
        case TokenEnum.tokenRefc:
          markupPtr.pointer()!.addDelim(Syntax.DelimGeneral.dREFC);
          break;
        case TokenEnum.tokenRe:
          markupPtr.pointer()!.addRefEndRe();
          if (this.options().warnRefc) {
            this.message(ParserMessages.refc);
          }
          break;
        default:
          if (this.options().warnRefc) {
            this.message(ParserMessages.refc);
          }
          break;
      }
    } else if (this.options().warnRefc) {
      if (this.getToken(Mode.refMode) !== TokenEnum.tokenRefc) {
        this.message(ParserMessages.refc);
      }
    } else {
      this.getToken(Mode.refMode);
    }

    if (!entity.isNull()) {
      const refLength = this.currentLocation().index() + input.currentTokenLength() - startLocation.index();
      const markup = markupPtr ? markupPtr.extract()! : null;
      const markupOwner = new Owner<Markup>(markup);

      const entityOrigin = EntityOrigin.makeEntity(
        this.internalAllocator(),
        entity,
        startLocation,
        refLength,
        markupOwner
      );
      origin = new Ptr(entityOrigin);
    }

    return { valid: true, entity, origin: origin || undefined };
  }

  protected parseEntityReferenceNameGroup(ignore: { value: boolean }): boolean {
    // Port of parseEntityReferenceNameGroup from parseCommon.cxx
    // TODO: Implement name group parsing for entity references
    // This handles patterns like &(name1|name2|name3)
    // For now, return true to allow simple entity references to work
    ignore.value = false;
    return true;
  }

  protected parsePcdata(): void {
    // Port of parsePcdata from parseInstance.cxx (lines 397-409)
    this.extendData();
    // TODO: acceptPcdata(currentLocation())
    this.noteData();
    // TODO: Fire ImmediateDataEvent with character data
    // eventHandler().data(new ImmediateDataEvent(
    //   Event.characterData,
    //   currentInput().currentTokenStart(),
    //   currentInput().currentTokenLength(),
    //   currentLocation(),
    //   0
    // ));
  }

  protected parseStartTag(): void {
    // Port of parseStartTag from parseInstance.cxx lines 410-420
    const input = this.currentInput();
    if (!input) return;

    // Start markup tracking
    const markup = this.startMarkup(
      this.eventsWanted().wantInstanceMarkup(),
      input.currentLocation()
    );
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dSTAGO);
    }

    const netEnabling = { value: false };
    const event = this.doParseStartTag(netEnabling);

    if (event) {
      // TODO: Implement acceptStartTag
      // this.acceptStartTag(event.elementType(), event, netEnabling.value);
    }
  }

  protected doParseStartTag(netEnabling: { value: boolean }): any {
    // Port of doParseStartTag from parseInstance.cxx lines 422-473
    const markup = this.currentMarkup();
    const input = this.currentInput();
    if (!input) return null;

    input.discardInitial();
    this.extendNameToken(this.syntax().namelen(), ParserMessages.nameTokenLength);

    if (markup) {
      markup.addName(input);
    }

    // Get element name
    const name = this.nameBuffer();
    this.getCurrentToken(this.syntax().generalSubstTable(), name);

    // Lookup element type in DTD
    let elementType = this.currentDtdNonConst().lookupElementType(name);

    // Handle ranked elements (SGML rank feature)
    if (this.sd().rank()) {
      if (!elementType) {
        elementType = this.completeRankStem(name);
      } else if (elementType.isRankedElement()) {
        this.handleRankedElement(elementType);
      }
    }

    // Create undefined element if not found
    if (!elementType) {
      // TODO: Implement lookupCreateUndefinedElement
      // elementType = this.lookupCreateUndefinedElement(
      //   name,
      //   this.currentLocation(),
      //   this.currentDtdNonConst(),
      //   this.implydefElement() !== Sd.implydefElementAnyother
      // );
      return null; // Stub for now
    }

    // Allocate attribute list
    // TODO: Implement allocAttributeList
    // const attributes = this.allocAttributeList(elementType.attributeDef(), 0);
    const attributes = new AttributeList(); // Stub

    // Parse closing token or attributes
    const closeToken = this.getToken(Mode.tagMode);

    if (closeToken === TokenEnum.tokenTagc) {
      // Simple tag with no attributes: <name>
      if (name.size() > this.syntax().taglen()) {
        this.checkTaglen(this.markupLocation().index());
      }
      // TODO: Implement attributes.finish()
      // attributes.finish(this);
      netEnabling.value = false;
      if (markup) {
        markup.addDelim(Syntax.DelimGeneral.dTAGC);
      }
    } else {
      // Tag with attributes or NET
      input.ungetToken();
      const newAttDef = new Ptr<AttributeDefinitionList>(null);

      if (this.parseAttributeSpec(Mode.tagMode, attributes, netEnabling, newAttDef)) {
        // Check tag length
        const currentLoc = input.currentLocation();
        const markupLoc = this.markupLocation();
        if (currentLoc.index() - markupLoc.index() > this.syntax().taglen()) {
          this.checkTaglen(markupLoc.index());
        }
      } else {
        netEnabling.value = false;
      }

      // Set new attribute definition if created
      if (!newAttDef.isNull()) {
        const newDef = newAttDef.pointer();
        if (newDef) {
          // TODO: Implement setIndex and setAttributeDef
          // newDef.setIndex(this.currentDtdNonConst().allocAttributeDefinitionListIndex());
          // elementType.setAttributeDef(newAttDef);
        }
      }
    }

    // Create StartElementEvent
    // TODO: Implement eventAllocator and StartElementEvent
    // return new StartElementEvent(
    //   elementType,
    //   this.currentDtdPointer(),
    //   attributes,
    //   this.markupLocation(),
    //   markup
    // );
    return null; // Stub for now
  }

  protected parseEndTag(): any {
    // Port of parseEndTag from parseInstance.cxx (lines 1003-1010)
    const markup = this.startMarkup(this.eventsWanted().wantInstanceMarkup(), this.currentLocation());
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dETAGO);
    }

    return this.doParseEndTag();
  }

  protected doParseEndTag(): any {
    // Port of doParseEndTag from parseInstance.cxx (lines 1012-1034)
    const markup = this.currentMarkup();
    const input = this.currentInput();
    if (!input) return null;

    input.discardInitial();
    this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);

    if (markup) {
      markup.addName(input);
    }

    // Get element name
    const name = this.nameBuffer();
    this.getCurrentToken(this.syntax().generalSubstTable(), name);

    // Lookup element type in DTD
    let elementType = this.currentDtd().lookupElementType(name);

    // Handle ranked elements (SGML rank feature)
    if (this.sd().rank()) {
      if (!elementType) {
        // TODO: Implement completeRankStem
        // elementType = this.completeRankStem(name);
      }
    }

    if (!elementType) {
      // TODO: Implement lookupCreateUndefinedElement
      // elementType = this.lookupCreateUndefinedElement(
      //   name,
      //   this.currentLocation(),
      //   this.currentDtdNonConst(),
      //   this.implydefElement() !== Sd.ImplydefElement.implydefElementAnyother
      // );
      return null; // Stub for now
    }

    this.parseEndTagClose();

    // TODO: Create EndElementEvent - needs event allocator
    // return new EndElementEvent(
    //   elementType,
    //   this.currentDtdPointer(),
    //   this.markupLocation(),
    //   markup
    // );
    return null; // Stub for now
  }

  protected parseEndTagClose(): void {
    // Port of parseEndTagClose from parseInstance.cxx (lines 1036-1063)
    // Parses the closing portion of an end tag (whitespace and TAGC delimiter)

    for (;;) {
      const token = this.getToken(Mode.tagMode);

      switch (token) {
        case TokenEnum.tokenUnrecognized:
          if (!this.reportNonSgmlCharacter()) {
            this.message(ParserMessages.endTagCharacter,
              new StringMessageArg(this.currentToken()));
          }
          return;

        case TokenEnum.tokenEe:
          this.message(ParserMessages.endTagEntityEnd);
          return;

        case TokenEnum.tokenEtago:
        case TokenEnum.tokenStago:
          if (!this.sd().endTagUnclosed()) {
            this.message(ParserMessages.unclosedEndTagShorttag);
          }
          this.currentInput()?.ungetToken();
          return;

        case TokenEnum.tokenTagc:
          const markup = this.currentMarkup();
          if (markup) {
            markup.addDelim(Syntax.DelimGeneral.dTAGC);
          }
          return;

        case TokenEnum.tokenS:
          const markup2 = this.currentMarkup();
          if (markup2) {
            markup2.addS(this.currentChar());
          }
          break;

        default:
          this.message(ParserMessages.endTagInvalidToken,
            new TokenMessageArg(token, Mode.tagMode, this.syntaxPointer(), this.sdPointer()));
          return;
      }
    }
  }

  protected acceptStartTag(elementType: any, event: any, netEnabling: boolean): void {
    // Stub for acceptStartTag - processes a start tag
    // TODO: Full implementation:
    // - Validates element is allowed in current context
    // - May close open elements (implied end tags)
    // - Pushes element onto stack
    // - Fires start element event
  }

  protected acceptEndTag(event: any): void {
    // Stub for acceptEndTag - processes an end tag
    // TODO: Full implementation:
    // - Finds matching open element
    // - Closes intervening elements if needed
    // - Validates end tag is legal
    // - Fires end element event
  }

  protected parseEmptyStartTag(): void {
    // Port of parseEmptyStartTag from parseInstance.cxx (lines 511-542)
    // Empty start tag <> - refers to last ended or current element

    if (this.options().warnEmptyTag) {
      this.message(ParserMessages.emptyStartTag);
    }

    if (!this.currentDtd().isBase()) {
      this.message(ParserMessages.emptyStartTagBaseDtd);
    }

    // Determine which element type this empty tag refers to
    let e: ElementType | null = null;

    if (!this.sd().omittag()) {
      // TODO: Implement lastEndedElementType
      // e = this.lastEndedElementType();
    } else if (this.tagLevel() > 0) {
      e = this.currentElement().type();
    }

    if (!e) {
      e = this.currentDtd().documentElementType();
    }

    if (!e) return; // Safety check

    // TODO: Implement allocAttributeList
    // const attributes = this.allocAttributeList(e.attributeDef(), 0);
    // attributes.finish(this);

    const markup = this.startMarkup(this.eventsWanted().wantInstanceMarkup(), this.currentLocation());
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dSTAGO);
      markup.addDelim(Syntax.DelimGeneral.dTAGC);
    }

    // TODO: Create StartElementEvent and acceptStartTag
    // this.acceptStartTag(
    //   e,
    //   new StartElementEvent(
    //     e,
    //     this.currentDtdPointer(),
    //     attributes,
    //     this.markupLocation(),
    //     markup
    //   ),
    //   false
    // );
  }

  protected parseEmptyEndTag(): void {
    // Port of parseEmptyEndTag from parseInstance.cxx (lines 1070-1091)
    // Empty end tag </> - closes current element

    if (this.options().warnEmptyTag) {
      this.message(ParserMessages.emptyEndTag);
    }

    if (!this.currentDtd().isBase()) {
      this.message(ParserMessages.emptyEndTagBaseDtd);
    }

    if (this.tagLevel() === 0) {
      this.message(ParserMessages.emptyEndTagNoOpenElements);
    } else {
      const markup = this.startMarkup(this.eventsWanted().wantInstanceMarkup(), this.currentLocation());
      if (markup) {
        markup.addDelim(Syntax.DelimGeneral.dETAGO);
        markup.addDelim(Syntax.DelimGeneral.dTAGC);
      }

      // TODO: Create EndElementEvent and acceptEndTag
      // this.acceptEndTag(
      //   new EndElementEvent(
      //     this.currentElement().type(),
      //     this.currentDtdPointer(),
      //     this.currentLocation(),
      //     markup
      //   )
      // );
    }
  }

  protected parseNullEndTag(): void {
    // Port of parseNullEndTag from parseInstance.cxx (lines 1092-1119)
    // Null end tag (NET) / - closes net-enabling element

    // If a null end tag was recognized, then there must be a net enabling
    // element on the stack.
    for (;;) {
      // ASSERT: tagLevel() > 0
      if (this.tagLevel() === 0) break; // Safety check instead of ASSERT

      if (this.currentElement().netEnabling()) {
        break;
      }

      if (!this.currentElement().isFinished() && this.validate()) {
        this.message(ParserMessages.elementNotFinished,
          new StringMessageArg(this.currentElement().type().name()));
      }

      // TODO: Implement implyCurrentElementEnd
      // this.implyCurrentElementEnd(this.currentLocation());
      break; // For now, break to avoid infinite loop
    }

    if (this.tagLevel() > 0 && !this.currentElement().isFinished() && this.validate()) {
      this.message(ParserMessages.elementEndTagNotFinished,
        new StringMessageArg(this.currentElement().type().name()));
    }

    const markup = this.startMarkup(this.eventsWanted().wantInstanceMarkup(), this.currentLocation());
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dNET);
    }

    // TODO: Create EndElementEvent and acceptEndTag
    if (this.tagLevel() > 0) {
      // this.acceptEndTag(
      //   new EndElementEvent(
      //     this.currentElement().type(),
      //     this.currentDtdPointer(),
      //     this.currentLocation(),
      //     markup
      //   )
      // );
    }
  }

  protected parseGroupStartTag(): void {
    // Port of parseGroupStartTag from parseInstance.cxx (lines 542-580)
    // Group start tag with name group: <(name1|name2)

    // TODO: Start markup tracking with STAGO + GRPO delimiters
    // TODO: parseTagNameGroup(active, 1)
    // TODO: If active, parse and accept the start tag
    // TODO: If not active, skip attribute spec and fire ignoredMarkup event
  }

  protected parseGroupEndTag(): void {
    // Port of parseGroupEndTag from parseInstance.cxx (lines 581-612)
    // Group end tag with name group: </(name1|name2)

    // TODO: Start markup tracking with ETAGO + GRPO delimiters
    // TODO: parseTagNameGroup(active, 0)
    // TODO: If active, parse and accept the end tag
    // TODO: If not active, skip to close and fire ignoredMarkup event
  }

  protected emptyCommentDecl(): void {
    // Port of emptyCommentDecl from parseDecl.cxx (lines 3568-3579)
    // Empty comment declaration <!-- -->

    const markup = this.startMarkup(this.eventsWanted().wantCommentDecls(), this.currentLocation());
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dMDO);
      markup.addDelim(Syntax.DelimGeneral.dMDC);
      // TODO: eventHandler().commentDecl(new CommentDeclEvent(...));
    }
    if (this.options().warnEmptyCommentDecl) {
      this.message(ParserMessages.emptyCommentDecl);
    }
  }

  protected parseCommentDecl(): boolean {
    // Port of parseCommentDecl from parseDecl.cxx (lines 3580-3638)
    // Comment declaration with one or more comments

    const markup = this.startMarkup(
      this.inInstance() ? this.eventsWanted().wantCommentDecls() : this.eventsWanted().wantPrologMarkup(),
      this.currentLocation()
    );
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dMDO);
    }

    // Parse first comment
    if (!this.parseComment(Mode.comMode)) {
      return false;
    }

    // Parse additional comments and closing
    for (;;) {
      const token = this.getToken(Mode.mdMode);
      switch (token) {
        case TokenEnum.tokenS:
          if (markup) {
            markup.addS(this.currentChar());
          }
          if (this.options().warnCommentDeclS) {
            this.message(ParserMessages.commentDeclS);
          }
          break;

        case TokenEnum.tokenCom:
          if (!this.parseComment(Mode.comMode)) {
            return false;
          }
          if (this.options().warnCommentDeclMultiple) {
            this.message(ParserMessages.commentDeclMultiple);
          }
          break;

        case TokenEnum.tokenMdc:
          if (markup) {
            markup.addDelim(Syntax.DelimGeneral.dMDC);
          }
          // TODO: eventHandler().commentDecl(new CommentDeclEvent(...))
          return true;

        case TokenEnum.tokenEe:
          this.message(ParserMessages.declarationLevel);
          return false;

        case TokenEnum.tokenUnrecognized:
          if (this.reportNonSgmlCharacter()) {
            break;
          }
          this.message(
            ParserMessages.commentDeclarationCharacter,
            new StringMessageArg(this.currentToken()),
            this.markupLocation()
          );
          return false;

        default:
          this.message(
            ParserMessages.commentDeclInvalidToken,
            new TokenMessageArg(token, Mode.mdMode, this.syntaxPointer(), this.sdPointer()),
            this.markupLocation()
          );
          return false;
      }
    }
  }

  protected parseMarkedSectionDeclStart(): boolean {
    // Port of parseMarkedSectionDeclStart from parseDecl.cxx (lines 3402-3523)
    // Marked section declaration: <![ status-keyword [ ... ]]>
    // This is a complex ~120 line method that:
    // - Checks marked section nesting level
    // - Handles special marked sections (inside IGNORE/CDATA/RCDATA)
    // - Parses status keywords (CDATA, RCDATA, IGNORE, INCLUDE, TEMP)
    // - Validates and sets appropriate parsing mode
    // - Fires MarkedSectionStartEvent
    // TODO: Full implementation requires:
    // - parseParam method for parsing keywords
    // - startMarkedSection/endMarkedSection state management
    // - markedSectionLevel/markedSectionSpecialLevel tracking
    // - Mode switching based on status (cmsMode, rcmsMode, imsMode)
    // - MarkedSectionEvent class

    return false;
  }

  protected handleMarkedSectionEnd(): void {
    // Port of handleMarkedSectionEnd from parseDecl.cxx (lines 3525-3565)
    // Handles marked section close: ]]>
    // - Validates marked section is open
    // - Determines status (cdata, rcdata, ignore, include)
    // - Fires MarkedSectionEndEvent
    // - Calls endMarkedSection() to pop state
    // TODO: Full implementation requires:
    // - markedSectionLevel() accessor
    // - markedSectionSpecialLevel() accessor
    // - endMarkedSection() state management
    // - MarkedSectionEndEvent class
    // - Mode detection for status
  }

  protected skipDeclaration(startLevel: number): void {
    // Port of skipDeclaration from parseInstance.cxx (lines 301-332)
    // Skips tokens until end of declaration for error recovery

    const skipMax = 250;
    let skipCount = 0;

    for (;;) {
      const token = this.getToken(Mode.mdMode);

      if (this.inputLevel() === startLevel) {
        skipCount++;
      }

      switch (token) {
        case TokenEnum.tokenUnrecognized:
          this.getChar();
          break;

        case TokenEnum.tokenEe:
          if (this.inputLevel() <= startLevel) {
            return;
          }
          this.popInputStack();
          return;

        case TokenEnum.tokenMdc:
          if (this.inputLevel() === startLevel) {
            return;
          }
          break;

        case TokenEnum.tokenS:
          if (this.inputLevel() === startLevel &&
              skipCount >= skipMax &&
              this.currentChar() === this.syntax().standardFunction(Syntax.StandardFunction.fRE)) {
            return;
          }
          break;

        default:
          break;
      }
    }
  }

  protected parseDeclarationName(allowAfdr: boolean = false): { valid: boolean; name?: any } {
    // Port of parseDeclarationName from parseDecl.cxx (lines 515-534)
    // Parses and validates a declaration name (DOCTYPE, ELEMENT, etc.)

    const input = this.currentInput();
    if (!input) return { valid: false };

    input.discardInitial();
    this.extendNameToken(this.syntax().namelen(), ParserMessages.numberLength);

    const name = this.nameBuffer();
    this.getCurrentToken(this.syntax().generalSubstTable(), name);

    // TODO: syntax().lookupReservedName(name, result)
    // This requires Syntax.ReservedName enum and lookup method
    // Reserved names: DOCTYPE, ELEMENT, ATTLIST, ENTITY, NOTATION,
    //                 SHORTREF, USEMAP, USELINK, LINKTYPE, etc.

    // TODO: if (currentMarkup()) currentMarkup().addReservedName(result, input)

    return { valid: false };
  }

  protected acceptPcdata(startLocation: Location): void {
    // Port of acceptPcdata from parseInstance.cxx (lines 614-638)
    // Validates that PCDATA is allowed in the current element context
    // If not, tries to imply start tags to make it valid

    // TODO: Full implementation requires:
    // - currentElement().tryTransitionPcdata()
    // - pcdataRecovering() state check
    // - tryImplyTag() for automatic tag inference
    // - Undo/Event list management
    // - keepMessages/discardKeptMessages for error recovery
    // - pcdataRecover() error state

    // For now, this is a no-op stub
    // Real implementation would validate and possibly imply tags
  }

  protected handleShortref(index: number): void {
    // Port of handleShortref from parseInstance.cxx (lines 333-395)
    // Handles short reference substitution
    // Short references are delimiter strings that map to entities

    // TODO: Requires currentElement().map() - short reference map lookup
    // For now, comment out the entity lookup since currentElement().map() isn't available
    // const entity = this.currentElement().map()?.entity(index);
    // if (entity && !entity.isNull()) {
    //   let markupOwner: Owner<Markup> | null = null;
    //   if (this.eventsWanted().wantInstanceMarkup()) {
    //     const markup = new Markup();
    //     markup.addShortref(this.currentInput()!);
    //     markupOwner = new Owner(markup);
    //   }
    //   const origin = new Ptr(EntityOrigin.makeEntity(
    //     this.internalAllocator(),
    //     entity,
    //     this.currentLocation(),
    //     this.currentInput()!.currentTokenLength(),
    //     markupOwner || new Owner<Markup>()
    //   ));
    //   entity.pointer()!.contentReference(this, origin);
    //   return;
    // }

    // If no entity mapping, treat as character data
    const input = this.currentInput();
    if (!input) return;

    let length = input.currentTokenLength();
    let s = input.currentTokenStart();
    let i = 0;

    if (this.currentMode() === Mode.econMode || this.currentMode() === Mode.econnetMode) {
      // Skip leading whitespace in element content mode
      for (i = 0; i < length && this.syntax().isS(s[i]); i++) {
        // continue
      }
      if (i > 0 && this.eventsWanted().wantInstanceMarkup()) {
        // TODO: Fire SSepEvent
        // this.eventHandler().sSep(new SSepEvent(s, i, this.currentLocation(), 0));
      }
    }

    if (i < length) {
      let location = new Location(this.currentLocation());
      location.addOffset(i);
      s = s.slice(i);
      length -= i;

      this.acceptPcdata(location);

      if (this.sd().keeprsre()) {
        this.noteData();
        // TODO: Fire ImmediateDataEvent
        // this.eventHandler().data(new ImmediateDataEvent(
        //   Event.characterData, s, length, location, 0
        // ));
        return;
      }

      // Process character by character handling RS/RE
      for (; length > 0; location.addOffset(1), length--, s = s.slice(1)) {
        if (s[0] === this.syntax().standardFunction(Syntax.StandardFunction.fRS)) {
          this.noteRs();
          if (this.eventsWanted().wantInstanceMarkup()) {
            // TODO: Fire IgnoredRsEvent
            // this.eventHandler().ignoredRs(new IgnoredRsEvent(s[0], location));
          }
        } else if (s[0] === this.syntax().standardFunction(Syntax.StandardFunction.fRE)) {
          this.queueRe(location);
        } else {
          this.noteData();
          // TODO: Fire ImmediateDataEvent
          // this.eventHandler().data(new ImmediateDataEvent(
          //   Event.characterData, s, 1, location, 0
          // ));
        }
      }
    }
  }

  // ========== Attribute Parsing Methods (parseAttribute.cxx) ==========

  // Port of parseAttribute.cxx lines 15-94
  // Parse attribute specification in start tag or empty tag
  protected parseAttributeSpec(
    mode: Mode,
    atts: AttributeList,
    netEnabling: { value: boolean },
    newAttDef: Ptr<AttributeDefinitionList>
  ): boolean {
    const specLengthObj = { value: 0 };
    const curParmObj = { value: AttributeParameterType.end };

    // Parse first attribute parameter
    if (!this.parseAttributeParameter(mode, false, curParmObj, netEnabling)) {
      return false;
    }

    // Loop through all attributes
    while (curParmObj.value !== AttributeParameterType.end) {
      switch (curParmObj.value) {
        case AttributeParameterType.name:
          {
            // Parse attribute name
            const text = new Text();
            const input = this.currentInput();
            if (input) {
              const start = input.currentTokenStart();
              if (start) {
                text.addChars(Array.from(start), input.currentTokenLength(), this.currentLocation());
              }
            }

            const nameMarkupIndex = this.currentMarkup()?.size() ? this.currentMarkup()!.size() - 1 : 0;

            // Substitute characters
            text.subst(this.syntax().generalSubstTable(), this.syntax().space());

            // Parse next parameter (should be VI or end)
            const nextMode = mode === Mode.piPasMode ? Mode.asMode : mode;
            if (!this.parseAttributeParameter(nextMode, true, curParmObj, netEnabling)) {
              return false;
            }

            // curParmObj.value has been updated by parseAttributeParameter
            const nextParm = curParmObj.value as AttributeParameterType;
            if (nextParm === AttributeParameterType.vi) {
              // Full attribute with value: name=value
              specLengthObj.value += text.size() + this.syntax().normsep();
              if (!this.parseAttributeValueSpec(nextMode, text.string(), atts, specLengthObj, newAttDef)) {
                return false;
              }
              // Setup for next attribute
              if (!this.parseAttributeParameter(mode, false, curParmObj, netEnabling)) {
                return false;
              }
            } else {
              // Omitted attribute value (shorttag): just name
              if (this.currentMarkup()) {
                // TODO: Implement changeToAttributeValue
                // this.currentMarkup().changeToAttributeValue(nameMarkupIndex);
              }
              if (!this.handleAttributeNameToken(text, atts, specLengthObj)) {
                return false;
              }
            }
          }
          break;

        case AttributeParameterType.nameToken:
          {
            // Parse name token (attribute name omitted)
            const text = new Text();
            const input = this.currentInput();
            if (input) {
              const start = input.currentTokenStart();
              if (start) {
                text.addChars(Array.from(start), input.currentTokenLength(), this.currentLocation());
              }
            }

            // Substitute characters
            text.subst(this.syntax().generalSubstTable(), this.syntax().space());

            if (!this.handleAttributeNameToken(text, atts, specLengthObj)) {
              return false;
            }
            if (!this.parseAttributeParameter(mode, false, curParmObj, netEnabling)) {
              return false;
            }
          }
          break;

        case AttributeParameterType.recoverUnquoted:
          {
            // Error recovery for unquoted attribute value
            // TODO: Implement atts.recoverUnquoted
            // if (!atts.recoverUnquoted(this.currentToken(), this.currentLocation(), this)) {
            //   const input = this.currentInput();
            //   if (input) input.endToken(1);
            //   if (!atts.handleAsUnterminated(this)) {
            //     this.message(ParserMessages.attributeSpecCharacter,
            //       new StringMessageArg(this.currentToken()));
            //   }
            //   return false;
            // }
            if (!this.parseAttributeParameter(mode, false, curParmObj, netEnabling)) {
              return false;
            }
          }
          break;

        default:
          throw new Error('CANNOT_HAPPEN in parseAttributeSpec');
      }
    }

    // Finish attribute list processing
    // TODO: Implement atts.finish()
    // atts.finish(this);

    // Check total attribute specification length
    if (specLengthObj.value > this.syntax().attsplen()) {
      this.message(
        ParserMessages.attsplen,
        new NumberMessageArg(this.syntax().attsplen()),
        new NumberMessageArg(specLengthObj.value)
      );
    }

    return true;
  }

  // Port of parseAttribute.cxx lines 96-122
  // Handle attribute name token (omitted attribute names)
  protected handleAttributeNameToken(
    text: Text,
    atts: AttributeList,
    specLength: { value: number }
  ): boolean {
    const indexResult = { value: 0 };

    if (!atts.tokenIndex(text.string(), indexResult)) {
      if (atts.handleAsUnterminated(this as any)) {
        return false;
      }
      atts.noteInvalidSpec();
      this.message(ParserMessages.noSuchAttributeToken, new StringMessageArg(text.string()));
    } else if (this.sd().www() && !atts.tokenIndexUnique(text.string(), indexResult.value)) {
      atts.noteInvalidSpec();
      this.message(ParserMessages.attributeTokenNotUnique, new StringMessageArg(text.string()));
    } else {
      if (!this.sd().attributeOmitName()) {
        this.message(ParserMessages.attributeNameShorttag);
      } else if (this.options().warnMissingAttributeName) {
        this.message(ParserMessages.missingAttributeName);
      }
      atts.setSpec(indexResult.value, this as any);
      atts.setValueToken(indexResult.value, text, this as any, specLength);
    }
    return true;
  }

  // Port of parseAttribute.cxx lines 124-249
  // Parse attribute value specification (= value part)
  protected parseAttributeValueSpec(
    mode: Mode,
    name: StringC,
    atts: AttributeList,
    specLength: { value: number },
    newAttDef: Ptr<AttributeDefinitionList>
  ): boolean {
    const markup = this.currentMarkup();
    let token = this.getToken(mode);

    // Skip whitespace
    if (token === TokenEnum.tokenS) {
      if (markup) {
        do {
          markup.addS(this.currentChar());
          token = this.getToken(mode);
        } while (token === TokenEnum.tokenS);
      } else {
        do {
          token = this.getToken(mode);
        } while (token === TokenEnum.tokenS);
      }
    }

    // Check if attribute exists in definition
    const indexResult = { value: 0 };
    if (!atts.attributeIndex(name, indexResult)) {
      // Attribute not in definition - create implied attribute
      // TODO: Implement full implied attribute creation logic
      // For now, just note this is needed and fail gracefully
      // Full implementation requires:
      // - AttributeDefinitionList creation
      // - Notation lookup for data attributes
      // - ImpliedAttributeDefinition creation
      // - atts.changeDef() and atts.size()
      return false;
    }

    atts.setSpec(indexResult.value, this as any);
    const text = new Text();

    // Parse value based on token type
    switch (token) {
      case TokenEnum.tokenUnrecognized:
        if (this.reportNonSgmlCharacter()) {
          return false;
        }
        // fall through
      case TokenEnum.tokenEtago:
      case TokenEnum.tokenStago:
      case TokenEnum.tokenNestc:
        this.message(ParserMessages.unquotedAttributeValue);
        this.extendUnquotedAttributeValue();
        if (markup) {
          const input = this.currentInput();
          if (input) markup.addAttributeValue(input);
        }
        {
          const input = this.currentInput();
          if (input) {
            const start = input.currentTokenStart();
            if (start) {
              text.addChars(Array.from(start), input.currentTokenLength(), this.currentLocation());
            }
          }
        }
        break;

      case TokenEnum.tokenEe:
        if (mode !== Mode.piPasMode) {
          this.message(ParserMessages.attributeSpecEntityEnd);
          return false;
        }
        // fall through
      case TokenEnum.tokenTagc:
      case TokenEnum.tokenDsc:
      case TokenEnum.tokenVi:
        this.message(ParserMessages.attributeValueExpected);
        return false;

      case TokenEnum.tokenNameStart:
      case TokenEnum.tokenDigit:
      case TokenEnum.tokenLcUcNmchar:
        if (!this.sd().attributeValueNotLiteral()) {
          this.message(ParserMessages.attributeValueShorttag);
        } else if (this.options().warnAttributeValueNotLiteral) {
          this.message(ParserMessages.attributeValueNotLiteral);
        }
        this.extendNameToken(
          this.syntax().litlen() >= this.syntax().normsep()
            ? this.syntax().litlen() - this.syntax().normsep()
            : 0,
          ParserMessages.attributeValueLength
        );
        if (markup) {
          const input = this.currentInput();
          if (input) markup.addAttributeValue(input);
        }
        {
          const input = this.currentInput();
          if (input) {
            const start = input.currentTokenStart();
            if (start) {
              text.addChars(Array.from(start), input.currentTokenLength(), this.currentLocation());
            }
          }
        }
        break;

      case TokenEnum.tokenLit:
      case TokenEnum.tokenLita:
        {
          const lita = token === TokenEnum.tokenLita;
          const tokenized = atts.tokenized(indexResult.value);
          if (tokenized) {
            if (!this.parseTokenizedAttributeValueLiteral(lita, text)) {
              return false;
            }
          } else {
            if (!this.parseAttributeValueLiteral(lita, text)) {
              return false;
            }
          }
          if (markup) {
            markup.addLiteral(text);
          }
        }
        break;

      default:
        throw new Error('CANNOT_HAPPEN in parseAttributeValueSpec');
    }

    // Set the attribute value
    // TODO: Implement atts.setValue() - this sets the parsed value
    // return atts.setValue(indexResult.value, text, this, specLength);
    return true; // Stub for now
  }

  // Port of parseAttribute.cxx lines 253-371
  // Parse attribute parameter (name, token, VI, or end marker)
  protected parseAttributeParameter(
    mode: Mode,
    allowVi: boolean,
    result: { value: AttributeParameterType },
    netEnabling: { value: boolean }
  ): boolean {
    let token = this.getToken(mode);
    const markup = this.currentMarkup();

    // Handle piPasMode: skip whitespace and comments
    if (mode === Mode.piPasMode) {
      for (;;) {
        switch (token) {
          case TokenEnum.tokenCom:
            if (!this.parseComment(Mode.comMode)) {
              return false;
            }
            if (this.options().warnPsComment) {
              this.message(ParserMessages.psComment);
            }
            // fall through
          case TokenEnum.tokenS:
            token = this.getToken(mode);
            continue;
          default:
            break;
        }
        break;
      }
    } else if (markup) {
      // Skip whitespace and add to markup
      while (token === TokenEnum.tokenS) {
        markup.addS(this.currentChar());
        token = this.getToken(mode);
      }
    } else {
      // Skip whitespace
      while (token === TokenEnum.tokenS) {
        token = this.getToken(mode);
      }
    }

    // Determine parameter type based on token
    switch (token) {
      case TokenEnum.tokenUnrecognized:
        if (this.reportNonSgmlCharacter()) {
          return false;
        }
        this.extendUnquotedAttributeValue();
        result.value = AttributeParameterType.recoverUnquoted;
        break;

      case TokenEnum.tokenEe:
        if (mode !== Mode.piPasMode) {
          this.message(ParserMessages.attributeSpecEntityEnd);
          return false;
        }
        result.value = AttributeParameterType.end;
        break;

      case TokenEnum.tokenEtago:
      case TokenEnum.tokenStago:
        if (!this.sd().startTagUnclosed()) {
          this.message(ParserMessages.unclosedStartTagShorttag);
        }
        result.value = AttributeParameterType.end;
        const input = this.currentInput();
        if (input) input.ungetToken();
        netEnabling.value = false;
        break;

      case TokenEnum.tokenNestc:
        if (markup) {
          markup.addDelim(Syntax.DelimGeneral.dNESTC);
        }
        // Handle NET enabling based on SGML declaration
        switch (this.sd().startTagNetEnable()) {
          case Sd.NetEnable.netEnableNo:
            this.message(ParserMessages.netEnablingStartTagShorttag);
            break;
          case Sd.NetEnable.netEnableImmednet:
            if (this.getToken(Mode.econnetMode) !== TokenEnum.tokenNet) {
              this.message(ParserMessages.nestcWithoutNet);
            }
            this.currentInput()?.ungetToken();
            break;
          case Sd.NetEnable.netEnableAll:
            break;
        }
        netEnabling.value = true;
        result.value = AttributeParameterType.end;
        break;

      case TokenEnum.tokenTagc:
        if (markup) {
          markup.addDelim(Syntax.DelimGeneral.dTAGC);
        }
        netEnabling.value = false;
        result.value = AttributeParameterType.end;
        break;

      case TokenEnum.tokenDsc:
        if (markup) {
          markup.addDelim(Syntax.DelimGeneral.dDSC);
        }
        result.value = AttributeParameterType.end;
        break;

      case TokenEnum.tokenNameStart:
        this.extendNameToken(this.syntax().namelen(), ParserMessages.nameTokenLength);
        if (markup) {
          const input2 = this.currentInput();
          if (input2) markup.addName(input2);
        }
        result.value = AttributeParameterType.name;
        break;

      case TokenEnum.tokenDigit:
      case TokenEnum.tokenLcUcNmchar:
        this.extendNameToken(this.syntax().namelen(), ParserMessages.nameTokenLength);
        if (markup) {
          const input3 = this.currentInput();
          if (input3) markup.addName(input3);
        }
        result.value = AttributeParameterType.nameToken;
        break;

      case TokenEnum.tokenLit:
      case TokenEnum.tokenLita:
        this.message(allowVi
          ? ParserMessages.attributeSpecLiteral
          : ParserMessages.attributeSpecNameTokenExpected);
        return false;

      case TokenEnum.tokenVi:
        if (!allowVi) {
          this.message(ParserMessages.attributeSpecNameTokenExpected);
          return false;
        }
        if (markup) {
          markup.addDelim(Syntax.DelimGeneral.dVI);
        }
        result.value = AttributeParameterType.vi;
        break;

      default:
        throw new Error('CANNOT_HAPPEN in parseAttributeParameter');
    }

    return true;
  }

  // Port of parseAttribute.cxx lines 373-388
  // Extend unquoted attribute value for error recovery
  protected extendUnquotedAttributeValue(): void {
    const input = this.currentInput();
    if (!input) return;

    let length = input.currentTokenLength();
    const syn = this.syntax();

    for (;;) {
      const c = input.tokenChar(this);
      if (syn.isS(c) ||
          !syn.isSgmlChar(c) ||
          c === InputSource.eE ||
          c === syn.delimGeneral(Syntax.DelimGeneral.dTAGC)[0]) {
        break;
      }
      length++;
    }
    input.endToken(length);
  }

  // Port of parseAttribute.cxx lines 390-408
  // Parse attribute value literal (quoted attribute value)
  protected parseAttributeValueLiteral(lita: boolean, text: Text): boolean {
    const syn = this.syntax();
    const maxLength = syn.litlen() > syn.normsep()
      ? syn.litlen() - syn.normsep()
      : 0;

    const literalFlags = ParserState.literalNonSgml |
      (this.wantMarkup() ? ParserState.literalDelimInfo : 0);

    if (this.parseLiteral(
      lita ? Mode.alitaMode : Mode.alitMode,
      Mode.aliteMode,
      maxLength,
      ParserMessages.attributeValueLength,
      literalFlags,
      text
    )) {
      if (text.size() === 0 && syn.normsep() > syn.litlen()) {
        this.message(
          ParserMessages.attributeValueLengthNeg,
          new NumberMessageArg(syn.normsep() - syn.litlen())
        );
      }
      return true;
    }
    return false;
  }

  // Port of parseAttribute.cxx lines 411-430
  // Parse tokenized attribute value literal
  protected parseTokenizedAttributeValueLiteral(lita: boolean, text: Text): boolean {
    const syn = this.syntax();
    const maxLength = syn.litlen() > syn.normsep()
      ? syn.litlen() - syn.normsep()
      : 0;

    const literalFlags = ParserState.literalSingleSpace |
      (this.wantMarkup() ? ParserState.literalDelimInfo : 0);

    if (this.parseLiteral(
      lita ? Mode.talitaMode : Mode.talitMode,
      Mode.taliteMode,
      maxLength,
      ParserMessages.tokenizedAttributeValueLength,
      literalFlags,
      text
    )) {
      if (text.size() === 0 && syn.normsep() > syn.litlen()) {
        this.message(
          ParserMessages.tokenizedAttributeValueLengthNeg,
          new NumberMessageArg(syn.normsep() - syn.litlen())
        );
      }
      return true;
    }
    return false;
  }
}

// AttributeParameter enum for parseAttributeSpec
// Port of Parser.h AttributeParameter struct
export enum AttributeParameterType {
  end,              // End of attribute spec (TAGC, NESTC, DSC, STAGO, ETAGO)
  name,             // Attribute name (starts with tokenNameStart)
  nameToken,        // Name token (starts with tokenDigit or tokenLcUcNmchar)
  vi,               // VI delimiter (=)
  recoverUnquoted   // Error recovery for unquoted value
}
