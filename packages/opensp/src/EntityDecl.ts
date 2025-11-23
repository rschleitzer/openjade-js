// Copyright (c) 1995 James Clark
// See the file COPYING for copying permission.

import { NamedResource } from './NamedResource';
import { ConstPtr } from './Ptr';
import { StringResource } from './StringResource';
import { Location } from './Location';
import { StringC } from './StringC';
import { Char } from './types';
import { Boolean, PackedBoolean } from './Boolean';

export class EntityDecl extends NamedResource {
  static readonly DeclType = {
    generalEntity: 0,
    parameterEntity: 1,
    doctype: 2,
    linktype: 3,
    notation: 4,
    sgml: 5
  } as const;

  static readonly DataType = {
    sgmlText: 0,
    pi: 1,
    cdata: 2,
    sdata: 3,
    ndata: 4,
    subdoc: 5
  } as const;

  private declType_: number;
  private dataType_: number;
  private dtdIsBase_: PackedBoolean;
  private lpdIsActive_: PackedBoolean;
  private defLocation_: Location;
  private dtdName_: ConstPtr<StringResource<Char>>;
  private lpdName_: ConstPtr<StringResource<Char>>;

  constructor(str: StringC, declType: number, dataType: number, defLocation: Location) {
    super(str);
    this.declType_ = declType;
    this.dataType_ = dataType;
    this.defLocation_ = defLocation;
    this.dtdIsBase_ = false;
    this.lpdIsActive_ = false;
    this.dtdName_ = new ConstPtr<StringResource<Char>>(null);
    this.lpdName_ = new ConstPtr<StringResource<Char>>(null);
  }

  dataType(): number {
    return this.dataType_;
  }

  declType(): number {
    return this.declType_;
  }

  defLocation(): Location {
    return this.defLocation_;
  }

  declInDtdIsBase(): Boolean {
    return this.dtdIsBase_;
  }

  declInActiveLpd(): Boolean {
    return this.lpdIsActive_;
  }

  declInDtdNamePointer(): StringResource<Char> | null {
    return this.dtdName_.pointer();
  }

  declInLpdNamePointer(): StringResource<Char> | null {
    return this.lpdName_.pointer();
  }

  setDeclIn(dtdName: ConstPtr<StringResource<Char>>, dtdIsBase: Boolean): void;
  setDeclIn(dtdName: ConstPtr<StringResource<Char>>, dtdIsBase: Boolean, lpdName: ConstPtr<StringResource<Char>>, lpdIsActive: Boolean): void;
  setDeclIn(dtdName: ConstPtr<StringResource<Char>>, dtdIsBase: Boolean, lpdName?: ConstPtr<StringResource<Char>>, lpdIsActive?: Boolean): void {
    this.dtdName_ = dtdName;
    this.dtdIsBase_ = dtdIsBase;
    if (lpdName !== undefined && lpdIsActive !== undefined) {
      this.lpdName_ = lpdName;
      this.lpdIsActive_ = lpdIsActive;
    } else {
      this.lpdName_.clear();
    }
  }

  setDefLocation(loc: Location): void {
    this.defLocation_ = loc;
  }

  systemIdPointer(): StringC | null {
    return null;
  }

  publicIdPointer(): StringC | null {
    return null;
  }

  effectiveSystemIdPointer(): StringC | null {
    return null;
  }
}
