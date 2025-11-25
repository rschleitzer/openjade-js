// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { Syntax } from './Syntax';
import { Mode, nModes, minShortrefMode } from './Mode';
import { Priority } from './Priority';
import { Token } from './types';
import { Token as TokenEnum } from './Token';
import { Sd } from './Sd';

/**
 * TokenInfo describes a token recognized by the parser.
 */
export class TokenInfo {
  static readonly Type = {
    delimType: 0,
    setType: 1,
    functionType: 2,
    delimDelimType: 3,
    delimSetType: 4
  } as const;

  type: number;
  priority: number;
  token: Token;
  delim1: number;
  delim2: number;  // union member
  set: number;     // union member (overlaps delim2)
  function: number; // union member (overlaps delim2)

  constructor() {
    this.type = TokenInfo.Type.delimType;
    this.priority = Priority.delim;
    this.token = 0;
    this.delim1 = 0;
    this.delim2 = 0;
    this.set = 0;
    this.function = 0;
  }
}

// Constants for contents array encoding
const SET = Syntax.nDelimGeneral;
const FUNCTION = SET + Syntax.nSet;
const NOTHING = 255;
const EOM = 255;  // End of modes marker

// Requirement flags for token availability
const REQUIRE_EMPTY_STARTTAG = 0o01;
const REQUIRE_EMPTY_ENDTAG = 0o02;
const REQUIRE_CONCUR = 0o04;
const REQUIRE_LINK_OR_CONCUR = 0o10;
const REQUIRE_NOT_KEEPRSRE = 0o20;
const REQUIRE_FLAGS = 0o37;

interface PackedTokenInfo {
  token: Token;
  flags: number;
  contents: [number, number];
  modes: number[];
  modeBits: number[];
}

// Build the token table
function buildTokenTable(): PackedTokenInfo[] {
  const table: PackedTokenInfo[] = [
    // Delimiters and delimiters in context
    { token: TokenEnum.tokenAnd, flags: 0, contents: [Syntax.DelimGeneral.dAND, NOTHING],
      modes: [Mode.grpMode], modeBits: [] },
    { token: TokenEnum.tokenCom, flags: 0, contents: [Syntax.DelimGeneral.dCOM, NOTHING],
      modes: [Mode.mdMode, Mode.mdMinusMode, Mode.mdPeroMode, Mode.sdMode, Mode.comMode, Mode.sdcomMode, Mode.piPasMode], modeBits: [] },
    { token: TokenEnum.tokenCroDigit, flags: 0, contents: [Syntax.DelimGeneral.dCRO, SET + Syntax.Set.digit],
      modes: [Mode.econMode, Mode.mconMode, Mode.rcconMode, Mode.econnetMode, Mode.mconnetMode, Mode.rcconnetMode,
              Mode.rcconeMode, Mode.plitMode, Mode.plitaMode, Mode.pliteMode, Mode.sdplitMode, Mode.sdplitaMode,
              Mode.alitMode, Mode.alitaMode, Mode.aliteMode, Mode.talitMode, Mode.talitaMode, Mode.taliteMode, Mode.rcmsMode], modeBits: [] },
    { token: TokenEnum.tokenCroNameStart, flags: 0, contents: [Syntax.DelimGeneral.dCRO, SET + Syntax.Set.nameStart],
      modes: [Mode.econMode, Mode.mconMode, Mode.rcconMode, Mode.econnetMode, Mode.mconnetMode, Mode.rcconnetMode,
              Mode.rcconeMode, Mode.plitMode, Mode.plitaMode, Mode.pliteMode, Mode.sdplitMode, Mode.sdplitaMode,
              Mode.alitMode, Mode.alitaMode, Mode.aliteMode, Mode.talitMode, Mode.talitaMode, Mode.taliteMode, Mode.rcmsMode], modeBits: [] },
    { token: TokenEnum.tokenDsc, flags: 0, contents: [Syntax.DelimGeneral.dDSC, NOTHING],
      modes: [Mode.asMode, Mode.dsMode], modeBits: [] },
    { token: TokenEnum.tokenDso, flags: 0, contents: [Syntax.DelimGeneral.dDSO, NOTHING],
      modes: [Mode.mdMode], modeBits: [] },
    { token: TokenEnum.tokenDtgc, flags: 0, contents: [Syntax.DelimGeneral.dDTGC, NOTHING],
      modes: [Mode.grpMode], modeBits: [] },
    { token: TokenEnum.tokenDtgo, flags: 0, contents: [Syntax.DelimGeneral.dDTGO, NOTHING],
      modes: [Mode.grpMode], modeBits: [] },
    { token: TokenEnum.tokenEroNameStart, flags: 0, contents: [Syntax.DelimGeneral.dERO, SET + Syntax.Set.nameStart],
      modes: [Mode.econMode, Mode.mconMode, Mode.rcconMode, Mode.econnetMode, Mode.mconnetMode, Mode.rcconnetMode,
              Mode.rcconeMode, Mode.alitMode, Mode.alitaMode, Mode.aliteMode, Mode.talitMode, Mode.talitaMode,
              Mode.taliteMode, Mode.rcmsMode], modeBits: [] },
    { token: TokenEnum.tokenEroGrpo, flags: REQUIRE_LINK_OR_CONCUR, contents: [Syntax.DelimGeneral.dERO, Syntax.DelimGeneral.dGRPO],
      modes: [Mode.econMode, Mode.mconMode, Mode.rcconMode, Mode.econnetMode, Mode.mconnetMode, Mode.rcconnetMode,
              Mode.rcconeMode, Mode.alitMode, Mode.alitaMode, Mode.aliteMode, Mode.talitMode, Mode.talitaMode,
              Mode.taliteMode, Mode.rcmsMode], modeBits: [] },
    { token: TokenEnum.tokenEtago, flags: 0, contents: [Syntax.DelimGeneral.dETAGO, NOTHING],
      modes: [Mode.tagMode], modeBits: [] },
    { token: TokenEnum.tokenEtagoNameStart, flags: 0, contents: [Syntax.DelimGeneral.dETAGO, SET + Syntax.Set.nameStart],
      modes: [Mode.econMode, Mode.mconMode, Mode.cconMode, Mode.rcconMode,
              Mode.econnetMode, Mode.mconnetMode, Mode.cconnetMode, Mode.rcconnetMode], modeBits: [] },
    { token: TokenEnum.tokenEtagoTagc, flags: REQUIRE_EMPTY_ENDTAG, contents: [Syntax.DelimGeneral.dETAGO, Syntax.DelimGeneral.dTAGC],
      modes: [Mode.econMode, Mode.mconMode, Mode.cconMode, Mode.rcconMode,
              Mode.econnetMode, Mode.mconnetMode, Mode.cconnetMode, Mode.rcconnetMode], modeBits: [] },
    { token: TokenEnum.tokenEtagoGrpo, flags: REQUIRE_CONCUR, contents: [Syntax.DelimGeneral.dETAGO, Syntax.DelimGeneral.dGRPO],
      modes: [Mode.econMode, Mode.mconMode, Mode.cconMode, Mode.rcconMode,
              Mode.econnetMode, Mode.mconnetMode, Mode.cconnetMode, Mode.rcconnetMode], modeBits: [] },
    { token: TokenEnum.tokenGrpc, flags: 0, contents: [Syntax.DelimGeneral.dGRPC, NOTHING],
      modes: [Mode.grpMode], modeBits: [] },
    { token: TokenEnum.tokenGrpo, flags: 0, contents: [Syntax.DelimGeneral.dGRPO, NOTHING],
      modes: [Mode.mdMode, Mode.mdMinusMode, Mode.grpMode], modeBits: [] },
    { token: TokenEnum.tokenHcroHexDigit, flags: 0, contents: [Syntax.DelimGeneral.dHCRO, SET + Syntax.Set.hexDigit],
      modes: [Mode.econMode, Mode.mconMode, Mode.rcconMode, Mode.econnetMode, Mode.mconnetMode, Mode.rcconnetMode,
              Mode.rcconeMode, Mode.plitMode, Mode.plitaMode, Mode.pliteMode,
              Mode.alitMode, Mode.alitaMode, Mode.aliteMode, Mode.talitMode, Mode.talitaMode, Mode.taliteMode, Mode.rcmsMode], modeBits: [] },
    { token: TokenEnum.tokenLit, flags: 0, contents: [Syntax.DelimGeneral.dLIT, NOTHING],
      modes: [Mode.alitMode, Mode.talitMode, Mode.plitMode, Mode.sdplitMode, Mode.mlitMode, Mode.slitMode, Mode.sdslitMode,
              Mode.asMode, Mode.piPasMode, Mode.tagMode, Mode.mdMode, Mode.sdMode, Mode.grpMode], modeBits: [] },
    { token: TokenEnum.tokenLita, flags: 0, contents: [Syntax.DelimGeneral.dLITA, NOTHING],
      modes: [Mode.alitaMode, Mode.talitaMode, Mode.plitaMode, Mode.sdplitaMode, Mode.mlitaMode, Mode.slitaMode, Mode.sdslitaMode,
              Mode.asMode, Mode.piPasMode, Mode.tagMode, Mode.mdMode, Mode.sdMode, Mode.grpMode], modeBits: [] },
    { token: TokenEnum.tokenMdc, flags: 0, contents: [Syntax.DelimGeneral.dMDC, NOTHING],
      modes: [Mode.mdMode, Mode.sdMode], modeBits: [] },
    { token: TokenEnum.tokenMdoNameStart, flags: 0, contents: [Syntax.DelimGeneral.dMDO, SET + Syntax.Set.nameStart],
      modes: [Mode.econMode, Mode.mconMode, Mode.econnetMode, Mode.mconnetMode,
              Mode.proMode, Mode.dsMode, Mode.dsiMode], modeBits: [] },
    { token: TokenEnum.tokenMdoMdc, flags: 0, contents: [Syntax.DelimGeneral.dMDO, Syntax.DelimGeneral.dMDC],
      modes: [Mode.econMode, Mode.mconMode, Mode.econnetMode, Mode.mconnetMode,
              Mode.proMode, Mode.dsMode, Mode.dsiMode], modeBits: [] },
    { token: TokenEnum.tokenMdoCom, flags: 0, contents: [Syntax.DelimGeneral.dMDO, Syntax.DelimGeneral.dCOM],
      modes: [Mode.econMode, Mode.mconMode, Mode.econnetMode, Mode.mconnetMode,
              Mode.proMode, Mode.dsMode, Mode.dsiMode], modeBits: [] },
    { token: TokenEnum.tokenMdoDso, flags: 0, contents: [Syntax.DelimGeneral.dMDO, Syntax.DelimGeneral.dDSO],
      modes: [Mode.econMode, Mode.mconMode, Mode.econnetMode, Mode.mconnetMode,
              Mode.dsMode, Mode.dsiMode, Mode.imsMode], modeBits: [] },
    { token: TokenEnum.tokenMinus, flags: 0, contents: [Syntax.DelimGeneral.dMINUS, NOTHING],
      modes: [Mode.mdMinusMode, Mode.sdMode], modeBits: [] },
    { token: TokenEnum.tokenMinusGrpo, flags: 0, contents: [Syntax.DelimGeneral.dMINUS, Syntax.DelimGeneral.dGRPO],
      modes: [Mode.mdMode], modeBits: [] },
    { token: TokenEnum.tokenMscMdc, flags: 0, contents: [Syntax.DelimGeneral.dMSC, Syntax.DelimGeneral.dMDC],
      modes: [Mode.imsMode, Mode.cmsMode, Mode.rcmsMode,
              Mode.econMode, Mode.mconMode, Mode.econnetMode, Mode.mconnetMode, Mode.dsMode, Mode.dsiMode], modeBits: [] },
    { token: TokenEnum.tokenNestc, flags: 0, contents: [Syntax.DelimGeneral.dNESTC, NOTHING],
      modes: [Mode.tagMode], modeBits: [] },
    { token: TokenEnum.tokenNet, flags: 0, contents: [Syntax.DelimGeneral.dNET, NOTHING],
      modes: [Mode.econnetMode, Mode.mconnetMode, Mode.cconnetMode, Mode.rcconnetMode], modeBits: [] },
    { token: TokenEnum.tokenOpt, flags: 0, contents: [Syntax.DelimGeneral.dOPT, NOTHING],
      modes: [Mode.grpMode, Mode.grpsufMode], modeBits: [] },
    { token: TokenEnum.tokenOr, flags: 0, contents: [Syntax.DelimGeneral.dOR, NOTHING],
      modes: [Mode.grpMode], modeBits: [] },
    { token: TokenEnum.tokenPero, flags: 0, contents: [Syntax.DelimGeneral.dPERO, NOTHING],
      modes: [Mode.mdPeroMode], modeBits: [] },
    { token: TokenEnum.tokenPeroNameStart, flags: 0, contents: [Syntax.DelimGeneral.dPERO, SET + Syntax.Set.nameStart],
      modes: [Mode.mdMode, Mode.mdMinusMode, Mode.mdPeroMode, Mode.dsMode, Mode.dsiMode, Mode.grpMode,
              Mode.plitMode, Mode.plitaMode, Mode.pliteMode, Mode.sdplitMode, Mode.sdplitaMode], modeBits: [] },
    { token: TokenEnum.tokenPeroGrpo, flags: REQUIRE_LINK_OR_CONCUR, contents: [Syntax.DelimGeneral.dPERO, Syntax.DelimGeneral.dGRPO],
      modes: [Mode.mdMode, Mode.mdMinusMode, Mode.mdPeroMode, Mode.dsMode, Mode.dsiMode, Mode.grpMode,
              Mode.plitMode, Mode.plitaMode, Mode.pliteMode, Mode.sdplitMode, Mode.sdplitaMode], modeBits: [] },
    { token: TokenEnum.tokenPic, flags: 0, contents: [Syntax.DelimGeneral.dPIC, NOTHING],
      modes: [Mode.piMode], modeBits: [] },
    { token: TokenEnum.tokenPio, flags: 0, contents: [Syntax.DelimGeneral.dPIO, NOTHING],
      modes: [Mode.econMode, Mode.mconMode, Mode.econnetMode, Mode.mconnetMode, Mode.proMode,
              Mode.dsMode, Mode.dsiMode], modeBits: [] },
    { token: TokenEnum.tokenPlus, flags: 0, contents: [Syntax.DelimGeneral.dPLUS, NOTHING],
      modes: [Mode.grpMode, Mode.grpsufMode], modeBits: [] },
    { token: TokenEnum.tokenPlusGrpo, flags: 0, contents: [Syntax.DelimGeneral.dPLUS, Syntax.DelimGeneral.dGRPO],
      modes: [Mode.mdMode], modeBits: [] },
    { token: TokenEnum.tokenRefc, flags: 0, contents: [Syntax.DelimGeneral.dREFC, NOTHING],
      modes: [Mode.refMode], modeBits: [] },
    { token: TokenEnum.tokenRep, flags: 0, contents: [Syntax.DelimGeneral.dREP, NOTHING],
      modes: [Mode.grpMode, Mode.grpsufMode], modeBits: [] },
    { token: TokenEnum.tokenRni, flags: 0, contents: [Syntax.DelimGeneral.dRNI, NOTHING],
      modes: [Mode.grpMode, Mode.mdMode, Mode.mdPeroMode], modeBits: [] },
    { token: TokenEnum.tokenSeq, flags: 0, contents: [Syntax.DelimGeneral.dSEQ, NOTHING],
      modes: [Mode.grpMode], modeBits: [] },
    { token: TokenEnum.tokenStago, flags: 0, contents: [Syntax.DelimGeneral.dSTAGO, NOTHING],
      modes: [Mode.tagMode], modeBits: [] },
    { token: TokenEnum.tokenStagoNameStart, flags: 0, contents: [Syntax.DelimGeneral.dSTAGO, SET + Syntax.Set.nameStart],
      modes: [Mode.econMode, Mode.mconMode, Mode.econnetMode, Mode.mconnetMode], modeBits: [] },
    { token: TokenEnum.tokenStagoTagc, flags: REQUIRE_EMPTY_STARTTAG, contents: [Syntax.DelimGeneral.dSTAGO, Syntax.DelimGeneral.dTAGC],
      modes: [Mode.econMode, Mode.mconMode, Mode.econnetMode, Mode.mconnetMode], modeBits: [] },
    { token: TokenEnum.tokenStagoGrpo, flags: REQUIRE_CONCUR, contents: [Syntax.DelimGeneral.dSTAGO, Syntax.DelimGeneral.dGRPO],
      modes: [Mode.econMode, Mode.mconMode, Mode.econnetMode, Mode.mconnetMode], modeBits: [] },
    { token: TokenEnum.tokenTagc, flags: 0, contents: [Syntax.DelimGeneral.dTAGC, NOTHING],
      modes: [Mode.tagMode], modeBits: [] },
    { token: TokenEnum.tokenVi, flags: 0, contents: [Syntax.DelimGeneral.dVI, NOTHING],
      modes: [Mode.tagMode, Mode.asMode, Mode.piPasMode], modeBits: [] },
    // Function tokens
    { token: TokenEnum.tokenRe, flags: REQUIRE_NOT_KEEPRSRE, contents: [FUNCTION + Syntax.StandardFunction.fRE, NOTHING],
      modes: [Mode.mconMode, Mode.cconMode, Mode.rcconMode,
              Mode.mconnetMode, Mode.cconnetMode, Mode.rcconnetMode,
              Mode.rcconeMode, Mode.cmsMode, Mode.rcmsMode], modeBits: [] },
    { token: TokenEnum.tokenRe, flags: 0, contents: [FUNCTION + Syntax.StandardFunction.fRE, NOTHING],
      modes: [Mode.refMode, Mode.mlitMode, Mode.mlitaMode, Mode.alitMode, Mode.alitaMode, Mode.aliteMode,
              Mode.talitMode, Mode.talitaMode, Mode.taliteMode], modeBits: [] },
    { token: TokenEnum.tokenRs, flags: REQUIRE_NOT_KEEPRSRE, contents: [FUNCTION + Syntax.StandardFunction.fRS, NOTHING],
      modes: [Mode.mconMode, Mode.cconMode, Mode.rcconMode,
              Mode.mconnetMode, Mode.cconnetMode, Mode.rcconnetMode,
              Mode.rcconeMode, Mode.cmsMode, Mode.rcmsMode], modeBits: [] },
    { token: TokenEnum.tokenRs, flags: 0, contents: [FUNCTION + Syntax.StandardFunction.fRS, NOTHING],
      modes: [Mode.mlitMode, Mode.mlitaMode, Mode.alitMode, Mode.alitaMode, Mode.aliteMode,
              Mode.talitMode, Mode.talitaMode, Mode.taliteMode], modeBits: [] },
    { token: TokenEnum.tokenSpace, flags: 0, contents: [FUNCTION + Syntax.StandardFunction.fSPACE, NOTHING],
      modes: [Mode.mlitMode, Mode.mlitaMode, Mode.talitMode, Mode.talitaMode, Mode.taliteMode], modeBits: [] },
    // Set tokens
    { token: TokenEnum.tokenSepchar, flags: 0, contents: [SET + Syntax.Set.sepchar, NOTHING],
      modes: [Mode.alitMode, Mode.alitaMode, Mode.aliteMode,
              Mode.talitMode, Mode.talitaMode, Mode.taliteMode], modeBits: [] },
    { token: TokenEnum.tokenS, flags: 0, contents: [SET + Syntax.Set.s, NOTHING],
      modes: [Mode.econMode, Mode.econnetMode, Mode.grpMode, Mode.mdMode, Mode.mdMinusMode, Mode.mdPeroMode, Mode.sdMode,
              Mode.proMode, Mode.dsMode, Mode.dsiMode, Mode.asMode, Mode.piPasMode, Mode.tagMode], modeBits: [] },
    { token: TokenEnum.tokenNameStart, flags: 0, contents: [SET + Syntax.Set.nameStart, NOTHING],
      modes: [Mode.grpMode, Mode.mdMode, Mode.mdMinusMode, Mode.mdPeroMode, Mode.sdMode,
              Mode.asMode, Mode.piPasMode, Mode.tagMode], modeBits: [] },
    { token: TokenEnum.tokenDigit, flags: 0, contents: [SET + Syntax.Set.digit, NOTHING],
      modes: [Mode.grpMode, Mode.mdMode, Mode.mdMinusMode, Mode.sdMode, Mode.asMode, Mode.piPasMode, Mode.tagMode], modeBits: [] },
    { token: TokenEnum.tokenLcUcNmchar, flags: 0, contents: [SET + Syntax.Set.nmchar, NOTHING],
      modes: [Mode.grpMode, Mode.mdMode, Mode.asMode, Mode.piPasMode, Mode.tagMode], modeBits: [] },
    { token: TokenEnum.tokenIgnoredChar, flags: 0, contents: [SET + Syntax.Set.sgmlChar, NOTHING],
      modes: [Mode.imsMode], modeBits: [] },
    { token: TokenEnum.tokenChar, flags: 0, contents: [SET + Syntax.Set.sgmlChar, NOTHING],
      modes: [Mode.alitMode, Mode.alitaMode, Mode.aliteMode,
              Mode.talitMode, Mode.talitaMode, Mode.taliteMode,
              Mode.comMode, Mode.piMode,
              Mode.cmsMode, Mode.rcmsMode,
              Mode.plitMode, Mode.plitaMode, Mode.pliteMode,
              Mode.slitMode, Mode.slitaMode,
              Mode.econMode, Mode.mconMode, Mode.cconMode, Mode.rcconMode,
              Mode.econnetMode, Mode.mconnetMode, Mode.cconnetMode, Mode.rcconnetMode, Mode.rcconeMode], modeBits: [] },
    { token: TokenEnum.tokenChar, flags: 0, contents: [SET + Syntax.Set.minimumData, NOTHING],
      modes: [Mode.mlitMode, Mode.mlitaMode], modeBits: [] },
    { token: TokenEnum.tokenChar, flags: 0, contents: [SET + Syntax.Set.significant, NOTHING],
      modes: [Mode.sdplitMode, Mode.sdplitaMode, Mode.sdslitMode, Mode.sdslitaMode, Mode.sdcomMode], modeBits: [] },
  ];

  // Compute mode bits for each entry
  const ULONG_BIT = 32;  // JavaScript uses 32-bit bitwise operations
  const nBitWords = Math.ceil(nModes / ULONG_BIT);

  for (const entry of table) {
    entry.modeBits = new Array(nBitWords).fill(0);
    for (const m of entry.modes) {
      const wordIndex = Math.floor(m / ULONG_BIT);
      const bitIndex = m % ULONG_BIT;
      entry.modeBits[wordIndex] |= (1 << bitIndex);
    }
  }

  return table;
}

// Build token table once at module load
const tokenTable = buildTokenTable();

/**
 * ModeInfo iterates over tokens that can be recognized in a given mode.
 */
export class ModeInfo {
  private mode_: Mode;
  private index_: number;
  private count_: number;
  private missingRequirements_: number;

  constructor(mode: Mode, sd: Sd) {
    this.mode_ = mode;
    this.index_ = 0;
    this.count_ = tokenTable.length;
    this.missingRequirements_ = REQUIRE_FLAGS;

    if (sd.startTagEmpty()) {
      this.missingRequirements_ &= ~REQUIRE_EMPTY_STARTTAG;
    }
    if (sd.endTagEmpty()) {
      this.missingRequirements_ &= ~REQUIRE_EMPTY_ENDTAG;
    }
    if (sd.concur()) {
      this.missingRequirements_ &= ~(REQUIRE_CONCUR | REQUIRE_LINK_OR_CONCUR);
    }
    if (sd.link()) {
      this.missingRequirements_ &= ~REQUIRE_LINK_OR_CONCUR;
    }
    if (!sd.keeprsre()) {
      this.missingRequirements_ &= ~REQUIRE_NOT_KEEPRSRE;
    }
  }

  private inMode(entry: PackedTokenInfo, mode: Mode): boolean {
    const ULONG_BIT = 32;
    const wordIndex = Math.floor(mode / ULONG_BIT);
    const bitIndex = mode % ULONG_BIT;
    return (entry.modeBits[wordIndex] & (1 << bitIndex)) !== 0;
  }

  nextToken(t: TokenInfo): Boolean {
    while (this.index_ < this.count_) {
      const p = tokenTable[this.index_];
      if (this.inMode(p, this.mode_) && (p.flags & this.missingRequirements_) === 0) {
        t.token = p.token;
        t.priority = Priority.delim;
        const contents = p.contents;
        this.index_++;

        const c0 = contents[0];
        if (c0 < SET) {
          t.delim1 = c0;
        } else if (c0 < SET + Syntax.nSet) {
          t.set = c0 - SET;
          t.type = TokenInfo.Type.setType;
          switch (t.set) {
            case Syntax.Set.sepchar:
            case Syntax.Set.s:
            case Syntax.Set.blank:
              t.priority = Priority.function;
              break;
            default:
              t.priority = Priority.data;
              break;
          }
          return true;
        } else {
          t.function = c0 - FUNCTION;
          t.priority = Priority.function;
          t.type = TokenInfo.Type.functionType;
          return true;
        }

        const c1 = contents[1];
        if (c1 === NOTHING) {
          t.type = TokenInfo.Type.delimType;
          return true;
        }
        if (c1 < SET) {
          t.delim2 = c1;
          t.type = TokenInfo.Type.delimDelimType;
          return true;
        }
        if (c1 < SET + Syntax.nSet) {
          t.set = c1 - SET;
          t.type = TokenInfo.Type.delimSetType;
          return true;
        }
        throw new Error('Invalid token table entry');
      }
      this.index_++;
    }
    return false;
  }

  includesShortref(): Boolean {
    return this.mode_ >= minShortrefMode;
  }
}
