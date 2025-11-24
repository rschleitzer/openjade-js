// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Link } from './Link';
import { Allocator } from './Allocator';
import { Location, EntityOrigin } from './Location';
import { Vector } from './Vector';
import { Owner } from './Owner';
import { Boolean, PackedBoolean } from './Boolean';
import { Char } from './types';
import { Ptr, ConstPtr } from './Ptr';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Notation } from './Notation';
import { Sd } from './Sd';
import { Syntax } from './Syntax';
import { Dtd } from './Dtd';
import { ElementType } from './ElementType';
import { Text } from './Text';
import { Lpd, LinkSet } from './Lpd';
import { Message } from './Message';
import { Markup } from './Markup';
import { ShortReferenceMap } from './ShortReferenceMap';
import {
  Entity,
  InternalEntity,
  ExternalDataEntity,
  SubdocEntity,
  PiEntity
} from './Entity';
import { AttributeList } from './Attribute';

// Forward declaration
export abstract class EventHandler {
  abstract message(event: MessageEvent): void;
}

export abstract class Event extends Link {
  static readonly Type = {
    message: 0,
    characterData: 1,
    startElement: 2,
    endElement: 3,
    pi: 4,
    sdataEntity: 5,
    externalDataEntity: 6,
    subdocEntity: 7,
    nonSgmlChar: 8,
    appinfo: 9,
    startDtd: 10,
    endDtd: 11,
    startLpd: 12,
    endLpd: 13,
    endProlog: 14,
    sgmlDecl: 15,
    uselink: 16,
    usemap: 17,
    commentDecl: 18,
    sSep: 19,
    ignoredRs: 20,
    ignoredRe: 21,
    reOrigin: 22,
    ignoredChars: 23,
    markedSectionStart: 24,
    markedSectionEnd: 25,
    entityStart: 26,
    entityEnd: 27,
    notationDecl: 28,
    entityDecl: 29,
    elementDecl: 30,
    attlistDecl: 31,
    attlistNotationDecl: 32,
    linkAttlistDecl: 33,
    linkDecl: 34,
    idLinkDecl: 35,
    shortrefDecl: 36,
    ignoredMarkup: 37,
    entityDefaulted: 38,
    sgmlDeclEntity: 39
  } as const;

  private type_: number;

  constructor(type: number) {
    super();
    this.type_ = type;
  }

  abstract handle(handler: EventHandler): void;

  copyData(): void {
    // Default implementation does nothing
  }

  type(): number {
    return this.type_;
  }
}

export abstract class LocatedEvent extends Event {
  private location_: Location;

  constructor(type: number, location: Location) {
    super(type);
    this.location_ = location;
  }

  location(): Location {
    return this.location_;
  }
}

export abstract class MarkupEvent extends LocatedEvent {
  private markup_: Markup;

  constructor(type: number);
  constructor(type: number, location: Location, markup: Markup | null);
  constructor(type: number, locationOrNothing?: Location, markup?: Markup | null) {
    if (locationOrNothing === undefined) {
      super(type, new Location());
      this.markup_ = new Markup();
    } else {
      super(type, locationOrNothing);
      this.markup_ = markup ?? new Markup();
    }
  }

  markup(): Markup {
    return this.markup_;
  }
}

export class MessageEvent extends Event {
  private message_: Message;

  constructor(message: Message) {
    super(Event.Type.message);
    this.message_ = message;
  }

  message(): Message {
    return this.message_;
  }

  handle(handler: EventHandler): void {
    handler.message(this);
  }
}

export class StartElementEvent extends LocatedEvent {
  private elementType_: ElementType | null;
  private dtd_: ConstPtr<Dtd>;
  private included_: PackedBoolean;
  private copied_: PackedBoolean;
  private markup_: Markup | null;
  private attributes_: AttributeList | null;

  constructor(
    elementType: ElementType | null,
    dtd: ConstPtr<Dtd>,
    attributes: AttributeList | null,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.startElement, location);
    this.elementType_ = elementType;
    this.dtd_ = dtd;
    this.included_ = false;
    this.copied_ = false;
    this.markup_ = markup;
    this.attributes_ = attributes;
  }

  handle(handler: EventHandler): void {
    // handler.startElement(this);
  }

  mustOmitEnd(): Boolean {
    // TODO: Implement
    return false;
  }

  setIncluded(): void {
    this.included_ = true;
  }

  included(): Boolean {
    return this.included_;
  }

  name(): StringC {
    return this.elementType_ ? this.elementType_.name() : new StringOf<Char>();
  }

  elementType(): ElementType | null {
    return this.elementType_;
  }

  markupPtr(): Markup | null {
    return this.markup_;
  }

  attributes(): AttributeList {
    return this.attributes_ ?? new AttributeList();
  }

  copyData(): void {
    if (this.copied_) {
      return;
    }
    this.copied_ = true;
    // TODO: Deep copy attributes and markup
  }
}

export class EndElementEvent extends LocatedEvent {
  private elementType_: ElementType | null;
  private dtd_: ConstPtr<Dtd>;
  private included_: PackedBoolean;
  private copied_: PackedBoolean;
  private markup_: Markup | null;

  constructor(
    elementType: ElementType | null,
    dtd: ConstPtr<Dtd>,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.endElement, location);
    this.elementType_ = elementType;
    this.dtd_ = dtd;
    this.included_ = false;
    this.copied_ = false;
    this.markup_ = markup;
  }

  handle(handler: EventHandler): void {
    // handler.endElement(this);
  }

  setIncluded(): void {
    this.included_ = true;
  }

  included(): Boolean {
    return this.included_;
  }

  name(): StringC {
    return this.elementType_ ? this.elementType_.name() : new StringOf<Char>();
  }

  elementType(): ElementType | null {
    return this.elementType_;
  }

  markupPtr(): Markup | null {
    return this.markup_;
  }

  copyData(): void {
    if (this.copied_) {
      return;
    }
    this.copied_ = true;
    // TODO: Deep copy markup
  }
}

export class DataEvent extends LocatedEvent {
  protected p_: Uint32Array | null;
  protected length_: number;

  constructor(type: number, data: Uint32Array | null, length: number, location: Location) {
    super(type, location);
    this.p_ = data;
    this.length_ = length;
  }

  handle(handler: EventHandler): void {
    // handler.data(this);
  }

  data(): Uint32Array | null {
    return this.p_;
  }

  dataLength(): number {
    return this.length_;
  }

  isRe(serialRef: { value: number }): Boolean {
    return false;
  }

  entity(): Entity | null {
    return null;
  }
}

export class ImmediateDataEvent extends DataEvent {
  private alloc_: Uint32Array | null;

  constructor(
    type: number,
    data: Uint32Array | null,
    length: number,
    location: Location,
    copy: Boolean
  ) {
    super(type, data, length, location);
    if (copy && data) {
      this.alloc_ = new Uint32Array(data.slice(0, length));
      this.p_ = this.alloc_;
    } else {
      this.alloc_ = null;
    }
  }

  copyData(): void {
    if (this.alloc_ || !this.p_) {
      return;
    }
    this.alloc_ = new Uint32Array(this.p_.slice(0, this.length_));
    this.p_ = this.alloc_;
  }
}

// More event classes to be added...
// This is a partial port - Event.h has 54 event classes total
// Remaining classes include:
// - DataEntityEvent, CdataEntityEvent, SdataEntityEvent
// - PiEvent, ImmediatePiEvent, PiEntityEvent
// - ExternalEntityEvent, ExternalDataEntityEvent, SubdocEntityEvent
// - NonSgmlCharEvent, AppinfoEvent
// - UselinkEvent, UsemapEvent
// - StartSubsetEvent, StartDtdEvent, StartLpdEvent
// - EndDtdEvent, EndLpdEvent, EndPrologEvent
// - SgmlDeclEvent, NotationDeclEvent, EntityDeclEvent
// - ElementDeclEvent, AttlistDeclEvent, LinkAttlistDeclEvent
// - LinkDeclEvent, IdLinkDeclEvent, ShortrefDeclEvent
// - CommentDeclEvent, SSepEvent, IgnoredRsEvent, IgnoredReEvent
// - ReOriginEvent, IgnoredCharsEvent
// - MarkedSectionStartEvent, MarkedSectionEndEvent
// - EntityStartEvent, EntityEndEvent
// - IgnoredMarkupEvent, EntityDefaultedEvent, SgmlDeclEntityEvent

// TODO: Complete remaining event classes in next session
