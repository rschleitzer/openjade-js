// Copyright (c) 1994 James Clark, 1999 Matthias Clasen
// See the file COPYING for copying permission.

import { StringC } from './StringC';
import { Vector } from './Vector';
import { MessageBuilder } from './MessageBuilder';

export abstract class MessageArg {
  abstract copy(): MessageArg;
  abstract append(builder: MessageBuilder): void;
}

export class StringMessageArg extends MessageArg {
  private s_: StringC;

  constructor(s: StringC) {
    super();
    this.s_ = s;
  }

  copy(): MessageArg {
    return new StringMessageArg(this.s_);
  }

  append(builder: MessageBuilder): void {
    builder.appendChars(this.s_.data(), this.s_.size());
  }
}

export class NumberMessageArg extends MessageArg {
  private n_: number;

  constructor(n: number) {
    super();
    this.n_ = n;
  }

  copy(): MessageArg {
    return new NumberMessageArg(this.n_);
  }

  append(builder: MessageBuilder): void {
    builder.appendNumber(this.n_);
  }
}

export class OrdinalMessageArg extends MessageArg {
  private n_: number;

  constructor(n: number) {
    super();
    this.n_ = n;
  }

  copy(): MessageArg {
    return new OrdinalMessageArg(this.n_);
  }

  append(builder: MessageBuilder): void {
    builder.appendOrdinal(this.n_);
  }
}

export abstract class OtherMessageArg extends MessageArg {
  constructor() {
    super();
  }

  append(builder: MessageBuilder): void {
    builder.appendOther(this);
  }
}

export class StringVectorMessageArg extends MessageArg {
  private v_: Vector<StringC>;

  constructor(v: Vector<StringC>) {
    super();
    this.v_ = v;
  }

  copy(): MessageArg {
    return new StringVectorMessageArg(this.v_);
  }

  append(builder: MessageBuilder): void {
    for (let i = 0; i < this.v_.size(); i++) {
      if (i > 0) {
        // Note: In the original, this uses ParserMessages::listSep
        // For now we use a simple separator
        const sep = [','.charCodeAt(0), ' '.charCodeAt(0)];
        builder.appendChars(sep, 2);
      }
      const item = this.v_.get(i);
      builder.appendChars(item.data(), item.size());
    }
  }
}
