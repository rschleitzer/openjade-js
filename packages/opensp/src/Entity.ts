// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, Index } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Location, EntityOrigin as EntityOriginImport } from './Location';
import { Text } from './Text';
import { Ptr, ConstPtr } from './Ptr';
import { Owner } from './Owner';
import { EntityDecl } from './EntityDecl';
import { ExternalId } from './ExternalId';
import { Markup } from './Markup';
import { Notation } from './Notation';
import { AttributeList } from './Attribute';
import { Allocator } from './Allocator';
import * as ParserMessages from './ParserMessages';
import { StringMessageArg, NumberMessageArg } from './MessageArg';

// Forward declarations
export class ParserState { }
export class InputSource { }

// Entity - base class for all entities
export abstract class Entity extends EntityDecl {
  private used_: PackedBoolean;
  private defaulted_: PackedBoolean;

  constructor(name: StringC, declType: number, dataType: number, defLocation: Location) {
    super(name, declType, dataType, defLocation);
    this.used_ = false;
    this.defaulted_ = false;
  }

  // Reference in a literal
  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // Default implementation - can be overridden
  }

  // Reference in a declaration
  declReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // Default implementation - can be overridden
  }

  // Reference in a declaration subset
  dsReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    this.declReference(parserState, origin);
  }

  // Reference in content
  contentReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    this.normalReference(parserState, origin, true);
  }

  // Reference in rcdata
  rcdataReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    this.normalReference(parserState, origin, true);
  }

  // For entity name attribute checking
  isDataOrSubdoc(): Boolean {
    return false;
  }

  // For determining whether we need to validate as character data
  isCharacterData(): Boolean {
    return false;
  }

  asExternalDataEntity(): ExternalDataEntity | null {
    return null;
  }

  asSubdocEntity(): SubdocEntity | null {
    return null;
  }

  asInternalEntity(): InternalEntity | null {
    return null;
  }

  asExternalEntity(): ExternalEntity | null {
    return null;
  }

  // Needed for default entity
  abstract copy(): Entity;

  generateSystemId(parserState: ParserState): void {
    // Default implementation - can be overridden
  }

  setUsed(): void {
    this.used_ = true;
  }

  used(): Boolean {
    return this.used_;
  }

  setDefaulted(): void {
    this.defaulted_ = true;
  }

  defaulted(): Boolean {
    return this.defaulted_;
  }

  protected checkRef(parserState: ParserState): void {
    // Base implementation - overridden in subclasses
  }

  protected static checkEntlvl(parserState: ParserState): void {
    // Port of Entity::checkEntlvl from Entity.cxx (lines 582-588)
    // -1 because document entity isn't counted
    const ps = parserState as any;
    if (ps.inputLevel() - 1 === ps.syntax().entlvl()) {
      ps.message(ParserMessages.entlvl, new NumberMessageArg(ps.syntax().entlvl()));
    }
  }

  protected checkNotOpen(parserState: ParserState): Boolean {
    // Port of Entity::checkNotOpen from Entity.cxx (lines 590-598)
    const ps = parserState as any;
    if (ps.entityIsOpen(this)) {
      ps.message(ParserMessages.recursiveEntityReference, new StringMessageArg(this.name()));
      return false;
    }
    return true;
  }

  protected abstract normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void;
}

// InternalEntity - base class for internal entities
export abstract class InternalEntity extends Entity {
  protected text_: Text;

  constructor(name: StringC, declType: number, dataType: number, defLocation: Location, text: Text) {
    super(name, declType, dataType, defLocation);
    this.text_ = new Text();
    this.text_.swap(text);
  }

  string(): StringC {
    // TODO: Convert text to string
    return new StringOf<Char>();
  }

  text(): Text {
    return this.text_;
  }

  asInternalEntity(): InternalEntity | null {
    return this;
  }

  protected checkRef(parserState: ParserState): void {
    // Port of InternalEntity::checkRef from Entity.cxx (lines 600-603)
    const ps = parserState as any;
    if (ps.sd().entityRef() === 0) { // Sd::entityRefNone = 0
      ps.message(ParserMessages.entityRefNone);
    }
  }
}

// PiEntity - processing instruction entity
export class PiEntity extends InternalEntity {
  constructor(name: StringC, declType: number, defLocation: Location, text: Text) {
    super(name, declType, EntityDecl.DataType.pi, defLocation, text);
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // Port of PiEntity::litReference from Entity.cxx (lines 300-306)
    (parserState as any).message(ParserMessages.piEntityReference);
  }

  protected normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void {
    // Port of PiEntity::normalReference from Entity.cxx (lines 307-315)
    (parserState as any).noteMarkup();
    // TODO: Fire PiEntityEvent
    // (parserState as any).eventHandler().pi(new PiEntityEvent(this, origin.pointer()));
  }

  declReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // Port of PiEntity::declReference from Entity.cxx (lines 316-320)
    (parserState as any).message(ParserMessages.piEntityReference);
  }

  rcdataReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // Port of PiEntity::rcdataReference from Entity.cxx (lines 322-326)
    (parserState as any).message(ParserMessages.piEntityReference);
  }

  copy(): Entity {
    const textCopy = new Text();
    // TODO: Copy text properly
    return new PiEntity(this.name(), this.declType(), this.defLocation(), textCopy);
  }
}

// InternalDataEntity - base class for internal data entities
export abstract class InternalDataEntity extends InternalEntity {
  constructor(name: StringC, dataType: number, defLocation: Location, text: Text) {
    super(name, EntityDecl.DeclType.generalEntity, dataType, defLocation, text);
  }

  declReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // TODO: Implement data entity declaration reference
  }

  isDataOrSubdoc(): Boolean {
    return true;
  }
}

// InternalCdataEntity - CDATA entity
export class InternalCdataEntity extends InternalDataEntity {
  constructor(name: StringC, defLocation: Location, text: Text) {
    super(name, EntityDecl.DataType.cdata, defLocation, text);
  }

  protected normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void {
    // Port of InternalCdataEntity::normalReference from Entity.cxx (lines 343-351)
    this.checkRef(parserState);
    Entity.checkEntlvl(parserState);
    if (this.string().size() > 0) {
      (parserState as any).noteData();
      // TODO: Fire CdataEntityEvent
      // (parserState as any).eventHandler().data(new CdataEntityEvent(this, origin.pointer()));
    }
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // Port of InternalCdataEntity::litReference from Entity.cxx (lines 358-376)
    this.checkRef(parserState);
    Entity.checkEntlvl(parserState);
    if (squeezeSpaces) {
      const loc = new Location(origin.pointer(), 0);
      text.addEntityStart(loc);
      text.addCharsTokenize(this.text_.string(), loc, (parserState as any).syntax().space());
      loc.addOffset(this.text_.size());
      text.addEntityEnd(loc);
    } else {
      text.addCdata(this.string(), new ConstPtr(origin.pointer()));
    }
  }

  copy(): Entity {
    const textCopy = new Text();
    // TODO: Copy text properly
    return new InternalCdataEntity(this.name(), this.defLocation(), textCopy);
  }

  isCharacterData(): Boolean {
    return this.string().size() > 0;
  }
}

// PredefinedEntity - predefined character entities
export class PredefinedEntity extends InternalCdataEntity {
  constructor(name: StringC, defLocation: Location, text: Text) {
    super(name, defLocation, text);
  }

  protected checkRef(parserState: ParserState): void {
    // Predefined entities don't need reference checking
  }
}

// InternalSdataEntity - SDATA entity
export class InternalSdataEntity extends InternalDataEntity {
  constructor(name: StringC, defLocation: Location, text: Text) {
    super(name, EntityDecl.DataType.sdata, defLocation, text);
  }

  protected normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void {
    // Port of InternalSdataEntity::normalReference from Entity.cxx (lines 410-425)
    this.checkRef(parserState);
    Entity.checkEntlvl(parserState);
    if (this.checkNotOpen(parserState)) {
      if (generateEvent && (parserState as any).wantMarkup()) {
        // TODO: Fire EntityStartEvent
        // (parserState as any).eventHandler().entityStart(new EntityStartEvent(origin));
      }
      // TODO: Push InternalInputSource
      // (parserState as any).pushInput(new InternalInputSource(this.text_.string(), origin.pointer()));
    }
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // Port of InternalSdataEntity::litReference from Entity.cxx (lines 393-410)
    this.checkRef(parserState);
    Entity.checkEntlvl(parserState);
    if (squeezeSpaces) {
      const loc = new Location(origin.pointer(), 0);
      text.addEntityStart(loc);
      text.addCharsTokenize(this.text_.string(), loc, (parserState as any).syntax().space());
      loc.addOffset(this.text_.size());
      text.addEntityEnd(loc);
    } else {
      text.addSdata(this.string(), new ConstPtr(origin.pointer()));
    }
  }

  copy(): Entity {
    const textCopy = new Text();
    // TODO: Copy text properly
    return new InternalSdataEntity(this.name(), this.defLocation(), textCopy);
  }

  isCharacterData(): Boolean {
    return true;
  }
}

// InternalTextEntity - text entity with optional bracketing
export class InternalTextEntity extends InternalEntity {
  static readonly Bracketed = {
    none: 0,
    starttag: 1,
    endtag: 2,
    ms: 3,
    md: 4
  } as const;

  private bracketed_: number;

  constructor(name: StringC, declType: number, defLocation: Location, text: Text, bracketed: number) {
    super(name, declType, EntityDecl.DataType.sgmlText, defLocation, text);
    this.bracketed_ = bracketed;
  }

  copy(): Entity {
    const textCopy = new Text();
    // TODO: Copy text properly
    return new InternalTextEntity(this.name(), this.declType(), this.defLocation(), textCopy, this.bracketed_);
  }

  protected normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void {
    // TODO: Implement text entity normal reference
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // Port of InternalTextEntity::litReference from Entity.cxx (lines 426-433)
    text.addEntityStart(new Location(origin.pointer(), 0));
    this.normalReference(parserState, origin, false);
  }
}

// ExternalEntity - base class for external entities
export abstract class ExternalEntity extends Entity {
  private externalId_: ExternalId;

  constructor(name: StringC, declType: number, dataType: number, defLocation: Location, externalId: ExternalId) {
    super(name, declType, dataType, defLocation);
    this.externalId_ = externalId;
  }

  externalId(): ExternalId {
    return this.externalId_;
  }

  asExternalEntity(): ExternalEntity | null {
    return this;
  }

  generateSystemId(parserState: ParserState): void {
    // TODO: Implement system ID generation via entity catalog
  }

  systemIdPointer(): StringC | null {
    return this.externalId_.systemIdString();
  }

  effectiveSystemIdPointer(): StringC | null {
    if (this.externalId_.effectiveSystemId().size() > 0) {
      return this.externalId_.effectiveSystemId();
    }
    return null;
  }

  publicIdPointer(): StringC | null {
    return this.externalId_.publicIdString();
  }

  protected checkRef(parserState: ParserState): void {
    // Port of ExternalEntity::checkRef from Entity.cxx (lines 605-608)
    const ps = parserState as any;
    if (ps.sd().entityRef() !== 2) { // Sd::entityRefAny = 2
      ps.message(ParserMessages.entityRefInternal);
    }
  }
}

// ExternalTextEntity - external text entity
export class ExternalTextEntity extends ExternalEntity {
  constructor(name: StringC, declType: number, defLocation: Location, externalId: ExternalId) {
    super(name, declType, EntityDecl.DataType.sgmlText, defLocation, externalId);
  }

  copy(): Entity {
    return new ExternalTextEntity(this.name(), this.declType(), this.defLocation(), this.externalId());
  }

  protected normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void {
    // Port of ExternalTextEntity::normalReference from Entity.cxx (lines 435-457)
    this.checkRef(parserState);
    Entity.checkEntlvl(parserState);
    if (this.checkNotOpen(parserState)) {
      if (generateEvent && (parserState as any).wantMarkup()) {
        // TODO: Fire EntityStartEvent
        // (parserState as any).eventHandler().entityStart(new EntityStartEvent(origin));
      }
      if (this.externalId().effectiveSystemId().size() > 0) {
        // TODO: Push input from entity manager
        // (parserState as any).pushInput(
        //   (parserState as any).entityManager().open(
        //     this.externalId().effectiveSystemId(),
        //     (parserState as any).sd().docCharset(),
        //     origin.pointer(),
        //     0,
        //     parserState
        //   )
        // );
      } else {
        (parserState as any).message(
          ParserMessages.nonExistentEntityRef,
          new StringMessageArg(this.name()),
          this.defLocation()
        );
      }
    }
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // Port of ExternalTextEntity::litReference from Entity.cxx (lines 459-470)
    if ((parserState as any).options().warnAttributeValueExternalEntityRef &&
        this.declType() === EntityDecl.DeclType.generalEntity) {
      (parserState as any).message(ParserMessages.attributeValueExternalEntityRef);
    }
    text.addEntityStart(new Location(origin.pointer(), 0));
    this.normalReference(parserState, origin, false);
  }
}

// ExternalNonTextEntity - base class for external non-text entities
export abstract class ExternalNonTextEntity extends ExternalEntity {
  constructor(name: StringC, declType: number, dataType: number, defLocation: Location, externalId: ExternalId) {
    super(name, declType, dataType, defLocation, externalId);
  }

  isDataOrSubdoc(): Boolean {
    return true;
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // Port of ExternalNonTextEntity::litReference from Entity.cxx (lines 511-517)
    (parserState as any).message(ParserMessages.externalNonTextEntityRcdata);
  }

  rcdataReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // Port of ExternalNonTextEntity::rcdataReference from Entity.cxx (lines 520-524)
    (parserState as any).message(ParserMessages.externalNonTextEntityRcdata);
  }

  protected normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void {
    // Port of ExternalNonTextEntity::normalReference from Entity.cxx (lines 504-509)
    (parserState as any).message(ParserMessages.externalNonTextEntityReference);
  }

  dsReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // Port of ExternalNonTextEntity::dsReference from Entity.cxx (lines 497-502)
    (parserState as any).message(ParserMessages.dtdDataEntityReference);
  }

  isCharacterData(): Boolean {
    return true;
  }
}

// ExternalDataEntity - external data entity
export class ExternalDataEntity extends ExternalNonTextEntity {
  private notation_: ConstPtr<Notation>;
  private attributes_: AttributeList;

  constructor(
    name: StringC,
    dataType: number,
    defLocation: Location,
    externalId: ExternalId,
    notation: ConstPtr<Notation>,
    attributes: AttributeList,
    declType: number = EntityDecl.DeclType.generalEntity
  ) {
    super(name, declType, dataType, defLocation, externalId);
    this.notation_ = notation;
    this.attributes_ = new AttributeList();
    this.attributes_.swap(attributes);
  }

  attributes(): AttributeList {
    return this.attributes_;
  }

  notation(): Notation | null {
    return this.notation_.pointer();
  }

  asExternalDataEntity(): ExternalDataEntity | null {
    return this;
  }

  copy(): Entity {
    return new ExternalDataEntity(
      this.name(),
      this.dataType(),
      this.defLocation(),
      this.externalId(),
      this.notation_,
      this.attributes_,
      this.declType()
    );
  }

  contentReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // Port of ExternalDataEntity::contentReference from Entity.cxx (lines 477-487)
    if ((parserState as any).options().warnExternalDataEntityRef) {
      (parserState as any).message(ParserMessages.externalDataEntityRef);
    }
    this.checkRef(parserState);
    Entity.checkEntlvl(parserState);
    (parserState as any).noteData();
    // TODO: Fire ExternalDataEntityEvent
    // (parserState as any).eventHandler().externalDataEntity(
    //   new ExternalDataEntityEvent(this, origin.pointer())
    // );
  }

  setNotation(notation: ConstPtr<Notation>, attributes: AttributeList): void {
    this.notation_ = notation;
    this.attributes_.swap(attributes);
  }
}

// SubdocEntity - subdocument entity
export class SubdocEntity extends ExternalNonTextEntity {
  constructor(name: StringC, defLocation: Location, externalId: ExternalId) {
    super(name, EntityDecl.DeclType.generalEntity, EntityDecl.DataType.subdoc, defLocation, externalId);
  }

  asSubdocEntity(): SubdocEntity | null {
    return this;
  }

  copy(): Entity {
    return new SubdocEntity(this.name(), this.defLocation(), this.externalId());
  }

  contentReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // TODO: Implement subdocument content reference
  }
}

// IgnoredEntity - entity that is ignored
export class IgnoredEntity extends Entity {
  constructor(name: StringC, declType: number) {
    super(name, declType, EntityDecl.DataType.sgmlText, new Location());
  }

  copy(): Entity {
    return new IgnoredEntity(this.name(), this.declType());
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // Ignored
  }

  declReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // Ignored
  }

  protected normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void {
    // Ignored
  }
}

// Note: EntityOrigin is defined in Location.ts and re-exported there
// The factory methods would be added to Location.ts if needed
