// Copyright (c) 1994 James Clark, 1999 Matthias Clasen
// See the file COPYING for copying permission.

import { StringC } from './StringC';
import { Vector } from './Vector';
import { MessageBuilder } from './MessageBuilder';
import { Token, Token as TokenEnum } from './Token';
import { Mode } from './Mode';
import { Syntax } from './Syntax';
import { Sd } from './Sd';
import { Ptr, ConstPtr } from './Ptr';
import { ModeInfo, TokenInfo } from './ModeInfo';
import * as ParserMessages from './ParserMessages';

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
    // Port of TokenMessageArg::append from TokenMessageArg.cxx (lines 32-110)
    // Handle shortref tokens
    if (this.token_ >= TokenEnum.tokenFirstShortref) {
      builder.appendFragment(ParserMessages.shortrefDelim);
      return;
    }

    // Handle entity end token
    if (this.token_ === TokenEnum.tokenEe) {
      builder.appendFragment(ParserMessages.entityEnd);
      return;
    }

    // Iterate over tokens in this mode to find a match
    const iter = new ModeInfo(this.mode_, this.sd_.pointer()!);
    const info = new TokenInfo();
    let fragment: typeof ParserMessages.digit | null = null;

    while (iter.nextToken(info)) {
      if (info.token === this.token_) {
        switch (info.type) {
          case TokenInfo.Type.delimType:
          case TokenInfo.Type.delimDelimType:
          case TokenInfo.Type.delimSetType:
            {
              const delim = this.syntax_.pointer()!.delimGeneral(info.delim1);
              builder.appendFragment(ParserMessages.delimStart);
              builder.appendChars(delim.data(), delim.size());
            }
            break;

          case TokenInfo.Type.setType:
            switch (info.set) {
              case Syntax.Set.digit:
                fragment = ParserMessages.digit;
                break;
              case Syntax.Set.nameStart:
                fragment = ParserMessages.nameStartCharacter;
                break;
              case Syntax.Set.sepchar:
                fragment = ParserMessages.sepchar;
                break;
              case Syntax.Set.s:
                fragment = ParserMessages.separator;
                break;
              case Syntax.Set.nmchar:
                fragment = ParserMessages.nameCharacter;
                break;
              case Syntax.Set.sgmlChar:
                fragment = ParserMessages.dataCharacter;
                break;
              case Syntax.Set.minimumData:
                fragment = ParserMessages.minimumDataCharacter;
                break;
              case Syntax.Set.significant:
                fragment = ParserMessages.significantCharacter;
                break;
            }
            break;

          case TokenInfo.Type.functionType:
            switch (info.function) {
              case Syntax.StandardFunction.fRE:
                fragment = ParserMessages.recordEnd;
                break;
              case Syntax.StandardFunction.fRS:
                fragment = ParserMessages.recordStart;
                break;
              case Syntax.StandardFunction.fSPACE:
                fragment = ParserMessages.space;
                break;
            }
            break;
        }
        break;
      }
    }

    if (fragment) {
      builder.appendFragment(fragment);
    }
  }
}
