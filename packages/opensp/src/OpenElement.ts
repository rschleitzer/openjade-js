// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean, PackedBoolean } from './Boolean';
import { Link } from './Link';
import { Location } from './Location';
import { Mode } from './Mode';
import { ElementType, ElementDefinition } from './ElementType';
import { ShortReferenceMap } from './ShortReferenceMap';
import { LeafContentToken, MatchState } from './ContentToken';

export class OpenElement extends Link {
  private elementType_: ElementType;
  private netEnabling_: PackedBoolean;
  private included_: PackedBoolean;
  private matchState_: MatchState;
  private declaredContent_: number;
  private map_: ShortReferenceMap | null;
  private startLocation_: Location;
  private index_: number;

  constructor(
    type: ElementType,
    net: Boolean,
    included: Boolean,
    map: ShortReferenceMap | null,
    startLocation: Location
  ) {
    super();
    this.elementType_ = type;
    this.netEnabling_ = net;
    this.included_ = included;
    this.matchState_ = new MatchState(type.definition()?.compiledModelGroup());
    this.map_ = map;
    this.startLocation_ = startLocation;
    this.declaredContent_ = type.definition()?.declaredContent() ?? ElementDefinition.DeclaredContent.empty;
    this.index_ = 0;
  }

  type(): ElementType {
    return this.elementType_;
  }

  netEnabling(): Boolean {
    return this.netEnabling_;
  }

  included(): Boolean {
    return this.included_;
  }

  matchState(): MatchState {
    return this.matchState_;
  }

  setMatchState(state: MatchState): void {
    this.matchState_ = state;
  }

  isFinished(): Boolean {
    return (
      this.declaredContent_ !== ElementDefinition.DeclaredContent.modelGroup ||
      this.matchState_.isFinished()
    );
  }

  tryTransition(e: ElementType): Boolean {
    switch (this.declaredContent_) {
      case ElementDefinition.DeclaredContent.modelGroup:
        return this.matchState_.tryTransition(e);
      case ElementDefinition.DeclaredContent.any:
        return (
          e !== this.elementType_ ||
          this.elementType_.definition()?.allowImmediateRecursion() === true
        );
      default:
        return false;
    }
  }

  tryTransitionPcdata(): Boolean {
    return (
      this.declaredContent_ === ElementDefinition.DeclaredContent.modelGroup
        ? this.matchState_.tryTransitionPcdata()
        : true // CDATA, RCDATA, ANY all ok
    );
  }

  invalidExclusion(e: ElementType): LeafContentToken | null {
    return this.declaredContent_ === ElementDefinition.DeclaredContent.modelGroup
      ? this.matchState_.invalidExclusion(e)
      : null;
  }

  doRequiredTransition(): void {
    this.matchState_.doRequiredTransition();
  }

  impliedStartTag(): LeafContentToken | null {
    return this.declaredContent_ === ElementDefinition.DeclaredContent.modelGroup
      ? this.matchState_.impliedStartTag()
      : null;
  }

  map(): ShortReferenceMap | null {
    return this.map_;
  }

  setMap(map: ShortReferenceMap | null): void {
    this.map_ = map;
  }

  requiresSpecialParse(): Boolean {
    return (
      this.declaredContent_ === ElementDefinition.DeclaredContent.cdata ||
      this.declaredContent_ === ElementDefinition.DeclaredContent.rcdata
    );
  }

  mode(netEnabled: Boolean): Mode {
    return this.elementType_.definition()?.mode(netEnabled) ?? Mode.econMode;
  }

  startLocation(): Location {
    return this.startLocation_;
  }

  currentPosition(): LeafContentToken | null {
    return this.declaredContent_ === ElementDefinition.DeclaredContent.modelGroup
      ? this.matchState_.currentPosition()
      : null;
  }

  declaredEmpty(): Boolean {
    return this.declaredContent_ === ElementDefinition.DeclaredContent.empty;
  }

  setConref(): void {
    this.declaredContent_ = ElementDefinition.DeclaredContent.empty;
  }

  index(): number {
    return this.index_;
  }

  setIndex(index: number): void {
    this.index_ = index;
  }
}
