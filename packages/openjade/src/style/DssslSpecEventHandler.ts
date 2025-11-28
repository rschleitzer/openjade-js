// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import {
  StringC,
  Char,
  Location,
  Messenger,
  InputSource,
  InternalInputSource,
  InputSourceOrigin,
  CharsetInfo,
  SgmlParser,
  EventHandler,
  StartElementEvent,
  EndElementEvent,
  DataEvent,
  EndPrologEvent,
  MessageEvent,
  Entity,
  ConstPtr,
  String as StringOf
} from '@openjade-js/opensp';

// Helper to create StringC from string
function makeStringC(s: string): StringC {
  const arr: Char[] = [];
  for (let i = 0; i < s.length; i++) {
    arr.push(s.charCodeAt(i));
  }
  return new StringOf<Char>(arr, arr.length);
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

// Simple Text class to accumulate character data
class Text {
  private chars_: Char[] = [];
  private locations_: Location[] = [];

  clear(): void {
    this.chars_ = [];
    this.locations_ = [];
  }

  addChars(data: Char[] | Uint32Array, length: number, loc: Location): void {
    for (let i = 0; i < length; i++) {
      this.chars_.push(data[i]);
      this.locations_.push(loc);
    }
  }

  string(): StringC {
    return new StringOf<Char>(this.chars_, this.chars_.length);
  }

  charLocation(index: number): Location {
    if (index >= 0 && index < this.locations_.length) {
      return this.locations_[index];
    }
    return new Location();
  }

  size(): number {
    return this.chars_.length;
  }
}

// BodyElement - base class for style specification body elements
export abstract class BodyElement {
  abstract makeInputSource(eh: DssslSpecEventHandler): InputSource | null;
}

// ImmediateBodyElement - body element with inline text content
export class ImmediateBodyElement extends BodyElement {
  private text_: Text;

  constructor(text: Text) {
    super();
    this.text_ = text;
  }

  override makeInputSource(_eh: DssslSpecEventHandler): InputSource | null {
    const origin = InputSourceOrigin.make();
    return new InternalInputSource(this.text_.string(), origin);
  }
}

// EntityBodyElement - body element referencing an external entity
export class EntityBodyElement extends BodyElement {
  private entity_: ConstPtr<Entity>;

  constructor(entity: ConstPtr<Entity>) {
    super();
    this.entity_ = entity;
  }

  override makeInputSource(eh: DssslSpecEventHandler): InputSource | null {
    const entity = this.entity_.pointer();
    if (!entity) return null;

    const internal = entity.asInternalEntity();
    if (internal) {
      return new InternalInputSource(
        internal.string(),
        InputSourceOrigin.make()
      );
    }

    const external = entity.asExternalEntity();
    if (!external) return null;

    const sysid = external.externalId().effectiveSystemId();
    if (sysid.size() === 0) return null;

    const parser = eh.parser();
    if (!parser) return null;

    const charset = eh.charset();
    if (!charset) return null;

    return parser.entityManager().open(
      sysid,
      charset,
      InputSourceOrigin.make(),
      0,
      eh.messenger()
    );
  }
}

// DeclarationElement types
export enum DeclarationType {
  features,
  basesetEncoding,
  literalDescribedChar,
  addNameChars,
  addSeparatorChars,
  standardChars,
  otherChars,
  combineChar,
  mapSdataEntity,
  charRepertoire,
  sgmlGrovePlan
}

// DeclarationElement - declaration element in DSSSL spec
export class DeclarationElement {
  private type_: DeclarationType;
  private content_: Text;
  private name_: StringC;
  private text_: StringC;
  private modadd_: StringC;
  private desc_: StringC;

  constructor(type: DeclarationType) {
    this.type_ = type;
    this.content_ = new Text();
    this.name_ = makeStringC('');
    this.text_ = makeStringC('');
    this.modadd_ = makeStringC('');
    this.desc_ = makeStringC('');
  }

  type(): DeclarationType {
    return this.type_;
  }

  setContent(content: Text): void {
    this.content_ = content;
  }

  content(): Text {
    return this.content_;
  }

  setName(s: StringC): void {
    this.name_ = s;
  }

  name(): StringC {
    return this.name_;
  }

  setText(s: StringC): void {
    this.text_ = s;
  }

  text(): StringC {
    return this.text_;
  }

  setModadd(s: StringC): void {
    this.modadd_ = s;
  }

  modadd(): StringC {
    return this.modadd_;
  }

  setDesc(s: StringC): void {
    this.desc_ = s;
  }

  desc(): StringC {
    return this.desc_;
  }

  makeInputSource(_eh: DssslSpecEventHandler): InputSource | null {
    const origin = InputSourceOrigin.make();
    return new InternalInputSource(this.content_.string(), origin);
  }
}

// SpecPart - abstract base for specification parts
export abstract class SpecPart {
  abstract resolve(eh: DssslSpecEventHandler): Part | null;
}

// Part - a specification part containing body elements
export class Part extends SpecPart {
  private declarations_: DeclarationElement[] = [];
  private bodyElements_: BodyElement[] = [];
  private use_: PartHeader[] = [];
  private mark_: boolean = false;
  private doc_: Doc;

  constructor(doc: Doc) {
    super();
    this.doc_ = doc;
  }

  override resolve(_eh: DssslSpecEventHandler): Part | null {
    return this;
  }

  iter(): BodyElement[] {
    return this.bodyElements_;
  }

  diter(): DeclarationElement[] {
    return this.declarations_;
  }

  doc(): Doc {
    return this.doc_;
  }

  use(): PartHeader[] {
    return this.use_;
  }

  addUse(header: PartHeader): void {
    this.use_.push(header);
  }

  appendBody(element: BodyElement): void {
    this.bodyElements_.push(element);
  }

  appendDecl(element: DeclarationElement): void {
    this.declarations_.push(element);
  }

  setMark(b: boolean = true): boolean {
    const tem = this.mark_;
    this.mark_ = b;
    return tem;
  }
}

// PartHeader - header for a specification part
export class PartHeader {
  private doc_: Doc;
  private id_: StringC;
  private refLoc_: Location;
  private specPart_: SpecPart | null = null;

  constructor(doc: Doc, id: StringC) {
    this.doc_ = doc;
    this.id_ = id;
    this.refLoc_ = new Location();
  }

  id(): StringC {
    return this.id_;
  }

  setPart(part: SpecPart): void {
    this.specPart_ = part;
  }

  setRefLoc(loc: Location): void {
    if (!this.refLoc_.origin()) {
      this.refLoc_ = loc;
    }
  }

  resolve(eh: DssslSpecEventHandler): Part | null {
    this.doc_.load(eh);
    if (!this.specPart_) {
      eh.messenger().setNextLocation(this.refLoc_);
      console.error(`Missing part: ${stringCToString(this.id_)}`);
      return null;
    }
    return this.specPart_.resolve(eh);
  }
}

// ExternalPart - reference to a part in another document
export class ExternalPart extends SpecPart {
  private header_: PartHeader;

  constructor(header: PartHeader) {
    super();
    this.header_ = header;
  }

  override resolve(eh: DssslSpecEventHandler): Part | null {
    return this.header_.resolve(eh);
  }
}

// ExternalFirstPart - reference to first part of external document
export class ExternalFirstPart extends SpecPart {
  private doc_: Doc;

  constructor(doc: Doc) {
    super();
    this.doc_ = doc;
  }

  override resolve(eh: DssslSpecEventHandler): Part | null {
    return this.doc_.resolveFirstPart(eh);
  }
}

// Doc - a DSSSL specification document
export class Doc {
  private sysid_: StringC;
  private loaded_: boolean = false;
  private declarations_: DeclarationElement[] = [];
  private headers_: PartHeader[] = [];
  private loc_: Location;

  constructor(sysid?: StringC) {
    this.sysid_ = sysid || makeStringC('');
    this.loc_ = new Location();
  }

  sysid(): StringC {
    return this.sysid_;
  }

  setLocation(loc: Location): void {
    this.loc_ = loc;
  }

  refPart(id: StringC, refLoc?: Location): PartHeader {
    // Look for existing header
    for (const header of this.headers_) {
      if (stringCToString(header.id()) === stringCToString(id)) {
        if (refLoc) {
          header.setRefLoc(refLoc);
        }
        return header;
      }
    }
    // Create new header - insert at front like C++ IList::insert
    const header = new PartHeader(this, id);
    this.headers_.unshift(header);
    if (refLoc) {
      header.setRefLoc(refLoc);
    }
    return header;
  }

  resolveFirstPart(eh: DssslSpecEventHandler): Part | null {
    this.load(eh);
    let header: PartHeader | null = null;
    for (const h of this.headers_) {
      header = h;
    }
    if (!header) {
      if (this.loc_.origin()) {
        eh.messenger().setNextLocation(this.loc_);
        console.error('No parts in DSSSL specification');
      }
      return null;
    }
    return header.resolve(eh);
  }

  load(eh: DssslSpecEventHandler): void {
    if (this.loaded_) {
      return;
    }
    this.loaded_ = true;

    if (this.sysid_.length_ > 0) {
      const params = new SgmlParser.Params();
      params.parent = eh.parser();
      params.sysid = this.sysid_;
      const specParser = new SgmlParser(params);
      eh.loadDoc(specParser, this);
    } else {
      const parser = eh.parser();
      if (parser) {
        eh.loadDoc(parser, this);
      }
    }
  }

  appendDecl(decl: DeclarationElement): void {
    this.declarations_.push(decl);
  }

  diter(): DeclarationElement[] {
    return this.declarations_;
  }
}

// Element handler mapping table entry
interface MappingEntry {
  gi: string;
  start: (eh: DssslSpecEventHandler, event: StartElementEvent) => void;
  end: (eh: DssslSpecEventHandler, event: EndElementEvent) => void;
}

// DssslSpecEventHandler - event handler for parsing DSSSL specifications
export class DssslSpecEventHandler extends EventHandler {
  private mgr_: Messenger;
  private gotArc_: boolean = false;
  private gatheringBody_: boolean = false;
  private currentPart_: Part | null = null;
  private currentBody_: Text;
  private currentDoc_: Doc | null = null;
  private docs_: Doc[] = [];
  private parser_: SgmlParser | null = null;
  private charset_: CharsetInfo | null = null;
  private currentDecl_: DeclarationElement | null = null;

  // Element mapping table
  private static mappingTable: MappingEntry[] = [
    {
      gi: 'STYLE-SPECIFICATION',
      start: (eh, ev) => eh.styleSpecificationStart(ev),
      end: (eh, ev) => eh.styleSpecificationEnd(ev)
    },
    {
      gi: 'STYLE-SPECIFICATION-BODY',
      start: (eh, ev) => eh.styleSpecificationBodyStart(ev),
      end: (eh, ev) => eh.styleSpecificationBodyEnd(ev)
    },
    {
      gi: 'EXTERNAL-SPECIFICATION',
      start: (eh, ev) => eh.externalSpecificationStart(ev),
      end: (eh, ev) => eh.externalSpecificationEnd(ev)
    },
    {
      gi: 'FEATURES',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'BASESET-ENCODING',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'LITERAL-DESCRIBED-CHAR',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'ADD-NAME-CHARS',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'ADD-SEPARATOR-CHARS',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'STANDARD-CHARS',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'OTHER-CHARS',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'COMBINE-CHAR',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'MAP-SDATA-ENTITY',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'CHAR-REPERTOIRE',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    },
    {
      gi: 'SGML-GROVE-PLAN',
      start: (eh, ev) => eh.declarationStart(ev),
      end: (eh, ev) => eh.declarationEnd(ev)
    }
  ];

  constructor(mgr: Messenger) {
    super();
    this.mgr_ = mgr;
    this.currentBody_ = new Text();
  }

  messenger(): Messenger {
    return this.mgr_;
  }

  parser(): SgmlParser | null {
    return this.parser_;
  }

  charset(): CharsetInfo | null {
    return this.charset_;
  }

  // Main entry point - load and parse DSSSL specification
  load(
    specParser: SgmlParser,
    charset: CharsetInfo,
    id: StringC,
    parts: Part[]
  ): void {
    this.parser_ = specParser;
    this.charset_ = charset;

    const doc = this.findDoc(makeStringC(''));
    // Load it now so we can get the concrete syntax
    doc.load(this);

    let tem: Part | null;
    if (id.length_ === 0) {
      tem = doc.resolveFirstPart(this);
    } else {
      // Normalize ID using instance syntax
      const normId = id; // TODO: apply syntax substitution table
      tem = doc.refPart(normId).resolve(this);
    }

    this.resolveParts(tem, parts);
  }

  loadDoc(parser: SgmlParser, doc: Doc): void {
    this.currentDoc_ = doc;
    this.gotArc_ = false;
    // In upstream, this uses ArcEngine.parseAll
    // For now, we parse directly as the stylesheet might not use the arc
    parser.parseAll(this);
  }

  private findDoc(sysid: StringC): Doc {
    const sysidStr = stringCToString(sysid);
    for (const doc of this.docs_) {
      if (stringCToString(doc.sysid()) === sysidStr) {
        return doc;
      }
    }
    const doc = new Doc(sysid);
    this.docs_.push(doc);
    return doc;
  }

  private resolveParts(part: Part | null, parts: Part[]): void {
    if (!part) return;

    parts.push(part);
    if (part.setMark()) {
      // Loop detected
      console.error('Use loop in DSSSL specification');
      return;
    }

    const use = part.use();
    for (const header of use) {
      const tem = header.resolve(this);
      this.resolveParts(tem, parts);
    }

    part.setMark(false);
  }

  // EventHandler overrides
  override startElement(event: StartElementEvent): void {
    const gi = stringCToString(event.name());
    for (const entry of DssslSpecEventHandler.mappingTable) {
      // SGML is case-insensitive, so compare case-insensitively
      if (gi.toUpperCase() === entry.gi) {
        entry.start(this, event);
        break;
      }
    }
  }

  override endElement(event: EndElementEvent): void {
    const gi = stringCToString(event.name());
    for (const entry of DssslSpecEventHandler.mappingTable) {
      // SGML is case-insensitive, so compare case-insensitively
      if (gi.toUpperCase() === entry.gi) {
        entry.end(this, event);
        break;
      }
    }
  }

  override data(event: DataEvent): void {
    if (this.gatheringBody_) {
      this.currentBody_.addChars(event.data(), event.dataLength(), event.location());
    }
  }

  override message(event: MessageEvent): void {
    this.mgr_.dispatchMessage(event.message());
  }

  override endProlog(event: EndPrologEvent): void {
    if (this.currentDoc_) {
      this.currentDoc_.setLocation(event.location());
    }
  }

  // Attribute helpers
  private attributeString(event: StartElementEvent, attName: string): StringC | null {
    const atts = event.attributes();
    if (!atts) return null;

    const attNameStr = makeStringC(attName);
    const indexResult = { value: 0 };
    if (!atts.attributeIndex(attNameStr, indexResult)) return null;

    const val = atts.value(indexResult.value);
    if (!val) return null;

    const text = val.text();
    if (text) {
      return text.string();
    }
    return null;
  }

  private attributeEntity(event: StartElementEvent, attName: string): ConstPtr<Entity> | null {
    const atts = event.attributes();
    if (!atts) return null;

    const attNameStr = makeStringC(attName);
    const indexResult = { value: 0 };
    if (!atts.attributeIndex(attNameStr, indexResult)) return null;

    const sem = atts.semantics(indexResult.value);
    if (!sem || sem.nEntities() !== 1) return null;

    return sem.entity(0);
  }

  // Element handlers
  externalSpecificationStart(event: StartElementEvent): void {
    if (!this.currentDoc_) return;

    const empty = makeStringC('');
    const idP = this.attributeString(event, 'ID') || empty;
    const header = this.currentDoc_.refPart(idP);

    const entity = this.attributeEntity(event, 'DOCUMENT');
    if (!entity) return;

    const ent = entity.pointer();
    if (!ent) return;

    const ext = ent.asExternalEntity();
    if (!ext) return;

    const sysid = ext.externalId().effectiveSystemId();
    if (sysid.size() > 0) {
      const doc = this.findDoc(sysid);
      const specidP = this.attributeString(event, 'SPECID');
      if (!specidP) {
        header.setPart(new ExternalFirstPart(doc));
      } else {
        header.setPart(new ExternalPart(doc.refPart(specidP, event.location())));
      }
    }
  }

  externalSpecificationEnd(_event: EndElementEvent): void {
    // nothing to do
  }

  styleSpecificationStart(event: StartElementEvent): void {
    if (!this.currentDoc_) {
      return;
    }

    const empty = makeStringC('');
    const idP = this.attributeString(event, 'ID') || empty;
    const header = this.currentDoc_.refPart(idP);

    const useP = this.attributeString(event, 'USE');
    this.currentPart_ = new Part(this.currentDoc_);
    header.setPart(this.currentPart_);

    if (useP) {
      const use = stringCToString(useP);
      let i = 0;
      while (i < use.length) {
        let j = i;
        while (j < use.length && use[j] !== ' ') {
          j++;
        }
        if (j > i) {
          const partId = makeStringC(use.substring(i, j));
          this.currentPart_.addUse(this.currentDoc_.refPart(partId));
        }
        i = j + 1;
      }
    }
  }

  styleSpecificationEnd(_event: EndElementEvent): void {
    this.currentPart_ = null;
  }

  styleSpecificationBodyStart(event: StartElementEvent): void {
    if (this.currentPart_) {
      this.currentBody_ = new Text();
      const entity = this.attributeEntity(event, 'CONTENT');
      if (!entity) {
        this.gatheringBody_ = true;
      } else {
        this.currentPart_.appendBody(new EntityBodyElement(entity));
      }
    }
  }

  styleSpecificationBodyEnd(_event: EndElementEvent): void {
    if (this.gatheringBody_) {
      if (this.currentPart_) {
        this.currentPart_.appendBody(new ImmediateBodyElement(this.currentBody_));
      }
      this.gatheringBody_ = false;
    }
  }

  declarationStart(event: StartElementEvent): void {
    if (this.currentPart_ || this.currentDoc_) {
      this.currentBody_ = new Text();
      this.gatheringBody_ = true;

      const gi = stringCToString(event.name());
      let type: DeclarationType;

      switch (gi) {
        case 'FEATURES':
          type = DeclarationType.features;
          break;
        case 'BASESET-ENCODING':
          type = DeclarationType.basesetEncoding;
          break;
        case 'LITERAL-DESCRIBED-CHAR':
          type = DeclarationType.literalDescribedChar;
          break;
        case 'ADD-NAME-CHARS':
          type = DeclarationType.addNameChars;
          break;
        case 'ADD-SEPARATOR-CHARS':
          type = DeclarationType.addSeparatorChars;
          break;
        case 'STANDARD-CHARS':
          type = DeclarationType.standardChars;
          break;
        case 'OTHER-CHARS':
          type = DeclarationType.otherChars;
          break;
        case 'COMBINE-CHAR':
          type = DeclarationType.combineChar;
          break;
        case 'MAP-SDATA-ENTITY':
          type = DeclarationType.mapSdataEntity;
          break;
        case 'CHAR-REPERTOIRE':
          type = DeclarationType.charRepertoire;
          break;
        case 'SGML-GROVE-PLAN':
          type = DeclarationType.sgmlGrovePlan;
          break;
        default:
          type = DeclarationType.features;
      }

      this.currentDecl_ = new DeclarationElement(type);

      let str = this.attributeString(event, 'NAME');
      if (str) this.currentDecl_.setName(str);

      str = this.attributeString(event, 'TEXT');
      if (str) this.currentDecl_.setText(str);

      str = this.attributeString(event, 'MODADD');
      if (str) this.currentDecl_.setModadd(str);

      str = this.attributeString(event, 'DESC');
      if (str) this.currentDecl_.setDesc(str);
    }
  }

  declarationEnd(_event: EndElementEvent): void {
    if (this.gatheringBody_ && this.currentDecl_) {
      this.currentDecl_.setContent(this.currentBody_);
      if (this.currentPart_) {
        this.currentPart_.appendDecl(this.currentDecl_);
      } else if (this.currentDoc_) {
        this.currentDoc_.appendDecl(this.currentDecl_);
      }
      this.gatheringBody_ = false;
      this.currentDecl_ = null;
    }
  }
}
