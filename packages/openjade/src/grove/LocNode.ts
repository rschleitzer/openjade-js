// Copyright (c) 1997 James Clark
// See the file COPYING for copying permission.

import { Location } from '@openjade-js/opensp';
import { AccessResult, NodePtr } from './Node';

export abstract class LocNode {
  abstract getLocation(): { result: AccessResult; location: Location };

  static readonly iid: string = "LocNode";

  static convert(nd: NodePtr): LocNode | null {
    if (nd.node()) {
      const queryResult = nd.node()!.queryInterface(LocNode.iid);
      if (queryResult.result) {
        return queryResult.ptr as LocNode;
      }
    }
    return null;
  }
}
