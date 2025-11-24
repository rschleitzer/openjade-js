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
    // TODO: Implement reference checking
  }

  protected static checkEntlvl(parserState: ParserState): void {
    // TODO: Implement entity level checking
  }

  protected checkNotOpen(parserState: ParserState): Boolean {
    // TODO: Implement open entity checking
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
    super.checkRef(parserState);
    // TODO: Additional internal entity checks
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
    // TODO: Implement PI literal reference
  }

  protected normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void {
    // TODO: Implement PI normal reference
  }

  declReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // TODO: Implement PI declaration reference
  }

  rcdataReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // TODO: Implement PI rcdata reference
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
    // TODO: Implement CDATA normal reference
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // TODO: Implement CDATA literal reference
  }

  copy(): Entity {
    const textCopy = new Text();
    // TODO: Copy text properly
    return new InternalCdataEntity(this.name(), this.defLocation(), textCopy);
  }

  isCharacterData(): Boolean {
    return true;
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
    // TODO: Implement SDATA normal reference
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // TODO: Implement SDATA literal reference
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
    super.checkRef(parserState);
    // TODO: Additional external entity checks
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
    // TODO: Implement external text normal reference
  }

  litReference(
    text: Text,
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    squeezeSpaces: Boolean
  ): void {
    // TODO: Implement external text literal reference
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
    // TODO: Implement error - can't reference in literal
  }

  rcdataReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // TODO: Implement error - can't reference in rcdata
  }

  protected normalReference(
    parserState: ParserState,
    origin: Ptr<EntityOriginImport>,
    generateEvent: Boolean
  ): void {
    // TODO: Implement error - can't reference normally
  }

  dsReference(parserState: ParserState, origin: Ptr<EntityOriginImport>): void {
    // TODO: Implement error - can't reference in DS
  }

  isCharacterData(): Boolean {
    return this.dataType() === EntityDecl.DataType.cdata;
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
    // TODO: Implement external data content reference
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
