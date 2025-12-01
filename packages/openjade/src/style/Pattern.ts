// Copyright (c) 1997 James Clark
// See the file copying.txt for copying permission.

import { StringC, Char, String as StringOf } from '@openjade-js/opensp';
import { NodePtr, GroveString, SdataMapper, GroveChar } from '../grove/Node';

// Helper to convert StringC to GroveString
function stringCToGroveString(sc: StringC): GroveString {
  if (!sc || !sc.ptr_ || sc.length_ === 0) {
    return new GroveString();
  }
  const data = new Uint32Array(sc.length_);
  for (let i = 0; i < sc.length_; i++) {
    data[i] = sc.ptr_[i];
  }
  return new GroveString(data, sc.length_);
}

// Helper to convert StringC to JS string
function stringCToString(sc: StringC): string {
  if (!sc || !sc.ptr_ || sc.length_ === 0) return '';
  let result = '';
  for (let i = 0; i < sc.length_; i++) {
    result += String.fromCharCode(sc.ptr_[i]);
  }
  return result;
}

// Helper to convert GroveString to JS string
function groveStringToString(gs: GroveString): string {
  if (!gs || gs.size() === 0) return '';
  let result = '';
  for (let i = 0; i < gs.size(); i++) {
    result += String.fromCharCode(gs.get(i));
  }
  return result;
}

// Pattern matching for DSSSL element rules
// Patterns are used to match nodes in the document tree

// Match context provides attribute name lookups
export class MatchContext implements SdataMapper {
  protected classAttributeNames_: StringC[] = [];
  protected idAttributeNames_: StringC[] = [];

  classAttributeNames(): StringC[] {
    return this.classAttributeNames_;
  }

  idAttributeNames(): StringC[] {
    return this.idAttributeNames_;
  }

  // SdataMapper interface
  sdataMap(_name: GroveString, _text: GroveString): { result: boolean; ch: GroveChar } {
    return { result: false, ch: 0 };
  }
}

// Base class for qualifiers that refine pattern matching
export abstract class Qualifier {
  abstract satisfies(node: NodePtr, context: MatchContext): boolean;
  abstract contributeSpecificity(specificity: number[]): void;
  vacuous(): boolean { return false; }

  protected static matchAttribute(
    name: StringC,
    value: StringC,
    node: NodePtr,
    _context: MatchContext
  ): boolean {
    if (!node) return false;
    const nameGs = stringCToGroveString(name);
    const attrValue = node.getAttribute(nameGs);
    if (!attrValue) return false;
    const valueGs = stringCToGroveString(value);
    return attrValue.equals(valueGs);
  }
}

// ID qualifier: matches elements with specific ID
export class IdQualifier extends Qualifier {
  private id_: StringC;

  constructor(id: StringC) {
    super();
    this.id_ = id;
  }

  satisfies(node: NodePtr, context: MatchContext): boolean {
    if (!node) return false;
    const idGs = stringCToGroveString(this.id_);
    for (const idAttr of context.idAttributeNames()) {
      const idAttrGs = stringCToGroveString(idAttr);
      const attrValue = node.getAttribute(idAttrGs);
      if (attrValue && attrValue.equals(idGs)) {
        return true;
      }
    }
    return false;
  }

  contributeSpecificity(specificity: number[]): void {
    specificity[Pattern.idSpecificity]++;
  }
}

// Class qualifier: matches elements with specific class
export class ClassQualifier extends Qualifier {
  private class_: StringC;

  constructor(className: StringC) {
    super();
    this.class_ = className;
  }

  satisfies(node: NodePtr, context: MatchContext): boolean {
    if (!node) return false;
    for (const classAttr of context.classAttributeNames()) {
      const classAttrGs = stringCToGroveString(classAttr);
      const attrValue = node.getAttribute(classAttrGs);
      if (attrValue && this.containsClass(attrValue)) {
        return true;
      }
    }
    return false;
  }

  private containsClass(attrValue: GroveString): boolean {
    // Check if class_ appears as a word in the attribute value
    const classes = groveStringToString(attrValue).split(/\s+/);
    const targetClass = stringCToString(this.class_);
    return classes.includes(targetClass);
  }

  contributeSpecificity(specificity: number[]): void {
    specificity[Pattern.classSpecificity]++;
  }
}

// Attribute has value qualifier
export class AttributeHasValueQualifier extends Qualifier {
  private name_: StringC;

  constructor(name: StringC) {
    super();
    this.name_ = name;
  }

  satisfies(node: NodePtr, _context: MatchContext): boolean {
    if (!node) return false;
    const nameGs = stringCToGroveString(this.name_);
    const attrValue = node.getAttribute(nameGs);
    return attrValue !== null;
  }

  contributeSpecificity(specificity: number[]): void {
    specificity[Pattern.attributeSpecificity]++;
  }
}

// Attribute missing value qualifier
export class AttributeMissingValueQualifier extends Qualifier {
  private name_: StringC;

  constructor(name: StringC) {
    super();
    this.name_ = name;
  }

  satisfies(node: NodePtr, _context: MatchContext): boolean {
    if (!node) return false;
    const nameGs = stringCToGroveString(this.name_);
    const attrValue = node.getAttribute(nameGs);
    return attrValue === null;
  }

  contributeSpecificity(specificity: number[]): void {
    specificity[Pattern.attributeSpecificity]++;
  }
}

// Attribute equals value qualifier
export class AttributeQualifier extends Qualifier {
  private name_: StringC;
  private value_: StringC;

  constructor(name: StringC, value: StringC) {
    super();
    this.name_ = name;
    this.value_ = value;
  }

  satisfies(node: NodePtr, context: MatchContext): boolean {
    return Qualifier.matchAttribute(this.name_, this.value_, node, context);
  }

  contributeSpecificity(specificity: number[]): void {
    specificity[Pattern.attributeSpecificity]++;
  }
}

// Position qualifier base class
export abstract class PositionQualifier extends Qualifier {
  contributeSpecificity(specificity: number[]): void {
    specificity[Pattern.positionSpecificity]++;
  }
}

// First of type qualifier
export class FirstOfTypeQualifier extends PositionQualifier {
  satisfies(node: NodePtr, _context: MatchContext): boolean {
    if (!node) return false;
    const gi = node.gi();
    if (!gi) return false;
    let sibling = node.previousSibling();
    while (sibling) {
      const sibGi = sibling.gi();
      if (sibGi && sibGi.equals(gi)) {
        return false;
      }
      sibling = sibling.previousSibling();
    }
    return true;
  }
}

// Last of type qualifier
export class LastOfTypeQualifier extends PositionQualifier {
  satisfies(node: NodePtr, _context: MatchContext): boolean {
    if (!node) return false;
    const gi = node.gi();
    if (!gi) return false;
    let sibling = node.nextSibling();
    while (sibling) {
      const sibGi = sibling.gi();
      if (sibGi && sibGi.equals(gi)) {
        return false;
      }
      sibling = sibling.nextSibling();
    }
    return true;
  }
}

// First of any qualifier
export class FirstOfAnyQualifier extends PositionQualifier {
  satisfies(node: NodePtr, _context: MatchContext): boolean {
    if (!node) return false;
    return node.previousSibling() === null;
  }
}

// Last of any qualifier
export class LastOfAnyQualifier extends PositionQualifier {
  satisfies(node: NodePtr, _context: MatchContext): boolean {
    if (!node) return false;
    return node.nextSibling() === null;
  }
}

// Only qualifier base class
export abstract class OnlyQualifier extends Qualifier {
  contributeSpecificity(specificity: number[]): void {
    specificity[Pattern.onlySpecificity]++;
  }
}

// Only of type qualifier
export class OnlyOfTypeQualifier extends OnlyQualifier {
  satisfies(node: NodePtr, context: MatchContext): boolean {
    const first = new FirstOfTypeQualifier();
    const last = new LastOfTypeQualifier();
    return first.satisfies(node, context) && last.satisfies(node, context);
  }
}

// Only of any qualifier
export class OnlyOfAnyQualifier extends OnlyQualifier {
  satisfies(node: NodePtr, context: MatchContext): boolean {
    const first = new FirstOfAnyQualifier();
    const last = new LastOfAnyQualifier();
    return first.satisfies(node, context) && last.satisfies(node, context);
  }
}

// Vacuous qualifier base class
export abstract class VacuousQualifier extends Qualifier {
  override vacuous(): boolean { return true; }
}

// Priority qualifier
export class PriorityQualifier extends VacuousQualifier {
  private n_: number;

  constructor(n: number) {
    super();
    this.n_ = n;
  }

  satisfies(_node: NodePtr, _context: MatchContext): boolean {
    return true;
  }

  contributeSpecificity(specificity: number[]): void {
    specificity[Pattern.prioritySpecificity] += this.n_;
  }
}

// Importance qualifier
export class ImportanceQualifier extends VacuousQualifier {
  private n_: number;

  constructor(n: number) {
    super();
    this.n_ = n;
  }

  satisfies(_node: NodePtr, _context: MatchContext): boolean {
    return true;
  }

  contributeSpecificity(specificity: number[]): void {
    specificity[Pattern.importanceSpecificity] += this.n_;
  }
}

// Repeat type
export type Repeat = number;

// Pattern element
export class Element {
  private gi_: StringC;
  private minRepeat_: Repeat = 1;
  private maxRepeat_: Repeat = 1;
  private qualifiers_: Qualifier[] = [];

  constructor(gi: StringC) {
    this.gi_ = gi;
  }

  matches(node: NodePtr, context: MatchContext): boolean {
    if (!node) return false;

    // Check GI if specified
    if (this.gi_.length_ > 0) {
      const nodeGi = node.gi();
      const giGs = stringCToGroveString(this.gi_);
      if (!nodeGi || !nodeGi.equals(giGs)) {
        return false;
      }
    }

    // Check all qualifiers
    for (const q of this.qualifiers_) {
      if (!q.satisfies(node, context)) {
        return false;
      }
    }
    return true;
  }

  contributeSpecificity(specificity: number[]): void {
    if (this.gi_.length_ > 0) {
      specificity[Pattern.giSpecificity]++;
    }
    if (this.maxRepeat_ > 1 || this.minRepeat_ > 1) {
      specificity[Pattern.repeatSpecificity]++;
    }
    for (const q of this.qualifiers_) {
      q.contributeSpecificity(specificity);
    }
  }

  addQualifier(q: Qualifier): void {
    this.qualifiers_.push(q);
  }

  setRepeat(minRepeat: Repeat, maxRepeat: Repeat): void {
    this.minRepeat_ = minRepeat;
    this.maxRepeat_ = maxRepeat;
  }

  minRepeat(): Repeat { return this.minRepeat_; }
  maxRepeat(): Repeat { return this.maxRepeat_; }

  mustHaveGi(gi: { value: StringC }): boolean {
    if (this.minRepeat_ === 0) return false;
    if (this.gi_.length_ > 0) {
      gi.value = this.gi_;
      return true;
    }
    return false;
  }

  trivial(): boolean {
    if (this.qualifiers_.length === 0) return true;
    for (const q of this.qualifiers_) {
      if (!q.vacuous()) return false;
    }
    return true;
  }
}

// Children qualifier
export class ChildrenQualifier extends Qualifier {
  private children_: Element[];

  constructor(children: Element[]) {
    super();
    this.children_ = children;
  }

  satisfies(node: NodePtr, context: MatchContext): boolean {
    if (!node) return false;
    // Match children pattern against node's children
    let child = node.firstChild();
    let elemIndex = 0;
    while (child && elemIndex < this.children_.length) {
      if (this.children_[elemIndex].matches(child, context)) {
        elemIndex++;
      }
      child = child.nextSibling();
    }
    return elemIndex === this.children_.length;
  }

  contributeSpecificity(specificity: number[]): void {
    for (const elem of this.children_) {
      elem.contributeSpecificity(specificity);
    }
  }
}

// Main Pattern class
export class Pattern {
  // Specificity indices
  static readonly importanceSpecificity = 0;
  static readonly idSpecificity = 1;
  static readonly classSpecificity = 2;
  static readonly giSpecificity = 3;
  static readonly repeatSpecificity = 4;
  static readonly prioritySpecificity = 5;
  static readonly onlySpecificity = 6;
  static readonly positionSpecificity = 7;
  static readonly attributeSpecificity = 8;
  static readonly nSpecificity = 9;

  private ancestors_: Element[] = [];
  private trivial_: boolean = true;

  constructor(ancestors?: Element[]) {
    if (ancestors) {
      this.ancestors_ = ancestors;
      this.trivial_ = Pattern.computeTrivial(ancestors);
    }
  }

  swap(pattern: Pattern): void {
    const tempAncestors = this.ancestors_;
    this.ancestors_ = pattern.ancestors_;
    pattern.ancestors_ = tempAncestors;

    const tempTrivial = this.trivial_;
    this.trivial_ = pattern.trivial_;
    pattern.trivial_ = tempTrivial;
  }

  matches(node: NodePtr, context: MatchContext): boolean {
    return Pattern.matchAncestors(this.ancestors_, 0, node, context);
  }

  mustHaveGi(gi: { value: StringC }): boolean {
    if (this.ancestors_.length === 0) return false;
    return this.ancestors_[0].mustHaveGi(gi);
  }

  trivial(): boolean {
    return this.trivial_;
  }

  static compareSpecificity(a: Pattern, b: Pattern): number {
    const specA = new Array(Pattern.nSpecificity).fill(0);
    const specB = new Array(Pattern.nSpecificity).fill(0);
    a.computeSpecificity(specA);
    b.computeSpecificity(specB);

    for (let i = 0; i < Pattern.nSpecificity; i++) {
      if (specA[i] !== specB[i]) {
        // Higher specificity should come first (return -1 if a > b)
        return specA[i] > specB[i] ? -1 : 1;
      }
    }
    return 0;
  }

  private computeSpecificity(specificity: number[]): void {
    for (const elem of this.ancestors_) {
      elem.contributeSpecificity(specificity);
    }
  }

  private static computeTrivial(ancestors: Element[]): boolean {
    // Pattern is trivial only if:
    // 1. It has exactly one element (no ancestors)
    // 2. That element itself is trivial (no qualifiers)
    if (ancestors.length === 0) return true;
    if (!ancestors[0].trivial()) return false;
    if (ancestors.length > 1) return false;  // Multiple ancestors = not trivial
    return true;
  }

  private static matchAncestors(
    ancestors: Element[],
    index: number,
    node: NodePtr,
    context: MatchContext
  ): boolean {
    if (index >= ancestors.length) return true;
    return Pattern.matchAncestors1(ancestors, index, node, context);
  }

  private static matchAncestors1(
    ancestors: Element[],
    index: number,
    node: NodePtr,
    context: MatchContext
  ): boolean {
    // Port of upstream Pattern::matchAncestors1 from Pattern.cxx
    const elem = ancestors[index];
    let tem: NodePtr | null = node;

    // First, must match minRepeat times, moving to parent each time
    for (let i = 0; i < elem.minRepeat(); i++) {
      if (!tem || !elem.matches(tem, context)) {
        return false;
      }
      tem = tem.parent();
    }

    // Then try to match remaining ancestors at current position
    let repeatCount = elem.minRepeat();
    for (;;) {
      if (Pattern.matchAncestors(ancestors, index + 1, tem, context)) {
        return true;
      }
      // Failed to match rest, try one more match of current element if allowed
      if (repeatCount >= elem.maxRepeat() || !tem || !elem.matches(tem, context)) {
        return false;
      }
      repeatCount++;
      tem = tem.parent();
    }
  }
}
