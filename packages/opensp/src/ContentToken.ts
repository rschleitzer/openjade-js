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

  appendLastSet(other: LastSet): void {
    for (let i = 0; i < other.size(); i++) {
      this.push_back(other.get(i));
    }
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
export class GroupInfo {
  andState: Vector<Boolean>;
  minAndDepth: Vector<number>;
  elementTransition: Vector<number>;
  ambiguities: Vector<ContentModelAmbiguity>;

  constructor() {
    this.andState = new Vector<Boolean>();
    this.minAndDepth = new Vector<number>();
    this.elementTransition = new Vector<number>();
    this.ambiguities = new Vector<ContentModelAmbiguity>();
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

  analyze(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    this.analyze1(groupInfo, containingAndGroup, containingAndDepth, firstSet, lastSet);
  }

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
    // TODO: Implement transition addition logic
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

  protected analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    // TODO: Implement AND group analysis
    this.inherentlyOptional_ = true;
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

  protected analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    // TODO: Implement OR group analysis
    this.inherentlyOptional_ = false;
    for (let i = 0; i < this.nMembers(); i++) {
      const memberFirst = new FirstSet();
      const memberLast = new LastSet();
      this.member(i).analyze(groupInfo, containingAndGroup, containingAndDepth, memberFirst, memberLast);
      firstSet.append(memberFirst);
      lastSet.appendLastSet(memberLast);
      if (this.member(i).inherentlyOptional()) {
        this.inherentlyOptional_ = true;
      }
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

  protected analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    // TODO: Implement SEQ group analysis
    this.inherentlyOptional_ = true;
  }
}

// LeafContentToken - base class for leaf tokens (elements, PCDATA, etc.)
export abstract class LeafContentToken extends ContentToken {
  private transitions_: Vector<Transition>;
  private index_: number;
  private typeIndex_: number;
  private inOrGroup_: PackedBoolean;

  constructor(occurrenceIndicator: number) {
    super(occurrenceIndicator);
    this.transitions_ = new Vector<Transition>();
    this.index_ = 0;
    this.typeIndex_ = 0;
    this.inOrGroup_ = false;
  }

  index(): number {
    return this.index_;
  }

  setIndex(index: number): void {
    this.index_ = index;
  }

  typeIndex(): number {
    return this.typeIndex_;
  }

  inOrGroup(): Boolean {
    return this.inOrGroup_;
  }

  setOrGroupMember(): void {
    this.inOrGroup_ = true;
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

  protected analyze1(
    groupInfo: GroupInfo,
    containingAndGroup: AndModelGroup | null,
    containingAndDepth: number,
    firstSet: FirstSet,
    lastSet: LastSet
  ): void {
    firstSet.init(this);
    lastSet.resize(1);
    lastSet.set(0, this);
  }

  abstract finish(
    minAndDepth: Vector<number>,
    elementTransition: Vector<number>,
    ambiguities: Vector<ContentModelAmbiguity>,
    pcdataUnreachable: { value: Boolean }
  ): void;
}

// PcdataToken - #PCDATA token
export class PcdataToken extends LeafContentToken {
  constructor() {
    super(ContentToken.OccurrenceIndicator.none);
  }

  finish(
    minAndDepth: Vector<number>,
    elementTransition: Vector<number>,
    ambiguities: Vector<ContentModelAmbiguity>,
    pcdataUnreachable: { value: Boolean }
  ): void {
    pcdataUnreachable.value = false;
  }
}

// InitialPseudoToken - pseudo-token representing initial state
export class InitialPseudoToken extends LeafContentToken {
  constructor() {
    super(ContentToken.OccurrenceIndicator.none);
  }

  finish(
    minAndDepth: Vector<number>,
    elementTransition: Vector<number>,
    ambiguities: Vector<ContentModelAmbiguity>,
    pcdataUnreachable: { value: Boolean }
  ): void {
    // No-op for pseudo-token
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

  finish(
    minAndDepth: Vector<number>,
    elementTransition: Vector<number>,
    ambiguities: Vector<ContentModelAmbiguity>,
    pcdataUnreachable: { value: Boolean }
  ): void {
    // TODO: Implement element token finishing
  }
}

// DataTagGroup - special group for data tag patterns
export class DataTagGroup extends SeqModelGroup {
  constructor(members: NCVector<Owner<ContentToken>>, occurrenceIndicator: number) {
    super(members, occurrenceIndicator);
  }
}

// DataTagElementToken - element token in data tag pattern
export class DataTagElementToken extends ElementToken {
  private templateText_: Text;

  constructor(elementType: ElementType, occurrenceIndicator: number, templateText: Text) {
    super(elementType, occurrenceIndicator);
    this.templateText_ = new Text();
    this.templateText_.swap(templateText);
  }

  templateText(): Text {
    return this.templateText_;
  }
}

// AndInfo - information for AND group transitions
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

  tryTransition(e: ElementType): Boolean {
    // TODO: Implement transition logic
    return false;
  }

  tryTransitionPcdata(): Boolean {
    // TODO: Implement PCDATA transition logic
    return false;
  }

  possibleTransitions(result: Vector<ElementType>): void {
    // TODO: Implement possible transitions enumeration
  }

  isFinished(): Boolean {
    return this.pos_ === null || (this.pos_ as any).isFinal?.() === true;
  }

  impliedStartTag(): LeafContentToken | null {
    // TODO: Implement implied start tag logic
    return null;
  }

  invalidExclusion(e: ElementType): LeafContentToken | null {
    if (!this.pos_) {
      return null;
    }
    // TODO: Complete implementation when transitionToken is available
    // const token = this.pos_.transitionToken(e, this.andState_, this.minAndDepth_);
    // if (token && !token.inherentlyOptional() && !token.orGroupMember()) {
    //   return token;
    // }
    return null;
  }

  doRequiredTransition(): void {
    // TODO: Implement required transition
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

  constructor() {
    this.initial_ = new Owner<LeafContentToken>();
    this.pcdataUnreachable_ = true;
    this.andStateSize_ = 0;
  }

  initial(): LeafContentToken | null {
    return this.initial_.pointer();
  }

  containsPcdata(): Boolean {
    return !this.pcdataUnreachable_;
  }

  pcdataUnreachable(): Boolean {
    return this.pcdataUnreachable_;
  }

  andStateSize(): number {
    return this.andStateSize_;
  }

  compile(
    andStateSize: number,
    modelGroup: Owner<ModelGroup>,
    elementsInfo: Vector<any>,
    pcdataToken: Owner<PcdataToken>
  ): void {
    // TODO: Implement compilation
    this.andStateSize_ = andStateSize;
    this.pcdataUnreachable_ = true;
  }
}
