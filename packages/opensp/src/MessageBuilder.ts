// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';

// Forward declarations
export interface OtherMessageArg {
  // Will be defined in MessageArg.ts
}

export interface MessageFragment {
  // Will be defined in Message.ts
}

export abstract class MessageBuilder {
  abstract appendNumber(n: number): void;
  abstract appendOrdinal(n: number): void;
  abstract appendChars(chars: Char[] | null, size: number): void;
  abstract appendOther(arg: OtherMessageArg | null): void;
  abstract appendFragment(fragment: MessageFragment): void;
}
