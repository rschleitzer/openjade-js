// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { Boolean } from './Boolean';
import { Named } from './Named';
import { Attributed } from './Attributed';
import { Resource } from './Resource';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Vector } from './Vector';
import { Owner } from './Owner';
import { Location } from './Location';
import { ConstPtr } from './Ptr';
import { Mode } from './Mode';
import { CANNOT_HAPPEN } from './macros';
import { ShortReferenceMap } from './ShortReferenceMap';
import { CompiledModelGroup } from './ContentToken';

// ElementDefinition - defines an element's content model and properties
export class ElementDefinition extends Resource {
  static readonly DeclaredContent = {
    modelGroup: 0,
    any: 1,
    cdata: 2,
    rcdata: 3,
    empty: 4
  } as const;

  static readonly OmitFlags = {
    omitStart: 0o01,
    omitEnd: 0o02,
    omitSpec: 0o04
  } as const;

  static readonly undefinedIndex = -1;

  private location_: Location;
  private index_: number;
  private omitFlags_: number;
  private declaredContent_: number;
  private allowImmediateRecursion_: Boolean;
  private modelGroup_: Owner<CompiledModelGroup>;
  private inclusions_: Vector<ElementType | null>;
  private exclusions_: Vector<ElementType | null>;
  private rankStems_: Vector<RankStem | null>;
  private rankSuffix_: StringC;
  private mode_: Mode;
  private netMode_: Mode;

  constructor(location: Location, index: number, omitFlags: number, declaredContent: number, allowImmediateRecursionOrModelGroup?: Boolean | Owner<CompiledModelGroup>) {
    super();
    this.location_ = location;
    this.index_ = index;
    this.omitFlags_ = omitFlags;
    this.declaredContent_ = declaredContent;
    this.inclusions_ = new Vector<ElementType | null>();
    this.exclusions_ = new Vector<ElementType | null>();
    this.rankStems_ = new Vector<RankStem | null>();
    this.rankSuffix_ = new StringOf<Char>();
    this.mode_ = Mode.econMode;
    this.netMode_ = Mode.econnetMode;

    if (allowImmediateRecursionOrModelGroup instanceof Owner) {
      // Constructor with model group
      this.modelGroup_ = allowImmediateRecursionOrModelGroup;
      this.allowImmediateRecursion_ = true;
    } else {
      // Constructor with allowImmediateRecursion flag
      this.allowImmediateRecursion_ = allowImmediateRecursionOrModelGroup ?? true;
      this.modelGroup_ = new Owner<CompiledModelGroup>();
    }

    this.computeMode();
  }

  compiledModelGroup(): CompiledModelGroup | null {
    return this.modelGroup_.pointer();
  }

  declaredContent(): number {
    return this.declaredContent_;
  }

  omittedTagSpec(): Boolean {
    return (this.omitFlags_ & ElementDefinition.OmitFlags.omitSpec) !== 0;
  }

  canOmitStartTag(): Boolean {
    return (this.omitFlags_ & ElementDefinition.OmitFlags.omitStart) !== 0;
  }

  canOmitEndTag(): Boolean {
    return (this.omitFlags_ & ElementDefinition.OmitFlags.omitEnd) !== 0;
  }

  nRankStems(): number {
    return this.rankStems_.size();
  }

  rankStem(i: number): RankStem | null {
    return this.rankStems_.get(i);
  }

  rankSuffix(): StringC {
    return this.rankSuffix_;
  }

  nInclusions(): number {
    return this.inclusions_.size();
  }

  inclusion(i: number): ElementType | null {
    return this.inclusions_.get(i);
  }

  nExclusions(): number {
    return this.exclusions_.size();
  }

  exclusion(i: number): ElementType | null {
    return this.exclusions_.get(i);
  }

  undefined(): Boolean {
    return this.index_ === ElementDefinition.undefinedIndex;
  }

  allowImmediateRecursion(): Boolean {
    return this.allowImmediateRecursion_;
  }

  setInclusions(inclusions: Vector<ElementType | null>): void {
    inclusions.swap(this.inclusions_);
  }

  setExclusions(exclusions: Vector<ElementType | null>): void {
    exclusions.swap(this.exclusions_);
  }

  setRank(rankSuffix: StringC, rankStems: Vector<RankStem | null>): void {
    rankStems.swap(this.rankStems_);
    rankSuffix.swap(this.rankSuffix_);
  }

  mode(netEnabled: Boolean): Mode {
    return netEnabled ? this.netMode_ : this.mode_;
  }

  location(): Location {
    return this.location_;
  }

  private computeMode(): void {
    switch (this.declaredContent_) {
      case ElementDefinition.DeclaredContent.modelGroup:
        if (this.modelGroup_.pointer() && !this.modelGroup_.pointer()!.containsPcdata()) {
          this.netMode_ = Mode.econnetMode;
          this.mode_ = Mode.econMode;
          break;
        }
        // fall through
      case ElementDefinition.DeclaredContent.any:
        this.netMode_ = Mode.mconnetMode;
        this.mode_ = Mode.mconMode;
        break;
      case ElementDefinition.DeclaredContent.cdata:
        this.netMode_ = Mode.cconnetMode;
        this.mode_ = Mode.cconMode;
        break;
      case ElementDefinition.DeclaredContent.rcdata:
        this.netMode_ = Mode.rcconnetMode;
        this.mode_ = Mode.rcconMode;
        break;
      case ElementDefinition.DeclaredContent.empty:
        break;
      default:
        CANNOT_HAPPEN();
    }
  }
}

// RankStem - represents a rank stem in ranked elements
export class RankStem extends Named {
  private index_: number;
  private def_: Vector<ConstPtr<ElementDefinition>>;

  constructor(name: StringC, index: number) {
    super(name);
    this.index_ = index;
    this.def_ = new Vector<ConstPtr<ElementDefinition>>();
  }

  index(): number {
    return this.index_;
  }

  addDefinition(def: ConstPtr<ElementDefinition>): void {
    this.def_.push_back(def);
  }

  nDefinitions(): number {
    return this.def_.size();
  }

  definition(i: number): ElementDefinition | null {
    return this.def_.get(i).pointer();
  }
}

// ElementType - represents an SGML element type
export class ElementType extends Named {
  private origName_: StringC;
  private index_: number;
  private defIndex_: number;
  private def_: ConstPtr<ElementDefinition>;
  private map_: ShortReferenceMap | null;
  private rankStem_: RankStem | null;

  constructor(name: StringC, index: number) {
    super(name);
    this.origName_ = new StringOf<Char>();
    this.index_ = index;
    this.defIndex_ = 0;
    this.def_ = new ConstPtr<ElementDefinition>();
    this.map_ = null;
    this.rankStem_ = null;
  }

  setElementDefinition(def: ConstPtr<ElementDefinition>, defIndex: number): void {
    this.def_ = def;
    this.defIndex_ = defIndex;
  }

  setMap(map: ShortReferenceMap | null): void {
    this.map_ = map;
  }

  setRankStem(rankStem: RankStem | null): void {
    this.rankStem_ = rankStem;
  }

  undefined(): Boolean {
    return this.def_.pointer()?.undefined() ?? true;
  }

  setOrigName(origName: StringC): void {
    origName.swap(this.origName_);
  }

  definition(): ElementDefinition | null {
    return this.def_.pointer();
  }

  isRankedElement(): Boolean {
    return this.rankStem_ !== null;
  }

  rankedElementRankStem(): RankStem | null {
    return this.rankStem_;
  }

  index(): number {
    return this.index_;
  }

  map(): ShortReferenceMap | null {
    return this.map_;
  }

  origName(): StringC {
    return this.origName_;
  }

  swap(to: ElementType): void {
    super.swap(to);

    // Swap index_
    const tempIndex = to.index_;
    to.index_ = this.index_;
    this.index_ = tempIndex;

    // Swap defIndex_
    const tempDefIndex = to.defIndex_;
    to.defIndex_ = this.defIndex_;
    this.defIndex_ = tempDefIndex;

    // Swap def_
    this.def_.swap(to.def_);

    // Swap map_
    const tempMap = to.map_;
    to.map_ = this.map_;
    this.map_ = tempMap;

    // Swap rankStem_
    const tempRankStem = to.rankStem_;
    to.rankStem_ = this.rankStem_;
    this.rankStem_ = tempRankStem;
  }

  // Attributed interface - inherited from Attributed base class
  // These would be implemented if ElementType needs attribute functionality
}
