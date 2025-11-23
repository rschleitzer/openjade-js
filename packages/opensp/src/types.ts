// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.


// #include <limits.h>
// #include <stddef.h>

// #ifdef SP_NAMESPACE
// #endif

// #if UINT_MAX >= 0xffffffffL /* 2^32 - 1 */
export type Unsigned32 = number;
export type Signed32 = number;
// #else
// typedef unsigned long Unsigned32;  // Duplicate, skipped
// typedef long Signed32;  // Duplicate, skipped
// #endif

// Number holds values between 0 and 99999999 (eight nines).
export type Number = number;
export type Offset = number;
export type Index = number;

// #ifdef SP_MULTI_BYTE

export type Char = number;
export type Xchar = number;

// #else /* not SP_MULTI_BYTE */

// typedef unsigned char Char;  // Duplicate, skipped
// This holds any value of type Char plus InputSource:eE (= -1).
// typedef int Xchar;  // Duplicate, skipped

// #endif /* not SP_MULTI_BYTE */

export type UnivChar = number;
export type WideChar = number;

// A character in a syntax reference character set.
// We might want to compile with wide syntax reference characters
// (since they're cheap) but not with wide document characters.
export type SyntaxChar = number;

export type CharClassIndex = number;

export type Token = number;

// #ifdef SP_MULTI_BYTE
export type EquivCode = number;
// #else
// typedef unsigned char EquivCode;  // Duplicate, skipped
// #endif

// #ifdef SP_NAMESPACE
// #endif


