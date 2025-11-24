// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { AttributeList, AttributeDefinitionList } from './Attribute';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Char } from './types';
import { Ptr, ConstPtr } from './Ptr';
import { Resource } from './Resource';
import { Boolean } from './Boolean';
import { Named } from './Named';
import { NamedTable, ConstNamedTableIter } from './NamedTable';
import { Syntax } from './Syntax';
import { Location } from './Location';
import { Dtd } from './Dtd';
import { StringResource } from './StringResource';
import { Vector } from './Vector';

// Forward declaration
export class ElementType {
  index(): number {
    throw new Error('ElementType must be imported from ElementType.ts');
  }
}

export class ResultElementSpec {
  elementType: ElementType | null;
  attributeList: AttributeList;

  constructor() {
    this.elementType = null;
    this.attributeList = new AttributeList();
  }

  swap(to: ResultElementSpec): void {
    this.attributeList.swap(to.attributeList);
    const tem = to.elementType;
    to.elementType = this.elementType;
    this.elementType = tem;
  }
}

export class Lpd extends Resource {
  static readonly Type = {
    simpleLink: 0,
    implicitLink: 1,
    explicitLink: 2
  } as const;

  private type_: number;
  private location_: Location;
  private active_: Boolean;
  private sourceDtd_: Ptr<Dtd>;
  private name_: ConstPtr<StringResource<Char>>;

  constructor(name: StringC, type: number, location: Location, sourceDtd: Ptr<Dtd>) {
    super();
    this.name_ = new ConstPtr<StringResource<Char>>(new StringResource<Char>(name));
    this.type_ = type;
    this.location_ = location;
    this.active_ = false;
    this.sourceDtd_ = sourceDtd;
  }

  type(): number {
    return this.type_;
  }

  location(): Location {
    return this.location_;
  }

  sourceDtd(): Ptr<Dtd> {
    return this.sourceDtd_;
  }

  sourceDtdConst(): ConstPtr<Dtd> {
    return new ConstPtr<Dtd>(this.sourceDtd_.pointer());
  }

  active(): Boolean {
    return this.active_;
  }

  activate(): void {
    this.active_ = true;
  }

  namePointer(): ConstPtr<StringResource<Char>> {
    return this.name_;
  }

  name(): StringC {
    const ptr = this.name_.pointer();
    if (!ptr) {
      return new StringOf<Char>();
    }
    return ptr.value;
  }
}

export class SimpleLpd extends Lpd {
  private attributeDef_: any; // Attributed functionality - will be added if needed

  constructor(name: StringC, location: Location, sourceDtd: Ptr<Dtd>) {
    super(name, Lpd.Type.simpleLink, location, sourceDtd);
  }
}

export class LinkSet extends Named {
  private defined_: Boolean;
  private linkRules_: Vector<Vector<ConstPtr<SourceLinkRuleResource>>>;
  private impliedSourceLinkRules_: Vector<ResultElementSpec>;

  constructor(name: StringC, dtd: Dtd | null) {
    super(name);
    this.defined_ = false;
    this.linkRules_ = new Vector<Vector<ConstPtr<SourceLinkRuleResource>>>();
    this.linkRules_.resize(dtd ? dtd.nElementTypeIndex() : 0);
    // Initialize each sub-vector
    for (let i = 0; i < this.linkRules_.size(); i++) {
      this.linkRules_.set(i, new Vector<ConstPtr<SourceLinkRuleResource>>());
    }
    this.impliedSourceLinkRules_ = new Vector<ResultElementSpec>();
  }

  setDefined(): void {
    this.defined_ = true;
  }

  defined(): Boolean {
    return this.defined_;
  }

  addLinkRule(element: ElementType, rule: ConstPtr<SourceLinkRuleResource>): void {
    this.linkRules_.get(element.index()).push_back(rule);
  }

  addImplied(element: ElementType, attributes: AttributeList): void {
    this.impliedSourceLinkRules_.resize(this.impliedSourceLinkRules_.size() + 1);
    const result = this.impliedSourceLinkRules_.back();
    result.elementType = element;
    result.attributeList = attributes;
  }

  impliedResultAttributes(
    resultType: ElementType,
    attributesRef: { value: AttributeList | null }
  ): Boolean {
    for (let i = 0; i < this.impliedSourceLinkRules_.size(); i++) {
      if (this.impliedSourceLinkRules_.get(i).elementType === resultType) {
        attributesRef.value = this.impliedSourceLinkRules_.get(i).attributeList;
        return true;
      }
    }
    return false;
  }

  nLinkRules(e: ElementType): number {
    if (e.index() >= this.linkRules_.size()) {
      return 0;
    }
    return this.linkRules_.get(e.index()).size();
  }

  linkRule(e: ElementType, i: number): SourceLinkRuleResource {
    const rulePtr = this.linkRules_.get(e.index()).get(i).pointer();
    if (!rulePtr) {
      throw new Error('LinkRule pointer is null');
    }
    return rulePtr;
  }

  nImpliedLinkRules(): number {
    return this.impliedSourceLinkRules_.size();
  }

  impliedLinkRule(i: number): ResultElementSpec {
    return this.impliedSourceLinkRules_.get(i);
  }
}

// A link rule whose source element specification is not implied.
export class SourceLinkRule {
  private uselink_: LinkSet | null;
  private postlink_: LinkSet | null;
  private postlinkRestore_: Boolean;
  private linkAttributes_: AttributeList;
  private resultElementSpec_: ResultElementSpec;

  constructor() {
    this.uselink_ = null;
    this.postlink_ = null;
    this.postlinkRestore_ = false;
    this.linkAttributes_ = new AttributeList();
    this.resultElementSpec_ = new ResultElementSpec();
  }

  setLinkAttributes(attributes: AttributeList): void {
    attributes.swap(this.linkAttributes_);
  }

  setResult(element: ElementType | null, attributes: AttributeList): void {
    this.resultElementSpec_.elementType = element;
    attributes.swap(this.resultElementSpec_.attributeList);
  }

  setUselink(linkSet: LinkSet | null): void {
    this.uselink_ = linkSet;
  }

  setPostlink(linkSet: LinkSet | null): void {
    this.postlink_ = linkSet;
  }

  setPostlinkRestore(): void {
    this.postlinkRestore_ = true;
  }

  swap(to: SourceLinkRule): void {
    this.linkAttributes_.swap(to.linkAttributes_);
    this.resultElementSpec_.swap(to.resultElementSpec_);

    const temUselink = to.uselink_;
    to.uselink_ = this.uselink_;
    this.uselink_ = temUselink;

    const temPostlink = to.postlink_;
    to.postlink_ = this.postlink_;
    this.postlink_ = temPostlink;

    const temRestore = to.postlinkRestore_;
    to.postlinkRestore_ = this.postlinkRestore_;
    this.postlinkRestore_ = temRestore;
  }

  attributes(): AttributeList {
    return this.linkAttributes_;
  }

  resultElementSpec(): ResultElementSpec {
    return this.resultElementSpec_;
  }

  uselink(): LinkSet | null {
    return this.uselink_;
  }

  postlink(): LinkSet | null {
    return this.postlink_;
  }

  postlinkRestore(): Boolean {
    return this.postlinkRestore_;
  }
}

export class SourceLinkRuleResource extends Resource {
  private sourceLinkRule_: SourceLinkRule;

  constructor() {
    super();
    this.sourceLinkRule_ = new SourceLinkRule();
  }

  // Delegate to SourceLinkRule
  setLinkAttributes(attributes: AttributeList): void {
    this.sourceLinkRule_.setLinkAttributes(attributes);
  }

  setResult(element: ElementType | null, attributes: AttributeList): void {
    this.sourceLinkRule_.setResult(element, attributes);
  }

  setUselink(linkSet: LinkSet | null): void {
    this.sourceLinkRule_.setUselink(linkSet);
  }

  setPostlink(linkSet: LinkSet | null): void {
    this.sourceLinkRule_.setPostlink(linkSet);
  }

  setPostlinkRestore(): void {
    this.sourceLinkRule_.setPostlinkRestore();
  }

  swap(to: SourceLinkRuleResource): void {
    this.sourceLinkRule_.swap(to.sourceLinkRule_);
  }

  attributes(): AttributeList {
    return this.sourceLinkRule_.attributes();
  }

  resultElementSpec(): ResultElementSpec {
    return this.sourceLinkRule_.resultElementSpec();
  }

  uselink(): LinkSet | null {
    return this.sourceLinkRule_.uselink();
  }

  postlink(): LinkSet | null {
    return this.sourceLinkRule_.postlink();
  }

  postlinkRestore(): Boolean {
    return this.sourceLinkRule_.postlinkRestore();
  }
}

export class IdLinkRule extends SourceLinkRule {
  private assocElementTypes_: Vector<ElementType | null>;

  constructor() {
    super();
    this.assocElementTypes_ = new Vector<ElementType | null>();
  }

  isAssociatedWith(e: ElementType): Boolean {
    for (let i = 0; i < this.assocElementTypes_.size(); i++) {
      if (this.assocElementTypes_.get(i) === e) {
        return true;
      }
    }
    return false;
  }

  setAssocElementTypes(v: Vector<ElementType | null>): void {
    v.swap(this.assocElementTypes_);
  }

  swap(to: IdLinkRule): void {
    super.swap(to);
    this.assocElementTypes_.swap(to.assocElementTypes_);
  }
}

// A collection of link rules in a ID link set that are
// associated with the same name (unique identifier).
export class IdLinkRuleGroup extends Named {
  private linkRules_: Vector<IdLinkRule>;

  constructor(name: StringC) {
    super(name);
    this.linkRules_ = new Vector<IdLinkRule>();
  }

  nLinkRules(): number {
    return this.linkRules_.size();
  }

  linkRule(i: number): IdLinkRule {
    return this.linkRules_.get(i);
  }

  addLinkRule(rule: IdLinkRule): void {
    this.linkRules_.resize(this.linkRules_.size() + 1);
    rule.swap(this.linkRules_.back());
  }
}

// An implicit or explicit LPD.
export class ComplexLpd extends Lpd {
  private resultDtd_: Ptr<Dtd>;
  private linkAttributeDefs_: Vector<ConstPtr<AttributeDefinitionList>>;
  private linkSetTable_: NamedTable<LinkSet>;
  private initialLinkSet_: LinkSet;
  private emptyLinkSet_: LinkSet;
  private hadIdLinkSet_: Boolean;
  private idLinkTable_: NamedTable<IdLinkRuleGroup>;
  private nAttributeDefinitionList_: number;

  constructor(
    name: StringC,
    type: number,
    location: Location,
    syntax: Syntax,
    sourceDtd: Ptr<Dtd>,
    resultDtd: Ptr<Dtd>
  ) {
    super(name, type, location, sourceDtd);
    this.resultDtd_ = resultDtd;
    this.hadIdLinkSet_ = false;
    this.nAttributeDefinitionList_ = 0;
    this.initialLinkSet_ = new LinkSet(
      syntax.rniReservedName(Syntax.ReservedName.rINITIAL),
      sourceDtd.pointer()
    );
    this.emptyLinkSet_ = new LinkSet(
      syntax.rniReservedName(Syntax.ReservedName.rEMPTY),
      sourceDtd.pointer()
    );
    this.linkSetTable_ = new NamedTable<LinkSet>();
    this.idLinkTable_ = new NamedTable<IdLinkRuleGroup>();
    this.linkAttributeDefs_ = new Vector<ConstPtr<AttributeDefinitionList>>();
    this.linkAttributeDefs_.resize(sourceDtd.isNull() ? 0 : sourceDtd.pointer()!.nElementTypeIndex());
  }

  allocAttributeDefinitionListIndex(): number {
    return this.nAttributeDefinitionList_++;
  }

  nAttributeDefinitionList(): number {
    return this.nAttributeDefinitionList_;
  }

  initialLinkSet(): LinkSet {
    return this.initialLinkSet_;
  }

  initialLinkSetConst(): LinkSet {
    return this.initialLinkSet_;
  }

  emptyLinkSet(): LinkSet {
    return this.emptyLinkSet_;
  }

  lookupLinkSet(name: StringC): LinkSet | null {
    return this.linkSetTable_.lookup(name);
  }

  lookupIdLink(id: StringC): IdLinkRuleGroup | null {
    return this.idLinkTable_.lookup(id);
  }

  lookupCreateIdLink(id: StringC): IdLinkRuleGroup {
    let group = this.idLinkTable_.lookup(id);
    if (!group) {
      group = new IdLinkRuleGroup(id);
      this.idLinkTable_.insert(group);
    }
    return group;
  }

  insertIdLink(group: IdLinkRuleGroup): void {
    this.idLinkTable_.insert(group);
  }

  linkSetIter(): ConstNamedTableIter<LinkSet> {
    return new ConstNamedTableIter<LinkSet>(this.linkSetTable_);
  }

  hadIdLinkSet(): Boolean {
    return this.hadIdLinkSet_;
  }

  setHadIdLinkSet(): void {
    this.hadIdLinkSet_ = true;
  }

  insertLinkSet(e: LinkSet): LinkSet {
    return this.linkSetTable_.insert(e);
  }

  resultDtd(): Ptr<Dtd> {
    return this.resultDtd_;
  }

  resultDtdConst(): ConstPtr<Dtd> {
    return new ConstPtr<Dtd>(this.resultDtd_.pointer());
  }

  attributeDef(e: ElementType): ConstPtr<AttributeDefinitionList> {
    return this.linkAttributeDefs_.get(e.index());
  }

  setAttributeDef(e: ElementType, attdef: ConstPtr<AttributeDefinitionList>): void {
    this.linkAttributeDefs_.set(e.index(), attdef);
  }
}
