// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, Number as NumberType, Index } from './types';
import { Boolean } from './Boolean';
import { Resource } from './Resource';
import { Owner } from './Owner';
import { CopyOwner, Copyable } from './CopyOwner';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Vector } from './Vector';
import { Text } from './Text';
import { Ptr, ConstPtr } from './Ptr';
import { Message, Messenger } from './Message';
import { Location } from './Location';
import { Syntax } from './Syntax';
import { Notation } from './Notation';
import { Entity } from './Entity';

// AttributeValue - base class for all attribute values
export abstract class AttributeValue extends Resource {
  static readonly Type = {
    implied: 0,
    cdata: 1,
    tokenized: 2
  } as const;

  constructor() {
    super();
  }

  makeSemantics(
    declaredValue: DeclaredValue | null,
    context: AttributeContext,
    name: StringC,
    nIdrefs: { value: number },
    nEntityNames: { value: number }
  ): AttributeSemantics | null {
    return null;
  }

  abstract info(text: { value: Text | null }, str: { value: StringC | null }): number;

  text(): Text | null {
    return null;
  }

  recoverUnquoted(
    str: StringC,
    loc: Location,
    context: AttributeContext,
    name: StringC
  ): Boolean {
    return false;
  }

  static handleAsUnterminated(text: Text, context: AttributeContext): Boolean {
    // TODO: Implement
    return false;
  }
}

// AttributeDefinitionDesc - describes an attribute definition
export class AttributeDefinitionDesc {
  static readonly DeclaredValue = {
    cdata: 0,
    name: 1,
    number: 2,
    nmtoken: 3,
    nutoken: 4,
    entity: 5,
    idref: 6,
    names: 7,
    numbers: 8,
    nmtokens: 9,
    nutokens: 10,
    entities: 11,
    idrefs: 12,
    id: 13,
    notation: 14,
    nameTokenGroup: 15
  } as const;

  static readonly DefaultValueType = {
    required: 0,
    current: 1,
    implied: 2,
    conref: 3,
    defaulted: 4,
    fixed: 5
  } as const;

  declaredValue: number;
  defaultValueType: number;
  defaultValue: ConstPtr<AttributeValue>;
  allowedValues: Vector<StringC>;
  origAllowedValues: Vector<StringC>;
  currentIndex: number;

  constructor() {
    this.declaredValue = 0;
    this.defaultValueType = 0;
    this.defaultValue = new ConstPtr<AttributeValue>();
    this.allowedValues = new Vector<StringC>();
    this.origAllowedValues = new Vector<StringC>();
    this.currentIndex = 0;
  }
}

// DeclaredValue - base class for declared values
export abstract class DeclaredValue implements Copyable<DeclaredValue> {
  constructor() {}

  abstract makeValue(
    text: Text,
    context: AttributeContext,
    name: StringC,
    specLength: { value: number }
  ): AttributeValue | null;

  makeValueFromToken(
    text: Text,
    context: AttributeContext,
    name: StringC,
    specLength: { value: number }
  ): AttributeValue | null {
    return this.makeValue(text, context, name, specLength);
  }

  makeSemantics(
    value: TokenizedAttributeValue,
    context: AttributeContext,
    name: StringC,
    nIdrefs: { value: number },
    nEntityNames: { value: number }
  ): AttributeSemantics | null {
    return null;
  }

  containsToken(token: StringC): Boolean {
    return false;
  }

  abstract tokenized(): Boolean;

  isNotation(): Boolean {
    return false;
  }

  isEntity(): Boolean {
    return false;
  }

  isId(): Boolean {
    return false;
  }

  isIdref(): Boolean {
    return false;
  }

  getTokens(): Vector<StringC> | null {
    return null;
  }

  getOrigTokens(): Vector<StringC> | null {
    return null;
  }

  abstract buildDesc(desc: AttributeDefinitionDesc): void;

  abstract copy(): DeclaredValue;
}

// CdataDeclaredValue
export class CdataDeclaredValue extends DeclaredValue {
  constructor() {
    super();
  }

  tokenized(): Boolean {
    return false;
  }

  protected checkNormalizedLength(
    text: Text,
    context: AttributeContext,
    specLength: { value: number }
  ): void {
    // TODO: Implement normalization checking
  }

  makeValue(
    text: Text,
    context: AttributeContext,
    name: StringC,
    specLength: { value: number }
  ): AttributeValue | null {
    this.checkNormalizedLength(text, context, specLength);
    return new CdataAttributeValue(text);
  }

  buildDesc(desc: AttributeDefinitionDesc): void {
    desc.declaredValue = AttributeDefinitionDesc.DeclaredValue.cdata;
  }

  copy(): DeclaredValue {
    return new CdataDeclaredValue();
  }
}

// TokenizedDeclaredValue
export class TokenizedDeclaredValue extends DeclaredValue {
  static readonly TokenType = {
    name: 0,
    number: 1,
    nameToken: 2,
    numberToken: 3,
    entityName: 4
  } as const;

  protected type_: number;
  protected isList_: Boolean;
  protected initialCategories_: number;
  protected subsequentCategories_: number;

  constructor(type: number, isList: Boolean) {
    super();
    this.type_ = type;
    this.isList_ = isList;
    this.initialCategories_ = 0;
    this.subsequentCategories_ = 0;
    // TODO: Initialize categories based on type
  }

  makeValue(
    text: Text,
    context: AttributeContext,
    name: StringC,
    specLength: { value: number }
  ): AttributeValue | null {
    return this.makeTokenizedValue(text, context, name, specLength);
  }

  makeTokenizedValue(
    text: Text,
    context: AttributeContext,
    name: StringC,
    specLength: { value: number }
  ): TokenizedAttributeValue | null {
    // TODO: Implement tokenization
    return null;
  }

  tokenized(): Boolean {
    return true;
  }

  buildDesc(desc: AttributeDefinitionDesc): void {
    // Map TokenType to DeclaredValue
    const mapping = [
      AttributeDefinitionDesc.DeclaredValue.name,     // name
      AttributeDefinitionDesc.DeclaredValue.number,   // number
      AttributeDefinitionDesc.DeclaredValue.nmtoken,  // nameToken
      AttributeDefinitionDesc.DeclaredValue.nutoken,  // numberToken
      AttributeDefinitionDesc.DeclaredValue.entity    // entityName
    ];
    desc.declaredValue = mapping[this.type_] + (this.isList_ ? 4 : 0);
  }

  copy(): DeclaredValue {
    return new TokenizedDeclaredValue(this.type_, this.isList_);
  }
}

// GroupDeclaredValue
export class GroupDeclaredValue extends TokenizedDeclaredValue {
  private allowedValues_: Vector<StringC>;
  private origAllowedValues_: Vector<StringC>;

  constructor(type: number, allowedValues: Vector<StringC>) {
    super(type, false);
    this.allowedValues_ = new Vector<StringC>();
    this.allowedValues_.swap(allowedValues);
    this.origAllowedValues_ = new Vector<StringC>();
  }

  containsToken(token: StringC): Boolean {
    for (let i = 0; i < this.allowedValues_.size(); i++) {
      if (this.allowedValues_.get(i).equals(token)) {
        return true;
      }
    }
    return false;
  }

  makeValue(
    text: Text,
    context: AttributeContext,
    name: StringC,
    specLength: { value: number }
  ): AttributeValue | null {
    return this.makeTokenizedValue(text, context, name, specLength);
  }

  makeValueFromToken(
    text: Text,
    context: AttributeContext,
    name: StringC,
    specLength: { value: number }
  ): AttributeValue | null {
    return this.makeTokenizedValue(text, context, name, specLength);
  }

  getTokens(): Vector<StringC> | null {
    return this.allowedValues_;
  }

  getOrigTokens(): Vector<StringC> | null {
    return this.origAllowedValues_;
  }

  buildDesc(desc: AttributeDefinitionDesc): void {
    super.buildDesc(desc);
    desc.allowedValues = this.allowedValues_;
    desc.origAllowedValues = this.origAllowedValues_;
  }

  copy(): DeclaredValue {
    const values = new Vector<StringC>();
    for (let i = 0; i < this.allowedValues_.size(); i++) {
      values.push_back(this.allowedValues_.get(i));
    }
    return new GroupDeclaredValue(this.type_, values);
  }

  setOrigAllowedValues(origAllowedValues: Vector<StringC>): void {
    this.origAllowedValues_.swap(origAllowedValues);
  }
}

// NameTokenGroupDeclaredValue
export class NameTokenGroupDeclaredValue extends GroupDeclaredValue {
  constructor(allowedValues: Vector<StringC>) {
    super(TokenizedDeclaredValue.TokenType.nameToken, allowedValues);
  }

  buildDesc(desc: AttributeDefinitionDesc): void {
    desc.declaredValue = AttributeDefinitionDesc.DeclaredValue.nameTokenGroup;
    desc.allowedValues = this.getTokens()!;
    desc.origAllowedValues = this.getOrigTokens()!;
  }

  copy(): DeclaredValue {
    const values = new Vector<StringC>();
    const tokens = this.getTokens()!;
    for (let i = 0; i < tokens.size(); i++) {
      values.push_back(tokens.get(i));
    }
    return new NameTokenGroupDeclaredValue(values);
  }
}

// NotationDeclaredValue
export class NotationDeclaredValue extends GroupDeclaredValue {
  constructor(allowedValues: Vector<StringC>) {
    super(TokenizedDeclaredValue.TokenType.name, allowedValues);
  }

  makeSemantics(
    value: TokenizedAttributeValue,
    context: AttributeContext,
    name: StringC,
    nIdrefs: { value: number },
    nEntityNames: { value: number }
  ): AttributeSemantics | null {
    // TODO: Implement NotationAttributeSemantics
    return null;
  }

  isNotation(): Boolean {
    return true;
  }

  buildDesc(desc: AttributeDefinitionDesc): void {
    desc.declaredValue = AttributeDefinitionDesc.DeclaredValue.notation;
    desc.allowedValues = this.getTokens()!;
    desc.origAllowedValues = this.getOrigTokens()!;
  }

  copy(): DeclaredValue {
    const values = new Vector<StringC>();
    const tokens = this.getTokens()!;
    for (let i = 0; i < tokens.size(); i++) {
      values.push_back(tokens.get(i));
    }
    return new NotationDeclaredValue(values);
  }
}

// EntityDeclaredValue
export class EntityDeclaredValue extends TokenizedDeclaredValue {
  constructor(isList: Boolean) {
    super(TokenizedDeclaredValue.TokenType.entityName, isList);
  }

  makeSemantics(
    value: TokenizedAttributeValue,
    context: AttributeContext,
    name: StringC,
    nIdrefs: { value: number },
    nEntityNames: { value: number }
  ): AttributeSemantics | null {
    // TODO: Implement EntityAttributeSemantics
    return null;
  }

  isEntity(): Boolean {
    return true;
  }

  copy(): DeclaredValue {
    return new EntityDeclaredValue(this.isList_);
  }
}

// IdDeclaredValue
export class IdDeclaredValue extends TokenizedDeclaredValue {
  constructor() {
    super(TokenizedDeclaredValue.TokenType.name, false);
  }

  makeSemantics(
    value: TokenizedAttributeValue,
    context: AttributeContext,
    name: StringC,
    nIdrefs: { value: number },
    nEntityNames: { value: number }
  ): AttributeSemantics | null {
    // TODO: Implement ID checking
    return null;
  }

  isId(): Boolean {
    return true;
  }

  buildDesc(desc: AttributeDefinitionDesc): void {
    desc.declaredValue = AttributeDefinitionDesc.DeclaredValue.id;
  }

  copy(): DeclaredValue {
    return new IdDeclaredValue();
  }
}

// IdrefDeclaredValue
export class IdrefDeclaredValue extends TokenizedDeclaredValue {
  constructor(isList: Boolean) {
    super(TokenizedDeclaredValue.TokenType.name, isList);
  }

  makeSemantics(
    value: TokenizedAttributeValue,
    context: AttributeContext,
    name: StringC,
    nIdrefs: { value: number },
    nEntityNames: { value: number }
  ): AttributeSemantics | null {
    // TODO: Implement IDREF checking
    return null;
  }

  isIdref(): Boolean {
    return true;
  }

  buildDesc(desc: AttributeDefinitionDesc): void {
    if (this.isList_) {
      desc.declaredValue = AttributeDefinitionDesc.DeclaredValue.idrefs;
    } else {
      desc.declaredValue = AttributeDefinitionDesc.DeclaredValue.idref;
    }
  }

  copy(): DeclaredValue {
    return new IdrefDeclaredValue(this.isList_);
  }
}

// ImpliedAttributeValue
export class ImpliedAttributeValue extends AttributeValue {
  constructor() {
    super();
  }

  info(text: { value: Text | null }, str: { value: StringC | null }): number {
    text.value = null;
    str.value = null;
    return AttributeValue.Type.implied;
  }
}

// CdataAttributeValue
export class CdataAttributeValue extends AttributeValue {
  private text_: Text;

  constructor(text: Text) {
    super();
    this.text_ = new Text();
    this.text_.swap(text);
  }

  info(textResult: { value: Text | null }, str: { value: StringC | null }): number {
    textResult.value = this.text_;
    str.value = null;
    return AttributeValue.Type.cdata;
  }

  text(): Text | null {
    return this.text_;
  }
}

// TokenizedAttributeValue
export class TokenizedAttributeValue extends AttributeValue {
  private text_: Text;
  private tokens_: Vector<StringC>;

  constructor(text: Text, tokens: Vector<StringC>) {
    super();
    this.text_ = new Text();
    this.text_.swap(text);
    this.tokens_ = new Vector<StringC>();
    this.tokens_.swap(tokens);
  }

  info(textResult: { value: Text | null }, tokensResult: { value: StringC | null }): number {
    textResult.value = this.text_;
    // TODO: Properly return tokens (needs different signature)
    tokensResult.value = null;
    return AttributeValue.Type.tokenized;
  }

  text(): Text | null {
    return this.text_;
  }

  tokens(): Vector<StringC> {
    return this.tokens_;
  }
}


// AttributeContext - placeholder (abstract messenger)
export abstract class AttributeContext extends Messenger {
  constructor() {
    super();
  }

  abstract attributeSyntax(): Syntax;

  // Messenger abstract methods
  abstract dispatchMessage(message: Message): void;
  abstract dispatchMessage(type: any, ...args: any[]): void;
}

// AttributeDefinition - base class for attribute definitions
export abstract class AttributeDefinition {
  private implicit_: Boolean;
  private all_: Boolean;
  private name_: StringC;
  private origName_: StringC;
  protected declaredValue_: CopyOwner<DeclaredValue>;

  constructor(name: StringC, declaredValue: DeclaredValue) {
    this.implicit_ = false;
    this.all_ = false;
    this.name_ = name;
    this.origName_ = new StringOf<Char>();
    this.declaredValue_ = new CopyOwner<DeclaredValue>(declaredValue);
  }

  abstract makeMissingValue(context: AttributeContext): ConstPtr<AttributeValue>;

  missingValueWouldMatch(text: Text, context: AttributeContext): Boolean {
    return false;
  }

  defaultValue(impliedValue: AttributeValue | null): AttributeValue | null {
    return null;
  }

  makeValue(text: Text, context: AttributeContext, specLength: { value: number }): AttributeValue | null {
    return this.checkValue(this.declaredValue_.pointer()!.makeValue(text, context, this.name_, specLength), context);
  }

  makeValueFromToken(text: Text, context: AttributeContext, specLength: { value: number }): AttributeValue | null {
    return this.checkValue(this.declaredValue_.pointer()!.makeValueFromToken(text, context, this.name_, specLength), context);
  }

  isConref(): Boolean {
    return false;
  }

  isCurrent(): Boolean {
    return false;
  }

  isFixed(): Boolean {
    return false;
  }

  makeSemantics(
    value: AttributeValue | null,
    context: AttributeContext,
    nIdrefs: { value: number },
    nEntityNames: { value: number }
  ): AttributeSemantics | null {
    if (!value) {
      return null;
    }
    const textResult = { value: null as Text | null };
    const strResult = { value: null as StringC | null };
    const type = value.info(textResult, strResult);
    if (type !== AttributeValue.Type.tokenized) {
      return null;
    }
    return this.declaredValue_.pointer()!.makeSemantics(
      value as TokenizedAttributeValue,
      context,
      this.name_,
      nIdrefs,
      nEntityNames
    );
  }

  tokenized(): Boolean {
    return this.declaredValue_.pointer()!.tokenized();
  }

  name(): StringC {
    return this.name_;
  }

  origName(): StringC {
    return this.origName_;
  }

  containsToken(token: StringC): Boolean {
    return this.declaredValue_.pointer()!.containsToken(token);
  }

  isNotation(): Boolean {
    return this.declaredValue_.pointer()!.isNotation();
  }

  isEntity(): Boolean {
    return this.declaredValue_.pointer()!.isEntity();
  }

  isId(): Boolean {
    return this.declaredValue_.pointer()!.isId();
  }

  isIdref(): Boolean {
    return this.declaredValue_.pointer()!.isIdref();
  }

  getDesc(desc: AttributeDefinitionDesc): void {
    desc.allowedValues.clear();
    desc.defaultValue = new ConstPtr<AttributeValue>();
    desc.currentIndex = 0;
    this.buildDesc(desc);
    this.declaredValue_.pointer()!.buildDesc(desc);
  }

  getTokens(): Vector<StringC> | null {
    return this.declaredValue_.pointer()!.getTokens();
  }

  getOrigTokens(): Vector<StringC> | null {
    return this.declaredValue_.pointer()!.getOrigTokens();
  }

  abstract copy(): AttributeDefinition;

  setDeclaredValue(declaredValue: DeclaredValue): void {
    this.declaredValue_ = new CopyOwner<DeclaredValue>(declaredValue);
  }

  setSpecified(implicit: Boolean): void {
    if (implicit) {
      this.implicit_ = true;
    } else {
      this.all_ = true;
    }
  }

  isSpecified(implicit: { value: Boolean }): Boolean {
    implicit.value = this.implicit_;
    return this.implicit_ || this.all_;
  }

  setOrigName(origName: StringC): void {
    this.origName_.swap(origName);
  }

  protected abstract buildDesc(desc: AttributeDefinitionDesc): void;

  protected checkValue(value: AttributeValue | null, context: AttributeContext): AttributeValue | null {
    return value;
  }
}

// RequiredAttributeDefinition
export class RequiredAttributeDefinition extends AttributeDefinition {
  constructor(name: StringC, declaredValue: DeclaredValue) {
    super(name, declaredValue);
  }

  makeMissingValue(context: AttributeContext): ConstPtr<AttributeValue> {
    // TODO: Add validation and message
    return new ConstPtr<AttributeValue>();
  }

  protected buildDesc(desc: AttributeDefinitionDesc): void {
    desc.defaultValueType = AttributeDefinitionDesc.DefaultValueType.required;
  }

  copy(): AttributeDefinition {
    return new RequiredAttributeDefinition(this.name(), this.declaredValue_.pointer()!.copy());
  }
}

// CurrentAttributeDefinition
export class CurrentAttributeDefinition extends AttributeDefinition {
  private currentIndex_: number;

  constructor(name: StringC, declaredValue: DeclaredValue, index: number) {
    super(name, declaredValue);
    this.currentIndex_ = index;
  }

  makeMissingValue(context: AttributeContext): ConstPtr<AttributeValue> {
    // TODO: Implement current attribute retrieval
    return new ConstPtr<AttributeValue>();
  }

  missingValueWouldMatch(text: Text, context: AttributeContext): Boolean {
    // TODO: Implement current attribute matching
    return false;
  }

  protected checkValue(value: AttributeValue | null, context: AttributeContext): AttributeValue | null {
    // TODO: Note current attribute
    return value;
  }

  protected buildDesc(desc: AttributeDefinitionDesc): void {
    desc.defaultValueType = AttributeDefinitionDesc.DefaultValueType.current;
    desc.currentIndex = this.currentIndex_;
  }

  isCurrent(): Boolean {
    return true;
  }

  copy(): AttributeDefinition {
    return new CurrentAttributeDefinition(this.name(), this.declaredValue_.pointer()!.copy(), this.currentIndex_);
  }
}

// ImpliedAttributeDefinition
export class ImpliedAttributeDefinition extends AttributeDefinition {
  constructor(name: StringC, declaredValue: DeclaredValue) {
    super(name, declaredValue);
  }

  makeMissingValue(context: AttributeContext): ConstPtr<AttributeValue> {
    return new ConstPtr<AttributeValue>(new ImpliedAttributeValue());
  }

  defaultValue(impliedValue: AttributeValue | null): AttributeValue | null {
    return impliedValue;
  }

  protected buildDesc(desc: AttributeDefinitionDesc): void {
    desc.defaultValueType = AttributeDefinitionDesc.DefaultValueType.implied;
  }

  copy(): AttributeDefinition {
    return new ImpliedAttributeDefinition(this.name(), this.declaredValue_.pointer()!.copy());
  }
}

// ConrefAttributeDefinition
export class ConrefAttributeDefinition extends ImpliedAttributeDefinition {
  constructor(name: StringC, declaredValue: DeclaredValue) {
    super(name, declaredValue);
  }

  isConref(): Boolean {
    return true;
  }

  protected buildDesc(desc: AttributeDefinitionDesc): void {
    desc.defaultValueType = AttributeDefinitionDesc.DefaultValueType.conref;
  }

  copy(): AttributeDefinition {
    return new ConrefAttributeDefinition(this.name(), this.declaredValue_.pointer()!.copy());
  }
}

// DefaultAttributeDefinition
export class DefaultAttributeDefinition extends AttributeDefinition {
  private value_: ConstPtr<AttributeValue>;

  constructor(name: StringC, declaredValue: DeclaredValue, value: AttributeValue) {
    super(name, declaredValue);
    this.value_ = new ConstPtr<AttributeValue>(value);
  }

  makeMissingValue(context: AttributeContext): ConstPtr<AttributeValue> {
    return this.value_;
  }

  missingValueWouldMatch(text: Text, context: AttributeContext): Boolean {
    const valueText = this.value_.pointer()!.text();
    if (!valueText) {
      return false;
    }
    // TODO: Implement text.fixedEqual()
    return false;
  }

  protected buildDesc(desc: AttributeDefinitionDesc): void {
    desc.defaultValueType = AttributeDefinitionDesc.DefaultValueType.defaulted;
    desc.defaultValue = this.value_;
  }

  defaultValue(impliedValue: AttributeValue | null): AttributeValue | null {
    return this.value_.pointer();
  }

  copy(): AttributeDefinition {
    return new DefaultAttributeDefinition(this.name(), this.declaredValue_.pointer()!.copy(), this.value_.pointer()!);
  }
}

// FixedAttributeDefinition
export class FixedAttributeDefinition extends DefaultAttributeDefinition {
  constructor(name: StringC, declaredValue: DeclaredValue, value: AttributeValue) {
    super(name, declaredValue, value);
  }

  protected checkValue(value: AttributeValue | null, context: AttributeContext): AttributeValue | null {
    // TODO: Check that value equals default
    return value;
  }

  protected buildDesc(desc: AttributeDefinitionDesc): void {
    super.buildDesc(desc);
    desc.defaultValueType = AttributeDefinitionDesc.DefaultValueType.fixed;
  }

  isFixed(): Boolean {
    return true;
  }

  copy(): AttributeDefinition {
    const defaultVal = this.defaultValue(null);
    return new FixedAttributeDefinition(this.name(), this.declaredValue_.pointer()!.copy(), defaultVal!);
  }
}

// AttributeDefinitionList
export class AttributeDefinitionList extends Resource {
  private defs_: Vector<CopyOwner<AttributeDefinition>>;
  private index_: number;
  private idIndex_: number;
  private notationIndex_: number;
  private anyCurrent_: Boolean;
  private prev_: ConstPtr<AttributeDefinitionList>;

  constructor(defs: Vector<CopyOwner<AttributeDefinition>>, listIndex: number, anyCurrent?: Boolean, idIndex?: number, notationIndex?: number);
  constructor(other: ConstPtr<AttributeDefinitionList>);
  constructor(
    defsOrOther: Vector<CopyOwner<AttributeDefinition>> | ConstPtr<AttributeDefinitionList>,
    listIndex?: number,
    anyCurrent: Boolean = false,
    idIndex: number = -1,
    notationIndex: number = -1
  ) {
    super();
    if (defsOrOther instanceof ConstPtr) {
      // Copy constructor
      const other = defsOrOther.pointer()!;
      this.defs_ = new Vector<CopyOwner<AttributeDefinition>>();
      this.index_ = other.index_;
      this.idIndex_ = other.idIndex_;
      this.notationIndex_ = other.notationIndex_;
      this.anyCurrent_ = other.anyCurrent_;
      this.prev_ = defsOrOther;
    } else {
      // Regular constructor
      this.defs_ = new Vector<CopyOwner<AttributeDefinition>>();
      this.defs_.swap(defsOrOther);
      this.index_ = listIndex!;
      this.idIndex_ = idIndex;
      this.notationIndex_ = notationIndex;
      this.anyCurrent_ = anyCurrent;
      this.prev_ = new ConstPtr<AttributeDefinitionList>();
    }
  }

  size(): number {
    return this.defs_.size();
  }

  def(i: number): AttributeDefinition {
    return this.defs_.get(i).pointer()!;
  }

  constDef(i: number): AttributeDefinition {
    return this.defs_.get(i).pointer()!;
  }

  tokenIndex(token: StringC, result: { value: number }): Boolean {
    for (let i = 0; i < this.defs_.size(); i++) {
      if (this.defs_.get(i).pointer()!.containsToken(token)) {
        result.value = i;
        return true;
      }
    }
    return false;
  }

  tokenIndexUnique(token: StringC, i: number): Boolean {
    for (let j = 0; j < this.defs_.size(); j++) {
      if (j !== i && this.defs_.get(j).pointer()!.containsToken(token)) {
        return false;
      }
    }
    return true;
  }

  attributeIndex(name: StringC, result: { value: number }): Boolean {
    for (let i = 0; i < this.defs_.size(); i++) {
      if (this.defs_.get(i).pointer()!.name().equals(name)) {
        result.value = i;
        return true;
      }
    }
    return false;
  }

  index(): number {
    return this.index_;
  }

  idIndex(): number {
    return this.idIndex_;
  }

  notationIndex(): number {
    return this.notationIndex_;
  }

  anyCurrent(): Boolean {
    return this.anyCurrent_;
  }

  setIndex(index: number): void {
    this.index_ = index;
  }

  append(def: AttributeDefinition): void {
    this.defs_.push_back(new CopyOwner<AttributeDefinition>(def));
  }
}

// Enhanced AttributeSemantics with virtual methods
export abstract class AttributeSemantics {
  constructor() {}

  nEntities(): number {
    return 0;
  }

  entity(i: number): ConstPtr<Entity> {
    return new ConstPtr<Entity>();
  }

  notation(): ConstPtr<Notation> {
    return new ConstPtr<Notation>();
  }

  abstract copy(): AttributeSemantics;
}

// EntityAttributeSemantics
export class EntityAttributeSemantics extends AttributeSemantics {
  private entity_: Vector<ConstPtr<Entity>>;

  constructor(entities: Vector<ConstPtr<Entity>>) {
    super();
    this.entity_ = new Vector<ConstPtr<Entity>>();
    this.entity_.swap(entities);
  }

  nEntities(): number {
    return this.entity_.size();
  }

  entity(i: number): ConstPtr<Entity> {
    return this.entity_.get(i);
  }

  copy(): AttributeSemantics {
    const entities = new Vector<ConstPtr<Entity>>();
    for (let i = 0; i < this.entity_.size(); i++) {
      entities.push_back(this.entity_.get(i));
    }
    return new EntityAttributeSemantics(entities);
  }
}

// NotationAttributeSemantics
export class NotationAttributeSemantics extends AttributeSemantics {
  private notation_: ConstPtr<Notation>;

  constructor(notation: ConstPtr<Notation>) {
    super();
    this.notation_ = notation;
  }

  notation(): ConstPtr<Notation> {
    return this.notation_;
  }

  copy(): AttributeSemantics {
    return new NotationAttributeSemantics(this.notation_);
  }
}

// DataDeclaredValue
export class DataDeclaredValue extends CdataDeclaredValue {
  private notation_: ConstPtr<Notation>;
  private attributes_: AttributeList;

  constructor(notation: ConstPtr<Notation>, attributes: AttributeList) {
    super();
    this.notation_ = notation;
    this.attributes_ = new AttributeList();
    this.attributes_.swap(attributes);
  }

  makeValue(text: Text, context: AttributeContext, name: StringC, specLength: { value: number }): AttributeValue | null {
    this.checkNormalizedLength(text, context, specLength);
    return new DataAttributeValue(text, this.notation_, this.attributes_);
  }

  copy(): DeclaredValue {
    return new DataDeclaredValue(this.notation_, this.attributes_);
  }
}

// DataAttributeValue
export class DataAttributeValue extends CdataAttributeValue {
  private notation_: ConstPtr<Notation>;
  private attributes_: AttributeList;

  constructor(text: Text, notation: ConstPtr<Notation>, attributes: AttributeList) {
    super(text);
    this.notation_ = notation;
    this.attributes_ = new AttributeList();
    this.attributes_.swap(attributes);
  }

  notation(): Notation | null {
    return this.notation_.pointer();
  }

  attributes(): AttributeList {
    return this.attributes_;
  }
}

// AttributeList - placeholder for attribute list type
export class AttributeList {
  constructor() {}

  swap(other: AttributeList): void {
    // TODO: Implement swap
  }
}
