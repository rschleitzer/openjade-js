// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char } from './types';
import { Boolean } from './Boolean';
import { Resource } from './Resource';
import { StringC } from './StringC';
import { Vector } from './Vector';
import { Ptr, ConstPtr } from './Ptr';
import { HashTable } from './HashTable';
import { NamedTable, NamedTableIter, ConstNamedTableIter } from './NamedTable';
import { NamedResourceTable, NamedResourceTableIter, ConstNamedResourceTableIter } from './NamedResourceTable';
import { Entity } from './Entity';
import { Notation } from './Notation';
import { AttributeDefinitionList } from './Attribute';
import { StringResource } from './StringResource';
import { ElementType, RankStem } from './ElementType';
import { ShortReferenceMap } from './ShortReferenceMap';
import { Syntax } from './Syntax';

export class ParserState { }

// Dtd - Document Type Definition
export class Dtd extends Resource {
  // Type aliases for iterators
  static ElementTypeIter = NamedTableIter<ElementType>;
  static ConstElementTypeIter = ConstNamedTableIter<ElementType>;
  static RankStemIter = NamedTableIter<RankStem>;
  static ConstRankStemIter = ConstNamedTableIter<RankStem>;
  static ShortReferenceMapIter = NamedTableIter<ShortReferenceMap>;
  static ConstNotationIter = ConstNamedResourceTableIter<Notation>;
  static NotationIter = NamedResourceTableIter<Notation>;
  static ConstEntityIter = ConstNamedResourceTableIter<Entity>;
  static EntityIter = NamedResourceTableIter<Entity>;

  private generalEntityTable_: NamedResourceTable<Entity>;
  private parameterEntityTable_: NamedResourceTable<Entity>;
  private defaultEntity_: ConstPtr<Entity>;
  private name_: ConstPtr<StringResource<Char>>;
  private elementTypeTable_: NamedTable<ElementType>;
  private rankStemTable_: NamedTable<RankStem>;
  private shortReferenceMapTable_: NamedTable<ShortReferenceMap>;
  private notationTable_: NamedResourceTable<Notation>;
  private nCurrentAttribute_: number;
  private nElementDefinition_: number;
  private nAttributeDefinitionList_: number;
  private nElementType_: number;
  private documentElementType_: ElementType | null;
  private shortrefs_: Vector<StringC>;
  private shortrefTable_: HashTable<StringC, number>;
  private isBase_: Boolean;
  private isInstantitated_: Boolean;
  private implicitElementAttributeDef_: Ptr<AttributeDefinitionList>;
  private implicitNotationAttributeDef_: Ptr<AttributeDefinitionList>;

  constructor(name: StringC, isBase: Boolean) {
    super();
    this.name_ = new ConstPtr<StringResource<Char>>(new StringResource<Char>(name));
    this.generalEntityTable_ = new NamedResourceTable<Entity>();
    this.parameterEntityTable_ = new NamedResourceTable<Entity>();
    this.defaultEntity_ = new ConstPtr<Entity>();
    this.elementTypeTable_ = new NamedTable<ElementType>();
    this.rankStemTable_ = new NamedTable<RankStem>();
    this.shortReferenceMapTable_ = new NamedTable<ShortReferenceMap>();
    this.notationTable_ = new NamedResourceTable<Notation>();
    this.nCurrentAttribute_ = 0;
    this.nElementDefinition_ = 0;
    this.nAttributeDefinitionList_ = 0;
    this.nElementType_ = 0;
    this.isBase_ = isBase;
    this.isInstantitated_ = false;
    this.shortrefs_ = new Vector<StringC>();
    this.shortrefTable_ = new HashTable<StringC, number>();
    this.implicitElementAttributeDef_ = new Ptr<AttributeDefinitionList>();
    this.implicitNotationAttributeDef_ = new Ptr<AttributeDefinitionList>();

    // Create document element type
    this.documentElementType_ = new ElementType(name, this.allocElementTypeIndex());
    this.insertElementType(this.documentElementType_);
  }

  // Entity lookup and management
  lookupEntityConst(isParameter: Boolean, name: StringC): ConstPtr<Entity> {
    const table = isParameter ? this.parameterEntityTable_ : this.generalEntityTable_;
    return table.lookupConst(name);
  }

  lookupEntityTemp(isParameter: Boolean, name: StringC): Entity | null {
    const table = isParameter ? this.parameterEntityTable_ : this.generalEntityTable_;
    return table.lookupTemp(name);
  }

  lookupEntity(isParameter: Boolean, name: StringC): Ptr<Entity> {
    const table = isParameter ? this.parameterEntityTable_ : this.generalEntityTable_;
    return table.lookup(name);
  }

  insertEntity(entity: Ptr<Entity>, replace: Boolean = false): Ptr<Entity> {
    const declType = entity.pointer()!.declType();
    const isParameter = declType === 1 || declType === 3; // parameterEntity or doctype
    const table = isParameter ? this.parameterEntityTable_ : this.generalEntityTable_;
    return table.insert(entity, replace);
  }

  removeEntity(isParameter: Boolean, name: StringC): Ptr<Entity> {
    const table = isParameter ? this.parameterEntityTable_ : this.generalEntityTable_;
    return table.remove(name);
  }

  generalEntityIter(): NamedResourceTableIter<Entity> {
    return new NamedResourceTableIter<Entity>(this.generalEntityTable_);
  }

  generalEntityIterConst(): ConstNamedResourceTableIter<Entity> {
    return new ConstNamedResourceTableIter<Entity>(this.generalEntityTable_);
  }

  parameterEntityIter(): NamedResourceTableIter<Entity> {
    return new NamedResourceTableIter<Entity>(this.parameterEntityTable_);
  }

  parameterEntityIterConst(): ConstNamedResourceTableIter<Entity> {
    return new ConstNamedResourceTableIter<Entity>(this.parameterEntityTable_);
  }

  defaultEntity(): ConstPtr<Entity> {
    return this.defaultEntity_;
  }

  defaultEntityTemp(): Entity | null {
    return this.defaultEntity_.pointer();
  }

  // Port of Dtd::setDefaultEntity from Dtd.cxx
  setDefaultEntity(entity: Ptr<Entity>, parserState: ParserState): void {
    this.defaultEntity_ = new ConstPtr<Entity>(entity.pointer());

    // If the new default entity was defined in a DTD, then
    // any defaulted entities must have come from an LPD
    // on the first pass, in which case we shouldn't replace them.
    // Otherwise we need to replace all the defaulted entities.
    if (entity.pointer()?.declInActiveLpd()) {
      const tem = new NamedResourceTable<Entity>();
      {
        const iter = new NamedResourceTableIter<Entity>(this.generalEntityTable_);
        for (;;) {
          const old = iter.next();
          if (old === null || old.isNull()) {
            break;
          }
          if (old.pointer()!.defaulted()) {
            const e = new Ptr<Entity>(this.defaultEntity_.pointer()!.copy() as Entity);
            e.pointer()!.setDefaulted();
            e.pointer()!.setName(old.pointer()!.name());
            e.pointer()!.generateSystemId(parserState as any);
            tem.insert(e);
          }
        }
      }
      {
        const iter = new NamedResourceTableIter<Entity>(tem);
        for (;;) {
          const e = iter.next();
          if (e === null || e.isNull()) {
            break;
          }
          this.generalEntityTable_.insert(e, true);
        }
      }
    }
  }

  namePointer(): ConstPtr<StringResource<Char>> {
    return this.name_;
  }

  name(): StringC {
    return this.name_.pointer()!.getString();
  }

  // Element type management
  lookupElementType(name: StringC): ElementType | null {
    return this.elementTypeTable_.lookup(name);
  }

  removeElementType(name: StringC): ElementType | null {
    return this.elementTypeTable_.remove(name);
  }

  insertElementType(elementType: ElementType): ElementType {
    return this.elementTypeTable_.insert(elementType)!;
  }

  nElementTypeIndex(): number {
    return this.nElementType_;
  }

  allocElementTypeIndex(): number {
    return this.nElementType_++;
  }

  elementTypeIter(): NamedTableIter<ElementType> {
    return new NamedTableIter<ElementType>(this.elementTypeTable_);
  }

  elementTypeIterConst(): ConstNamedTableIter<ElementType> {
    return new ConstNamedTableIter<ElementType>(this.elementTypeTable_);
  }

  // Rank stem management
  lookupRankStem(name: StringC): RankStem | null {
    return this.rankStemTable_.lookup(name);
  }

  insertRankStem(rankStem: RankStem): RankStem {
    return this.rankStemTable_.insert(rankStem)!;
  }

  nRankStem(): number {
    return this.rankStemTable_.count();
  }

  rankStemIter(): NamedTableIter<RankStem> {
    return new NamedTableIter<RankStem>(this.rankStemTable_);
  }

  rankStemIterConst(): ConstNamedTableIter<RankStem> {
    return new ConstNamedTableIter<RankStem>(this.rankStemTable_);
  }

  // Short reference map management
  lookupShortReferenceMap(name: StringC): ShortReferenceMap | null {
    return this.shortReferenceMapTable_.lookup(name);
  }

  insertShortReferenceMap(map: ShortReferenceMap): ShortReferenceMap {
    return this.shortReferenceMapTable_.insert(map)!;
  }

  shortReferenceMapIter(): NamedTableIter<ShortReferenceMap> {
    return new NamedTableIter<ShortReferenceMap>(this.shortReferenceMapTable_);
  }

  // Short reference management
  // Port of Dtd.cxx (lines 30-44)
  shortrefIndex(str: StringC, syntax: Syntax, result: { value: number }): Boolean {
    const indexP = this.shortrefTable_.lookup(str);
    if (indexP !== null) {
      result.value = indexP;
      return true;
    }
    if (!syntax.isValidShortref(str)) {
      return false;
    }
    this.shortrefTable_.insert(str, this.shortrefs_.size());
    result.value = this.shortrefs_.size();
    this.shortrefs_.push_back(str);
    return true;
  }

  nShortref(): number {
    return this.shortrefs_.size();
  }

  shortref(i: number): StringC {
    return this.shortrefs_.get(i);
  }

  addNeededShortref(str: StringC): void {
    if (this.shortrefTable_.lookup(str) === null) {
      this.shortrefTable_.insert(str, this.shortrefs_.size());
      this.shortrefs_.push_back(str);
    }
  }

  // Notation management
  lookupNotationConst(name: StringC): ConstPtr<Notation> {
    return this.notationTable_.lookupConst(name);
  }

  lookupNotationTemp(name: StringC): Notation | null {
    return this.notationTable_.lookupTemp(name);
  }

  lookupNotation(name: StringC): Ptr<Notation> {
    return this.notationTable_.lookup(name);
  }

  insertNotation(notation: Ptr<Notation>): Ptr<Notation> {
    return this.notationTable_.insert(notation, false);
  }

  removeNotation(name: StringC): Ptr<Notation> {
    return this.notationTable_.remove(name);
  }

  notationIterConst(): ConstNamedResourceTableIter<Notation> {
    return new ConstNamedResourceTableIter<Notation>(this.notationTable_);
  }

  notationIter(): NamedResourceTableIter<Notation> {
    return new NamedResourceTableIter<Notation>(this.notationTable_);
  }

  // Index allocation
  allocCurrentAttributeIndex(): number {
    return this.nCurrentAttribute_++;
  }

  nCurrentAttribute(): number {
    return this.nCurrentAttribute_;
  }

  allocElementDefinitionIndex(): number {
    return this.nElementDefinition_++;
  }

  nElementDefinition(): number {
    return this.nElementDefinition_;
  }

  allocAttributeDefinitionListIndex(): number {
    return this.nAttributeDefinitionList_++;
  }

  nAttributeDefinitionList(): number {
    return this.nAttributeDefinitionList_;
  }

  // Document element type
  documentElementType(): ElementType | null {
    return this.documentElementType_;
  }

  // State queries
  isBase(): Boolean {
    return this.isBase_;
  }

  isInstantiated(): Boolean {
    return this.isInstantitated_;
  }

  instantiate(): void {
    this.isInstantitated_ = true;
  }

  // Implicit attribute definitions
  implicitElementAttributeDef(): Ptr<AttributeDefinitionList> {
    return this.implicitElementAttributeDef_;
  }

  setImplicitElementAttributeDef(def: Ptr<AttributeDefinitionList>): void {
    this.implicitElementAttributeDef_ = def;
  }

  implicitNotationAttributeDef(): Ptr<AttributeDefinitionList> {
    return this.implicitNotationAttributeDef_;
  }

  setImplicitNotationAttributeDef(def: Ptr<AttributeDefinitionList>): void {
    this.implicitNotationAttributeDef_ = def;
  }
}
