// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Location } from './Location';
import { IList } from './IList';
import { Link } from './Link';
import { Boolean } from './Boolean';
import { Char } from './types';
import { EventsWanted } from './EventsWanted';
import { EventHandler as EventHandlerBase } from './Event';

// EventHandler has methods beyond what's defined in the base
interface EventHandler extends EventHandlerBase {
  reOrigin(event: any): void;
  ignoredRe(event: any): void;
  data(event: any): void;
}
import { Allocator } from './Allocator';
import { ReOriginEvent, IgnoredReEvent, ReEvent } from './Event';

export class OutputStateLevel extends Link {
  state: number; // OutputState.State enum
  reSerial: number;
  reLocation: Location;

  constructor() {
    super();
    this.state = OutputState.State.afterStartTag;
    this.reSerial = 0;
    this.reLocation = new Location();
  }

  hasPendingRe(): Boolean {
    return this.state >= OutputState.State.pendingAfterRsOrRe;
  }
}

export class OutputState {
  private stack_: IList<OutputStateLevel>;
  private re_: Char;
  private nextSerial_: number;

  constructor() {
    this.stack_ = new IList<OutputStateLevel>();
    this.re_ = 0;
    this.nextSerial_ = 0;
    this.init();
  }

  init(): void {
    this.nextSerial_ = 0;
    this.stack_.clear();
    this.stack_.insert(new OutputStateLevel());
  }

  handleRe(
    handler: EventHandler,
    alloc: Allocator,
    eventsWanted: EventsWanted,
    re: Char,
    location: Location
  ): void {
    this.re_ = re;
    if (eventsWanted.wantInstanceMarkup()) {
      handler.reOrigin(new ReOriginEvent(re, location, this.nextSerial_));
    }

    const topLevel = this.top();
    switch (topLevel.state) {
      case OutputState.State.afterStartTag:
        // it's the first RE in the element
        if (eventsWanted.wantInstanceMarkup()) {
          handler.ignoredRe(new IgnoredReEvent(re, location, this.nextSerial_++));
        }
        topLevel.state = OutputState.State.afterRsOrRe;
        break;
      case OutputState.State.afterRsOrRe:
      case OutputState.State.afterData:
        topLevel.state = OutputState.State.pendingAfterRsOrRe;
        topLevel.reLocation = location;
        topLevel.reSerial = this.nextSerial_++;
        break;
      case OutputState.State.pendingAfterRsOrRe:
        // We now know that the pending RE won't be ignored as the last RE.
        const reData1 = new Uint32Array([this.re_]);
        handler.data(new ReEvent(reData1, topLevel.reLocation, topLevel.reSerial));
        topLevel.state = OutputState.State.pendingAfterRsOrRe;
        topLevel.reLocation = location;
        topLevel.reSerial = this.nextSerial_++;
        break;
      case OutputState.State.pendingAfterMarkup:
        // We've had only markup since the last RS or RE, so this
        // RE is ignored.  Note that it's this RE that's ignored, not
        // the pending one.
        if (eventsWanted.wantInstanceMarkup()) {
          handler.ignoredRe(new IgnoredReEvent(re, location, this.nextSerial_++));
        }
        topLevel.state = OutputState.State.pendingAfterRsOrRe;
        break;
    }
  }

  noteRs(handler: EventHandler, alloc: Allocator, eventsWanted: EventsWanted): void {
    const topLevel = this.top();
    if (topLevel.hasPendingRe()) {
      topLevel.state = OutputState.State.pendingAfterRsOrRe;
    } else {
      topLevel.state = OutputState.State.afterRsOrRe;
    }
  }

  noteMarkup(handler: EventHandler, alloc: Allocator, eventsWanted: EventsWanted): void {
    const topLevel = this.top();
    switch (topLevel.state) {
      case OutputState.State.afterRsOrRe:
        topLevel.state = OutputState.State.afterStartTag;
        break;
      case OutputState.State.pendingAfterRsOrRe:
        topLevel.state = OutputState.State.pendingAfterMarkup;
        break;
      default:
        break; // avoid warning
    }
  }

  noteData(handler: EventHandler, alloc: Allocator, eventsWanted: EventsWanted): void {
    const topLevel = this.top();
    if (topLevel.hasPendingRe()) {
      const reData = new Uint32Array([this.re_]);
      handler.data(new ReEvent(reData, topLevel.reLocation, topLevel.reSerial));
    }
    topLevel.state = OutputState.State.afterData;
  }

  noteStartElement(
    included: Boolean,
    handler: EventHandler,
    alloc: Allocator,
    eventsWanted: EventsWanted
  ): void {
    if (included) {
      this.stack_.insert(new OutputStateLevel());
    } else {
      const topLevel = this.top();
      if (topLevel.hasPendingRe()) {
        const reData = new Uint32Array([this.re_]);
        handler.data(new ReEvent(reData, topLevel.reLocation, topLevel.reSerial));
      }
      topLevel.state = OutputState.State.afterStartTag;
    }
  }

  noteEndElement(
    included: Boolean,
    handler: EventHandler,
    alloc: Allocator,
    eventsWanted: EventsWanted
  ): void {
    const topLevel = this.top();
    if (eventsWanted.wantInstanceMarkup() && topLevel.hasPendingRe()) {
      handler.ignoredRe(new IgnoredReEvent(this.re_, topLevel.reLocation, topLevel.reSerial));
    }
    if (included) {
      this.stack_.get();
      this.noteMarkup(handler, alloc, eventsWanted);
    } else {
      topLevel.state = OutputState.State.afterData;
    }
  }

  private top(): OutputStateLevel {
    const head = this.stack_.head();
    if (!head) {
      throw new Error('OutputState stack is empty');
    }
    return head;
  }
}

export namespace OutputState {
  export enum State {
    afterStartTag = 0,
    afterRsOrRe = 1,
    afterData = 2,
    pendingAfterRsOrRe = 3,
    pendingAfterMarkup = 4
  }
}
