// Copyright (c) 1996, 1997 James Clark
// See the file copying.txt for copying permission.

// RtfFOTBuilder - RTF backend for OpenJade
// Faithful port from upstream openjade/jade/RtfFOTBuilder.cxx

import { Char, StringC } from '@openjade-js/opensp';
import { NodePtr, AccessResult } from '../grove/Node';
import {
  SerialFOTBuilder,
  FOTBuilder,
  Symbol,
  Length,
  LengthSpec,
  OptLengthSpec,
  Letter2,
  DeviceRGBColor,
  CharacterNIC,
  DisplayNIC,
  ParagraphNIC,
  DisplayGroupNIC,
  ExternalGraphicNIC,
  BoxNIC,
  RuleNIC,
  LeaderNIC,
  LineFieldNIC,
  TableNIC,
  TablePartNIC,
  TableColumnNIC,
  TableCellNIC,
  GridNIC,
  GridCellNIC,
  Address,
  HF,
  TableLengthSpec,
  GlyphSubstTable
} from './FOTBuilder';
import { FOTBuilderExtension } from './StyleEngine';

// ============================================================================
// Constants (matching upstream)
// ============================================================================

const DEFAULT_LANG = 0x400;
const SYMBOL_FONT_PAGE = 0xf000;
const CHAR_TABLE_CHAR_BITS = 16;
const CHAR_TABLE_SYMBOL_FLAG = (1 << 31) >>> 0;  // unsigned
const CHAR_TABLE_DB_FLAG = (1 << 30) >>> 0;

// Use a line-spacing of 12pt for the header and footer
// and assume 2.5pt of it occur after the baseline.
const hfPreSpace = 190;
const hfPostSpace = 50;

// ============================================================================
// Enums (matching upstream)
// ============================================================================

enum InlineState {
  inlineFirst = 0,     // never had an inline FO
  inlineStart = 1,     // must emit \par before next inline FO
  inlineField = 2,     // in a line field
  inlineFieldEnd = 3,  // in a line field with align=end
  inlineMiddle = 4,    // had some inline FOs
  inlineTable = 5      // just after \row
}

enum UnderlineType {
  noUnderline = 0,
  underlineSingle = 1,
  underlineDouble = 2,
  underlineWords = 3
}

enum BreakType {
  breakNone = 0,
  breakPage = 1,
  breakColumn = 2
}

enum RTFVersion {
  word95 = 0,
  word97 = 1
}

enum MathSpecial {
  mathNormal = 0,
  mathFence = 1,
  mathIntegral = 2
}

enum GridPosType {
  gridPosRowMajor = 0,
  gridPosColumnMajor = 1,
  gridPosExplicit = 2
}

// Border indices
const topBorder = 0;
const bottomBorder = 1;
const leftBorder = 2;
const rightBorder = 3;

// Widow/orphan control flags
const widowControl = 0x01;
const orphanControl = 0x02;

// ============================================================================
// Windows Charset Data (matching upstream exactly)
// ============================================================================

interface WinCharset {
  charsetCode: number;
  fontSuffix: string;
  mapping: number[];  // 128 entries for 0x80-0xFF
}

const jisCharset = 5;
const nWinCharsets = 7;

const winCharsets: WinCharset[] = [
  // CP 1252 (Western European)
  { charsetCode: 0, fontSuffix: '', mapping: [
    0x0000, 0x0000, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
    0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x0000, 0x0000, 0x0000,
    0x0000, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x0000, 0x0000, 0x0178,
    0x00a0, 0x00a1, 0x00a2, 0x00a3, 0x00a4, 0x00a5, 0x00a6, 0x00a7,
    0x00a8, 0x00a9, 0x00aa, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x00af,
    0x00b0, 0x00b1, 0x00b2, 0x00b3, 0x00b4, 0x00b5, 0x00b6, 0x00b7,
    0x00b8, 0x00b9, 0x00ba, 0x00bb, 0x00bc, 0x00bd, 0x00be, 0x00bf,
    0x00c0, 0x00c1, 0x00c2, 0x00c3, 0x00c4, 0x00c5, 0x00c6, 0x00c7,
    0x00c8, 0x00c9, 0x00ca, 0x00cb, 0x00cc, 0x00cd, 0x00ce, 0x00cf,
    0x00d0, 0x00d1, 0x00d2, 0x00d3, 0x00d4, 0x00d5, 0x00d6, 0x00d7,
    0x00d8, 0x00d9, 0x00da, 0x00db, 0x00dc, 0x00dd, 0x00de, 0x00df,
    0x00e0, 0x00e1, 0x00e2, 0x00e3, 0x00e4, 0x00e5, 0x00e6, 0x00e7,
    0x00e8, 0x00e9, 0x00ea, 0x00eb, 0x00ec, 0x00ed, 0x00ee, 0x00ef,
    0x00f0, 0x00f1, 0x00f2, 0x00f3, 0x00f4, 0x00f5, 0x00f6, 0x00f7,
    0x00f8, 0x00f9, 0x00fa, 0x00fb, 0x00fc, 0x00fd, 0x00fe, 0x00ff
  ]},
  // CP 1250 (Central European)
  { charsetCode: 238, fontSuffix: ' CE', mapping: [
    0x0000, 0x0000, 0x201a, 0x0000, 0x201e, 0x2026, 0x2020, 0x2021,
    0x0000, 0x2030, 0x0160, 0x2039, 0x015a, 0x0164, 0x017d, 0x0179,
    0x0000, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x0000, 0x2122, 0x0161, 0x203a, 0x015b, 0x0165, 0x017e, 0x017a,
    0x00a0, 0x02c7, 0x02d8, 0x0141, 0x00a4, 0x0104, 0x00a6, 0x00a7,
    0x00a8, 0x00a9, 0x015e, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x017b,
    0x00b0, 0x00b1, 0x02db, 0x0142, 0x00b4, 0x00b5, 0x00b6, 0x00b7,
    0x00b8, 0x0105, 0x015f, 0x00bb, 0x013d, 0x02dd, 0x013e, 0x017c,
    0x0154, 0x00c1, 0x00c2, 0x0102, 0x00c4, 0x0139, 0x0106, 0x00c7,
    0x010c, 0x00c9, 0x0118, 0x00cb, 0x011a, 0x00cd, 0x00ce, 0x010e,
    0x0110, 0x0143, 0x0147, 0x00d3, 0x00d4, 0x0150, 0x00d6, 0x00d7,
    0x0158, 0x016e, 0x00da, 0x0170, 0x00dc, 0x00dd, 0x0162, 0x00df,
    0x0155, 0x00e1, 0x00e2, 0x0103, 0x00e4, 0x013a, 0x0107, 0x00e7,
    0x010d, 0x00e9, 0x0119, 0x00eb, 0x011b, 0x00ed, 0x00ee, 0x010f,
    0x0111, 0x0144, 0x0148, 0x00f3, 0x00f4, 0x0151, 0x00f6, 0x00f7,
    0x0159, 0x016f, 0x00fa, 0x0171, 0x00fc, 0x00fd, 0x0163, 0x02d9
  ]},
  // CP 1251 (Cyrillic)
  { charsetCode: 204, fontSuffix: ' CYR', mapping: [
    0x0402, 0x0403, 0x201a, 0x0453, 0x201e, 0x2026, 0x2020, 0x2021,
    0x0000, 0x2030, 0x0409, 0x2039, 0x040a, 0x040c, 0x040b, 0x040f,
    0x0452, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x0000, 0x2122, 0x0459, 0x203a, 0x045a, 0x045c, 0x045b, 0x045f,
    0x00a0, 0x040e, 0x045e, 0x0408, 0x00a4, 0x0490, 0x00a6, 0x00a7,
    0x0401, 0x00a9, 0x0404, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x0407,
    0x00b0, 0x00b1, 0x0406, 0x0456, 0x0491, 0x00b5, 0x00b6, 0x00b7,
    0x0451, 0x2116, 0x0454, 0x00bb, 0x0458, 0x0405, 0x0455, 0x0457,
    0x0410, 0x0411, 0x0412, 0x0413, 0x0414, 0x0415, 0x0416, 0x0417,
    0x0418, 0x0419, 0x041a, 0x041b, 0x041c, 0x041d, 0x041e, 0x041f,
    0x0420, 0x0421, 0x0422, 0x0423, 0x0424, 0x0425, 0x0426, 0x0427,
    0x0428, 0x0429, 0x042a, 0x042b, 0x042c, 0x042d, 0x042e, 0x042f,
    0x0430, 0x0431, 0x0432, 0x0433, 0x0434, 0x0435, 0x0436, 0x0437,
    0x0438, 0x0439, 0x043a, 0x043b, 0x043c, 0x043d, 0x043e, 0x043f,
    0x0440, 0x0441, 0x0442, 0x0443, 0x0444, 0x0445, 0x0446, 0x0447,
    0x0448, 0x0449, 0x044a, 0x044b, 0x044c, 0x044d, 0x044e, 0x044f
  ]},
  // CP 1253 (Greek)
  { charsetCode: 161, fontSuffix: ' Greek', mapping: [
    0x0000, 0x0000, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
    0x0000, 0x2030, 0x0000, 0x2039, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x0000, 0x2122, 0x0000, 0x203a, 0x0000, 0x0000, 0x0000, 0x0000,
    0x00a0, 0x0385, 0x0386, 0x00a3, 0x00a4, 0x00a5, 0x00a6, 0x00a7,
    0x00a8, 0x00a9, 0x0000, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x2015,
    0x00b0, 0x00b1, 0x00b2, 0x00b3, 0x0384, 0x00b5, 0x00b6, 0x00b7,
    0x0388, 0x0389, 0x038a, 0x00bb, 0x038c, 0x00bd, 0x038e, 0x038f,
    0x0390, 0x0391, 0x0392, 0x0393, 0x0394, 0x0395, 0x0396, 0x0397,
    0x0398, 0x0399, 0x039a, 0x039b, 0x039c, 0x039d, 0x039e, 0x039f,
    0x03a0, 0x03a1, 0x0000, 0x03a3, 0x03a4, 0x03a5, 0x03a6, 0x03a7,
    0x03a8, 0x03a9, 0x03aa, 0x03ab, 0x03ac, 0x03ad, 0x03ae, 0x03af,
    0x03b0, 0x03b1, 0x03b2, 0x03b3, 0x03b4, 0x03b5, 0x03b6, 0x03b7,
    0x03b8, 0x03b9, 0x03ba, 0x03bb, 0x03bc, 0x03bd, 0x03be, 0x03bf,
    0x03c0, 0x03c1, 0x03c2, 0x03c3, 0x03c4, 0x03c5, 0x03c6, 0x03c7,
    0x03c8, 0x03c9, 0x03ca, 0x03cb, 0x03cc, 0x03cd, 0x03ce, 0x0000
  ]},
  // CP 1254 (Turkish)
  { charsetCode: 162, fontSuffix: ' TUR', mapping: [
    0x0000, 0x0000, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
    0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x0000, 0x0000, 0x0000,
    0x0000, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x0000, 0x0000, 0x0178,
    0x00a0, 0x00a1, 0x00a2, 0x00a3, 0x00a4, 0x00a5, 0x00a6, 0x00a7,
    0x00a8, 0x00a9, 0x00aa, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x00af,
    0x00b0, 0x00b1, 0x00b2, 0x00b3, 0x00b4, 0x00b5, 0x00b6, 0x00b7,
    0x00b8, 0x00b9, 0x00ba, 0x00bb, 0x00bc, 0x00bd, 0x00be, 0x00bf,
    0x00c0, 0x00c1, 0x00c2, 0x00c3, 0x00c4, 0x00c5, 0x00c6, 0x00c7,
    0x00c8, 0x00c9, 0x00ca, 0x00cb, 0x00cc, 0x00cd, 0x00ce, 0x00cf,
    0x011e, 0x00d1, 0x00d2, 0x00d3, 0x00d4, 0x00d5, 0x00d6, 0x00d7,
    0x00d8, 0x00d9, 0x00da, 0x00db, 0x00dc, 0x0130, 0x015e, 0x00df,
    0x00e0, 0x00e1, 0x00e2, 0x00e3, 0x00e4, 0x00e5, 0x00e6, 0x00e7,
    0x00e8, 0x00e9, 0x00ea, 0x00eb, 0x00ec, 0x00ed, 0x00ee, 0x00ef,
    0x011f, 0x00f1, 0x00f2, 0x00f3, 0x00f4, 0x00f5, 0x00f6, 0x00f7,
    0x00f8, 0x00f9, 0x00fa, 0x00fb, 0x00fc, 0x0131, 0x015f, 0x00ff
  ]},
  // Shift JIS Katakana
  { charsetCode: 128, fontSuffix: '', mapping: [
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0xff61, 0xff62, 0xff63, 0xff64, 0xff65, 0xff66, 0xff67,
    0xff68, 0xff69, 0xff6a, 0xff6b, 0xff6c, 0xff6d, 0xff6e, 0xff6f,
    0xff70, 0xff71, 0xff72, 0xff73, 0xff74, 0xff75, 0xff76, 0xff77,
    0xff78, 0xff79, 0xff7a, 0xff7b, 0xff7c, 0xff7d, 0xff7e, 0xff7f,
    0xff80, 0xff81, 0xff82, 0xff83, 0xff84, 0xff85, 0xff86, 0xff87,
    0xff88, 0xff89, 0xff8a, 0xff8b, 0xff8c, 0xff8d, 0xff8e, 0xff8f,
    0xff90, 0xff91, 0xff92, 0xff93, 0xff94, 0xff95, 0xff96, 0xff97,
    0xff98, 0xff99, 0xff9a, 0xff9b, 0xff9c, 0xff9d, 0xff9e, 0xff9f,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000
  ]},
  // Symbol charset (treated specially, must be last)
  { charsetCode: 2, fontSuffix: '', mapping: [] }
];

// ============================================================================
// Symbol Font Data (matching upstream exactly)
// ============================================================================

interface SymbolFont {
  name: string;
  mapping: number[];  // 256 entries
}

const nSymbolFonts = 3;

const symbolFonts: SymbolFont[] = [
  { name: 'Symbol', mapping: [
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0020, 0x0021, 0x2200, 0x0023, 0x2203, 0x0025, 0x0026, 0x220B,
    0x0028, 0x0029, 0x2217, 0x002B, 0x002C, 0x2212, 0x002E, 0x002F,
    0x0030, 0x0031, 0x0032, 0x0033, 0x0034, 0x0035, 0x0036, 0x0037,
    0x0038, 0x0039, 0x003A, 0x003B, 0x003C, 0x003D, 0x003E, 0x003F,
    0x2245, 0x0391, 0x0392, 0x03A7, 0x2206, 0x0395, 0x03A6, 0x0393,
    0x0397, 0x0399, 0x03D1, 0x039A, 0x039B, 0x039C, 0x039D, 0x039F,
    0x03A0, 0x0398, 0x03A1, 0x03A3, 0x03A4, 0x03A5, 0x03C2, 0x2126,
    0x039E, 0x03A8, 0x0396, 0x005B, 0x2234, 0x005D, 0x22A5, 0x005F,
    0x203E, 0x03B1, 0x03B2, 0x03C7, 0x03B4, 0x03B5, 0x03C6, 0x03B3,
    0x03B7, 0x03B9, 0x03D5, 0x03BA, 0x03BB, 0x03BC, 0x03BD, 0x03BF,
    0x03C0, 0x03B8, 0x03C1, 0x03C3, 0x03C4, 0x03C5, 0x03D6, 0x03C9,
    0x03BE, 0x03C8, 0x03B6, 0x007B, 0x007C, 0x007D, 0x223C, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x03D2, 0x2032, 0x2264, 0x2215, 0x221E, 0x0192, 0x2663,
    0x2666, 0x2665, 0x2660, 0x2194, 0x2190, 0x2191, 0x2192, 0x2193,
    0x00B0, 0x00B1, 0x2033, 0x2265, 0x00D7, 0x221D, 0x2202, 0x2022,
    0x00F7, 0x2260, 0x2261, 0x2248, 0x2026, 0x0000, 0x0000, 0x21B5,
    0x2135, 0x2111, 0x211C, 0x2118, 0x2297, 0x2295, 0x2205, 0x2229,
    0x222A, 0x2283, 0x2287, 0x2284, 0x2282, 0x2286, 0x2208, 0x2209,
    0x2220, 0x2207, 0x00AE, 0x00A9, 0x2122, 0x220F, 0x221A, 0x22C5,
    0x00AC, 0x2227, 0x2228, 0x21D4, 0x21D0, 0x21D1, 0x21D2, 0x21D3,
    0x25CA, 0x2329, 0x00AE, 0x00A9, 0x2122, 0x2211, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x232A, 0x222B, 0x2320, 0x0000, 0x2321, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000
  ]},
  { name: 'Wingdings', mapping: [
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x2702, 0x2701, 0x0000, 0x0000, 0x0000, 0x0000,
    0x260e, 0x2706, 0x2709, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x2328,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x2707, 0x270d,
    0x0000, 0x270c, 0x0000, 0x0000, 0x0000, 0x261c, 0x261e, 0x261d,
    0x261f, 0x0000, 0x263a, 0x0000, 0x2639, 0x0000, 0x2620, 0x0000,
    0x0000, 0x2708, 0x263c, 0x0000, 0x2744, 0x0000, 0x271e, 0x0000,
    0x2720, 0x2721, 0x262a, 0x262f, 0x0950, 0x2638, 0x2648, 0x2649,
    0x264a, 0x264b, 0x264c, 0x264d, 0x264e, 0x264f, 0x2650, 0x2651,
    0x2652, 0x2653, 0x0000, 0x0000, 0x25cf, 0x274d, 0x25a0, 0x25a1,
    0x0000, 0x2751, 0x2752, 0x0000, 0x0000, 0x25c6, 0x2756, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x2780, 0x2781, 0x2782, 0x2783, 0x2784, 0x2785, 0x2786,
    0x2787, 0x2788, 0x2789, 0x0000, 0x278a, 0x278b, 0x278c, 0x278d,
    0x278e, 0x278f, 0x2790, 0x2791, 0x2792, 0x2793, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x25cb, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x25aa,
    0x0000, 0x0000, 0x2726, 0x2605, 0x2736, 0x0000, 0x2739, 0x0000,
    0x0000, 0x0000, 0x2727, 0x0000, 0x0000, 0x272a, 0x2730, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x232b, 0x2326, 0x0000,
    0x27a2, 0x0000, 0x0000, 0x0000, 0x27b2, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x25ab, 0x2718, 0x2714, 0x2612, 0x2611, 0x0000
  ]},
  { name: 'ZapfDingbats', mapping: [
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x2701, 0x2702, 0x2703, 0x2704, 0x260E, 0x2706, 0x2707,
    0x2708, 0x2709, 0x261B, 0x261E, 0x270C, 0x270D, 0x270E, 0x270F,
    0x2710, 0x2711, 0x2712, 0x2713, 0x2714, 0x2715, 0x2716, 0x2717,
    0x2718, 0x2719, 0x271A, 0x271B, 0x271C, 0x271D, 0x271E, 0x271F,
    0x2720, 0x2721, 0x2722, 0x2723, 0x2724, 0x2725, 0x2726, 0x2727,
    0x2605, 0x2729, 0x272A, 0x272B, 0x272C, 0x272D, 0x272E, 0x272F,
    0x2730, 0x2731, 0x2732, 0x2733, 0x2734, 0x2735, 0x2736, 0x2737,
    0x2738, 0x2739, 0x273A, 0x273B, 0x273C, 0x273D, 0x273E, 0x273F,
    0x2740, 0x2741, 0x2742, 0x2743, 0x2744, 0x2745, 0x2746, 0x2747,
    0x2748, 0x2749, 0x274A, 0x274B, 0x0000, 0x274D, 0x25A0, 0x274F,
    0x2750, 0x2751, 0x2752, 0x25B2, 0x25BC, 0x25C6, 0x2756, 0x0000,
    0x2758, 0x2759, 0x275A, 0x275B, 0x275C, 0x275D, 0x275E, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x2761, 0x2762, 0x2763, 0x2764, 0x2765, 0x2766, 0x2767,
    0x2663, 0x2666, 0x2665, 0x2660, 0x2460, 0x2461, 0x2462, 0x2463,
    0x2464, 0x2465, 0x2466, 0x2467, 0x2468, 0x2469, 0x2776, 0x2777,
    0x2778, 0x2779, 0x277A, 0x277B, 0x277C, 0x277D, 0x277E, 0x277F,
    0x2780, 0x2781, 0x2782, 0x2783, 0x2784, 0x2785, 0x2786, 0x2787,
    0x2788, 0x2789, 0x278A, 0x278B, 0x278C, 0x278D, 0x278E, 0x278F,
    0x2790, 0x2791, 0x2792, 0x2793, 0x2794, 0x2192, 0x2194, 0x2195,
    0x2798, 0x2799, 0x279A, 0x279B, 0x279C, 0x279D, 0x279E, 0x279F,
    0x27A0, 0x27A1, 0x27A2, 0x27A3, 0x27A4, 0x27A5, 0x27A6, 0x27A7,
    0x27A8, 0x27A9, 0x27AA, 0x27AB, 0x27AC, 0x27AD, 0x27AE, 0x27AF,
    0x0000, 0x27B1, 0x27B2, 0x27B3, 0x27B4, 0x27B5, 0x27B6, 0x27B7,
    0x27B8, 0x27B9, 0x27BA, 0x27BB, 0x27BC, 0x27BD, 0x27BE, 0x0000
  ]}
];

// ============================================================================
// Helper Functions (matching upstream)
// ============================================================================

function points(n: Length): number {
  if (n >= 0) return Math.floor((n + 10) / 20);
  else return Math.floor((n - 10) / 20);
}

function halfPoints(n: number): number {
  return Math.floor(n / 10);
}

function hexChar(code: number): string {
  const hex = '0123456789abcdef';
  return "\\'" + hex[(code >> 4) & 0xf] + hex[code & 0xf];
}

// ============================================================================
// Format Structures (matching upstream exactly)
// ============================================================================

interface CommonFormat {
  isBold: boolean;
  isItalic: boolean;
  isSmallCaps: boolean;
  underline: UnderlineType;
  isStrikethrough: boolean;
  fontFamily: number;
  fontSize: number;
  color: number;
  charBackgroundColor: number;
  positionPointShift: number;
  language: number;
  country: number;
  kern: boolean;
  charBorder: boolean;
  charBorderColor: number;
  charBorderThickness: number;
  charBorderDouble: boolean;
}

function makeCommonFormat(): CommonFormat {
  return {
    isBold: false,
    isItalic: false,
    isSmallCaps: false,
    underline: UnderlineType.noUnderline,
    isStrikethrough: false,
    fontFamily: 0,
    fontSize: 24,  // 12 points
    color: 0,
    charBackgroundColor: 0,
    positionPointShift: 0,
    language: 0,
    country: 0,
    kern: false,
    charBorder: false,
    charBorderColor: 0,
    charBorderThickness: 0,
    charBorderDouble: false
  };
}

interface OutputFormat extends CommonFormat {
  charset: number;
  lang: number;        // the RTF language code
  langCharsets: number; // bitmap of charsets that can be used for the lang
}

function makeOutputFormat(): OutputFormat {
  return {
    ...makeCommonFormat(),
    charset: 0,
    lang: DEFAULT_LANG,
    langCharsets: 0x1f
  };
}

interface ParaFormat {
  leftIndent: number;
  rightIndent: number;
  firstLineIndent: number;
  lineSpacing: number;
  lineSpacingAtLeast: boolean;
  quadding: string;  // 'l', 'c', 'r', 'j'
  lines: Symbol;
  widowOrphanControl: number;
  headingLevel: number;
}

function makeParaFormat(): ParaFormat {
  return {
    leftIndent: 0,
    rightIndent: 0,
    firstLineIndent: 0,
    lineSpacing: 240,
    lineSpacingAtLeast: false,
    quadding: 'l',
    lines: Symbol.symbolWrap,
    widowOrphanControl: widowControl | orphanControl,
    headingLevel: 0
  };
}

interface Format extends ParaFormat, CommonFormat {
  hyphenate: boolean;
  fieldWidth: number;
  fieldAlign: Symbol;
  inputWhitespaceTreatment: Symbol;
  expandTabs: number;
  displayAlignment: string;  // 'l', 'c', 'r'
  lineThickness: number;
  lineDouble: boolean;
  scoreSpaces: boolean;
  boxHasBorder: boolean;
  boxHasBackground: boolean;
  backgroundColor: number;
  borderPresent: boolean;
  borderOmitAtBreak: boolean;
  cellBackground: boolean;
  borderPriority: number;
  cellTopMargin: number;
  cellBottomMargin: number;
  cellLeftMargin: number;
  cellRightMargin: number;
  cellVerticalAlignment: string;
  gridPosType: GridPosType;
  gridColumnAlignment: string;
  mathInline: boolean;
  mathPosture: boolean;
  superscriptHeight: number;
  subscriptDepth: number;
  overMarkHeight: number;
  underMarkDepth: number;
  gridRowSep: number;
  gridColumnSep: number;
  span: boolean;
  // LengthSpecs for display-size calculations
  positionPointShiftSpec: LengthSpec;
  leftIndentSpec: LengthSpec;
  rightIndentSpec: LengthSpec;
  firstLineIndentSpec: LengthSpec;
  lineSpacingSpec: LengthSpec;
  fieldWidthSpec: LengthSpec;
}

function makeFormat(): Format {
  return {
    ...makeParaFormat(),
    ...makeCommonFormat(),
    hyphenate: false,
    fieldWidth: 0,
    fieldAlign: Symbol.symbolStart,
    inputWhitespaceTreatment: Symbol.symbolPreserve,
    expandTabs: 8,
    displayAlignment: 'l',
    lineThickness: 20,
    lineDouble: false,
    scoreSpaces: true,
    boxHasBorder: true,
    boxHasBackground: false,
    backgroundColor: 0,
    borderPresent: true,
    borderOmitAtBreak: false,
    cellBackground: false,
    borderPriority: 0,
    cellTopMargin: 0,
    cellBottomMargin: 0,
    cellLeftMargin: 0,
    cellRightMargin: 0,
    cellVerticalAlignment: 't',
    gridPosType: GridPosType.gridPosRowMajor,
    gridColumnAlignment: 'c',
    mathInline: false,
    mathPosture: false,
    superscriptHeight: 5,
    subscriptDepth: 3,
    overMarkHeight: 10,
    underMarkDepth: 10,
    gridRowSep: 2,
    gridColumnSep: 2,
    span: false,
    positionPointShiftSpec: new LengthSpec(0),
    leftIndentSpec: new LengthSpec(0),
    rightIndentSpec: new LengthSpec(0),
    firstLineIndentSpec: new LengthSpec(0),
    lineSpacingSpec: new LengthSpec(240),
    fieldWidthSpec: new LengthSpec(0)
  };
}

interface PageFormat {
  pageWidth: number;
  pageHeight: number;
  leftMargin: number;
  rightMargin: number;
  headerMargin: number;
  footerMargin: number;
  topMargin: number;
  bottomMargin: number;
  pageNumberRestart: boolean;
  pageNumberFormat: string;
  nColumns: number;
  columnSep: number;
  balance: boolean;
}

function makePageFormat(): PageFormat {
  return {
    pageWidth: 72 * 10 * 17,   // 8.5 inches
    pageHeight: 72 * 20 * 11,  // 11 inches
    leftMargin: 0,
    rightMargin: 0,
    headerMargin: 0,
    footerMargin: 0,
    topMargin: 0,
    bottomMargin: 0,
    pageNumberRestart: false,
    pageNumberFormat: 'dec',
    nColumns: 1,
    columnSep: 72 * 10,
    balance: false
  };
}

// Display info for nested displayed flow objects
interface DisplayInfo {
  spaceAfter: number;
  keepWithNext: boolean;
  saveKeep: boolean;
  breakAfter: BreakType;
}

function makeDisplayInfo(): DisplayInfo {
  return {
    spaceAfter: 0,
    keepWithNext: false,
    saveKeep: false,
    breakAfter: BreakType.breakNone
  };
}

// Border structure for tables
interface Border {
  priority: number;
  flags: number;  // isPresent = 1, isDouble = 2, omitAtBreak = 4
  thickness: number;
  color: number;
}

const borderIsPresent = 0x01;
const borderIsDouble = 0x02;
const borderOmitAtBreak = 0x04;

function makeBorder(): Border {
  return {
    priority: 0,
    flags: 0,
    thickness: 0,
    color: 0
  };
}

// Table cell structure
interface Cell {
  present: boolean;
  hasBackground: boolean;
  backgroundColor: number;
  valign: string;
  content: string;
  span: number;
  vspan: number;
  border: Border[];
}

function makeCell(): Cell {
  return {
    present: false,
    hasBackground: false,
    backgroundColor: 0,
    valign: 't',
    content: '',
    span: 1,
    vspan: 1,
    border: [makeBorder(), makeBorder(), makeBorder(), makeBorder()]
  };
}

// Table column structure
interface Column {
  hasWidth: boolean;
  width: TableLengthSpec | null;
}

function makeColumn(): Column {
  return {
    hasWidth: false,
    width: null
  };
}

// Font family charsets
interface FontFamilyCharsets {
  rtfFontNumber: number[];  // nWinCharsets entries
}

function makeFontFamilyCharsets(): FontFamilyCharsets {
  const result: FontFamilyCharsets = { rtfFontNumber: [] };
  for (let i = 0; i < nWinCharsets; i++) {
    result.rtfFontNumber.push(-1);
  }
  return result;
}

// ============================================================================
// Factory Function
// ============================================================================

export function makeRtfFOTBuilder(
  outputCallback: (s: string) => void,
  flushCallback?: () => void,
  options?: string[],
  exts?: { value: FOTBuilderExtension[] | null }
): FOTBuilder {
  if (exts) {
    exts.value = [
      { name: 'UNREGISTERED::James Clark//Characteristic::page-n-columns' },
      { name: 'UNREGISTERED::James Clark//Characteristic::page-column-sep' },
      { name: 'UNREGISTERED::James Clark//Characteristic::page-balance-columns?' },
      { name: 'UNREGISTERED::James Clark//Characteristic::subscript-depth' },
      { name: 'UNREGISTERED::James Clark//Characteristic::superscript-height' },
      { name: 'UNREGISTERED::James Clark//Characteristic::over-mark-height' },
      { name: 'UNREGISTERED::James Clark//Characteristic::under-mark-depth' },
      { name: 'UNREGISTERED::James Clark//Characteristic::grid-row-sep' },
      { name: 'UNREGISTERED::James Clark//Characteristic::grid-column-sep' },
      { name: 'UNREGISTERED::James Clark//Characteristic::heading-level' }
    ];
  }
  return new RtfFOTBuilder(outputCallback, flushCallback, options || []);
}

// ============================================================================
// Main RtfFOTBuilder Class
// ============================================================================

export class RtfFOTBuilder extends SerialFOTBuilder {
  // Output streams
  private outputCallback_: (s: string) => void;
  private flushCallback_?: () => void;
  private tempos_: string = '';        // Temporary buffer for content
  private cellos_: string = '';        // Cell content buffer
  private fieldos_: string = '';       // Field content buffer
  private hfos_: string = '';          // Header/footer buffer
  private currentOs_: 'tempos' | 'cellos' | 'fieldos' | 'hfos' | 'nullos' = 'tempos';

  // Inline state
  private inlineState_: InlineState = InlineState.inlineFirst;
  private continuePar_: boolean = false;

  // Format state
  private outputFormat_: OutputFormat;
  private specFormat_: Format;
  private paraFormat_: ParaFormat;
  private paraStack_: ParaFormat[] = [];
  private displayStack_: DisplayInfo[] = [];
  private specFormatStack_: Format[] = [];

  // Page format
  private pageFormat_: PageFormat;
  private pageFormatStack_: PageFormat[] = [];

  // Accumulated space
  private accumSpace_: number = 0;
  private keepWithNext_: boolean = false;
  private hyphenateSuppressed_: boolean = false;
  private maxConsecHyphens_: number = 0;

  // Font handling
  private fontFamilyNameTable_: Map<string, number> = new Map();
  private fontFamilyCharsetsTable_: FontFamilyCharsets[] = [];
  private nextRtfFontNumber_: number = 1;

  // Color table
  private colorTable_: number[] = [];

  // Character table for mapping
  private charTable_: Map<number, number> = new Map();

  // Display size for LengthSpec calculations
  private displaySize_: number = 72 * 10 * 17;  // 8.5 inches

  // Box handling
  private displayBoxLevels_: number[] = [];
  private boxFirstPara_: boolean = false;
  private boxLeftSep_: number = 0;
  private boxRightSep_: number = 0;
  private boxTopSep_: number = 0;
  private accumSpaceBox_: number = 0;

  // Table handling
  private tableLevel_: number = 0;
  private tableWidth_: number = 0;
  private tableAlignment_: string = 'l';
  private tableDisplaySize_: number = 0;
  private tableLeftIndent_: number = 0;
  private tableRightIndent_: number = 0;
  private addLeftIndent_: number = 0;
  private addRightIndent_: number = 0;
  private tableBorder_: Border[] = [makeBorder(), makeBorder(), makeBorder(), makeBorder()];
  private cellIndex_: number = 0;
  private cells_: Cell[][] = [];
  private inTableHeader_: boolean = false;
  private nHeaderRows_: number = 0;
  private columns_: Column[] = [];

  // Field handling
  private fieldTabPos_: number = 0;

  // Section handling
  private hadSection_: boolean = false;
  private doBalance_: boolean = false;
  private spanDisplayLevels_: number = 0;
  private currentCols_: number = 1;
  private doBreak_: BreakType = BreakType.breakNone;

  // Keep handling
  private keep_: boolean = false;
  private hadParInKeep_: boolean = false;

  // Link handling
  private linkDepth_: number = 0;
  private pendingLink_: Address | null = null;
  private havePendingLink_: boolean = false;

  // Element/bookmark handling
  private pendingElements_: NodePtr[] = [];
  private pendingElementLevels_: number[] = [];
  private nPendingElementsNonEmpty_: number = 0;
  private suppressBookmarks_: boolean = false;
  private nodeLevel_: number = 0;

  // Simple page sequence
  private inSimplePageSequence_: number = 0;

  // Save formats
  private saveOutputFormat_: OutputFormat | null = null;
  private leaderSaveOutputFormat_: OutputFormat | null = null;

  // Whitespace handling
  private followWhitespaceChar_: boolean = false;
  private currentColumn_: number = 0;

  // Leader handling
  private leaderDepth_: number = 0;
  private preLeaderOs_: 'tempos' | 'cellos' | 'fieldos' | 'hfos' | 'nullos' = 'tempos';

  // Header/footer parts
  private hfPart_: string[] = [];

  // RTF version
  private rtfVersion_: RTFVersion = RTFVersion.word97;

  // Math handling
  private eqArgSep_: string = ',';
  private mathLevel_: number = 0;
  private mathSpecial_: MathSpecial = MathSpecial.mathNormal;
  private mathSaveOutputFormat_: OutputFormat | null = null;

  constructor(
    outputCallback: (s: string) => void,
    flushCallback?: () => void,
    options: string[] = []
  ) {
    super();
    this.outputCallback_ = outputCallback;
    this.flushCallback_ = flushCallback;

    // Initialize formats
    this.outputFormat_ = makeOutputFormat();
    this.specFormat_ = makeFormat();
    this.paraFormat_ = makeParaFormat();
    this.pageFormat_ = makePageFormat();

    // Set specFormat fontSize to 20 (10 points) - differs from outputFormat (24 = 12 points)
    this.specFormat_.fontSize = 20;

    // Initialize stacks
    this.specFormatStack_.push({ ...this.specFormat_ });
    this.pageFormatStack_.push({ ...this.pageFormat_ });

    // Initialize header/footer parts
    for (let i = 0; i < HF.nHF; i++) {
      this.hfPart_.push('');
    }

    // Initialize font table with Times New Roman
    this.fontFamilyNameTable_.set('Times New Roman', 0);
    for (let i = 0; i < 1 + nSymbolFonts; i++) {
      this.fontFamilyCharsetsTable_.push(makeFontFamilyCharsets());
    }
    this.fontFamilyCharsetsTable_[0].rtfFontNumber[0] = 0;

    // Initialize character table from codepage mappings
    this.initCharTable();

    // Initialize symbol font mappings
    this.initSymbolFonts();

    // Process options
    for (const opt of options) {
      if (opt === '95') {
        this.rtfVersion_ = RTFVersion.word95;
      }
    }
  }

  private initCharTable(): void {
    for (let i = 0; i < nWinCharsets; i++) {
      const charset = winCharsets[i];
      for (let j = 0; j < 128 && j < charset.mapping.length; j++) {
        const c = charset.mapping[j];
        if (c) {
          const existing = this.charTable_.get(c);
          if (!existing) {
            this.charTable_.set(c, (j + 0x80) | (1 << (i + CHAR_TABLE_CHAR_BITS)));
          } else if ((existing & ((1 << CHAR_TABLE_CHAR_BITS) - 1)) === (j + 0x80)) {
            this.charTable_.set(c, existing | (1 << (i + CHAR_TABLE_CHAR_BITS)));
          }
        }
      }
    }
  }

  private initSymbolFonts(): void {
    for (let i = 0; i < nSymbolFonts; i++) {
      const sf = symbolFonts[i];
      for (let j = 0; j < sf.mapping.length; j++) {
        const c = sf.mapping[j];
        if (c && !this.charTable_.has(c)) {
          this.charTable_.set(c, j | (i << CHAR_TABLE_CHAR_BITS) | CHAR_TABLE_SYMBOL_FLAG);
        }
      }
      this.fontFamilyNameTable_.set(sf.name, i + 1);
    }
  }

  // ============================================================================
  // Output Stream Management
  // ============================================================================

  private os(s: string): void {
    switch (this.currentOs_) {
      case 'tempos': this.tempos_ += s; break;
      case 'cellos': this.cellos_ += s; break;
      case 'fieldos': this.fieldos_ += s; break;
      case 'hfos': this.hfos_ += s; break;
      case 'nullos': break;  // Discard
    }
  }

  // Output directly to final output (bypassing temp buffer)
  private osFinal(s: string): void {
    this.outputCallback_(s);
  }

  // ============================================================================
  // FOTBuilder Interface - Core Methods (faithful port from upstream)
  // ============================================================================

  override start(): void {
    this.nPendingElementsNonEmpty_ = this.pendingElements_.length;
    this.specFormatStack_.push({ ...this.specFormat_ });
    if (!this.inSimplePageSequence_) {
      this.pageFormatStack_.push({ ...this.pageFormat_ });
    }
  }

  override end(): void {
    if (this.specFormatStack_.length > 1) {
      this.specFormatStack_.pop();
      this.specFormat_ = { ...this.specFormatStack_[this.specFormatStack_.length - 1] };
    }
    if (!this.inSimplePageSequence_ && this.pageFormatStack_.length > 1) {
      this.pageFormatStack_.pop();
      this.pageFormat_ = { ...this.pageFormatStack_[this.pageFormatStack_.length - 1] };
    }
  }

  override flush(): void {
    this.outputFinalRtf();
    if (this.flushCallback_) {
      this.flushCallback_();
    }
  }

  private outputFinalRtf(): void {
    // RTF header
    this.osFinal('{\\rtf1\\ansi\\deff0\n');

    // Font table
    this.osFinal('{\\fonttbl');
    for (const [name, idx] of this.fontFamilyNameTable_) {
      const charsets = this.fontFamilyCharsetsTable_[idx];
      if (charsets) {
        for (let i = 0; i < nWinCharsets; i++) {
          const fontNum = charsets.rtfFontNumber[i];
          if (fontNum >= 0) {
            const charsetCode = winCharsets[i].charsetCode;
            const fontSuffix = winCharsets[i].fontSuffix;
            this.osFinal(`{\\f${fontNum}\\fnil\\fcharset${charsetCode} ${name}${fontSuffix};}\n`);
          }
        }
      }
    }
    this.osFinal('}\n');

    // Color table
    this.osFinal('{\\colortbl;');
    for (const color of this.colorTable_) {
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      this.osFinal(`\\red${r}\\green${g}\\blue${b};`);
    }
    this.osFinal('}');

    // Stylesheet
    this.osFinal('{\\stylesheet');
    for (let i = 1; i <= 9; i++) {
      this.osFinal(`{\\s${i} Heading ${i};}`);
    }
    this.osFinal('}\n');

    // Document formatting
    if (this.maxConsecHyphens_ > 0) {
      this.osFinal(`\\hyphconsec${this.maxConsecHyphens_}`);
    }
    this.osFinal(`\\deflang${DEFAULT_LANG}\\notabind\\facingp\\hyphauto1\\widowctrl\n`);

    // Output buffered content
    this.osFinal(this.tempos_);

    // Close RTF document
    this.osFinal('}\n');
  }

  // ============================================================================
  // Character Format Synchronization (faithful port from upstream)
  // ============================================================================

  private syncCharFormat(): void {
    let changed = false;

    if (this.outputFormat_.isBold !== this.specFormat_.isBold) {
      this.os('\\b');
      if (!this.specFormat_.isBold) this.os('0');
      this.outputFormat_.isBold = this.specFormat_.isBold;
      changed = true;
    }

    if (this.outputFormat_.isItalic !== this.specFormat_.isItalic) {
      this.os('\\i');
      if (!this.specFormat_.isItalic) this.os('0');
      this.outputFormat_.isItalic = this.specFormat_.isItalic;
      changed = true;
    }

    if (this.outputFormat_.underline !== this.specFormat_.underline) {
      switch (this.specFormat_.underline) {
        case UnderlineType.noUnderline:
          this.os('\\ul0');
          break;
        case UnderlineType.underlineSingle:
          this.os('\\ul');
          break;
        case UnderlineType.underlineDouble:
          this.os('\\uldb');
          break;
        case UnderlineType.underlineWords:
          this.os('\\ulw');
          break;
      }
      this.outputFormat_.underline = this.specFormat_.underline;
      changed = true;
    }

    if (this.outputFormat_.isSmallCaps !== this.specFormat_.isSmallCaps) {
      this.os('\\scaps');
      if (!this.specFormat_.isSmallCaps) this.os('0');
      this.outputFormat_.isSmallCaps = this.specFormat_.isSmallCaps;
      changed = true;
    }

    if (this.outputFormat_.isStrikethrough !== this.specFormat_.isStrikethrough) {
      this.os('\\strike');
      if (!this.specFormat_.isStrikethrough) this.os('0');
      this.outputFormat_.isStrikethrough = this.specFormat_.isStrikethrough;
      changed = true;
    }

    if (this.outputFormat_.positionPointShift !== this.specFormat_.positionPointShift) {
      if (this.specFormat_.positionPointShift >= 0) {
        this.os(`\\up${this.specFormat_.positionPointShift}`);
      } else {
        this.os(`\\dn${-this.specFormat_.positionPointShift}`);
      }
      this.outputFormat_.positionPointShift = this.specFormat_.positionPointShift;
      changed = true;
    }

    if (this.outputFormat_.fontSize !== this.specFormat_.fontSize) {
      this.os(`\\fs${this.specFormat_.fontSize}`);
      this.outputFormat_.fontSize = this.specFormat_.fontSize;
      changed = true;
    }

    // Language handling would go here (convertLanguage)

    // Font family and charset handling
    const charsetOk = ((1 << this.outputFormat_.charset) & this.outputFormat_.langCharsets) !== 0;
    if (this.outputFormat_.fontFamily !== this.specFormat_.fontFamily || !charsetOk) {
      this.outputFormat_.fontFamily = this.specFormat_.fontFamily;
      // Find appropriate charset
      if (!charsetOk) {
        for (this.outputFormat_.charset = 0;
             !(this.outputFormat_.langCharsets & (1 << this.outputFormat_.charset));
             this.outputFormat_.charset++) {}
      }
      let n = this.fontFamilyCharsetsTable_[this.outputFormat_.fontFamily].rtfFontNumber[this.outputFormat_.charset];
      if (n < 0) {
        n = this.nextRtfFontNumber_++;
        this.fontFamilyCharsetsTable_[this.outputFormat_.fontFamily].rtfFontNumber[this.outputFormat_.charset] = n;
      }
      this.os(`\\f${n}`);
      changed = true;
    }

    if (this.outputFormat_.color !== this.specFormat_.color) {
      this.os(`\\cf${this.specFormat_.color}`);
      this.outputFormat_.color = this.specFormat_.color;
      changed = true;
    }

    if (this.outputFormat_.charBackgroundColor !== this.specFormat_.charBackgroundColor) {
      this.os(`\\highlight${this.specFormat_.charBackgroundColor}`);
      this.outputFormat_.charBackgroundColor = this.specFormat_.charBackgroundColor;
      changed = true;
    }

    // Character border
    if (this.specFormat_.charBorder) {
      if (!this.outputFormat_.charBorder
          || this.specFormat_.charBorderColor !== this.outputFormat_.charBorderColor
          || this.specFormat_.charBorderThickness !== this.outputFormat_.charBorderThickness
          || this.specFormat_.charBorderDouble !== this.outputFormat_.charBorderDouble) {
        this.outputFormat_.charBorder = true;
        this.os('\\chbrdr');
        if (this.specFormat_.charBorderDouble) {
          this.os('\\brdrdb');
        } else {
          this.os('\\brdrs');
        }
        this.os(`\\brdrw${this.specFormat_.charBorderThickness}`);
        if (this.specFormat_.charBorderColor) {
          this.os(`\\brdrcf${this.specFormat_.charBorderColor}`);
        }
        changed = true;
        this.outputFormat_.charBorderColor = this.specFormat_.charBorderColor;
        this.outputFormat_.charBorderThickness = this.specFormat_.charBorderThickness;
        this.outputFormat_.charBorderDouble = this.specFormat_.charBorderDouble;
      }
    } else {
      if (this.outputFormat_.charBorder) {
        this.os('\\chbrdr');
        changed = true;
        this.outputFormat_.charBorder = false;
      }
    }

    if (!this.specFormat_.hyphenate) {
      this.hyphenateSuppressed_ = true;
    }

    if (this.outputFormat_.kern !== this.specFormat_.kern) {
      this.os(`\\kerning${this.specFormat_.kern ? '1' : '0'}`);
      this.outputFormat_.kern = this.specFormat_.kern;
      changed = true;
    }

    if (changed) {
      this.os(' ');
    }
  }

  private setCharset(cs: number): void {
    this.outputFormat_.charset = cs;
    let n = this.fontFamilyCharsetsTable_[this.outputFormat_.fontFamily].rtfFontNumber[cs];
    if (n < 0) {
      n = this.nextRtfFontNumber_++;
      this.fontFamilyCharsetsTable_[this.outputFormat_.fontFamily].rtfFontNumber[cs] = n;
    }
    this.os(`\\f${n}`);
  }

  private symbolChar(ff: number, code: number): void {
    let n = this.fontFamilyCharsetsTable_[ff].rtfFontNumber[nWinCharsets - 1];
    if (n < 0) {
      n = this.nextRtfFontNumber_++;
      this.fontFamilyCharsetsTable_[ff].rtfFontNumber[nWinCharsets - 1] = n;
    }
    this.os(`{\\f${n}`);
    this.os(hexChar(code));
    this.os('}');
  }

  // ============================================================================
  // Inline Preparation (faithful port from upstream)
  // ============================================================================

  private inlinePrepare(): void {
    this.followWhitespaceChar_ = false;
    if (this.inlineState_ === InlineState.inlineMiddle
        || this.inlineState_ === InlineState.inlineField
        || this.inlineState_ === InlineState.inlineFieldEnd) {
      this.flushFields();
      return;
    }
    this.newPar();
    this.os(`\\sl${this.paraFormat_.lineSpacingAtLeast ? this.paraFormat_.lineSpacing : -this.paraFormat_.lineSpacing}`);
    const fli = this.continuePar_ ? 0 : this.paraFormat_.firstLineIndent;
    if (fli) {
      this.os(`\\fi${fli}`);
    }
    if (this.paraFormat_.quadding !== 'l') {
      this.os(`\\q${this.paraFormat_.quadding}`);
    }
    this.inlineState_ = InlineState.inlineMiddle;
    this.os(' ');
    this.flushFields();
  }

  private flushFields(): void {
    if (!this.suppressBookmarks_) {
      this.flushPendingElements();
    }
    if (this.havePendingLink_) {
      this.havePendingLink_ = false;
      if (this.pendingLink_) {
        this.doStartLink(this.pendingLink_);
      }
    }
  }

  private flushPendingElements(): void {
    for (const node of this.pendingElements_) {
      const idResult = node.node()?.getId();
      if (idResult && idResult.result === AccessResult.accessOK && idResult.str.size() > 0) {
        const g = node.node()?.groveIndex() ?? 0;
        const chars: number[] = [];
        for (let i = 0; i < idResult.str.size(); i++) {
          chars.push(idResult.str.get(i));
        }
        this.os('{\\*\\bkmkstart ');
        this.outputBookmarkNameFromId(g, chars, chars.length);
        this.os('}');
        this.os('{\\*\\bkmkend ');
        this.outputBookmarkNameFromId(g, chars, chars.length);
        this.os('}');
      }
      // Note: Index-based bookmarks are only needed for elements that are link targets
      // but don't have explicit IDs. Since we don't track link target registration,
      // we only output ID-based bookmarks which is sufficient for proper linking.
    }
    this.nPendingElementsNonEmpty_ = 0;
    this.pendingElements_.length = 0;
    this.pendingElementLevels_.length = 0;
  }

  // Output bookmark name from ID string
  private outputBookmarkNameFromId(groveIndex: number, chars: number[], size: number): void {
    this.os('ID');
    if (groveIndex) {
      this.os(groveIndex.toString());
    }
    this.os('_');
    for (let i = 0; i < size; i++) {
      const c = chars[i];
      // Only output alphanumeric and underscore characters
      if ((c >= 0x30 && c <= 0x39) ||  // 0-9
          (c >= 0x41 && c <= 0x5a) ||  // A-Z
          (c >= 0x61 && c <= 0x7a) ||  // a-z
          c === 0x5f) {  // _
        this.os(String.fromCharCode(c));
      } else {
        // Encode non-alphanumeric as _N_ (decimal)
        this.os('_');
        this.os(c.toString());
        this.os('_');
      }
    }
  }

  // Output bookmark name from element index
  private outputBookmarkNameFromIndex(groveIndex: number, elementIndex: number): void {
    this.os(this.rtfVersion_ >= RTFVersion.word97 ? '_' : 'E_');
    if (groveIndex) {
      this.os(groveIndex.toString());
      this.os('_');
    }
    this.os(elementIndex.toString());
  }

  // Helper to output idref-based hyperlink button
  private idrefButton(groveIndex: number, chars: number[], size: number): void {
    this.os('{\\field');
    this.os('{\\*\\fldinst   ');  // trailing spaces required!
    this.os(this.rtfVersion_ >= RTFVersion.word97 ? 'HYPERLINK  \\\\l ' : 'GOTOBUTTON ');
    this.outputBookmarkNameFromId(groveIndex, chars, size);
    if (this.rtfVersion_ >= RTFVersion.word97) {
      this.os('}{\\fldrslt');
    }
    this.os(' ');
  }

  private doStartLink(addr: Address): void {
    switch (addr.type) {
      case Address.Type.resolvedNode: {
        const node = addr.node?.node();
        if (!node) {
          this.os('{{');
          break;
        }
        const idResult = node.getId();
        if (idResult.result === AccessResult.accessOK && idResult.str.size() > 0) {
          // Node has an ID - use it
          const chars: number[] = [];
          for (let i = 0; i < idResult.str.size(); i++) {
            chars.push(idResult.str.get(i));
          }
          this.idrefButton(node.groveIndex(), chars, chars.length);
        } else {
          // Try element index
          const elemResult = node.elementIndex();
          if (elemResult.result === AccessResult.accessOK) {
            this.os('{\\field');
            this.os('{\\*\\fldinst   ');  // trailing spaces required!
            this.os(this.rtfVersion_ >= RTFVersion.word97 ? 'HYPERLINK  \\\\l ' : 'GOTOBUTTON ');
            this.outputBookmarkNameFromIndex(node.groveIndex(), elemResult.index);
            this.os(' ');
            if (this.rtfVersion_ >= RTFVersion.word97) {
              this.os('}{\\fldrslt ');
            }
          } else {
            this.os('{{');
          }
        }
        break;
      }
      case Address.Type.idref: {
        const id = addr.params[0];
        // Convert StyleString to char array
        const chars: number[] = [];
        let size = 0;
        if (typeof id === 'string') {
          for (let i = 0; i < id.length; i++) {
            const c = id.charCodeAt(i);
            if (c === 0x20) break;  // Space terminates ID (multiple IDs)
            chars.push(c);
            size++;
          }
        }
        const groveIdx = addr.node?.node()?.groveIndex() ?? 0;
        this.idrefButton(groveIdx, chars, size);
        break;
      }
      default:
        this.os('{{');
        break;
    }
    this.saveOutputFormat_ = { ...this.outputFormat_ };
  }

  // ============================================================================
  // New Paragraph (faithful port from upstream)
  // ============================================================================

  private newPar(allowSpaceBefore: boolean = true): void {
    let boxExtraTopSep = 0;
    if (this.boxFirstPara_) {
      this.boxFirstPara_ = false;
      this.boxLeftSep_ = this.paraFormat_.leftIndent;
      this.boxRightSep_ = this.paraFormat_.rightIndent;
      for (let i = 1; i < this.displayBoxLevels_.length; i++) {
        this.boxLeftSep_ += this.specFormatStack_[this.displayBoxLevels_[i]].leftIndent;
        this.boxRightSep_ += this.specFormatStack_[this.displayBoxLevels_[i]].rightIndent;
      }
      this.boxTopSep_ = this.accumSpace_;
      this.accumSpace_ = this.accumSpaceBox_;
      this.accumSpaceBox_ = 0;
    }

    if (this.inlineState_ !== InlineState.inlineFirst) {
      if (!allowSpaceBefore) {
        this.os(`\\sa${this.accumSpace_}`);
        this.accumSpace_ = 0;
      }
      if (this.keep_) {
        if (this.hadParInKeep_ || this.continuePar_) {
          this.keepWithNext_ = true;
        }
        this.hadParInKeep_ = true;
      }
      if (!this.doBreak_ && this.keepWithNext_) {
        this.os('\\keepn');
      }
      this.keepWithNext_ = false;
      if (this.hyphenateSuppressed_) {
        this.os('\\hyphpar0');
        this.hyphenateSuppressed_ = false;
      }
      this.os('\\par');
    }

    switch (this.doBreak_) {
      case BreakType.breakPage:
        this.os('\\page');
        this.doBreak_ = BreakType.breakNone;
        break;
      case BreakType.breakColumn:
        this.os('\\column');
        this.doBreak_ = BreakType.breakNone;
        break;
    }

    // Column handling
    if (this.currentCols_ > 1) {
      if (this.spanDisplayLevels_) {
        this.os('\\sect\\sbknone\\cols1');
        this.currentCols_ = 1;
      }
    } else if (this.spanDisplayLevels_ === 0 && this.currentCols_ === 1 && this.pageFormat_.nColumns > 1) {
      if (this.inlineState_ !== InlineState.inlineFirst) {
        this.os('\\sect\\sbknone');
      }
      this.os(`\\cols${this.pageFormat_.nColumns}\\colsx${this.pageFormat_.columnSep}`);
      this.currentCols_ = this.pageFormat_.nColumns;
    }

    this.os('\\pard');
    if (this.tableLevel_) {
      this.os('\\intbl');
    }
    if (this.accumSpace_) {
      this.os(`\\sb${this.accumSpace_}`);
      this.accumSpace_ = 0;
    }
    if (this.keep_) {
      this.os('\\keep');
    }
    if (!this.paraFormat_.widowOrphanControl) {
      this.os('\\nowidctlpar');
    }
    if (this.paraFormat_.headingLevel) {
      this.os(`\\s${this.paraFormat_.headingLevel}`);
    }

    // Box border handling
    if (this.displayBoxLevels_.length > 0) {
      const boxFormat = this.specFormatStack_[this.displayBoxLevels_[0]];
      const sides = 'tlbr';
      for (let si = 0; si < 4; si++) {
        const s = sides[si];
        this.os(`\\brdr${s}`);
        if (boxFormat.lineThickness > 75) {
          this.os(`\\brdrth\\brdrw${Math.floor(boxFormat.lineThickness / 2)}`);
        } else {
          if (boxFormat.lineDouble) {
            this.os('\\brdrdb');
          } else {
            this.os('\\brdrs');
          }
          this.os(`\\brdrw${boxFormat.lineThickness}`);
        }
        let sep: number;
        switch (s) {
          case 't': sep = this.boxTopSep_; break;
          case 'l': sep = this.boxLeftSep_; break;
          case 'r': sep = this.boxRightSep_; break;
          default: sep = 0; break;
        }
        this.os(`\\brsp${sep}`);
        if (boxFormat.color) {
          this.os(`\\brdrcf${boxFormat.color}`);
        }
        if (this.boxLeftSep_ + boxFormat.leftIndent + this.addLeftIndent_) {
          this.os(`\\li${this.boxLeftSep_ + boxFormat.leftIndent + this.addLeftIndent_}`);
        }
        if (this.boxRightSep_ + boxFormat.rightIndent + this.addRightIndent_) {
          this.os(`\\ri${this.boxRightSep_ + boxFormat.rightIndent + this.addRightIndent_}`);
        }
      }
    } else {
      if (this.paraFormat_.leftIndent || this.addLeftIndent_) {
        this.os(`\\li${this.paraFormat_.leftIndent + this.addLeftIndent_}`);
      }
      if (this.paraFormat_.rightIndent || this.addRightIndent_) {
        this.os(`\\ri${this.paraFormat_.rightIndent + this.addRightIndent_}`);
      }
    }
  }

  // ============================================================================
  // Character Output (faithful port from upstream)
  // ============================================================================

  override characters(s: Uint32Array, n: number): void {
    // Ignore record ends at the start of continuation paragraphs
    let start = 0;
    if (this.continuePar_
        && (this.inlineState_ === InlineState.inlineStart || this.inlineState_ === InlineState.inlineFirst)
        && this.paraFormat_.lines === Symbol.symbolWrap) {
      while (start < n && s[start] === 0x0d) {
        start++;
      }
      if (start === n) return;
    }

    if (this.inlineState_ !== InlineState.inlineMiddle) {
      this.inlinePrepare();
    } else {
      this.flushFields();
    }
    this.syncCharFormat();

    // Math integral handling
    if (this.mathLevel_ && this.mathSpecial_ === MathSpecial.mathIntegral && n > start) {
      switch (s[start]) {
        case 0x222b: // integral
          return;
        case 0x2211: // sum
          this.os('\\\\su');
          return;
        case 0x220f: // product
          this.os('\\\\pr');
          return;
        default:
          this.os('\\\\vc\\\\');
          break;
      }
    }

    for (let i = start; i < n; i++) {
      const c = s[i];
      const prevWhitespaceChar = this.followWhitespaceChar_;
      this.followWhitespaceChar_ = false;
      this.currentColumn_++;

      switch (c) {
        case 0x0a: // LF - ignore
          this.currentColumn_--;
          this.followWhitespaceChar_ = prevWhitespaceChar;
          break;

        case 0x0d: // CR
          this.followWhitespaceChar_ = true;
          switch (this.paraFormat_.lines) {
            case Symbol.symbolNone:
            case Symbol.symbolWrap:
              switch (this.specFormat_.inputWhitespaceTreatment) {
                case Symbol.symbolIgnore:
                  this.currentColumn_--;
                  break;
                case Symbol.symbolCollapse:
                  if (prevWhitespaceChar) {
                    this.currentColumn_--;
                    break;
                  }
                  // fall through
                default:
                  this.os(' ');
              }
              break;
            default:
              this.os('\\sa0\\par\\fi0\\sb0\n');
              this.currentColumn_ = 0;
              break;
          }
          break;

        case 0x09: // Tab
          if (this.specFormat_.expandTabs && this.specFormat_.inputWhitespaceTreatment === Symbol.symbolPreserve) {
            let col = this.currentColumn_ - 1 + this.specFormat_.expandTabs;
            col = Math.floor(col / this.specFormat_.expandTabs) * this.specFormat_.expandTabs;
            for (; this.currentColumn_ < col; this.currentColumn_++) {
              this.os(' ');
            }
            this.followWhitespaceChar_ = true;
            break;
          }
          // fall through
        case 0x20: // Space
          this.followWhitespaceChar_ = true;
          switch (this.specFormat_.inputWhitespaceTreatment) {
            case Symbol.symbolIgnore:
              this.currentColumn_--;
              break;
            case Symbol.symbolCollapse:
              if (prevWhitespaceChar) {
                this.currentColumn_--;
                break;
              }
              // fall through
            default:
              this.os(' ');
          }
          break;

        case 0x2002: // en space
          this.os("\\u8194\\'20");
          break;

        case 0x2003: // em space
          this.os("\\u8195\\'20");
          break;

        case 0x2010: // hyphen
          this.os('-');
          break;

        case 0x2011: // non-breaking hyphen
          this.os('\\_');
          break;

        case 0x200c: // zero width non-joiner
          this.os('\\zwnj ');
          break;

        case 0x200d: // zero width joiner
          this.os('\\zwj ');
          break;

        case 0xa0: // non-breaking space
          this.os('\\~');
          break;

        case 0xad: // soft hyphen
          this.os('\\-');
          break;

        case 0x00: // null
          break;

        case 0x3b: // semicolon
        case 0x2c: // comma
          if (this.mathLevel_ && String.fromCharCode(c) === this.eqArgSep_ && this.mathSpecial_ === MathSpecial.mathNormal) {
            this.os('\\\\');
          }
          this.os(String.fromCharCode(c));
          break;

        case 0x28: // (
        case 0x29: // )
          if (this.mathLevel_ && this.mathSpecial_ === MathSpecial.mathNormal) {
            this.os('\\\\');
          }
          this.os(String.fromCharCode(c));
          break;

        case 0x5c: // backslash
          if (this.outputFormat_.charset === jisCharset) {
            this.setCharset(0);
          }
          if (this.mathLevel_ && this.mathSpecial_ === MathSpecial.mathNormal) {
            this.os('\\\\\\\\');
            break;
          }
          // fall through
        case 0x7b: // {
        case 0x7d: // }
          this.os('\\' + String.fromCharCode(c));
          break;

        case 0x7c: // |
        case 0x7e: // ~
          if (this.outputFormat_.charset === jisCharset) {
            this.setCharset(0);
          }
          // fall through
        default:
          if (c < 0x80) {
            if (this.specFormat_.mathPosture
                && ((c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a))) {
              this.os('{\\i ' + String.fromCharCode(c) + '}');
            } else {
              this.os(String.fromCharCode(c));
            }
          } else {
            let code = this.charTable_.get(c) || 0;
            if (code & CHAR_TABLE_SYMBOL_FLAG) {
              this.symbolChar(((code & ~CHAR_TABLE_SYMBOL_FLAG) >> CHAR_TABLE_CHAR_BITS) + 1,
                              code & 0xff);
            } else if (code) {
              if (!(code & (1 << (this.outputFormat_.charset + CHAR_TABLE_CHAR_BITS)))) {
                // Choose charset compatible with language if possible
                if (code & (this.outputFormat_.langCharsets << CHAR_TABLE_CHAR_BITS)) {
                  code &= ((this.outputFormat_.langCharsets << CHAR_TABLE_CHAR_BITS) | ((1 << CHAR_TABLE_CHAR_BITS) - 1));
                }
                let ci = 0;
                for (let mask = 1 << CHAR_TABLE_CHAR_BITS; !(code & mask); mask <<= 1, ci++) {}
                this.setCharset(ci);
              }
              if (code & CHAR_TABLE_DB_FLAG) {
                // Double-byte character
                const shortVal = c > 0x7fff ? c - 0x10000 : c;
                this.os(`{\\dbch\\uc2\\u${shortVal}`);
                this.os(hexChar((code >> 8) & 0xff));
                this.os(hexChar(code & 0xff));
                this.os('}');
              } else {
                this.os(hexChar(code & 0xff));
              }
            } else {
              if (c >= SYMBOL_FONT_PAGE + 0x20 && c <= SYMBOL_FONT_PAGE + 0xff) {
                this.symbolChar(this.outputFormat_.fontFamily, c & 0xff);
              } else {
                // Unicode fallback
                const shortVal = c > 0x7fff ? c - 0x10000 : c;
                this.os(`\\u${shortVal}`);
                this.os(hexChar(0x3f)); // ?
              }
            }
          }
          break;
      }
    }
  }

  // ============================================================================
  // LengthSpec Computation
  // ============================================================================

  private computeLengthSpec(spec: LengthSpec): number {
    if (spec.displaySizeFactor === 0.0) {
      return spec.length;
    } else {
      const tem = this.displaySize_ * spec.displaySizeFactor;
      return spec.length + Math.round(tem >= 0 ? tem + 0.5 : tem - 0.5);
    }
  }

  private displaySizeChanged(): void {
    this.specFormat_.positionPointShift = this.computeLengthSpec(this.specFormat_.positionPointShiftSpec);
    this.specFormat_.leftIndent = this.computeLengthSpec(this.specFormat_.leftIndentSpec);
    this.specFormat_.rightIndent = this.computeLengthSpec(this.specFormat_.rightIndentSpec);
    this.specFormat_.firstLineIndent = this.computeLengthSpec(this.specFormat_.firstLineIndentSpec);
    this.specFormat_.lineSpacing = this.computeLengthSpec(this.specFormat_.lineSpacingSpec);
    this.specFormat_.fieldWidth = this.computeLengthSpec(this.specFormat_.fieldWidthSpec);
  }

  // ============================================================================
  // Property Setters (faithful ports from upstream)
  // ============================================================================

  override setFontSize(n: Length): void {
    this.specFormat_.fontSize = halfPoints(n);
  }

  override setFontFamilyName(name: string): void {
    let idx = this.fontFamilyNameTable_.get(name);
    if (idx === undefined) {
      idx = this.fontFamilyCharsetsTable_.length;
      this.fontFamilyNameTable_.set(name, idx);
      this.fontFamilyCharsetsTable_.push(makeFontFamilyCharsets());
    }
    this.specFormat_.fontFamily = idx;
  }

  override setFontWeight(weight: Symbol): void {
    this.specFormat_.isBold = (weight === Symbol.symbolBold);
  }

  override setFontPosture(posture: Symbol): void {
    this.specFormat_.isItalic = (posture === Symbol.symbolItalic || posture === Symbol.symbolOblique);
  }

  override setStartIndent(spec: LengthSpec): void {
    this.specFormat_.leftIndentSpec = spec;
    this.specFormat_.leftIndent = this.computeLengthSpec(spec);
  }

  override setEndIndent(spec: LengthSpec): void {
    this.specFormat_.rightIndentSpec = spec;
    this.specFormat_.rightIndent = this.computeLengthSpec(spec);
  }

  override setFirstLineStartIndent(spec: LengthSpec): void {
    this.specFormat_.firstLineIndentSpec = spec;
    this.specFormat_.firstLineIndent = this.computeLengthSpec(spec);
  }

  override setLineSpacing(spec: LengthSpec): void {
    this.specFormat_.lineSpacingSpec = spec;
    this.specFormat_.lineSpacing = this.computeLengthSpec(spec);
  }

  override setPositionPointShift(spec: LengthSpec): void {
    this.specFormat_.positionPointShiftSpec = spec;
    this.specFormat_.positionPointShift = halfPoints(this.computeLengthSpec(spec));
  }

  override setMinLeading(spec: OptLengthSpec): void {
    this.specFormat_.lineSpacingAtLeast = spec.hasLength;
    // Also update all stack entries to preserve inherited value when popping
    for (const f of this.specFormatStack_) {
      f.lineSpacingAtLeast = spec.hasLength;
    }
  }

  override setQuadding(quadding: Symbol): void {
    switch (quadding) {
      case Symbol.symbolStart:
      default:
        this.specFormat_.quadding = 'l';
        break;
      case Symbol.symbolEnd:
        this.specFormat_.quadding = 'r';
        break;
      case Symbol.symbolCenter:
        this.specFormat_.quadding = 'c';
        break;
      case Symbol.symbolJustify:
        this.specFormat_.quadding = 'j';
        break;
    }
  }

  override setColor(color: DeviceRGBColor): void {
    this.specFormat_.color = this.makeColor(color);
  }

  override setBackgroundColor(color?: DeviceRGBColor): void {
    if (color) {
      this.specFormat_.charBackgroundColor = this.makeColor(color);
    } else {
      this.specFormat_.charBackgroundColor = 0;
    }
  }

  private makeColor(color: DeviceRGBColor): number {
    const rgb = (color.red << 16) | (color.green << 8) | color.blue;
    let index = this.colorTable_.indexOf(rgb);
    if (index < 0) {
      index = this.colorTable_.length;
      this.colorTable_.push(rgb);
    }
    return index + 1;  // RTF colors are 1-indexed
  }

  override setLines(lines: Symbol): void {
    this.specFormat_.lines = lines;
  }

  override setInputWhitespaceTreatment(treatment: Symbol): void {
    this.specFormat_.inputWhitespaceTreatment = treatment;
  }

  override setHyphenate(hyphenate: boolean): void {
    this.specFormat_.hyphenate = hyphenate;
  }

  override setKern(kern: boolean): void {
    this.specFormat_.kern = kern;
  }

  override setScoreSpaces(scoreSpaces: boolean): void {
    this.specFormat_.scoreSpaces = scoreSpaces;
  }

  override setLanguage(lang: Letter2): void {
    this.specFormat_.language = lang;
  }

  override setCountry(country: Letter2): void {
    this.specFormat_.country = country;
  }

  // ============================================================================
  // Display Objects (faithful port from upstream)
  // ============================================================================

  override startDisplayGroup(nic: DisplayGroupNIC): void {
    this.startDisplay(nic);
    this.start();
  }

  override endDisplayGroup(): void {
    this.end();
    this.endDisplay();
  }

  startDisplay(nic: DisplayNIC): void {
    // Handle span columns
    if (this.spanDisplayLevels_) {
      this.spanDisplayLevels_++;
    } else if (this.specFormat_.span && this.pageFormat_.nColumns > 1 && this.tableLevel_ === 0) {
      this.spanDisplayLevels_ = 1;
      this.displaySize_ = this.pageFormat_.pageWidth - this.pageFormat_.leftMargin - this.pageFormat_.rightMargin;
      this.displaySizeChanged();
    }

    // Handle space before
    const spaceBefore = this.computeLengthSpec(nic.spaceBefore.nominal);
    if (spaceBefore > this.accumSpace_) {
      this.accumSpace_ = spaceBefore;
    }

    if (nic.keepWithPrevious) {
      this.keepWithNext_ = true;
    }

    if (this.inlineState_ !== InlineState.inlineFirst && this.inlineState_ !== InlineState.inlineTable) {
      this.inlineState_ = InlineState.inlineStart;
    }
    this.continuePar_ = false;

    // Handle break before
    switch (nic.breakBefore) {
      case Symbol.symbolPage:
      case Symbol.symbolPageRegion:
      case Symbol.symbolColumnSet:
        this.doBreak_ = BreakType.breakPage;
        break;
      case Symbol.symbolColumn:
        if (this.doBreak_ !== BreakType.breakPage) {
          this.doBreak_ = BreakType.breakColumn;
        }
        break;
    }

    // Push display info
    const info = makeDisplayInfo();
    info.spaceAfter = this.computeLengthSpec(nic.spaceAfter.nominal);
    info.keepWithNext = nic.keepWithNext;
    info.saveKeep = this.keep_;

    // Handle keep
    switch (nic.keep) {
      case Symbol.symbolTrue:
      case Symbol.symbolPage:
      case Symbol.symbolColumnSet:
      case Symbol.symbolColumn:
        if (!this.keep_) {
          this.hadParInKeep_ = false;
          this.keep_ = true;
        }
        break;
    }

    // Handle break after
    switch (nic.breakAfter) {
      case Symbol.symbolPage:
      case Symbol.symbolPageRegion:
      case Symbol.symbolColumnSet:
        info.breakAfter = BreakType.breakPage;
        break;
      case Symbol.symbolColumn:
        info.breakAfter = BreakType.breakColumn;
        break;
      default:
        info.breakAfter = BreakType.breakNone;
    }
    this.displayStack_.push(info);
  }

  endDisplay(): void {
    this.doBreak_ = this.displayStack_[this.displayStack_.length - 1]?.breakAfter ?? BreakType.breakNone;
    this.keep_ = this.displayStack_[this.displayStack_.length - 1]?.saveKeep ?? false;

    if (this.inlineState_ !== InlineState.inlineTable) {
      if (this.inlineState_ !== InlineState.inlineFirst) {
        this.inlineState_ = InlineState.inlineStart;
      }
      this.continuePar_ = true;
    }

    if (this.displayStack_.length > 0) {
      const info = this.displayStack_.pop()!;
      if (info.spaceAfter > this.accumSpace_) {
        this.accumSpace_ = info.spaceAfter;
      }
      if (info.keepWithNext) {
        this.keepWithNext_ = true;
      }
    }

    // Handle span columns
    if (this.spanDisplayLevels_) {
      if (--this.spanDisplayLevels_ === 0) {
        this.displaySize_ = this.pageFormat_.pageWidth - this.pageFormat_.leftMargin - this.pageFormat_.rightMargin;
        this.displaySize_ -= this.pageFormat_.columnSep * (this.pageFormat_.nColumns - 1);
        this.displaySize_ /= this.pageFormat_.nColumns;
        this.displaySizeChanged();
      }
    }
  }

  override startParagraph(nic: ParagraphNIC): void {
    this.startDisplay(nic);
    this.start();
    this.paraStack_.push({ ...this.paraFormat_ });
    this.paraFormat_ = { ...this.specFormat_ } as ParaFormat;
  }

  override endParagraph(): void {
    if (this.paraStack_.length > 0) {
      this.paraFormat_ = this.paraStack_.pop()!;
    }
    this.endDisplayGroup();
  }

  override paragraphBreak(nic: ParagraphNIC): void {
    this.inlineState_ = InlineState.inlineStart;
    this.continuePar_ = true;
  }

  // ============================================================================
  // Box Handling
  // ============================================================================

  override startBox(nic: BoxNIC): void {
    this.specFormatStack_.push({ ...this.specFormat_ });
    this.displayBoxLevels_.push(this.specFormatStack_.length - 1);
    if (this.displayBoxLevels_.length === 1) {
      this.boxFirstPara_ = true;
    }
    this.startDisplay(nic);
    this.start();
  }

  override endBox(): void {
    this.end();
    this.endDisplay();
    if (this.displayBoxLevels_.length > 0) {
      this.displayBoxLevels_.pop();
    }
    if (this.specFormatStack_.length > 0) {
      this.specFormat_ = this.specFormatStack_.pop()!;
    }
  }

  // ============================================================================
  // Score (underline/strikethrough)
  // ============================================================================

  override startScoreSymbol(type: Symbol): void {
    switch (type) {
      case Symbol.symbolAfter:
        this.specFormat_.underline = UnderlineType.underlineSingle;
        break;
      case Symbol.symbolThrough:
        this.specFormat_.isStrikethrough = true;
        break;
    }
  }

  override endScore(): void {
    this.specFormat_.underline = UnderlineType.noUnderline;
    this.specFormat_.isStrikethrough = false;
  }

  // ============================================================================
  // External Graphics
  // ============================================================================

  override externalGraphic(nic: ExternalGraphicNIC): void {
    this.inlinePrepare();
    // Placeholder - full implementation would handle various graphic formats
    this.os('[GRAPHIC]');
  }

  // ============================================================================
  // Rules
  // ============================================================================

  override rule(nic: RuleNIC): void {
    this.inlinePrepare();
    // Simple horizontal rule
    this.os('\\par\\pard\\brdrb\\brdrs\\brdrw10\\brsp20\\par\n');
  }

  // ============================================================================
  // Simple Page Sequence (faithful port from upstream)
  // ============================================================================

  override startSimplePageSequenceSerial(): void {
    this.inSimplePageSequence_++;
    this.start();

    // Handle column balancing from previous section
    if (this.doBalance_) {
      this.os('\\sect\\sbknone');
      this.doBalance_ = false;
    }

    // Output section break if needed
    if (this.hadSection_) {
      this.os('\\sect');
    } else {
      this.hadSection_ = true;
    }

    // Ensure minimum margins
    const hfPreSpace = 720;   // 0.5 inch
    const hfPostSpace = 720;
    const minVMargin = 12 * 20;  // Word 97 needs this

    if (this.pageFormat_.headerMargin < hfPreSpace) {
      this.pageFormat_.headerMargin = hfPreSpace;
    }
    if (this.pageFormat_.footerMargin < hfPostSpace) {
      this.pageFormat_.footerMargin = hfPostSpace;
    }
    if (this.pageFormat_.topMargin < minVMargin) {
      this.pageFormat_.topMargin = minVMargin;
    }
    if (this.pageFormat_.bottomMargin < minVMargin) {
      this.pageFormat_.bottomMargin = minVMargin;
    }

    // Output section formatting
    this.os('\\sectd\\plain');
    if (this.pageFormat_.pageWidth > this.pageFormat_.pageHeight) {
      this.os('\\lndscpsxn');
    }
    this.os(`\\pgwsxn${this.pageFormat_.pageWidth}`);
    this.os(`\\pghsxn${this.pageFormat_.pageHeight}`);
    this.os(`\\marglsxn${this.pageFormat_.leftMargin}`);
    this.os(`\\margrsxn${this.pageFormat_.rightMargin}`);
    this.os(`\\margtsxn${this.pageFormat_.topMargin}`);
    this.os(`\\margbsxn${this.pageFormat_.bottomMargin}`);
    this.os(`\\headery${0}`);
    this.os(`\\footery${0}`);
    this.os(`\\pgn${this.pageFormat_.pageNumberFormat}`);

    if (this.pageFormat_.pageNumberRestart) {
      this.os('\\pgnrestart');
    }

    // Calculate display size
    this.displaySize_ = this.pageFormat_.pageWidth - this.pageFormat_.leftMargin - this.pageFormat_.rightMargin;
    this.currentCols_ = 1;
    if (this.pageFormat_.nColumns > 1) {
      this.displaySize_ -= this.pageFormat_.columnSep * (this.pageFormat_.nColumns - 1);
      this.displaySize_ = Math.floor(this.displaySize_ / this.pageFormat_.nColumns);
    }

    if (this.pageFormat_.balance) {
      this.doBalance_ = true;
    }

    this.displaySizeChanged();
    this.outputFormat_ = makeOutputFormat();
    this.doBreak_ = BreakType.breakNone;
    this.suppressBookmarks_ = true;
    this.accumSpace_ = 0;
  }

  override endSimplePageSequenceSerial(): void {
    if (this.inlineState_ !== InlineState.inlineFirst) {
      if (this.hyphenateSuppressed_) {
        this.os('\\hyphpar0');
        this.hyphenateSuppressed_ = false;
      }
      this.os('\\par');
    }
    this.inlineState_ = InlineState.inlineFirst;
    this.continuePar_ = false;
    this.end();
    this.inSimplePageSequence_--;
    if (!this.inSimplePageSequence_ && this.pageFormatStack_.length > 0) {
      this.pageFormat_ = this.pageFormatStack_[this.pageFormatStack_.length - 1];
    }
    this.doBreak_ = BreakType.breakNone;
  }

  override startSimplePageSequenceHeaderFooterSerial(flags: number): void {
    this.inlineState_ = InlineState.inlineMiddle;
    this.saveOutputFormat_ = { ...this.outputFormat_ };
    this.outputFormat_ = makeOutputFormat();
    this.currentOs_ = 'hfos';
    this.hfos_ = '';
  }

  override endSimplePageSequenceHeaderFooterSerial(i: number): void {
    this.outputFormat_ = { ...this.saveOutputFormat_ };
    this.hfPart_[i] = this.hfos_;
    this.currentOs_ = 'tempos';
  }

  override endAllSimplePageSequenceHeaderFooter(): void {
    // Output headers and footers
    for (let type = 0; type < 4; type++) {
      const headerNames = ['headerl', 'footerl', 'headerr', 'footerr'];
      const hfIndices = [
        [1, 0o00, 0o02],   // first front header (left)
        [1, 0o00, 0o06],   // first front footer (left)
        [1, 0o20, 0o22],   // first back header (right)
        [1, 0o20, 0o26],   // first back footer (right)
      ];

      // Output default header/footer (first or other)
      const idx = hfIndices[type];
      const name = headerNames[type];

      this.os(`{\\${name}\\pard\\sl-240\\sb0\\sa0\\plain\\tqc\\tx${Math.floor(this.displaySize_ / 2)}\\tqr\\tx${this.displaySize_} `);

      // Left, center, right parts
      this.os('{}\\tab {}\\tab {}');
      this.os('\\par}');
    }

    // Reset state after headers/footers (faithful port from upstream)
    this.inlineState_ = InlineState.inlineFirst;
    this.continuePar_ = false;
    this.suppressBookmarks_ = false;
  }

  // Page property setters
  setPageWidth(units: Length): void {
    this.pageFormat_.pageWidth = units;
  }

  setPageHeight(units: Length): void {
    this.pageFormat_.pageHeight = units;
  }

  setLeftMargin(units: Length): void {
    this.pageFormat_.leftMargin = units;
  }

  setRightMargin(units: Length): void {
    this.pageFormat_.rightMargin = units;
  }

  setTopMargin(units: Length): void {
    this.pageFormat_.topMargin = units;
  }

  setBottomMargin(units: Length): void {
    this.pageFormat_.bottomMargin = units;
  }

  setHeaderMargin(units: Length): void {
    this.pageFormat_.headerMargin = units;
  }

  setFooterMargin(units: Length): void {
    this.pageFormat_.footerMargin = units;
  }

  setPageNColumns(n: number): void {
    this.pageFormat_.nColumns = n;
  }

  setPageColumnSep(sep: Length): void {
    this.pageFormat_.columnSep = sep;
  }

  setPageBalanceColumns(balance: boolean): void {
    this.pageFormat_.balance = balance;
  }

  // ============================================================================
  // Table Handling (basic structure)
  // ============================================================================

  override startTable(nic: TableNIC): void {
    this.tableLevel_++;
    // Save current state and prepare for table
    if (this.tableLevel_ === 1) {
      this.cells_ = [];
      this.columns_ = [];
      this.nHeaderRows_ = 0;
      this.inTableHeader_ = false;
    }
  }

  override endTable(): void {
    if (this.tableLevel_ === 1) {
      this.outputTable();
    }
    this.tableLevel_--;
  }

  override startTablePartSerial(nic: TablePartNIC): void {
    // Table part handling
  }

  override endTablePartSerial(): void {
    // End table part
  }

  override tableColumn(nic: TableColumnNIC): void {
    const col = makeColumn();
    if (nic.width) {
      col.hasWidth = true;
      col.width = nic.width;
    }
    this.columns_.push(col);
  }

  override startTableRow(): void {
    this.cells_.push([]);
    this.cellIndex_ = 0;
  }

  override endTableRow(): void {
    // End row
  }

  override startTableCell(nic: TableCellNIC): void {
    const cell = makeCell();
    cell.present = true;
    cell.span = nic.nColumnsSpanned || 1;
    cell.vspan = nic.nRowsSpanned || 1;

    // Save current output and switch to cell buffer
    this.cellos_ = '';
    this.currentOs_ = 'cellos';
  }

  override endTableCell(): void {
    // Get cell content and restore output
    const row = this.cells_[this.cells_.length - 1];
    if (row) {
      const cell = makeCell();
      cell.present = true;
      cell.content = this.cellos_;
      row.push(cell);
    }
    this.currentOs_ = 'tempos';
    this.cellIndex_++;
  }

  private outputTable(): void {
    // Basic table output
    for (let ri = 0; ri < this.cells_.length; ri++) {
      const row = this.cells_[ri];
      this.os('\\trowd');

      // Calculate cell positions
      let pos = 0;
      for (let ci = 0; ci < row.length; ci++) {
        const cell = row[ci];
        pos += 1440;  // Default column width of 1 inch
        this.os(`\\cellx${pos}`);
      }
      this.os('\n');

      // Output cell contents
      for (let ci = 0; ci < row.length; ci++) {
        const cell = row[ci];
        this.os('\\pard\\intbl ');
        this.os(cell.content);
        this.os('\\cell\n');
      }
      this.os('\\row\n');
    }
    this.inlineState_ = InlineState.inlineTable;
  }

  // ============================================================================
  // Node Handling
  // ============================================================================

  override startNode(node: NodePtr, mode: StringC): void {
    this.nodeLevel_++;
    // Only add to pending elements if no mode specified
    if (mode.size() === 0) {
      this.pendingElements_.push(node);
      this.pendingElementLevels_.push(this.nodeLevel_);
    }
  }

  override endNode(): void {
    // Remove pending element if there were no flow objects associated with the node
    if (this.pendingElements_.length > 0 &&
        this.pendingElementLevels_[this.pendingElementLevels_.length - 1] === this.nodeLevel_ &&
        this.nPendingElementsNonEmpty_ < this.pendingElements_.length) {
      this.pendingElementLevels_.pop();
      this.pendingElements_.pop();
    }
    this.nodeLevel_--;
  }

  // ============================================================================
  // Leader Handling
  // ============================================================================

  override startLeader(nic: LeaderNIC): void {
    this.leaderDepth_++;
    if (this.leaderDepth_ === 1) {
      this.leaderSaveOutputFormat_ = { ...this.outputFormat_ };
      this.preLeaderOs_ = this.currentOs_;
      this.currentOs_ = 'nullos';
    }
  }

  override endLeader(): void {
    if (--this.leaderDepth_ === 0) {
      if (this.leaderSaveOutputFormat_) {
        this.outputFormat_ = this.leaderSaveOutputFormat_;
        this.leaderSaveOutputFormat_ = null;
      }
      this.currentOs_ = this.preLeaderOs_;
      // MS Word doesn't mind if tabs aren't set at the beginning of the paragraph.
      this.os(`\\tqr\\tldot\\tx${this.displaySize_ - this.paraFormat_.rightIndent}\\tab `);
    }
    this.end();
  }

  // ============================================================================
  // Line Field Handling
  // ============================================================================

  override startLineField(nic: LineFieldNIC): void {
    // Line field handling
  }

  override endLineField(): void {
    // End line field
  }

  // ============================================================================
  // Link Handling
  // ============================================================================

  override startLink(addr: Address): void {
    this.linkDepth_++;
    if (this.linkDepth_ === 1) {
      this.pendingLink_ = addr;
      this.havePendingLink_ = true;
    }
  }

  override endLink(): void {
    this.linkDepth_--;
    if (this.linkDepth_ === 0) {
      this.os('}');
    }
  }

  // ============================================================================
  // Math Handling
  // ============================================================================

  override startMathSequence(): void {
    this.enterMathMode();
  }

  override endMathSequence(): void {
    this.exitMathMode();
  }

  override startFraction(nic: any): void {
    this.inlinePrepare();
    this.os('{\\field{\\*\\fldinst  EQ \\\\f(');
  }

  override fractionBar(): void {
    this.os(this.eqArgSep_);
  }

  override endFraction(): void {
    this.os(')}{\\fldrslt }}');
  }

  override startScript(nic: any): void {
    this.inlinePrepare();
    this.os('{\\field{\\*\\fldinst  EQ ');
  }

  override endScript(): void {
    this.os('}{\\fldrslt }}');
  }

  override startSubscript(): void {
    this.start();
    this.inlinePrepare();
    this.enterMathMode();
    this.os(`\\s\\do${this.specFormat_.subscriptDepth}(`);
  }

  override endSubscript(): void {
    this.os(')');
    this.exitMathMode();
    this.end();
  }

  override startSuperscript(): void {
    this.start();
    this.inlinePrepare();
    this.enterMathMode();
    this.os(`\\s\\up${this.specFormat_.superscriptHeight}(`);
  }

  override endSuperscript(): void {
    this.os(')');
    this.exitMathMode();
    this.end();
  }

  private enterMathMode(): void {
    this.mathLevel_++;
    if (this.mathLevel_ === 1) {
      this.mathSaveOutputFormat_ = { ...this.outputFormat_ };
    }
  }

  private exitMathMode(): void {
    this.mathLevel_--;
    if (this.mathLevel_ === 0 && this.mathSaveOutputFormat_) {
      this.outputFormat_ = this.mathSaveOutputFormat_;
      this.mathSaveOutputFormat_ = null;
    }
  }

  // ============================================================================
  // Grid Handling
  // ============================================================================

  override startGrid(nic: GridNIC): void {
    // Grid handling
  }

  override endGrid(): void {
    // End grid
  }

  override startGridCell(nic: GridCellNIC): void {
    // Grid cell
  }

  override endGridCell(): void {
    // End grid cell
  }

  // ============================================================================
  // Alignment Point
  // ============================================================================

  override alignmentPoint(): void {
    // Alignment point handling
  }
}
