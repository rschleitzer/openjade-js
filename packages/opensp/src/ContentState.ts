// Copyright (c) 1994, 1996 James Clark
// See the file COPYING for copying permission.

import { Boolean, PackedBoolean } from './Boolean';
import { StringC } from './StringC';
import { String as StringOf } from './StringOf';
import { Char } from './types';
import { Vector } from './Vector';
import { NCVector } from './NCVector';
import { IList } from './IList';
import { IListIter } from './IListIter';
import { Owner } from './Owner';
import { ConstPtr } from './Ptr';
import { Location } from './Location';
import { Mode } from './Mode';
import { Dtd } from './Dtd';
import { ElementType, ElementDefinition } from './ElementType';
import { ShortReferenceMap } from './ShortReferenceMap';
import { OpenElement } from './OpenElement';
import {
  ContentToken,
  ElementToken,
  SeqModelGroup,
  ModelGroup,
  CompiledModelGroup,
  ContentModelAmbiguity
} from './ContentToken';
import { OpenElementInfo } from './Message';
import { ASSERT } from './macros';

export class ContentState {
  static readonly theEmptyMap = new ShortReferenceMap();

  private openElements_: IList<OpenElement>;
  private openElementCount_: Vector<number>;
  private includeCount_: Vector<number>;
  private excludeCount_: Vector<number>;
  private totalExcludeCount_: number;
  private tagLevel_: number;
  private netEnablingCount_: number;
  private nextIndex_: number;
  private lastEndedElementType_: ElementType | null;
  private documentElementContainer_: ElementType;

  constructor() {
    this.openElements_ = new IList<OpenElement>();
    this.openElementCount_ = new Vector<number>();
    this.includeCount_ = new Vector<number>();
    this.excludeCount_ = new Vector<number>();
    this.totalExcludeCount_ = 0;
    this.tagLevel_ = 0;
    this.netEnablingCount_ = 0;
    this.nextIndex_ = 0;
    this.lastEndedElementType_ = null;
    this.documentElementContainer_ = new ElementType(new StringOf<Char>(), -1);
  }

  startContent(dtd: Dtd): void {
    const tokens = new NCVector<Owner<ContentToken>>();
    tokens.resize(1);
    tokens.set(
      0,
      new Owner<ContentToken>(
        new ElementToken(dtd.documentElementType()!, ContentToken.OccurrenceIndicator.none)
      )
    );

    const model = new Owner<ModelGroup>(
      new SeqModelGroup(tokens, ContentToken.OccurrenceIndicator.none)
    );
    const compiledModel = new Owner<CompiledModelGroup>(new CompiledModelGroup(model.pointer()));
    const ambiguities = new Vector<ContentModelAmbiguity>();
    const pcdataUnreachableRef = { value: false };

    compiledModel.pointer()!.compile(
      dtd.nElementTypeIndex(),
      ambiguities,
      pcdataUnreachableRef
    );

    ASSERT(ambiguities.size() === 0);

    const def = new ConstPtr<ElementDefinition>(
      new ElementDefinition(
        new Location(),
        0,
        0,
        ElementDefinition.DeclaredContent.modelGroup,
        compiledModel
      )
    );

    this.documentElementContainer_.setElementDefinition(def, 0);
    this.tagLevel_ = 0;

    while (!this.openElements_.empty()) {
      const elem = this.openElements_.get();
      if (elem) {
        // Element will be garbage collected
      }
    }

    this.openElements_.insert(
      new OpenElement(
        this.documentElementContainer_,
        false,
        false,
        ContentState.theEmptyMap,
        new Location()
      )
    );

    this.includeCount_.assign(dtd.nElementTypeIndex(), 0);
    this.excludeCount_.assign(dtd.nElementTypeIndex(), 0);
    this.openElementCount_.assign(dtd.nElementTypeIndex(), 0);
    this.netEnablingCount_ = 0;
    this.totalExcludeCount_ = 0;
    this.lastEndedElementType_ = null;
    this.nextIndex_ = 0;
  }

  pushElement(e: OpenElement): void {
    this.tagLevel_++;
    this.openElementCount_.set(
      e.type().index(),
      this.openElementCount_.get(e.type().index()) + 1
    );

    const def = e.type().definition();
    if (def) {
      for (let i = 0; i < def.nInclusions(); i++) {
        const incl = def.inclusion(i);
        if (incl) {
          this.includeCount_.set(incl.index(), this.includeCount_.get(incl.index()) + 1);
        }
      }
      for (let i = 0; i < def.nExclusions(); i++) {
        const excl = def.exclusion(i);
        if (excl) {
          this.excludeCount_.set(excl.index(), this.excludeCount_.get(excl.index()) + 1);
          this.totalExcludeCount_++;
        }
      }
    }

    if (e.netEnabling()) {
      this.netEnablingCount_++;
    }

    e.setIndex(this.nextIndex_++);
    this.openElements_.insert(e);
  }

  popSaveElement(): OpenElement | null {
    ASSERT(this.tagLevel_ > 0);
    const e = this.openElements_.get();
    if (!e) {
      return null;
    }

    this.tagLevel_--;
    this.openElementCount_.set(
      e.type().index(),
      this.openElementCount_.get(e.type().index()) - 1
    );

    const def = e.type().definition();
    if (def) {
      for (let i = 0; i < def.nInclusions(); i++) {
        const incl = def.inclusion(i);
        if (incl) {
          this.includeCount_.set(incl.index(), this.includeCount_.get(incl.index()) - 1);
        }
      }
      for (let i = 0; i < def.nExclusions(); i++) {
        const excl = def.exclusion(i);
        if (excl) {
          this.excludeCount_.set(excl.index(), this.excludeCount_.get(excl.index()) - 1);
          this.totalExcludeCount_--;
        }
      }
    }

    if (e.netEnabling()) {
      this.netEnablingCount_--;
    }

    this.lastEndedElementType_ = e.type();
    return e;
  }

  popElement(): void {
    this.popSaveElement();
    // In JavaScript, element is garbage collected
  }

  currentElement(): OpenElement {
    return this.openElements_.head()!;
  }

  currentElementConst(): OpenElement {
    return this.openElements_.head()!;
  }

  getOpenElementInfo(v: Vector<OpenElementInfo>, rniPcdata: StringC): void {
    v.clear();
    v.resize(this.tagLevel_);

    let i = this.tagLevel_;
    const iter = new IListIter<OpenElement>(this.openElements_);

    while (!iter.done() && i > 0) {
      const e = v.get(--i);
      const cur = iter.cur();
      if (cur) {
        e.gi = cur.type().name();

        const token = cur.currentPosition();
        if (token && !(token as any).isInitial?.()) {
          e.matchIndex = (token as any).typeIndex() + 1;
          const type = (token as any).elementType?.();
          e.matchType = type ? type.name() : rniPcdata;
        }

        e.included = cur.included();
      }
      iter.next();
    }
  }

  tagLevel(): number {
    return this.tagLevel_;
  }

  elementIsIncluded(e: ElementType): Boolean {
    return (
      this.includeCount_.get(e.index()) !== 0 && this.excludeCount_.get(e.index()) === 0
    );
  }

  elementIsExcluded(e: ElementType): Boolean {
    return this.excludeCount_.get(e.index()) !== 0;
  }

  elementIsOpen(e: ElementType): Boolean {
    return this.openElementCount_.get(e.index()) !== 0;
  }

  afterDocumentElement(): Boolean {
    return this.tagLevel() === 0 && this.currentElement().isFinished();
  }

  lastEndedElementType(): ElementType | null {
    return this.lastEndedElementType_;
  }

  contentMode(): Mode {
    return this.openElements_.head()!.mode(this.netEnablingCount_ > 0);
  }

  lookupCreateUndefinedElement(
    name: StringC,
    loc: Location,
    dtd: Dtd,
    allowImmediateRecursion: Boolean = true
  ): ElementType {
    const p = new ElementType(name, dtd.allocElementTypeIndex());
    dtd.insertElementType(p);

    p.setElementDefinition(
      new ConstPtr<ElementDefinition>(
        new ElementDefinition(
          loc,
          ElementDefinition.undefinedIndex,
          ElementDefinition.OmitFlags.omitEnd,
          ElementDefinition.DeclaredContent.any,
          allowImmediateRecursion
        )
      ),
      0
    );

    p.setAttributeDef(dtd.implicitElementAttributeDef());

    this.includeCount_.push_back(0);
    this.excludeCount_.push_back(0);
    this.openElementCount_.push_back(0);

    return p;
  }

  checkImplyLoop(count: number): Boolean {
    const iter = new IListIter<OpenElement>(this.openElements_);
    const head = this.openElements_.head();

    if (!head) {
      return true;
    }

    while (count > 0 && !iter.done()) {
      const cur = iter.cur();
      if (
        cur &&
        cur.type() === head.type() &&
        cur.matchState().equals(head.matchState())
      ) {
        return false;
      }
      iter.next();
      count--;
    }

    return true;
  }
}
