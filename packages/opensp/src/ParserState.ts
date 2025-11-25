// Copyright (c) 1994 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Allocator } from './Allocator';
import {
  AttributeList,
  AttributeValue,
  AttributeDefinitionList,
  AttributeContext,
  AttributeDefinition,
  DeclaredValue,
  CdataDeclaredValue,
  TokenizedDeclaredValue,
  NameTokenGroupDeclaredValue,
  NotationDeclaredValue,
  EntityDeclaredValue,
  IdDeclaredValue,
  IdrefDeclaredValue,
  GroupDeclaredValue,
  DataDeclaredValue,
  RequiredAttributeDefinition,
  CurrentAttributeDefinition,
  ImpliedAttributeDefinition,
  ConrefAttributeDefinition,
  DefaultAttributeDefinition,
  FixedAttributeDefinition
} from './Attribute';
import { Boolean, PackedBoolean } from './Boolean';
import { Vector } from './Vector';
import { StringC } from './StringC';
import { String } from './StringOf';
import { Dtd } from './Dtd';
import { Entity, InternalEntity, ExternalEntity, InternalTextEntity, PredefinedEntity, IgnoredEntity, InternalCdataEntity, InternalSdataEntity, PiEntity, SubdocEntity, ExternalDataEntity } from './Entity';
import { EntityDecl } from './EntityDecl';
import { EntityOrigin } from './Location';
import { EntityCatalog } from './EntityCatalog';
import { EntityManager } from './EntityManager';
import { Event, MessageEvent, EntityDefaultedEvent, CommentDeclEvent, SSepEvent, ImmediateDataEvent, IgnoredRsEvent, ImmediatePiEvent, IgnoredCharsEvent, EntityEndEvent, StartElementEvent, EndElementEvent, IgnoredMarkupEvent, MarkedSectionEvent, MarkedSectionStartEvent, MarkedSectionEndEvent, ElementDeclEvent, NotationDeclEvent, EntityDeclEvent, AttlistDeclEvent, AttlistNotationDeclEvent, LinkAttlistDeclEvent } from './Event';
import { EventQueue, Pass1EventHandler } from './EventQueue';
import { Id } from './Id';
import { InputSource } from './InputSource';
import { IList } from './IList';
import { IListIter } from './IListIter';
import { IQueue } from './IQueue';
import { Location, ReplacementOrigin, BracketOrigin } from './Location';
import { Message, Messenger } from './Message';
import { StringMessageArg, NumberMessageArg, TokenMessageArg, OrdinalMessageArg, StringVectorMessageArg } from './MessageArg';
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
import { CopyOwner } from './CopyOwner';
import { Attributed } from './Attributed';
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
import { ExternalId, PublicId } from './ExternalId';
import { Text } from './Text';
import { RankStem, ElementType, ElementDefinition } from './ElementType';
import { ExternalTextEntity } from './Entity';
import { ASSERT, SIZEOF } from './macros';
import { InternalInputSource } from './InternalInputSource';
import { Undo, UndoStartTag, UndoEndTag, UndoTransition, ParserState as ParserStateInterface } from './Undo';
import * as ParserMessages from './ParserMessages';
import { ModeInfo, TokenInfo } from './ModeInfo';
import { Partition } from './Partition';
import { SrInfo } from './SrInfo';
import { TrieBuilder, TokenVector } from './TrieBuilder';
import { ISet, ISetIter } from './ISet';
import { EquivCode } from './types';
import { Priority } from './Priority';
import { GroupToken, AllowedGroupTokens, GroupConnector, AllowedGroupConnectors, AllowedGroupTokensMessageArg, AllowedGroupConnectorsMessageArg } from './Group';
import { Param, AllowedParams, AllowedParamsMessageArg } from './Param';
import { ModelGroup, PcdataToken, ElementToken, DataTagElementToken, DataTagGroup, ContentToken, OrModelGroup, SeqModelGroup, AndModelGroup, CompiledModelGroup, ContentModelAmbiguity, LeafContentToken } from './ContentToken';
import { NameToken } from './NameToken';

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
    // Port of doDeclSubset from parseDecl.cxx (lines 234-458)
    do {
      if (this.cancelled()) {
        this.allDone();
        return;
      }

      const token = this.getToken(this.currentMode());
      const startLevel = this.inputLevel();
      const inDtd = !this.haveDefLpd();

      switch (token) {
        case TokenEnum.tokenUnrecognized:
          if (this.reportNonSgmlCharacter()) {
            break;
          }
          this.message(
            ParserMessages.declSubsetCharacter,
            new StringMessageArg(this.currentToken())
          );
          this.declSubsetRecover(startLevel);
          break;

        case TokenEnum.tokenEe:
          // End of entity
          if (this.inputLevel() === this.specialParseInputLevel_) {
            this.message(ParserMessages.specialParseEntityEnd);
          }
          if (this.eventsWanted().wantPrologMarkup()) {
            this.eventHandler().entityEnd(
              new EntityEndEvent(this.currentLocation())
            );
          }
          if (this.inputLevel() === 2) {
            const originPtr = this.currentLocation().origin();
            const entityDecl = originPtr && originPtr.pointer()
              ? originPtr.pointer()!.entityDecl()
              : null;
            if (entityDecl) {
              const declType = entityDecl.declType();
              if (
                declType === EntityDecl.DeclType.doctype ||
                declType === EntityDecl.DeclType.linktype
              ) {
                // popInputStack may destroy entityDecl
                const fake = entityDecl.defLocation().origin().isNull();
                this.popInputStack();
                if (inDtd) {
                  this.parseDoctypeDeclEnd(fake);
                } else {
                  this.parseLinktypeDeclEnd();
                }
                this.setPhase(Phase.prologPhase);
                return;
              }
            }
          }
          if (this.inputLevel() === 1) {
            if (this.finalPhase_ === Phase.declSubsetPhase) {
              this.checkDtd(this.defDtd());
              this.endDtd();
            } else {
              this.message(
                inDtd
                  ? ParserMessages.documentEndDtdSubset
                  : ParserMessages.documentEndLpdSubset
              );
            }
            this.popInputStack();
            this.allDone();
          } else {
            this.popInputStack();
          }
          return;

        case TokenEnum.tokenDsc:
          // End of declaration subset (DSC = ] )
          if (!this.referenceDsEntity(this.currentLocation())) {
            if (inDtd) {
              this.parseDoctypeDeclEnd(false);
            } else {
              this.parseLinktypeDeclEnd();
            }
            this.setPhase(Phase.prologPhase);
          }
          return;

        case TokenEnum.tokenMdoNameStart:
          // Named markup declaration
          {
            const markup = this.startMarkup(
              this.eventsWanted().wantPrologMarkup(),
              this.currentLocation()
            );
            if (markup) {
              markup.addDelim(Syntax.DelimGeneral.dMDO);
            }
            const result = this.parseDeclarationName(
              inDtd && !this.options().errorAfdr
            );
            let parseResult = false;

            if (result.valid) {
              switch (result.name) {
                case Syntax.ReservedName.rANY:
                  // Used for <!AFDR (Architecture Form Definition Requirements)
                  parseResult = this.parseAfdrDecl();
                  break;
                case Syntax.ReservedName.rELEMENT:
                  if (inDtd) {
                    parseResult = this.parseElementDecl();
                  } else {
                    this.message(
                      ParserMessages.lpdSubsetDeclaration,
                      new StringMessageArg(this.syntax().reservedName(result.name))
                    );
                  }
                  break;
                case Syntax.ReservedName.rATTLIST:
                  parseResult = this.parseAttlistDecl();
                  break;
                case Syntax.ReservedName.rENTITY:
                  parseResult = this.parseEntityDecl();
                  break;
                case Syntax.ReservedName.rNOTATION:
                  parseResult = this.parseNotationDecl();
                  if (!inDtd && !this.sd().www()) {
                    this.message(
                      ParserMessages.lpdSubsetDeclaration,
                      new StringMessageArg(this.syntax().reservedName(result.name))
                    );
                  }
                  break;
                case Syntax.ReservedName.rSHORTREF:
                  if (inDtd) {
                    parseResult = this.parseShortrefDecl();
                  } else {
                    this.message(
                      ParserMessages.lpdSubsetDeclaration,
                      new StringMessageArg(this.syntax().reservedName(result.name))
                    );
                  }
                  break;
                case Syntax.ReservedName.rUSEMAP:
                  if (inDtd) {
                    parseResult = this.parseUsemapDecl();
                  } else {
                    this.message(
                      ParserMessages.lpdSubsetDeclaration,
                      new StringMessageArg(this.syntax().reservedName(result.name))
                    );
                  }
                  break;
                case Syntax.ReservedName.rLINK:
                  if (inDtd) {
                    this.message(
                      ParserMessages.dtdSubsetDeclaration,
                      new StringMessageArg(this.syntax().reservedName(result.name))
                    );
                  } else {
                    parseResult = this.parseLinkDecl();
                  }
                  break;
                case Syntax.ReservedName.rIDLINK:
                  if (inDtd) {
                    this.message(
                      ParserMessages.dtdSubsetDeclaration,
                      new StringMessageArg(this.syntax().reservedName(result.name))
                    );
                  } else {
                    parseResult = this.parseIdlinkDecl();
                  }
                  break;
                case Syntax.ReservedName.rDOCTYPE:
                case Syntax.ReservedName.rLINKTYPE:
                case Syntax.ReservedName.rUSELINK:
                  this.message(
                    inDtd
                      ? ParserMessages.dtdSubsetDeclaration
                      : ParserMessages.lpdSubsetDeclaration,
                    new StringMessageArg(this.syntax().reservedName(result.name))
                  );
                  break;
                default:
                  this.message(
                    ParserMessages.noSuchDeclarationType,
                    new StringMessageArg(this.syntax().reservedName(result.name))
                  );
                  break;
              }
            }

            if (!parseResult) {
              this.declSubsetRecover(startLevel);
            }
          }
          break;

        case TokenEnum.tokenMdoMdc:
          // Empty comment declaration
          this.emptyCommentDecl();
          break;

        case TokenEnum.tokenMdoCom:
          // Comment declaration
          if (!this.parseCommentDecl()) {
            this.declSubsetRecover(startLevel);
          }
          break;

        case TokenEnum.tokenMdoDso:
          // Marked section declaration start
          if (!this.parseMarkedSectionDeclStart()) {
            this.declSubsetRecover(startLevel);
          }
          break;

        case TokenEnum.tokenMscMdc:
          // Marked section end
          this.handleMarkedSectionEnd();
          break;

        case TokenEnum.tokenPeroGrpo:
          // Parameter entity reference with name group
          this.message(ParserMessages.peroGrpoProlog);
          // Fall through
        case TokenEnum.tokenPeroNameStart:
          // Parameter entity reference
          {
            const result = this.parseEntityReference(
              true,
              token === TokenEnum.tokenPeroGrpo ? 1 : 0
            );
            if (result.valid && result.entity && !result.entity.isNull() && result.origin) {
              result.entity.pointer()!.dsReference(this, result.origin);
            } else {
              this.declSubsetRecover(startLevel);
            }
          }
          break;

        case TokenEnum.tokenPio:
          // Processing instruction
          if (!this.parseProcessingInstruction()) {
            this.declSubsetRecover(startLevel);
          }
          break;

        case TokenEnum.tokenS:
          // White space
          if (this.eventsWanted().wantPrologMarkup()) {
            this.extendS();
            const input = this.currentInput();
            if (input) {
              const data = new Uint32Array(input.currentTokenStart());
              this.eventHandler().sSep(
                new SSepEvent(
                  data,
                  input.currentTokenLength(),
                  this.currentLocation(),
                  true
                )
              );
            }
          }
          break;

        case TokenEnum.tokenIgnoredChar:
          // Character from an ignored marked section
          if (this.eventsWanted().wantPrologMarkup()) {
            const input = this.currentInput();
            if (input) {
              const data = new Uint32Array(input.currentTokenStart());
              this.eventHandler().ignoredChars(
                new IgnoredCharsEvent(
                  data,
                  input.currentTokenLength(),
                  this.currentLocation(),
                  true
                )
              );
            }
          }
          break;

        case TokenEnum.tokenRe:
        case TokenEnum.tokenRs:
        case TokenEnum.tokenCroNameStart:
        case TokenEnum.tokenCroDigit:
        case TokenEnum.tokenHcroHexDigit:
        case TokenEnum.tokenEroNameStart:
        case TokenEnum.tokenEroGrpo:
        case TokenEnum.tokenChar:
          // These can occur in a CDATA or RCDATA marked section
          this.message(ParserMessages.dataMarkedSectionDeclSubset);
          this.declSubsetRecover(startLevel);
          break;

        default:
          // CANNOT_HAPPEN()
          throw new Error(`CANNOT_HAPPEN in doDeclSubset: unexpected token ${token}`);
      }
    } while (this.eventQueueEmpty());
  }

  protected declSubsetRecover(startLevel: number): void {
    // Port of declSubsetRecover from parseDecl.cxx (lines 460-489)
    for (;;) {
      const token = this.getToken(this.currentMode());
      switch (token) {
        case TokenEnum.tokenUnrecognized:
          this.getChar();
          break;
        case TokenEnum.tokenEe:
          if (this.inputLevel() <= startLevel) {
            return;
          }
          this.popInputStack();
          break;
        case TokenEnum.tokenMdoCom:
        case TokenEnum.tokenDsc:
        case TokenEnum.tokenMdoNameStart:
        case TokenEnum.tokenMdoMdc:
        case TokenEnum.tokenMdoDso:
        case TokenEnum.tokenMscMdc:
        case TokenEnum.tokenPio:
          if (this.inputLevel() === startLevel) {
            const input = this.currentInput();
            if (input) {
              input.ungetToken();
            }
            return;
          }
          break;
        default:
          break;
      }
    }
  }

  // Declaration parsing stubs - to be implemented
  protected parseAfdrDecl(): boolean {
    // AFDR (Architecture Form Definition Requirements) parsing
    // Stub - returns false to trigger recovery
    this.skipDeclaration(this.inputLevel());
    return true;
  }

  // Port of Parser::parseElementDecl from parseDecl.cxx lines 538-740
  protected parseElementDecl(): boolean {
    const declInputLevel = this.inputLevel();
    const parm = new Param();

    // Allow name or name group
    const allowNameNameGroup = new AllowedParams(Param.paramName, Param.nameGroup);
    if (!this.parseParam(allowNameNameGroup, declInputLevel, parm)) {
      return false;
    }

    const nameVector = new Vector<NameToken>();
    if (parm.type === Param.nameGroup) {
      parm.nameTokenVector.swap(nameVector);
      if (this.options().warnElementGroupDecl) {
        this.message(ParserMessages.elementGroupDecl);
      }
    } else {
      nameVector.resize(1);
      const nt = new NameToken();
      parm.token.swap(nt.name);
      parm.origToken.swap(nt.origName);
      nameVector.set(0, nt);
    }

    // Allow rank, omission, or content specification
    const allowRankOmissionContent = new AllowedParams(
      Param.number,
      Param.reservedName + Syntax.ReservedName.rO,
      Param.minus,
      Param.reservedName + Syntax.ReservedName.rCDATA,
      Param.reservedName + Syntax.ReservedName.rRCDATA,
      Param.reservedName + Syntax.ReservedName.rEMPTY,
      Param.reservedName + Syntax.ReservedName.rANY,
      Param.modelGroup
    );
    if (!this.parseParam(allowRankOmissionContent, declInputLevel, parm)) {
      return false;
    }

    let rankSuffix = new String<Char>();
    const elements = new Vector<ElementType | null>(nameVector.size());
    const rankStems = new Vector<RankStem | null>();
    const constRankStems = new Vector<RankStem | null>();
    let i: number;

    if (parm.type === Param.number) {
      if (this.options().warnRank) {
        this.message(ParserMessages.rank);
      }
      parm.token.swap(rankSuffix);
      rankStems.resize(nameVector.size());
      constRankStems.resize(nameVector.size());
      for (i = 0; i < elements.size(); i++) {
        const srcName = nameVector.get(i).name;
        const name = new String<Char>(srcName.data(), srcName.size());
        name.appendString(rankSuffix);
        if (name.size() > this.syntax().namelen() &&
            nameVector.get(i).name.size() <= this.syntax().namelen()) {
          this.message(ParserMessages.genericIdentifierLength, new NumberMessageArg(this.syntax().namelen()));
        }
        elements.set(i, this.lookupCreateElement(name));
        rankStems.set(i, this.lookupCreateRankStem(nameVector.get(i).name));
        constRankStems.set(i, rankStems.get(i));
      }
      const allowOmissionContent = new AllowedParams(
        Param.reservedName + Syntax.ReservedName.rO,
        Param.minus,
        Param.reservedName + Syntax.ReservedName.rCDATA,
        Param.reservedName + Syntax.ReservedName.rRCDATA,
        Param.reservedName + Syntax.ReservedName.rEMPTY,
        Param.reservedName + Syntax.ReservedName.rANY,
        Param.modelGroup
      );
      const token = this.getToken(Mode.mdMinusMode);
      if (token === TokenEnum.tokenNameStart) {
        this.message(ParserMessages.psRequired);
      }
      this.currentInput()?.ungetToken();
      if (!this.parseParam(allowOmissionContent, declInputLevel, parm)) {
        return false;
      }
    } else {
      for (i = 0; i < elements.size(); i++) {
        elements.set(i, this.lookupCreateElement(nameVector.get(i).name));
        elements.get(i)!.setOrigName(nameVector.get(i).origName);
      }
    }

    for (i = 0; i < elements.size(); i++) {
      if (this.defDtd().lookupRankStem(elements.get(i)!.name()) && this.validate()) {
        this.message(ParserMessages.rankStemGenericIdentifier, new StringMessageArg(elements.get(i)!.name()));
      }
    }

    let omitFlags = 0;
    if (parm.type === Param.minus || parm.type === Param.reservedName + Syntax.ReservedName.rO) {
      if (this.options().warnMinimizationParam) {
        this.message(ParserMessages.minimizationParam);
      }
      omitFlags |= ElementDefinition.OmitFlags.omitSpec;
      if (parm.type !== Param.minus) {
        omitFlags |= ElementDefinition.OmitFlags.omitStart;
      }
      const allowOmission = new AllowedParams(
        Param.reservedName + Syntax.ReservedName.rO,
        Param.minus
      );
      if (!this.parseParam(allowOmission, declInputLevel, parm)) {
        return false;
      }
      if (parm.type !== Param.minus) {
        omitFlags |= ElementDefinition.OmitFlags.omitEnd;
      }
      const allowContent = new AllowedParams(
        Param.reservedName + Syntax.ReservedName.rCDATA,
        Param.reservedName + Syntax.ReservedName.rRCDATA,
        Param.reservedName + Syntax.ReservedName.rEMPTY,
        Param.reservedName + Syntax.ReservedName.rANY,
        Param.modelGroup
      );
      if (!this.parseParam(allowContent, declInputLevel, parm)) {
        return false;
      }
    } else {
      if (this.sd().omittag()) {
        this.message(ParserMessages.missingTagMinimization);
      }
    }

    let def: Ptr<ElementDefinition>;
    switch (parm.type) {
      case Param.reservedName + Syntax.ReservedName.rCDATA:
        def = new Ptr<ElementDefinition>(new ElementDefinition(
          this.markupLocation(),
          this.defDtdNonConst().allocElementDefinitionIndex(),
          omitFlags,
          ElementDefinition.DeclaredContent.cdata
        ));
        {
          const allowMdc = new AllowedParams(Param.mdc);
          if (!this.parseParam(allowMdc, declInputLevel, parm)) {
            return false;
          }
        }
        if (this.options().warnCdataContent) {
          this.message(ParserMessages.cdataContent);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rRCDATA:
        def = new Ptr<ElementDefinition>(new ElementDefinition(
          this.markupLocation(),
          this.defDtdNonConst().allocElementDefinitionIndex(),
          omitFlags,
          ElementDefinition.DeclaredContent.rcdata
        ));
        {
          const allowMdc = new AllowedParams(Param.mdc);
          if (!this.parseParam(allowMdc, declInputLevel, parm)) {
            return false;
          }
        }
        if (this.options().warnRcdataContent) {
          this.message(ParserMessages.rcdataContent);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rEMPTY:
        def = new Ptr<ElementDefinition>(new ElementDefinition(
          this.markupLocation(),
          this.defDtdNonConst().allocElementDefinitionIndex(),
          omitFlags,
          ElementDefinition.DeclaredContent.empty
        ));
        if ((omitFlags & ElementDefinition.OmitFlags.omitSpec) !== 0 &&
            (omitFlags & ElementDefinition.OmitFlags.omitEnd) === 0 &&
            this.options().warnShould) {
          this.message(ParserMessages.emptyOmitEndTag);
        }
        {
          const allowMdc = new AllowedParams(Param.mdc);
          if (!this.parseParam(allowMdc, declInputLevel, parm)) {
            return false;
          }
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rANY:
        def = new Ptr<ElementDefinition>(new ElementDefinition(
          this.markupLocation(),
          this.defDtdNonConst().allocElementDefinitionIndex(),
          omitFlags,
          ElementDefinition.DeclaredContent.any
        ));
        if (!this.parseExceptions(declInputLevel, def)) {
          return false;
        }
        break;
      case Param.modelGroup:
        {
          const cnt = parm.modelGroupPtr.pointer()!.grpgtcnt();
          // The outermost model group isn't formally a content token.
          if (cnt - 1 > this.syntax().grpgtcnt()) {
            this.message(ParserMessages.grpgtcnt, new NumberMessageArg(this.syntax().grpgtcnt()));
          }
          const modelGroup = new Owner<CompiledModelGroup>(new CompiledModelGroup(parm.modelGroupPtr.pointer()));
          const ambiguities = new Vector<ContentModelAmbiguity>();
          const pcdataUnreachable = { value: false };
          modelGroup.pointer()!.compile(this.currentDtd().nElementTypeIndex(), ambiguities, pcdataUnreachable);
          if (pcdataUnreachable.value && this.options().warnMixedContent) {
            this.message(ParserMessages.pcdataUnreachable);
          }
          if (this.validate()) {
            for (i = 0; i < ambiguities.size(); i++) {
              const a = ambiguities.get(i);
              this.reportAmbiguity(a.from, a.to1, a.to2, a.andDepth);
            }
          }
          def = new Ptr<ElementDefinition>(new ElementDefinition(
            this.markupLocation(),
            this.defDtdNonConst().allocElementDefinitionIndex(),
            omitFlags,
            ElementDefinition.DeclaredContent.modelGroup,
            modelGroup
          ));
          if (!this.parseExceptions(declInputLevel, def)) {
            return false;
          }
        }
        break;
      default:
        def = new Ptr<ElementDefinition>(null);
        break;
    }

    if (rankSuffix.size() > 0) {
      def.pointer()!.setRank(rankSuffix, constRankStems);
    }
    const constDef = new ConstPtr<ElementDefinition>(def.pointer());
    for (i = 0; i < elements.size(); i++) {
      if (elements.get(i)!.definition() !== null) {
        if (this.validate()) {
          this.message(ParserMessages.duplicateElementDefinition, new StringMessageArg(elements.get(i)!.name()));
        }
      } else {
        elements.get(i)!.setElementDefinition(constDef, i);
        if (elements.get(i)!.attributeDef() !== null) {
          this.checkElementAttribute(elements.get(i)!);
        }
      }
      if (rankStems.size() > 0) {
        rankStems.get(i)!.addDefinition(constDef);
      }
    }

    if (this.currentMarkup()) {
      const v = new Vector<ElementType | null>(elements.size());
      for (i = 0; i < elements.size(); i++) {
        v.set(i, elements.get(i));
      }
      this.eventHandler().elementDecl(new ElementDeclEvent(
        v,
        this.currentDtdPointer(),
        this.markupLocation(),
        this.currentMarkup()
      ));
    }
    return true;
  }

  // Port of Parser::parseEntityDecl from parseDecl.cxx
  protected parseEntityDecl(): boolean {
    const declInputLevel = this.inputLevel();
    const parm = new Param();

    const allowEntityNamePero = new AllowedParams(
      Param.entityName,
      Param.indicatedReservedName + Syntax.ReservedName.rDEFAULT,
      Param.pero
    );
    if (!this.parseParam(allowEntityNamePero, declInputLevel, parm)) {
      return false;
    }

    let declType: number;
    let name = new String<Char>();
    if (parm.type === Param.pero) {
      declType = Entity.DeclType.parameterEntity;
      const allowParamEntityName = new AllowedParams(Param.paramEntityName);
      if (!this.parseParam(allowParamEntityName, declInputLevel, parm)) {
        return false;
      }
      parm.token.swap(name);
    } else {
      declType = Entity.DeclType.generalEntity;
      if (parm.type === Param.entityName) {
        parm.token.swap(name);
      } else if (this.sd().implydefEntity()) {
        this.message(ParserMessages.implydefEntityDefault);
      } else if (this.options().warnDefaultEntityDecl) {
        this.message(ParserMessages.defaultEntityDecl);
      }
    }

    const allowEntityTextType = AllowedParams.fromArray([
      Param.paramLiteral,
      Param.reservedName + Syntax.ReservedName.rCDATA,
      Param.reservedName + Syntax.ReservedName.rSDATA,
      Param.reservedName + Syntax.ReservedName.rPI,
      Param.reservedName + Syntax.ReservedName.rSTARTTAG,
      Param.reservedName + Syntax.ReservedName.rENDTAG,
      Param.reservedName + Syntax.ReservedName.rMS,
      Param.reservedName + Syntax.ReservedName.rMD,
      Param.reservedName + Syntax.ReservedName.rSYSTEM,
      Param.reservedName + Syntax.ReservedName.rPUBLIC
    ]);
    if (!this.parseParam(allowEntityTextType, declInputLevel, parm)) {
      return false;
    }

    const typeLocation = this.currentLocation();
    let dataType: number = Entity.DataType.sgmlText;
    let bracketed: number = InternalTextEntity.Bracketed.none;

    switch (parm.type) {
      case Param.reservedName + Syntax.ReservedName.rSYSTEM:
      case Param.reservedName + Syntax.ReservedName.rPUBLIC:
        return this.parseExternalEntity(name, declType, declInputLevel, parm);
      case Param.reservedName + Syntax.ReservedName.rCDATA:
        dataType = Entity.DataType.cdata;
        if (this.options().warnInternalCdataEntity) {
          this.message(ParserMessages.internalCdataEntity);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rSDATA:
        dataType = Entity.DataType.sdata;
        if (this.options().warnInternalSdataEntity) {
          this.message(ParserMessages.internalSdataEntity);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rPI:
        dataType = Entity.DataType.pi;
        if (this.options().warnPiEntity) {
          this.message(ParserMessages.piEntity);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rSTARTTAG:
        bracketed = InternalTextEntity.Bracketed.starttag;
        if (this.options().warnBracketEntity) {
          this.message(ParserMessages.bracketEntity);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rENDTAG:
        bracketed = InternalTextEntity.Bracketed.endtag;
        if (this.options().warnBracketEntity) {
          this.message(ParserMessages.bracketEntity);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rMS:
        bracketed = InternalTextEntity.Bracketed.ms;
        if (this.options().warnBracketEntity) {
          this.message(ParserMessages.bracketEntity);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rMD:
        bracketed = InternalTextEntity.Bracketed.md;
        if (this.options().warnBracketEntity) {
          this.message(ParserMessages.bracketEntity);
        }
        break;
    }

    if (parm.type !== Param.paramLiteral) {
      const allowParamLiteral = new AllowedParams(Param.paramLiteral);
      if (!this.parseParam(allowParamLiteral, declInputLevel, parm)) {
        return false;
      }
    }

    const text = new Text();
    parm.literalText.swap(text);

    if (bracketed !== InternalTextEntity.Bracketed.none) {
      let open = new String<Char>();
      let close = new String<Char>();
      switch (bracketed) {
        case InternalTextEntity.Bracketed.starttag:
          open = this.instanceSyntax().delimGeneral(Syntax.DelimGeneral.dSTAGO);
          close = this.instanceSyntax().delimGeneral(Syntax.DelimGeneral.dTAGC);
          break;
        case InternalTextEntity.Bracketed.endtag:
          open = this.instanceSyntax().delimGeneral(Syntax.DelimGeneral.dETAGO);
          close = this.instanceSyntax().delimGeneral(Syntax.DelimGeneral.dTAGC);
          break;
        case InternalTextEntity.Bracketed.ms: {
          const syn = declType === Entity.DeclType.parameterEntity ? this.syntax() : this.instanceSyntax();
          open = new String<Char>(syn.delimGeneral(Syntax.DelimGeneral.dMDO).data(), syn.delimGeneral(Syntax.DelimGeneral.dMDO).size());
          open.appendString(syn.delimGeneral(Syntax.DelimGeneral.dDSO));
          close = new String<Char>(syn.delimGeneral(Syntax.DelimGeneral.dMSC).data(), syn.delimGeneral(Syntax.DelimGeneral.dMSC).size());
          close.appendString(syn.delimGeneral(Syntax.DelimGeneral.dMDC));
          break;
        }
        case InternalTextEntity.Bracketed.md: {
          const syn = declType === Entity.DeclType.parameterEntity ? this.syntax() : this.instanceSyntax();
          open = syn.delimGeneral(Syntax.DelimGeneral.dMDO);
          close = syn.delimGeneral(Syntax.DelimGeneral.dMDC);
          break;
        }
      }
      text.insertChars(open, new Location(new BracketOrigin(typeLocation, BracketOrigin.Position.open), 0));
      text.addChars(close, new Location(new BracketOrigin(typeLocation, BracketOrigin.Position.close), 0));
      if (text.size() > this.syntax().litlen() &&
          text.size() - open.size() - close.size() <= this.syntax().litlen()) {
        this.message(ParserMessages.bracketedLitlen, new NumberMessageArg(this.syntax().litlen()));
      }
    }

    const allowMdc = new AllowedParams(Param.mdc);
    if (!this.parseParam(allowMdc, declInputLevel, parm)) {
      return false;
    }

    if (declType === Entity.DeclType.parameterEntity &&
        (dataType === Entity.DataType.cdata || dataType === Entity.DataType.sdata)) {
      this.message(ParserMessages.internalParameterDataEntity, new StringMessageArg(name));
      return true;
    }

    let entity: Ptr<Entity>;
    switch (dataType) {
      case Entity.DataType.cdata:
        entity = new Ptr<Entity>(new InternalCdataEntity(name, this.markupLocation(), text));
        break;
      case Entity.DataType.sdata:
        entity = new Ptr<Entity>(new InternalSdataEntity(name, this.markupLocation(), text));
        break;
      case Entity.DataType.pi:
        entity = new Ptr<Entity>(new PiEntity(name, declType, this.markupLocation(), text));
        break;
      case Entity.DataType.sgmlText:
        entity = new Ptr<Entity>(new InternalTextEntity(name, declType, this.markupLocation(), text, bracketed));
        break;
      default:
        entity = new Ptr<Entity>(null);
        break;
    }
    this.maybeDefineEntity(entity);
    return true;
  }

  // Port of Parser::parseExternalEntity from parseDecl.cxx
  protected parseExternalEntity(
    name: String<Char>,
    declType: number,
    declInputLevel: number,
    parm: Param
  ): boolean {
    const allowSystemIdentifierEntityTypeMdc = AllowedParams.fromArray([
      Param.systemIdentifier,
      Param.reservedName + Syntax.ReservedName.rSUBDOC,
      Param.reservedName + Syntax.ReservedName.rCDATA,
      Param.reservedName + Syntax.ReservedName.rSDATA,
      Param.reservedName + Syntax.ReservedName.rNDATA,
      Param.mdc
    ]);
    const allowEntityTypeMdc = AllowedParams.fromArray([
      Param.reservedName + Syntax.ReservedName.rSUBDOC,
      Param.reservedName + Syntax.ReservedName.rCDATA,
      Param.reservedName + Syntax.ReservedName.rSDATA,
      Param.reservedName + Syntax.ReservedName.rNDATA,
      Param.mdc
    ]);

    const id = new ExternalId();
    if (!this.parseExternalId(
      allowSystemIdentifierEntityTypeMdc,
      allowEntityTypeMdc,
      true,
      declInputLevel,
      parm,
      id
    )) {
      return false;
    }

    if (parm.type === Param.mdc) {
      this.maybeDefineEntity(
        new Ptr<Entity>(new ExternalTextEntity(name, declType, this.markupLocation(), id))
      );
      return true;
    }

    let entity: Ptr<Entity>;
    if (parm.type === Param.reservedName + Syntax.ReservedName.rSUBDOC) {
      if (this.sd().subdoc() === 0) {
        this.message(ParserMessages.subdocEntity, new StringMessageArg(name));
      }
      const allowMdc = new AllowedParams(Param.mdc);
      if (!this.parseParam(allowMdc, declInputLevel, parm)) {
        return false;
      }
      entity = new Ptr<Entity>(new SubdocEntity(name, this.markupLocation(), id));
    } else {
      let dataType: number;
      switch (parm.type) {
        case Param.reservedName + Syntax.ReservedName.rCDATA:
          dataType = Entity.DataType.cdata;
          if (this.options().warnExternalCdataEntity) {
            this.message(ParserMessages.externalCdataEntity);
          }
          break;
        case Param.reservedName + Syntax.ReservedName.rSDATA:
          dataType = Entity.DataType.sdata;
          if (this.options().warnExternalSdataEntity) {
            this.message(ParserMessages.externalSdataEntity);
          }
          break;
        case Param.reservedName + Syntax.ReservedName.rNDATA:
          dataType = Entity.DataType.ndata;
          break;
        default:
          throw new Error('CANNOT_HAPPEN in parseExternalEntity');
      }

      const allowName = new AllowedParams(Param.paramName);
      if (!this.parseParam(allowName, declInputLevel, parm)) {
        return false;
      }
      const notation = this.lookupCreateNotation(parm.token);

      const allowDsoMdc = new AllowedParams(Param.dso, Param.mdc);
      if (!this.parseParam(allowDsoMdc, declInputLevel, parm)) {
        return false;
      }

      const attributes = new AttributeList(notation.pointer()!.attributeDef().attributeDefConst());
      if (parm.type === Param.dso) {
        if (attributes.size() === 0 && !this.sd().www()) {
          this.message(
            ParserMessages.notationNoAttributes,
            new StringMessageArg(notation.pointer()!.name())
          );
        }
        const netEnabling = { value: false };
        const newAttDef = new Ptr<AttributeDefinitionList>(null);
        if (!this.parseAttributeSpec(Mode.asMode, attributes, netEnabling, newAttDef)) {
          return false;
        }
        if (!newAttDef.isNull()) {
          newAttDef.pointer()!.setIndex(this.defDtd().allocAttributeDefinitionListIndex());
          notation.pointer()!.setAttributeDef(newAttDef);
        }
        if (attributes.nSpec() === 0) {
          this.message(ParserMessages.emptyDataAttributeSpec);
        }
        const allowMdc = new AllowedParams(Param.mdc);
        if (!this.parseParam(allowMdc, declInputLevel, parm)) {
          return false;
        }
      } else {
        attributes.finish(this as any);
      }

      entity = new Ptr<Entity>(
        new ExternalDataEntity(
          name,
          dataType,
          this.markupLocation(),
          id,
          new ConstPtr<Notation>(notation.pointer()),
          attributes,
          declType === Entity.DeclType.parameterEntity
            ? Entity.DeclType.parameterEntity
            : Entity.DeclType.generalEntity
        )
      );
    }

    if (declType === Entity.DeclType.parameterEntity && !this.sd().www()) {
      this.message(ParserMessages.externalParameterDataSubdocEntity, new StringMessageArg(name));
      return true;
    }
    this.maybeDefineEntity(entity);
    return true;
  }

  // Port of Parser::maybeDefineEntity from parseDecl.cxx
  protected maybeDefineEntity(entity: Ptr<Entity>): void {
    const dtd = this.defDtd();
    const ent = entity.pointer()!;
    if (this.haveDefLpd()) {
      ent.setDeclIn(
        dtd.namePointer(),
        dtd.isBase(),
        this.defLpd().namePointer(),
        this.defLpd().active()
      );
    } else {
      ent.setDeclIn(dtd.namePointer(), dtd.isBase());
    }

    let ignored = false;
    if (ent.name().size() === 0) {
      const oldEntity = dtd.defaultEntity().pointer();
      if (!oldEntity || (!oldEntity.declInActiveLpd() && ent.declInActiveLpd())) {
        dtd.setDefaultEntity(entity, this);
      } else {
        ignored = true;
        if (this.options().warnDuplicateEntity) {
          this.message(
            ParserMessages.duplicateEntityDeclaration,
            new StringMessageArg(this.syntax().rniReservedName(Syntax.ReservedName.rDEFAULT))
          );
        }
      }
    } else {
      const oldEntity = dtd.insertEntity(entity);
      if (oldEntity.isNull()) {
        ent.generateSystemId(this);
      } else if (oldEntity.pointer()!.defaulted()) {
        dtd.insertEntity(entity, true);
        this.message(ParserMessages.defaultedEntityDefined, new StringMessageArg(ent.name()));
        ent.generateSystemId(this);
      } else {
        if (ent.declInActiveLpd() && !oldEntity.pointer()!.declInActiveLpd()) {
          dtd.insertEntity(entity, true);
          ent.generateSystemId(this);
        } else {
          ignored = true;
          if (this.options().warnDuplicateEntity) {
            this.message(
              ent.declType() === Entity.DeclType.parameterEntity
                ? ParserMessages.duplicateParameterEntityDeclaration
                : ParserMessages.duplicateEntityDeclaration,
              new StringMessageArg(ent.name())
            );
          }
        }
      }
    }

    if (this.currentMarkup()) {
      this.eventHandler().entityDecl(
        new EntityDeclEvent(
          new ConstPtr<Entity>(entity.pointer()),
          ignored,
          this.markupLocation(),
          this.currentMarkup()!
        )
      );
    }
  }

  // Port of Parser::parseNotationDecl from parseDecl.cxx
  protected parseNotationDecl(): boolean {
    const declInputLevel = this.inputLevel();
    const parm = new Param();

    const allowName = new AllowedParams(Param.paramName);
    if (!this.parseParam(allowName, declInputLevel, parm)) {
      return false;
    }
    const ntPtr = this.lookupCreateNotation(parm.token);
    const nt = ntPtr.pointer()!;
    if (this.validate() && nt.defined()) {
      this.message(ParserMessages.duplicateNotationDeclaration, new StringMessageArg(parm.token));
    }
    const atts = nt.attributeDef().attributeDef().pointer();
    if (atts) {
      for (let i = 0; i < atts.size(); i++) {
        const def = atts.def(i);
        if (def) {
          const implicitRef = { value: false };
          if (def.isSpecified(implicitRef) && implicitRef.value) {
            this.message(ParserMessages.notationMustNotBeDeclared, new StringMessageArg(parm.token));
            break;
          }
        }
      }
    }

    const allowPublicSystem = new AllowedParams(
      Param.reservedName + Syntax.ReservedName.rPUBLIC,
      Param.reservedName + Syntax.ReservedName.rSYSTEM
    );
    if (!this.parseParam(allowPublicSystem, declInputLevel, parm)) {
      return false;
    }

    const allowSystemIdentifierMdc = new AllowedParams(Param.systemIdentifier, Param.mdc);
    const allowMdc = new AllowedParams(Param.mdc);

    const id = new ExternalId();
    if (!this.parseExternalId(
      allowSystemIdentifierMdc,
      allowMdc,
      parm.type === Param.reservedName + Syntax.ReservedName.rSYSTEM,
      declInputLevel,
      parm,
      id
    )) {
      return false;
    }

    if (this.validate() && this.sd().formal()) {
      const publicId = id.publicId();
      if (publicId) {
        const textClassRef = { value: 0 };
        if (publicId.getTextClass(textClassRef) && textClassRef.value !== PublicId.TextClass.NOTATION) {
          this.message(ParserMessages.notationIdentifierTextClass);
        }
      }
    }

    if (!nt.defined()) {
      nt.setExternalId(id, this.markupLocation());
      nt.generateSystemId(this);
      if (this.currentMarkup()) {
        this.eventHandler().notationDecl(new NotationDeclEvent(
          new ConstPtr<Notation>(nt),
          this.markupLocation(),
          this.currentMarkup()
        ));
      }
    }
    return true;
  }

  // Port of Parser::parseAttributed from parseDecl.cxx
  protected parseAttributed(
    declInputLevel: number,
    parm: Param,
    attributed: Vector<ElementType | Notation>,
    isNotationRef: { value: boolean }
  ): boolean {
    const allowNameGroupNotation = AllowedParams.fromArray([
      Param.paramName,
      Param.nameGroup,
      Param.indicatedReservedName + Syntax.ReservedName.rNOTATION
    ]);
    const allowNameGroupNotationAll = AllowedParams.fromArray([
      Param.paramName,
      Param.nameGroup,
      Param.indicatedReservedName + Syntax.ReservedName.rNOTATION,
      Param.indicatedReservedName + Syntax.ReservedName.rALL,
      Param.indicatedReservedName + Syntax.ReservedName.rIMPLICIT
    ]);
    if (!this.parseParam(
      this.haveDefLpd() ? allowNameGroupNotation : allowNameGroupNotationAll,
      declInputLevel,
      parm
    )) {
      return false;
    }

    if (parm.type === Param.indicatedReservedName + Syntax.ReservedName.rNOTATION) {
      if (this.options().warnDataAttributes) {
        this.message(ParserMessages.dataAttributes);
      }
      isNotationRef.value = true;
      const allowNameNameGroup = new AllowedParams(Param.paramName, Param.nameGroup);
      const allowNameGroupAll = AllowedParams.fromArray([
        Param.paramName,
        Param.nameGroup,
        Param.indicatedReservedName + Syntax.ReservedName.rALL,
        Param.indicatedReservedName + Syntax.ReservedName.rIMPLICIT
      ]);
      if (!this.parseParam(
        this.haveDefLpd() ? allowNameNameGroup : allowNameGroupAll,
        declInputLevel,
        parm
      )) {
        return false;
      }
      if (parm.type === Param.nameGroup) {
        attributed.resize(parm.nameTokenVector.size());
        for (let i = 0; i < attributed.size(); i++) {
          attributed.set(i, this.lookupCreateNotation(parm.nameTokenVector.get(i).name).pointer()!);
        }
      } else {
        if (parm.type !== Param.paramName && !this.hadAfdrDecl() && !this.sd().www()) {
          this.message(ParserMessages.missingAfdrDecl);
          this.setHadAfdrDecl();
        }
        attributed.resize(1);
        const name = parm.type === Param.paramName
          ? parm.token
          : this.syntax().rniReservedName(parm.type - Param.indicatedReservedName);
        attributed.set(0, this.lookupCreateNotation(name).pointer()!);
      }
    } else {
      isNotationRef.value = false;
      if (parm.type === Param.nameGroup) {
        if (this.options().warnAttlistGroupDecl) {
          this.message(ParserMessages.attlistGroupDecl);
        }
        attributed.resize(parm.nameTokenVector.size());
        for (let i = 0; i < attributed.size(); i++) {
          attributed.set(i, this.lookupCreateElement(parm.nameTokenVector.get(i).name));
        }
      } else {
        if (parm.type !== Param.paramName && !this.hadAfdrDecl() && !this.sd().www()) {
          this.message(ParserMessages.missingAfdrDecl);
          this.setHadAfdrDecl();
        }
        attributed.resize(1);
        const name = parm.type === Param.paramName
          ? parm.token
          : this.syntax().rniReservedName(parm.type - Param.indicatedReservedName);
        attributed.set(0, this.lookupCreateElement(name));
      }
    }
    return true;
  }

  // Port of Parser::parseDeclaredValue from parseDecl.cxx
  protected parseDeclaredValue(
    declInputLevel: number,
    isNotation: boolean,
    parm: Param,
    declaredValue: Owner<DeclaredValue>
  ): boolean {
    const declaredValues: number[] = [
      Param.reservedName + Syntax.ReservedName.rCDATA,
      Param.reservedName + Syntax.ReservedName.rENTITY,
      Param.reservedName + Syntax.ReservedName.rENTITIES,
      Param.reservedName + Syntax.ReservedName.rID,
      Param.reservedName + Syntax.ReservedName.rIDREF,
      Param.reservedName + Syntax.ReservedName.rIDREFS,
      Param.reservedName + Syntax.ReservedName.rNAME,
      Param.reservedName + Syntax.ReservedName.rNAMES,
      Param.reservedName + Syntax.ReservedName.rNMTOKEN,
      Param.reservedName + Syntax.ReservedName.rNMTOKENS,
      Param.reservedName + Syntax.ReservedName.rNUMBER,
      Param.reservedName + Syntax.ReservedName.rNUMBERS,
      Param.reservedName + Syntax.ReservedName.rNUTOKEN,
      Param.reservedName + Syntax.ReservedName.rNUTOKENS,
      Param.reservedName + Syntax.ReservedName.rNOTATION,
      Param.nameTokenGroup,
      Param.reservedName + Syntax.ReservedName.rDATA
    ];
    const allowDeclaredValue = AllowedParams.fromArray(declaredValues.slice(0, -1));
    const allowDeclaredValueData = AllowedParams.fromArray(declaredValues);
    if (!this.parseParam(
      this.sd().www() ? allowDeclaredValueData : allowDeclaredValue,
      declInputLevel,
      parm
    )) {
      return false;
    }

    const asDataAttribute = 0x01;
    const asLinkAttribute = 0x02;
    let allowedFlags = asDataAttribute | asLinkAttribute;

    switch (parm.type) {
      case Param.reservedName + Syntax.ReservedName.rCDATA:
        declaredValue.reset(new CdataDeclaredValue());
        break;
      case Param.reservedName + Syntax.ReservedName.rENTITY:
        declaredValue.reset(new EntityDeclaredValue(false));
        allowedFlags = asLinkAttribute;
        break;
      case Param.reservedName + Syntax.ReservedName.rENTITIES:
        declaredValue.reset(new EntityDeclaredValue(true));
        allowedFlags = asLinkAttribute;
        break;
      case Param.reservedName + Syntax.ReservedName.rID:
        declaredValue.reset(new IdDeclaredValue());
        allowedFlags = 0;
        break;
      case Param.reservedName + Syntax.ReservedName.rIDREF:
        declaredValue.reset(new IdrefDeclaredValue(false));
        allowedFlags = 0;
        break;
      case Param.reservedName + Syntax.ReservedName.rIDREFS:
        declaredValue.reset(new IdrefDeclaredValue(true));
        allowedFlags = 0;
        break;
      case Param.reservedName + Syntax.ReservedName.rNAME:
        declaredValue.reset(new TokenizedDeclaredValue(TokenizedDeclaredValue.TokenType.name, false));
        if (this.options().warnNameDeclaredValue) {
          this.message(ParserMessages.nameDeclaredValue);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rNAMES:
        declaredValue.reset(new TokenizedDeclaredValue(TokenizedDeclaredValue.TokenType.name, true));
        if (this.options().warnNameDeclaredValue) {
          this.message(ParserMessages.nameDeclaredValue);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rNMTOKEN:
        declaredValue.reset(new TokenizedDeclaredValue(TokenizedDeclaredValue.TokenType.nameToken, false));
        break;
      case Param.reservedName + Syntax.ReservedName.rNMTOKENS:
        declaredValue.reset(new TokenizedDeclaredValue(TokenizedDeclaredValue.TokenType.nameToken, true));
        break;
      case Param.reservedName + Syntax.ReservedName.rNUMBER:
        declaredValue.reset(new TokenizedDeclaredValue(TokenizedDeclaredValue.TokenType.number, false));
        if (this.options().warnNumberDeclaredValue) {
          this.message(ParserMessages.numberDeclaredValue);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rNUMBERS:
        declaredValue.reset(new TokenizedDeclaredValue(TokenizedDeclaredValue.TokenType.number, true));
        if (this.options().warnNumberDeclaredValue) {
          this.message(ParserMessages.numberDeclaredValue);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rNUTOKEN:
        declaredValue.reset(new TokenizedDeclaredValue(TokenizedDeclaredValue.TokenType.numberToken, false));
        if (this.options().warnNutokenDeclaredValue) {
          this.message(ParserMessages.nutokenDeclaredValue);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rNUTOKENS:
        declaredValue.reset(new TokenizedDeclaredValue(TokenizedDeclaredValue.TokenType.numberToken, true));
        if (this.options().warnNutokenDeclaredValue) {
          this.message(ParserMessages.nutokenDeclaredValue);
        }
        break;
      case Param.reservedName + Syntax.ReservedName.rNOTATION: {
        const allowNameGroup = new AllowedParams(Param.nameGroup);
        if (!this.parseParam(allowNameGroup, declInputLevel, parm)) {
          return false;
        }
        const group = new Vector<String<Char>>();
        group.resize(parm.nameTokenVector.size());
        for (let i = 0; i < group.size(); i++) {
          group.set(i, parm.nameTokenVector.get(i).name);
        }
        declaredValue.reset(new NotationDeclaredValue(group));
        allowedFlags = 0;
        break;
      }
      case Param.nameTokenGroup: {
        const group = new Vector<String<Char>>();
        const origGroup = new Vector<String<Char>>();
        group.resize(parm.nameTokenVector.size());
        origGroup.resize(parm.nameTokenVector.size());
        for (let i = 0; i < group.size(); i++) {
          group.set(i, parm.nameTokenVector.get(i).name);
          origGroup.set(i, parm.nameTokenVector.get(i).origName);
        }
        const grpVal = new NameTokenGroupDeclaredValue(group);
        grpVal.setOrigAllowedValues(origGroup);
        declaredValue.reset(grpVal);
        break;
      }
      case Param.reservedName + Syntax.ReservedName.rDATA: {
        const allowName = new AllowedParams(Param.paramName);
        if (!this.parseParam(allowName, declInputLevel, parm)) {
          return false;
        }
        const notation = this.lookupCreateNotation(parm.token);
        const allowDsoSilentValue = new AllowedParams(Param.dso, Param.silent);
        const attributes = new AttributeList(notation.pointer()!.attributeDef().attributeDefConst());
        if (this.parseParam(allowDsoSilentValue, declInputLevel, parm) && parm.type === Param.dso) {
          if (attributes.size() === 0 && !this.sd().www()) {
            this.message(ParserMessages.notationNoAttributes, new StringMessageArg(notation.pointer()!.name()));
          }
          const netEnabling = { value: false };
          const newAttDef = new Ptr<AttributeDefinitionList>(null);
          if (!this.parseAttributeSpec(Mode.asMode, attributes, netEnabling, newAttDef)) {
            return false;
          }
          if (!newAttDef.isNull()) {
            newAttDef.pointer()!.setIndex(this.defDtd().allocAttributeDefinitionListIndex());
            notation.pointer()!.setAttributeDef(newAttDef);
          }
          if (attributes.nSpec() === 0) {
            this.message(ParserMessages.emptyDataAttributeSpec);
          }
        } else {
          attributes.finish(this as any);
          // unget the first token of the default value
          this.currentInput()?.ungetToken();
        }
        declaredValue.reset(new DataDeclaredValue(new ConstPtr<Notation>(notation.pointer()), attributes));
        break;
      }
      default:
        throw new Error('CANNOT_HAPPEN in parseDeclaredValue');
    }

    if (isNotation) {
      if (!(allowedFlags & asDataAttribute)) {
        this.message(ParserMessages.dataAttributeDeclaredValue);
      }
    } else if (this.haveDefLpd() && !(allowedFlags & asLinkAttribute)) {
      this.message(ParserMessages.linkAttributeDeclaredValue);
    }
    return true;
  }

  // Port of Parser::parseDefaultValue from parseDecl.cxx
  protected parseDefaultValue(
    declInputLevel: number,
    isNotation: boolean,
    parm: Param,
    attributeName: StringC,
    declaredValue: Owner<DeclaredValue>,
    def: Owner<AttributeDefinition>,
    anyCurrentRef: { value: boolean }
  ): boolean {
    const allowDefaultValue = AllowedParams.fromArray([
      Param.indicatedReservedName + Syntax.ReservedName.rFIXED,
      Param.indicatedReservedName + Syntax.ReservedName.rREQUIRED,
      Param.indicatedReservedName + Syntax.ReservedName.rCURRENT,
      Param.indicatedReservedName + Syntax.ReservedName.rCONREF,
      Param.indicatedReservedName + Syntax.ReservedName.rIMPLIED,
      Param.attributeValue,
      Param.attributeValueLiteral
    ]);
    const allowTokenDefaultValue = AllowedParams.fromArray([
      Param.indicatedReservedName + Syntax.ReservedName.rFIXED,
      Param.indicatedReservedName + Syntax.ReservedName.rREQUIRED,
      Param.indicatedReservedName + Syntax.ReservedName.rCURRENT,
      Param.indicatedReservedName + Syntax.ReservedName.rCONREF,
      Param.indicatedReservedName + Syntax.ReservedName.rIMPLIED,
      Param.attributeValue,
      Param.tokenizedAttributeValueLiteral
    ]);

    if (!this.parseParam(
      declaredValue.pointer()!.tokenized() ? allowTokenDefaultValue : allowDefaultValue,
      declInputLevel,
      parm
    )) {
      return false;
    }

    switch (parm.type) {
      case Param.indicatedReservedName + Syntax.ReservedName.rFIXED: {
        const allowValue = new AllowedParams(Param.attributeValue, Param.attributeValueLiteral);
        const allowTokenValue = new AllowedParams(Param.attributeValue, Param.tokenizedAttributeValueLiteral);
        if (!this.parseParam(
          declaredValue.pointer()!.tokenized() ? allowTokenValue : allowValue,
          declInputLevel,
          parm
        )) {
          return false;
        }
        const specLength = { value: 0 };
        const value = declaredValue.pointer()!.makeValue(parm.literalText, this as any, attributeName, specLength);
        if (declaredValue.pointer()!.isId()) {
          this.message(ParserMessages.idDeclaredValue);
        }
        def.reset(new FixedAttributeDefinition(attributeName, declaredValue.extract()!, value));
        break;
      }
      case Param.attributeValue:
        if (this.options().warnAttributeValueNotLiteral) {
          this.message(ParserMessages.attributeValueNotLiteral);
        }
      // fall through
      case Param.attributeValueLiteral:
      case Param.tokenizedAttributeValueLiteral: {
        const specLength = { value: 0 };
        const value = declaredValue.pointer()!.makeValue(parm.literalText, this as any, attributeName, specLength);
        if (declaredValue.pointer()!.isId()) {
          this.message(ParserMessages.idDeclaredValue);
        }
        def.reset(new DefaultAttributeDefinition(attributeName, declaredValue.extract()!, value));
        break;
      }
      case Param.indicatedReservedName + Syntax.ReservedName.rREQUIRED:
        def.reset(new RequiredAttributeDefinition(attributeName, declaredValue.extract()!));
        break;
      case Param.indicatedReservedName + Syntax.ReservedName.rCURRENT:
        anyCurrentRef.value = true;
        if (declaredValue.pointer()!.isId()) {
          this.message(ParserMessages.idDeclaredValue);
        }
        def.reset(new CurrentAttributeDefinition(
          attributeName,
          declaredValue.extract()!,
          this.defDtd().allocCurrentAttributeIndex()
        ));
        if (isNotation) {
          this.message(ParserMessages.dataAttributeDefaultValue);
        } else if (this.haveDefLpd()) {
          this.message(ParserMessages.linkAttributeDefaultValue);
        } else if (this.options().warnCurrent) {
          this.message(ParserMessages.currentAttribute);
        }
        break;
      case Param.indicatedReservedName + Syntax.ReservedName.rCONREF:
        if (declaredValue.pointer()!.isId()) {
          this.message(ParserMessages.idDeclaredValue);
        }
        if (declaredValue.pointer()!.isNotation()) {
          this.message(ParserMessages.notationConref);
        }
        def.reset(new ConrefAttributeDefinition(attributeName, declaredValue.extract()!));
        if (isNotation) {
          this.message(ParserMessages.dataAttributeDefaultValue);
        } else if (this.haveDefLpd()) {
          this.message(ParserMessages.linkAttributeDefaultValue);
        } else if (this.options().warnConref) {
          this.message(ParserMessages.conrefAttribute);
        }
        break;
      case Param.indicatedReservedName + Syntax.ReservedName.rIMPLIED:
        def.reset(new ImpliedAttributeDefinition(attributeName, declaredValue.extract()!));
        break;
      default:
        throw new Error('CANNOT_HAPPEN in parseDefaultValue');
    }
    return true;
  }

  // Port of Parser::parseAttlistDecl from parseDecl.cxx
  protected parseAttlistDecl(): boolean {
    const declInputLevel = this.inputLevel();
    const parm = new Param();
    let attcnt = 0;
    let idIndex = -1;
    let notationIndex = -1;
    const anyCurrent = { value: false };

    const isNotation = { value: false };
    const attributed = new Vector<ElementType | Notation>();
    if (!this.parseAttributed(declInputLevel, parm, attributed, isNotation)) {
      return false;
    }

    const defs: Owner<AttributeDefinition>[] = [];
    const allowNameMdc = new AllowedParams(Param.paramName, Param.mdc);
    const allowName = new AllowedParams(Param.paramName);
    if (!this.parseParam(this.sd().www() ? allowNameMdc : allowName, declInputLevel, parm)) {
      return false;
    }

    while (parm.type !== Param.mdc) {
      const attributeName = new String<Char>();
      const origAttributeName = new String<Char>();
      attributeName.swap(parm.token);
      origAttributeName.swap(parm.origToken);
      attcnt++;

      let duplicate = false;
      for (let i = 0; i < defs.length; i++) {
        if (defs[i].pointer()!.name().equals(attributeName)) {
          this.message(ParserMessages.duplicateAttributeDef, new StringMessageArg(attributeName));
          duplicate = true;
          break;
        }
      }

      const declaredValue = new Owner<DeclaredValue>(null);
      if (!this.parseDeclaredValue(declInputLevel, isNotation.value, parm, declaredValue)) {
        return false;
      }

      if (!duplicate) {
        if (declaredValue.pointer()!.isId()) {
          if (idIndex !== -1) {
            this.message(ParserMessages.multipleIdAttributes, new StringMessageArg(defs[idIndex].pointer()!.name()));
          }
          idIndex = defs.length;
        } else if (declaredValue.pointer()!.isNotation()) {
          if (notationIndex !== -1) {
            this.message(ParserMessages.multipleNotationAttributes, new StringMessageArg(defs[notationIndex].pointer()!.name()));
          }
          notationIndex = defs.length;
        }
      }

      const tokensPtr = declaredValue.pointer()!.getTokens();
      if (tokensPtr) {
        const nTokens = tokensPtr.size();
        if (!this.sd().www()) {
          for (let i = 0; i < nTokens; i++) {
            for (let j = 0; j < defs.length; j++) {
              if (defs[j].pointer()!.containsToken(tokensPtr.get(i))) {
                this.message(ParserMessages.duplicateAttributeToken, new StringMessageArg(tokensPtr.get(i)));
                break;
              }
            }
          }
        }
        attcnt += nTokens;
      }

      const def = new Owner<AttributeDefinition>(null);
      if (!this.parseDefaultValue(declInputLevel, isNotation.value, parm, attributeName, declaredValue, def, anyCurrent)) {
        return false;
      }

      if (this.haveDefLpd() && this.defLpd().type() === Lpd.Type.simpleLink && !def.pointer()!.isFixed()) {
        this.message(ParserMessages.simpleLinkFixedAttribute);
      }
      def.pointer()!.setOrigName(origAttributeName);

      if (!duplicate) {
        defs.push(def);
      }

      if (!this.parseParam(allowNameMdc, declInputLevel, parm)) {
        return false;
      }
    }

    if (attcnt > this.syntax().attcnt()) {
      this.message(ParserMessages.attcnt, new NumberMessageArg(attcnt), new NumberMessageArg(this.syntax().attcnt()));
    }

    // Create AttributeDefinitionList from defs
    const defsVector = new Vector<CopyOwner<AttributeDefinition>>();
    defsVector.resize(defs.length);
    for (let i = 0; i < defs.length; i++) {
      defsVector.set(i, new CopyOwner<AttributeDefinition>(defs[i].extract()));
    }

    if (this.haveDefLpd() && !isNotation.value) {
      // LPD handling (simplified)
      // Skip for now - full implementation would handle simple and complex link
    } else {
      const adl = new Ptr<AttributeDefinitionList>(
        new AttributeDefinitionList(
          defsVector,
          this.defDtd().allocAttributeDefinitionListIndex(),
          anyCurrent.value,
          idIndex,
          notationIndex
        )
      );

      // Helper to get attribute def Ptr
      const getAttrDefPtr = (attr: ElementType | Notation): Ptr<AttributeDefinitionList> => {
        if (isNotation.value) {
          return (attr as Notation).attributeDef().attributeDef();
        } else {
          return (attr as ElementType).attributeDef();
        }
      };

      for (let i = 0; i < attributed.size(); i++) {
        const attr = attributed.get(i);
        if (getAttrDefPtr(attr).isNull()) {
          attr.setAttributeDef(adl);
          if (!isNotation.value) {
            const e = attr as ElementType;
            if (e.definition()) {
              this.checkElementAttribute(e);
            }
          }
        } else if (this.options().errorAfdr && !this.sd().www()) {
          if (isNotation.value) {
            this.message(ParserMessages.duplicateAttlistNotation, new StringMessageArg((attr as Notation).name()));
          } else {
            this.message(ParserMessages.duplicateAttlistElement, new StringMessageArg((attr as ElementType).name()));
          }
        } else {
          // AFDR handling - append attributes to existing list
          if (!this.hadAfdrDecl() && !this.sd().www()) {
            this.message(ParserMessages.missingAfdrDecl);
            this.setHadAfdrDecl();
          }
          const curAdl = getAttrDefPtr(attr).pointer()!;
          const oldSize = curAdl.size();

          // Copy if shared
          if (curAdl.count() !== 1) {
            const copy = new Vector<CopyOwner<AttributeDefinition>>();
            copy.resize(oldSize);
            for (let j = 0; j < oldSize; j++) {
              copy.set(j, new CopyOwner<AttributeDefinition>(curAdl.def(j)!.copy()));
            }
            const adlCopy = new Ptr<AttributeDefinitionList>(
              new AttributeDefinitionList(
                copy,
                this.defDtd().allocAttributeDefinitionListIndex(),
                curAdl.anyCurrent(),
                curAdl.idIndex(),
                curAdl.notationIndex()
              )
            );
            attr.setAttributeDef(adlCopy);
          }

          // Append new attributes
          const finalAdl = getAttrDefPtr(attr).pointer()!;
          for (let j = 0; j < adl.pointer()!.size(); j++) {
            const index = { value: 0 };
            if (!finalAdl.attributeIndex(adl.pointer()!.def(j)!.name(), index)) {
              const idx = finalAdl.idIndex();
              if (idx !== -1 && adl.pointer()!.def(j)!.isId()) {
                this.message(ParserMessages.multipleIdAttributes, new StringMessageArg(finalAdl.def(idx)!.name()));
              }
              const nidx = finalAdl.notationIndex();
              if (nidx !== -1 && adl.pointer()!.def(j)!.isNotation()) {
                this.message(ParserMessages.multipleNotationAttributes, new StringMessageArg(finalAdl.def(nidx)!.name()));
              }
              finalAdl.append(adl.pointer()!.def(j)!.copy());
            } else {
              const tem = { value: false };
              if (finalAdl.def(index.value)!.isSpecified(tem)) {
                this.message(ParserMessages.specifiedAttributeRedeclared, new StringMessageArg(adl.pointer()!.def(j)!.name()));
              }
            }
          }

          if (!isNotation.value) {
            const e = attr as ElementType;
            if (e.definition()) {
              this.checkElementAttribute(e, oldSize);
            }
          }
        }
      }
    }

    // Fire events
    if (this.currentMarkup()) {
      if (isNotation.value) {
        const v = new Vector<ConstPtr<Notation>>();
        v.resize(attributed.size());
        for (let i = 0; i < attributed.size(); i++) {
          v.set(i, new ConstPtr<Notation>(attributed.get(i) as Notation));
        }
        this.eventHandler().attlistNotationDecl(
          new AttlistNotationDeclEvent(v, this.markupLocation(), this.currentMarkup()!)
        );
      } else {
        const v = new Vector<ElementType>();
        v.resize(attributed.size());
        for (let i = 0; i < attributed.size(); i++) {
          v.set(i, attributed.get(i) as ElementType);
        }
        if (this.haveDefLpd()) {
          this.eventHandler().linkAttlistDecl(
            new LinkAttlistDeclEvent(v, new ConstPtr<Lpd>(this.defLpdPointer().pointer()), this.markupLocation(), this.currentMarkup()!)
          );
        } else {
          this.eventHandler().attlistDecl(
            new AttlistDeclEvent(v, this.currentDtdPointer(), this.markupLocation(), this.currentMarkup()!)
          );
        }
      }
    }

    // Update entities with notation attributes
    if (isNotation.value) {
      const entityIter = this.defDtd().generalEntityIter();
      for (;;) {
        const entity = entityIter.next();
        if (entity.isNull()) {
          break;
        }
        const external = entity.pointer()!.asExternalDataEntity();
        if (external) {
          const entityNotation = external.notation();
          for (let i = 0; i < attributed.size(); i++) {
            if (attributed.get(i) === entityNotation) {
              const attributes = new AttributeList(entityNotation.attributeDef().attributeDefConst());
              attributes.finish(this as any);
              external.setNotation(new ConstPtr<Notation>(attributed.get(i) as Notation), attributes);
            }
          }
        }
      }
    }

    return true;
  }

  protected parseShortrefDecl(): boolean {
    // Shortref declaration parsing
    // Full implementation in parseDecl.cxx lines 1938-2062
    // Stub - skip the declaration for now
    this.skipDeclaration(this.inputLevel());
    return true;
  }

  protected parseUsemapDecl(): boolean {
    // Usemap declaration parsing
    // Stub - skip the declaration for now
    this.skipDeclaration(this.inputLevel());
    return true;
  }

  protected parseLinkDecl(): boolean {
    // Link declaration parsing (for LPD)
    // Stub - skip the declaration for now
    this.skipDeclaration(this.inputLevel());
    return true;
  }

  protected parseIdlinkDecl(): boolean {
    // ID link declaration parsing (for LPD)
    // Stub - skip the declaration for now
    this.skipDeclaration(this.inputLevel());
    return true;
  }

  protected parseDoctypeDeclEnd(fake: boolean = false): boolean {
    // End of DOCTYPE declaration parsing
    // Port from parseDecl.cxx
    this.checkDtd(this.defDtd());
    this.endDtd();
    return true;
  }

  protected parseLinktypeDeclEnd(): boolean {
    // End of LINKTYPE declaration parsing
    // Port from parseDecl.cxx
    this.endLpd();
    return true;
  }

  protected checkDtd(dtd: Dtd): void {
    // Validate the DTD
    // Simplified stub - full implementation checks for undefined elements, etc.
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
          this.message(ParserMessages.instanceStartOmittag);
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
          if (this.eventsWanted().wantInstanceMarkup()) {
            this.eventHandler().entityEnd(new EntityEndEvent(this.currentLocation()));
          }
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
          this.acceptPcdata(this.currentLocation());
          this.queueRe(this.currentLocation());
          break;

        case TokenEnum.tokenRs:
          // Record start
          this.acceptPcdata(this.currentLocation());
          this.noteRs();
          if (this.eventsWanted().wantInstanceMarkup()) {
            this.eventHandler().ignoredRs(
              new IgnoredRsEvent(this.currentChar(), this.currentLocation())
            );
          }
          break;

        case TokenEnum.tokenS:
          // Separator (whitespace)
          this.extendContentS();
          if (this.eventsWanted().wantInstanceMarkup()) {
            const input = this.currentInput();
            if (input) {
              const data = new Uint32Array(input.currentTokenStart());
              this.eventHandler().sSep(
                new SSepEvent(data, input.currentTokenLength(), this.currentLocation(), false)
              );
            }
          }
          break;

        case TokenEnum.tokenIgnoredChar:
          // Character in ignored marked section
          this.extendData();
          if (this.eventsWanted().wantMarkedSections()) {
            const input = this.currentInput();
            if (input) {
              const data = new Uint32Array(input.currentTokenStart());
              this.eventHandler().ignoredChars(
                new IgnoredCharsEvent(data, input.currentTokenLength(), this.currentLocation(), false)
              );
            }
          }
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

  // Mode table flags from parseMode.cxx
  private static readonly modeUsedInSd = 0o01;
  private static readonly modeUsedInProlog = 0o02;
  private static readonly modeUsedInInstance = 0o04;
  private static readonly modeUsesSr = 0o010;

  // Mode table from parseMode.cxx
  private static readonly modeTable: Array<{ mode: Mode; flags: number }> = [
    { mode: Mode.grpMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.alitMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.alitaMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.aliteMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.talitMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.talitaMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.taliteMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.mdMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.mdMinusMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.mdPeroMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.sdMode, flags: ParserState.modeUsedInSd },
    { mode: Mode.comMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.sdcomMode, flags: ParserState.modeUsedInSd },
    { mode: Mode.piMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.refMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance | ParserState.modeUsedInSd },
    { mode: Mode.imsMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.cmsMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.rcmsMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInInstance },
    { mode: Mode.proMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.dsMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.dsiMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.plitMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.plitaMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.pliteMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.sdplitMode, flags: ParserState.modeUsedInSd },
    { mode: Mode.sdplitaMode, flags: ParserState.modeUsedInSd },
    { mode: Mode.grpsufMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.mlitMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInSd },
    { mode: Mode.mlitaMode, flags: ParserState.modeUsedInProlog | ParserState.modeUsedInSd },
    { mode: Mode.asMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.piPasMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.slitMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.slitaMode, flags: ParserState.modeUsedInProlog },
    { mode: Mode.sdslitMode, flags: ParserState.modeUsedInSd },
    { mode: Mode.sdslitaMode, flags: ParserState.modeUsedInSd },
    { mode: Mode.cconMode, flags: ParserState.modeUsedInInstance },
    { mode: Mode.rcconMode, flags: ParserState.modeUsedInInstance },
    { mode: Mode.cconnetMode, flags: ParserState.modeUsedInInstance },
    { mode: Mode.rcconnetMode, flags: ParserState.modeUsedInInstance },
    { mode: Mode.rcconeMode, flags: ParserState.modeUsedInInstance },
    { mode: Mode.tagMode, flags: ParserState.modeUsedInInstance },
    { mode: Mode.econMode, flags: ParserState.modeUsedInInstance | ParserState.modeUsesSr },
    { mode: Mode.mconMode, flags: ParserState.modeUsedInInstance | ParserState.modeUsesSr },
    { mode: Mode.econnetMode, flags: ParserState.modeUsedInInstance | ParserState.modeUsesSr },
    { mode: Mode.mconnetMode, flags: ParserState.modeUsedInInstance | ParserState.modeUsesSr },
  ];

  protected compileSdModes(): void {
    const modes: Mode[] = [];
    for (let i = 0; i < ParserState.modeTable.length; i++) {
      if (ParserState.modeTable[i].flags & ParserState.modeUsedInSd) {
        modes.push(ParserState.modeTable[i].mode);
      }
    }
    this.compileModes(modes, modes.length, null);
  }

  protected compilePrologModes(): void {
    const scopeInstance = this.sd().scopeInstance();
    const haveSr = this.syntax().hasShortrefs();
    const modes: Mode[] = [];

    for (let i = 0; i < ParserState.modeTable.length; i++) {
      if (scopeInstance) {
        if (ParserState.modeTable[i].flags & ParserState.modeUsedInProlog) {
          modes.push(ParserState.modeTable[i].mode);
        }
      } else if (haveSr) {
        if (
          (ParserState.modeTable[i].flags &
            (ParserState.modeUsedInInstance | ParserState.modeUsedInProlog)) &&
          !(ParserState.modeTable[i].flags & ParserState.modeUsesSr)
        ) {
          modes.push(ParserState.modeTable[i].mode);
        }
      } else {
        if (
          ParserState.modeTable[i].flags &
          (ParserState.modeUsedInInstance | ParserState.modeUsedInProlog)
        ) {
          modes.push(ParserState.modeTable[i].mode);
        }
      }
    }
    this.compileModes(modes, modes.length, null);
  }

  protected compileInstanceModes(): void {
    const scopeInstance = this.sd().scopeInstance();
    this.compileNormalMap();
    if (!scopeInstance && !this.syntax().hasShortrefs()) {
      return;
    }
    const modes: Mode[] = [];
    for (let i = 0; i < ParserState.modeTable.length; i++) {
      if (scopeInstance) {
        if (ParserState.modeTable[i].flags & ParserState.modeUsedInInstance) {
          modes.push(ParserState.modeTable[i].mode);
        }
      } else {
        if (ParserState.modeTable[i].flags & ParserState.modeUsesSr) {
          modes.push(ParserState.modeTable[i].mode);
        }
      }
    }
    this.compileModes(modes, modes.length, this.currentDtd());
  }

  protected compileModes(modes: Mode[], n: number, dtd: Dtd | null): void {
    const sets: PackedBoolean[] = new Array(Syntax.nSet).fill(false);
    const delims: PackedBoolean[] = new Array(Syntax.nDelimGeneral).fill(false);
    const functions: PackedBoolean[] = new Array(3).fill(false);
    let i: number;
    let includesShortref: Boolean = false;

    for (i = 0; i < n; i++) {
      const iter = new ModeInfo(modes[i], this.sd());
      const ti = new TokenInfo();
      while (iter.nextToken(ti)) {
        switch (ti.type) {
          case TokenInfo.Type.delimType:
            delims[ti.delim1] = true;
            break;
          case TokenInfo.Type.delimDelimType:
            delims[ti.delim1] = true;
            delims[ti.delim2] = true;
            break;
          case TokenInfo.Type.delimSetType:
            delims[ti.delim1] = true;
            // fall through
          case TokenInfo.Type.setType:
            sets[ti.set] = true;
            break;
          case TokenInfo.Type.functionType:
            functions[ti.function] = true;
            break;
        }
      }
      if (!includesShortref && iter.includesShortref()) {
        includesShortref = true;
      }
    }

    const chars = new ISet<Char>();

    for (i = 0; i < 3; i++) {
      if (functions[i]) {
        chars.add(this.syntax().standardFunction(i));
      }
    }
    for (i = 0; i < Syntax.nDelimGeneral; i++) {
      if (delims[i]) {
        const str = this.syntax().delimGeneral(i);
        for (let j = 0; j < str.size(); j++) {
          chars.add(str.get(j));
        }
      }
    }
    if (includesShortref && dtd) {
      const nSr = dtd.nShortref();
      for (let si = 0; si < nSr; si++) {
        const delim = dtd.shortref(si);
        const len = delim.size();
        for (let j = 0; j < len; j++) {
          if (delim.get(j) === this.sd().execToInternal('B'.charCodeAt(0))) {
            sets[Syntax.Set.blank] = true;
          } else {
            chars.add(delim.get(j));
          }
        }
      }
    }

    const csets: Array<ISet<Char> | null> = [];
    let usedSets = 0;
    for (i = 0; i < Syntax.nSet; i++) {
      if (sets[i]) {
        csets[usedSets++] = this.syntax().charSet(i);
      }
    }

    const partition = new Partition(
      chars,
      csets,
      usedSets,
      this.syntax().generalSubstTable()
    );

    const setCodes: Array<String<EquivCode>> = new Array(Syntax.nSet);
    for (i = 0; i < Syntax.nSet; i++) {
      setCodes[i] = new String<EquivCode>();
    }

    let nCodes = 0;
    for (i = 0; i < Syntax.nSet; i++) {
      if (sets[i]) {
        setCodes[i] = partition.setCodes(nCodes++);
      }
    }

    const delimCodes: Array<String<EquivCode>> = new Array(Syntax.nDelimGeneral);
    for (i = 0; i < Syntax.nDelimGeneral; i++) {
      delimCodes[i] = new String<EquivCode>();
      if (delims[i]) {
        const str = this.syntax().delimGeneral(i);
        for (let j = 0; j < str.size(); j++) {
          delimCodes[i].appendChar(partition.charCode(str.get(j)));
        }
      }
    }

    const functionCode: Array<String<EquivCode>> = new Array(3);
    for (i = 0; i < 3; i++) {
      functionCode[i] = new String<EquivCode>();
      if (functions[i]) {
        functionCode[i].appendChar(
          partition.charCode(this.syntax().standardFunction(i))
        );
      }
    }

    const srInfo: SrInfo[] = [];
    let nShortref: number;
    if (!includesShortref || !dtd) {
      nShortref = 0;
    } else {
      nShortref = dtd.nShortref();
      for (i = 0; i < nShortref; i++) {
        srInfo.push(new SrInfo());
      }

      for (i = 0; i < nShortref; i++) {
        const delim = dtd.shortref(i);
        const p = srInfo[i];
        let j: number;
        for (j = 0; j < delim.size(); j++) {
          if (delim.get(j) === this.sd().execToInternal('B'.charCodeAt(0))) {
            break;
          }
          p.chars.appendChar(partition.charCode(delim.get(j)));
        }
        if (j < delim.size()) {
          p.bSequenceLength = 1;
          for (++j; j < delim.size(); j++) {
            if (delim.get(j) !== this.sd().execToInternal('B'.charCodeAt(0))) {
              break;
            }
            p.bSequenceLength += 1;
          }
          for (; j < delim.size(); j++) {
            p.chars2.appendChar(partition.charCode(delim.get(j)));
          }
        } else {
          p.bSequenceLength = 0;
        }
      }
    }

    const emptyString = new String<EquivCode>();
    const multicode = this.syntax().multicode();

    for (i = 0; i < n; i++) {
      const tb = new TrieBuilder(partition.maxCode() + 1);
      const ambiguities = new Vector<Token>();
      const suppressTokens = new Vector<Token>();

      if (multicode) {
        suppressTokens.assign(partition.maxCode() + 1, 0);
        suppressTokens.set(partition.eECode(), TokenEnum.tokenEe);
      }
      tb.recognizeEE(partition.eECode(), TokenEnum.tokenEe);

      const iter = new ModeInfo(modes[i], this.sd());
      const ti = new TokenInfo();
      // Handle the possibility that some delimiters may be empty
      while (iter.nextToken(ti)) {
        switch (ti.type) {
          case TokenInfo.Type.delimType:
            if (delimCodes[ti.delim1].size() > 0) {
              tb.recognize(delimCodes[ti.delim1], ti.token, ti.priority, ambiguities);
            }
            break;
          case TokenInfo.Type.delimDelimType:
            {
              const str = new String<EquivCode>();
              str.appendString(delimCodes[ti.delim1]);
              if (str.size() > 0 && delimCodes[ti.delim2].size() > 0) {
                str.appendString(delimCodes[ti.delim2]);
                tb.recognize(str, ti.token, ti.priority, ambiguities);
              }
            }
            break;
          case TokenInfo.Type.delimSetType:
            if (delimCodes[ti.delim1].size() > 0) {
              tb.recognize(
                delimCodes[ti.delim1],
                setCodes[ti.set],
                ti.token,
                ti.priority,
                ambiguities
              );
            }
            break;
          case TokenInfo.Type.setType:
            tb.recognize(
              emptyString,
              setCodes[ti.set],
              ti.token,
              ti.priority,
              ambiguities
            );
            if (multicode) {
              const equivCodes = setCodes[ti.set];
              for (let j = 0; j < equivCodes.size(); j++) {
                suppressTokens.set(equivCodes.get(j), ti.token);
              }
            }
            break;
          case TokenInfo.Type.functionType:
            tb.recognize(
              functionCode[ti.function],
              ti.token,
              ti.priority,
              ambiguities
            );
            if (multicode) {
              suppressTokens.set(functionCode[ti.function].get(0), ti.token);
            }
            break;
        }
      }

      if (iter.includesShortref()) {
        for (let j = 0; j < nShortref; j++) {
          const p = srInfo[j];
          if (p.bSequenceLength > 0) {
            tb.recognizeB(
              p.chars,
              p.bSequenceLength,
              this.syntax().quantity(Syntax.Quantity.qBSEQLEN),
              setCodes[Syntax.Set.blank],
              p.chars2,
              TokenEnum.tokenFirstShortref + j,
              ambiguities
            );
          } else {
            tb.recognize(
              p.chars,
              TokenEnum.tokenFirstShortref + j,
              Priority.delim,
              ambiguities
            );
          }
        }
      }

      const trie = tb.extractTrie();
      if (trie) {
        if (multicode) {
          this.setRecognizer(
            modes[i],
            new ConstPtr(new Recognizer(trie, partition.map(), suppressTokens))
          );
        } else {
          this.setRecognizer(
            modes[i],
            new ConstPtr(new Recognizer(trie, partition.map()))
          );
        }
      }

      // Report ambiguities
      for (let j = 0; j < ambiguities.size(); j += 2) {
        this.message(
          ParserMessages.lexicalAmbiguity,
          new TokenMessageArg(
            ambiguities.get(j),
            modes[i],
            this.syntaxPointer(),
            this.sdPointer()
          ),
          new TokenMessageArg(
            ambiguities.get(j + 1),
            modes[i],
            this.syntaxPointer(),
            this.sdPointer()
          )
        );
      }
    }
  }

  protected compileNormalMap(): void {
    const map = new XcharMap<PackedBoolean>(false);
    const sgmlCharSet = this.syntax().charSet(Syntax.Set.sgmlChar);
    if (sgmlCharSet) {
      const sgmlCharIter = new ISetIter<Char>(sgmlCharSet);
      const result = { fromMin: 0 as Char, fromMax: 0 as Char };
      while (sgmlCharIter.next(result)) {
        map.setRange(result.fromMin, result.fromMax, true);
      }
    }

    const iter = new ModeInfo(Mode.mconnetMode, this.sd());
    const ti = new TokenInfo();
    while (iter.nextToken(ti)) {
      switch (ti.type) {
        case TokenInfo.Type.delimType:
        case TokenInfo.Type.delimDelimType:
        case TokenInfo.Type.delimSetType:
          {
            const delim = this.syntax().delimGeneral(ti.delim1);
            if (delim.size() === 0) break;
            const c = delim.get(0);
            map.setChar(c, false);
            const str = this.syntax().generalSubstTable().inverse(c);
            for (let i = 0; i < str.size(); i++) {
              map.setChar(str.get(i), false);
            }
          }
          break;
        case TokenInfo.Type.setType:
          if (ti.token !== TokenEnum.tokenChar) {
            const charSet = this.syntax().charSet(ti.set);
            if (charSet) {
              const setIter = new ISetIter<Char>(charSet);
              const result = { fromMin: 0 as Char, fromMax: 0 as Char };
              while (setIter.next(result)) {
                map.setRange(result.fromMin, result.fromMax, false);
              }
            }
          }
          break;
        case TokenInfo.Type.functionType:
          if (ti.token !== TokenEnum.tokenChar) {
            map.setChar(this.syntax().standardFunction(ti.function), false);
          }
          break;
      }
    }

    const nShortref = this.currentDtd().nShortref();
    for (let i = 0; i < nShortref; i++) {
      const shortref = this.currentDtd().shortref(i);
      if (shortref.size() === 0) continue;
      const c = shortref.get(0);
      if (c === this.sd().execToInternal('B'.charCodeAt(0))) {
        const blankSet = this.syntax().charSet(Syntax.Set.blank);
        if (blankSet) {
          const setIter = new ISetIter<Char>(blankSet);
          const result = { fromMin: 0 as Char, fromMax: 0 as Char };
          while (setIter.next(result)) {
            map.setRange(result.fromMin, result.fromMax, false);
          }
        }
      } else {
        map.setChar(c, false);
        const str = this.syntax().generalSubstTable().inverse(c);
        for (let j = 0; j < str.size(); j++) {
          map.setChar(str.get(j), false);
        }
      }
    }

    this.setNormalMap(map);
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
    // buf is already StringC (String<Char>)
    this.eventHandler().pi(new ImmediatePiEvent(buf, location));

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

  protected parsePcdata(): void {
    // Port of parsePcdata from parseInstance.cxx (lines 397-409)
    this.extendData();
    this.acceptPcdata(this.currentLocation());
    this.noteData();
    const input = this.currentInput();
    if (input) {
      const data = new Uint32Array(input.currentTokenStart());
      this.eventHandler().data(
        new ImmediateDataEvent(
          Event.Type.characterData,
          data,
          input.currentTokenLength(),
          this.currentLocation(),
          false
        )
      );
    }
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

  protected doParseStartTag(netEnabling: { value: boolean }): StartElementEvent | null {
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
      elementType = this.lookupCreateUndefinedElement(
        name,
        this.currentLocation(),
        this.currentDtdNonConst(),
        this.implydefElement() !== Sd.ImplydefElement.implydefElementAnyother
      );
    }

    // Allocate attribute list
    const attributes = this.allocAttributeList(elementType.attributeDef().asConst(), 0);
    if (!attributes) return null; // Safety check

    // Parse closing token or attributes
    const closeToken = this.getToken(Mode.tagMode);

    if (closeToken === TokenEnum.tokenTagc) {
      // Simple tag with no attributes: <name>
      if (name.size() > this.syntax().taglen()) {
        this.checkTaglen(this.markupLocation().index());
      }
      attributes.finish(this as any);
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
    return new StartElementEvent(
      elementType,
      this.currentDtdPointer(),
      attributes,
      this.markupLocation(),
      markup
    );
  }

  protected parseEndTag(): EndElementEvent | null {
    // Port of parseEndTag from parseInstance.cxx (lines 1003-1010)
    const markup = this.startMarkup(this.eventsWanted().wantInstanceMarkup(), this.currentLocation());
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dETAGO);
    }

    return this.doParseEndTag();
  }

  protected doParseEndTag(): EndElementEvent | null {
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
      elementType = this.lookupCreateUndefinedElement(
        name,
        this.currentLocation(),
        this.currentDtdNonConst(),
        this.implydefElement() !== Sd.ImplydefElement.implydefElementAnyother
      );
    }

    this.parseEndTagClose();

    // Create EndElementEvent
    return new EndElementEvent(
      elementType,
      this.currentDtdPointer(),
      this.markupLocation(),
      markup
    );
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

  // Port of parseInstance.cxx lines 639-682
  protected acceptStartTag(
    e: ElementType,
    event: StartElementEvent,
    netEnabling: Boolean
  ): void {
    if (e.definition()?.undefined() && this.implydefElement() === Sd.ImplydefElement.implydefElementNo) {
      this.message(ParserMessages.undefinedElement, new StringMessageArg(e.name()));
    }
    if (this.elementIsExcluded(e)) {
      this.keepMessages();
      if (this.validate()) {
        this.checkExclusion(e);
      }
    } else {
      if (this.currentElement().tryTransition(e)) {
        this.pushElementCheck(e, event, netEnabling);
        return;
      }
      if (this.elementIsIncluded(e)) {
        event.setIncluded();
        this.pushElementCheck(e, event, netEnabling);
        return;
      }
      this.keepMessages();
    }
    const undoList = new IList<Undo>();
    const eventList = new IList<Event>();
    let startImpliedCount = 0;
    let attributeListIndex = 1;
    const startImpliedCountRef = { value: startImpliedCount };
    const attributeListIndexRef = { value: attributeListIndex };
    while (
      this.tryImplyTag(
        event.location(),
        startImpliedCountRef,
        attributeListIndexRef,
        undoList,
        eventList
      )
    ) {
      if (this.tryStartTag(e, event, netEnabling, eventList)) {
        return;
      }
    }
    this.discardKeptMessages();
    this.undo(undoList);
    if (this.validate() && !e.definition()?.undefined()) {
      this.handleBadStartTag(e, event, netEnabling);
    } else {
      if (
        this.validate()
          ? this.implydefElement() !== Sd.ImplydefElement.implydefElementNo
          : this.afterDocumentElement()
      ) {
        this.message(ParserMessages.elementNotAllowed, new StringMessageArg(e.name()));
      }
      // If element couldn't occur because it was excluded, then
      // do the transition here.
      this.currentElement().tryTransition(e);
      this.pushElementCheck(e, event, netEnabling);
    }
  }

  // Port of parseInstance.cxx lines 1130-1154
  protected acceptEndTag(event: EndElementEvent): void {
    const e = event.elementType();
    if (!this.elementIsOpen(e)) {
      this.message(ParserMessages.elementNotOpen, new StringMessageArg(e.name()));
      // delete event - JavaScript GC handles this
      return;
    }
    for (;;) {
      if (this.currentElement().type() === e) {
        break;
      }
      if (!this.currentElement().isFinished() && this.validate()) {
        this.message(
          ParserMessages.elementNotFinished,
          new StringMessageArg(this.currentElement().type().name())
        );
      }
      this.implyCurrentElementEnd(event.location());
    }
    if (!this.currentElement().isFinished() && this.validate()) {
      this.message(
        ParserMessages.elementEndTagNotFinished,
        new StringMessageArg(this.currentElement().type().name())
      );
    }
    if (this.currentElement().included()) {
      event.setIncluded();
    }
    this.noteEndElement(event.included());
    this.eventHandler().endElement(event);
    this.popElement();
  }

  // Port of parseInstance.cxx lines 1156-1179
  protected implyCurrentElementEnd(loc: Location): void {
    if (!this.sd().omittag()) {
      this.message(
        ParserMessages.omitEndTagOmittag,
        new StringMessageArg(this.currentElement().type().name())
        // TODO: Add currentElement().startLocation() as second arg
      );
    } else {
      const def = this.currentElement().type().definition();
      if (def && !def.canOmitEndTag()) {
        this.message(
          ParserMessages.omitEndTagDeclare,
          new StringMessageArg(this.currentElement().type().name())
          // TODO: Add currentElement().startLocation() as second arg
        );
      }
    }
    const event = new EndElementEvent(
      this.currentElement().type(),
      this.currentDtdPointer(),
      loc,
      null
    );
    if (this.currentElement().included()) {
      event.setIncluded();
    }
    this.noteEndElement(event.included());
    this.eventHandler().endElement(event);
    this.popElement();
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

    const attributes = this.allocAttributeList(e.attributeDef().asConst(), 0);
    if (attributes) {
      attributes.finish(this as any);
    }

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

    const input = this.currentInput();
    if (!input) return;

    const markup = this.startMarkup(this.eventsWanted().wantInstanceMarkup(), this.currentLocation());
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dSTAGO);
      markup.addDelim(Syntax.DelimGeneral.dGRPO);
    }

    const active: { value: Boolean } = { value: false };
    if (!this.parseTagNameGroup(active, true)) {
      return;
    }

    input.startToken();
    const c = input.tokenChar(this);
    if (!this.syntax().isNameStartCharacter(c)) {
      this.message(ParserMessages.startTagMissingName);
      return;
    }

    if (active.value) {
      const netEnabling: { value: boolean } = { value: false };
      const event = this.doParseStartTag(netEnabling);
      if (netEnabling.value) {
        this.message(ParserMessages.startTagGroupNet);
      }
      if (event) {
        this.acceptStartTag(event.elementType(), event, netEnabling.value);
      }
    } else {
      input.discardInitial();
      this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);
      if (this.currentMarkup()) {
        this.currentMarkup()!.addName(input);
      }
      this.skipAttributeSpec();
      if (this.currentMarkup()) {
        this.eventHandler().ignoredMarkup(
          new IgnoredMarkupEvent(this.markupLocation(), this.currentMarkup()!)
        );
      }
      this.noteMarkup();
    }
  }

  protected parseGroupEndTag(): void {
    // Port of parseGroupEndTag from parseInstance.cxx (lines 581-612)
    // Group end tag with name group: </(name1|name2)

    const input = this.currentInput();
    if (!input) return;

    const markup = this.startMarkup(this.eventsWanted().wantInstanceMarkup(), this.currentLocation());
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dETAGO);
      markup.addDelim(Syntax.DelimGeneral.dGRPO);
    }

    const active: { value: Boolean } = { value: false };
    if (!this.parseTagNameGroup(active, false)) {
      return;
    }

    input.startToken();
    const c = input.tokenChar(this);
    if (!this.syntax().isNameStartCharacter(c)) {
      this.message(ParserMessages.endTagMissingName);
      return;
    }

    if (active.value) {
      const event = this.doParseEndTag();
      if (event) {
        this.acceptEndTag(event);
      }
    } else {
      input.discardInitial();
      this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);
      if (this.currentMarkup()) {
        this.currentMarkup()!.addName(input);
      }
      this.parseEndTagClose();
      if (this.currentMarkup()) {
        this.eventHandler().ignoredMarkup(
          new IgnoredMarkupEvent(this.markupLocation(), this.currentMarkup()!)
        );
      }
      this.noteMarkup();
    }
  }

  protected emptyCommentDecl(): void {
    // Port of emptyCommentDecl from parseDecl.cxx (lines 3568-3579)
    // Empty comment declaration <!-- -->

    const markup = this.startMarkup(this.eventsWanted().wantCommentDecls(), this.currentLocation());
    if (markup) {
      markup.addDelim(Syntax.DelimGeneral.dMDO);
      markup.addDelim(Syntax.DelimGeneral.dMDC);
      this.eventHandler().commentDecl(
        new CommentDeclEvent(this.markupLocation(), markup)
      );
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
          // Fire CommentDeclEvent
          if (markup) {
            this.eventHandler().commentDecl(
              new CommentDeclEvent(this.markupLocation(), markup)
            );
          }
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

    if (this.markedSectionLevel() === this.syntax().taglvl()) {
      this.message(
        ParserMessages.markedSectionLevel,
        new NumberMessageArg(this.syntax().taglvl())
      );
    }

    if (!this.inInstance() &&
        this.options().warnInternalSubsetMarkedSection &&
        this.inputLevel() === 1) {
      this.message(ParserMessages.internalSubsetMarkedSection);
    }

    if (this.markedSectionSpecialLevel() > 0) {
      this.startMarkedSection(this.markupLocation());
      const wantMarkup = this.inInstance()
        ? this.eventsWanted().wantMarkedSections()
        : this.eventsWanted().wantPrologMarkup();
      if (wantMarkup) {
        const input = this.currentInput();
        if (input) {
          const tokenStart = input.currentTokenStart();
          const tokenData = new Uint32Array(tokenStart);
          this.eventHandler().ignoredChars(
            new IgnoredCharsEvent(
              tokenData,
              input.currentTokenLength(),
              this.currentLocation(),
              false
            )
          );
        }
      }
      return true;
    }

    let discardMarkup = false;
    const wantMarkup = this.inInstance()
      ? this.eventsWanted().wantMarkedSections()
      : this.eventsWanted().wantPrologMarkup();

    if (this.startMarkup(wantMarkup, this.currentLocation())) {
      this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dMDO);
      this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dDSO);
      discardMarkup = false;
    } else if (this.options().warnInstanceStatusKeywordSpecS && this.inInstance()) {
      this.startMarkup(true, this.currentLocation());
      discardMarkup = true;
    }

    const declInputLevel = this.inputLevel();
    const allowStatusDso = new AllowedParams(
      Param.dso,
      Param.reservedName + Syntax.ReservedName.rCDATA,
      Param.reservedName + Syntax.ReservedName.rRCDATA,
      Param.reservedName + Syntax.ReservedName.rIGNORE,
      Param.reservedName + Syntax.ReservedName.rINCLUDE,
      Param.reservedName + Syntax.ReservedName.rTEMP
    );

    const parm = new Param();
    let status: number = MarkedSectionEvent.Status.include;

    if (!this.parseParam(allowStatusDso, declInputLevel, parm)) {
      return false;
    }

    if (this.options().warnMissingStatusKeyword && parm.type === Param.dso) {
      this.message(ParserMessages.missingStatusKeyword);
    }

    while (parm.type !== Param.dso) {
      switch (parm.type) {
        case Param.reservedName + Syntax.ReservedName.rCDATA:
          if (status < MarkedSectionEvent.Status.cdata) {
            status = MarkedSectionEvent.Status.cdata;
          }
          break;
        case Param.reservedName + Syntax.ReservedName.rRCDATA:
          if (status < MarkedSectionEvent.Status.rcdata) {
            status = MarkedSectionEvent.Status.rcdata;
          }
          if (this.options().warnRcdataMarkedSection) {
            this.message(ParserMessages.rcdataMarkedSection);
          }
          break;
        case Param.reservedName + Syntax.ReservedName.rIGNORE:
          if (status < MarkedSectionEvent.Status.ignore) {
            status = MarkedSectionEvent.Status.ignore;
          }
          if (this.inInstance() && this.options().warnInstanceIgnoreMarkedSection) {
            this.message(ParserMessages.instanceIgnoreMarkedSection);
          }
          break;
        case Param.reservedName + Syntax.ReservedName.rINCLUDE:
          if (this.inInstance() && this.options().warnInstanceIncludeMarkedSection) {
            this.message(ParserMessages.instanceIncludeMarkedSection);
          }
          break;
        case Param.reservedName + Syntax.ReservedName.rTEMP:
          if (this.options().warnTempMarkedSection) {
            this.message(ParserMessages.tempMarkedSection);
          }
          break;
      }
      if (!this.parseParam(allowStatusDso, declInputLevel, parm)) {
        return false;
      }
      if (this.options().warnMultipleStatusKeyword && parm.type !== Param.dso) {
        this.message(ParserMessages.multipleStatusKeyword);
      }
    }

    if (this.inputLevel() > declInputLevel) {
      this.message(ParserMessages.parameterEntityNotEnded);
    }

    if (status === MarkedSectionEvent.Status.include) {
      this.startMarkedSection(this.markupLocation());
    } else if (status === MarkedSectionEvent.Status.cdata) {
      this.startSpecialMarkedSection(Mode.cmsMode, this.markupLocation());
    } else if (status === MarkedSectionEvent.Status.rcdata) {
      this.startSpecialMarkedSection(Mode.rcmsMode, this.markupLocation());
    } else if (status === MarkedSectionEvent.Status.ignore) {
      this.startSpecialMarkedSection(Mode.imsMode, this.markupLocation());
    }

    if (this.currentMarkup()) {
      // Check for whitespace in status keyword specification
      if (this.options().warnInstanceStatusKeywordSpecS && this.inInstance()) {
        // TODO: Implement MarkupIter for detailed whitespace checking
        if (discardMarkup) {
          this.startMarkup(false, this.markupLocation());
        }
      }
      this.eventHandler().markedSectionStart(
        new MarkedSectionStartEvent(status, this.markupLocation(), this.currentMarkup()!)
      );
    }
    return true;
  }

  protected handleMarkedSectionEnd(): void {
    // Port of handleMarkedSectionEnd from parseDecl.cxx (lines 3525-3565)

    if (this.markedSectionLevel() === 0) {
      this.message(ParserMessages.markedSectionEnd);
    } else {
      const wantMarkup = this.inInstance()
        ? this.eventsWanted().wantMarkedSections()
        : this.eventsWanted().wantPrologMarkup();

      if (wantMarkup) {
        if (this.markedSectionSpecialLevel() > 1) {
          const input = this.currentInput();
          if (input) {
            const tokenStart = input.currentTokenStart();
            const tokenData = new Uint32Array(tokenStart);
            this.eventHandler().ignoredChars(
              new IgnoredCharsEvent(
                tokenData,
                input.currentTokenLength(),
                this.currentLocation(),
                false
              )
            );
          }
        } else {
          let status: number;
          switch (this.currentMode()) {
            case Mode.cmsMode:
              status = MarkedSectionEvent.Status.cdata;
              break;
            case Mode.rcmsMode:
              status = MarkedSectionEvent.Status.rcdata;
              break;
            case Mode.imsMode:
              status = MarkedSectionEvent.Status.ignore;
              break;
            default:
              status = MarkedSectionEvent.Status.include;
              break;
          }
          this.startMarkup(true, this.currentLocation());
          this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dMSC);
          this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dMDC);
          this.eventHandler().markedSectionEnd(
            new MarkedSectionEndEvent(status, this.markupLocation(), this.currentMarkup()!)
          );
        }
      }
      this.endMarkedSection();
    }
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
        const data = new Uint32Array(s.slice(0, i));
        this.eventHandler().sSep(new SSepEvent(data, i, this.currentLocation(), false));
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
        const data = new Uint32Array(s);
        this.eventHandler().data(
          new ImmediateDataEvent(Event.Type.characterData, data, length, location, false)
        );
        return;
      }

      // Process character by character handling RS/RE
      for (; length > 0; location.addOffset(1), length--, s = s.slice(1)) {
        if (s[0] === this.syntax().standardFunction(Syntax.StandardFunction.fRS)) {
          this.noteRs();
          if (this.eventsWanted().wantInstanceMarkup()) {
            this.eventHandler().ignoredRs(new IgnoredRsEvent(s[0], location));
          }
        } else if (s[0] === this.syntax().standardFunction(Syntax.StandardFunction.fRE)) {
          this.queueRe(location);
        } else {
          this.noteData();
          const charData = new Uint32Array([s[0]]);
          this.eventHandler().data(
            new ImmediateDataEvent(Event.Type.characterData, charData, 1, location, false)
          );
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

  // Port of parseAttribute.cxx lines 433-522
  // Skip attribute specification for ignored markup
  protected skipAttributeSpec(): boolean {
    const curParmObj: { value: AttributeParameterType } = { value: AttributeParameterType.end };
    const netEnabling: { value: boolean } = { value: false };

    if (!this.parseAttributeParameter(Mode.tagMode, false, curParmObj, netEnabling)) {
      return false;
    }

    while (curParmObj.value !== AttributeParameterType.end) {
      if (curParmObj.value === AttributeParameterType.name) {
        let nameMarkupIndex = 0;
        const markup = this.currentMarkup();
        if (markup) {
          nameMarkupIndex = markup.size() - 1;
        }
        if (!this.parseAttributeParameter(Mode.tagMode, true, curParmObj, netEnabling)) {
          return false;
        }
        // After parseAttributeParameter, curParmObj.value may have changed
        if ((curParmObj.value as AttributeParameterType) === AttributeParameterType.vi) {
          let token = this.getToken(Mode.tagMode);
          while (token === TokenEnum.tokenS) {
            if (this.currentMarkup()) {
              this.currentMarkup()!.addS(this.currentChar());
            }
            token = this.getToken(Mode.tagMode);
          }
          switch (token) {
            case TokenEnum.tokenUnrecognized:
              if (!this.reportNonSgmlCharacter()) {
                this.message(ParserMessages.attributeSpecCharacter, new StringMessageArg(this.currentToken()));
              }
              return false;
            case TokenEnum.tokenEe:
              this.message(ParserMessages.attributeSpecEntityEnd);
              return false;
            case TokenEnum.tokenEtago:
            case TokenEnum.tokenStago:
            case TokenEnum.tokenNestc:
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
              }
              this.extendNameToken(
                this.syntax().litlen() >= this.syntax().normsep()
                  ? this.syntax().litlen() - this.syntax().normsep()
                  : 0,
                ParserMessages.attributeValueLength
              );
              if (this.currentMarkup()) {
                const input = this.currentInput();
                if (input) this.currentMarkup()!.addAttributeValue(input);
              }
              break;
            case TokenEnum.tokenLit:
            case TokenEnum.tokenLita: {
              const text = new Text();
              if (!this.parseLiteral(
                token === TokenEnum.tokenLita ? Mode.talitaMode : Mode.talitMode,
                Mode.taliteMode,
                this.syntax().litlen(),
                ParserMessages.tokenizedAttributeValueLength,
                (this.currentMarkup() ? ParserState.literalDelimInfo : 0) | ParserState.literalNoProcess,
                text
              )) {
                return false;
              }
              if (this.currentMarkup()) {
                this.currentMarkup()!.addLiteral(text);
              }
              break;
            }
            default:
              throw new Error('CANNOT_HAPPEN in skipAttributeSpec');
          }
          if (!this.parseAttributeParameter(Mode.tagMode, false, curParmObj, netEnabling)) {
            return false;
          }
        } else {
          if (markup) {
            markup.changeToAttributeValue(nameMarkupIndex);
          }
          if (!this.sd().attributeOmitName()) {
            this.message(ParserMessages.attributeNameShorttag);
          }
        }
      } else {
        // It's a name token
        if (!this.parseAttributeParameter(Mode.tagMode, false, curParmObj, netEnabling)) {
          return false;
        }
        if (!this.sd().attributeOmitName()) {
          this.message(ParserMessages.attributeNameShorttag);
        }
      }
    }
    if (netEnabling.value) {
      this.message(ParserMessages.startTagGroupNet);
    }
    return true;
  }

  // Port of parseInstance.cxx lines 684-691
  protected undo(undoList: IList<Undo>): void {
    while (!undoList.empty()) {
      const p = undoList.get();
      if (p) {
        p.undo(this);
        // JavaScript GC handles deletion
      }
    }
  }

  // Port of parseInstance.cxx lines 693-713
  protected queueElementEvents(events: IList<Event>): void {
    this.releaseKeptMessages();
    // FIXME provide IList<T>.reverse function
    // reverse it
    const tem = new IList<Event>();
    while (!events.empty()) {
      tem.insert(events.get()!);
    }
    while (!tem.empty()) {
      const e = tem.get();
      if (e) {
        if (e.type() === Event.Type.startElement) {
          this.noteStartElement((e as StartElementEvent).included());
          this.eventHandler().startElement(e as StartElementEvent);
        } else {
          this.noteEndElement((e as EndElementEvent).included());
          this.eventHandler().endElement(e as EndElementEvent);
        }
      }
    }
  }

  // Port of parseInstance.cxx lines 715-723
  protected checkExclusion(e: ElementType): void {
    const token = this.currentElement().invalidExclusion(e);
    if (token) {
      this.message(
        ParserMessages.invalidExclusion,
        new OrdinalMessageArg(token.typeIndex() + 1),
        new StringMessageArg(token.elementType()!.name()),
        new StringMessageArg(this.currentElement().type().name())
      );
    }
  }

  // Port of parseInstance.cxx lines 725-746
  protected tryStartTag(
    e: ElementType,
    event: StartElementEvent,
    netEnabling: Boolean,
    impliedEvents: IList<Event>
  ): Boolean {
    if (this.elementIsExcluded(e)) {
      this.checkExclusion(e);
      return false;
    }
    if (this.currentElement().tryTransition(e)) {
      this.queueElementEvents(impliedEvents);
      this.pushElementCheck(e, event, netEnabling);
      return true;
    }
    if (this.elementIsIncluded(e)) {
      this.queueElementEvents(impliedEvents);
      event.setIncluded();
      this.pushElementCheck(e, event, netEnabling);
      return true;
    }
    return false;
  }

  // Port of parseInstance.cxx lines 748-826
  protected tryImplyTag(
    loc: Location,
    startImpliedCountRef: { value: number },
    attributeListIndexRef: { value: number },
    undo: IList<Undo>,
    eventList: IList<Event>
  ): Boolean {
    if (!this.sd().omittag()) {
      return false;
    }
    if (this.currentElement().isFinished()) {
      if (this.tagLevel() === 0) {
        return false;
      }
      const def = this.currentElement().type().definition();
      if (def && !def.canOmitEndTag()) {
        return false;
      }
      // imply an end tag
      if (startImpliedCountRef.value > 0) {
        this.message(
          ParserMessages.startTagEmptyElement,
          new StringMessageArg(this.currentElement().type().name())
        );
        startImpliedCountRef.value--;
      }
      const event = new EndElementEvent(
        this.currentElement().type(),
        this.currentDtdPointer(),
        loc,
        null
      );
      eventList.insert(event);
      undo.insert(new UndoEndTag(this.popSaveElement()!));
      return true;
    }
    const token = this.currentElement().impliedStartTag();
    if (!token) {
      return false;
    }
    const e = token.elementType();
    if (this.elementIsExcluded(e!)) {
      this.message(
        ParserMessages.requiredElementExcluded,
        new OrdinalMessageArg(token.typeIndex() + 1),
        new StringMessageArg(e!.name()),
        new StringMessageArg(this.currentElement().type().name())
      );
    }
    if (this.tagLevel() !== 0) {
      undo.insert(new UndoTransition(this.currentElement().matchState()));
    }
    this.currentElement().doRequiredTransition();
    const def = e!.definition();
    if (
      def &&
      def.declaredContent() !== ElementDefinition.DeclaredContent.modelGroup &&
      def.declaredContent() !== ElementDefinition.DeclaredContent.any
    ) {
      this.message(ParserMessages.omitStartTagDeclaredContent, new StringMessageArg(e!.name()));
    }
    if (def && def.undefined()) {
      this.message(ParserMessages.undefinedElement, new StringMessageArg(e!.name()));
    } else if (def && !def.canOmitStartTag()) {
      this.message(ParserMessages.omitStartTagDeclare, new StringMessageArg(e!.name()));
    }
    const attributes = this.allocAttributeList(
      e!.attributeDef().asConst(),
      attributeListIndexRef.value++
    );
    // this will give an error if the element has a required attribute
    if (attributes) {
      attributes.finish(this as any);
    }
    startImpliedCountRef.value++;
    const eventObj = new StartElementEvent(
      e!,
      this.currentDtdPointer(),
      attributes!,
      loc,
      null
    );
    this.pushElementCheckUndo(e!, eventObj, undo, eventList);
    const implyCheckLimit = 30; // this is fairly arbitrary
    if (
      startImpliedCountRef.value > implyCheckLimit &&
      !this.checkImplyLoop(startImpliedCountRef.value)
    ) {
      return false;
    }
    return true;
  }

  // Port of parseInstance.cxx lines 828-872
  protected pushElementCheck(
    e: ElementType,
    event: StartElementEvent,
    netEnabling: Boolean
  ): void {
    if (this.tagLevel() === this.syntax().taglvl()) {
      this.message(
        ParserMessages.taglvlOpenElements,
        new NumberMessageArg(this.syntax().taglvl())
      );
    }
    this.noteStartElement(event.included());
    if (event.mustOmitEnd()) {
      if (this.sd().emptyElementNormal()) {
        const included = event.included();
        const loc = new Location(event.location());
        this.eventHandler().startElement(event);
        this.endTagEmptyElement(e, netEnabling, included, loc);
      } else {
        const end = new EndElementEvent(
          e,
          this.currentDtdPointer(),
          event.location(),
          null
        );
        if (event.included()) {
          end.setIncluded();
          this.noteEndElement(true);
        } else {
          this.noteEndElement(false);
        }
        this.eventHandler().startElement(event);
        this.eventHandler().endElement(end);
      }
    } else {
      let map = e.map();
      if (!map) {
        map = this.currentElement().map();
      }
      if (this.options().warnImmediateRecursion && e === this.currentElement().type()) {
        this.message(ParserMessages.immediateRecursion);
      }
      this.pushElement(
        new OpenElement(e, netEnabling, event.included(), map!, event.location())
      );
      // Can't access event after it's passed to the event handler.
      this.eventHandler().startElement(event);
    }
  }

  // Port of parseInstance.cxx lines 973-1001 (overload for undo/event lists)
  protected pushElementCheckUndo(
    e: ElementType,
    event: StartElementEvent,
    undoList: IList<Undo>,
    eventList: IList<Event>
  ): void {
    if (this.tagLevel() === this.syntax().taglvl()) {
      this.message(
        ParserMessages.taglvlOpenElements,
        new NumberMessageArg(this.syntax().taglvl())
      );
    }
    eventList.insert(event);
    if (event.mustOmitEnd()) {
      const end = new EndElementEvent(
        e,
        this.currentDtdPointer(),
        event.location(),
        null
      );
      if (event.included()) {
        end.setIncluded();
      }
      eventList.insert(end);
    } else {
      undoList.insert(new UndoStartTag());
      let map = e.map();
      if (!map) {
        map = this.currentElement().map();
      }
      this.pushElement(
        new OpenElement(e, false, event.included(), map!, event.location())
      );
    }
  }

  // Port of parseInstance.cxx lines 874-945
  protected endTagEmptyElement(
    e: ElementType,
    netEnabling: Boolean,
    included: Boolean,
    startLoc: Location
  ): void {
    const token = this.getToken(netEnabling ? Mode.econnetMode : Mode.econMode);
    switch (token) {
      case TokenEnum.tokenNet:
        if (netEnabling) {
          const markup = this.startMarkup(
            this.eventsWanted().wantInstanceMarkup(),
            this.currentLocation()
          );
          if (markup) {
            markup.addDelim(Syntax.DelimGeneral.dNET);
          }
          const end = new EndElementEvent(e, this.currentDtdPointer(), this.currentLocation(), markup);
          if (included) {
            end.setIncluded();
          }
          this.eventHandler().endElement(end);
          this.noteEndElement(included);
          return;
        }
        break;
      case TokenEnum.tokenEtagoTagc:
        {
          if (this.options().warnEmptyTag) {
            this.message(ParserMessages.emptyEndTag);
          }
          const markup = this.startMarkup(
            this.eventsWanted().wantInstanceMarkup(),
            this.currentLocation()
          );
          if (markup) {
            markup.addDelim(Syntax.DelimGeneral.dETAGO);
            markup.addDelim(Syntax.DelimGeneral.dTAGC);
          }
          const end = new EndElementEvent(e, this.currentDtdPointer(), this.currentLocation(), markup);
          if (included) {
            end.setIncluded();
          }
          this.eventHandler().endElement(end);
          this.noteEndElement(included);
          return;
        }
      case TokenEnum.tokenEtagoNameStart:
        {
          const end = this.parseEndTag();
          if (end && end.elementType() === e) {
            if (included) {
              end.setIncluded();
            }
            this.eventHandler().endElement(end);
            this.noteEndElement(included);
            return;
          }
          if (end && !this.elementIsOpen(end.elementType())) {
            this.message(
              ParserMessages.elementNotOpen,
              new StringMessageArg(end.elementType().name())
            );
            // delete end - JavaScript GC handles this
            break;
          }
          this.implyEmptyElementEnd(e, included, startLoc);
          if (end) {
            this.acceptEndTag(end);
          }
          return;
        }
      default:
        break;
    }
    this.implyEmptyElementEnd(e, included, startLoc);
    this.currentInput()!.ungetToken();
  }

  // Port of parseInstance.cxx lines 947-971
  protected implyEmptyElementEnd(
    e: ElementType,
    included: Boolean,
    startLoc: Location
  ): void {
    if (!this.sd().omittag()) {
      this.message(
        ParserMessages.omitEndTagOmittag,
        new StringMessageArg(e.name())
        // TODO: Add start location as second arg
      );
    } else {
      const def = e.definition();
      if (def && !def.canOmitEndTag()) {
        this.message(
          ParserMessages.omitEndTagDeclare,
          new StringMessageArg(e.name())
          // TODO: Add start location as second arg
        );
      }
    }
    const end = new EndElementEvent(e, this.currentDtdPointer(), this.currentLocation(), null);
    if (included) {
      end.setIncluded();
    }
    this.noteEndElement(included);
    this.eventHandler().endElement(end);
  }

  // Port of parseInstance.cxx lines 1206-1271
  protected handleBadStartTag(
    e: ElementType,
    event: StartElementEvent,
    netEnabling: Boolean
  ): void {
    const undoList = new IList<Undo>();
    const eventList = new IList<Event>();
    this.keepMessages();
    for (;;) {
      const missing = new Vector<ElementType | null>();
      this.findMissingTag(e, missing);
      if (missing.size() === 1) {
        this.queueElementEvents(eventList);
        const m = missing.get(0);
        if (m) {
          this.message(
            ParserMessages.missingElementInferred,
            new StringMessageArg(e.name()),
            new StringMessageArg(m.name())
          );
          const attributes = this.allocAttributeList(m.attributeDef().asConst(), 1);
          // this will give an error if the element has a required attribute
          if (attributes) {
            attributes.finish(this as any);
          }
          const inferEvent = new StartElementEvent(
            m,
            this.currentDtdPointer(),
            attributes!,
            event.location(),
            null
          );
          if (!this.currentElement().tryTransition(m)) {
            inferEvent.setIncluded();
          }
          this.pushElementCheck(m, inferEvent, false);
          if (!this.currentElement().tryTransition(e)) {
            event.setIncluded();
          }
          this.pushElementCheck(e, event, netEnabling);
          return;
        }
      }
      if (missing.size() > 0) {
        this.queueElementEvents(eventList);
        const missingNames = new Vector<StringC>();
        for (let i = 0; i < missing.size(); i++) {
          const m = missing.get(i);
          if (m) {
            missingNames.push_back(m.name());
          }
        }
        this.message(
          ParserMessages.missingElementMultiple,
          new StringMessageArg(e.name()),
          new StringVectorMessageArg(missingNames)
        );
        this.pushElementCheck(e, event, netEnabling);
        return;
      }
      if (
        !this.sd().omittag() ||
        !this.currentElement().isFinished() ||
        this.tagLevel() === 0 ||
        !this.currentElement().type().definition()?.canOmitEndTag()
      ) {
        break;
      }
      const endEvent = new EndElementEvent(
        this.currentElement().type(),
        this.currentDtdPointer(),
        event.location(),
        null
      );
      eventList.insert(endEvent);
      undoList.insert(new UndoEndTag(this.popSaveElement()!));
    }
    this.discardKeptMessages();
    this.undo(undoList);
    this.message(ParserMessages.elementNotAllowed, new StringMessageArg(e.name()));
    // If element couldn't occur because it was excluded, then
    // do the transition here.
    this.currentElement().tryTransition(e);
    this.pushElementCheck(e, event, netEnabling);
  }

  // Port of parseInstance.cxx lines 1273-1340 (stub for now)
  protected findMissingTag(e: ElementType, v: Vector<ElementType | null>): void {
    // TODO: Full implementation from parseInstance.cxx lines 1273-1340
    // This determines what element(s) could be inferred to make the current element valid
    // For now, return empty vector - will prevent element inference
    v.clear();
  }

  // ============================================================================
  // parseParam.cxx port - Declaration parameter parsing
  // ============================================================================

  // Port of parseParam.cxx lines 19-266
  protected parseParam(allow: AllowedParams, declInputLevel: number, parm: Param): Boolean {
    for (;;) {
      const token = this.getToken(allow.mainMode());
      switch (token) {
        case TokenEnum.tokenUnrecognized:
          if (this.reportNonSgmlCharacter()) {
            break;
          }
          this.message(
            ParserMessages.markupDeclarationCharacter,
            new StringMessageArg(this.currentToken()),
            new AllowedParamsMessageArg(allow, this.syntaxPointer())
          );
          return false;

        case TokenEnum.tokenEe:
          if (this.inputLevel() <= declInputLevel) {
            this.message(ParserMessages.declarationLevel);
            return false;
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addEntityEnd();
          }
          this.popInputStack();
          break;

        case TokenEnum.tokenCom:
          if (!this.parseComment(Mode.comMode)) {
            return false;
          }
          if (this.options().warnPsComment) {
            this.message(ParserMessages.psComment);
          }
          break;

        case TokenEnum.tokenDso:
          if (!allow.dso()) {
            this.paramInvalidToken(TokenEnum.tokenDso, allow);
            return false;
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dDSO);
          }
          parm.type = Param.dso;
          return true;

        case TokenEnum.tokenGrpo:
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dGRPO);
          }
          switch (allow.group()) {
            case Param.invalid:
              this.paramInvalidToken(TokenEnum.tokenGrpo, allow);
              return false;
            case Param.modelGroup:
              {
                const groupResult: { group: ModelGroup | null } = { group: null };
                if (!this.parseModelGroup(1, declInputLevel, groupResult, Mode.grpsufMode)) {
                  return false;
                }
                parm.type = Param.modelGroup;
                parm.modelGroupPtr = new Owner<ModelGroup>(groupResult.group);
              }
              break;
            case Param.nameGroup:
              if (!this.parseNameGroup(declInputLevel, parm)) {
                return false;
              }
              break;
            case Param.nameTokenGroup:
              if (!this.parseNameTokenGroup(declInputLevel, parm)) {
                return false;
              }
              break;
            default:
              ASSERT(false); // CANNOT_HAPPEN
          }
          parm.type = allow.group();
          return true;

        case TokenEnum.tokenLita:
        case TokenEnum.tokenLit:
          parm.type = allow.literal();
          parm.lita = token === TokenEnum.tokenLita;
          switch (allow.literal()) {
            case Param.invalid:
              this.paramInvalidToken(token, allow);
              return false;
            case Param.minimumLiteral:
              if (!this.parseMinimumLiteral(parm.lita, parm.literalText)) {
                return false;
              }
              break;
            case Param.attributeValueLiteral:
              if (!this.parseAttributeValueLiteral(parm.lita, parm.literalText)) {
                return false;
              }
              break;
            case Param.tokenizedAttributeValueLiteral:
              if (!this.parseTokenizedAttributeValueLiteral(parm.lita, parm.literalText)) {
                return false;
              }
              break;
            case Param.systemIdentifier:
              if (!this.parseSystemIdentifier(parm.lita, parm.literalText)) {
                return false;
              }
              break;
            case Param.paramLiteral:
              if (!this.parseParameterLiteral(parm.lita, parm.literalText)) {
                return false;
              }
              break;
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addLiteral(parm.literalText);
          }
          return true;

        case TokenEnum.tokenMdc:
          if (!allow.mdc()) {
            this.paramInvalidToken(TokenEnum.tokenMdc, allow);
            return false;
          }
          if (this.inputLevel() > declInputLevel) {
            this.message(ParserMessages.parameterEntityNotEnded);
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dMDC);
          }
          parm.type = Param.mdc;
          return true;

        case TokenEnum.tokenMinus:
          parm.type = Param.minus;
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dMINUS);
          }
          return true;

        case TokenEnum.tokenMinusGrpo:
          if (!allow.exclusions()) {
            this.paramInvalidToken(TokenEnum.tokenMinusGrpo, allow);
            return false;
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dMINUS);
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dGRPO);
          }
          parm.type = Param.exclusions;
          return this.parseElementNameGroup(declInputLevel, parm);

        case TokenEnum.tokenPero:
          parm.type = Param.pero;
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dPERO);
          }
          return true;

        case TokenEnum.tokenPeroGrpo:
          if (!this.inInstance()) {
            this.message(ParserMessages.peroGrpoProlog);
          }
          // fall through
        case TokenEnum.tokenPeroNameStart:
          {
            if (this.inInstance()) {
              if (this.options().warnInstanceParamEntityRef) {
                this.message(ParserMessages.instanceParamEntityRef);
              }
            } else {
              if (this.options().warnInternalSubsetPsParamEntityRef && this.inputLevel() === 1) {
                this.message(ParserMessages.internalSubsetPsParamEntityRef);
              }
            }
            const refResult = this.parseEntityReference(true, token === TokenEnum.tokenPeroGrpo ? 1 : 0);
            if (!refResult.valid) {
              return false;
            }
            if (refResult.entity) {
              refResult.entity.pointer()?.declReference(this as any, refResult.origin!);
            }
          }
          break;

        case TokenEnum.tokenPlusGrpo:
          if (!allow.inclusions()) {
            this.paramInvalidToken(TokenEnum.tokenPlusGrpo, allow);
            return false;
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dPLUS);
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dGRPO);
          }
          parm.type = Param.inclusions;
          return this.parseElementNameGroup(declInputLevel, parm);

        case TokenEnum.tokenRni:
          if (!allow.rni()) {
            this.paramInvalidToken(TokenEnum.tokenRni, allow);
            return false;
          }
          return this.parseIndicatedReservedName(allow, parm);

        case TokenEnum.tokenS:
          if (this.currentMarkup()) {
            this.currentMarkup()!.addS(this.currentChar());
          }
          break;

        case TokenEnum.tokenNameStart:
          switch (allow.nameStart()) {
            case Param.invalid:
              this.paramInvalidToken(TokenEnum.tokenNameStart, allow);
              return false;
            case Param.reservedName:
              return this.parseReservedName(allow, parm);
            case Param.paramName:
              {
                this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);
                parm.type = Param.paramName;
                this.getCurrentToken(parm.origToken);
                parm.token = new String<Char>();
                parm.token.assign(parm.origToken);
                const subst = this.syntax().generalSubstTable();
                for (let i = 0; i < parm.token.size(); i++) {
                  const c = parm.token.get(i);
                  parm.token.set(i, subst.get(c));
                }
                if (this.currentMarkup()) {
                  this.currentMarkup()!.addName(this.currentInput()!);
                }
                return true;
              }
            case Param.entityName:
              this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);
              parm.type = Param.entityName;
              this.getCurrentTokenSubst(this.syntax().entitySubstTable(), parm.token);
              if (this.currentMarkup()) {
                this.currentMarkup()!.addName(this.currentInput()!);
              }
              return true;
            case Param.paramEntityName:
              this.extendNameToken(
                this.syntax().penamelen(),
                ParserMessages.parameterEntityNameLength
              );
              parm.type = Param.paramEntityName;
              this.getCurrentTokenSubst(this.syntax().entitySubstTable(), parm.token);
              if (this.currentMarkup()) {
                this.currentMarkup()!.addName(this.currentInput()!);
              }
              return true;
            case Param.attributeValue:
              return this.parseAttributeValueParam(parm);
          }
          break;

        case TokenEnum.tokenDigit:
          switch (allow.digit()) {
            case Param.invalid:
              this.paramInvalidToken(TokenEnum.tokenDigit, allow);
              return false;
            case Param.number:
              this.extendNumber(this.syntax().namelen(), ParserMessages.numberLength);
              parm.type = Param.number;
              this.getCurrentToken(parm.token);
              if (this.currentMarkup()) {
                this.currentMarkup()!.addNumber(this.currentInput()!);
              }
              return true;
            case Param.attributeValue:
              return this.parseAttributeValueParam(parm);
          }
          break;

        case TokenEnum.tokenLcUcNmchar:
          switch (allow.nmchar()) {
            case Param.invalid:
              this.paramInvalidToken(TokenEnum.tokenLcUcNmchar, allow);
              return false;
            case Param.attributeValue:
              return this.parseAttributeValueParam(parm);
          }
          break;

        default:
          ASSERT(false); // CANNOT_HAPPEN
      }
    }
  }

  // Port of parseParam.cxx lines 268-275
  protected paramInvalidToken(token: Token, allow: AllowedParams): void {
    if (!allow.silent()) {
      this.message(
        ParserMessages.paramInvalidToken,
        new TokenMessageArg(token, allow.mainMode(), this.syntaxPointer(), this.sdPointer()),
        new AllowedParamsMessageArg(allow, this.syntaxPointer())
      );
    }
  }

  // Port of parseParam.cxx lines 277-470
  protected parseGroupToken(
    allow: AllowedGroupTokens,
    nestingLevel: number,
    declInputLevel: number,
    groupInputLevel: number,
    gt: GroupToken
  ): Boolean {
    for (;;) {
      const token = this.getToken(Mode.grpMode);
      switch (token) {
        case TokenEnum.tokenEe:
          if (this.inputLevel() <= groupInputLevel) {
            this.message(ParserMessages.groupLevel);
            if (this.inputLevel() <= declInputLevel) {
              return false;
            }
          } else if (!this.sd().www()) {
            this.message(ParserMessages.groupEntityEnd);
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addEntityEnd();
          }
          this.popInputStack();
          break;

        case TokenEnum.tokenPeroGrpo:
          {
            if (!this.inInstance()) {
              this.message(ParserMessages.peroGrpoProlog);
            }
            const startResult: { value: Boolean } = { value: false };
            if (this.inTag(startResult)) {
              this.message(
                startResult.value
                  ? ParserMessages.peroGrpoStartTag
                  : ParserMessages.peroGrpoEndTag
              );
            }
            // fall through
          }
        case TokenEnum.tokenPeroNameStart:
          {
            if (this.options().warnInternalSubsetTsParamEntityRef && this.inputLevel() === 1) {
              this.message(ParserMessages.internalSubsetTsParamEntityRef);
            }
            const refResult = this.parseEntityReference(true, token === TokenEnum.tokenPeroGrpo ? 1 : 0);
            if (!refResult.valid) {
              return false;
            }
            if (refResult.entity) {
              refResult.entity.pointer()?.declReference(this as any, refResult.origin!);
            }
          }
          break;

        case TokenEnum.tokenUnrecognized:
          if (this.reportNonSgmlCharacter()) {
            break;
          }
          this.message(
            ParserMessages.groupCharacter,
            new StringMessageArg(this.currentToken()),
            new AllowedGroupTokensMessageArg(allow, this.syntaxPointer())
          );
          return false;

        case TokenEnum.tokenDtgo:
          if (!allow.groupToken(GroupToken.Type.dataTagGroup)) {
            this.groupTokenInvalidToken(TokenEnum.tokenDtgo, allow);
            return false;
          }
          if (this.sd().datatag()) {
            this.message(ParserMessages.datatagNotImplemented);
          }
          if (!this.defDtd().isBase()) {
            this.message(ParserMessages.datatagBaseDtd);
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dDTGO);
          }
          return this.parseDataTagGroup(nestingLevel + 1, declInputLevel, gt);

        case TokenEnum.tokenGrpo:
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dGRPO);
          }
          switch (allow.group()) {
            case GroupToken.Type.modelGroup:
              {
                const groupResult: { group: ModelGroup | null } = { group: null };
                if (!this.parseModelGroup(nestingLevel + 1, declInputLevel, groupResult, Mode.grpMode)) {
                  return false;
                }
                gt.model = new Owner<ModelGroup>(groupResult.group);
                gt.type = GroupToken.Type.modelGroup;
                return true;
              }
            case GroupToken.Type.dataTagTemplateGroup:
              return this.parseDataTagTemplateGroup(nestingLevel + 1, declInputLevel, gt);
            default:
              this.groupTokenInvalidToken(TokenEnum.tokenGrpo, allow);
              return false;
          }

        case TokenEnum.tokenRni:
          if (
            !allow.groupToken(GroupToken.Type.pcdata) &&
            !allow.groupToken(GroupToken.Type.all) &&
            !allow.groupToken(GroupToken.Type.implicit)
          ) {
            this.groupTokenInvalidToken(TokenEnum.tokenRni, allow);
            return false;
          }
          {
            const rnResult: { rn: number } = { rn: 0 };
            if (!this.getIndicatedReservedName(rnResult)) {
              return false;
            }
            if (rnResult.rn === Syntax.ReservedName.rPCDATA && allow.groupToken(GroupToken.Type.pcdata)) {
              gt.type = GroupToken.Type.pcdata;
              gt.contentToken = new Owner<ContentToken>(new PcdataToken());
              return true;
            } else if (rnResult.rn === Syntax.ReservedName.rALL && allow.groupToken(GroupToken.Type.all)) {
              this.message(ParserMessages.sorryAllImplicit);
              return false;
            } else if (rnResult.rn === Syntax.ReservedName.rIMPLICIT && allow.groupToken(GroupToken.Type.implicit)) {
              this.message(ParserMessages.sorryAllImplicit);
              return false;
            } else {
              const tokenStr = new String<Char>();
              tokenStr.appendString(this.syntax().delimGeneral(Syntax.DelimGeneral.dRNI));
              tokenStr.appendString(this.syntax().reservedName(rnResult.rn));
              this.message(ParserMessages.groupTokenInvalidReservedName, new StringMessageArg(tokenStr));
              return false;
            }
          }

        case TokenEnum.tokenS:
          if (this.currentMarkup()) {
            this.extendS();
            this.currentMarkup()!.addS(this.currentInput()!);
          }
          break;

        case TokenEnum.tokenNameStart:
          switch (allow.nameStart()) {
            case GroupToken.Type.elementToken:
              {
                this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);
                gt.type = GroupToken.Type.elementToken;
                const buffer = this.nameBuffer();
                this.getCurrentTokenSubst(this.syntax().generalSubstTable(), buffer);
                if (this.currentMarkup()) {
                  this.currentMarkup()!.addName(this.currentInput()!);
                }
                const e = this.lookupCreateElement(buffer);
                const oi = this.getOccurrenceIndicator(Mode.grpMode);
                gt.contentToken = new Owner<ContentToken>(new ElementToken(e, oi));
                return true;
              }
            case GroupToken.Type.name:
            case GroupToken.Type.nameToken:
              this.extendNameToken(
                this.syntax().namelen(),
                allow.nameStart() === GroupToken.Type.name
                  ? ParserMessages.nameLength
                  : ParserMessages.nameTokenLength
              );
              this.getCurrentTokenSubst(this.syntax().generalSubstTable(), gt.token);
              gt.type = allow.nameStart();
              if (this.currentMarkup()) {
                if (gt.type === GroupToken.Type.nameToken) {
                  this.currentMarkup()!.addNameToken(this.currentInput()!);
                } else {
                  this.currentMarkup()!.addName(this.currentInput()!);
                }
              }
              return true;
            default:
              this.groupTokenInvalidToken(TokenEnum.tokenNameStart, allow);
              return false;
          }

        case TokenEnum.tokenDigit:
        case TokenEnum.tokenLcUcNmchar:
          if (!allow.groupToken(GroupToken.Type.nameToken)) {
            this.groupTokenInvalidToken(token, allow);
            return false;
          }
          this.extendNameToken(this.syntax().namelen(), ParserMessages.nameTokenLength);
          this.getCurrentTokenSubst(this.syntax().generalSubstTable(), gt.token);
          gt.type = GroupToken.Type.nameToken;
          if (this.currentMarkup()) {
            this.currentMarkup()!.addNameToken(this.currentInput()!);
          }
          return true;

        case TokenEnum.tokenLit:
        case TokenEnum.tokenLita:
          // parameter literal in data tag pattern
          if (!allow.groupToken(GroupToken.Type.dataTagLiteral)) {
            this.groupTokenInvalidToken(token, allow);
            return false;
          }
          if (!this.parseDataTagParameterLiteral(token === TokenEnum.tokenLita, gt.text)) {
            return false;
          }
          gt.type = GroupToken.Type.dataTagLiteral;
          if (this.currentMarkup()) {
            this.currentMarkup()!.addLiteral(gt.text);
          }
          return true;

        case TokenEnum.tokenAnd:
        case TokenEnum.tokenSeq:
        case TokenEnum.tokenOr:
        case TokenEnum.tokenDtgc:
        case TokenEnum.tokenGrpc:
        case TokenEnum.tokenOpt:
        case TokenEnum.tokenPlus:
        case TokenEnum.tokenRep:
          this.groupTokenInvalidToken(token, allow);
          return false;
      }
    }
  }

  // Port of parseParam.cxx lines 473-478
  protected groupTokenInvalidToken(token: Token, allow: AllowedGroupTokens): void {
    this.message(
      ParserMessages.groupTokenInvalidToken,
      new TokenMessageArg(token, Mode.grpMode, this.syntaxPointer(), this.sdPointer()),
      new AllowedGroupTokensMessageArg(allow, this.syntaxPointer())
    );
  }

  // Port of parseParam.cxx lines 481-586
  protected parseGroupConnector(
    allow: AllowedGroupConnectors,
    declInputLevel: number,
    groupInputLevel: number,
    gc: GroupConnector
  ): Boolean {
    for (;;) {
      const token = this.getToken(Mode.grpMode);
      switch (token) {
        case TokenEnum.tokenEe:
          if (this.inputLevel() <= groupInputLevel) {
            this.message(ParserMessages.groupLevel);
            if (this.inputLevel() <= declInputLevel) {
              return false;
            }
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addEntityEnd();
          }
          this.popInputStack();
          break;

        case TokenEnum.tokenS:
          if (this.currentMarkup()) {
            this.extendS();
            this.currentMarkup()!.addS(this.currentInput()!);
          }
          break;

        case TokenEnum.tokenPeroGrpo:
          if (this.inInstance()) {
            this.message(ParserMessages.peroGrpoProlog);
            break;
          }
          // fall through
        case TokenEnum.tokenPeroNameStart:
          if (!this.sd().www()) {
            this.message(ParserMessages.groupEntityReference);
          } else {
            const refResult = this.parseEntityReference(true, token === TokenEnum.tokenPeroGrpo ? 1 : 0);
            if (!refResult.valid) {
              return false;
            }
            if (refResult.entity) {
              refResult.entity.pointer()?.declReference(this as any, refResult.origin!);
            }
          }
          break;

        case TokenEnum.tokenUnrecognized:
          if (this.reportNonSgmlCharacter()) {
            break;
          }
          this.message(
            ParserMessages.groupCharacter,
            new StringMessageArg(this.currentToken()),
            new AllowedGroupConnectorsMessageArg(allow, this.syntaxPointer())
          );
          return false;

        case TokenEnum.tokenAnd:
          if (!allow.groupConnector(GroupConnector.Type.andGC)) {
            this.groupConnectorInvalidToken(TokenEnum.tokenAnd, allow);
            return false;
          }
          gc.type = GroupConnector.Type.andGC;
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dAND);
          }
          return true;

        case TokenEnum.tokenSeq:
          if (!allow.groupConnector(GroupConnector.Type.seqGC)) {
            this.groupConnectorInvalidToken(TokenEnum.tokenSeq, allow);
            return false;
          }
          gc.type = GroupConnector.Type.seqGC;
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dSEQ);
          }
          return true;

        case TokenEnum.tokenOr:
          if (!allow.groupConnector(GroupConnector.Type.orGC)) {
            this.groupConnectorInvalidToken(TokenEnum.tokenOr, allow);
            return false;
          }
          gc.type = GroupConnector.Type.orGC;
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dOR);
          }
          return true;

        case TokenEnum.tokenDtgc:
          if (!allow.groupConnector(GroupConnector.Type.dtgcGC)) {
            this.groupConnectorInvalidToken(TokenEnum.tokenDtgc, allow);
            return false;
          }
          gc.type = GroupConnector.Type.dtgcGC;
          if (this.inputLevel() > groupInputLevel) {
            this.message(ParserMessages.groupParameterEntityNotEnded);
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dDTGC);
          }
          return true;

        case TokenEnum.tokenGrpc:
          if (!allow.groupConnector(GroupConnector.Type.grpcGC)) {
            this.groupConnectorInvalidToken(TokenEnum.tokenGrpc, allow);
            return false;
          }
          gc.type = GroupConnector.Type.grpcGC;
          if (this.inputLevel() > groupInputLevel) {
            this.message(ParserMessages.groupParameterEntityNotEnded);
          }
          if (this.currentMarkup()) {
            this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dGRPC);
          }
          return true;

        default:
          this.groupConnectorInvalidToken(token, allow);
          return false;
      }
    }
  }

  // Port of parseParam.cxx lines 588-594
  protected groupConnectorInvalidToken(token: Token, allow: AllowedGroupConnectors): void {
    this.message(
      ParserMessages.connectorInvalidToken,
      new TokenMessageArg(token, Mode.grpMode, this.syntaxPointer(), this.sdPointer()),
      new AllowedGroupConnectorsMessageArg(allow, this.syntaxPointer())
    );
  }

  // Port of parseParam.cxx lines 596-609
  protected parseElementNameGroup(declInputLevel: number, parm: Param): Boolean {
    const allowName = new AllowedGroupTokens(GroupToken.Type.name);
    const allowCommonName = new AllowedGroupTokens(
      GroupToken.Type.name,
      GroupToken.Type.all,
      GroupToken.Type.implicit
    );
    if (!this.parseGroup(this.sd().www() ? allowCommonName : allowName, declInputLevel, parm)) {
      return false;
    }
    parm.elementVector.resize(parm.nameTokenVector.size());
    for (let i = 0; i < parm.nameTokenVector.size(); i++) {
      parm.elementVector.set(i, this.lookupCreateElement(parm.nameTokenVector.get(i).name));
    }
    return true;
  }

  // Port of parseParam.cxx lines 657-660
  protected parseNameGroup(declInputLevel: number, parm: Param): Boolean {
    const allowName = new AllowedGroupTokens(GroupToken.Type.name);
    return this.parseGroup(allowName, declInputLevel, parm);
  }

  // Port of parseParam.cxx lines 662-666
  protected parseNameTokenGroup(declInputLevel: number, parm: Param): Boolean {
    const allowNameToken = new AllowedGroupTokens(GroupToken.Type.nameToken);
    return this.parseGroup(allowNameToken, declInputLevel, parm);
  }

  // Port of parseParam.cxx lines 611-635
  protected parseEntityReferenceNameGroup(ignore: { value: Boolean }): Boolean {
    const parm = new Param();
    if (!this.parseNameGroup(this.inputLevel(), parm)) {
      return false;
    }
    if (this.inInstance()) {
      for (let i = 0; i < parm.nameTokenVector.size(); i++) {
        const lpd = this.lookupLpd(parm.nameTokenVector.get(i).name);
        if (lpd.pointer() && lpd.pointer()!.active()) {
          ignore.value = false;
          return true;
        }
        const dtd = this.lookupDtd(parm.nameTokenVector.get(i).name);
        if (!dtd.isNull()) {
          this.instantiateDtd(dtd);
          if (this.currentDtdPointer().pointer() === dtd.pointer()) {
            ignore.value = false;
            return true;
          }
        }
      }
    }
    ignore.value = true;
    return true;
  }

  // Port of parseParam.cxx lines 637-655
  protected parseTagNameGroup(active: { value: Boolean }, start: Boolean): Boolean {
    const parm = new Param();
    this.enterTag(start);
    const ret = this.parseNameGroup(this.inputLevel(), parm);
    this.leaveTag();
    if (!ret) {
      return false;
    }
    active.value = false;
    for (let i = 0; i < parm.nameTokenVector.size(); i++) {
      const dtd = this.lookupDtd(parm.nameTokenVector.get(i).name);
      if (!dtd.isNull()) {
        this.instantiateDtd(dtd);
        if (this.currentDtdPointer().pointer() === dtd.pointer()) {
          active.value = true;
        }
      }
    }
    return true;
  }

  // Helper function - Port of parseParam.cxx lines 668-675
  private groupContains(vec: Vector<NameToken>, str: StringC): Boolean {
    for (let i = 0; i < vec.size(); i++) {
      if (vec.get(i).name.equals(str)) {
        return true;
      }
    }
    return false;
  }

  // Port of parseParam.cxx lines 677-728
  protected parseGroup(
    allowToken: AllowedGroupTokens,
    declInputLevel: number,
    parm: Param
  ): Boolean {
    const groupInputLevel = this.inputLevel();
    let nDuplicates = 0;
    const vec = parm.nameTokenVector;
    vec.clear();
    let connector: GroupConnector.Type = GroupConnector.Type.grpcGC;
    const gt = new GroupToken();

    for (;;) {
      if (!this.parseGroupToken(allowToken, 0, declInputLevel, groupInputLevel, gt)) {
        return false;
      }
      if (this.groupContains(vec, gt.token)) {
        nDuplicates++;
        this.message(ParserMessages.duplicateGroupToken, new StringMessageArg(gt.token));
      } else {
        vec.resize(vec.size() + 1);
        const newToken = vec.get(vec.size() - 1);
        gt.token.swap(newToken.name);
        this.getCurrentToken(newToken.origName);
        newToken.loc = this.currentLocation();
      }

      const gc = new GroupConnector();
      const allowAnyConnectorGrpc = new AllowedGroupConnectors(
        GroupConnector.Type.orGC,
        GroupConnector.Type.andGC,
        GroupConnector.Type.seqGC,
        GroupConnector.Type.grpcGC
      );

      if (!this.parseGroupConnector(allowAnyConnectorGrpc, declInputLevel, groupInputLevel, gc)) {
        return false;
      }
      if (gc.type === GroupConnector.Type.grpcGC) {
        break;
      }
      if (this.options().warnNameGroupNotOr) {
        if (gc.type !== GroupConnector.Type.orGC) {
          this.message(ParserMessages.nameGroupNotOr);
        }
      } else if (this.options().warnShould) {
        if (connector === GroupConnector.Type.grpcGC) {
          connector = gc.type;
        } else if (gc.type !== connector) {
          this.message(ParserMessages.mixedConnectors);
          connector = gc.type;
        }
      }
    }

    if (nDuplicates + vec.size() > this.syntax().grpcnt()) {
      this.message(ParserMessages.groupCount, new NumberMessageArg(this.syntax().grpcnt()));
    }
    return true;
  }

  // Port of parseParam.cxx lines 730-787
  protected parseDataTagGroup(
    nestingLevel: number,
    declInputLevel: number,
    result: GroupToken
  ): Boolean {
    if (nestingLevel - 1 === this.syntax().grplvl()) {
      this.message(ParserMessages.grplvl, new NumberMessageArg(this.syntax().grplvl()));
    }
    const groupInputLevel = this.inputLevel();
    const gt = new GroupToken();
    const allowName = new AllowedGroupTokens(GroupToken.Type.name);

    if (!this.parseGroupToken(allowName, nestingLevel, declInputLevel, groupInputLevel, gt)) {
      return false;
    }
    const element = this.lookupCreateElement(gt.token);

    const gc = new GroupConnector();
    const allowSeq = new AllowedGroupConnectors(GroupConnector.Type.seqGC);
    if (!this.parseGroupConnector(allowSeq, declInputLevel, groupInputLevel, gc)) {
      return false;
    }

    const allowDataTagLiteralDataTagTemplateGroup = new AllowedGroupTokens(
      GroupToken.Type.dataTagLiteral,
      GroupToken.Type.dataTagTemplateGroup
    );
    if (!this.parseGroupToken(
      allowDataTagLiteralDataTagTemplateGroup,
      nestingLevel,
      declInputLevel,
      groupInputLevel,
      gt
    )) {
      return false;
    }

    const templates = new Vector<Text>();
    if (gt.type === GroupToken.Type.dataTagTemplateGroup) {
      gt.textVector.swap(templates);
    } else {
      templates.resize(1);
      gt.text.swap(templates.get(0));
    }

    const allowSeqDtgc = new AllowedGroupConnectors(
      GroupConnector.Type.seqGC,
      GroupConnector.Type.dtgcGC
    );
    if (!this.parseGroupConnector(allowSeqDtgc, declInputLevel, groupInputLevel, gc)) {
      return false;
    }

    const vec = new NCVector<Owner<ContentToken>>();
    vec.resize(2);
    vec.set(1, new Owner<ContentToken>(new PcdataToken()));

    if (gc.type !== GroupConnector.Type.dtgcGC) {
      const allowDataTagLiteral = new AllowedGroupTokens(GroupToken.Type.dataTagLiteral);
      if (!this.parseGroupToken(
        allowDataTagLiteral,
        nestingLevel,
        declInputLevel,
        groupInputLevel,
        gt
      )) {
        return false;
      }
      vec.set(0, new Owner<ContentToken>(new DataTagElementToken(element, templates, gt.text)));
      const allowDtgc = new AllowedGroupConnectors(GroupConnector.Type.dtgcGC);
      if (!this.parseGroupConnector(allowDtgc, declInputLevel, groupInputLevel, gc)) {
        return false;
      }
    } else {
      vec.set(0, new Owner<ContentToken>(new DataTagElementToken(element, templates)));
    }

    const oi = this.getOccurrenceIndicator(Mode.grpMode);
    result.contentToken = new Owner<ContentToken>(new DataTagGroup(vec, oi));
    result.type = GroupToken.Type.dataTagGroup;
    return true;
  }

  // Port of parseParam.cxx lines 789-819
  protected parseDataTagTemplateGroup(
    nestingLevel: number,
    declInputLevel: number,
    result: GroupToken
  ): Boolean {
    if (nestingLevel - 1 === this.syntax().grplvl()) {
      this.message(ParserMessages.grplvl, new NumberMessageArg(this.syntax().grplvl()));
    }
    const groupInputLevel = this.inputLevel();
    const vec = result.textVector;

    for (;;) {
      const gt = new GroupToken();
      const allowDataTagLiteral = new AllowedGroupTokens(GroupToken.Type.dataTagLiteral);
      if (!this.parseGroupToken(
        allowDataTagLiteral,
        nestingLevel,
        declInputLevel,
        groupInputLevel,
        gt
      )) {
        return false;
      }
      if (vec.size() === this.syntax().grpcnt()) {
        this.message(ParserMessages.groupCount, new NumberMessageArg(this.syntax().grpcnt()));
      }
      vec.resize(vec.size() + 1);
      gt.text.swap(vec.get(vec.size() - 1));

      const allowOrGrpc = new AllowedGroupConnectors(
        GroupConnector.Type.orGC,
        GroupConnector.Type.grpcGC
      );
      const gc = new GroupConnector();
      if (!this.parseGroupConnector(allowOrGrpc, declInputLevel, groupInputLevel, gc)) {
        return false;
      }
      if (gc.type === GroupConnector.Type.grpcGC) {
        break;
      }
    }
    return true;
  }

  // Port of parseParam.cxx lines 821-929
  protected parseModelGroup(
    nestingLevel: number,
    declInputLevel: number,
    groupResult: { group: ModelGroup | null },
    oiMode: Mode
  ): Boolean {
    if (nestingLevel - 1 === this.syntax().grplvl()) {
      this.message(ParserMessages.grplvl, new NumberMessageArg(this.syntax().grplvl()));
    }
    const groupInputLevel = this.inputLevel();
    const gt = new GroupToken();
    const tokenVector = new NCVector<Owner<ContentToken>>();
    let connector: GroupConnector.Type = GroupConnector.Type.grpcGC;

    const allowContentToken = new AllowedGroupTokens(
      GroupToken.Type.pcdata,
      GroupToken.Type.dataTagGroup,
      GroupToken.Type.elementToken,
      GroupToken.Type.modelGroup
    );
    const allowCommonContentToken = new AllowedGroupTokens(
      GroupToken.Type.pcdata,
      GroupToken.Type.all,
      GroupToken.Type.implicit,
      GroupToken.Type.dataTagGroup,
      GroupToken.Type.elementToken,
      GroupToken.Type.modelGroup
    );
    const allowAnyConnectorGrpc = new AllowedGroupConnectors(
      GroupConnector.Type.orGC,
      GroupConnector.Type.andGC,
      GroupConnector.Type.seqGC,
      GroupConnector.Type.grpcGC
    );
    const allowOrGrpc = new AllowedGroupConnectors(
      GroupConnector.Type.orGC,
      GroupConnector.Type.grpcGC
    );
    const allowAndGrpc = new AllowedGroupConnectors(
      GroupConnector.Type.andGC,
      GroupConnector.Type.grpcGC
    );
    const allowSeqGrpc = new AllowedGroupConnectors(
      GroupConnector.Type.seqGC,
      GroupConnector.Type.grpcGC
    );

    let connectorp = allowAnyConnectorGrpc;
    const gc = new GroupConnector();
    let pcdataCheck = false;

    do {
      if (!this.parseGroupToken(
        this.sd().www() ? allowCommonContentToken : allowContentToken,
        nestingLevel,
        declInputLevel,
        groupInputLevel,
        gt
      )) {
        return false;
      }

      let contentToken: ContentToken;
      if (gt.type === GroupToken.Type.modelGroup) {
        contentToken = gt.model.extract()!;
      } else {
        contentToken = gt.contentToken.extract()!;
      }

      if (tokenVector.size() === this.syntax().grpcnt()) {
        this.message(ParserMessages.groupCount, new NumberMessageArg(this.syntax().grpcnt()));
      }
      tokenVector.resize(tokenVector.size() + 1);
      tokenVector.set(tokenVector.size() - 1, new Owner<ContentToken>(contentToken));

      if (!this.parseGroupConnector(connectorp, declInputLevel, groupInputLevel, gc)) {
        return false;
      }

      if (this.options().warnMixedContentRepOrGroup && gt.type === GroupToken.Type.pcdata) {
        if (tokenVector.size() !== 1) {
          this.message(ParserMessages.pcdataNotFirstInGroup);
        } else if (gc.type === GroupConnector.Type.seqGC) {
          this.message(ParserMessages.pcdataInSeqGroup);
        } else {
          pcdataCheck = true;
        }
        if (nestingLevel !== 1) {
          this.message(ParserMessages.pcdataInNestedModelGroup);
        }
      } else if (pcdataCheck) {
        if (gt.type === GroupToken.Type.modelGroup) {
          this.message(ParserMessages.pcdataGroupMemberModelGroup);
        }
        if (contentToken.occurrenceIndicator() !== ContentToken.OccurrenceIndicator.none) {
          this.message(ParserMessages.pcdataGroupMemberOccurrenceIndicator);
        }
      }

      if (tokenVector.size() === 1) {
        connector = gc.type;
        switch (gc.type) {
          case GroupConnector.Type.orGC:
            connectorp = allowOrGrpc;
            break;
          case GroupConnector.Type.seqGC:
            connectorp = allowSeqGrpc;
            break;
          case GroupConnector.Type.andGC:
            connectorp = allowAndGrpc;
            if (this.options().warnAndGroup) {
              this.message(ParserMessages.andGroup);
            }
            break;
          default:
            break;
        }
      }
    } while (gc.type !== GroupConnector.Type.grpcGC);

    const oi = this.getOccurrenceIndicator(oiMode);
    switch (connector) {
      case GroupConnector.Type.orGC:
        groupResult.group = new OrModelGroup(tokenVector, oi);
        if (pcdataCheck && oi !== ContentToken.OccurrenceIndicator.rep) {
          this.message(ParserMessages.pcdataGroupNotRep);
        }
        break;
      case GroupConnector.Type.grpcGC:
        if (pcdataCheck && oi !== ContentToken.OccurrenceIndicator.rep && oi !== ContentToken.OccurrenceIndicator.none) {
          this.message(ParserMessages.pcdataGroupNotRep);
        }
        // fall through
      case GroupConnector.Type.seqGC:
        groupResult.group = new SeqModelGroup(tokenVector, oi);
        break;
      case GroupConnector.Type.andGC:
        groupResult.group = new AndModelGroup(tokenVector, oi);
        break;
      default:
        break;
    }
    return true;
  }

  // Port of parseParam.cxx lines 931-952
  protected getOccurrenceIndicator(oiMode: Mode): number {
    const token = this.getToken(oiMode);
    switch (token) {
      case TokenEnum.tokenPlus:
        if (this.currentMarkup()) {
          this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dPLUS);
        }
        return ContentToken.OccurrenceIndicator.plus;
      case TokenEnum.tokenOpt:
        if (this.currentMarkup()) {
          this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dOPT);
        }
        return ContentToken.OccurrenceIndicator.opt;
      case TokenEnum.tokenRep:
        if (this.currentMarkup()) {
          this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dREP);
        }
        return ContentToken.OccurrenceIndicator.rep;
      default:
        this.currentInput()!.ungetToken();
        return ContentToken.OccurrenceIndicator.none;
    }
  }

  // Port of parseParam.cxx lines 954-964
  protected parseMinimumLiteral(lita: Boolean, text: Text): Boolean {
    return this.parseLiteral(
      lita ? Mode.mlitaMode : Mode.mlitMode,
      Mode.mlitMode,
      Syntax.referenceQuantity(Syntax.Quantity.qLITLEN),
      ParserMessages.minimumLiteralLength,
      this.literalSingleSpace | this.literalMinimumData |
        (this.eventsWanted().wantPrologMarkup() ? this.literalDelimInfo : 0),
      text
    );
  }

  // Port of parseParam.cxx lines 966-973
  protected parseSystemIdentifier(lita: Boolean, text: Text): Boolean {
    return this.parseLiteral(
      lita ? Mode.slitaMode : Mode.slitMode,
      Mode.slitMode,
      this.syntax().litlen(),
      ParserMessages.systemIdentifierLength,
      this.eventsWanted().wantPrologMarkup() ? this.literalDelimInfo : 0,
      text
    );
  }

  // Port of parseParam.cxx lines 975-983
  protected parseParameterLiteral(lita: Boolean, text: Text): Boolean {
    return this.parseLiteral(
      lita ? Mode.plitaMode : Mode.plitMode,
      Mode.pliteMode,
      this.syntax().litlen(),
      ParserMessages.parameterLiteralLength,
      this.eventsWanted().wantPrologMarkup() ? this.literalDelimInfo : 0,
      text
    );
  }

  // Port of parseParam.cxx lines 985-995
  protected parseDataTagParameterLiteral(lita: Boolean, text: Text): Boolean {
    return this.parseLiteral(
      lita ? Mode.plitaMode : Mode.plitMode,
      Mode.pliteMode,
      this.syntax().dtemplen(),
      ParserMessages.dataTagPatternLiteralLength,
      this.literalDataTag |
        (this.eventsWanted().wantPrologMarkup() ? this.literalDelimInfo : 0),
      text
    );
  }

  // Port of parseParam.cxx lines 997-1010
  protected parseIndicatedReservedName(allow: AllowedParams, parm: Param): Boolean {
    const rnResult: { rn: number } = { rn: 0 };
    if (!this.getIndicatedReservedName(rnResult)) {
      return false;
    }
    if (!allow.reservedName(rnResult.rn)) {
      this.message(
        ParserMessages.invalidReservedName,
        new StringMessageArg(this.currentToken())
      );
      return false;
    }
    parm.type = Param.indicatedReservedName + rnResult.rn;
    return true;
  }

  // Port of parseParam.cxx lines 1012-1025
  protected parseReservedName(allow: AllowedParams, parm: Param): Boolean {
    const rnResult: { rn: number } = { rn: 0 };
    if (!this.getReservedName(rnResult)) {
      return false;
    }
    if (!allow.reservedName(rnResult.rn)) {
      this.message(
        ParserMessages.invalidReservedName,
        new StringMessageArg(this.syntax().reservedName(rnResult.rn))
      );
      return false;
    }
    parm.type = Param.reservedName + rnResult.rn;
    return true;
  }

  // Port of parseParam.cxx lines 1028-1043
  protected parseAttributeValueParam(parm: Param): Boolean {
    this.extendNameToken(
      this.syntax().litlen() > this.syntax().normsep()
        ? this.syntax().litlen() - this.syntax().normsep()
        : 0,
      ParserMessages.attributeValueLength
    );
    parm.type = Param.attributeValue;
    const text = new Text();
    const input = this.currentInput()!;
    text.addChars(input.currentTokenStart(), input.currentTokenLength(), this.currentLocation());
    text.swap(parm.literalText);
    if (this.currentMarkup()) {
      this.currentMarkup()!.addAttributeValue(input);
    }
    return true;
  }

  // Port of parseParam.cxx lines 1045-1065
  protected getIndicatedReservedName(result: { rn: number }): Boolean {
    if (this.currentMarkup()) {
      this.currentMarkup()!.addDelim(Syntax.DelimGeneral.dRNI);
    }
    const input = this.currentInput()!;
    input.startToken();
    if (!this.syntax().isNameStartCharacter(input.tokenChar(this as any))) {
      this.message(ParserMessages.rniNameStart);
      return false;
    }
    this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);
    const buffer = this.nameBuffer();
    this.getCurrentTokenSubst(this.syntax().generalSubstTable(), buffer);
    const rnResult: { value: number } = { value: 0 };
    if (!this.syntax().lookupReservedName(buffer, rnResult)) {
      this.message(ParserMessages.noSuchReservedName, new StringMessageArg(buffer));
      return false;
    }
    result.rn = rnResult.value;
    if (this.currentMarkup()) {
      this.currentMarkup()!.addReservedName(result.rn, input);
    }
    return true;
  }

  // Port of parseParam.cxx lines 1067-1079
  protected getReservedName(result: { rn: number }): Boolean {
    this.extendNameToken(this.syntax().namelen(), ParserMessages.nameLength);
    const buffer = this.nameBuffer();
    this.getCurrentTokenSubst(this.syntax().generalSubstTable(), buffer);
    const rnResult: { value: number } = { value: 0 };
    if (!this.syntax().lookupReservedName(buffer, rnResult)) {
      this.message(ParserMessages.noSuchReservedName, new StringMessageArg(buffer));
      return false;
    }
    result.rn = rnResult.value;
    if (this.currentMarkup()) {
      this.currentMarkup()!.addReservedName(result.rn, this.currentInput()!);
    }
    return true;
  }

  // Helper method to get current token with substitution
  protected getCurrentTokenSubst(subst: SubstTable, result: StringC): void {
    this.getCurrentToken(result);
    for (let i = 0; i < result.size(); i++) {
      result.set(i, subst.get(result.get(i)));
    }
  }

  // Port of Parser::lookupCreateElement from parser.cxx
  // Look up an element in the definition DTD and create it if it doesn't exist
  protected lookupCreateElement(name: StringC): ElementType {
    let elementType = this.defDtd().lookupElementType(name);
    if (!elementType) {
      elementType = this.lookupCreateUndefinedElement(
        name,
        this.currentLocation(),
        this.defDtdNonConst(),
        true
      );
    }
    return elementType;
  }

  // Get the definition DTD (non-const version)
  protected defDtdNonConst(): Dtd {
    return this.defDtd_.pointer()!;
  }

  // Port of Parser::lookupCreateRankStem from parseDecl.cxx
  protected lookupCreateRankStem(name: StringC): RankStem {
    let r = this.defDtd().lookupRankStem(name);
    if (!r) {
      r = new RankStem(name, this.defDtd().nRankStem());
      this.defDtdNonConst().insertRankStem(r);
      const e = this.defDtd().lookupElementType(name);
      if (e && e.definition() !== null) {
        this.message(ParserMessages.rankStemGenericIdentifier, new StringMessageArg(name));
      }
    }
    return r;
  }

  // Port of Parser::checkElementAttribute from parseDecl.cxx
  protected checkElementAttribute(e: ElementType, checkFrom: number = 0): void {
    if (!this.validate()) {
      return;
    }
    const attDef = e.attributeDef();
    if (!attDef) {
      return;
    }
    let conref = false;
    const edef = e.definition();
    ASSERT(edef !== null);
    const attDefPtr = attDef.pointer();
    if (!attDefPtr) {
      return;
    }
    const attDefLength = attDefPtr.size();
    for (let i = checkFrom; i < attDefLength; i++) {
      const p = attDefPtr.def(i);
      if (p && p.isConref()) {
        conref = true;
      }
      if (p && p.isNotation() && edef!.declaredContent() === ElementDefinition.DeclaredContent.empty) {
        this.message(ParserMessages.notationEmpty, new StringMessageArg(e.name()));
      }
    }
    if (conref) {
      if (edef!.declaredContent() === ElementDefinition.DeclaredContent.empty) {
        this.message(ParserMessages.conrefEmpty, new StringMessageArg(e.name()));
      }
    }
  }

  // Port of Parser::reportAmbiguity from parseDecl.cxx
  protected reportAmbiguity(
    from: LeafContentToken,
    to1: LeafContentToken,
    to2: LeafContentToken,
    ambigAndDepth: number
  ): void {
    let toName = new String<Char>();
    const toType = to1.elementType();
    if (toType) {
      toName = toType.name();
    } else {
      const delim = this.syntax().delimGeneral(Syntax.DelimGeneral.dRNI);
      toName = new String<Char>(delim.data(), delim.size());
      toName.appendString(this.syntax().reservedName(Syntax.ReservedName.rPCDATA));
    }
    const to1Index = to1.typeIndex() + 1;
    const to2Index = to2.typeIndex() + 1;
    if (from.isInitial()) {
      this.message(ParserMessages.ambiguousModelInitial,
        new StringMessageArg(toName),
        new OrdinalMessageArg(to1Index),
        new OrdinalMessageArg(to2Index));
    } else {
      let fromName = new String<Char>();
      const fromType = from.elementType();
      if (fromType) {
        fromName = fromType.name();
      } else {
        const delim2 = this.syntax().delimGeneral(Syntax.DelimGeneral.dRNI);
        fromName = new String<Char>(delim2.data(), delim2.size());
        fromName.appendString(this.syntax().reservedName(Syntax.ReservedName.rPCDATA));
      }
      const fromIndex = from.typeIndex() + 1;
      const andMatches = from.andDepth() - ambigAndDepth;
      if (andMatches === 0) {
        this.message(ParserMessages.ambiguousModel,
          new StringMessageArg(fromName),
          new OrdinalMessageArg(fromIndex),
          new StringMessageArg(toName),
          new OrdinalMessageArg(to1Index),
          new OrdinalMessageArg(to2Index));
      } else if (andMatches === 1) {
        this.message(ParserMessages.ambiguousModelSingleAnd,
          new StringMessageArg(fromName),
          new OrdinalMessageArg(fromIndex),
          new StringMessageArg(toName),
          new OrdinalMessageArg(to1Index),
          new OrdinalMessageArg(to2Index));
      } else {
        this.message(ParserMessages.ambiguousModelMultipleAnd,
          new StringMessageArg(fromName),
          new OrdinalMessageArg(fromIndex),
          new NumberMessageArg(andMatches),
          new StringMessageArg(toName),
          new OrdinalMessageArg(to1Index),
          new OrdinalMessageArg(to2Index));
      }
    }
  }

  // Port of Parser::parseExceptions from parseDecl.cxx
  protected parseExceptions(declInputLevel: number, def: Ptr<ElementDefinition>): boolean {
    const parm = new Param();
    const allowExceptionsMdc = new AllowedParams(Param.mdc, Param.exclusions, Param.inclusions);
    if (!this.parseParam(allowExceptionsMdc, declInputLevel, parm)) {
      return false;
    }
    if (parm.type === Param.exclusions) {
      if (this.options().warnExclusion) {
        this.message(ParserMessages.exclusion);
      }
      def.pointer()!.setExclusions(parm.elementVector);
      const allowInclusionsMdc = new AllowedParams(Param.mdc, Param.inclusions);
      if (!this.parseParam(allowInclusionsMdc, declInputLevel, parm)) {
        return false;
      }
    }
    if (parm.type === Param.inclusions) {
      if (this.options().warnInclusion) {
        this.message(ParserMessages.inclusion);
      }
      def.pointer()!.setInclusions(parm.elementVector);
      const nI = def.pointer()!.nInclusions();
      const nE = def.pointer()!.nExclusions();
      if (nE > 0) {
        for (let i = 0; i < nI; i++) {
          const e = def.pointer()!.inclusion(i);
          for (let j = 0; j < nE; j++) {
            if (def.pointer()!.exclusion(j) === e) {
              this.message(ParserMessages.excludeIncludeSame, new StringMessageArg(e!.name()));
            }
          }
        }
      }
      const allowMdc = new AllowedParams(Param.mdc);
      if (!this.parseParam(allowMdc, declInputLevel, parm)) {
        return false;
      }
    }
    return true;
  }

  // Port of Parser::lookupCreateNotation from parseDecl.cxx
  protected lookupCreateNotation(name: StringC): Ptr<Notation> {
    let nt = this.defDtd().lookupNotation(name);
    if (nt.isNull()) {
      const newNt = new Ptr<Notation>(new Notation(name, this.defDtd().namePointer(), this.defDtd().isBase()));
      nt = this.defDtdNonConst().insertNotation(newNt);
    }
    return nt;
  }

  // Port of Parser::parseExternalId from parseDecl.cxx
  protected parseExternalId(
    sysidAllow: AllowedParams,
    endAllow: AllowedParams,
    maybeWarnMissingSystemId: boolean,
    declInputLevel: number,
    parm: Param,
    id: ExternalId
  ): boolean {
    id.setLocation(this.currentLocation());
    if (parm.type === Param.reservedName + Syntax.ReservedName.rPUBLIC) {
      const allowMinimumLiteral = new AllowedParams(Param.minimumLiteral);
      if (!this.parseParam(allowMinimumLiteral, declInputLevel, parm)) {
        return false;
      }
      const fpierr: { value: any } = { value: null };
      const urnerr: { value: any } = { value: null };
      const result = id.setPublic(parm.literalText, this.sd().internalCharset(),
                                  this.syntax().space(), fpierr, urnerr);
      switch (result) {
        case PublicId.Type.fpi: {
          let textClass: number = 0;
          const publicId = id.publicId();
          if (publicId) {
            const textClassRef = { value: 0 };
            if (this.sd().formal() && publicId.getTextClass(textClassRef) && textClassRef.value === PublicId.TextClass.SD) {
              this.message(ParserMessages.wwwRequired);
            }
          }
          if (this.sd().urn() && !this.sd().formal() && urnerr.value) {
            this.message(urnerr.value, new StringMessageArg(id.publicIdString()!));
          }
          break;
        }
        case PublicId.Type.urn:
          if (this.sd().formal() && !this.sd().urn() && fpierr.value) {
            this.message(fpierr.value, new StringMessageArg(id.publicIdString()!));
          }
          break;
        case PublicId.Type.informal:
          if (this.sd().formal() && fpierr.value) {
            this.message(fpierr.value, new StringMessageArg(id.publicIdString()!));
          }
          if (this.sd().urn() && urnerr.value) {
            this.message(urnerr.value, new StringMessageArg(id.publicIdString()!));
          }
          break;
      }
    }
    if (!this.parseParam(sysidAllow, declInputLevel, parm)) {
      return false;
    }
    if (parm.type === Param.systemIdentifier) {
      id.setSystem(parm.literalText);
      if (!this.parseParam(endAllow, declInputLevel, parm)) {
        return false;
      }
    } else if (this.options().warnMissingSystemId && maybeWarnMissingSystemId) {
      this.message(ParserMessages.missingSystemId);
    }
    return true;
  }

  // Literal parsing flags - Port of Parser.h
  protected readonly literalSingleSpace = 0o01;
  protected readonly literalDataTag = 0o02;
  protected readonly literalMinimumData = 0o04;
  protected readonly literalDelimInfo = 0o010;
  protected readonly literalNonSgml = 0o020;
  protected readonly literalLcnmstrt = 0o040;
  protected readonly literalLcnmchar = 0o0100;

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
