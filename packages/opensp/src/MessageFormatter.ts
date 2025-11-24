// Copyright (c) 1994, 1997 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { MessageBuilder } from './MessageBuilder';
import { Boolean } from './Boolean';
import { Message, MessageFragment, OpenElementInfo } from './Message';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { OutputCharStream } from './OutputCharStream';
import { Vector } from './Vector';
import { CopyOwner } from './CopyOwner';
import { MessageArg, OtherMessageArg } from './MessageArg';
import { ErrnoMessageArg } from './ErrnoMessageArg';
import { SearchResultMessageArg } from './SearchResultMessageArg';

// Message fragments for error messages
const MessageFormatterMessages = {
  invalidMessage: new MessageFragment(null, 0),
  ordinal1: new MessageFragment(null, 1),
  ordinal2: new MessageFragment(null, 2),
  ordinal3: new MessageFragment(null, 3),
  ordinaln: new MessageFragment(null, 4),
  invalidArgumentType: new MessageFragment(null, 5)
};

export abstract class MessageFormatter {
  constructor() {}

  abstract getMessageText(frag: MessageFragment, text: StringC): Boolean;

  formatMessage(
    frag: MessageFragment,
    args: Vector<CopyOwner<MessageArg>>,
    os: OutputCharStream,
    noquote: boolean = false
  ): void {
    const text = new StringOf<Char>();
    if (!this.getMessageText(frag, text)) {
      this.formatFragment(MessageFormatterMessages.invalidMessage, os);
      return;
    }

    const builder = new Builder(this, os, noquote || text.size() === 2);
    let i = 0;
    while (i < text.size()) {
      if (text.get(i) === '%'.charCodeAt(0)) {
        i++;
        if (i >= text.size()) {
          break;
        }
        const ch = text.get(i);
        if (ch >= '1'.charCodeAt(0) && ch <= '9'.charCodeAt(0)) {
          const argIndex = ch - '1'.charCodeAt(0);
          if (argIndex < args.size()) {
            const arg = args.get(argIndex).pointer();
            if (arg) {
              arg.append(builder);
            }
          }
        } else {
          os.put(ch);
        }
        i++;
      } else {
        os.put(text.get(i));
        i++;
      }
    }
  }

  formatOpenElements(
    openElementInfo: Vector<OpenElementInfo>,
    os: OutputCharStream
  ): void {
    const nOpenElements = openElementInfo.size();
    for (let i = 0; ; i++) {
      if (i > 0 && (i === nOpenElements || openElementInfo.get(i).included)) {
        // describe last match in previous open element
        const prevInfo = openElementInfo.get(i - 1);
        if (prevInfo.matchType.size() !== 0) {
          os.putString(' (');
          os.putStringC(prevInfo.matchType);
          if (prevInfo.matchIndex !== 0) {
            os.putChar('[');
            os.putUnsignedLong(prevInfo.matchIndex);
            os.putChar(']');
          }
          os.putChar(')');
        }
      }
      if (i === nOpenElements) {
        break;
      }
      const e = openElementInfo.get(i);
      os.putChar(' ');
      os.putStringC(e.gi);
      if (i > 0 && !e.included) {
        const n = openElementInfo.get(i - 1).matchIndex;
        if (n !== 0) {
          os.putChar('[');
          os.putUnsignedLong(n);
          os.putChar(']');
        }
      }
    }
  }

  formatFragment(frag: MessageFragment, os: OutputCharStream): Boolean {
    const text = new StringOf<Char>();
    if (!this.getMessageText(frag, text)) {
      return false;
    }
    os.putStringC(text);
    return true;
  }
}

class Builder extends MessageBuilder {
  private os_: OutputCharStream;
  private formatter_: MessageFormatter;
  private argIsCompleteMessage_: boolean;

  constructor(formatter: MessageFormatter, os: OutputCharStream, argIsCompleteMessage: boolean) {
    super();
    this.formatter_ = formatter;
    this.os_ = os;
    this.argIsCompleteMessage_ = argIsCompleteMessage;
  }

  appendNumber(n: number): void {
    this.os_.putUnsignedLong(n);
  }

  appendOrdinal(n: number): void {
    this.os_.putUnsignedLong(n);
    const mod = n % 10;
    if (mod === 1) {
      this.appendFragment(MessageFormatterMessages.ordinal1);
    } else if (mod === 2) {
      this.appendFragment(MessageFormatterMessages.ordinal2);
    } else if (mod === 3) {
      this.appendFragment(MessageFormatterMessages.ordinal3);
    } else {
      this.appendFragment(MessageFormatterMessages.ordinaln);
    }
  }

  appendChars(chars: number[], size: number): void {
    if (!chars) return;

    const p = new Uint32Array(chars);
    if (this.argIsCompleteMessage_) {
      this.os_.write(p, size);
    } else {
      this.os_.put('"'.charCodeAt(0));
      this.os_.write(p, size);
      this.os_.put('"'.charCodeAt(0));
    }
  }

  appendOther(p: OtherMessageArg | null): void {
    if (!p) return;

    // Check if it's an ErrnoMessageArg
    if (p instanceof ErrnoMessageArg) {
      // In Node.js, use system error messages
      const errno = p.errnum();
      this.os_.putString(`Error ${errno}`);
      return;
    }

    // Check if it's a SearchResultMessageArg
    if (p instanceof SearchResultMessageArg) {
      for (let i = 0; i < p.nTried(); i++) {
        if (i > 0) {
          this.os_.putString(', ');
        }
        const f = p.filename(i);
        const data = f.data();
        if (data) {
          this.appendChars(data, f.size());
        }
        const errnum = p.errnum(i);
        if (errnum !== 0 && errnum !== 2) { // ENOENT = 2
          this.os_.putString(' (');
          this.os_.putString(`Error ${errnum}`);
          this.os_.putChar(')');
        }
      }
      return;
    }

    this.appendFragment(MessageFormatterMessages.invalidArgumentType);
  }

  appendFragment(frag: MessageFragment): void {
    this.formatter_.formatFragment(frag, this.os_);
  }
}
