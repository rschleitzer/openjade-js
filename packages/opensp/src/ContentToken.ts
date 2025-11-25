// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean, PackedBoolean } from './Boolean';
import { Vector } from './Vector';
import { NCVector } from './NCVector';
import { Owner } from './Owner';
import { Text } from './Text';
import { ElementType } from './ElementType';

// Transition - represents state transitions in content model DFA
export class Transition {
  static readonly invalidIndex = -1;

  clearAndStateStartIndex: number;
  andDepth: number;
  isolated: PackedBoolean;
  requireClear: number;
  toSet: number;

  constructor() {
    this.clearAndStateStartIndex = 0;
    this.andDepth = 0;
    this.isolated = false;
    this.requireClear = Transition.invalidIndex;
    this.toSet = Transition.invalidIndex;
  }
}

// FirstSet - set of tokens that can appear first
export class FirstSet {
  private v_: Vector<LeafContentToken>;
  private requiredIndex_: number;

  constructor() {
    this.v_ = new Vector<LeafContentToken>();
    this.requiredIndex_ = -1;
  }

  init(token: LeafContentToken): void {
    this.v_.resize(1);
    this.v_.set(0, token);
    this.requiredIndex_ = 0;
  }

  append(other: FirstSet): void {
    const n = this.v_.size();
    for (let i = 0; i < other.v_.size(); i++) {
      this.v_.push_back(other.v_.get(i));
    }
    if (other.requiredIndex_ >= 0) {
      this.requiredIndex_ = n + other.requiredIndex_;
    }
  }

  size(): number {
    return this.v_.size();
  }

  token(i: number): LeafContentToken {
    return this.v_.get(i);
  }

  requiredIndex(): number {
    return this.requiredIndex_;
  }

  setNotRequired(): void {
    this.requiredIndex_ = -1;
  }
}

// LastSet - set of tokens that can appear last
export class LastSet extends Vector<LeafContentToken> {
  constructor(n?: number) {
    super();
    if (n !== undefined) {
      this.resize(n);
    }
  }

  // Port of LastSet::append from ContentToken.cxx lines 781-787
  appendLastSet(other: LastSet): void {
    const oldSize = this.size();
    this.resize(this.size() + other.size());
    for (let i = 0; i < other.size(); i++) {
      this.set(oldSize + i, other.get(i));
    }
  }

  // Swap contents with another LastSet using base class swap
  swapLastSet(other: LastSet): void {
    super.swap(other);
  }
}

// ContentModelAmbiguity - tracks ambiguous content model transitions
export class ContentModelAmbiguity {
  from: LeafContentToken | null;
  to1: LeafContentToken | null;
  to2: LeafContentToken | null;
  andDepth: number;

  constructor() {
    this.from = null;
    this.to1 = null;
    this.to2 = null;
    this.andDepth = 0;
  }
}

// GroupInfo - information collected during content model analysis
// Port of GroupInfo from ContentToken.cxx lines 178-190
export class GroupInfo {
  nextLeafIndex: number;
  containsPcdata: Boolean;
  andStateSize: number;
  nextTypeIndex: Vector<number>;

  constructor(nType: number = 0) {
    this.nextLeafIndex = 0;
    this.containsPcdata = false;
    this.andStateSize = 0;
    this.nextTypeIndex = new Vector<number>();
    this.nextTypeIndex.resize(nType);
    for (let i = 0; i < nType; i++) {
      this.nextTypeIndex.set(i, 0);
    }
  }
}

// ContentToken - base class for content model tokens
export abstract class ContentToken {
  static readonly OccurrenceIndicator = {
    none: 0,
    opt: 0o01,
    plus: 0o02,
    rep: 0o03
  } as const;

  protected inherentlyOptional_: PackedBoolean;
  private occurrenceIndicator_: number;

  constructor(occurrenceIndicator: number) {
    this.occurrenceIndicator_ = occurrenceIndicator;
    this.inherentlyOptional_ = false;
  }

  occurrenceIndicator(): number {
    return this.occurrenceIndicator_;
  }

  inherentlyOptional(): Boolean {
    return this.inherentlyOptional_;
  }

  static andDepth(andGroup: AndModelGroup | null): number {
    return andGroup ? (andGroup as any).andDepth() : 0;
  }

  static andIndex(andGroup: AndModelGroup | null): number {
    return andGroup ? (andGroup as any).andIndex() : 0;
  }

  // Port of ContentToken::analyze from ContentToken.cxx lines 405-419
  analyze(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    this.analyze1(groupInfo, containingAndGroup, containingAndDepth, firstSet, lastSet);

    // Handle occurrence indicators
    if (this.occurrenceIndicator_ & ContentToken.OccurrenceIndicator.opt) {
      this.inherentlyOptional_ = true;
    }
    if (this.inherentlyOptional_) {
      firstSet.setNotRequired();
    }
    if (this.occurrenceIndicator_ & ContentToken.OccurrenceIndicator.plus) {
      ContentToken.addTransitions(
        lastSet,
        firstSet,
        false,
        ContentToken.andIndex(containingAndGroup),
        ContentToken.andDepth(containingAndGroup)
      );
    }
  }

  // Port of ContentToken::addTransitions from ContentToken.cxx lines 531-549
  static addTransitions(
    from: LastSet,
    to: FirstSet,
    maybeRequired: Boolean,
    andClearIndex: number,
    andDepth: number,
    isolated: Boolean = false,
    requireClear: number = Transition.invalidIndex,
    toSet: number = Transition.invalidIndex
  ): void {
    const length = from.size();
    for (let i = 0; i < length; i++) {
      from.get(i).addTransitions(
        to,
        maybeRequired,
        andClearIndex,
        andDepth,
        isolated,
        requireClear,
        toSet
      );
    }
  }

  abstract finish(
    minAndDepth: Vector<number>,
    elementTransition: Vector<number>,
    ambiguities: Vector<ContentModelAmbiguity>,
    pcdataUnreachable: { value: Boolean }
  ): void;

  grpgtcnt(): number {
    return 0;
  }

  setOrGroupMember(): void {
    // Default implementation
  }

  andGroupIndex(): number {
    return 0;
  }

  asModelGroup(): ModelGroup | null {
    return null;
  }

  asLeafContentToken(): LeafContentToken | null {
    return null;
  }

  protected abstract analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void;
}

// ModelGroup - base class for model groups (AND, OR, SEQ)
export abstract class ModelGroup extends ContentToken {
  static readonly Connector = {
    andConnector: 0,
    orConnector: 1,
    seqConnector: 2
  } as const;

  private members_: NCVector<Owner<ContentToken>>;

  constructor(members: NCVector<Owner<ContentToken>>, occurrenceIndicator: number) {
    super(occurrenceIndicator);
    this.members_ = new NCVector<Owner<ContentToken>>();
    this.members_.swap(members);
  }

  abstract connector(): number;

  nMembers(): number {
    return this.members_.size();
  }

  member(i: number): ContentToken {
    return this.members_.get(i).pointer()!;
  }

  memberConst(i: number): ContentToken {
    return this.members_.get(i).pointer()!;
  }

  finish(
    minAndDepth: Vector<number>,
    elementTransition: Vector<number>,
    ambiguities: Vector<ContentModelAmbiguity>,
    pcdataUnreachable: { value: Boolean }
  ): void {
    for (let i = 0; i < this.members_.size(); i++) {
      this.members_.get(i).pointer()!.finish(minAndDepth, elementTransition, ambiguities, pcdataUnreachable);
    }
  }

  grpgtcnt(): number {
    let count = 1;
    for (let i = 0; i < this.members_.size(); i++) {
      count += this.members_.get(i).pointer()!.grpgtcnt();
    }
    return count;
  }

  asModelGroup(): ModelGroup | null {
    return this;
  }

  protected setOrGroup(): void {
    for (let i = 0; i < this.members_.size(); i++) {
      this.members_.get(i).pointer()!.setOrGroupMember();
    }
  }

  protected abstract analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void;
}

// AndModelGroup - AND group connector (&)
export class AndModelGroup extends ModelGroup {
  private andDepth_: number;
  private andIndex_: number;
  private andGroupIndex_: number;
  private andAncestor_: AndModelGroup | null;

  constructor(members: NCVector<Owner<ContentToken>>, occurrenceIndicator: number) {
    super(members, occurrenceIndicator);
    this.andDepth_ = 0;
    this.andIndex_ = 0;
    this.andGroupIndex_ = 0;
    this.andAncestor_ = null;
  }

  connector(): number {
    return ModelGroup.Connector.andConnector;
  }

  andDepth(): number {
    return this.andDepth_;
  }

  andIndex(): number {
    return this.andIndex_;
  }

  andGroupIndex(): number {
    return this.andGroupIndex_;
  }

  andAncestor(): AndModelGroup | null {
    return this.andAncestor_;
  }

  // Port of AndModelGroup::analyze1 from ContentToken.cxx lines 493-529
  protected analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    this.andDepth_ = ContentToken.andDepth(containingAndGroup);
    this.andIndex_ = ContentToken.andIndex(containingAndGroup);
    this.andAncestor_ = containingAndGroup;
    this.andGroupIndex_ = containingAndDepth;

    if (this.andIndex_ + this.nMembers() > groupInfo.andStateSize) {
      groupInfo.andStateSize = this.andIndex_ + this.nMembers();
    }

    const firstVec = new Vector<FirstSet>();
    firstVec.resize(this.nMembers());
    for (let i = 0; i < this.nMembers(); i++) {
      firstVec.set(i, new FirstSet());
    }

    const lastVec = new Vector<LastSet>();
    lastVec.resize(this.nMembers());
    for (let i = 0; i < this.nMembers(); i++) {
      lastVec.set(i, new LastSet());
    }

    // Analyze first member
    this.member(0).analyze(groupInfo, this, 0, firstVec.get(0), lastVec.get(0));
    firstSet.append(firstVec.get(0));
    firstSet.setNotRequired();
    lastSet.appendLastSet(lastVec.get(0));
    this.inherentlyOptional_ = this.member(0).inherentlyOptional();

    // Analyze remaining members
    for (let i = 1; i < this.nMembers(); i++) {
      this.member(i).analyze(groupInfo, this, i, firstVec.get(i), lastVec.get(i));
      firstSet.append(firstVec.get(i));
      firstSet.setNotRequired();
      lastSet.appendLastSet(lastVec.get(i));
      this.inherentlyOptional_ = this.inherentlyOptional_ && this.member(i).inherentlyOptional();
    }

    // Add cross-transitions between all AND group members
    for (let i = 0; i < this.nMembers(); i++) {
      for (let j = 0; j < this.nMembers(); j++) {
        if (j !== i) {
          ContentToken.addTransitions(
            lastVec.get(i),
            firstVec.get(j),
            false,
            this.andIndex() + this.nMembers(),
            this.andDepth() + 1,
            !this.member(j).inherentlyOptional(),
            this.andIndex() + j,
            this.andIndex() + i
          );
        }
      }
    }
  }
}

// OrModelGroup - OR group connector (|)
export class OrModelGroup extends ModelGroup {
  constructor(members: NCVector<Owner<ContentToken>>, occurrenceIndicator: number) {
    super(members, occurrenceIndicator);
    this.setOrGroup();
  }

  connector(): number {
    return ModelGroup.Connector.orConnector;
  }

  // Port of OrModelGroup::analyze1 from ContentToken.cxx lines 449-467
  protected analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    // Analyze first member directly into output sets
    this.member(0).analyze(groupInfo, containingAndGroup, containingAndDepth, firstSet, lastSet);
    firstSet.setNotRequired();
    this.inherentlyOptional_ = this.member(0).inherentlyOptional();

    // Analyze remaining members into temp sets and append
    for (let i = 1; i < this.nMembers(); i++) {
      const tempFirst = new FirstSet();
      const tempLast = new LastSet();
      this.member(i).analyze(groupInfo, containingAndGroup, containingAndDepth, tempFirst, tempLast);
      firstSet.append(tempFirst);
      firstSet.setNotRequired();
      lastSet.appendLastSet(tempLast);
      this.inherentlyOptional_ = this.inherentlyOptional_ || this.member(i).inherentlyOptional();
    }
  }
}

// SeqModelGroup - sequence group connector (,)
export class SeqModelGroup extends ModelGroup {
  constructor(members: NCVector<Owner<ContentToken>>, occurrenceIndicator: number) {
    super(members, occurrenceIndicator);
  }

  connector(): number {
    return ModelGroup.Connector.seqConnector;
  }

  // Port of SeqModelGroup::analyze1 from ContentToken.cxx lines 469-491
  protected analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    this.member(0).analyze(groupInfo, containingAndGroup, containingAndDepth, firstSet, lastSet);
    this.inherentlyOptional_ = this.member(0).inherentlyOptional();

    for (let i = 1; i < this.nMembers(); i++) {
      const tempFirst = new FirstSet();
      const tempLast = new LastSet();
      this.member(i).analyze(groupInfo, containingAndGroup, containingAndDepth, tempFirst, tempLast);

      ContentToken.addTransitions(
        lastSet,
        tempFirst,
        true,
        ContentToken.andIndex(containingAndGroup),
        ContentToken.andDepth(containingAndGroup)
      );

      if (this.inherentlyOptional_) {
        firstSet.append(tempFirst);
      }

      if (this.member(i).inherentlyOptional()) {
        lastSet.appendLastSet(tempLast);
      } else {
        lastSet.swapLastSet(tempLast);
      }

      this.inherentlyOptional_ = this.inherentlyOptional_ && this.member(i).inherentlyOptional();
    }
  }
}

// LeafContentToken - base class for leaf tokens (elements, PCDATA, etc.)
// AndInfo - information about AND group containment
export class AndInfo {
  andAncestor: AndModelGroup | null;
  andGroupIndex: number;
  follow: Vector<Transition>;

  constructor() {
    this.andAncestor = null;
    this.andGroupIndex = 0;
    this.follow = new Vector<Transition>();
  }
}

export abstract class LeafContentToken extends ContentToken {
  private transitions_: Vector<Transition>;
  protected follow_: Vector<LeafContentToken>;
  private leafIndex_: number;
  private typeIndex_: number;
  private orGroupMember_: PackedBoolean;
  protected andInfo_: AndInfo | null;
  protected isFinal_: PackedBoolean;
  protected requiredIndex_: number;
  // 0 = none, 1 = simple, 2 = complex
  protected pcdataTransitionType_: number;
  protected simplePcdataTransition_: LeafContentToken | null;

  constructor(occurrenceIndicator: number) {
    super(occurrenceIndicator);
    this.transitions_ = new Vector<Transition>();
    this.follow_ = new Vector<LeafContentToken>();
    this.leafIndex_ = 0;
    this.typeIndex_ = 0;
    this.orGroupMember_ = false;
    this.andInfo_ = null;
    this.isFinal_ = false;
    this.requiredIndex_ = -1;
    this.pcdataTransitionType_ = 0;
    this.simplePcdataTransition_ = null;
  }

  index(): number {
    return this.leafIndex_;
  }

  setIndex(index: number): void {
    this.leafIndex_ = index;
  }

  typeIndex(): number {
    return this.typeIndex_;
  }

  orGroupMember(): Boolean {
    return this.orGroupMember_;
  }

  setOrGroupMember(): void {
    this.orGroupMember_ = true;
  }

  addTransition(transition: Transition): void {
    this.transitions_.push_back(transition);
  }

  nTransitions(): number {
    return this.transitions_.size();
  }

  transition(i: number): Transition {
    return this.transitions_.get(i);
  }

  asLeafContentToken(): LeafContentToken | null {
    return this;
  }

  // Port of ContentToken.h line 206 - virtual method, overridden in ElementToken
  elementType(): ElementType | null {
    return null;
  }

  // Port of LeafContentToken::isInitial from ContentToken.cxx
  isInitial(): Boolean {
    return false;
  }

  // Port of LeafContentToken::andDepth from ContentToken.cxx
  andDepth(): number {
    return this.andInfo_ ? ContentToken.andDepth(this.andInfo_.andAncestor) : 0;
  }

  isFinal(): Boolean {
    return this.isFinal_;
  }

  setFinal(): void {
    this.isFinal_ = true;
  }

  addFollow(token: LeafContentToken): void {
    this.follow_.push_back(token);
  }

  nFollow(): number {
    return this.follow_.size();
  }

  follow(i: number): LeafContentToken {
    return this.follow_.get(i);
  }

  // Port of LeafContentToken::addTransitions from ContentToken.cxx lines 551-579
  addTransitions(
    to: FirstSet,
    maybeRequired: Boolean,
    andClearIndex: number,
    andDepth: number,
    isolated: Boolean,
    requireClear: number,
    toSet: number
  ): void {
    if (maybeRequired && to.requiredIndex() !== -1) {
      // ASSERT(this.requiredIndex_ === -1)
      this.requiredIndex_ = to.requiredIndex() + this.follow_.size();
    }
    const length = this.follow_.size();
    const n = to.size();
    // Resize follow_ to accommodate new transitions
    for (let i = 0; i < n; i++) {
      this.follow_.push_back(to.token(i));
    }
    if (this.andInfo_) {
      // Resize andInfo_.follow and set transition info
      for (let i = 0; i < n; i++) {
        const t = new Transition();
        t.clearAndStateStartIndex = andClearIndex;
        t.andDepth = andDepth;
        t.isolated = isolated;
        t.requireClear = requireClear;
        t.toSet = toSet;
        this.andInfo_.follow.push_back(t);
      }
    }
  }

  // Port of LeafContentToken::possibleTransitions from ContentToken.cxx lines 692-709
  possibleTransitions(andState: AndState, minAndDepth: number, result: Vector<ElementType | null>): void {
    if (!this.andInfo_) {
      // Simple case - no AND groups
      for (let i = 0; i < this.follow_.size(); i++) {
        result.push_back(this.follow_.get(i).elementType());
      }
    } else {
      // Complex case with AND groups - check requireClear and andDepth conditions
      for (let i = 0; i < this.follow_.size(); i++) {
        const t = this.andInfo_.follow.get(i);
        if ((t.requireClear === Transition.invalidIndex || andState.isClear(t.requireClear)) &&
            t.andDepth >= minAndDepth) {
          result.push_back(this.follow_.get(i).elementType());
        }
      }
    }
  }

  // Port of LeafContentToken::tryTransition from ContentToken.cxx lines 657-689
  tryTransition(
    to: ElementType | null,
    andState: AndState,
    minAndDepthRef: { value: number },
    newposRef: { value: LeafContentToken | null }
  ): Boolean {
    if (!this.andInfo_) {
      // Simple case - no AND groups
      for (let i = 0; i < this.follow_.size(); i++) {
        if (this.follow_.get(i).elementType() === to) {
          newposRef.value = this.follow_.get(i);
          minAndDepthRef.value = newposRef.value.computeMinAndDepth(andState);
          return true;
        }
      }
    } else {
      // Complex case with AND groups
      for (let i = 0; i < this.follow_.size(); i++) {
        const q = this.andInfo_.follow.get(i);
        if (this.follow_.get(i).elementType() === to &&
            (q.requireClear === Transition.invalidIndex || andState.isClear(q.requireClear)) &&
            q.andDepth >= minAndDepthRef.value) {
          if (q.toSet !== Transition.invalidIndex) {
            andState.set(q.toSet);
          }
          andState.clearFrom(q.clearAndStateStartIndex);
          newposRef.value = this.follow_.get(i);
          minAndDepthRef.value = newposRef.value.computeMinAndDepth(andState);
          return true;
        }
      }
    }
    return false;
  }

  // Port of LeafContentToken::tryTransitionPcdata from ContentToken.h lines 516-529
  tryTransitionPcdata(
    andState: AndState,
    minAndDepthRef: { value: number },
    newposRef: { value: LeafContentToken | null }
  ): Boolean {
    if (this.pcdataTransitionType_ === 1) {
      newposRef.value = this.simplePcdataTransition_;
      return true;
    } else if (this.pcdataTransitionType_ === 0) {
      return false;
    } else {
      // Complex PCDATA transition - use tryTransition with null element type
      return this.tryTransition(null, andState, minAndDepthRef, newposRef);
    }
  }

  // Port of LeafContentToken::computeMinAndDepth from ContentToken.h lines 512-514
  computeMinAndDepth(andState: AndState): number {
    if (!this.andInfo_) {
      return 0;
    }
    return this.computeMinAndDepth1(andState);
  }

  // Port of LeafContentToken::computeMinAndDepth1 from ContentToken.cxx lines 711-722
  private computeMinAndDepth1(andState: AndState): number {
    if (!this.andInfo_) {
      return 0;
    }
    let groupIndex = this.andInfo_.andGroupIndex;
    for (let group: AndModelGroup | null = this.andInfo_.andAncestor;
         group;
         groupIndex = group.andGroupIndex(), group = group.andAncestor()) {
      for (let i = 0; i < group.nMembers(); i++) {
        if (i !== groupIndex &&
            !group.member(i).inherentlyOptional() &&
            andState.isClear(group.andIndex() + i)) {
          return group.andDepth() + 1;
        }
      }
    }
    return 0;
  }

  // Port of LeafContentToken::impliedStartTag from ContentToken.cxx lines 725-739
  impliedStartTag(andState: AndState, minAndDepth: number): LeafContentToken | null {
    if (this.requiredIndex_ !== -1) {
      if (!this.andInfo_) {
        return this.follow_.get(this.requiredIndex_);
      }
      const t = this.andInfo_.follow.get(this.requiredIndex_);
      if ((t.requireClear === Transition.invalidIndex || andState.isClear(t.requireClear)) &&
          t.andDepth >= minAndDepth) {
        return this.follow_.get(this.requiredIndex_);
      }
    }
    return null;
  }

  // Port of LeafContentToken::doRequiredTransition from ContentToken.cxx lines 741-755
  doRequiredTransition(
    andState: AndState,
    minAndDepthRef: { value: number },
    newposRef: { value: LeafContentToken | null }
  ): void {
    if (this.requiredIndex_ === -1) {
      return; // ASSERT in C++
    }
    if (this.andInfo_) {
      const t = this.andInfo_.follow.get(this.requiredIndex_);
      if (t.toSet !== Transition.invalidIndex) {
        andState.set(t.toSet);
      }
      andState.clearFrom(t.clearAndStateStartIndex);
    }
    newposRef.value = this.follow_.get(this.requiredIndex_);
    if (newposRef.value) {
      minAndDepthRef.value = newposRef.value.computeMinAndDepth(andState);
    }
  }

  // Port of LeafContentToken::analyze1 from ContentToken.cxx lines 421-437
  protected analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    this.leafIndex_ = groupInfo.nextLeafIndex++;
    const elementIndex = this.elementType() ? this.elementType()!.index() : 0;
    this.typeIndex_ = groupInfo.nextTypeIndex.get(elementIndex);
    groupInfo.nextTypeIndex.set(elementIndex, this.typeIndex_ + 1);

    if (containingAndGroup) {
      this.andInfo_ = new AndInfo();
      this.andInfo_.andAncestor = containingAndGroup;
      this.andInfo_.andGroupIndex = containingAndDepth;
    }

    firstSet.init(this);
    lastSet.resize(1);
    lastSet.set(0, this);
    this.inherentlyOptional_ = false;
  }

  // Port of LeafContentToken::transitionToken from ContentToken.cxx lines 633-654
  transitionToken(
    to: ElementType | null,
    andState: AndState,
    minAndDepth: number
  ): LeafContentToken | null {
    if (!this.andInfo_) {
      for (let i = 0; i < this.follow_.size(); i++) {
        if (this.follow_.get(i).elementType() === to) {
          return this.follow_.get(i);
        }
      }
    } else {
      for (let i = 0; i < this.follow_.size(); i++) {
        const q = this.andInfo_.follow.get(i);
        if (this.follow_.get(i).elementType() === to &&
            (q.requireClear === Transition.invalidIndex || andState.isClear(q.requireClear)) &&
            q.andDepth >= minAndDepth) {
          return this.follow_.get(i);
        }
      }
    }
    return null;
  }

  // Port of LeafContentToken::finish from ContentToken.cxx lines 236-299
  finish(
    minAndDepthVec: Vector<number>,
    elementTransitionVec: Vector<number>,
    ambiguities: Vector<ContentModelAmbiguity>,
    pcdataUnreachable: { value: Boolean }
  ): void {
    if (this.andInfo_) {
      this.andFinish(minAndDepthVec, elementTransitionVec, ambiguities, pcdataUnreachable);
      return;
    }

    // Reset tracking vectors
    for (let i = 0; i < minAndDepthVec.size(); i++) {
      minAndDepthVec.set(i, -1 >>> 0); // unsigned(-1)
    }
    for (let i = 0; i < elementTransitionVec.size(); i++) {
      elementTransitionVec.set(i, -1);
    }

    this.pcdataTransitionType_ = 0;
    this.simplePcdataTransition_ = null;

    // follow_ is in decreasing order of andDepth because of how it's constructed
    const n = this.follow_.size();
    let j = 0;

    for (let i = 0; i < n; i++) {
      const followToken = this.follow_.get(i);
      const minDepth = minAndDepthVec.get(followToken.index());

      if (minDepth !== 0) {
        minAndDepthVec.set(followToken.index(), 0);

        if (j !== i) {
          this.follow_.set(j, followToken);
        }
        if (i === this.requiredIndex_) {
          this.requiredIndex_ = j;
        }

        const e = followToken.elementType();
        let ei: number;

        if (e === null) {
          // PCDATA token
          if (followToken.andInfo_ === null) {
            this.simplePcdataTransition_ = followToken;
            this.pcdataTransitionType_ = 1;
          } else {
            this.pcdataTransitionType_ = 2;
          }
          ei = 0;
        } else {
          ei = e.index();
        }

        const prevTransition = elementTransitionVec.get(ei);
        if (prevTransition !== -1) {
          const prev = this.follow_.get(prevTransition);
          // Check for ambiguity
          if (followToken !== prev) {
            const amb = new ContentModelAmbiguity();
            amb.from = this;
            amb.to1 = prev;
            amb.to2 = followToken;
            amb.andDepth = 0;
            ambiguities.push_back(amb);
          }
        }
        elementTransitionVec.set(ei, j);
        j++;
      }
    }

    if (this.pcdataTransitionType_ === 0) {
      pcdataUnreachable.value = true;
    }

    this.follow_.resize(j);
  }

  // Port of LeafContentToken::andFinish from ContentToken.cxx lines 301-403
  protected andFinish(
    minAndDepthVec: Vector<number>,
    elementTransitionVec: Vector<number>,
    ambiguities: Vector<ContentModelAmbiguity>,
    pcdataUnreachable: { value: Boolean }
  ): void {
    // Reset tracking vectors
    for (let i = 0; i < minAndDepthVec.size(); i++) {
      minAndDepthVec.set(i, -1 >>> 0); // unsigned(-1)
    }
    for (let i = 0; i < elementTransitionVec.size(); i++) {
      elementTransitionVec.set(i, -1);
    }

    this.pcdataTransitionType_ = 0;
    this.simplePcdataTransition_ = null;
    let pcdataMinCovered = 0;

    const n = this.follow_.size();
    let j = 0;

    for (let i = 0; i < n; i++) {
      const followToken = this.follow_.get(i);
      const andFollow = this.andInfo_!.follow.get(i);
      const minDepth = minAndDepthVec.get(followToken.index());

      // Ignore transitions to the same token with same and depth
      if (andFollow.andDepth < minDepth) {
        minAndDepthVec.set(followToken.index(), andFollow.andDepth);

        if (j !== i) {
          this.follow_.set(j, followToken);
          this.andInfo_!.follow.set(j, andFollow);
        }
        if (i === this.requiredIndex_) {
          this.requiredIndex_ = j;
        }

        const e = followToken.elementType();
        let ei: number;

        if (e === null) {
          // PCDATA token with AND group logic
          if (this.pcdataTransitionType_ === 0) {
            let andAncestor: AndModelGroup | null = this.andInfo_!.andAncestor;
            let groupIndex = this.andInfo_!.andGroupIndex;

            while (andAncestor) {
              let hasNonNull = false;
              for (let k = 0; k < andAncestor.nMembers(); k++) {
                if (k !== groupIndex && !andAncestor.member(k).inherentlyOptional()) {
                  hasNonNull = true;
                  break;
                }
              }
              if (hasNonNull) {
                if (andFollow.andDepth <= andAncestor.andDepth()) {
                  pcdataUnreachable.value = true;
                }
                break;
              }
              groupIndex = andAncestor.andGroupIndex();
              andAncestor = andAncestor.andAncestor();
            }

            if (andFollow.isolated) {
              pcdataMinCovered = andFollow.andDepth;
            }
            this.pcdataTransitionType_ = 2;
          } else {
            if (pcdataMinCovered > andFollow.andDepth + 1) {
              pcdataUnreachable.value = true;
            }
            pcdataMinCovered = andFollow.isolated ? andFollow.andDepth : 0;
          }
          ei = 0;
        } else {
          ei = e.index();
        }

        // Check for ambiguity
        const prevI = elementTransitionVec.get(ei);
        if (prevI !== -1) {
          const prev = this.follow_.get(prevI);
          const prevAndFollow = this.andInfo_!.follow.get(prevI);

          if (followToken !== prev &&
              (prevAndFollow.andDepth === andFollow.andDepth || !prevAndFollow.isolated)) {
            const amb = new ContentModelAmbiguity();
            amb.from = this;
            amb.to1 = prev;
            amb.to2 = followToken;
            amb.andDepth = andFollow.andDepth;
            ambiguities.push_back(amb);
          }

          if (prevAndFollow.isolated) {
            elementTransitionVec.set(ei, j);
          }
        } else {
          elementTransitionVec.set(ei, j);
        }
        j++;
      }
    }

    if (pcdataMinCovered > 0 || this.pcdataTransitionType_ === 0) {
      pcdataUnreachable.value = true;
    }

    this.follow_.resize(j);
    this.andInfo_!.follow.resize(j);
  }
}

// PcdataToken - #PCDATA token
export class PcdataToken extends LeafContentToken {
  constructor() {
    // Note: In C++, PcdataToken passes 'rep' for occurrence indicator (lines 135-138)
    super(ContentToken.OccurrenceIndicator.rep);
  }

  // Port of PcdataToken::analyze1 from ContentToken.cxx lines 439-447
  protected analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    groupInfo.containsPcdata = true;
    super.analyze1(groupInfo, containingAndGroup, containingAndDepth, firstSet, lastSet);
  }
}

// InitialPseudoToken - pseudo-token representing initial state
export class InitialPseudoToken extends LeafContentToken {
  constructor() {
    super(ContentToken.OccurrenceIndicator.none);
  }

  // Port of InitialPseudoToken::isInitial from ContentToken.cxx lines 145-148
  isInitial(): Boolean {
    return true;
  }
}

// ElementToken - element name token
export class ElementToken extends LeafContentToken {
  private elementType_: ElementType | null;

  constructor(elementType: ElementType, occurrenceIndicator: number) {
    super(occurrenceIndicator);
    this.elementType_ = elementType;
  }

  elementType(): ElementType | null {
    return this.elementType_;
  }
}

// DataTagGroup - special group for data tag patterns
export class DataTagGroup extends SeqModelGroup {
  constructor(members: NCVector<Owner<ContentToken>>, occurrenceIndicator: number) {
    super(members, occurrenceIndicator);
  }
}

// DataTagElementToken - element token in data tag pattern
export class DataTagElementToken extends LeafContentToken {
  private elementType_: ElementType | null;
  private templates_: Vector<Text>;
  private paddingText_: Text | null;

  constructor(elementType: ElementType | null, templates: Vector<Text>, paddingText?: Text) {
    super(ContentToken.OccurrenceIndicator.none);
    this.elementType_ = elementType;
    this.templates_ = new Vector<Text>();
    this.templates_.swap(templates);
    this.paddingText_ = paddingText ? paddingText : null;
  }

  elementType(): ElementType | null {
    return this.elementType_;
  }

  nTemplates(): number {
    return this.templates_.size();
  }

  templateText(i: number): Text {
    return this.templates_.get(i);
  }

  hasPaddingText(): boolean {
    return this.paddingText_ !== null;
  }

  paddingText(): Text | null {
    return this.paddingText_;
  }
}

// AndState - tracks state of AND group processing
export class AndState {
  private v_: Vector<PackedBoolean>;
  private clearFrom_: number;

  constructor(n: number) {
    this.v_ = new Vector<PackedBoolean>();
    this.v_.resize(n);
    for (let i = 0; i < n; i++) {
      this.v_.set(i, false);
    }
    this.clearFrom_ = 0;
  }

  isClear(i: number): Boolean {
    return i >= this.clearFrom_ || !this.v_.get(i);
  }

  clearFrom(i: number): void {
    this.clearFrom1(i);
  }

  set(i: number): void {
    this.v_.set(i, true);
    if (i >= this.clearFrom_) {
      this.clearFrom_ = i + 1;
    }
  }

  equals(state: AndState): Boolean {
    // ASSERT(this.v_.size() === state.v_.size());
    for (let i = 0; i < this.v_.size(); i++) {
      if (i >= this.clearFrom_ && i >= state.clearFrom_) {
        break;
      }
      if (this.v_.get(i) !== state.v_.get(i)) {
        return false;
      }
    }
    return true;
  }

  notEquals(state: AndState): Boolean {
    return !this.equals(state);
  }

  private clearFrom1(i: number): void {
    while (this.clearFrom_ > i) {
      this.v_.set(--this.clearFrom_, false);
    }
  }
}

// MatchState - tracks current position in content model matching
export class MatchState {
  private pos_: LeafContentToken | null;
  private andState_: AndState;
  private minAndDepth_: number;

  constructor(model?: CompiledModelGroup | null) {
    if (model === undefined || model === null) {
      this.pos_ = null;
      this.andState_ = new AndState(0);
      this.minAndDepth_ = 0;
    } else {
      this.pos_ = model.initial();
      this.andState_ = new AndState(model.andStateSize());
      this.minAndDepth_ = 0;
    }
  }

  tryTransition(e: ElementType | null): Boolean {
    // Port of MatchState::tryTransition from ContentToken.h lines 532-535
    if (!this.pos_) {
      return false;
    }
    const minAndDepthRef = { value: this.minAndDepth_ };
    const newposRef = { value: this.pos_ as LeafContentToken | null };
    const result = this.pos_.tryTransition(e, this.andState_, minAndDepthRef, newposRef);
    if (result) {
      this.minAndDepth_ = minAndDepthRef.value;
      this.pos_ = newposRef.value;
    }
    return result;
  }

  tryTransitionPcdata(): Boolean {
    // Port of MatchState::tryTransitionPcdata from ContentToken.h lines 538-541
    if (!this.pos_) {
      return false;
    }
    const minAndDepthRef = { value: this.minAndDepth_ };
    const newposRef = { value: this.pos_ as LeafContentToken | null };
    const result = this.pos_.tryTransitionPcdata(this.andState_, minAndDepthRef, newposRef);
    if (result) {
      this.minAndDepth_ = minAndDepthRef.value;
      this.pos_ = newposRef.value;
    }
    return result;
  }

  possibleTransitions(result: Vector<ElementType | null>): void {
    // Port of MatchState::possibleTransitions from ContentToken.h lines 544-547
    if (this.pos_) {
      this.pos_.possibleTransitions(this.andState_, this.minAndDepth_, result);
    }
  }

  isFinished(): Boolean {
    // Port of MatchState::isFinished from ContentToken.h lines 550-553
    return this.pos_ !== null && this.pos_.isFinal() && this.minAndDepth_ === 0;
  }

  impliedStartTag(): LeafContentToken | null {
    // Port of MatchState::impliedStartTag from ContentToken.h lines 555-560
    if (!this.pos_) {
      return null;
    }
    return this.pos_.impliedStartTag(this.andState_, this.minAndDepth_);
  }

  // Port of MatchState::invalidExclusion from ContentToken.cxx lines 604-613
  invalidExclusion(e: ElementType): LeafContentToken | null {
    if (!this.pos_) {
      return null;
    }
    const token = this.pos_.transitionToken(e, this.andState_, this.minAndDepth_);
    if (token && !token.inherentlyOptional() && !token.orGroupMember()) {
      return token;
    }
    return null;
  }

  doRequiredTransition(): void {
    // Port of MatchState::doRequiredTransition from ContentToken.h lines 562-566
    if (!this.pos_) {
      return;
    }
    const minAndDepthRef = { value: this.minAndDepth_ };
    const newposRef = { value: this.pos_ as LeafContentToken | null };
    this.pos_.doRequiredTransition(this.andState_, minAndDepthRef, newposRef);
    this.minAndDepth_ = minAndDepthRef.value;
    this.pos_ = newposRef.value;
  }

  currentPosition(): LeafContentToken | null {
    return this.pos_;
  }

  equals(state: MatchState): Boolean {
    return (
      this.pos_ === state.pos_ &&
      this.andState_.equals(state.andState_) &&
      this.minAndDepth_ === state.minAndDepth_
    );
  }

  notEquals(state: MatchState): Boolean {
    return !this.equals(state);
  }
}

// CompiledModelGroup - compiled/optimized content model
export class CompiledModelGroup {
  private initial_: Owner<LeafContentToken>;
  private pcdataUnreachable_: Boolean;
  private andStateSize_: number;
  private modelGroup_: Owner<ModelGroup>;

  constructor(modelGroup?: ModelGroup | null) {
    this.initial_ = new Owner<LeafContentToken>();
    this.pcdataUnreachable_ = true;
    this.andStateSize_ = 0;
    this.modelGroup_ = new Owner<ModelGroup>(modelGroup ?? null);
  }

  initial(): LeafContentToken | null {
    return this.initial_.pointer();
  }

  containsPcdata(): Boolean {
    return !this.pcdataUnreachable_;
  }

  andStateSize(): number {
    return this.andStateSize_;
  }

  modelGroup(): ModelGroup | null {
    return this.modelGroup_.pointer();
  }

  // Port of CompiledModelGroup::compile from ContentToken.cxx lines 197-224
  compile(
    nElementTypeIndex: number,
    ambiguities: Vector<ContentModelAmbiguity>,
    pcdataUnreachable: { value: Boolean }
  ): void {
    const first = new FirstSet();
    const last = new LastSet();
    const info = new GroupInfo(nElementTypeIndex);

    const modelGroup = this.modelGroup_.pointer();
    if (!modelGroup) {
      pcdataUnreachable.value = true;
      return;
    }

    // Analyze the model group to build first/last sets
    modelGroup.analyze(info, null, 0, first, last);

    // Mark all tokens in last set as final
    for (let i = 0; i < last.size(); i++) {
      last.get(i).setFinal();
    }

    this.andStateSize_ = info.andStateSize;
    this.pcdataUnreachable_ = !info.containsPcdata;

    // Create initial pseudo-token
    this.initial_ = new Owner<LeafContentToken>(new InitialPseudoToken());
    const initialSet = new LastSet();
    initialSet.resize(1);
    initialSet.set(0, this.initial_.pointer()!);

    // Add transitions from initial to first set
    ContentToken.addTransitions(initialSet, first, true, 0, 0);

    // If model group is inherently optional, initial is also final
    if (modelGroup.inherentlyOptional()) {
      this.initial_.pointer()!.setFinal();
    }

    pcdataUnreachable.value = false;

    // Create vectors for finish phase
    const minAndDepth = new Vector<number>();
    minAndDepth.resize(info.nextLeafIndex);
    const elementTransition = new Vector<number>();
    elementTransition.resize(nElementTypeIndex);

    // Finish initial token and model group
    this.initial_.pointer()!.finish(minAndDepth, elementTransition, ambiguities, pcdataUnreachable);
    modelGroup.finish(minAndDepth, elementTransition, ambiguities, pcdataUnreachable);

    if (!info.containsPcdata) {
      pcdataUnreachable.value = false;
    }
  }
}
