// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { ParserState, Phase } from './ParserState';
import { SgmlParser } from './SgmlParser';
import { Sd } from './Sd';
import { Ptr, ConstPtr } from './Ptr';
import { EntityManager } from './EntityManager';
import { EntityCatalog } from './EntityCatalog';
import { ParserOptions } from './ParserOptions';
import { Event } from './Event';
import { EventHandler } from './EventHandler';
import { InputSourceOrigin } from './Location';
import { charMax } from './constant';
import { PublicId } from './ExternalId';
import { CharsetDecl } from './CharsetDecl';
import { StringC } from './StringC';
import { NumberMessageArg } from './MessageArg';
import * as ParserMessages from './ParserMessages';

export class Parser extends ParserState {
  private sysid_: StringC;

  constructor(params: SgmlParser.Params) {
    // Determine entity manager
    const entityMgr = params.parent
      ? params.parent.parser_.entityManagerPtr()
      : params.entityManager;

    // Determine options
    const opts = params.options
      ? params.options
      : params.parent
      ? params.parent.parser_.options()
      : new ParserOptions();

    // Determine subdoc level and final phase
    const subdocLevel = Parser.paramsSubdocLevel(params);
    const finalPhase =
      params.entityType === SgmlParser.Params.EntityType.dtd
        ? Phase.declSubsetPhase
        : Phase.contentPhase;

    // Call parent constructor
    super(entityMgr!, opts, subdocLevel, finalPhase);

    this.sysid_ = params.sysid;

    let parent: Parser | null = null;
    if (params.parent) {
      parent = params.parent.parser_;
    }

    if (params.entityType === SgmlParser.Params.EntityType.document) {
      // Create new Sd for document parsing
      const sd = new Sd(this.entityManagerPtr());
      const opt = this.options();

      sd.setBooleanFeature(Sd.BooleanFeature.fDATATAG, opt.datatag);
      sd.setBooleanFeature(Sd.BooleanFeature.fOMITTAG, opt.omittag);
      sd.setBooleanFeature(Sd.BooleanFeature.fRANK, opt.rank);
      sd.setShorttag(opt.shorttag);
      sd.setBooleanFeature(Sd.BooleanFeature.fEMPTYNRM, opt.emptynrm);
      sd.setNumberFeature(Sd.NumberFeature.fSIMPLE, opt.linkSimple);
      sd.setBooleanFeature(Sd.BooleanFeature.fIMPLICIT, opt.linkImplicit);
      sd.setNumberFeature(Sd.NumberFeature.fEXPLICIT, opt.linkExplicit);
      sd.setNumberFeature(Sd.NumberFeature.fCONCUR, opt.concur);
      sd.setNumberFeature(Sd.NumberFeature.fSUBDOC, opt.subdoc);
      sd.setBooleanFeature(Sd.BooleanFeature.fFORMAL, opt.formal);

      this.setSdOverrides(sd);

      const publicId = new PublicId();
      const docCharsetDecl = new CharsetDecl();
      docCharsetDecl.addSection(publicId);
      docCharsetDecl.addRange(0, charMax > 99999999 ? 99999999 : charMax + 1, 0);
      sd.setDocCharsetDecl(docCharsetDecl);

      this.setSd(new ConstPtr(sd));
    } else if (params.sd === null) {
      // Use parent's Sd
      this.setSd(parent!.sdPointer());
      this.setSyntaxes(
        parent!.prologSyntaxPointer(),
        parent!.instanceSyntaxPointer()
      );
    } else {
      // Use provided Sd
      this.setSd(params.sd);
      this.setSyntaxes(params.prologSyntax!, params.instanceSyntax!);
    }

    // Make catalog
    const sysid = params.sysid;
    const catalog = this.entityManager().makeCatalog(
      sysid,
      this.sd().docCharset(),
      this
    );

    if (catalog !== null) {
      this.setEntityCatalog(catalog);
    } else if (parent) {
      this.setEntityCatalog(parent.entityCatalogPtr());
    } else {
      this.allDone();
      return;
    }

    // Set up the input stack
    if (sysid.size() === 0) {
      this.allDone();
      return;
    }

    let origin: Ptr<InputSourceOrigin>;
    if (params.origin === null) {
      origin = new Ptr(InputSourceOrigin.make());
    } else {
      origin = params.origin;
    }

    // Set the base ID for resolving relative paths (e.g., DTD references)
    const em = this.entityManager() as any;
    if (em.setCurrentBaseId) {
      em.setCurrentBaseId(sysid);
    }

    this.pushInput(
      this.entityManager().open(
        sysid,
        this.sd().docCharset(),
        origin.pointer(),
        EntityManager.mayRewind | EntityManager.maySetDocCharset,
        this
      )
    );

    if (this.inputLevel() === 0) {
      this.allDone();
      return;
    }

    switch (params.entityType) {
      case SgmlParser.Params.EntityType.document:
        this.setPhase(Phase.initPhase);
        break;
      case SgmlParser.Params.EntityType.subdoc:
        if (params.subdocInheritActiveLinkTypes && parent) {
          this.inheritActiveLinkTypes(parent);
        }
        if (this.subdocLevel() === this.sd().subdoc() + 1) {
          this.message(
            ParserMessages.subdocLevel,
            new NumberMessageArg(this.sd().subdoc())
          );
        }
        if (this.sd().www()) {
          this.setPhase(Phase.initPhase);
        } else {
          this.setPhase(Phase.prologPhase);
          this.compilePrologModes();
        }
        break;
      case SgmlParser.Params.EntityType.dtd:
        this.compilePrologModes();
        this.startDtd(params.doctypeName);
        this.setPhase(Phase.declSubsetPhase);
        break;
    }
  }

  protected override setSdOverrides(sd: Sd): void {
    // FIXME overriding behaviour when using multiple -w options
    if (this.options().typeValid !== ParserOptions.sgmlDeclTypeValid) {
      sd.setTypeValid(Boolean(this.options().typeValid));
      sd.setBooleanFeature(Sd.BooleanFeature.fIMPLYDEFATTLIST, !this.options().typeValid);
      sd.setImplydefElement(
        this.options().typeValid
          ? Sd.ImplydefElement.implydefElementNo
          : Sd.ImplydefElement.implydefElementYes
      );
      sd.setBooleanFeature(Sd.BooleanFeature.fIMPLYDEFENTITY, !this.options().typeValid);
      sd.setBooleanFeature(Sd.BooleanFeature.fIMPLYDEFNOTATION, !this.options().typeValid);
    }
    if (this.options().fullyDeclared) {
      sd.setBooleanFeature(Sd.BooleanFeature.fIMPLYDEFATTLIST, false);
      sd.setImplydefElement(Sd.ImplydefElement.implydefElementNo);
      sd.setBooleanFeature(Sd.BooleanFeature.fIMPLYDEFENTITY, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fIMPLYDEFNOTATION, false);
    }
    if (this.options().fullyTagged) {
      sd.setBooleanFeature(Sd.BooleanFeature.fDATATAG, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fRANK, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fOMITTAG, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fSTARTTAGEMPTY, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fATTRIBOMITNAME, false);
    }
    if (this.options().amplyTagged) {
      sd.setBooleanFeature(Sd.BooleanFeature.fDATATAG, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fRANK, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fOMITTAG, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fATTRIBOMITNAME, false);
      sd.setImplydefElement(Sd.ImplydefElement.implydefElementYes);
    }
    if (this.options().amplyTaggedAnyother) {
      sd.setBooleanFeature(Sd.BooleanFeature.fDATATAG, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fRANK, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fOMITTAG, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fATTRIBOMITNAME, false);
      sd.setImplydefElement(Sd.ImplydefElement.implydefElementAnyother);
    }
    if (this.options().valid) {
      sd.setTypeValid(true);
    }
    if (this.options().entityRef) {
      sd.setEntityRef(Sd.EntityRef.entityRefNone);
    }
    if (this.options().externalEntityRef) {
      sd.setEntityRef(Sd.EntityRef.entityRefInternal);
    }
    if (this.options().integral) {
      sd.setIntegrallyStored(true);
    }
    if (this.options().noUnclosedTag) {
      sd.setBooleanFeature(Sd.BooleanFeature.fSTARTTAGUNCLOSED, false);
      sd.setBooleanFeature(Sd.BooleanFeature.fENDTAGUNCLOSED, false);
    }
    if (this.options().noNet) {
      sd.setStartTagNetEnable(Sd.NetEnable.netEnableNo);
    }
  }

  private static paramsSubdocLevel(params: SgmlParser.Params): number {
    if (!params.parent) {
      return 0;
    }
    const n = params.parent.parser_.subdocLevel();
    if (params.subdocReferenced) {
      return n + 1;
    } else {
      return n;
    }
  }

  nextEvent(): Event | null {
    while (this.eventQueueEmpty()) {
      switch (this.phase()) {
        case Phase.noPhase:
          return null;
        case Phase.initPhase:
          this.doInit();
          break;
        case Phase.prologPhase:
          this.doProlog();
          break;
        case Phase.declSubsetPhase:
          this.doDeclSubset();
          break;
        case Phase.instanceStartPhase:
          this.doInstanceStart();
          break;
        case Phase.contentPhase:
          this.doContent();
          break;
      }
    }
    return this.eventQueueGet();
  }

  parseAll(handler: EventHandler, cancelPtr?: number): void {
    while (!this.eventQueueEmpty()) {
      this.eventQueueGet()!.handle(handler);
    }
    // FIXME catch exceptions and reset handler.
    this.setHandler(handler, cancelPtr);
    for (;;) {
      const currentPhase = this.phase();
      switch (currentPhase) {
        case Phase.noPhase:
          this.unsetHandler();
          return;
        case Phase.initPhase:
          this.doInit();
          break;
        case Phase.prologPhase:
          this.doProlog();
          break;
        case Phase.declSubsetPhase:
          this.doDeclSubset();
          break;
        case Phase.instanceStartPhase:
          this.doInstanceStart();
          break;
        case Phase.contentPhase:
          this.doContent();
          break;
      }
    }
  }

  // Public methods exposed from ParserState
  public sdPointer(): ConstPtr<Sd> {
    return super.sdPointer();
  }

  public instanceSyntaxPointer(): any {
    return super.instanceSyntaxPointer();
  }

  public prologSyntaxPointer(): any {
    return super.prologSyntaxPointer();
  }

  public activateLinkType(name: StringC): void {
    return super.activateLinkType(name);
  }

  public allLinkTypesActivated(): void {
    return super.allLinkTypesActivated();
  }

  public entityManager(): EntityManager {
    return super.entityManager();
  }

  public entityCatalog(): EntityCatalog {
    return super.entityCatalog();
  }

  public baseDtd(): any {
    return super.baseDtd();
  }

  public options(): ParserOptions {
    return super.options();
  }
}
