// Copyright (c) 1996, 1997 James Clark
// See the file copying.txt for copying permission.

import {
  StringC,
  Char,
  SgmlParser,
  ParserOptions,
  Messenger,
  Message,
  MessageFormatter,
  Location,
  InputSource,
  InputSourceOrigin,
  CharsetInfo,
  UnivCharsetDesc,
  EntityManager,
  Ptr,
  String as StringOf
} from '@openjade-js/opensp';
import { NodePtr } from '../grove/Node';
import { FOTBuilder } from './FOTBuilder';
import { FOTBuilderExtension, StyleEngine, GroveManager } from './StyleEngine';
import { GroveBuilder } from '../spgrove/GroveBuilder';

// Simple message formatter - minimal implementation
class SimpleMessageFormatter extends MessageFormatter {
  getMessageText(_frag: any, _text: StringC): boolean {
    // Return false - we don't have message text
    return false;
  }
}

// Helper to convert StringC to string
function stringCToString(sc: StringC): string {
  if (!sc.ptr_ || sc.length_ === 0) return '';
  let result = '';
  for (let i = 0; i < sc.length_; i++) {
    result += String.fromCharCode(sc.ptr_[i]);
  }
  return result;
}

// Helper to create StringC from string
function makeStringC(s: string): StringC {
  const arr: Char[] = [];
  for (let i = 0; i < s.length; i++) {
    arr.push(s.charCodeAt(i));
  }
  return new StringOf<Char>(arr, arr.length);
}

// DssslApp - DSSSL application base class
// Ported from upstream openjade/style/DssslApp.cxx
export abstract class DssslApp extends Messenger implements GroveManager {
  protected unitsPerInch_: number;
  protected dssslSpecOption_: boolean = false;
  protected dssslSpecSysid_: StringC;
  protected dssslSpecId_: StringC;
  protected defineVars_: StringC[] = [];
  protected rootNode_: NodePtr | null = null;
  protected rootSystemId_: StringC;
  protected debugMode_: boolean = false;
  protected dsssl2_: boolean = false;
  protected strictMode_: boolean = false;
  protected groveTable_: Map<string, NodePtr> = new Map();
  protected entityManager_: EntityManager | null = null;
  protected options_: ParserOptions;
  defaultOutputBasename_: StringC;
  private systemCharset_: CharsetInfo;

  constructor(unitsPerInch: number) {
    super();
    this.unitsPerInch_ = unitsPerInch;
    this.dssslSpecSysid_ = makeStringC('');
    this.dssslSpecId_ = makeStringC('');
    this.rootSystemId_ = makeStringC('');
    this.defaultOutputBasename_ = makeStringC('');
    this.options_ = new ParserOptions();

    // Create Unicode charset
    const range = { descMin: 0, count: 0x110000, univMin: 0 };
    const desc = new UnivCharsetDesc([range], 1);
    this.systemCharset_ = new CharsetInfo(desc);
  }

  // Abstract method - subclass must provide FOTBuilder
  abstract makeFOTBuilder(exts: { value: FOTBuilderExtension[] | null }): FOTBuilder | null;

  // Messenger interface - override
  override dispatchMessage(msg: Message): void {
    // Default: print to console
    const typeText = msg.type?.text?.() || 'message';
    console.error(`[${typeText}]`);
  }

  // GroveManager interface
  mapSysid(_sysid: StringC): void {
    // Map a sysid according to SYSTEM catalog entries
    // Simplified - in full implementation would use catalog lookup
  }

  readEntity(sysid: StringC, contents: { value: StringC }): boolean {
    // Read entity contents using Node's fs module directly
    // TODO: This is a workaround - should use EntityManager properly
    const sysidStr = stringCToString(sysid);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');

    // Try reading the file directly
    try {
      const data = fs.readFileSync(sysidStr, 'utf8') as string;
      const chars: Char[] = [];
      for (let i = 0; i < data.length; i++) {
        chars.push(data.charCodeAt(i));
      }
      contents.value = {
        ptr_: chars,
        length_: chars.length,
        size: () => chars.length
      } as StringC;
      return true;
    } catch (e) {
      // File not found directly, try other paths
    }

    // For builtins.dsl, try package dsssl directory
    // Note: __dirname at runtime is dist/style/, so need to go up 2 levels to package root
    if (sysidStr === 'builtins.dsl') {
      const builtinsPath = path.join(__dirname, '..', '..', 'dsssl', 'builtins.dsl');
      try {
        const data = fs.readFileSync(builtinsPath, 'utf8') as string;
        const chars: Char[] = [];
        for (let i = 0; i < data.length; i++) {
          chars.push(data.charCodeAt(i));
        }
        contents.value = {
          ptr_: chars,
          length_: chars.length,
          size: () => chars.length
        } as StringC;
        return true;
      } catch (e) {
        // Not found in package dsssl directory
      }
    }

    // Fall back to entity manager
    if (!this.entityManager_) {
      return false;
    }

    const inSrc = this.entityManager_.open(
      sysid,
      this.systemCharset_,
      InputSourceOrigin.make(),
      0,
      this
    );
    if (!inSrc) {
      return false;
    }

    const chars: Char[] = [];
    for (;;) {
      const c = inSrc.get(this);
      if (c === InputSource.eE) break;
      inSrc.extendToBufferEnd();
      const start = inSrc.currentTokenStart();
      const startIdx = inSrc.currentTokenStartIndex();
      const length = inSrc.currentTokenLength();
      for (let i = 0; i < length; i++) {
        chars.push(start[startIdx + i]);
      }
    }

    contents.value = {
      ptr_: chars,
      length_: chars.length,
      size: () => chars.length
    } as StringC;

    return !inSrc.accessError();
  }

  // Set entity manager
  setEntityManager(em: EntityManager): void {
    this.entityManager_ = em;
  }

  entityManager(): EntityManager | null {
    return this.entityManager_;
  }

  // Get system charset (Unicode)
  systemCharset(): CharsetInfo {
    return this.systemCharset_;
  }

  // Process option from command line
  processOption(opt: string, arg: string | null): void {
    switch (opt) {
      case 'G':
        this.debugMode_ = true;
        break;
      case '2':
        this.dsssl2_ = true;
        break;
      case 'd':
        if (arg) {
          this.dssslSpecId_ = makeStringC('');
          this.dssslSpecSysid_ = makeStringC(arg);
          this.dssslSpecOption_ = true;
          this.splitOffId(this.dssslSpecSysid_, this.dssslSpecId_);
        }
        break;
      case 'V':
        if (arg) {
          this.defineVars_.push(makeStringC(arg));
        }
        break;
      case 's':
        this.strictMode_ = true;
        break;
    }
  }

  // Split off fragment identifier from sysid
  private splitOffId(sysid: StringC, id: StringC): void {
    const sysidStr = stringCToString(sysid);
    const hashIdx = sysidStr.lastIndexOf('#');
    if (hashIdx >= 0) {
      const idStr = sysidStr.substring(hashIdx + 1);
      const sysidPart = sysidStr.substring(0, hashIdx);

      // Update sysid in place
      const newSysid = makeStringC(sysidPart);
      sysid.ptr_ = newSysid.ptr_;
      sysid.length_ = newSysid.length_;

      // Set id
      const newId = makeStringC(idStr);
      id.ptr_ = newId.ptr_;
      id.length_ = newId.length_;
    }
  }

  // Process a system identifier (document)
  processSysid(sysid: StringC): number {
    this.rootSystemId_ = sysid;

    // Derive default output basename and dsssl spec sysid from document sysid
    const sysidStr = stringCToString(sysid);

    // Replace up to 5 character extension with .dsl
    let baseName = sysidStr;
    const lastDot = sysidStr.lastIndexOf('.');
    if (lastDot >= 0 && sysidStr.length - lastDot <= 6) {
      baseName = sysidStr.substring(0, lastDot);
    }

    this.defaultOutputBasename_ = makeStringC(baseName);

    if (!this.dssslSpecOption_) {
      this.dssslSpecSysid_ = makeStringC(baseName + '.dsl');
    }

    // Parse the document and build grove
    return this.parseDocument(sysid);
  }

  // Parse document and build grove
  private parseDocument(sysid: StringC): number {
    if (!this.entityManager_) {
      console.error('No entity manager');
      return 1;
    }

    const params = new SgmlParser.Params();
    params.sysid = sysid;
    params.entityManager = new Ptr(this.entityManager_);
    params.options = this.options_;

    const parser = new SgmlParser(params);

    // Create grove builder to capture the document tree
    const rootNode = new NodePtr();
    const msgFmt = new SimpleMessageFormatter();
    const groveBuilder = GroveBuilder.make(0, this, msgFmt, false, rootNode);

    // Parse the document
    parser.parseAll(groveBuilder);

    // Store root node
    this.rootNode_ = rootNode;
    if (rootNode.node()) {
      this.groveTable_.set(stringCToString(sysid), rootNode);
    }

    return groveBuilder.errorCount() > 0 ? 1 : 0;
  }

  // Main processing - called after document is parsed
  processGrove(): void {
    if (!this.dssslSpecOption_ && this.dssslSpecSysid_.length_ === 0) {
      console.error('No DSSSL specification');
      return;
    }

    const exts: { value: FOTBuilderExtension[] | null } = { value: null };
    const fotb = this.makeFOTBuilder(exts);
    if (!fotb) {
      return;
    }

    const se = new StyleEngine(
      this,
      this,
      this.unitsPerInch_,
      this.debugMode_,
      this.dsssl2_,
      this.strictMode_,
      exts.value || undefined
    );

    // Define command-line variables
    for (const v of this.defineVars_) {
      se.defineVariable(v);
    }

    // Create SGML parser for the DSSSL specification
    const specParams = new SgmlParser.Params();
    specParams.sysid = this.dssslSpecSysid_;
    if (this.entityManager_) {
      specParams.entityManager = new Ptr(this.entityManager_);
      // Reset the base ID so spec parser can find files relative to CWD, not the document
      const em = this.entityManager_ as any;
      if (em.setCurrentBaseId) {
        em.setCurrentBaseId(makeStringC(''));
      }
    }

    const specParser = new SgmlParser(specParams);

    // Parse the DSSSL specification
    se.parseSpec(specParser, this.systemCharset(), this.dssslSpecId_, this);

    // Process the document grove
    if (this.rootNode_) {
      se.process(this.rootNode_, fotb);
    }

    // Flush output
    fotb.end();
    fotb.flush();
  }

  // Load an entity (for sgml-parse, etc.)
  load(
    sysid: StringC,
    _active: StringC[],
    _parent: NodePtr | null,
    rootNodeRef: { value: NodePtr | null },
    _architecture: StringC[]
  ): boolean {
    const sysidStr = stringCToString(sysid);

    // Check if already loaded
    const existing = this.groveTable_.get(sysidStr);
    if (existing) {
      rootNodeRef.value = existing;
      return true;
    }

    if (!this.entityManager_) return false;

    const params = new SgmlParser.Params();
    params.sysid = sysid;
    params.entityManager = new Ptr(this.entityManager_);
    params.options = this.options_;

    const parser = new SgmlParser(params);
    const rootNode = new NodePtr();
    const msgFmt = new SimpleMessageFormatter();
    const groveBuilder = GroveBuilder.make(
      this.groveTable_.size + 1,
      this,
      msgFmt,
      false,
      rootNode
    );

    parser.parseAll(groveBuilder);

    rootNodeRef.value = rootNode;
    if (rootNode.node()) {
      this.groveTable_.set(sysidStr, rootNode);
    }

    return true;
  }
}
