// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Location } from './Location';
import { Vector } from './Vector';
import { CopyOwner } from './CopyOwner';
import { Boolean, PackedBoolean } from './Boolean';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Char } from './types';
import { MessageArg } from './MessageArg';

export class MessageModule {
  // Placeholder for message module system
  // In the original, this loads localized message strings
  constructor() {}
}

// Export default modules for compatibility
export const libModule = new MessageModule();
export const appModule = new MessageModule();

export class MessageFragment {
  protected number_: number;
  private module_: MessageModule | null;
  protected spare_: number;
  private text_: string | null;

  constructor(module: MessageModule | null = null, number: number = 0, text: string | null = null) {
    this.module_ = module;
    this.number_ = number;
    this.text_ = text;
    this.spare_ = 0;
  }

  module(): MessageModule | null {
    return this.module_;
  }

  number(): number {
    return this.number_;
  }

  text(): string | null {
    return this.text_;
  }
}

export class MessageType extends MessageFragment {
  private clauses_: string | null;
  private auxText_: string | null;

  static readonly Severity = {
    info: 0,
    warning: 1,
    quantityError: 2,
    idrefError: 3,
    error: 4
  } as const;

  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null,
    auxText: string | null = null
  ) {
    super(module, number, text);
    this.clauses_ = clauses;
    this.auxText_ = auxText;
    this.spare_ = severity;
  }

  severity(): number {
    return this.spare_;
  }

  auxFragment(): MessageFragment {
    return new MessageFragment(this.module(), this.number(), this.auxText_);
  }

  isError(): Boolean {
    return this.severity() >= MessageType.Severity.quantityError;
  }

  clauses(): string | null {
    return this.clauses_;
  }
}

export class MessageType0 extends MessageType {
  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null
  ) {
    super(severity, module, number, text, clauses);
  }
}

export class MessageType1 extends MessageType {
  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null
  ) {
    super(severity, module, number, text, clauses);
  }
}

export class MessageType2 extends MessageType {
  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null
  ) {
    super(severity, module, number, text, clauses);
  }
}

export class MessageType3 extends MessageType {
  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null
  ) {
    super(severity, module, number, text, clauses);
  }
}

export class MessageType4 extends MessageType {
  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null
  ) {
    super(severity, module, number, text, clauses);
  }
}

export class MessageType5 extends MessageType {
  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null
  ) {
    super(severity, module, number, text, clauses);
  }
}

export class MessageType6 extends MessageType {
  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null
  ) {
    super(severity, module, number, text, clauses);
  }
}

export class MessageType0L extends MessageType {
  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null,
    auxText: string | null = null
  ) {
    super(severity, module, number, text, clauses, auxText);
  }
}

export class MessageType1L extends MessageType {
  constructor(
    severity: number = MessageType.Severity.info,
    module: MessageModule | null = libModule,
    number: number = -1,
    text: string | null = null,
    clauses: string | null = null,
    auxText: string | null = null
  ) {
    super(severity, module, number, text, clauses, auxText);
  }
}

export class OpenElementInfo {
  included: PackedBoolean;
  gi: StringC;
  matchType: StringC;
  matchIndex: number;

  constructor() {
    this.included = false;
    this.gi = new StringOf<Char>();
    this.matchType = new StringOf<Char>();
    this.matchIndex = 0;
  }
}

export class Message {
  type: MessageType | null;
  loc: Location;
  auxLoc: Location;
  args: Vector<CopyOwner<MessageArg>>;
  openElementInfo: Vector<OpenElementInfo>;

  constructor(nArgs: number = 0) {
    this.type = null;
    this.loc = new Location();
    this.auxLoc = new Location();
    this.args = new Vector<CopyOwner<MessageArg>>(nArgs);
    this.openElementInfo = new Vector<OpenElementInfo>();
  }

  swap(to: Message): void {
    const tem = this.type;
    this.type = to.type;
    to.type = tem;
    this.loc.swap(to.loc);
    this.auxLoc.swap(to.auxLoc);
    this.args.swap(to.args);
    this.openElementInfo.swap(to.openElementInfo);
  }

  isError(): Boolean {
    return this.type ? this.type.isError() : false;
  }
}

export abstract class Messenger {
  private haveNextLocation_: PackedBoolean;
  private nextLocation_: Location;

  constructor() {
    this.haveNextLocation_ = false;
    this.nextLocation_ = new Location();
  }

  abstract dispatchMessage(msg: Message | Readonly<Message>): void;

  message(type: MessageType0): void;
  message(type: MessageType1, arg0: MessageArg): void;
  message(type: MessageType2, arg0: MessageArg, arg1: MessageArg): void;
  message(type: MessageType3, arg0: MessageArg, arg1: MessageArg, arg2: MessageArg): void;
  message(type: MessageType4, arg0: MessageArg, arg1: MessageArg, arg2: MessageArg, arg3: MessageArg): void;
  message(type: MessageType5, arg0: MessageArg, arg1: MessageArg, arg2: MessageArg, arg3: MessageArg, arg4: MessageArg): void;
  message(type: MessageType6, arg0: MessageArg, arg1: MessageArg, arg2: MessageArg, arg3: MessageArg, arg4: MessageArg, arg5: MessageArg): void;
  message(type: MessageType0L, loc: Location): void;
  message(type: MessageType1L, arg0: MessageArg, loc: Location): void;
  message(typeOrArg0: any, arg0OrLoc?: any, arg1?: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any): void {
    // Determine which overload based on type
    if (typeOrArg0 instanceof MessageType0L) {
      const msg = new Message(0);
      this.doInitMessage(msg);
      msg.type = typeOrArg0;
      msg.auxLoc = arg0OrLoc as Location;
      this.dispatchMessage(msg);
    } else if (typeOrArg0 instanceof MessageType1L) {
      const msg = new Message(1);
      this.doInitMessage(msg);
      msg.args.set(0, new CopyOwner(arg0OrLoc.copy()));
      msg.type = typeOrArg0;
      msg.auxLoc = arg1 as Location;
      this.dispatchMessage(msg);
    } else if (typeOrArg0 instanceof MessageType0) {
      const msg = new Message(0);
      this.doInitMessage(msg);
      msg.type = typeOrArg0;
      this.dispatchMessage(msg);
    } else if (typeOrArg0 instanceof MessageType1) {
      const msg = new Message(1);
      this.doInitMessage(msg);
      msg.args.set(0, new CopyOwner(arg0OrLoc.copy()));
      msg.type = typeOrArg0;
      this.dispatchMessage(msg);
    } else if (typeOrArg0 instanceof MessageType2) {
      const msg = new Message(2);
      this.doInitMessage(msg);
      msg.args.set(0, new CopyOwner(arg0OrLoc.copy()));
      msg.args.set(1, new CopyOwner(arg1.copy()));
      msg.type = typeOrArg0;
      this.dispatchMessage(msg);
    } else if (typeOrArg0 instanceof MessageType3) {
      const msg = new Message(3);
      this.doInitMessage(msg);
      msg.args.set(0, new CopyOwner(arg0OrLoc.copy()));
      msg.args.set(1, new CopyOwner(arg1.copy()));
      msg.args.set(2, new CopyOwner(arg2.copy()));
      msg.type = typeOrArg0;
      this.dispatchMessage(msg);
    } else if (typeOrArg0 instanceof MessageType4) {
      const msg = new Message(4);
      this.doInitMessage(msg);
      msg.args.set(0, new CopyOwner(arg0OrLoc.copy()));
      msg.args.set(1, new CopyOwner(arg1.copy()));
      msg.args.set(2, new CopyOwner(arg2.copy()));
      msg.args.set(3, new CopyOwner(arg3.copy()));
      msg.type = typeOrArg0;
      this.dispatchMessage(msg);
    } else if (typeOrArg0 instanceof MessageType5) {
      const msg = new Message(5);
      this.doInitMessage(msg);
      msg.args.set(0, new CopyOwner(arg0OrLoc.copy()));
      msg.args.set(1, new CopyOwner(arg1.copy()));
      msg.args.set(2, new CopyOwner(arg2.copy()));
      msg.args.set(3, new CopyOwner(arg3.copy()));
      msg.args.set(4, new CopyOwner(arg4.copy()));
      msg.type = typeOrArg0;
      this.dispatchMessage(msg);
    } else if (typeOrArg0 instanceof MessageType6) {
      const msg = new Message(6);
      this.doInitMessage(msg);
      msg.args.set(0, new CopyOwner(arg0OrLoc.copy()));
      msg.args.set(1, new CopyOwner(arg1.copy()));
      msg.args.set(2, new CopyOwner(arg2.copy()));
      msg.args.set(3, new CopyOwner(arg3.copy()));
      msg.args.set(4, new CopyOwner(arg4.copy()));
      msg.args.set(5, new CopyOwner(arg5.copy()));
      msg.type = typeOrArg0;
      this.dispatchMessage(msg);
    }
  }

  setNextLocation(loc: Location): void {
    this.haveNextLocation_ = true;
    this.nextLocation_ = loc;
  }

  initMessage(_msg: Message): void {
    // Default: no-op, can be overridden
  }

  private doInitMessage(msg: Message): void {
    this.initMessage(msg);
    if (this.haveNextLocation_) {
      msg.loc = this.nextLocation_;
      this.haveNextLocation_ = false;
    }
  }
}

export class ForwardingMessenger extends Messenger {
  protected to_: Messenger;

  constructor(to: Messenger) {
    super();
    this.to_ = to;
  }

  dispatchMessage(msg: Message | Readonly<Message>): void {
    this.to_.dispatchMessage(msg as Message);
  }

  initMessage(msg: Message): void {
    this.to_.initMessage(msg);
  }
}

export class ParentLocationMessenger extends ForwardingMessenger {
  constructor(mgr: Messenger) {
    super(mgr);
  }

  initMessage(msg: Message): void {
    super.initMessage(msg);
    const origin = msg.loc.origin();
    if (!origin.isNull()) {
      const originPtr = origin.pointer();
      if (originPtr) {
        msg.loc = originPtr.parent();
      }
    }
  }
}

export class NullMessenger extends Messenger {
  constructor() {
    super();
  }

  dispatchMessage(_msg: Message | Readonly<Message>): void {
    // No-op: discards all messages
  }
}
