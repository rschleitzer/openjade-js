// Copyright (c) 1995 James Clark
// See the file COPYING for copying permission.

import { StringC } from './StringC';
import { Resource } from './Resource';
import { EntityCatalog } from './EntityCatalog';
import { ConstPtr } from './Ptr';
import { Boolean } from './Boolean';
import { InputSource } from './InputSource';
import { InputSourceOrigin } from './Location';
import { CharsetInfo } from './CharsetInfo';

// Forward declarations
export interface Messenger {
  // Defined in Message.ts
}

export abstract class EntityManager extends Resource {
  static readonly mayRewind = 0o1;
  static readonly maySetDocCharset = 0o2;

  abstract internalCharsetIsDocCharset(): Boolean;
  abstract charset(): CharsetInfo;
  abstract open(
    sysid: StringC,
    docCharset: CharsetInfo,
    origin: InputSourceOrigin | null,
    flags: number,
    mgr: Messenger
  ): InputSource | null;
  abstract makeCatalog(
    systemId: StringC,
    charset: CharsetInfo,
    mgr: Messenger
  ): ConstPtr<EntityCatalog>;
}
