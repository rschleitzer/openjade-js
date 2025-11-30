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
  MessageType,
  MessageBuilder,
  MessageFragment,
  OtherMessageArg,
  Location,
  InputSource,
  InputSourceOrigin,
  CharsetInfo,
  UnivCharsetDesc,
  EntityManager,
  Ptr,
  String as StringOf,
  createExtendEntityManager,
  ExtendEntityManager,
  SOCatalogManager,
  Vector,
  ExternalInfoImpl
} from '@openjade-js/opensp';
import * as fs from 'fs';
import * as path from 'path';
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

// String message builder for formatting message arguments
class StringMessageBuilder extends MessageBuilder {
  private result_: string = '';

  appendNumber(n: number): void {
    this.result_ += n.toString();
  }

  appendOrdinal(n: number): void {
    const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    this.result_ += n.toString() + suffix;
  }

  appendChars(chars: Char[] | null, size: number): void {
    if (chars) {
      for (let i = 0; i < size; i++) {
        this.result_ += String.fromCodePoint(chars[i]);
      }
    }
  }

  appendOther(_arg: OtherMessageArg | null): void {
    // Ignore other args
  }

  appendFragment(fragment: MessageFragment): void {
    if (fragment && (fragment as any).text) {
      this.result_ += (fragment as any).text();
    }
  }

  appendString(s: string): void {
    this.result_ += s;
  }

  getString(): string {
    return this.result_;
  }
}

// Format a message by substituting %1, %2, etc. with arguments
function formatMessage(msg: Message): string {
  const type = msg.type;
  if (!type) return '(no message type)';

  const template = type.text();
  if (!template) return `message:${type.number()}`;

  // Parse template and substitute %N with arguments
  let result = '';
  let i = 0;
  while (i < template.length) {
    if (template[i] === '%' && i + 1 < template.length) {
      const nextChar = template[i + 1];
      if (nextChar >= '1' && nextChar <= '9') {
        const argIndex = parseInt(nextChar) - 1;
        if (argIndex < msg.args.size()) {
          const arg = msg.args.get(argIndex);
          if (arg && arg.pointer()) {
            const builder = new StringMessageBuilder();
            arg.pointer().append(builder);
            result += builder.getString();
          }
        }
        i += 2;
        continue;
      }
    }
    result += template[i];
    i++;
  }
  return result;
}

// Get severity string for message type
function getSeverityString(severity: number): string {
  switch (severity) {
    case MessageType.Severity.info:
      return 'I';
    case MessageType.Severity.warning:
      return 'W';
    case MessageType.Severity.error:
      return 'E';
    case MessageType.Severity.quantityError:
      return 'Q';
    case MessageType.Severity.idrefError:
      return 'X';
    default:
      return '?';
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
    // Format message like upstream openjade: location:severity:message
    // Following MessageReporter::dispatchMessage from upstream
    let output = 'openjade:';

    // Get location info if available - traverse origin chain to find file/line info
    const loc = msg.loc;
    if (loc && loc.origin() && !loc.origin().isNull()) {
      let origin = loc.origin().pointer();
      let index = loc.index();
      let foundLocation = false;

      // Traverse origin chain to find external info with file:line:column
      while (origin && !foundLocation) {
        // Check for ExternalInfoImpl which has file:line:column tracking
        const externalInfo = origin.externalInfo?.();
        if (externalInfo && externalInfo instanceof ExternalInfoImpl) {
          const locInfo = externalInfo.convertOffset(index);
          // Make the path relative to the current working directory
          let displayPath = locInfo.filename;
          const cwd = process.cwd();
          if (displayPath.startsWith(cwd + '/') || displayPath.startsWith(cwd + path.sep)) {
            displayPath = displayPath.substring(cwd.length + 1);
          }
          output += displayPath + ':' + locInfo.lineNumber + ':' + locInfo.columnNumber + ': ';
          foundLocation = true;
          break;
        }

        // Try to get entity name from EntityOrigin
        const entityOrigin = origin.asEntityOrigin?.();
        if (entityOrigin) {
          const entityDecl = entityOrigin.entityDecl?.();
          if (entityDecl) {
            const name = entityDecl.name?.();
            if (name && name.length_ > 0) {
              output += stringCToString(name);
              output += ':' + index;
              output += ': ';
              foundLocation = true;
              break;
            }
          }
        }

        // Try parent location
        const parentLoc = origin.parent?.();
        if (parentLoc && parentLoc.origin() && !parentLoc.origin().isNull()) {
          // If this is an entity origin, add ref length to index
          if (entityOrigin) {
            index = parentLoc.index() + (origin.refLength?.() || 0);
          } else {
            index += parentLoc.index();
          }
          origin = parentLoc.origin().pointer();
        } else {
          break;
        }
      }

      // If we didn't find location info, still output the index
      if (!foundLocation && index > 0) {
        output += '<unknown>:' + index + ': ';
      }
    }

    // Add severity prefix
    if (msg.type) {
      const severity = msg.type.severity();
      output += getSeverityString(severity) + ': ';
    }

    // Format and append the message text with argument substitution
    output += formatMessage(msg);

    console.error(output);
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
    // Create a document-specific entity manager with the document's catalog
    // This allows the document to use its own SGML declaration (e.g., XML-style with NAMECASE GENERAL NO)
    // while keeping the DSSSL spec parsing using the standard DSSSL catalog
    const docEntityManager = this.createDocumentEntityManager(sysid);

    const params = new SgmlParser.Params();
    params.sysid = sysid;
    params.entityManager = new Ptr(docEntityManager);
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

  // Create an entity manager for document parsing with the document's catalog
  private createDocumentEntityManager(sysid: StringC): EntityManager {
    const sysidStr = stringCToString(sysid);
    const docDir = path.dirname(path.resolve(sysidStr));

    // File reader function
    const fileReader = (filePath: string): Uint8Array | null => {
      try {
        const data = fs.readFileSync(filePath);
        // Skip UTF-8 BOM if present (EF BB BF)
        if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
          return data.subarray(3);
        }
        return data;
      } catch {
        return null;
      }
    };

    const entityManager = createExtendEntityManager(this.systemCharset_, fileReader);

    // Set up catalog manager with document's catalog
    const catalogSysids = new Vector<StringC>();

    // Look for catalog file in document's directory
    const docCatalog = path.join(docDir, 'catalog');
    if (fs.existsSync(docCatalog)) {
      catalogSysids.push_back(makeStringC(docCatalog));
    }

    // Create catalog manager if we have any catalogs
    if (catalogSysids.size() > 0) {
      const catalogManager = SOCatalogManager.make(
        catalogSysids,
        0,  // Number of explicitly specified catalogs that must exist
        this.systemCharset_,
        this.systemCharset_,
        true  // useDocCatalog
      );
      (entityManager as ExtendEntityManager).setCatalogManager(catalogManager);
    }

    return entityManager;
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

    // Set entityType to document so that a new Sd is created with our options applied.
    // Disable validation and enable omittag for DSSSL spec parsing.
    // The upstream uses ArcEngine which handles architectural forms differently.
    // Without ArcEngine, we get false positive validation errors.
    // TODO: Implement proper ArcEngine support
    specParams.entityType = SgmlParser.Params.EntityType.document;
    const specOptions = new ParserOptions();
    specOptions.typeValid = 0; // Disable validation
    specOptions.omittag = true; // Allow tag omission (DSSSL DTD uses "- o" for external-specification)
    specParams.options = specOptions;

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
