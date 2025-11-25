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
import { StringMessageArg, NumberMessageArg } from './MessageArg';
import * as ParserMessages from './ParserMessages';
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

  // Port of AttributeValue::handleAsUnterminated from Attribute.cxx (lines 1377-1410)
  // This tries to guess if this attribute value looks like it had a missing ending quote.
  static handleAsUnterminated(text: Text, context: AttributeContext): Boolean {
    // TODO: Implement full logic - requires TextIter
    // For now, return false (no unterminated attribute handling)
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
// Port of NotationDeclaredValue class from Attribute.cxx (lines 420-460)
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
    // Port of NotationDeclaredValue::makeSemantics from Attribute.cxx (lines 431-449)
    const notation = context.getAttributeNotation(value.string(), value.tokenLocation(0));
    if (notation.isNull()) {
      if (context.validate()) {
        context.setNextLocation(value.tokenLocation(0));
        context.message(ParserMessages.invalidNotationAttribute, new StringMessageArg(value.string()));
      }
      return null;
    }
    return new NotationAttributeSemantics(notation);
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
// Port of EntityDeclaredValue class from Attribute.cxx (lines 462-512)
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
    // Port of EntityDeclaredValue::makeSemantics from Attribute.cxx (lines 473-507)
    let valid = true;
    const nTokens = value.nTokens();
    nEntityNames.value += nTokens;
    const entities = new Vector<ConstPtr<Entity>>(nTokens);
    for (let i = 0; i < nTokens; i++) {
      const entity = context.getAttributeEntity(value.token(i), value.tokenLocation(i));
      entities.set(i, entity);
      if (entity.isNull()) {
        if (context.validate()) {
          context.setNextLocation(value.tokenLocation(i));
          context.message(ParserMessages.invalidEntityAttribute, new StringMessageArg(value.token(i)));
        }
        valid = false;
      } else if (!entity.pointer()!.isDataOrSubdoc()) {
        if (context.validate()) {
          context.setNextLocation(value.tokenLocation(i));
          context.message(ParserMessages.notDataOrSubdocEntity, new StringMessageArg(value.token(i)));
        }
        valid = false;
      }
    }
    if (valid) {
      return new EntityAttributeSemantics(entities);
    }
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
// Port of IdDeclaredValue class from Attribute.cxx (lines 514-549)
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
    // Port of IdDeclaredValue::makeSemantics from Attribute.cxx (lines 525-539)
    const prevLoc = { value: new Location() };
    if (!context.defineId(value.string(), value.tokenLocation(0), prevLoc)) {
      context.setNextLocation(value.tokenLocation(0));
      context.message(ParserMessages.duplicateId, new StringMessageArg(value.string()), prevLoc.value);
    }
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
// Port of IdrefDeclaredValue class from Attribute.cxx (lines 551-587)
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
    // Port of IdrefDeclaredValue::makeSemantics from Attribute.cxx (lines 557-568)
    const nTokens = value.nTokens();
    nIdrefs.value += nTokens;
    for (let i = 0; i < nTokens; i++) {
      context.noteIdref(value.token(i), value.tokenLocation(i));
    }
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
// Port of TokenizedAttributeValue class from Attribute.h (lines 434-459) and Attribute.cxx (lines 1052-1081)
export class TokenizedAttributeValue extends AttributeValue {
  private text_: Text;
  // index into value of each space
  // length is number of tokens - 1
  private spaceIndex_: Vector<number>;

  constructor(text: Text, spaceIndex: Vector<number>) {
    super();
    this.text_ = new Text();
    this.text_.swap(text);
    this.spaceIndex_ = new Vector<number>();
    for (let i = 0; i < spaceIndex.size(); i++) {
      this.spaceIndex_.push_back(spaceIndex.get(i));
    }
  }

  info(textResult: { value: Text | null }, strResult: { value: StringC | null }): number {
    textResult.value = null;
    strResult.value = this.text_.string();
    return AttributeValue.Type.tokenized;
  }

  text(): Text | null {
    return this.text_;
  }

  // Port of Attribute.h (lines 726-729)
  nTokens(): number {
    return this.spaceIndex_.size() + 1;
  }

  // Port of Attribute.h (lines 732-735)
  string(): StringC {
    return this.text_.string();
  }

  // Port of Attribute.h (lines 747-753)
  token(i: number): StringC {
    const startIndex = i === 0 ? 0 : this.spaceIndex_.get(i - 1) + 1;
    const endIndex = i === this.spaceIndex_.size() ? this.text_.size() : this.spaceIndex_.get(i);
    const len = endIndex - startIndex;
    const str = this.text_.string();
    const result = new StringOf<Char>();
    for (let j = 0; j < len; j++) {
      result.appendChar(str.get(startIndex + j));
    }
    return result;
  }

  // Port of Attribute.h (lines 757-760)
  tokenLocation(i: number): Location {
    const charIndex = i === 0 ? 0 : this.spaceIndex_.get(i - 1) + 1;
    return this.text_.charLocation(charIndex);
  }

  makeSemantics(
    declaredValue: DeclaredValue | null,
    context: AttributeContext,
    name: StringC,
    nIdrefs: { value: number },
    nEntityNames: { value: number }
  ): AttributeSemantics | null {
    if (this.text_.size() === 0) {
      return null;
    }
    if (!declaredValue) {
      return null;
    }
    return declaredValue.makeSemantics(this, context, name, nIdrefs, nEntityNames);
  }
}


// AttributeContext - placeholder (abstract messenger)
// Port of AttributeContext class from Attribute.h (lines 555-577)
export abstract class AttributeContext extends Messenger {
  protected mayDefaultAttribute_: Boolean;
  protected validate_: Boolean;

  constructor() {
    super();
    this.mayDefaultAttribute_ = true;
    this.validate_ = true;
  }

  abstract attributeSyntax(): Syntax;

  // Messenger abstract methods
  abstract dispatchMessage(message: Message): void;
  abstract dispatchMessage(type: any, ...args: any[]): void;

  // Port of Attribute.h (lines 559-560) - virtual methods for ID/IDREF handling
  // Returns true if the ID was successfully defined (not duplicate)
  // If duplicate, prevLoc is set to the location of the previous definition
  defineId(id: StringC, loc: Location, prevLoc: { value: Location }): Boolean {
    // Default implementation always succeeds (no ID tracking)
    return true;
  }

  // Note an IDREF for later validation
  noteIdref(idref: StringC, loc: Location): void {
    // Default implementation does nothing
  }

  // Note current attribute value (for attributes with CURRENT default)
  noteCurrentAttribute(index: number, value: AttributeValue | null): void {
    // Default implementation does nothing
  }

  // Get current attribute value (for attributes with CURRENT default)
  getCurrentAttribute(index: number): ConstPtr<AttributeValue> {
    return new ConstPtr<AttributeValue>();
  }

  // Get entity for ENTITY/ENTITIES attribute
  getAttributeEntity(name: StringC, loc: Location): ConstPtr<Entity> {
    // Default implementation returns null
    return new ConstPtr<Entity>();
  }

  // Get notation for NOTATION attribute
  getAttributeNotation(name: StringC, loc: Location): ConstPtr<Notation> {
    // Default implementation returns null
    return new ConstPtr<Notation>();
  }

  mayDefaultAttribute(): Boolean {
    return this.mayDefaultAttribute_;
  }

  validate(): Boolean {
    return this.validate_;
  }
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

// Attribute - individual attribute in a list
// Port of Attribute class from Attribute.h (lines 460-480) and Attribute.cxx (lines 1146-1188)
export class Attribute {
  private specIndexPlus_: number;
  private value_: ConstPtr<AttributeValue>;
  private semantics_: CopyOwner<AttributeSemantics> | null;

  constructor(other?: Attribute) {
    if (other) {
      // Copy constructor from Attribute.cxx (lines 1154-1158)
      this.specIndexPlus_ = other.specIndexPlus_;
      this.value_ = new ConstPtr<AttributeValue>(other.value_);
      this.semantics_ = other.semantics_ ? new CopyOwner<AttributeSemantics>(other.semantics_.pointer()!) : null;
    } else {
      // Default constructor from Attribute.cxx (lines 1146-1148)
      this.specIndexPlus_ = 0;
      this.value_ = new ConstPtr<AttributeValue>();
      this.semantics_ = null;
    }
  }

  // Port of Attribute.cxx (lines 1176-1182)
  clear(): void {
    this.specIndexPlus_ = 0;
    this.value_.clear();
    this.semantics_ = null;
  }

  specified(): Boolean {
    return this.specIndexPlus_ !== 0;
  }

  specIndex(): number {
    return this.specIndexPlus_ - 1;
  }

  value(): AttributeValue | null {
    return this.value_.pointer();
  }

  valuePointer(): ConstPtr<AttributeValue> {
    return this.value_;
  }

  semantics(): AttributeSemantics | null {
    return this.semantics_?.pointer() ?? null;
  }

  setSpec(specIndex: number): void {
    this.specIndexPlus_ = specIndex + 1;
  }

  setValue(value: ConstPtr<AttributeValue> | AttributeValue | null): void {
    if (value instanceof ConstPtr) {
      this.value_ = value;
    } else {
      this.value_ = new ConstPtr<AttributeValue>(value);
    }
  }

  setSemantics(semantics: AttributeSemantics | null): void {
    if (semantics) {
      this.semantics_ = new CopyOwner<AttributeSemantics>(semantics);
    } else {
      this.semantics_ = null;
    }
  }
}

// AttributeList - manages attributes for an element
// Port of AttributeList class from Attribute.h (lines 482-528) and Attribute.cxx (lines 1184-1371)
export class AttributeList {
  private vec_: Vector<Attribute>;
  private def_: ConstPtr<AttributeDefinitionList>;
  private nSpec_: number;
  private conref_: Boolean;
  private nIdrefs_: number;
  private nEntityNames_: number;

  constructor(def?: ConstPtr<AttributeDefinitionList>) {
    if (def) {
      // Port of AttributeList.cxx (lines 1184-1188)
      this.def_ = def;
      this.vec_ = new Vector<Attribute>(def.isNull() ? 0 : def.pointer()!.size());
      for (let i = 0; i < this.vec_.size(); i++) {
        this.vec_.set(i, new Attribute());
      }
      this.nSpec_ = 0;
      this.conref_ = false;
      this.nIdrefs_ = 0;
      this.nEntityNames_ = 0;
    } else {
      // Port of AttributeList.cxx (lines 1190-1192)
      this.vec_ = new Vector<Attribute>();
      this.def_ = new ConstPtr<AttributeDefinitionList>();
      this.nSpec_ = 0;
      this.conref_ = false;
      this.nIdrefs_ = 0;
      this.nEntityNames_ = 0;
    }
  }

  // Port of AttributeList.cxx (lines 1190-1208)
  init(def: ConstPtr<AttributeDefinitionList>): void {
    this.def_ = def;
    this.nSpec_ = 0;
    this.conref_ = false;
    this.nIdrefs_ = 0;
    this.nEntityNames_ = 0;
    if (this.def_.isNull()) {
      this.vec_.resize(0);
    } else {
      const newLength = def.pointer()!.size();
      let clearLim = this.vec_.size();
      if (clearLim > newLength) {
        clearLim = newLength;
      }
      this.vec_.resize(newLength);
      for (let i = 0; i < clearLim; i++) {
        this.vec_.get(i).clear();
      }
    }
  }

  // Port of AttributeList.cxx (lines 1216-1241)
  swap(other: AttributeList): void {
    this.vec_.swap(other.vec_);
    this.def_.swap(other.def_);

    let tem = other.nIdrefs_;
    other.nIdrefs_ = this.nIdrefs_;
    this.nIdrefs_ = tem;

    tem = other.nEntityNames_;
    other.nEntityNames_ = this.nEntityNames_;
    this.nEntityNames_ = tem;

    let temSize = other.nSpec_;
    other.nSpec_ = this.nSpec_;
    this.nSpec_ = temSize;

    const temBool = other.conref_;
    other.conref_ = this.conref_;
    this.conref_ = temBool;
  }

  // Port of Attribute.h (lines 843-846)
  tokenIndex(name: StringC, result: { value: number }): boolean {
    if (this.def_.isNull()) {
      return false;
    }
    return this.def_.pointer()!.tokenIndex(name, result);
  }

  // Port of AttributeList.cxx (lines 1357-1371)
  handleAsUnterminated(context: AttributeContext): boolean {
    if (this.nSpec_ > 0) {
      for (let i = 0; i < this.vec_.size(); i++) {
        if (this.vec_.get(i).specified() && this.vec_.get(i).specIndex() === this.nSpec_ - 1) {
          const val = this.vec_.get(i).value();
          const ptr = val?.text();
          if (val && ptr && AttributeValue.handleAsUnterminated(ptr, context)) {
            return true;
          }
          break;
        }
      }
    }
    return false;
  }

  // Port of AttributeList.cxx (lines 1280-1283)
  noteInvalidSpec(): void {
    // This is needed for error recovery.
    // We don't want nSpec_ to be > 0, if there is no attribute definition.
    if (this.nSpec_ > 0) {
      this.nSpec_++;
    }
  }

  // Port of Attribute.h (lines 849-852)
  tokenIndexUnique(name: StringC, index: number): boolean {
    return this.def_.pointer()!.tokenIndexUnique(name, index);
  }

  // Port of AttributeList.cxx (lines 1242-1269)
  finish(context: AttributeContext): void {
    for (let i = 0; i < this.vec_.size(); i++) {
      if (!this.vec_.get(i).specified()) {
        const value = this.def(i).makeMissingValue(context);
        if (!this.conref_ || this.def_.pointer()!.notationIndex() !== i) {
          this.vec_.get(i).setValue(value);
          if (!value.isNull()) {
            const nIdrefsRef = { value: this.nIdrefs_ };
            const nEntityNamesRef = { value: this.nEntityNames_ };
            const semantics = this.def(i).makeSemantics(value.pointer(), context, nIdrefsRef, nEntityNamesRef);
            this.nIdrefs_ = nIdrefsRef.value;
            this.nEntityNames_ = nEntityNamesRef.value;
            this.vec_.get(i).setSemantics(semantics);
          }
        }
      }
    }
    const syntax = context.attributeSyntax();
    if (this.nIdrefs_ > syntax.grpcnt()) {
      context.message(ParserMessages.idrefGrpcnt, new NumberMessageArg(syntax.grpcnt()));
    }
    if (this.nEntityNames_ > syntax.grpcnt()) {
      context.message(ParserMessages.entityNameGrpcnt, new NumberMessageArg(syntax.grpcnt()));
    }
    // TypeScript doesn't have a validate() method on AttributeContext base class
    // It's provided by concrete implementations like ParserState
    const contextWithValidate = context as any;
    if (contextWithValidate.validate &&
        contextWithValidate.validate() &&
        this.conref_ &&
        this.def_.pointer()!.notationIndex() !== -1 &&
        this.specified(this.def_.pointer()!.notationIndex())) {
      context.message(ParserMessages.conrefNotation);
    }
  }

  // Port of AttributeList.cxx (lines 1271-1278)
  setSpec(index: number, context: AttributeContext): void {
    if (this.vec_.get(index).specified()) {
      context.message(
        ParserMessages.duplicateAttributeSpec,
        new StringMessageArg(this.def(index).name())
      );
    } else {
      this.vec_.get(index).setSpec(this.nSpec_++);
    }
  }

  // Port of AttributeList.cxx (lines 1304-1316)
  setValueToken(index: number, text: Text, context: AttributeContext, specLength: { value: number }): void {
    const value = this.def(index).makeValueFromToken(text, context, specLength);
    if (this.def(index).isConref()) {
      this.conref_ = true;
    }
    this.vec_.get(index).setValue(value);
    if (value) {
      const nIdrefsRef = { value: this.nIdrefs_ };
      const nEntityNamesRef = { value: this.nEntityNames_ };
      const semantics = this.def(index).makeSemantics(value, context, nIdrefsRef, nEntityNamesRef);
      this.nIdrefs_ = nIdrefsRef.value;
      this.nEntityNames_ = nEntityNamesRef.value;
      this.vec_.get(index).setSemantics(semantics);
    }
  }

  // Port of Attribute.h (lines 855-858)
  attributeIndex(name: StringC, result: { value: number }): boolean {
    if (this.def_.isNull()) {
      return false;
    }
    return this.def_.pointer()!.attributeIndex(name, result);
  }

  // Port of Attribute.h (lines 837-840)
  tokenized(index: number): boolean {
    return this.def(index).tokenized();
  }

  // Port of AttributeList.cxx (lines 1288-1302)
  setValue(index: number, text: Text, context: AttributeContext, specLength: { value: number }): boolean {
    const value = this.def(index).makeValue(text, context, specLength);
    if (this.def(index).isConref()) {
      this.conref_ = true;
    }
    this.vec_.get(index).setValue(value);
    if (value) {
      const nIdrefsRef = { value: this.nIdrefs_ };
      const nEntityNamesRef = { value: this.nEntityNames_ };
      const semantics = this.def(index).makeSemantics(value, context, nIdrefsRef, nEntityNamesRef);
      this.nIdrefs_ = nIdrefsRef.value;
      this.nEntityNames_ = nEntityNamesRef.value;
      this.vec_.get(index).setSemantics(semantics);
    } else if (AttributeValue.handleAsUnterminated(text, context)) {
      return false;
    }
    return true;
  }

  // Helper methods from Attribute.h (lines 819-873)

  size(): number {
    return this.vec_.size();
  }

  private def(i: number): AttributeDefinition {
    return this.def_.pointer()!.def(i);
  }

  defPtr(): ConstPtr<AttributeDefinitionList> {
    return this.def_;
  }

  name(i: number): StringC {
    return this.def(i).name();
  }

  value(i: number): AttributeValue | null {
    return this.vec_.get(i).value();
  }

  valuePointer(i: number): ConstPtr<AttributeValue> {
    return this.vec_.get(i).valuePointer();
  }

  semantics(i: number): AttributeSemantics | null {
    return this.vec_.get(i).semantics();
  }

  specified(i: number): Boolean {
    return this.vec_.get(i).specified();
  }

  specIndex(i: number): number {
    return this.vec_.get(i).specIndex();
  }

  nSpec(): number {
    return this.nSpec_;
  }

  conref(): Boolean {
    return this.conref_;
  }
}
