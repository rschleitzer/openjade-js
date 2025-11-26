// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from '../types';
import { Boolean, PackedBoolean } from '../Boolean';
import { StringC } from '../StringC';
import { String as StringOf } from '../StringOf';
import { ConstPtr } from '../Ptr';
import { Location } from '../Location';
import { Syntax } from '../Syntax';
import { Sd } from '../Sd';
import { ErrorCountEventHandler } from '../ErrorCountEventHandler';
import { Messenger, Message } from '../Message';
import { OutputCharStream } from '../OutputCharStream';
import { StringSet } from './StringSet';
import { SgmlParser } from '../SgmlParser';
import {
  DataEvent,
  StartElementEvent,
  EndElementEvent,
  PiEvent,
  CommentDeclEvent,
  SdataEntityEvent,
  ExternalDataEntityEvent,
  SubdocEntityEvent,
  NonSgmlCharEvent,
  AppinfoEvent,
  UselinkEvent,
  SgmlDeclEvent,
  EndPrologEvent,
  MessageEvent,
  EntityDefaultedEvent
} from '../Event';
import {
  Entity,
  InternalEntity,
  ExternalDataEntity,
  SubdocEntity,
  ExternalEntity
} from '../Entity';
import { Notation } from '../Notation';
import { AttributeList, AttributeValue, AttributeSemantics } from '../Attribute';
import { ExternalId } from '../ExternalId';
import { Dtd } from '../Dtd';
import { Text, TextItem, TextIter } from '../Text';
import { Markup, MarkupIter } from '../Markup';

// ESIS output codes
const dataCode = '-';
const piCode = '?';
const conformingCode = 'C';
const appinfoCode = '#';
const startElementCode = '(';
const endElementCode = ')';
const referenceEntityCode = '&';
const attributeCode = 'A';
const dataAttributeCode = 'D';
const linkAttributeCode = 'a';
const defineNotationCode = 'N';
const defineExternalEntityCode = 'E';
const defineInternalEntityCode = 'I';
const defineSubdocEntityCode = 'S';
const defineExternalTextEntityCode = 'T';
const pubidCode = 'p';
const sysidCode = 's';
const startSubdocCode = '{';
const endSubdocCode = '}';
const fileCode = 'f';
const locationCode = 'L';
const includedElementCode = 'i';
const emptyElementCode = 'e';
const commentCode = '_';
const omissionCode = 'o';

const reChar = '\r'.charCodeAt(0);
const escapePrefixChar = '\\'.charCodeAt(0);
const escapePrefix = '\\';
const sdataDelim = '|';
const nonSgmlEscape = '%';
const newlineEscape = 'n';
const numEscape = '#';
const escapeEnd = ';';

// SgmlsSubdocState - state for subdocument processing
export class SgmlsSubdocState {
  parser_: SgmlParser | null;
  definedEntities_: StringSet;
  definedNotations_: StringSet;
  haveLinkProcess_: Boolean;

  constructor(parser?: SgmlParser | null) {
    this.parser_ = parser || null;
    this.definedEntities_ = new StringSet();
    this.definedNotations_ = new StringSet();
    this.haveLinkProcess_ = false;
  }

  init(parser: SgmlParser | null): void {
    this.parser_ = parser;
    this.definedNotations_.clear();
    this.definedEntities_.clear();
    this.haveLinkProcess_ = false;
  }

  swap(to: SgmlsSubdocState): void {
    const tempParser = to.parser_;
    to.parser_ = this.parser_;
    this.parser_ = tempParser;

    const tempHaveLinkProcess = to.haveLinkProcess_;
    to.haveLinkProcess_ = this.haveLinkProcess_;
    this.haveLinkProcess_ = tempHaveLinkProcess;

    this.definedNotations_.swap(to.definedNotations_);
    this.definedEntities_.swap(to.definedEntities_);
  }
}

// SgmlsEventHandler - produces ESIS output
// Port of SgmlsEventHandler from nsgmls/SgmlsEventHandler.cxx
export class SgmlsEventHandler extends ErrorCountEventHandler {
  // Output flag constants
  static readonly outputAll = 0o7777;
  static readonly outputLine = 0o1;
  static readonly outputEntity = 0o2;
  static readonly outputId = 0o4;
  static readonly outputIncluded = 0o10;
  static readonly outputNotationSysid = 0o20;
  static readonly outputNonSgml = 0o40;
  static readonly outputEmpty = 0o100;
  static readonly outputDataAtt = 0o200;
  static readonly outputComment = 0o400;
  static readonly outputTagOmission = 0o1000;
  static readonly outputAttributeOmission = 0o2000;
  static readonly outputParserInformation = 0o4000;
  static readonly outputPostfix = 0o10000;

  private subdocState_: SgmlsSubdocState;
  private messenger_: Messenger;
  private currentLocation_: Location;
  private os_: OutputCharStream;
  private inDocument_: PackedBoolean;
  private haveData_: PackedBoolean;
  private sd_: ConstPtr<Sd>;
  private syntax_: ConstPtr<Syntax>;
  private lastLineno_: number;
  private outputLine_: PackedBoolean;
  private outputIncluded_: PackedBoolean;
  private outputEntity_: PackedBoolean;
  private outputId_: PackedBoolean;
  private outputNotationSysid_: PackedBoolean;
  private outputNonSgml_: PackedBoolean;
  private outputEmpty_: PackedBoolean;
  private outputDataAtt_: PackedBoolean;
  private outputComment_: PackedBoolean;
  private outputTagOmission_: PackedBoolean;
  private outputAttributeOmission_: PackedBoolean;
  private outputParserInformation_: PackedBoolean;

  constructor(
    parser: SgmlParser | null,
    os: OutputCharStream,
    messenger: Messenger,
    outputFlags: number
  ) {
    super();
    this.subdocState_ = new SgmlsSubdocState(parser);
    this.os_ = os;
    this.messenger_ = messenger;
    this.currentLocation_ = new Location();
    this.inDocument_ = false;
    this.haveData_ = false;
    this.sd_ = new ConstPtr<Sd>();
    this.syntax_ = new ConstPtr<Syntax>();
    this.lastLineno_ = 0;

    this.outputLine_ = (outputFlags & SgmlsEventHandler.outputLine) !== 0;
    this.outputEntity_ = (outputFlags & SgmlsEventHandler.outputEntity) !== 0;
    this.outputId_ = (outputFlags & SgmlsEventHandler.outputId) !== 0;
    this.outputNotationSysid_ = (outputFlags & SgmlsEventHandler.outputNotationSysid) !== 0;
    this.outputIncluded_ = (outputFlags & SgmlsEventHandler.outputIncluded) !== 0;
    this.outputNonSgml_ = (outputFlags & SgmlsEventHandler.outputNonSgml) !== 0;
    this.outputEmpty_ = (outputFlags & SgmlsEventHandler.outputEmpty) !== 0;
    this.outputDataAtt_ = (outputFlags & SgmlsEventHandler.outputDataAtt) !== 0;
    this.outputComment_ = (outputFlags & SgmlsEventHandler.outputComment) !== 0;
    this.outputTagOmission_ = (outputFlags & SgmlsEventHandler.outputTagOmission) !== 0;
    this.outputAttributeOmission_ = (outputFlags & SgmlsEventHandler.outputAttributeOmission) !== 0;
    this.outputParserInformation_ = (outputFlags & SgmlsEventHandler.outputParserInformation) !== 0;

    os.setEscaper(SgmlsEventHandler.escaper);
  }

  private os(): OutputCharStream {
    return this.os_;
  }

  private startData(): void {
    if (!this.haveData_) {
      this.os().put(dataCode.charCodeAt(0));
      this.haveData_ = true;
    }
  }

  private flushData(): void {
    if (this.haveData_) {
      this.os().put('\n'.charCodeAt(0));
      this.haveData_ = false;
    }
  }

  private outputLocation(loc: Location): void {
    if (this.outputLine_) {
      this.outputLocation1(loc);
    }
  }

  data(event: DataEvent): void {
    this.outputLocation(event.location());
    this.startData();
    const data = event.data();
    if (data) {
      this.outputChars(data, event.dataLength());
    }
  }

  startElement(event: StartElementEvent): void {
    this.flushData();
    this.currentLocation_ = event.location();
    this.attributes(event.attributes(), attributeCode, null);
    this.currentLocation_.clear();
    if (this.outputTagOmission_ && !event.markupPtr()) {
      this.putString(omissionCode + '\n');
    }
    if (this.outputIncluded_ && event.included()) {
      this.putString(includedElementCode + '\n');
    }
    if (this.outputEmpty_ && event.mustOmitEnd()) {
      this.putString(emptyElementCode + '\n');
    }
    this.outputLocation(event.location());
    this.putString(startElementCode);
    this.outputStringC(event.name());
    this.putString('\n');
  }

  endElement(event: EndElementEvent): void {
    this.flushData();
    this.outputLocation(event.location());
    if (this.outputTagOmission_ && !event.markupPtr()) {
      this.putString(omissionCode + '\n');
    }
    this.putString(endElementCode);
    this.outputStringC(event.name());
    this.putString('\n');
  }

  pi(event: PiEvent): void {
    this.outputLocation(event.location());
    this.flushData();
    this.putString(piCode);
    const data = event.data();
    if (data) {
      this.outputChars(data, event.dataLength());
    }
    this.putString('\n');
  }

  commentDecl(event: CommentDeclEvent): void {
    if (this.inDocument_) {
      this.outputLocation(event.location());
      this.flushData();
      const markup = event.markup();
      if (markup) {
        const iter = new MarkupIter(markup);
        while (iter.valid()) {
          if (iter.type() === Markup.Type.comment) {
            this.putString(commentCode);
            const chars = iter.charsPointer();
            const len = iter.charsLength();
            for (let i = 0; i < len; i++) {
              this.outputChar(chars[i]);
            }
            this.putString('\n');
          }
          iter.advance();
        }
      }
    }
  }

  sdataEntity(event: SdataEntityEvent): void {
    this.outputLocation(event.location());
    this.startData();
    this.putString(escapePrefix + sdataDelim);
    const data = event.data();
    if (data) {
      this.outputChars(data, event.dataLength());
    }
    this.putString(escapePrefix + sdataDelim);
  }

  externalDataEntity(event: ExternalDataEntityEvent): void {
    this.currentLocation_ = event.location();
    this.outputLocation(event.location());
    this.flushData();
    const entity = event.entity();
    if (entity && !this.outputEntity_ && !this.markEntity(entity)) {
      this.defineExternalDataEntity(entity as ExternalDataEntity);
    }
    this.currentLocation_.clear();
    if (entity) {
      this.putString(referenceEntityCode);
      this.outputStringC(entity.name());
      this.putString('\n');
    }
  }

  subdocEntity(event: SubdocEntityEvent): void {
    this.currentLocation_ = event.location();
    this.outputLocation(event.location());
    this.flushData();
    const entity = event.entity();
    if (entity && !this.outputEntity_ && !this.markEntity(entity)) {
      this.defineSubdocEntity(entity);
    }
    this.currentLocation_.clear();
    if (entity) {
      this.putString(startSubdocCode);
      this.outputStringC(entity.name());
      this.putString('\n');

      // Parse subdocument
      const params = new SgmlParser.Params();
      params.subdocInheritActiveLinkTypes = true;
      params.subdocReferenced = true;
      params.parent = this.subdocState_.parser_;
      params.sysid = entity.externalId().effectiveSystemId();

      const parser = new SgmlParser(params);
      const oldState = new SgmlsSubdocState();
      this.subdocState_.swap(oldState);
      this.subdocState_.init(parser);
      parser.parseAll(this);
      oldState.swap(this.subdocState_);

      this.putString(endSubdocCode);
      this.outputStringC(entity.name());
      this.putString('\n');
    }
  }

  nonSgmlChar(event: NonSgmlCharEvent): void {
    if (this.outputNonSgml_) {
      this.outputLocation(event.location());
      this.startData();
      this.putString(escapePrefix + nonSgmlEscape + event.character() + escapeEnd);
    }
  }

  appinfo(event: AppinfoEvent): void {
    const strRef: { value: StringC | null } = { value: null };
    if (event.literal(strRef)) {
      this.outputLocation(event.location());
      this.flushData();
      this.putString(appinfoCode);
      this.outputStringC(strRef.value!);
      this.putString('\n');
    }
  }

  uselink(event: UselinkEvent): void {
    // Link processing not fully implemented
  }

  sgmlDecl(event: SgmlDeclEvent): void {
    this.sd_ = event.sdPointer();
    this.syntax_ = event.instanceSyntaxPointer();
  }

  endProlog(event: EndPrologEvent): void {
    const dtd = event.dtd();
    if (this.outputEntity_) {
      this.flushData();
      if (dtd) {
        const iter = dtd.generalEntityIterConst();
        let entityPtr = iter.next();
        while (entityPtr && !entityPtr.isNull()) {
          this.defineEntity(entityPtr.pointer()!);
          entityPtr = iter.next();
        }
      }
    }
    if (this.outputComment_) {
      this.inDocument_ = true;
    }
  }

  message(event: MessageEvent): void {
    this.messenger_.dispatchMessage(event.message());
    super.message(event);
  }

  entityDefaulted(event: EntityDefaultedEvent): void {
    if (this.outputEntity_) {
      this.flushData();
      const entity = event.entityPointer().pointer();
      if (entity) {
        this.defineEntity(entity);
      }
    }
  }

  end(): void {
    this.flushData();
    if (this.errorCount() === 0) {
      this.putString(conformingCode + '\n');
    }
  }

  private attributes(
    attributes: AttributeList,
    code: string,
    ownerName: StringC | null
  ): void {
    const nAttributes = attributes.size();
    for (let i = 0; i < nAttributes; i++) {
      const value = attributes.value(i);
      if (value) {
        if (this.outputAttributeOmission_) {
          if (!attributes.specified(i)) {
            this.putString(omissionCode + '\n');
          }
        }
        const textResult = { value: null as Text | null };
        const strResult = { value: null as StringC | null };
        const infoType = value.info(textResult, strResult);

        switch (infoType) {
          case AttributeValue.Type.implied:
            this.startAttribute(attributes.name(i), code, ownerName);
            this.putString('IMPLIED\n');
            break;
          case AttributeValue.Type.tokenized:
            {
              let typeString = 'TOKEN';
              const semantics = attributes.semantics(i);
              if (semantics) {
                const notation = semantics.notation();
                if (notation && !notation.isNull()) {
                  this.defineNotation(notation.pointer()!);
                  typeString = 'NOTATION';
                } else {
                  const nEntities = semantics.nEntities();
                  if (nEntities > 0) {
                    typeString = 'ENTITY';
                    if (!this.outputEntity_) {
                      for (let j = 0; j < nEntities; j++) {
                        const entity = semantics.entity(j).pointer();
                        if (entity && !this.markEntity(entity)) {
                          this.defineEntity(entity);
                        }
                      }
                    }
                  }
                }
              }
              if (this.outputId_ && attributes.id(i)) {
                typeString = 'ID';
              }
              this.startAttribute(attributes.name(i), code, ownerName);
              this.putString(typeString + ' ');
              if (strResult.value) {
                this.outputStringC(strResult.value);
              }
              this.putString('\n');
            }
            break;
          case AttributeValue.Type.cdata:
            {
              this.startAttribute(attributes.name(i), code, ownerName);
              this.putString('CDATA ');
              if (textResult.value) {
                const iter = new TextIter(textResult.value);
                const result = { type: TextItem.Type.data, p: null as Char[] | null, n: 0, loc: null as Location | null };
                while (iter.next(result)) {
                  switch (result.type) {
                    case TextItem.Type.data:
                    case TextItem.Type.cdata:
                      if (result.p) {
                        for (let k = 0; k < result.n; k++) {
                          this.outputChar(result.p[k]);
                        }
                      }
                      break;
                    case TextItem.Type.sdata:
                      this.putString(escapePrefix + sdataDelim);
                      if (result.p) {
                        for (let k = 0; k < result.n; k++) {
                          this.outputChar(result.p[k]);
                        }
                      }
                      this.putString(escapePrefix + sdataDelim);
                      break;
                    case TextItem.Type.nonSgml:
                      if (this.outputNonSgml_ && result.p) {
                        this.putString(escapePrefix + nonSgmlEscape + result.p[0] + escapeEnd);
                      }
                      break;
                    default:
                      break;
                  }
                }
              }
              this.putString('\n');
            }
            break;
        }
      }
    }
  }

  private startAttribute(name: StringC, code: string, ownerName: StringC | null): void {
    this.putString(code);
    if (ownerName) {
      this.outputStringC(ownerName);
      this.putString(' ');
    }
    this.outputStringC(name);
    this.putString(' ');
  }

  private defineEntity(entity: Entity): void {
    const internalEntity = entity.asInternalEntity();
    if (internalEntity) {
      this.defineInternalEntity(internalEntity);
    } else {
      switch (entity.dataType()) {
        case Entity.DataType.cdata:
        case Entity.DataType.sdata:
        case Entity.DataType.ndata:
          this.defineExternalDataEntity(entity.asExternalDataEntity()!);
          break;
        case Entity.DataType.subdoc:
          this.defineSubdocEntity(entity.asSubdocEntity()!);
          break;
        case Entity.DataType.sgmlText:
          this.defineExternalTextEntity(entity.asExternalEntity()!);
          break;
        default:
          break;
      }
    }
  }

  private defineExternalDataEntity(entity: ExternalDataEntity): void {
    const notation = entity.notation();
    if (notation) {
      this.defineNotation(notation);
    }
    this.externalId(entity.externalId());
    let typeString: string;
    switch (entity.dataType()) {
      case Entity.DataType.cdata:
        typeString = 'CDATA';
        break;
      case Entity.DataType.sdata:
        typeString = 'SDATA';
        break;
      case Entity.DataType.ndata:
        typeString = 'NDATA';
        break;
      default:
        typeString = 'NDATA';
        break;
    }
    this.putString(defineExternalEntityCode);
    this.outputStringC(entity.name());
    this.putString(' ' + typeString + ' ');
    if (notation) {
      this.outputStringC(notation.name());
    }
    this.putString('\n');
    this.attributes(entity.attributes(), dataAttributeCode, entity.name());
  }

  private defineSubdocEntity(entity: SubdocEntity): void {
    this.externalId(entity.externalId());
    this.putString(defineSubdocEntityCode);
    this.outputStringC(entity.name());
    this.putString('\n');
  }

  private defineExternalTextEntity(entity: ExternalEntity): void {
    this.externalId(entity.externalId());
    this.putString(defineExternalTextEntityCode);
    this.outputStringC(entity.name());
    this.putString('\n');
  }

  private defineInternalEntity(entity: InternalEntity): void {
    this.putString(defineInternalEntityCode);
    this.outputStringC(entity.name());
    this.putString(' ');
    let s: string;
    switch (entity.dataType()) {
      case Entity.DataType.sdata:
        s = 'SDATA';
        break;
      case Entity.DataType.cdata:
        s = 'CDATA';
        break;
      case Entity.DataType.sgmlText:
        s = 'TEXT';
        break;
      case Entity.DataType.pi:
        s = 'PI';
        break;
      default:
        s = 'TEXT';
        break;
    }
    this.putString(s + ' ');
    this.outputStringC(entity.string());
    this.putString('\n');
  }

  private defineNotation(notation: Notation): void {
    if (this.markNotation(notation)) {
      return;
    }
    this.externalId(notation.externalId(), this.outputNotationSysid_);
    this.putString(defineNotationCode);
    this.outputStringC(notation.name());
    this.putString('\n');
  }

  private externalId(id: ExternalId, outputFile: Boolean = true): void {
    const pubStr = id.publicIdString();
    if (pubStr && pubStr.size() > 0) {
      this.putString(pubidCode);
      this.outputStringC(pubStr);
      this.putString('\n');
    }
    const sysStr = id.systemIdString();
    if (sysStr && sysStr.size() > 0) {
      this.putString(sysidCode);
      this.outputStringC(sysStr);
      this.putString('\n');
    }
    if (outputFile && id.effectiveSystemId().size() > 0) {
      this.putString(fileCode);
      this.outputStringC(id.effectiveSystemId());
      this.putString('\n');
    }
  }

  private markEntity(entity: Entity): Boolean {
    return this.subdocState_.definedEntities_.add(entity.name());
  }

  private markNotation(notation: Notation): Boolean {
    return this.subdocState_.definedNotations_.add(notation.name());
  }

  private putString(s: string): void {
    for (let i = 0; i < s.length; i++) {
      this.os().put(s.charCodeAt(i));
    }
  }

  private outputChar(c: Char): void {
    switch (c) {
      case escapePrefixChar:
        this.putString(escapePrefix + escapePrefix);
        break;
      case reChar:
        this.putString(escapePrefix + newlineEscape);
        if (this.outputLine_ && this.haveData_) {
          this.lastLineno_++;
        }
        break;
      default:
        if (c < 0o40) {
          const digits = '0123456789';
          this.putString(escapePrefix + '0' + digits[Math.floor(c / 8) % 8] + digits[c % 8]);
        } else {
          this.os().put(c);
        }
        break;
    }
  }

  private outputChars(p: Uint32Array, n: number): void {
    for (let i = 0; i < n; i++) {
      this.outputChar(p[i]);
    }
  }

  private outputStringC(str: StringC): void {
    const data = str.data();
    if (data) {
      for (let i = 0; i < str.size(); i++) {
        this.outputChar(data[i]);
      }
    }
  }

  private static escaper(s: OutputCharStream, c: Char): void {
    const str = escapePrefix + numEscape + c + escapeEnd;
    for (let i = 0; i < str.length; i++) {
      s.put(str.charCodeAt(i));
    }
  }

  private outputLocation1(loc: Location): void {
    // Simplified location output - full implementation would track storage objects
    const origin = loc.origin().pointer();
    if (!origin) {
      return;
    }
    const inputSourceOrigin = origin.asInputSourceOrigin();
    if (!inputSourceOrigin) {
      return;
    }
    // For now, simplified - full implementation would track file and line numbers
  }
}
