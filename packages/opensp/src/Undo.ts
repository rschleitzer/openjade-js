// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Link } from './Link';
import { MatchState } from './ContentToken';
import { OpenElement } from './OpenElement';
import { Owner } from './Owner';

// Forward declaration
export interface ParserState {
  currentElement(): OpenElement;
  popElement(): void;
  pushElement(element: OpenElement): void;
}

export abstract class Undo extends Link {
  constructor() {
    super();
  }

  abstract undo(parser: ParserState): void;
}

export class UndoTransition extends Undo {
  private state_: MatchState;

  constructor(state: MatchState) {
    super();
    this.state_ = state;
  }

  undo(parser: ParserState): void {
    parser.currentElement().setMatchState(this.state_);
  }
}

export class UndoStartTag extends Undo {
  constructor() {
    super();
  }

  undo(parser: ParserState): void {
    parser.popElement();
  }
}

export class UndoEndTag extends Undo {
  private element_: Owner<OpenElement>;

  constructor(e: OpenElement) {
    super();
    this.element_ = new Owner<OpenElement>(e);
  }

  undo(parser: ParserState): void {
    const elem = this.element_.extract();
    if (elem) {
      parser.pushElement(elem);
    }
  }
}
