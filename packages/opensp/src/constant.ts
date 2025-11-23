// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, WideChar, UnivChar, SyntaxChar } from './types';

// TypeScript port always uses SP_MULTI_BYTE mode (Unicode support)
// since JavaScript natively handles Unicode strings

// #ifdef SP_MULTI_BYTE
// restrict Char to the UTF-16 range for now
export const charMax: Char = 0x10ffff;
// #else
// const Char charMax = Char(-1);  // 8-bit mode - not used in TS port
// #endif

export const wideCharMax: WideChar = 0xFFFFFFFF; // WideChar(-1) as unsigned
export const univCharMax: UnivChar = 0xFFFFFFFF; // UnivChar(-1) as unsigned
export const syntaxCharMax: SyntaxChar = 0xFFFFFFFF; // SyntaxChar(-1) as unsigned
