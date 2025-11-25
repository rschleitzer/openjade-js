// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { ErrorCountEventHandler } from './ErrorCountEventHandler';
import { MessageEvent, SubdocEntityEvent } from './Event';
import { Messenger } from './Message';
import { SgmlParser } from './SgmlParser';
import { Ptr } from './Ptr';
import { InputSourceOrigin } from './Location';

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

  // Port of MessageEventHandler::subdocEntity from MessageEventHandler.cxx
  subdocEntity(event: SubdocEntityEvent): void {
    const entity = event.entity();
    if (entity && this.parser_) {
      const params = new SgmlParser.Params();
      params.subdocReferenced = true;
      params.subdocInheritActiveLinkTypes = true;
      const origin = event.entityOrigin();
      if (origin && origin.pointer()) {
        params.origin = new Ptr<InputSourceOrigin>(origin.pointer()!.copy() as InputSourceOrigin);
      }
      params.parent = this.parser_;
      params.sysid = entity.externalId().effectiveSystemId();
      params.entityType = SgmlParser.Params.EntityType.subdoc;

      const parser = new SgmlParser(params);
      const oldParser = this.parser_;
      this.parser_ = parser;
      parser.parseAll(this);
      this.parser_ = oldParser;
    }
  }

  messenger(): Messenger | null {
    return this.messenger_;
  }

  setParser(parser: SgmlParser | null): void {
    this.parser_ = parser;
  }
}
