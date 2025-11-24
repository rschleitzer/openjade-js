// Copyright (c) 1994 James Clark, 1999 Matthias Clasen
// See the file COPYING for copying permission.

import { StringC } from './StringC';
import { Vector } from './Vector';
import { MessageBuilder } from './MessageBuilder';
import { Token } from './Token';
import { Mode } from './Mode';
import { Syntax } from './Syntax';
import { Sd } from './Sd';
import { Ptr, ConstPtr } from './Ptr';

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

export class TokenMessageArg extends MessageArg {
  // Port of TokenMessageArg from TokenMessageArg.h/cxx
  private token_: Token;
  private mode_: Mode;
  private syntax_: ConstPtr<Syntax>;
  private sd_: ConstPtr<Sd>;

  constructor(token: Token, mode: Mode, syntax: ConstPtr<Syntax>, sd: ConstPtr<Sd>) {
    super();
    this.token_ = token;
    this.mode_ = mode;
    this.syntax_ = syntax;
    this.sd_ = sd;
  }

  copy(): MessageArg {
    return new TokenMessageArg(this.token_, this.mode_, this.syntax_, this.sd_);
  }

  append(builder: MessageBuilder): void {
    // Port of TokenMessageArg::append from TokenMessageArg.cxx
    // TODO: Implement full token description logic
    // This would involve:
    // - Checking if token is shortref (tokenFirstShortref)
    // - Checking if token is entity end (tokenEe)
    // - Using ModeInfo to get TokenInfo for the token
    // - Appending appropriate message fragments based on token type
    // For now, append a placeholder
    const placeholder = `[token ${this.token_} in mode ${this.mode_}]`;
    const chars = Array.from(placeholder).map(c => c.charCodeAt(0));
    builder.appendChars(chars, chars.length);
  }
}
