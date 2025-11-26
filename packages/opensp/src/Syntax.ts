// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, WideChar, Number, UnivChar, Xchar } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { ISet, ISetIter } from './ISet';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { SubstTable } from './SubstTable';
import { HashTable, HashTableIter } from './HashTable';
import { Vector } from './Vector';
import { Resource } from './Resource';
import { XcharMap } from './XcharMap';
import { charMax } from './constant';
import { MarkupScan } from './MarkupScan';
import { CharsetDeclRange } from './CharsetDecl';

// Forward declarations
export interface Sd {
  execToInternal(c: number | string): Char;
  www(): Boolean;
  internalCharset(): CharsetInfo;
  internalCharsetIsDocCharset(): Boolean;
  docCharset(): CharsetInfo;
  docCharsetDecl(): any; // CharsetDecl
}

export interface CharsetInfo {
  execToDesc(c: number | string): Char;
  univToDesc(univChar: UnivChar, result: { c: WideChar; set: ISet<WideChar> }): number;
  descToUniv(c: WideChar, result: { univ: UnivChar }): Boolean;
  getDescSet(set: ISet<Char>): void;
}

export class Syntax extends Resource {
  static readonly ReservedName = {
    rALL: 0,
    rANY: 1,
    rATTLIST: 2,
    rCDATA: 3,
    rCONREF: 4,
    rCURRENT: 5,
    rDATA: 6,
    rDEFAULT: 7,
    rDOCTYPE: 8,
    rELEMENT: 9,
    rEMPTY: 10,
    rENDTAG: 11,
    rENTITIES: 12,
    rENTITY: 13,
    rFIXED: 14,
    rID: 15,
    rIDLINK: 16,
    rIDREF: 17,
    rIDREFS: 18,
    rIGNORE: 19,
    rIMPLICIT: 20,
    rIMPLIED: 21,
    rINCLUDE: 22,
    rINITIAL: 23,
    rLINK: 24,
    rLINKTYPE: 25,
    rMD: 26,
    rMS: 27,
    rNAME: 28,
    rNAMES: 29,
    rNDATA: 30,
    rNMTOKEN: 31,
    rNMTOKENS: 32,
    rNOTATION: 33,
    rNUMBER: 34,
    rNUMBERS: 35,
    rNUTOKEN: 36,
    rNUTOKENS: 37,
    rO: 38,
    rPCDATA: 39,
    rPI: 40,
    rPOSTLINK: 41,
    rPUBLIC: 42,
    rRCDATA: 43,
    rRE: 44,
    rREQUIRED: 45,
    rRESTORE: 46,
    rRS: 47,
    rSDATA: 48,
    rSHORTREF: 49,
    rSIMPLE: 50,
    rSPACE: 51,
    rSTARTTAG: 52,
    rSUBDOC: 53,
    rSYSTEM: 54,
    rTEMP: 55,
    rUSELINK: 56,
    rUSEMAP: 57
  } as const;

  static readonly nNames = 58;

  static readonly Quantity = {
    qATTCNT: 0,
    qATTSPLEN: 1,
    qBSEQLEN: 2,
    qDTAGLEN: 3,
    qDTEMPLEN: 4,
    qENTLVL: 5,
    qGRPCNT: 6,
    qGRPGTCNT: 7,
    qGRPLVL: 8,
    qLITLEN: 9,
    qNAMELEN: 10,
    qNORMSEP: 11,
    qPILEN: 12,
    qTAGLEN: 13,
    qTAGLVL: 14
  } as const;

  static readonly nQuantity = 15;
  static readonly unlimited = 100000000;

  static readonly DelimGeneral = {
    dAND: 0,
    dCOM: 1,
    dCRO: 2,
    dDSC: 3,
    dDSO: 4,
    dDTGC: 5,
    dDTGO: 6,
    dERO: 7,
    dETAGO: 8,
    dGRPC: 9,
    dGRPO: 10,
    dHCRO: 11,
    dLIT: 12,
    dLITA: 13,
    dMDC: 14,
    dMDO: 15,
    dMINUS: 16,
    dMSC: 17,
    dNET: 18,
    dNESTC: 19,
    dOPT: 20,
    dOR: 21,
    dPERO: 22,
    dPIC: 23,
    dPIO: 24,
    dPLUS: 25,
    dREFC: 26,
    dREP: 27,
    dRNI: 28,
    dSEQ: 29,
    dSTAGO: 30,
    dTAGC: 31,
    dVI: 32
  } as const;

  static readonly nDelimGeneral = 33;

  static readonly StandardFunction = {
    fRE: 0,
    fRS: 1,
    fSPACE: 2
  } as const;

  static readonly FunctionClass = {
    cFUNCHAR: 0,
    cSEPCHAR: 1,
    cMSOCHAR: 2,
    cMSICHAR: 3,
    cMSSCHAR: 4
  } as const;

  static readonly Set = {
    nameStart: 0,
    digit: 1,
    hexDigit: 2,
    nmchar: 3,
    s: 4,
    blank: 5,
    sepchar: 6,
    minimumData: 7,
    significant: 8,
    functionChar: 9,
    sgmlChar: 10
  } as const;

  static readonly nSet = 11;

  static readonly Category = {
    otherCategory: 0,
    sCategory: 1,
    nameStartCategory: 2,
    digitCategory: 4,
    otherNameCategory: 8
  } as const;

  private static readonly referenceQuantity_: number[] = [
    40, 960, 960, 16, 16, 16, 32, 96, 16, 240, 8, 2, 240, 960, 24
  ];

  private shunchar_: ISet<Char>;
  private shuncharControls_: PackedBoolean;
  private set_: ISet<Char>[];
  private standardFunction_: Char[];
  private standardFunctionValid_: PackedBoolean[];
  private namecaseGeneral_: Boolean;
  private namecaseEntity_: Boolean;
  private delimGeneral_: StringC[];
  private delimShortrefComplex_: Vector<StringC>;
  private delimShortrefSimple_: ISet<Char>;
  private names_: StringC[];
  private quantity_: Number[];
  private nameTable_: HashTable<StringC, number>;
  private functionTable_: HashTable<StringC, Char>;
  private upperSubst_: SubstTable;
  private identitySubst_: SubstTable;
  private generalSubst_: SubstTable | null;
  private entitySubst_: SubstTable | null;
  private categoryTable_: XcharMap<number>;
  private multicode_: Boolean;
  private markupScanTable_: XcharMap<number>;
  private hasMarkupScanTable_: Boolean;
  private entityNames_: Vector<StringC>;
  private entityChars_: StringC;

  constructor(sd: Sd) {
    super();
    this.shunchar_ = new ISet<Char>();
    this.shuncharControls_ = false;
    this.set_ = [];
    for (let i = 0; i < Syntax.nSet; i++) {
      this.set_.push(new ISet<Char>());
    }
    this.standardFunction_ = [0, 0, 0];
    this.standardFunctionValid_ = [false, false, false];
    this.namecaseGeneral_ = false;
    this.namecaseEntity_ = false;
    this.delimGeneral_ = [];
    for (let i = 0; i < Syntax.nDelimGeneral; i++) {
      this.delimGeneral_.push(new StringOf<Char>());
    }
    this.delimShortrefComplex_ = new Vector<StringC>();
    this.delimShortrefSimple_ = new ISet<Char>();
    this.names_ = [];
    for (let i = 0; i < Syntax.nNames; i++) {
      this.names_.push(new StringOf<Char>());
    }
    this.quantity_ = [];
    for (let i = 0; i < Syntax.nQuantity; i++) {
      this.quantity_.push(0);
    }
    this.nameTable_ = new HashTable<StringC, number>();
    this.functionTable_ = new HashTable<StringC, Char>();
    this.upperSubst_ = new SubstTable();
    this.identitySubst_ = new SubstTable();
    this.generalSubst_ = null;
    this.entitySubst_ = null;
    this.categoryTable_ = new XcharMap<number>(Syntax.Category.otherCategory);
    this.multicode_ = false;
    this.markupScanTable_ = new XcharMap<number>(MarkupScan.Type.normal);
    this.hasMarkupScanTable_ = false;
    this.entityNames_ = new Vector<StringC>();
    this.entityChars_ = new StringOf<Char>();

    // Initialize with lowercase and uppercase letters
    const lcletter = "abcdefghijklmnopqrstuvwxyz";
    const ucletter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < 26; i++) {
      const lc = sd.execToInternal(lcletter.charCodeAt(i));
      const uc = sd.execToInternal(ucletter.charCodeAt(i));
      this.set_[Syntax.Set.nameStart].add(lc);
      this.set_[Syntax.Set.nameStart].add(uc);
      this.set_[Syntax.Set.minimumData].add(lc);
      this.set_[Syntax.Set.minimumData].add(uc);
      this.set_[Syntax.Set.significant].add(lc);
      this.set_[Syntax.Set.significant].add(uc);
      if (i < 6) {
        this.set_[Syntax.Set.hexDigit].add(lc);
        this.set_[Syntax.Set.hexDigit].add(uc);
      }
      this.categoryTable_.setChar(lc, Syntax.Category.nameStartCategory);
      this.categoryTable_.setChar(uc, Syntax.Category.nameStartCategory);
      this.subst(lc, uc);
    }

    // Initialize digits
    const digits = "0123456789";
    for (let i = 0; i < 10; i++) {
      const c = sd.execToInternal(digits.charCodeAt(i));
      this.set_[Syntax.Set.digit].add(c);
      this.set_[Syntax.Set.hexDigit].add(c);
      this.set_[Syntax.Set.minimumData].add(c);
      this.set_[Syntax.Set.significant].add(c);
      this.categoryTable_.setChar(c, Syntax.Category.digitCategory);
    }

    // Special characters
    const special = "'()+,-./:=?";
    for (let i = 0; i < special.length; i++) {
      const c = sd.execToInternal(special.charCodeAt(i));
      this.set_[Syntax.Set.minimumData].add(c);
      this.set_[Syntax.Set.significant].add(c);
    }

    // WWW special characters
    if (sd.www()) {
      const wwwSpecial = [33, 35, 36, 37, 42, 59, 64, 95];
      for (let i = 0; i < wwwSpecial.length; i++) {
        const charset = sd.internalCharset();
        const result = { c: 0, set: new ISet<WideChar>() };
        if (charset.univToDesc(wwwSpecial[i], result) > 0 && result.c <= charMax) {
          this.set_[Syntax.Set.minimumData].add(result.c);
          this.set_[Syntax.Set.significant].add(result.c);
        }
      }
    }

    // Initialize quantities
    for (let i = 0; i < Syntax.nQuantity; i++) {
      this.quantity_[i] = Syntax.referenceQuantity_[i];
    }

    // Initialize standard function validity
    for (let i = 0; i < 3; i++) {
      this.standardFunctionValid_[i] = false;
    }
  }

  addNameCharacters(set: ISet<Char>): void {
    const iter = new ISetIter<Char>(set);
    const result = { fromMin: 0 as Char, fromMax: 0 as Char };
    while (iter.next(result)) {
      this.set_[Syntax.Set.nmchar].addRange(result.fromMin, result.fromMax);
      this.set_[Syntax.Set.significant].addRange(result.fromMin, result.fromMax);
      this.categoryTable_.setRange(result.fromMin, result.fromMax, Syntax.Category.otherNameCategory);
    }
  }

  addNameStartCharacters(set: ISet<Char>): void {
    const iter = new ISetIter<Char>(set);
    const result = { fromMin: 0 as Char, fromMax: 0 as Char };
    while (iter.next(result)) {
      this.set_[Syntax.Set.nameStart].addRange(result.fromMin, result.fromMax);
      this.set_[Syntax.Set.significant].addRange(result.fromMin, result.fromMax);
      this.categoryTable_.setRange(result.fromMin, result.fromMax, Syntax.Category.nameStartCategory);
    }
  }

  addSubst(lc: Char, uc: Char): void {
    this.subst(lc, uc);
  }

  setStandardFunction(f: number, c: Char): void {
    this.standardFunction_[f] = c;
    this.standardFunctionValid_[f] = true;
    this.set_[Syntax.Set.minimumData].add(c);
    this.set_[Syntax.Set.s].add(c);
    this.categoryTable_.setChar(c, Syntax.Category.sCategory);
    this.set_[Syntax.Set.functionChar].add(c);
    this.set_[Syntax.Set.significant].add(c);
    switch (f) {
      case Syntax.StandardFunction.fSPACE:
        this.set_[Syntax.Set.blank].add(c);
        break;
      case Syntax.StandardFunction.fRE:
      case Syntax.StandardFunction.fRS:
        break;
    }
  }

  enterStandardFunctionNames(): void {
    const name = [
      Syntax.ReservedName.rRE,
      Syntax.ReservedName.rRS,
      Syntax.ReservedName.rSPACE
    ];
    for (let i = 0; i < 3; i++) {
      if (this.standardFunctionValid_[i]) {
        this.functionTable_.insert(this.reservedName(name[i]), this.standardFunction_[i]);
      }
    }
  }

  setDelimGeneral(i: number, str: StringC): void {
    this.delimGeneral_[i] = str;
    for (let j = 0; j < str.size(); j++) {
      this.set_[Syntax.Set.significant].add(str.get(j));
    }
  }

  addDelimShortref(str: StringC, charset: CharsetInfo): void {
    if (str.size() === 1 && str.get(0) !== charset.execToDesc('B'.charCodeAt(0)) && !this.isB(str.get(0))) {
      this.delimShortrefSimple_.add(str.get(0));
    } else {
      this.delimShortrefComplex_.push_back(str);
    }
    for (let i = 0; i < str.size(); i++) {
      this.set_[Syntax.Set.significant].add(str.get(i));
    }
  }

  addDelimShortrefs(shortrefChars: ISet<Char>, charset: CharsetInfo): void {
    const blankIter = new ISetIter<Char>(this.set_[Syntax.Set.blank]);
    const blankResult = { fromMin: 0 as Char, fromMax: 0 as Char };
    const specialChars = new StringOf<Char>();
    while (blankIter.next(blankResult)) {
      let min = blankResult.fromMin;
      const max = blankResult.fromMax;
      do {
        specialChars.append([min], 1);
      } while (min++ !== max);
    }
    specialChars.append([charset.execToDesc('B'.charCodeAt(0))], 1);

    let simpleCharsPtr: ISet<Char> = shortrefChars;
    let simpleChars = new ISet<Char>();
    for (let i = 0; i < specialChars.size(); i++) {
      if (shortrefChars.contains(specialChars.get(i))) {
        if (simpleCharsPtr === shortrefChars) {
          simpleChars = shortrefChars; // Copy
          simpleCharsPtr = simpleChars;
        }
        simpleChars.remove(specialChars.get(i));
      }
    }

    const iter = new ISetIter<Char>(simpleCharsPtr);
    const result = { fromMin: 0 as Char, fromMax: 0 as Char };
    while (iter.next(result)) {
      this.delimShortrefSimple_.addRange(result.fromMin, result.fromMax);
      this.set_[Syntax.Set.significant].addRange(result.fromMin, result.fromMax);
    }
  }

  addFunctionChar(str: StringC, fun: number, c: Char): void {
    switch (fun) {
      case Syntax.FunctionClass.cFUNCHAR:
        break;
      case Syntax.FunctionClass.cSEPCHAR:
        this.set_[Syntax.Set.s].add(c);
        this.categoryTable_.setChar(c, Syntax.Category.sCategory);
        this.set_[Syntax.Set.blank].add(c);
        this.set_[Syntax.Set.sepchar].add(c);
        break;
      case Syntax.FunctionClass.cMSOCHAR:
        this.multicode_ = true;
        if (!this.hasMarkupScanTable_) {
          this.markupScanTable_ = new XcharMap<number>(MarkupScan.Type.normal);
          this.hasMarkupScanTable_ = true;
        }
        this.markupScanTable_.setChar(c, MarkupScan.Type.out);
        break;
      case Syntax.FunctionClass.cMSICHAR:
        if (!this.hasMarkupScanTable_) {
          this.markupScanTable_ = new XcharMap<number>(MarkupScan.Type.normal);
          this.hasMarkupScanTable_ = true;
        }
        this.markupScanTable_.setChar(c, MarkupScan.Type.in);
        break;
      case Syntax.FunctionClass.cMSSCHAR:
        this.multicode_ = true;
        if (!this.hasMarkupScanTable_) {
          this.markupScanTable_ = new XcharMap<number>(MarkupScan.Type.normal);
          this.hasMarkupScanTable_ = true;
        }
        this.markupScanTable_.setChar(c, MarkupScan.Type.suppress);
        break;
    }
    this.set_[Syntax.Set.functionChar].add(c);
    this.set_[Syntax.Set.significant].add(c);
    this.functionTable_.insert(str, c);
  }

  setName(i: number, str: StringC): void {
    this.names_[i] = str;
    this.nameTable_.insert(str, i);
  }

  setNamecaseGeneral(b: Boolean): void {
    this.namecaseGeneral_ = b;
    this.generalSubst_ = b ? this.upperSubst_ : this.identitySubst_;
  }

  setNamecaseEntity(b: Boolean): void {
    this.namecaseEntity_ = b;
    this.entitySubst_ = b ? this.upperSubst_ : this.identitySubst_;
  }

  private subst(from: Char, to: Char): void {
    this.upperSubst_.addSubst(from, to);
  }

  addShunchar(c: Char): void {
    this.shunchar_.add(c);
  }

  lookupReservedName(str: StringC, result: { value: number }): Boolean {
    // First try direct lookup
    const tem = this.nameTable_.lookup(str);
    if (tem !== null) {
      result.value = tem;
      return true;
    }
    // If direct lookup failed and NAMECASE GENERAL is NO (identity subst),
    // try uppercase lookup for case-insensitive reserved name matching.
    // This handles DTDs that use lowercase reserved names (like <!element>)
    // with SGML declarations that define NAMECASE GENERAL NO.
    if (this.generalSubst_ === this.identitySubst_) {
      // Apply uppercase substitution to create uppercase version
      const upperStr = new StringOf<Char>();
      for (let i = 0; i < str.size(); i++) {
        const c = str.get(i);
        // Convert lowercase a-z to uppercase A-Z
        if (c >= 97 && c <= 122) {  // 'a' to 'z'
          upperStr.appendChar(c - 32);  // Convert to 'A' to 'Z'
        } else {
          upperStr.appendChar(c);
        }
      }
      const temUpper = this.nameTable_.lookup(upperStr);
      if (temUpper !== null) {
        result.value = temUpper;
        return true;
      }
    }
    return false;
  }

  lookupFunctionChar(name: StringC, result: { value: Char }): Boolean {
    const p = this.functionTable_.lookup(name);
    if (p !== null) {
      result.value = p;
      return true;
    } else {
      return false;
    }
  }

  functionIter(): HashTableIter<StringC, Char> {
    return new HashTableIter<StringC, Char>(this.functionTable_);
  }

  charFunctionName(c: Char, result: { name: StringC | null }): Boolean {
    const iter = new HashTableIter<StringC, Char>(this.functionTable_);
    let entry = iter.next();
    while (entry !== null) {
      if (entry.value === c) {
        result.name = entry.key;
        return true;
      }
      entry = iter.next();
    }
    return false;
  }

  isValidShortref(str: StringC): Boolean {
    if (str.size() === 1 && this.delimShortrefSimple_.contains(str.get(0))) {
      return true;
    }
    for (let i = 0; i < this.delimShortrefComplex_.size(); i++) {
      if (str.equals(this.delimShortrefComplex_.get(i))) {
        return true;
      }
    }
    return false;
  }

  implySgmlChar(sd: Sd): void {
    const internalCharset = sd.internalCharset();
    internalCharset.getDescSet(this.set_[Syntax.Set.sgmlChar]);
    const invalid = new ISet<WideChar>();
    this.checkSgmlChar(sd, null, false, invalid);
    const iter = new ISetIter<WideChar>(invalid);
    const result = { fromMin: 0 as Char, fromMax: 0 as Char };
    while (iter.next(result)) {
      let min = result.fromMin;
      const max = result.fromMax;
      do {
        if (min <= charMax) {
          this.set_[Syntax.Set.sgmlChar].remove(min);
        }
      } while (min++ !== max);
    }
  }

  checkSgmlChar(sd: Sd, otherSyntax: Syntax | null, invalidUseDocumentCharset: Boolean, invalid: ISet<WideChar>): void {
    const iter = new ISetIter<Char>(this.shunchar_);
    const iterResult = { fromMin: 0 as Char, fromMax: 0 as Char };
    while (iter.next(iterResult)) {
      let min = iterResult.fromMin;
      const max = iterResult.fromMax;
      if (min <= max) {
        do {
          let c: Char;
          if (!sd.internalCharsetIsDocCharset()) {
            const univResult = { univ: 0 };
            const descResult = { c: 0, set: new ISet<WideChar>() };
            if (sd.docCharset().descToUniv(min, univResult) &&
                sd.internalCharset().univToDesc(univResult.univ, descResult) &&
                descResult.c <= charMax) {
              c = descResult.c;
            } else {
              const charInfoResult = { id: null, type: 0, n: 0, str: new StringOf<Char>(), count: 0 };
              if (invalidUseDocumentCharset &&
                  sd.docCharsetDecl().getCharInfo(min, charInfoResult) &&
                  charInfoResult.type !== CharsetDeclRange.Type.unused) {
                invalid.add(min);
              }
              continue;
            }
          } else {
            c = min;
          }
          if (!this.set_[Syntax.Set.significant].contains(c) &&
              (!otherSyntax || !otherSyntax.set_[Syntax.Set.significant].contains(c)) &&
              this.set_[Syntax.Set.sgmlChar].contains(c)) {
            invalid.add(invalidUseDocumentCharset ? min : c);
          }
        } while (min++ !== max);
      }
    }

    if (this.shuncharControls_) {
      const charset = invalidUseDocumentCharset ? sd.docCharset() : sd.internalCharset();
      for (let i = 0; i < 32; i++) {
        this.checkUnivControlChar(i, charset, otherSyntax, invalid);
      }
      for (let i = 127; i < 160; i++) {
        this.checkUnivControlChar(i, charset, otherSyntax, invalid);
      }
    }
  }

  private checkUnivControlChar(univChar: UnivChar, internalCharset: CharsetInfo, otherSyntax: Syntax | null, invalid: ISet<WideChar>): void {
    const result = { c: 0, set: new ISet<WideChar>() };
    const count = internalCharset.univToDesc(univChar, result);
    if (count === 0) {
      return;
    }

    const set = result.set;
    if (count === 1) {
      set.add(result.c);
    }

    const iter = new ISetIter<WideChar>(set);
    const iterResult = { fromMin: 0 as Char, fromMax: 0 as Char };
    while (iter.next(iterResult)) {
      let min = iterResult.fromMin;
      const max = iterResult.fromMax;
      do {
        if (min > charMax) {
          break;
        }
        const ch = min;
        if (!this.set_[Syntax.Set.significant].contains(ch) &&
            (!otherSyntax || !otherSyntax.set_[Syntax.Set.significant].contains(ch)) &&
            this.set_[Syntax.Set.sgmlChar].contains(ch)) {
          invalid.add(ch);
        }
      } while (min++ !== max);
    }
  }

  rniReservedName(i: number): StringC {
    const result = this.delimGeneral(Syntax.DelimGeneral.dRNI);
    const temp = new StringOf<Char>();
    temp.assign(result.data(), result.size());
    temp.append(this.reservedName(i).data(), this.reservedName(i).size());
    return temp;
  }

  upperSubstTable(): SubstTable {
    return this.upperSubst_;
  }

  peroDelim(): StringC {
    return this.delimGeneral(Syntax.DelimGeneral.dPERO);
  }

  isHexDigit(c: Xchar): Boolean {
    switch (this.categoryTable_.get(c)) {
      case Syntax.Category.digitCategory:
        return true;
      case Syntax.Category.nameStartCategory:
        break;
      default:
        return false;
    }
    return this.set_[Syntax.Set.hexDigit].contains(c);
  }

  addEntity(name: StringC, c: Char): void {
    this.entityNames_.push_back(name);
    this.entityChars_.append([c], 1);
  }

  // EntityCatalog.Syntax interface implementation
  namecaseGeneral(): Boolean {
    return this.namecaseGeneral_;
  }

  namecaseEntity(): Boolean {
    return this.namecaseEntity_;
  }

  // Inline methods
  quantity(q: number): Number {
    return this.quantity_[q];
  }

  setQuantity(i: number, n: Number): void {
    this.quantity_[i] = n;
  }

  generalSubstTable(): SubstTable | null {
    return this.generalSubst_;
  }

  entitySubstTable(): SubstTable | null {
    return this.entitySubst_;
  }

  nDelimShortrefComplex(): number {
    return this.delimShortrefComplex_.size();
  }

  delimGeneral(i: number): StringC {
    return this.delimGeneral_[i];
  }

  delimShortrefComplex(i: number): StringC {
    return this.delimShortrefComplex_.get(i);
  }

  delimShortrefSimple(): ISet<Char> {
    return this.delimShortrefSimple_;
  }

  hasShortrefs(): Boolean {
    return this.delimShortrefComplex_.size() > 0 || !this.delimShortrefSimple_.isEmpty();
  }

  standardFunction(i: number): Char {
    return this.standardFunction_[i];
  }

  getStandardFunction(i: number, result: { value: Char }): Boolean {
    if (this.standardFunctionValid_[i]) {
      result.value = this.standardFunction_[i];
      return true;
    } else {
      return false;
    }
  }

  charSet(i: number): ISet<Char> | null {
    return this.set_[i];
  }

  isNameCharacter(c: Xchar): Boolean {
    return this.categoryTable_.get(c) >= Syntax.Category.nameStartCategory;
  }

  isNameStartCharacter(c: Xchar): Boolean {
    return this.categoryTable_.get(c) === Syntax.Category.nameStartCategory;
  }

  isDigit(c: Xchar): Boolean {
    return this.categoryTable_.get(c) === Syntax.Category.digitCategory;
  }

  isS(c: Xchar): Boolean {
    return this.categoryTable_.get(c) === Syntax.Category.sCategory;
  }

  isB(c: Xchar): Boolean {
    return (this.categoryTable_.get(c) === Syntax.Category.sCategory &&
            !(this.standardFunctionValid_[Syntax.StandardFunction.fRE] && c === this.standardFunction_[Syntax.StandardFunction.fRE]) &&
            !(this.standardFunctionValid_[Syntax.StandardFunction.fRS] && c === this.standardFunction_[Syntax.StandardFunction.fRS]));
  }

  charCategory(c: Xchar): number {
    return this.categoryTable_.get(c);
  }

  isSgmlChar(c: Xchar): Boolean {
    return c >= 0 && this.set_[Syntax.Set.sgmlChar].contains(c);
  }

  reservedName(i: number): StringC {
    return this.names_[i];
  }

  attcnt(): number {
    return this.quantity(Syntax.Quantity.qATTCNT);
  }

  attsplen(): number {
    return this.quantity(Syntax.Quantity.qATTSPLEN);
  }

  namelen(): number {
    return this.quantity(Syntax.Quantity.qNAMELEN);
  }

  penamelen(): number {
    return this.quantity(Syntax.Quantity.qNAMELEN) - this.delimGeneral(Syntax.DelimGeneral.dPERO).size();
  }

  litlen(): number {
    return this.quantity(Syntax.Quantity.qLITLEN);
  }

  normsep(): number {
    return this.quantity(Syntax.Quantity.qNORMSEP);
  }

  dtemplen(): number {
    return this.quantity(Syntax.Quantity.qDTEMPLEN);
  }

  grpcnt(): number {
    return this.quantity(Syntax.Quantity.qGRPCNT);
  }

  grpgtcnt(): number {
    return this.quantity(Syntax.Quantity.qGRPGTCNT);
  }

  grplvl(): number {
    return this.quantity(Syntax.Quantity.qGRPLVL);
  }

  taglvl(): number {
    return this.quantity(Syntax.Quantity.qTAGLVL);
  }

  taglen(): number {
    return this.quantity(Syntax.Quantity.qTAGLEN);
  }

  entlvl(): number {
    return this.quantity(Syntax.Quantity.qENTLVL);
  }

  pilen(): number {
    return this.quantity(Syntax.Quantity.qPILEN);
  }

  space(): Char {
    return this.standardFunction(Syntax.StandardFunction.fSPACE);
  }

  setSgmlChar(set: ISet<Char>): void {
    this.set_[Syntax.Set.sgmlChar] = set;
  }

  static referenceQuantity(i: number): number {
    return Syntax.referenceQuantity_[i];
  }

  setShuncharControls(): void {
    this.shuncharControls_ = true;
  }

  markupScanTable(): XcharMap<number> {
    return this.markupScanTable_;
  }

  multicode(): Boolean {
    return this.multicode_;
  }

  nEntities(): number {
    return this.entityNames_.size();
  }

  entityName(i: number): StringC {
    return this.entityNames_.get(i);
  }

  entityChar(i: number): Char {
    return this.entityChars_.get(i);
  }

  delim(): StringC {
    // Returns concatenation of all delimiters
    let result = new StringOf<Char>();
    for (let i = 0; i < Syntax.nDelimGeneral; i++) {
      result.append(this.delimGeneral_[i].data(), this.delimGeneral_[i].size());
    }
    return result;
  }
}
