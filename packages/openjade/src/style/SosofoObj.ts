// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, StringC } from '@openjade-js/opensp';
import { ELObj, NodeListObj, SymbolObj } from './ELObj';
import { Collector } from './Collector';
import { NodePtr } from '../grove/Node';
import { FOTBuilder } from './FOTBuilder';
import { StyleObj, StyleStack } from './Style';
import { InsnPtr, VM } from './Insn';
import type { Interpreter, ProcessingMode } from './Interpreter';

// Forward declarations
export interface ProcessContext {
  // Processing context interface
  fotBuilder(): FOTBuilder;
  currentStyleStack(): StyleStack;
  processNode(node: NodePtr, mode: ProcessingMode | null): void;
  processNodeList(nodeList: NodeListObj, mode: ProcessingMode | null): void;
  processChildren(mode: ProcessingMode | null): void;
  processChildrenTrim(mode: ProcessingMode | null): void;
  nextMatch(style: StyleObj | null): void;
  currentNode(): NodePtr | null;
  vm(): VM;
  startFlowObj(): void;
  endFlowObj(): void;
  // Port management
  pushPrincipalPort(port: FOTBuilder): void;
  popPrincipalPort(): void;
  setPageType(n: number): void;
  getPageType(): { has: boolean; value: number };
  // Table support
  startTable(): void;
  endTable(): void;
  startTablePart(): void;
  endTablePart(): void;
  addTableColumn(colIndex: number, span: number, style: StyleObj | null): void;
  currentTableColumn(): number;
  noteTableCell(colIndex: number, colSpan: number, rowSpan: number): void;
  startTableRow(style: StyleObj | null): void;
  endTableRow(): void;
}

// Base SOSOFO (Specification of a Sequence of Flow Objects) class
export abstract class SosofoObj extends ELObj {
  abstract process(context: ProcessContext): void;

  override asSosofo(): SosofoObj { return this; }

  tableBorderStyle(_style: { obj: StyleObj | null }): boolean {
    return false;
  }

  ruleStyle(_context: ProcessContext, _style: { obj: StyleObj | null }): boolean {
    return false;
  }

  isRule(): boolean {
    return false;
  }

  characterStyle(
    _context: ProcessContext,
    _style: { obj: StyleObj | null },
    _nic: any
  ): boolean {
    return false;
  }

  isCharacter(): boolean {
    return false;
  }
}

// Next match SOSOFO
export class NextMatchSosofoObj extends SosofoObj {
  private style_: StyleObj | null;

  constructor(style: StyleObj | null) {
    super();
    this.style_ = style;
    if (style) this.hasSubObjects_ = true;
  }

  process(context: ProcessContext): void {
    context.nextMatch(this.style_);
  }

  override traceSubObjects(collector: Collector): void {
    if (this.style_) collector.trace(this.style_);
  }
}

// Empty SOSOFO
export class EmptySosofoObj extends SosofoObj {
  process(_context: ProcessContext): void {
    // Empty - does nothing
  }
}

// Process node SOSOFO
export class ProcessNodeSosofoObj extends SosofoObj {
  private node_: NodePtr;
  private mode_: ProcessingMode | null;

  constructor(node: NodePtr, mode: ProcessingMode | null) {
    super();
    this.node_ = node;
    this.mode_ = mode;
  }

  process(context: ProcessContext): void {
    context.processNode(this.node_, this.mode_);
  }
}

// Process node list SOSOFO
export class ProcessNodeListSosofoObj extends SosofoObj {
  private nodeList_: NodeListObj;
  private mode_: ProcessingMode | null;

  constructor(nodeList: NodeListObj, mode: ProcessingMode | null) {
    super();
    this.nodeList_ = nodeList;
    this.mode_ = mode;
    this.hasSubObjects_ = true;
  }

  process(context: ProcessContext): void {
    context.processNodeList(this.nodeList_, this.mode_);
  }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.nodeList_);
  }
}

// Append SOSOFO - concatenation of SOSOFOs
export class AppendSosofoObj extends SosofoObj {
  private v_: SosofoObj[] = [];

  constructor() {
    super();
    this.hasSubObjects_ = true;
  }

  override asAppendSosofo(): AppendSosofoObj { return this; }

  process(context: ProcessContext): void {
    for (const sosofo of this.v_) {
      sosofo.process(context);
    }
  }

  append(obj: SosofoObj): void {
    this.v_.push(obj);
  }

  override traceSubObjects(collector: Collector): void {
    for (const obj of this.v_) {
      collector.trace(obj);
    }
  }
}

// Literal SOSOFO - outputs literal text
export class LiteralSosofoObj extends SosofoObj {
  private str_: ELObj;

  constructor(str: ELObj) {
    super();
    this.str_ = str;
    this.hasSubObjects_ = true;
  }

  process(context: ProcessContext): void {
    const strObj = this.str_.asString();
    if (strObj) {
      const fotb = context.fotBuilder();
      const data = strObj.stringData();
      if (data.result) {
        fotb.characters(data.data, data.length);
      }
    }
  }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.str_);
  }
}

// Current node page number SOSOFO
export class CurrentNodePageNumberSosofoObj extends SosofoObj {
  private node_: NodePtr;

  constructor(node: NodePtr) {
    super();
    this.node_ = node;
  }

  process(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.currentNodePageNumber(this.node_);
  }
}

// Page number SOSOFO
export class PageNumberSosofoObj extends SosofoObj {
  constructor() {
    super();
  }

  process(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.pageNumber();
  }
}

// Base flow object class
export abstract class FlowObj extends SosofoObj {
  protected style_: StyleObj | null = null;

  constructor() {
    super();
  }

  abstract copy(interp: Interpreter): FlowObj;

  asCompoundFlowObj(): CompoundFlowObj | null {
    return null;
  }

  hasNonInheritedC(_ident: any): boolean {
    return false;
  }

  hasPseudoNonInheritedC(_ident: any): boolean {
    return false;
  }

  setNonInheritedC(_ident: any, _obj: ELObj, _loc: Location, _interp: any): void {
    // Override in subclasses
  }

  setImplicitChar(_obj: ELObj, _loc: Location, _interp: any): boolean {
    return false;
  }

  isCharacter(): boolean {
    return false;
  }

  override traceSubObjects(collector: Collector): void {
    if (this.style_) collector.trace(this.style_);
  }

  setStyle(style: StyleObj): void {
    this.style_ = style;
  }

  process(context: ProcessContext): void {
    let styleLevel = 0;
    this.pushStyle(context, { value: styleLevel });
    this.processInner(context);
    this.popStyle(context, styleLevel);
  }

  pushStyle(context: ProcessContext, _level: { value: number }): void {
    // Push style onto the style stack - port of FlowObj::pushStyle from FlowObj.cxx
    // Upstream just checks if (style_) - no extra typeof check
    if (this.style_) {
      context.currentStyleStack().push(this.style_, context.vm(), context.fotBuilder());
    } else {
      context.currentStyleStack().pushEmpty();
    }
  }

  popStyle(context: ProcessContext, _level: number): void {
    // Pop style from the style stack - port of FlowObj::popStyle from FlowObj.cxx
    if (this.style_) {
      context.currentStyleStack().pop();
    } else {
      context.currentStyleStack().popEmpty();
    }
  }

  abstract processInner(context: ProcessContext): void;

  protected static setDisplayNIC(
    _nic: any,
    _ident: any,
    _obj: ELObj,
    _loc: Location,
    _interp: any
  ): boolean {
    return false;
  }

  protected static isDisplayNIC(_ident: any): boolean {
    return false;
  }
}

// Compound flow object - has content
export class CompoundFlowObj extends FlowObj {
  protected content_: SosofoObj | null = null;

  constructor() {
    super();
  }

  processInner(context: ProcessContext): void {
    if (this.content_) {
      this.content_.process(context);
    } else {
      // When no explicit content, implicitly process children
      // This matches upstream CompoundFlowObj::processInner behavior
      const vm = context.vm();
      const interp = vm.interp as any;
      const initialMode = interp.initialProcessingMode ? interp.initialProcessingMode() : null;
      context.processChildren(initialMode);
    }
  }

  override traceSubObjects(collector: Collector): void {
    super.traceSubObjects(collector);
    if (this.content_) collector.trace(this.content_);
  }

  setContent(content: SosofoObj): void {
    this.content_ = content;
  }

  override asCompoundFlowObj(): CompoundFlowObj {
    return this;
  }

  copy(_interp: Interpreter): FlowObj {
    const copy = new CompoundFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }

  protected getContent(): SosofoObj | null {
    return this.content_;
  }
}

// Sequence flow object
export class SequenceFlowObj extends CompoundFlowObj {
  constructor() {
    super();
  }

  override processInner(context: ProcessContext): void {
    const fotb = context.fotBuilder();
    fotb.startSequence();
    super.processInner(context);
    fotb.endSequence();
  }

  override copy(_interp: Interpreter): FlowObj {
    const copy = new SequenceFlowObj();
    copy.style_ = this.style_;
    copy.content_ = this.content_;
    return copy;
  }
}

// Process children SOSOFO
export class ProcessChildrenSosofoObj extends SosofoObj {
  private mode_: ProcessingMode | null;

  constructor(mode: ProcessingMode | null) {
    super();
    this.mode_ = mode;
  }

  process(context: ProcessContext): void {
    context.processChildren(this.mode_);
  }
}

// Process children trim SOSOFO
export class ProcessChildrenTrimSosofoObj extends SosofoObj {
  private mode_: ProcessingMode | null;

  constructor(mode: ProcessingMode | null) {
    super();
    this.mode_ = mode;
  }

  process(context: ProcessContext): void {
    context.processChildrenTrim(this.mode_);
  }
}

// Set non-inherited characteristics SOSOFO
export class SetNonInheritedCsSosofoObj extends SosofoObj {
  private flowObj_: FlowObj;
  private display_: ELObj[] | null;
  private code_: InsnPtr;
  private node_: NodePtr;

  constructor(
    flowObj: FlowObj,
    code: InsnPtr,
    display: ELObj[] | null,
    node: NodePtr
  ) {
    super();
    this.flowObj_ = flowObj;
    this.code_ = code;
    this.display_ = display;
    this.node_ = node;
    this.hasSubObjects_ = true;
  }

  process(context: ProcessContext): void {
    context.startFlowObj();
    // Upstream: push the flow object's style BEFORE resolving and processing
    let styleLevel = 0;
    this.flowObj_.pushStyle(context, { value: styleLevel });
    const obj = this.resolve(context);
    if (obj) {
      (obj as FlowObj).processInner(context);
    }
    // Upstream: pop the flow object's style after processing
    this.flowObj_.popStyle(context, styleLevel);
    context.endFlowObj();
  }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.flowObj_);
    if (this.display_) {
      for (const obj of this.display_) {
        collector.trace(obj);
      }
    }
  }

  override characterStyle(
    context: ProcessContext,
    style: { obj: StyleObj | null },
    nic: any
  ): boolean {
    return this.flowObj_.characterStyle(context, style, nic);
  }

  override isCharacter(): boolean {
    return this.flowObj_.isCharacter();
  }

  override ruleStyle(
    context: ProcessContext,
    style: { obj: StyleObj | null }
  ): boolean {
    return this.flowObj_.ruleStyle(context, style);
  }

  override isRule(): boolean {
    return this.flowObj_.isRule();
  }

  private resolve(context: ProcessContext): ELObj | null {
    const vm = context.vm();

    // Save and set node context - upstream EvalContext::CurrentNodeSetter
    const savedNode = vm.currentNode;
    vm.currentNode = this.node_;

    // Save and set style stack context - upstream ProcessContext.cxx line 668-673
    const saveStyleStack = vm.styleStack;
    vm.styleStack = context.currentStyleStack();
    const saveSpecLevel = vm.specLevel;
    vm.specLevel = vm.styleStack ? vm.styleStack.level() : 0;
    const saveActualDependencies = vm.actualDependencies;
    vm.actualDependencies = [];

    // Evaluate the code with display and a copy of the flow object
    const flowObjCopy = this.flowObj_.copy(vm.interp as any);
    const obj = vm.eval(this.code_, this.display_, flowObjCopy as unknown as ELObj);

    // Restore context
    vm.styleStack = saveStyleStack;
    vm.specLevel = saveSpecLevel;
    vm.actualDependencies = saveActualDependencies;
    vm.currentNode = savedNode;

    if (vm.interp.isError(obj)) {
      return null;
    }
    return obj;
  }
}

// Label SOSOFO - wraps content with a label
export class LabelSosofoObj extends SosofoObj {
  private label_: SymbolObj;
  private loc_: Location;
  private content_: SosofoObj;

  constructor(label: SymbolObj, loc: Location, content: SosofoObj) {
    super();
    this.label_ = label;
    this.loc_ = loc;
    this.content_ = content;
    this.hasSubObjects_ = true;
  }

  process(context: ProcessContext): void {
    // Process labeled content
    this.content_.process(context);
  }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.label_);
    collector.trace(this.content_);
  }
}

// Content map SOSOFO
export class ContentMapSosofoObj extends SosofoObj {
  private contentMap_: ELObj;
  private loc_: Location | null;
  private content_: SosofoObj;

  constructor(contentMap: ELObj, loc: Location | null, content: SosofoObj) {
    super();
    this.contentMap_ = contentMap;
    this.loc_ = loc;
    this.content_ = content;
    this.hasSubObjects_ = true;
  }

  process(context: ProcessContext): void {
    this.content_.process(context);
  }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.contentMap_);
    collector.trace(this.content_);
  }
}

// Discard labeled SOSOFO
export class DiscardLabeledSosofoObj extends SosofoObj {
  private label_: SymbolObj;
  private content_: SosofoObj;

  constructor(label: SymbolObj, content: SosofoObj) {
    super();
    this.label_ = label;
    this.content_ = content;
    this.hasSubObjects_ = true;
  }

  process(context: ProcessContext): void {
    this.content_.process(context);
  }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.label_);
    collector.trace(this.content_);
  }
}

// Page type SOSOFO
export class PageTypeSosofoObj extends SosofoObj {
  private pageTypeFlag_: number;
  private match_: SosofoObj;
  private noMatch_: SosofoObj;

  constructor(pageTypeFlag: number, match: SosofoObj, noMatch: SosofoObj) {
    super();
    this.pageTypeFlag_ = pageTypeFlag;
    this.match_ = match;
    this.noMatch_ = noMatch;
    this.hasSubObjects_ = true;
  }

  process(context: ProcessContext): void {
    const pageTypeResult = context.getPageType();
    if (pageTypeResult.has) {
      if (pageTypeResult.value & this.pageTypeFlag_) {
        this.match_.process(context);
      } else {
        this.noMatch_.process(context);
      }
    }
  }

  override traceSubObjects(collector: Collector): void {
    collector.trace(this.match_);
    collector.trace(this.noMatch_);
  }
}
