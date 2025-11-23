// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { StringC } from './StringC';
import { EntityDecl } from './EntityDecl';
import { Attributed } from './Attributed';
import { ConstPtr } from './Ptr';
import { StringResource } from './StringResource';
import { Char } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { ExternalId } from './ExternalId';
import { Location } from './Location';

// Forward declaration
export interface ParserState {
  // Will be defined in ParserState.ts
}

export class Notation extends EntityDecl {
  private attributed_: Attributed;
  private defined_: PackedBoolean;
  private externalId_: ExternalId;

  constructor(name: StringC, dtdName: ConstPtr<StringResource<Char>>, dtdIsBase: Boolean) {
    super(name, EntityDecl.DeclType.notation, EntityDecl.DataType.ndata, new Location());
    this.attributed_ = new Attributed();
    this.defined_ = false;
    this.externalId_ = new ExternalId();
    this.setDeclIn(dtdName, dtdIsBase);
  }

  setExternalId(id: ExternalId, defLocation: Location): void {
    this.externalId_ = id;
    this.defined_ = true;
    this.setDefLocation(defLocation);
  }

  externalId(): ExternalId {
    return this.externalId_;
  }

  defined(): Boolean {
    return this.defined_;
  }

  generateSystemId(_parser: ParserState): void {
    // Will be implemented when ParserState is available
    // For now, this is a placeholder
  }

  systemIdPointer(): StringC | null {
    return this.externalId_.systemIdString();
  }

  publicIdPointer(): StringC | null {
    return this.externalId_.publicIdString();
  }

  // Attributed interface delegation
  attributeDef(): Attributed {
    return this.attributed_;
  }

  setAttributeDef(def: any): void {
    this.attributed_.setAttributeDef(def);
  }
}
