// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { ContentToken, ModelGroup } from './ContentToken';
import { String } from './StringOf';
import { MessageArg } from './MessageArg';
import { MessageBuilder } from './MessageBuilder';
import { Owner } from './Owner';
import { ConstPtr } from './Ptr';
import { Syntax } from './Syntax';
import { Text } from './Text';
import { Vector } from './Vector';
import { Char } from './types';

type StringC = String<Char>;

export class GroupToken {
  static readonly Type = {
    invalid: 0,
    nameToken: 1,
    name: 2,
    dataTagLiteral: 3, // data tag (padding) template
    dataTagGroup: 4,
    elementToken: 5,
    modelGroup: 6,
    pcdata: 7,
    dataTagTemplateGroup: 8,
    all: 9,
    implicit: 10,
  } as const;

  type: number;
  token: StringC; // name nameToken; with substitution
  model: Owner<ModelGroup>;
  contentToken: Owner<ContentToken>; // elementToken pcdata dataTagGroup
  text: Text;
  textVector: Vector<Text>;

  constructor() {
    this.type = GroupToken.Type.invalid;
    this.token = new String<Char>();
    this.model = new Owner<ModelGroup>();
    this.contentToken = new Owner<ContentToken>();
    this.text = new Text();
    this.textVector = new Vector<Text>();
  }
}

export type GroupTokenType = number;

export class AllowedGroupTokens {
  private flags_: number;

  constructor(
    t1: GroupTokenType,
    t2: GroupTokenType = GroupToken.Type.invalid,
    t3: GroupTokenType = GroupToken.Type.invalid,
    t4: GroupTokenType = GroupToken.Type.invalid,
    t5: GroupTokenType = GroupToken.Type.invalid,
    t6: GroupTokenType = GroupToken.Type.invalid
  ) {
    this.flags_ = 0;
    this.allow(t1);
    this.allow(t2);
    this.allow(t3);
    this.allow(t4);
    this.allow(t5);
    this.allow(t6);
  }

  groupToken(i: GroupTokenType): Boolean {
    return ((1 << i) & this.flags_) !== 0;
  }

  // modelGroup, dataTagTemplateGroup
  group(): GroupTokenType {
    if (this.groupToken(GroupToken.Type.modelGroup)) {
      return GroupToken.Type.modelGroup;
    } else if (this.groupToken(GroupToken.Type.dataTagTemplateGroup)) {
      return GroupToken.Type.dataTagTemplateGroup;
    } else {
      return GroupToken.Type.invalid;
    }
  }

  nameStart(): GroupTokenType {
    if (this.groupToken(GroupToken.Type.elementToken)) {
      return GroupToken.Type.elementToken;
    } else if (this.groupToken(GroupToken.Type.nameToken)) {
      return GroupToken.Type.nameToken;
    } else if (this.groupToken(GroupToken.Type.name)) {
      return GroupToken.Type.name;
    } else {
      return GroupToken.Type.invalid;
    }
  }

  private allow(t: GroupTokenType): void {
    if (t !== GroupToken.Type.invalid) {
      this.flags_ |= 1 << t;
    }
  }
}

export namespace GroupConnector {
  export const enum Type {
    andGC = 0,
    orGC = 1,
    seqGC = 2,
    grpcGC = 3,
    dtgcGC = 4,
  }
}

export class GroupConnector {
  type: GroupConnector.Type;

  constructor() {
    this.type = GroupConnector.Type.grpcGC;
  }
}

export class AllowedGroupConnectors {
  private flags_: number;

  constructor(
    c1: GroupConnector.Type,
    c2?: GroupConnector.Type,
    c3?: GroupConnector.Type,
    c4?: GroupConnector.Type
  ) {
    this.flags_ = 0;
    this.allow(c1);
    if (c2 !== undefined) this.allow(c2);
    if (c3 !== undefined) this.allow(c3);
    if (c4 !== undefined) this.allow(c4);
  }

  groupConnector(c: GroupConnector.Type): Boolean {
    return (this.flags_ & (1 << c)) !== 0;
  }

  private allow(c: GroupConnector.Type): void {
    this.flags_ |= 1 << c;
  }
}

export class AllowedGroupTokensMessageArg implements MessageArg {
  private allow_: AllowedGroupTokens;
  private syntax_: ConstPtr<Syntax>;

  constructor(allow: AllowedGroupTokens, syntax: ConstPtr<Syntax>) {
    this.allow_ = allow;
    this.syntax_ = syntax;
  }

  copy(): MessageArg {
    return new AllowedGroupTokensMessageArg(this.allow_, this.syntax_);
  }

  append(builder: MessageBuilder): void {
    // Simplified implementation - just output a generic description
    const parts: string[] = [];

    if (this.allow_.groupToken(GroupToken.Type.name)) {
      parts.push('name');
    }
    if (this.allow_.groupToken(GroupToken.Type.nameToken)) {
      parts.push('name token');
    }
    if (this.allow_.groupToken(GroupToken.Type.elementToken)) {
      parts.push('element token');
    }
    if (this.allow_.groupToken(GroupToken.Type.modelGroup)) {
      parts.push('model group');
    }
    if (this.allow_.groupToken(GroupToken.Type.pcdata)) {
      parts.push('#PCDATA');
    }
    if (this.allow_.groupToken(GroupToken.Type.dataTagGroup)) {
      parts.push('data tag group');
    }
    if (this.allow_.groupToken(GroupToken.Type.dataTagLiteral)) {
      parts.push('data tag literal');
    }
    if (this.allow_.groupToken(GroupToken.Type.dataTagTemplateGroup)) {
      parts.push('data tag template group');
    }

    const msg = parts.join(', ');
    const chars = new Array<Char>(msg.length);
    for (let i = 0; i < msg.length; i++) {
      chars[i] = msg.charCodeAt(i);
    }
    builder.appendChars(chars, chars.length);
  }
}

export class AllowedGroupConnectorsMessageArg implements MessageArg {
  private allow_: AllowedGroupConnectors;
  private syntax_: ConstPtr<Syntax>;

  constructor(allow: AllowedGroupConnectors, syntax: ConstPtr<Syntax>) {
    this.allow_ = allow;
    this.syntax_ = syntax;
  }

  copy(): MessageArg {
    return new AllowedGroupConnectorsMessageArg(this.allow_, this.syntax_);
  }

  append(builder: MessageBuilder): void {
    // Simplified implementation - just output a generic description
    const syntax = this.syntax_.pointer();
    if (!syntax) return;

    const parts: string[] = [];

    const stringToNative = (s: String<Char>): string => {
      let result = '';
      for (let i = 0; i < s.size(); i++) {
        result += globalThis.String.fromCharCode(s.get(i));
      }
      return result;
    };

    if (this.allow_.groupConnector(GroupConnector.Type.orGC)) {
      parts.push(stringToNative(syntax.delimGeneral(Syntax.DelimGeneral.dOR)));
    }
    if (this.allow_.groupConnector(GroupConnector.Type.andGC)) {
      parts.push(stringToNative(syntax.delimGeneral(Syntax.DelimGeneral.dAND)));
    }
    if (this.allow_.groupConnector(GroupConnector.Type.seqGC)) {
      parts.push(stringToNative(syntax.delimGeneral(Syntax.DelimGeneral.dSEQ)));
    }
    if (this.allow_.groupConnector(GroupConnector.Type.grpcGC)) {
      parts.push(stringToNative(syntax.delimGeneral(Syntax.DelimGeneral.dGRPC)));
    }
    if (this.allow_.groupConnector(GroupConnector.Type.dtgcGC)) {
      parts.push(stringToNative(syntax.delimGeneral(Syntax.DelimGeneral.dDTGC)));
    }

    const msg = parts.join(', ');
    const chars = new Array<Char>(msg.length);
    for (let i = 0; i < msg.length; i++) {
      chars[i] = msg.charCodeAt(i);
    }
    builder.appendChars(chars, chars.length);
  }
}
