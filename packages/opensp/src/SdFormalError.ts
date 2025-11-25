// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Link } from './Link';
import { StringC } from './StringC';
import { MessageType1 } from './Message';
import { Location } from './Location';
import { StringMessageArg } from './MessageArg';

// Forward declaration - will be imported when needed
interface ParserState {
  message(type: MessageType1, arg: StringMessageArg): void;
}

/**
 * SdFormalError - stores a deferred formal error from SGML declaration parsing.
 * These errors are collected and sent later if FORMAL YES is specified.
 */
export class SdFormalError extends Link {
  private message_: MessageType1;
  private location_: Location;
  private id_: StringC;

  constructor(loc: Location, message: MessageType1, id: StringC) {
    super();
    this.message_ = message;
    this.location_ = new Location(loc);
    this.id_ = id;
  }

  send(parser: ParserState): void {
    parser.message(this.message_, new StringMessageArg(this.id_));
  }

  location(): Location {
    return this.location_;
  }

  messageType(): MessageType1 {
    return this.message_;
  }

  id(): StringC {
    return this.id_;
  }
}
