// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, WideChar } from './types';
import { Boolean, PackedBoolean } from './Boolean';
import { StringC } from './StringC';
import { Location } from './Location';
import { Ptr } from './Ptr';
import { Sd } from './Sd';
import { Syntax } from './Syntax';
import { CharsetDecl } from './CharsetDecl';
import { CharsetInfo } from './CharsetInfo';
import { IList } from './IList';
import { ISet } from './ISet';
import { SdFormalError } from './SdFormalError';
import { MessageType1 } from './Message';
import { MessageArg } from './MessageArg';
import { MessageBuilder } from './MessageBuilder';

// Forward declaration for CharSwitcher - defined in ParserState.ts
export class CharSwitcher {
  private switchUsed_: PackedBoolean[];
  private switches_: WideChar[];

  constructor() {
    this.switchUsed_ = [];
    this.switches_ = [];
  }

  addSwitch(from: WideChar, to: WideChar): void {
    this.switches_.push(from);
    this.switches_.push(to);
    this.switchUsed_.push(false);
  }

  subst(c: WideChar): number {
    for (let i = 0; i < this.switches_.length; i += 2) {
      if (c === this.switches_[i]) {
        this.switchUsed_[i / 2] = true;
        return this.switches_[i + 1];
      }
    }
    return c;
  }

  nSwitches(): number {
    return this.switches_.length / 2;
  }

  switchUsed(i: number): Boolean {
    return this.switchUsed_[i];
  }

  switchFrom(i: number): WideChar {
    return this.switches_[i * 2];
  }

  switchTo(i: number): WideChar {
    return this.switches_[i * 2 + 1];
  }
}

/**
 * SdBuilder - information about the SGML declaration being built
 */
export class SdBuilder {
  sd: Ptr<Sd>;
  syntax: Ptr<Syntax>;
  syntaxCharsetDecl: CharsetDecl;
  syntaxCharset: CharsetInfo;
  switcher: CharSwitcher;
  externalSyntax: PackedBoolean;
  enr: PackedBoolean;
  www: PackedBoolean;
  valid: PackedBoolean;
  external: PackedBoolean;
  formalErrorList: IList<SdFormalError>;

  constructor() {
    this.sd = new Ptr<Sd>(null);
    this.syntax = new Ptr<Syntax>(null);
    this.syntaxCharsetDecl = new CharsetDecl();
    this.syntaxCharset = new CharsetInfo();
    this.switcher = new CharSwitcher();
    this.externalSyntax = false;
    this.enr = false;
    this.www = false;
    this.valid = true;
    this.external = false;
    this.formalErrorList = new IList<SdFormalError>();
  }

  addFormalError(loc: Location, message: MessageType1, id: StringC): void {
    const error = new SdFormalError(loc, message, id);
    this.formalErrorList.insert(error);
  }
}

/**
 * CharsetMessageArg - message argument for displaying character sets
 */
export class CharsetMessageArg extends MessageArg {
  private set_: ISet<WideChar>;

  constructor(set: ISet<WideChar>) {
    super();
    this.set_ = set;
  }

  copy(): MessageArg {
    return new CharsetMessageArg(this.set_);
  }

  append(builder: MessageBuilder): void {
    // Format the character set as ranges
    let first = true;

    // Collect all ranges from the set
    const rangesVec = this.set_.getRanges();

    for (let i = 0; i < rangesVec.size(); i++) {
      const range = rangesVec.get(i);
      if (!first) {
        const commaChars = [','.charCodeAt(0), ' '.charCodeAt(0)];
        builder.appendChars(commaChars, 2);
      }
      first = false;

      if (range.min === range.max) {
        // Single character
        this.appendCharNum(builder, range.min);
      } else {
        // Range
        this.appendCharNum(builder, range.min);
        const dashChars = ['-'.charCodeAt(0)];
        builder.appendChars(dashChars, 1);
        this.appendCharNum(builder, range.max);
      }
    }
  }

  private appendCharNum(builder: MessageBuilder, c: WideChar): void {
    // Format as decimal number
    const str = c.toString();
    const chars: Char[] = [];
    for (let i = 0; i < str.length; i++) {
      chars.push(str.charCodeAt(i));
    }
    builder.appendChars(chars, chars.length);
  }
}
