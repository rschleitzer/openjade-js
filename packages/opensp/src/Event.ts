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

export class DataEntityEvent extends DataEvent {
  constructor(type: number, entity: InternalEntity | null, origin: ConstPtr<EntityOrigin>) {
    // Extract data from entity
    const data = null; // TODO: Extract from entity
    const length = 0;
    const location = origin.pointer() ? origin.pointer()!.location() : new Location();
    super(type, data, length, location);
  }

  entity(): Entity | null {
    // TODO: Return entity
    return null;
  }
}

export class CdataEntityEvent extends DataEntityEvent {
  constructor(entity: InternalEntity | null, origin: ConstPtr<EntityOrigin>) {
    super(Event.Type.characterData, entity, origin);
  }
}

export class SdataEntityEvent extends DataEntityEvent {
  constructor(entity: InternalEntity | null, origin: ConstPtr<EntityOrigin>) {
    super(Event.Type.sdataEntity, entity, origin);
  }

  handle(handler: EventHandler): void {
    // handler.sdataEntity(this);
  }
}

export class PiEvent extends LocatedEvent {
  private data_: Uint32Array | null;
  private dataLength_: number;

  constructor(data: Uint32Array | null, length: number, location: Location) {
    super(Event.Type.pi, location);
    this.data_ = data;
    this.dataLength_ = length;
  }

  data(): Uint32Array | null {
    return this.data_;
  }

  dataLength(): number {
    return this.dataLength_;
  }

  entity(): Entity | null {
    return null;
  }

  handle(handler: EventHandler): void {
    // handler.pi(this);
  }
}

export class ImmediatePiEvent extends PiEvent {
  private string_: StringC;

  constructor(str: StringC, location: Location) {
    const dataArray = str.data();
    const data = dataArray ? new Uint32Array(dataArray) : null;
    super(data, str.size(), location);
    this.string_ = str;
  }
}

export class PiEntityEvent extends PiEvent {
  constructor(entity: PiEntity | null, origin: ConstPtr<EntityOrigin>) {
    const location = origin.pointer() ? origin.pointer()!.location() : new Location();
    super(null, 0, location);
  }

  entity(): Entity | null {
    // TODO: Return entity
    return null;
  }
}

export class ExternalEntityEvent extends Event {
  private origin_: ConstPtr<EntityOrigin>;

  constructor(type: number, origin: ConstPtr<EntityOrigin>) {
    super(type);
    this.origin_ = origin;
  }

  entityOrigin(): ConstPtr<EntityOrigin> {
    return this.origin_;
  }

  location(): Location {
    return this.origin_.pointer() ? this.origin_.pointer()!.location() : new Location();
  }

  handle(handler: EventHandler): void {
    // Default implementation
  }
}

export class ExternalDataEntityEvent extends ExternalEntityEvent {
  private dataEntity_: ExternalDataEntity | null;

  constructor(entity: ExternalDataEntity | null, origin: ConstPtr<EntityOrigin>) {
    super(Event.Type.externalDataEntity, origin);
    this.dataEntity_ = entity;
  }

  handle(handler: EventHandler): void {
    // handler.externalDataEntity(this);
  }

  entity(): ExternalDataEntity | null {
    return this.dataEntity_;
  }
}

export class SubdocEntityEvent extends ExternalEntityEvent {
  private subdocEntity_: SubdocEntity | null;

  constructor(entity: SubdocEntity | null, origin: ConstPtr<EntityOrigin>) {
    super(Event.Type.subdocEntity, origin);
    this.subdocEntity_ = entity;
  }

  handle(handler: EventHandler): void {
    // handler.subdocEntity(this);
  }

  entity(): SubdocEntity | null {
    return this.subdocEntity_;
  }
}

export class NonSgmlCharEvent extends LocatedEvent {
  private c_: Char;

  constructor(c: Char, location: Location) {
    super(Event.Type.nonSgmlChar, location);
    this.c_ = c;
  }

  character(): Char {
    return this.c_;
  }

  handle(handler: EventHandler): void {
    // handler.nonSgmlChar(this);
  }
}

export class AppinfoEvent extends LocatedEvent {
  private appinfoNone_: Boolean;
  private appinfo_: Text;

  constructor(location: Location);
  constructor(text: Text, location: Location);
  constructor(textOrLocation: Text | Location, location?: Location) {
    if (location === undefined) {
      // First constructor: location only
      super(Event.Type.appinfo, textOrLocation as Location);
      this.appinfoNone_ = true;
      this.appinfo_ = new Text();
    } else {
      // Second constructor: text and location
      super(Event.Type.appinfo, location);
      this.appinfoNone_ = false;
      this.appinfo_ = textOrLocation as Text;
    }
  }

  handle(handler: EventHandler): void {
    // handler.appinfo(this);
  }

  literal(strRef: { value: StringC | null }): Boolean {
    // TODO: Implement
    return false;
  }
}

export class UselinkEvent extends MarkupEvent {
  private lpd_: ConstPtr<Lpd>;
  private linkSet_: LinkSet | null;
  private restore_: Boolean;

  constructor(
    lpd: ConstPtr<Lpd>,
    linkSet: LinkSet | null,
    restore: Boolean,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.uselink, location, markup);
    this.lpd_ = lpd;
    this.linkSet_ = linkSet;
    this.restore_ = restore;
  }

  handle(handler: EventHandler): void {
    // handler.uselink(this);
  }

  lpd(): ConstPtr<Lpd> {
    return this.lpd_;
  }

  linkSet(): LinkSet | null {
    return this.linkSet_;
  }

  restore(): Boolean {
    return this.restore_;
  }
}

export class UsemapEvent extends MarkupEvent {
  private dtd_: ConstPtr<Dtd>;
  private elements_: Vector<ElementType | null>;
  private map_: ShortReferenceMap | null;

  constructor(
    map: ShortReferenceMap | null,
    elements: Vector<ElementType | null>,
    dtd: ConstPtr<Dtd>,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.usemap, location, markup);
    this.map_ = map;
    this.dtd_ = dtd;
    this.elements_ = new Vector<ElementType | null>();
    elements.swap(this.elements_);
  }

  handle(handler: EventHandler): void {
    // handler.usemap(this);
  }

  map(): ShortReferenceMap | null {
    return this.map_;
  }

  elements(): Vector<ElementType | null> {
    return this.elements_;
  }
}

export abstract class StartSubsetEvent extends MarkupEvent {
  private name_: StringC;
  private entity_: ConstPtr<Entity>;
  private hasInternalSubset_: Boolean;

  constructor(
    type: number,
    name: StringC,
    entity: ConstPtr<Entity>,
    hasInternalSubset: Boolean,
    location: Location,
    markup: Markup | null
  ) {
    super(type, location, markup);
    this.name_ = name;
    this.entity_ = entity;
    this.hasInternalSubset_ = hasInternalSubset;
  }

  name(): StringC {
    return this.name_;
  }

  entity(): ConstPtr<Entity> {
    return this.entity_;
  }

  hasInternalSubset(): Boolean {
    return this.hasInternalSubset_;
  }
}

export class StartDtdEvent extends StartSubsetEvent {
  constructor(
    name: StringC,
    entity: ConstPtr<Entity>,
    hasInternalSubset: Boolean,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.startDtd, name, entity, hasInternalSubset, location, markup);
  }

  handle(handler: EventHandler): void {
    // handler.startDtd(this);
  }
}

export class StartLpdEvent extends StartSubsetEvent {
  private active_: Boolean;

  constructor(
    active: Boolean,
    name: StringC,
    entity: ConstPtr<Entity>,
    hasInternalSubset: Boolean,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.startLpd, name, entity, hasInternalSubset, location, markup);
    this.active_ = active;
  }

  handle(handler: EventHandler): void {
    // handler.startLpd(this);
  }

  active(): Boolean {
    return this.active_;
  }
}

export class EndDtdEvent extends MarkupEvent {
  private dtd_: ConstPtr<Dtd>;

  constructor(dtd: ConstPtr<Dtd>, location: Location, markup: Markup | null) {
    super(Event.Type.endDtd, location, markup);
    this.dtd_ = dtd;
  }

  handle(handler: EventHandler): void {
    // handler.endDtd(this);
  }

  dtd(): Dtd | null {
    return this.dtd_.pointer();
  }

  dtdPointer(): ConstPtr<Dtd> {
    return this.dtd_;
  }
}

export class EndLpdEvent extends MarkupEvent {
  private lpd_: ConstPtr<Lpd>;

  constructor(lpd: ConstPtr<Lpd>, location: Location, markup: Markup | null) {
    super(Event.Type.endLpd, location, markup);
    this.lpd_ = lpd;
  }

  handle(handler: EventHandler): void {
    // handler.endLpd(this);
  }

  lpd(): Lpd | null {
    return this.lpd_.pointer();
  }

  lpdPointer(): ConstPtr<Lpd> {
    return this.lpd_;
  }
}

export class EndPrologEvent extends LocatedEvent {
  private dtd_: ConstPtr<Dtd>;
  private lpd_: ConstPtr<any>; // ComplexLpd
  private simpleLinkNames_: Vector<StringC>;
  private simpleLinkAttributes_: Vector<AttributeList>;

  constructor(dtd: ConstPtr<Dtd>, location: Location);
  constructor(
    dtd: ConstPtr<Dtd>,
    lpd: ConstPtr<any>,
    simpleLinkNames: Vector<StringC>,
    simpleLinkAttributes: Vector<AttributeList>,
    location: Location
  );
  constructor(
    dtd: ConstPtr<Dtd>,
    lpdOrLocation: ConstPtr<any> | Location,
    simpleLinkNames?: Vector<StringC>,
    simpleLinkAttributes?: Vector<AttributeList>,
    location?: Location
  ) {
    if (location === undefined) {
      // First constructor
      super(Event.Type.endProlog, lpdOrLocation as Location);
      this.dtd_ = dtd;
      this.lpd_ = new ConstPtr<any>(null);
      this.simpleLinkNames_ = new Vector<StringC>();
      this.simpleLinkAttributes_ = new Vector<AttributeList>();
    } else {
      // Second constructor
      super(Event.Type.endProlog, location);
      this.dtd_ = dtd;
      this.lpd_ = lpdOrLocation as ConstPtr<any>;
      this.simpleLinkNames_ = new Vector<StringC>();
      simpleLinkNames!.swap(this.simpleLinkNames_);
      this.simpleLinkAttributes_ = new Vector<AttributeList>();
      simpleLinkAttributes!.swap(this.simpleLinkAttributes_);
    }
  }

  handle(handler: EventHandler): void {
    // handler.endProlog(this);
  }

  dtd(): Dtd | null {
    return this.dtd_.pointer();
  }

  dtdPointer(): ConstPtr<Dtd> {
    return this.dtd_;
  }

  lpdPointer(): ConstPtr<any> {
    return this.lpd_;
  }

  simpleLinkNames(): Vector<StringC> {
    return this.simpleLinkNames_;
  }

  simpleLinkAttributes(): Vector<AttributeList> {
    return this.simpleLinkAttributes_;
  }
}

export class SgmlDeclEvent extends MarkupEvent {
  private sd_: ConstPtr<Sd>;
  private prologSyntax_: ConstPtr<Syntax>;
  private instanceSyntax_: ConstPtr<Syntax>;
  private refSd_: ConstPtr<Sd>;
  private refSyntax_: ConstPtr<Syntax>;
  private nextIndex_: number;
  private implySystemId_: StringC;

  constructor(sd: ConstPtr<Sd>, syntax: ConstPtr<Syntax>);
  constructor(
    sd: ConstPtr<Sd>,
    syntax: ConstPtr<Syntax>,
    instanceSyntax: ConstPtr<Syntax>,
    refSd: ConstPtr<Sd>,
    refSyntax: ConstPtr<Syntax>,
    nextIndex: number,
    implySystemId: StringC,
    location: Location,
    markup: Markup | null
  );
  constructor(
    sd: ConstPtr<Sd>,
    syntax: ConstPtr<Syntax>,
    instanceSyntax?: ConstPtr<Syntax>,
    refSd?: ConstPtr<Sd>,
    refSyntax?: ConstPtr<Syntax>,
    nextIndex?: number,
    implySystemId?: StringC,
    location?: Location,
    markup?: Markup | null
  ) {
    if (instanceSyntax === undefined) {
      // First constructor - implied SGML declaration
      super(Event.Type.sgmlDecl);
      this.sd_ = sd;
      this.prologSyntax_ = syntax;
      this.instanceSyntax_ = new ConstPtr<Syntax>(null);
      this.refSd_ = new ConstPtr<Sd>(null);
      this.refSyntax_ = new ConstPtr<Syntax>(null);
      this.nextIndex_ = 0;
      this.implySystemId_ = new StringOf<Char>();
    } else {
      // Second constructor - explicit SGML declaration
      super(Event.Type.sgmlDecl, location!, markup!);
      this.sd_ = sd;
      this.prologSyntax_ = syntax;
      this.instanceSyntax_ = instanceSyntax;
      this.refSd_ = refSd!;
      this.refSyntax_ = refSyntax!;
      this.nextIndex_ = nextIndex!;
      this.implySystemId_ = implySystemId!;
    }
  }

  handle(handler: EventHandler): void {
    // handler.sgmlDecl(this);
  }

  sd(): Sd | null {
    return this.sd_.pointer();
  }

  sdPointer(): ConstPtr<Sd> {
    return this.sd_;
  }

  prologSyntax(): Syntax | null {
    return this.prologSyntax_.pointer();
  }

  prologSyntaxPointer(): ConstPtr<Syntax> {
    return this.prologSyntax_;
  }

  instanceSyntax(): Syntax | null {
    return this.instanceSyntax_.pointer();
  }

  instanceSyntaxPointer(): ConstPtr<Syntax> {
    return this.instanceSyntax_;
  }

  refSdPointer(): ConstPtr<Sd> {
    return this.refSd_;
  }

  refSyntaxPointer(): ConstPtr<Syntax> {
    return this.refSyntax_;
  }

  implySystemId(): StringC {
    return this.implySystemId_;
  }
}

export class CommentDeclEvent extends MarkupEvent {
  constructor(location: Location, markup: Markup | null) {
    super(Event.Type.commentDecl, location, markup);
  }

  handle(handler: EventHandler): void {
    // handler.commentDecl(this);
  }
}

export class SSepEvent extends ImmediateDataEvent {
  constructor(data: Uint32Array | null, length: number, location: Location, copy: Boolean) {
    super(Event.Type.sSep, data, length, location, copy);
  }

  handle(handler: EventHandler): void {
    // handler.sSep(this);
  }
}

export class IgnoredRsEvent extends LocatedEvent {
  private c_: Char;

  constructor(c: Char, location: Location) {
    super(Event.Type.ignoredRs, location);
    this.c_ = c;
  }

  handle(handler: EventHandler): void {
    // handler.ignoredRs(this);
  }

  rs(): Char {
    return this.c_;
  }
}

export class IgnoredReEvent extends LocatedEvent {
  private serial_: number;
  private c_: Char;

  constructor(c: Char, location: Location, serial: number) {
    super(Event.Type.ignoredRe, location);
    this.c_ = c;
    this.serial_ = serial;
  }

  handle(handler: EventHandler): void {
    // handler.ignoredRe(this);
  }

  re(): Char {
    return this.c_;
  }

  serial(): number {
    return this.serial_;
  }
}

export class ReEvent extends ImmediateDataEvent {
  private serial_: number;

  constructor(data: Uint32Array | null, location: Location, serial: number) {
    super(Event.Type.ignoredRe, data, 1, location, false);
    this.serial_ = serial;
  }

  isRe(serialRef: { value: number }): Boolean {
    serialRef.value = this.serial_;
    return true;
  }
}

export class ReOriginEvent extends LocatedEvent {
  private serial_: number;
  private c_: Char;

  constructor(c: Char, location: Location, serial: number) {
    super(Event.Type.reOrigin, location);
    this.c_ = c;
    this.serial_ = serial;
  }

  handle(handler: EventHandler): void {
    // handler.reOrigin(this);
  }

  re(): Char {
    return this.c_;
  }

  serial(): number {
    return this.serial_;
  }
}

export class IgnoredCharsEvent extends ImmediateDataEvent {
  constructor(data: Uint32Array | null, length: number, location: Location, copy: Boolean) {
    super(Event.Type.ignoredChars, data, length, location, copy);
  }

  handle(handler: EventHandler): void {
    // handler.ignoredChars(this);
  }
}

export abstract class MarkedSectionEvent extends MarkupEvent {
  static readonly Status = {
    include: 0,
    rcdata: 1,
    cdata: 2,
    ignore: 3
  } as const;

  private status_: number;

  constructor(type: number, status: number, location: Location, markup: Markup | null) {
    super(type, location, markup);
    this.status_ = status;
  }

  status(): number {
    return this.status_;
  }
}

export class MarkedSectionStartEvent extends MarkedSectionEvent {
  constructor(status: number, location: Location, markup: Markup | null) {
    super(Event.Type.markedSectionStart, status, location, markup);
  }

  handle(handler: EventHandler): void {
    // handler.markedSectionStart(this);
  }
}

export class MarkedSectionEndEvent extends MarkedSectionEvent {
  constructor(status: number, location: Location, markup: Markup | null) {
    super(Event.Type.markedSectionEnd, status, location, markup);
  }

  handle(handler: EventHandler): void {
    // handler.markedSectionEnd(this);
  }
}

export class EntityStartEvent extends Event {
  private origin_: ConstPtr<EntityOrigin>;

  constructor(origin: ConstPtr<EntityOrigin>) {
    super(Event.Type.entityStart);
    this.origin_ = origin;
  }

  handle(handler: EventHandler): void {
    // handler.entityStart(this);
  }

  entity(): any {
    const origin = this.origin_.pointer();
    return origin ? origin.entity() : null;
  }

  entityOrigin(): ConstPtr<EntityOrigin> {
    return this.origin_;
  }
}

export class EntityEndEvent extends LocatedEvent {
  constructor(location: Location) {
    super(Event.Type.entityEnd, location);
  }

  handle(handler: EventHandler): void {
    // handler.entityEnd(this);
  }
}

export class EntityDeclEvent extends MarkupEvent {
  private ignored_: Boolean;
  private entity_: ConstPtr<Entity>;

  constructor(
    entity: ConstPtr<Entity>,
    ignored: Boolean,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.entityDecl, location, markup);
    this.entity_ = entity;
    this.ignored_ = ignored;
  }

  handle(handler: EventHandler): void {
    // handler.entityDecl(this);
  }

  entity(): Entity | null {
    return this.entity_.pointer();
  }

  entityPointer(): ConstPtr<Entity> {
    return this.entity_;
  }

  ignored(): Boolean {
    return this.ignored_;
  }
}

export class NotationDeclEvent extends MarkupEvent {
  private notation_: ConstPtr<Notation>;

  constructor(notation: ConstPtr<Notation>, location: Location, markup: Markup | null) {
    super(Event.Type.notationDecl, location, markup);
    this.notation_ = notation;
  }

  handle(handler: EventHandler): void {
    // handler.notationDecl(this);
  }

  notation(): Notation | null {
    return this.notation_.pointer();
  }

  notationPointer(): ConstPtr<Notation> {
    return this.notation_;
  }
}

export class ElementDeclEvent extends MarkupEvent {
  private elements_: Vector<ElementType | null>;
  private dtd_: ConstPtr<Dtd>;

  constructor(
    elements: Vector<ElementType | null>,
    dtd: ConstPtr<Dtd>,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.elementDecl, location, markup);
    this.elements_ = new Vector<ElementType | null>();
    elements.swap(this.elements_);
    this.dtd_ = dtd;
  }

  handle(handler: EventHandler): void {
    // handler.elementDecl(this);
  }

  elements(): Vector<ElementType | null> {
    return this.elements_;
  }
}

export class AttlistDeclEvent extends MarkupEvent {
  private elements_: Vector<ElementType | null>;
  private dtd_: ConstPtr<Dtd>;

  constructor(
    elements: Vector<ElementType | null>,
    dtd: ConstPtr<Dtd>,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.attlistDecl, location, markup);
    this.elements_ = new Vector<ElementType | null>();
    elements.swap(this.elements_);
    this.dtd_ = dtd;
  }

  handle(handler: EventHandler): void {
    // handler.attlistDecl(this);
  }

  elements(): Vector<ElementType | null> {
    return this.elements_;
  }
}

export class AttlistNotationDeclEvent extends MarkupEvent {
  private notations_: Vector<ConstPtr<Notation>>;

  constructor(
    notations: Vector<ConstPtr<Notation>>,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.attlistNotationDecl, location, markup);
    this.notations_ = new Vector<ConstPtr<Notation>>();
    notations.swap(this.notations_);
  }

  handle(handler: EventHandler): void {
    // handler.attlistNotationDecl(this);
  }

  notations(): Vector<ConstPtr<Notation>> {
    return this.notations_;
  }
}

export class LinkAttlistDeclEvent extends MarkupEvent {
  private elements_: Vector<ElementType | null>;
  private lpd_: ConstPtr<Lpd>;

  constructor(
    elements: Vector<ElementType | null>,
    lpd: ConstPtr<Lpd>,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.linkAttlistDecl, location, markup);
    this.elements_ = new Vector<ElementType | null>();
    elements.swap(this.elements_);
    this.lpd_ = lpd;
  }

  handle(handler: EventHandler): void {
    // handler.linkAttlistDecl(this);
  }

  elements(): Vector<ElementType | null> {
    return this.elements_;
  }

  lpd(): Lpd | null {
    return this.lpd_.pointer();
  }
}

export class LinkDeclEvent extends MarkupEvent {
  private linkSet_: LinkSet | null;
  private lpd_: ConstPtr<any>; // ComplexLpd

  constructor(
    linkSet: LinkSet | null,
    lpd: ConstPtr<any>,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.linkDecl, location, markup);
    this.linkSet_ = linkSet;
    this.lpd_ = lpd;
  }

  handle(handler: EventHandler): void {
    // handler.linkDecl(this);
  }

  linkSet(): LinkSet | null {
    return this.linkSet_;
  }

  lpd(): any {
    return this.lpd_.pointer();
  }
}

export class IdLinkDeclEvent extends MarkupEvent {
  private lpd_: ConstPtr<any>; // ComplexLpd

  constructor(lpd: ConstPtr<any>, location: Location, markup: Markup | null) {
    super(Event.Type.idLinkDecl, location, markup);
    this.lpd_ = lpd;
  }

  handle(handler: EventHandler): void {
    // handler.idLinkDecl(this);
  }

  lpd(): any {
    return this.lpd_.pointer();
  }
}

export class ShortrefDeclEvent extends MarkupEvent {
  private map_: ShortReferenceMap | null;
  private dtd_: ConstPtr<Dtd>;

  constructor(
    map: ShortReferenceMap | null,
    dtd: ConstPtr<Dtd>,
    location: Location,
    markup: Markup | null
  ) {
    super(Event.Type.shortrefDecl, location, markup);
    this.map_ = map;
    this.dtd_ = dtd;
  }

  handle(handler: EventHandler): void {
    // handler.shortrefDecl(this);
  }

  map(): ShortReferenceMap | null {
    return this.map_;
  }
}

export class IgnoredMarkupEvent extends MarkupEvent {
  constructor(location: Location, markup: Markup | null) {
    super(Event.Type.ignoredMarkup, location, markup);
  }

  handle(handler: EventHandler): void {
    // handler.ignoredMarkup(this);
  }
}

export class EntityDefaultedEvent extends LocatedEvent {
  private entity_: ConstPtr<Entity>;

  constructor(entity: ConstPtr<Entity>, location: Location) {
    super(Event.Type.entityDefaulted, location);
    this.entity_ = entity;
  }

  handle(handler: EventHandler): void {
    // handler.entityDefaulted(this);
  }

  entity(): Entity | null {
    return this.entity_.pointer();
  }

  entityPointer(): ConstPtr<Entity> {
    return this.entity_;
  }
}

export class SgmlDeclEntityEvent extends LocatedEvent {
  private publicId_: any; // PublicId from ExternalId
  private entityType_: number; // PublicId.TextClass
  private effectiveSystemId_: StringC;

  constructor(
    publicId: any,
    entityType: number,
    effectiveSystemId: StringC,
    location: Location
  ) {
    super(Event.Type.sgmlDeclEntity, location);
    this.publicId_ = publicId;
    this.entityType_ = entityType;
    this.effectiveSystemId_ = effectiveSystemId;
  }

  handle(handler: EventHandler): void {
    // handler.sgmlDeclEntity(this);
  }

  publicId(): any {
    return this.publicId_;
  }

  entityType(): number {
    return this.entityType_;
  }

  effectiveSystemId(): StringC {
    return this.effectiveSystemId_;
  }
}
