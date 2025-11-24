// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { ErrorCountEventHandler } from './ErrorCountEventHandler';
import { MessageEvent, SubdocEntityEvent } from './Event';
import { Messenger } from './Message';

// Forward declarations for types not yet ported
export interface SgmlParser {
  parseAll(handler: any): void;
}

export class MessageEventHandler extends ErrorCountEventHandler {
  private messenger_: Messenger | null;
  private parser_: SgmlParser | null;

  constructor(messenger: Messenger | null, parser: SgmlParser | null = null) {
    super();
    this.messenger_ = messenger;
    this.parser_ = parser;
  }

  message(event: MessageEvent): void {
    if (this.messenger_) {
      this.messenger_.dispatchMessage(event.message());
    }
    super.message(event);
  }

  subdocEntity(event: SubdocEntityEvent): void {
    const entity = event.entity();
    if (entity && this.parser_) {
      // TODO: Implement subdoc parsing when SgmlParser is ported
      // For now, just skip subdoc parsing
    }
  }

  messenger(): Messenger | null {
    return this.messenger_;
  }
}
