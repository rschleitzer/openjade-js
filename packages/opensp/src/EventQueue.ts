// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { IQueue } from './IQueue';
import {
  Event,
  EventHandler,
  MessageEvent,
  StartElementEvent,
  EndElementEvent,
  DataEvent,
  SdataEntityEvent,
  PiEvent,
  ExternalDataEntityEvent,
  SubdocEntityEvent,
  NonSgmlCharEvent,
  AppinfoEvent,
  StartDtdEvent,
  EndDtdEvent,
  EndPrologEvent,
  SgmlDeclEvent,
  CommentDeclEvent,
  MarkedSectionStartEvent,
  MarkedSectionEndEvent,
  IgnoredCharsEvent,
  ReEvent,
  ReOriginEvent,
  SSepEvent,
  IgnoredRsEvent,
  IgnoredReEvent,
  EntityStartEvent,
  EntityEndEvent,
  EntityDeclEvent,
  NotationDeclEvent,
  ElementDeclEvent,
  AttlistDeclEvent,
  AttlistNotationDeclEvent,
  LinkAttlistDeclEvent,
  LinkDeclEvent,
  IdLinkDeclEvent,
  ShortrefDeclEvent,
  UselinkEvent,
  UsemapEvent,
  StartLpdEvent,
  EndLpdEvent,
  IgnoredMarkupEvent,
  EntityDefaultedEvent,
  SgmlDeclEntityEvent,
  ImmediateDataEvent,
  CdataEntityEvent,
  ImmediatePiEvent,
  PiEntityEvent,
  ExternalEntityEvent,
  StartSubsetEvent
} from './Event';
import { Boolean } from './Boolean';

export class EventQueue extends EventHandler {
  private queue_: IQueue<Event>;

  constructor() {
    super();
    this.queue_ = new IQueue<Event>();
  }

  // EventHandler methods - all append events to queue
  message(event: MessageEvent): void {
    this.append(event);
  }

  startElement(event: StartElementEvent): void {
    this.append(event);
  }

  endElement(event: EndElementEvent): void {
    this.append(event);
  }

  data(event: DataEvent): void {
    this.append(event);
  }

  sdataEntity(event: SdataEntityEvent): void {
    this.append(event);
  }

  pi(event: PiEvent): void {
    this.append(event);
  }

  externalDataEntity(event: ExternalDataEntityEvent): void {
    this.append(event);
  }

  subdocEntity(event: SubdocEntityEvent): void {
    this.append(event);
  }

  nonSgmlChar(event: NonSgmlCharEvent): void {
    this.append(event);
  }

  appinfo(event: AppinfoEvent): void {
    this.append(event);
  }

  startDtd(event: StartDtdEvent): void {
    this.append(event);
  }

  endDtd(event: EndDtdEvent): void {
    this.append(event);
  }

  endProlog(event: EndPrologEvent): void {
    this.append(event);
  }

  sgmlDecl(event: SgmlDeclEvent): void {
    this.append(event);
  }

  commentDecl(event: CommentDeclEvent): void {
    this.append(event);
  }

  markedSectionStart(event: MarkedSectionStartEvent): void {
    this.append(event);
  }

  markedSectionEnd(event: MarkedSectionEndEvent): void {
    this.append(event);
  }

  ignoredChars(event: IgnoredCharsEvent): void {
    this.append(event);
  }

  generalEntity(event: EntityStartEvent): void {
    this.append(event);
  }

  reEvent(event: ReEvent): void {
    this.append(event);
  }

  reOrigin(event: ReOriginEvent): void {
    this.append(event);
  }

  sSep(event: SSepEvent): void {
    this.append(event);
  }

  ignoredRs(event: IgnoredRsEvent): void {
    this.append(event);
  }

  ignoredRe(event: IgnoredReEvent): void {
    this.append(event);
  }

  entityEnd(event: EntityEndEvent): void {
    this.append(event);
  }

  entityDecl(event: EntityDeclEvent): void {
    this.append(event);
  }

  notationDecl(event: NotationDeclEvent): void {
    this.append(event);
  }

  elementDecl(event: ElementDeclEvent): void {
    this.append(event);
  }

  attlistDecl(event: AttlistDeclEvent): void {
    this.append(event);
  }

  attlistNotationDecl(event: AttlistNotationDeclEvent): void {
    this.append(event);
  }

  linkAttlistDecl(event: LinkAttlistDeclEvent): void {
    this.append(event);
  }

  linkDecl(event: LinkDeclEvent): void {
    this.append(event);
  }

  idLinkDecl(event: IdLinkDeclEvent): void {
    this.append(event);
  }

  shortrefDecl(event: ShortrefDeclEvent): void {
    this.append(event);
  }

  uselink(event: UselinkEvent): void {
    this.append(event);
  }

  usemap(event: UsemapEvent): void {
    this.append(event);
  }

  startLpd(event: StartLpdEvent): void {
    this.append(event);
  }

  endLpd(event: EndLpdEvent): void {
    this.append(event);
  }

  ignoredMarkup(event: IgnoredMarkupEvent): void {
    this.append(event);
  }

  entityDefaulted(event: EntityDefaultedEvent): void {
    this.append(event);
  }

  sgmlDeclEntity(event: SgmlDeclEntityEvent): void {
    this.append(event);
  }

  immediateData(event: ImmediateDataEvent): void {
    this.append(event);
  }

  cdataEntity(event: CdataEntityEvent): void {
    this.append(event);
  }

  immediatePi(event: ImmediatePiEvent): void {
    this.append(event);
  }

  piEntity(event: PiEntityEvent): void {
    this.append(event);
  }

  externalEntity(event: ExternalEntityEvent): void {
    this.append(event);
  }

  startSubset(event: StartSubsetEvent): void {
    this.append(event);
  }

  // Queue access methods
  get(): Event | null {
    return this.queue_.get();
  }

  empty(): boolean {
    return this.queue_.empty();
  }

  clear(): void {
    this.queue_.clear();
  }

  private append(event: Event): void {
    this.queue_.append(event);
  }
}

export class Pass1EventHandler extends EventQueue {
  private hadError_: Boolean;
  private origHandler_: EventHandler | null;

  constructor() {
    super();
    this.hadError_ = false;
    this.origHandler_ = null;
  }

  init(origHandler: EventHandler): void {
    this.origHandler_ = origHandler;
  }

  message(event: MessageEvent): void {
    // Check if it's an error message
    const msg = event.message();
    if (msg && msg.type && msg.type.severity && msg.type.severity() > 0) {
      this.hadError_ = true;
    }
    super.message(event);
  }

  hadError(): Boolean {
    return this.hadError_;
  }

  origHandler(): EventHandler | null {
    return this.origHandler_;
  }
}
