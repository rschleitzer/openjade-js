// Copyright (c) 1997 James Clark
// See the file COPYING for copying permission.

import { Sd, Syntax } from '@openjade-js/opensp';
import { AccessResult, NodePtr } from '../grove/Node';

export abstract class SdNode {
  abstract getSd(): {
    result: AccessResult;
    sd: Sd | null;
    prologSyntax: Syntax | null;
    instanceSyntax: Syntax | null;
  };

  static readonly iid: string = "SdNode";

  static convert(nd: NodePtr): SdNode | null {
    if (nd.node()) {
      const queryResult = nd.node()!.queryInterface(SdNode.iid);
      if (queryResult.result) {
        return queryResult.ptr as SdNode;
      }
    }
    return null;
  }
}
