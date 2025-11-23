// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, Number, UnivChar } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { Resource } from './Resource';
import { CharsetInfo } from './CharsetInfo';
import { ExternalId } from './ExternalId';
import { ISet } from './ISet';
import { Syntax } from './Syntax';
import { CharsetDecl } from './CharsetDecl';
import { HashTable } from './HashTable';
import { EntityManager } from './EntityManager';
import { Ptr } from './Ptr';
import { StringC } from './StringC';
import { SubstTable } from './SubstTable';
import { SIZEOF } from './macros';

export class Sd extends Resource {
  // Boolean features - must be in same order as in SGML declaration
  static readonly BooleanFeature = {
    fDATATAG: 0,
    fOMITTAG: 1,
    fRANK: 2,
    fSTARTTAGEMPTY: 3,
    fSTARTTAGUNCLOSED: 4,
    fENDTAGEMPTY: 5,
    fENDTAGUNCLOSED: 6,
    fATTRIBDEFAULT: 7,
    fATTRIBOMITNAME: 8,
    fATTRIBVALUE: 9,
    fEMPTYNRM: 10,
    fIMPLYDEFATTLIST: 11,
    fIMPLYDEFDOCTYPE: 12,
    fIMPLYDEFENTITY: 13,
    fIMPLYDEFNOTATION: 14,
    fIMPLICIT: 15,
    fFORMAL: 16,
    fURN: 17,
    fKEEPRSRE: 18
  } as const;

  static readonly nBooleanFeature = 19;
  static readonly fSHORTTAG_FIRST = Sd.BooleanFeature.fSTARTTAGEMPTY;
  static readonly fSHORTTAG_LAST = Sd.BooleanFeature.fATTRIBVALUE;

  // Number features
  static readonly NumberFeature = {
    fSIMPLE: 0,
    fEXPLICIT: 1,
    fCONCUR: 2,
    fSUBDOC: 3
  } as const;

  static readonly nNumberFeature = 4;

  static readonly NetEnable = {
    netEnableNo: 0,
    netEnableImmednet: 1,
    netEnableAll: 2
  } as const;

  static readonly EntityRef = {
    entityRefAny: 0,
    entityRefInternal: 1,
    entityRefNone: 2
  } as const;

  static readonly ImplydefElement = {
    implydefElementNo: 0,
    implydefElementYes: 1,
    implydefElementAnyother: 2
  } as const;

  // Reserved names used in SGML declaration
  static readonly ReservedName = {
    rALL: 0,
    rANY: 1,
    rANYOTHER: 2,
    rAPPINFO: 3,
    rATTLIST: 4,
    rATTRIB: 5,
    rBASESET: 6,
    rCAPACITY: 7,
    rCHARSET: 8,
    rCONCUR: 9,
    rCONTROLS: 10,
    rDATATAG: 11,
    rDEFAULT: 12,
    rDELIM: 13,
    rDESCSET: 14,
    rDOCTYPE: 15,
    rDOCUMENT: 16,
    rELEMENT: 17,
    rEMPTY: 18,
    rEMPTYNRM: 19,
    rENDTAG: 20,
    rENTITIES: 21,
    rENTITY: 22,
    rEXPLICIT: 23,
    rFEATURES: 24,
    rFORMAL: 25,
    rFUNCHAR: 26,
    rFUNCTION: 27,
    rGENERAL: 28,
    rIMMEDNET: 29,
    rIMPLICIT: 30,
    rIMPLYDEF: 31,
    rINSTANCE: 32,
    rINTEGRAL: 33,
    rINTERNAL: 34,
    rKEEPRSRE: 35,
    rLCNMCHAR: 36,
    rLCNMSTRT: 37,
    rLINK: 38,
    rMINIMIZE: 39,
    rMSICHAR: 40,
    rMSOCHAR: 41,
    rMSSCHAR: 42,
    rNAMECASE: 43,
    rNAMECHAR: 44,
    rNAMES: 45,
    rNAMESTRT: 46,
    rNAMING: 47,
    rNETENABL: 48,
    rNO: 49,
    rNOASSERT: 50,
    rNONE: 51,
    rNOTATION: 52,
    rOMITNAME: 53,
    rOMITTAG: 54,
    rOTHER: 55,
    rPUBLIC: 56,
    rQUANTITY: 57,
    rRANK: 58,
    rRE: 59,
    rREF: 60,
    rRS: 61,
    rSCOPE: 62,
    rSEEALSO: 63,
    rSEPCHAR: 64,
    rSGML: 65,
    rSGMLREF: 66,
    rSHORTREF: 67,
    rSHORTTAG: 68,
    rSHUNCHAR: 69,
    rSIMPLE: 70,
    rSPACE: 71,
    rSTARTTAG: 72,
    rSUBDOC: 73,
    rSWITCHES: 74,
    rSYNTAX: 75,
    rSYSTEM: 76,
    rTYPE: 77,
    rUCNMCHAR: 78,
    rUCNMSTRT: 79,
    rUNCLOSED: 80,
    rUNUSED: 81,
    rURN: 82,
    rVALIDITY: 83,
    rVALUE: 84,
    rYES: 85
  } as const;

  // Capacities
  static readonly Capacity = {
    TOTALCAP: 0,
    ENTCAP: 1,
    ENTCHCAP: 2,
    ELEMCAP: 3,
    GRPCAP: 4,
    EXGRPCAP: 5,
    EXNMCAP: 6,
    ATTCAP: 7,
    ATTCHCAP: 8,
    AVGRPCAP: 9,
    NOTCAP: 10,
    NOTCHCAP: 11,
    IDCAP: 12,
    IDREFCAP: 13,
    MAPCAP: 14,
    LKSETCAP: 15,
    LKNMCAP: 16
  } as const;

  static readonly nCapacity = 17;

  private static readonly reservedName_: string[] = [
    "ALL", "ANY", "ANYOTHER", "APPINFO", "ATTLIST", "ATTRIB", "BASESET",
    "CAPACITY", "CHARSET", "CONCUR", "CONTROLS", "DATATAG", "DEFAULT",
    "DELIM", "DESCSET", "DOCTYPE", "DOCUMENT", "ELEMENT", "EMPTY",
    "EMPTYNRM", "ENDTAG", "ENTITIES", "ENTITY", "EXPLICIT", "FEATURES",
    "FORMAL", "FUNCHAR", "FUNCTION", "GENERAL", "IMMEDNET", "IMPLICIT",
    "IMPLYDEF", "INSTANCE", "INTEGRAL", "INTERNAL", "KEEPRSRE", "LCNMCHAR",
    "LCNMSTRT", "LINK", "MINIMIZE", "MSICHAR", "MSOCHAR", "MSSCHAR",
    "NAMECASE", "NAMECHAR", "NAMES", "NAMESTRT", "NAMING", "NETENABL",
    "NO", "NOASSERT", "NONE", "NOTATION", "OMITNAME", "OMITTAG", "OTHER",
    "PUBLIC", "QUANTITY", "RANK", "RE", "REF", "RS", "SCOPE", "SEEALSO",
    "SEPCHAR", "SGML", "SGMLREF", "SHORTREF", "SHORTTAG", "SHUNCHAR",
    "SIMPLE", "SPACE", "STARTTAG", "SUBDOC", "SWITCHES", "SYNTAX", "SYSTEM",
    "TYPE", "UCNMCHAR", "UCNMSTRT", "UNCLOSED", "UNUSED", "URN", "VALIDITY",
    "VALUE", "YES"
  ];

  private static readonly capacityName_: string[] = [
    "TOTALCAP", "ENTCAP", "ENTCHCAP", "ELEMCAP", "GRPCAP", "EXGRPCAP",
    "EXNMCAP", "ATTCAP", "ATTCHCAP", "AVGRPCAP", "NOTCAP", "NOTCHCAP",
    "IDCAP", "IDREFCAP", "MAPCAP", "LKSETCAP", "LKNMCAP"
  ];

  private static readonly quantityName_: string[] = [
    "ATTCNT", "ATTSPLEN", "BSEQLEN", "DTAGLEN", "DTEMPLEN", "ENTLVL",
    "GRPCNT", "GRPGTCNT", "GRPLVL", "LITLEN", "NAMELEN", "NORMSEP",
    "PILEN", "TAGLEN", "TAGLVL"
  ];

  private static readonly generalDelimiterName_: string[] = [
    "AND", "COM", "CRO", "DSC", "DSO", "DTGC", "DTGO", "ERO", "ETAGO",
    "GRPC", "GRPO", "HCRO", "LIT", "LITA", "MDC", "MDO", "MINUS", "MSC",
    "NET", "NESTC", "OPT", "OR", "PERO", "PIC", "PIO", "PLUS", "REFC",
    "REP", "RNI", "SEQ", "STAGO", "TAGC", "VI"
  ];

  private booleanFeature_: PackedBoolean[];
  private numberFeature_: Number[];
  private capacity_: Number[];
  private internalCharsetIsDocCharset_: PackedBoolean;
  private internalCharsetPtr_: CharsetInfo | null;
  private docCharset_: CharsetInfo;
  private docCharsetDecl_: CharsetDecl;
  private scopeInstance_: Boolean;
  private www_: Boolean;
  private netEnable_: number;
  private entityRef_: number;
  private implydefElement_: number;
  private typeValid_: Boolean;
  private integrallyStored_: Boolean;
  private namedCharTable_: HashTable<StringC, number>;
  private entityManager_: Ptr<EntityManager>;

  constructor(entityManager: Ptr<EntityManager>) {
    super();
    this.entityManager_ = entityManager;
    const mgr = entityManager.pointer()!;
    this.internalCharsetIsDocCharset_ = mgr.internalCharsetIsDocCharset();
    // Initialize with a new CharsetInfo (will be set later with setDocCharsetDesc)
    this.docCharset_ = mgr.charset() as any as CharsetInfo;
    this.scopeInstance_ = false;
    this.www_ = false;
    this.netEnable_ = Sd.NetEnable.netEnableNo;
    this.entityRef_ = Sd.EntityRef.entityRefAny;
    this.typeValid_ = true;
    this.integrallyStored_ = false;
    this.implydefElement_ = Sd.ImplydefElement.implydefElementNo;
    this.docCharsetDecl_ = new CharsetDecl();
    this.namedCharTable_ = new HashTable<StringC, number>();

    this.booleanFeature_ = [];
    for (let i = 0; i < Sd.nBooleanFeature; i++) {
      this.booleanFeature_.push(false);
    }

    this.numberFeature_ = [];
    for (let i = 0; i < Sd.nNumberFeature; i++) {
      this.numberFeature_.push(0);
    }

    this.capacity_ = [];
    for (let i = 0; i < Sd.nCapacity; i++) {
      this.capacity_.push(35000);
    }

    if (this.internalCharsetIsDocCharset_) {
      this.internalCharsetPtr_ = null;
    } else {
      // Store reference to the same CharsetInfo object
      this.internalCharsetPtr_ = this.docCharset_;
    }
  }

  setDocCharsetDesc(desc: any): void {
    this.docCharset_.set(desc);
  }

  matchesReservedName(str: StringC, name: number): Boolean {
    return this.reservedName(name).equals(str);
  }

  digitWeight(c: Char): number {
    return this.internalCharset().digitWeight(c);
  }

  hexDigitWeight(c: Char): number {
    return this.internalCharset().hexDigitWeight(c);
  }

  link(): Boolean {
    return (this.numberFeature_[Sd.NumberFeature.fSIMPLE] !== 0 ||
            this.booleanFeature_[Sd.BooleanFeature.fIMPLICIT] ||
            this.numberFeature_[Sd.NumberFeature.fEXPLICIT] !== 0);
  }

  simpleLink(): Number {
    return this.numberFeature_[Sd.NumberFeature.fSIMPLE];
  }

  implicitLink(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fIMPLICIT];
  }

  explicitLink(): Number {
    return this.numberFeature_[Sd.NumberFeature.fEXPLICIT];
  }

  startTagEmpty(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fSTARTTAGEMPTY];
  }

  startTagUnclosed(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fSTARTTAGUNCLOSED];
  }

  startTagNetEnable(): number {
    return this.netEnable_;
  }

  setStartTagNetEnable(e: number): void {
    this.netEnable_ = e;
  }

  endTagEmpty(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fENDTAGEMPTY];
  }

  endTagUnclosed(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fENDTAGUNCLOSED];
  }

  attributeDefault(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fATTRIBDEFAULT];
  }

  attributeValueNotLiteral(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fATTRIBVALUE];
  }

  attributeOmitName(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fATTRIBOMITNAME];
  }

  emptyElementNormal(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fEMPTYNRM];
  }

  implydefAttlist(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fIMPLYDEFATTLIST];
  }

  implydefDoctype(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fIMPLYDEFDOCTYPE];
  }

  implydefElement(): number {
    return this.implydefElement_;
  }

  setImplydefElement(i: number): void {
    this.implydefElement_ = i;
  }

  implydefEntity(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fIMPLYDEFENTITY];
  }

  implydefNotation(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fIMPLYDEFNOTATION];
  }

  concur(): Number {
    return this.numberFeature_[Sd.NumberFeature.fCONCUR];
  }

  subdoc(): Number {
    return this.numberFeature_[Sd.NumberFeature.fSUBDOC];
  }

  omittag(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fOMITTAG];
  }

  rank(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fRANK];
  }

  datatag(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fDATATAG];
  }

  formal(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fFORMAL];
  }

  urn(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fURN];
  }

  keeprsre(): Boolean {
    return this.booleanFeature_[Sd.BooleanFeature.fKEEPRSRE];
  }

  internalCharset(): CharsetInfo {
    return this.internalCharsetPtr_ ? this.internalCharsetPtr_ : this.docCharset_;
  }

  execToInternal(c: number): Char;
  execToInternal(s: string): StringC;
  execToInternal(input: number | string): Char | StringC {
    if (typeof input === 'string') {
      return this.internalCharset().execToDesc(input);
    } else {
      // Convert number to single character string
      return this.internalCharset().execToDesc(String.fromCharCode(input));
    }
  }

  reservedName(i: number): StringC {
    return this.execToInternal(Sd.reservedName_[i]);
  }

  internalCharsetIsDocCharset(): Boolean {
    return this.internalCharsetIsDocCharset_;
  }

  docCharset(): CharsetInfo {
    return this.docCharset_;
  }

  capacity(i: number): Number {
    return this.capacity_[i];
  }

  setCapacity(i: number, n: Number): void {
    this.capacity_[i] = n;
  }

  capacityName(i: number): StringC {
    return this.execToInternal(Sd.capacityName_[i]);
  }

  scopeInstance(): Boolean {
    return this.scopeInstance_;
  }

  setScopeInstance(): void {
    this.scopeInstance_ = true;
  }

  setDocCharsetDecl(decl: CharsetDecl): void {
    decl.swap(this.docCharsetDecl_);
  }

  docCharsetDecl(): CharsetDecl {
    return this.docCharsetDecl_;
  }

  setBooleanFeature(i: number, b: Boolean): void {
    this.booleanFeature_[i] = b;
  }

  setShorttag(b: Boolean): void {
    for (let i = Sd.fSHORTTAG_FIRST; i <= Sd.fSHORTTAG_LAST; i++) {
      this.booleanFeature_[i] = b;
    }
    this.netEnable_ = Sd.NetEnable.netEnableAll;
  }

  setNumberFeature(i: number, n: Number): void {
    this.numberFeature_[i] = n;
  }

  www(): Boolean {
    return this.www_;
  }

  setWww(b: Boolean): void {
    this.www_ = b;
  }

  entityRef(): number {
    return this.entityRef_;
  }

  setEntityRef(r: number): void {
    this.entityRef_ = r;
  }

  typeValid(): Boolean {
    return this.typeValid_;
  }

  setTypeValid(b: Boolean): void {
    this.typeValid_ = b;
  }

  integrallyStored(): Boolean {
    return this.integrallyStored_;
  }

  setIntegrallyStored(b: Boolean): void {
    this.integrallyStored_ = b;
  }

  lookupQuantityName(name: StringC, result: { value: number }): Boolean {
    for (let i = 0; i < SIZEOF(Sd.quantityName_); i++) {
      if (this.execToInternal(Sd.quantityName_[i]).equals(name)) {
        result.value = i;
        return true;
      }
    }
    return false;
  }

  lookupGeneralDelimiterName(name: StringC, result: { value: number }): Boolean {
    for (let i = 0; i < SIZEOF(Sd.generalDelimiterName_); i++) {
      if (this.execToInternal(Sd.generalDelimiterName_[i]).equals(name)) {
        result.value = i;
        return true;
      }
    }
    return false;
  }

  lookupCapacityName(name: StringC, result: { value: number }): Boolean {
    for (let i = 0; i < SIZEOF(Sd.capacityName_); i++) {
      if (this.execToInternal(Sd.capacityName_[i]).equals(name)) {
        result.value = i;
        return true;
      }
    }
    return false;
  }

  quantityName(q: number): StringC {
    return this.execToInternal(Sd.quantityName_[q]);
  }

  generalDelimiterName(d: number): StringC {
    return this.execToInternal(Sd.generalDelimiterName_[d]);
  }

  nameToUniv(name: StringC): UnivChar {
    const p = this.namedCharTable_.lookup(name);
    let n: number;
    if (p !== null) {
      n = p;
    } else {
      n = this.namedCharTable_.count();
      this.namedCharTable_.insert(name, n);
    }
    return n + 0x60000000; // 10646 private use group
  }
}
