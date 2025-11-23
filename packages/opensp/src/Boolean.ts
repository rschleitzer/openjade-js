// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.


// #ifdef SP_NAMESPACE
// #endif

// #ifdef SP_HAVE_BOOL

export type Boolean = boolean;
// #ifdef SP_SIZEOF_BOOL_1
export type PackedBoolean = boolean;
// #else
// typedef char PackedBoolean;  // Duplicate, skipped
// #endif

// #else /* not SP_HAVE_BOOL */

// typedef int Boolean;  // Duplicate, skipped
// typedef char PackedBoolean;  // Duplicate, skipped

// #endif /* not SP_HAVE_BOOL */

// #ifdef SP_NAMESPACE
// #endif


export type bool = number;

// export const true: number = 1;  // Reserved word
// export const false: number = 0;  // Reserved word

// #endif /* not SP_HAVE_BOOL */


