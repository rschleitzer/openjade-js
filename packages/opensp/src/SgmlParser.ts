// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Parser } from './Parser';
import { Event } from './Event';
import { EventHandler } from './EventHandler';
import { StringC } from './StringC';
import { Ptr, ConstPtr } from './Ptr';
import { Sd } from './Sd';
import { Syntax } from './Syntax';
import { Dtd } from './Dtd';
import { EntityManager } from './EntityManager';
import { EntityCatalog } from './EntityCatalog';
import { ParserOptions } from './ParserOptions';
import { InputSourceOrigin } from './Location';
import { PackedBoolean } from './Boolean';
import { String as StringOf } from './StringOf';
import { Char } from './types';

export class SgmlParser {
  public parser_: Parser | null;

  constructor(params?: SgmlParser.Params) {
    if (params) {
      this.parser_ = new Parser(params);
    } else {
      this.parser_ = null;
    }
  }

  init(params: SgmlParser.Params): void {
    this.parser_ = new Parser(params);
  }

  nextEvent(): Event | null {
    return this.parser_!.nextEvent();
  }

  parseAll(handler: EventHandler, cancelPtr?: number): void {
    this.parser_!.parseAll(handler, cancelPtr);
  }

  sd(): ConstPtr<Sd> {
    return this.parser_!.sdPointer();
  }

  instanceSyntax(): any {
    return this.parser_!.instanceSyntaxPointer();
  }

  prologSyntax(): any {
    return this.parser_!.prologSyntaxPointer();
  }

  entityManager(): EntityManager {
    return this.parser_!.entityManager();
  }

  entityCatalog(): EntityCatalog {
    return this.parser_!.entityCatalog();
  }

  activateLinkType(name: StringC): void {
    this.parser_!.activateLinkType(name);
  }

  allLinkTypesActivated(): void {
    this.parser_!.allLinkTypesActivated();
  }

  swap(s: SgmlParser): void {
    const tem = this.parser_;
    this.parser_ = s.parser_;
    s.parser_ = tem;
  }

  baseDtd(): any {
    return this.parser_!.baseDtd();
  }

  options(): ParserOptions {
    return this.parser_!.options();
  }
}

export namespace SgmlParser {
  export class Params {
    entityType: Params.EntityType;
    sysid: StringC;
    origin: Ptr<InputSourceOrigin> | null;
    entityManager: Ptr<EntityManager> | null;
    parent: SgmlParser | null;
    sd: ConstPtr<Sd> | null;
    prologSyntax: ConstPtr<Syntax> | null;
    instanceSyntax: ConstPtr<Syntax> | null;
    subdocLevel: number;
    options: ParserOptions | null;
    subdocInheritActiveLinkTypes: PackedBoolean;
    subdocReferenced: PackedBoolean;
    doctypeName: StringC;

    constructor() {
      this.entityType = Params.EntityType.document;
      this.sysid = new StringOf<Char>();
      this.origin = null;
      this.entityManager = null;
      this.parent = null;
      this.sd = null;
      this.prologSyntax = null;
      this.instanceSyntax = null;
      this.subdocLevel = 0;
      this.options = null;
      this.subdocInheritActiveLinkTypes = false;
      this.subdocReferenced = false;
      this.doctypeName = new StringOf<Char>();
    }
  }

  export namespace Params {
    export enum EntityType {
      document,
      subdoc,
      dtd,
    }
  }
}
