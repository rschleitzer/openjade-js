// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { StringC } from './StringC';
import { Resource } from './Resource';
import { SubstTable } from './SubstTable';
import { Boolean } from './Boolean';
import { UnivChar } from './types';

// Forward declarations
export interface Messenger {
  // Defined in Message.ts
}

export interface CharsetInfo {
  // Defined in CharsetInfo.ts
}

export interface EntityDecl {
  // Defined in EntityDecl.ts
}

export abstract class EntityCatalog extends Resource {
  sgmlDecl(_charset: CharsetInfo, _mgr: Messenger, _sysid: StringC, _result: StringC): Boolean {
    return false;
  }

  lookup(_entity: EntityDecl, _syntax: EntityCatalog.Syntax, _charset: CharsetInfo, _mgr: Messenger, _result: StringC): Boolean {
    return false;
  }

  lookupPublic(_publicId: StringC, _charset: CharsetInfo, _mgr: Messenger, _result: StringC): Boolean {
    return false;
  }

  lookupChar(_name: StringC, _charset: CharsetInfo, _mgr: Messenger, _result: { value: UnivChar }): Boolean {
    return false;
  }
}

export namespace EntityCatalog {
  export abstract class Syntax {
    abstract namecaseGeneral(): Boolean;
    abstract namecaseEntity(): Boolean;
    abstract upperSubstTable(): SubstTable;
    abstract peroDelim(): StringC;
  }
}
