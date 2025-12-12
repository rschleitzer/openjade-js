// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, StringC } from '@scaly/opensp';
import {
  ELObj,
  FunctionObj,
  Signature,
  Identifier,
  PairObj,
  KeywordObj,
  SymbolObj,
  VectorObj,
  NodeListObj,
  MutableBoxObj,
  Interpreter,
  setInsnFactories,
  InsnPtr as ELObjInsnPtr
} from './ELObj';
import { Collector, CollectorObject } from './Collector';
import { SosofoObj, AppendSosofoObj, SetNonInheritedCsSosofoObj, ProcessChildrenSosofoObj } from './SosofoObj';
import { StyleObj, VarStyleObj, StyleSpec as StyleStyleSpec, InheritedC as StyleInheritedC, StyleStack } from './Style';
import { NodePtr } from '../grove/Node';

// BoxObj type and constructor alias for use throughout this file
type BoxObj = MutableBoxObj;
const BoxObj = MutableBoxObj;

// Re-export Interpreter from ELObj for compatibility
export { Interpreter };

// Evaluation context for expression evaluation
export class EvalContext {
  processingMode: ProcessingMode | null = null;
  currentNode: any = null;
  styleStack: StyleStack | null = null;
  specLevel: number = 0;
  actualDependencies: number[] = [];
}

// Forward declarations - these interfaces will be implemented or imported elsewhere
// Note: The actual implementation is in Interpreter.ts (ProcessingMode class)
export interface ProcessingMode {
  defined(): boolean;
  name(): StringC;
  // findMatch takes a node, context, messenger and specificity
  findMatch(node: NodePtr, context: any, mgr: any, specificity: any): any | null;
}

export interface FlowObj extends ELObj {
  hasNonInheritedC(ident: Identifier): boolean;
  hasPseudoNonInheritedC(ident: Identifier): boolean;
  asCompoundFlowObj(): CompoundFlowObj | null;
  copy(interp: Interpreter): FlowObj;
  setNonInheritedC(ident: Identifier, val: ELObj, loc: Location, interp: Interpreter): void;
  isCharacter(): boolean;
  setStyle(style: StyleObj): void;
  setImplicitChar(ch: ELObj, loc: Location, interp: Interpreter): void;
}

export interface CompoundFlowObj extends FlowObj {
  setContent(content: SosofoObj): void;
}

// Use StyleSpec from Style.ts
export type StyleSpec = StyleStyleSpec;

// Use InheritedC from Style.ts
export type InheritedC = StyleInheritedC;

// Instruction interface
export interface Insn {
  execute(vm: VM): Insn | null;
  isReturn(nArgs: { value: number }): boolean;
  isPopBindings(n: { value: number }, next: { insn: InsnPtr }): boolean;
}

export type InsnPtr = Insn | null;

// Control stack entry for VM
interface ControlStackEntry {
  frameSize: number;  // before pushing args
  closure: ELObj[] | null;
  protectClosure: ELObj | null;
  closureLoc: Location;
  continuation: ContinuationObj | null;
  next: Insn | null;
}

// Virtual Machine class
export class VM extends EvalContext {
  sp: number = 0;  // stack pointer (index into stack)
  interp: Interpreter;
  closure: ELObj[] | null = null;
  protectClosure: ELObj | null = null;
  frame: number = 0;  // frame pointer (index into stack)
  nActualArgs: number = 0;
  closureLoc: Location;
  modeStack: (ProcessingMode | null)[] = [];
  processingMode: ProcessingMode | null = null;
  overridingStyle: StyleObj | null = null;
  currentNode: any = null;  // NodePtr
  actualDependencies: any[] = [];  // Vector of dependencies

  private slim_: number = 0;  // stack limit (size)
  private stack_: ELObj[] = [];

  private csp_: number = 0;  // control stack pointer
  private controlStack_: ControlStackEntry[] = [];

  constructor(interpreter: Interpreter, context?: EvalContext) {
    super();
    this.interp = interpreter;
    this.closureLoc = new Location();
    if (context) {
      // Copy context properties
      this.processingMode = context.processingMode;
      this.currentNode = context.currentNode;
    }
    this.init();
  }

  private init(): void {
    this.slim_ = 0;
    this.stack_ = [];
    this.sp = 0;
    this.closure = null;
    this.frame = 0;
    this.protectClosure = null;
    this.csp_ = 0;
    this.controlStack_ = [];
    this.closureLoc = new Location();
  }

  initStack(): void {
    this.sp = 0;
    this.frame = 0;
    this.csp_ = 0;
    this.modeStack = [];
  }

  needStack(n: number): void {
    while (this.slim_ - this.sp < n) {
      this.growStack(n);
    }
  }

  private growStack(n: number): void {
    let newSize = this.sp;
    if (n > newSize) {
      newSize += (n + 15) & ~15;
    } else {
      newSize += newSize || 8;
    }
    const newStack = new Array<ELObj>(newSize);
    for (let i = 0; i < this.sp; i++) {
      newStack[i] = this.stack_[i];
    }
    this.stack_ = newStack;
    this.slim_ = newSize;
  }

  // Stack operations
  stackGet(index: number): ELObj {
    return this.stack_[index];
  }

  stackSet(index: number, val: ELObj): void {
    this.stack_[index] = val;
  }

  push(val: ELObj): void {
    this.stack_[this.sp++] = val;
  }

  pop(): ELObj {
    return this.stack_[--this.sp];
  }

  top(): ELObj {
    return this.stack_[this.sp - 1];
  }

  setTop(val: ELObj): void {
    this.stack_[this.sp - 1] = val;
  }

  pushFrame(next: Insn | null, argsPushed: number): void {
    if (this.csp_ >= this.controlStack_.length) {
      const newSize = this.controlStack_.length ? this.controlStack_.length * 2 : 8;
      for (let i = this.controlStack_.length; i < newSize; i++) {
        this.controlStack_.push({
          frameSize: 0,
          closure: null,
          protectClosure: null,
          closureLoc: new Location(),
          continuation: null,
          next: null
        });
      }
    }
    const entry = this.controlStack_[this.csp_];
    entry.closure = this.closure;
    entry.protectClosure = this.protectClosure;
    entry.next = next;
    entry.frameSize = this.sp - this.frame - argsPushed;
    entry.closureLoc = this.closureLoc;
    entry.continuation = null;
    this.csp_++;
  }

  popFrame(): Insn | null {
    if (this.csp_ <= 0) {
      throw new Error('ASSERT: csp > csbase');
    }
    this.csp_--;
    const entry = this.controlStack_[this.csp_];
    if (entry.continuation) {
      entry.continuation.kill();
    }
    this.closure = entry.closure;
    this.protectClosure = entry.protectClosure;
    this.frame = this.sp - entry.frameSize;
    this.closureLoc = entry.closureLoc;
    return entry.next;
  }

  setClosureArgToCC(): void {
    if (this.nActualArgs !== 1) {
      throw new Error('ASSERT: nActualArgs == 1');
    }
    const cc = this.stack_[this.sp - 1] as ContinuationObj;
    this.controlStack_[this.csp_ - 1].continuation = cc;
    cc.set(this.sp, this.csp_);
  }

  eval(insn: Insn | null, display: ELObj[] | null = null, arg: ELObj | null = null): ELObj {
    this.initStack();
    if (arg) {
      this.needStack(1);
      this.push(arg);
    }
    this.closure = display;
    this.protectClosure = null;
    this.closureLoc = new Location();

    // The inner loop
    let insnCount = 0;
    while (insn) {
      insnCount++;
      if (insnCount > 1000000000) {
        throw new Error('Infinite loop detected in VM');
      }
      insn = insn.execute(this);
    }

    let result: ELObj;
    if (this.sp > 0) {
      this.sp--;
      if (this.sp !== 0 || this.csp_ !== 0) {
        throw new Error('ASSERT: sp == sbase && csp == csbase');
      }
      result = this.stack_[0];
      if (!result) {
        throw new Error('ASSERT: result != 0');
      }
    } else {
      if (this.interp.debugMode()) {
        this.stackTrace();
      }
      result = this.interp.makeError();
    }
    return result;
  }

  private stackTrace(): void {
    let count = 0;
    if (this.protectClosure) {
      this.interp.setNextLocation(this.closureLoc);
      this.interp.message(InterpreterMessages.stackTrace);
      count++;
    }
    let lim = 0;
    if (this.csp_ > 0 && !this.controlStack_[0].protectClosure) {
      lim++;
    }
    for (let p = this.csp_; p > lim; p--) {
      this.interp.setNextLocation(this.controlStack_[p - 1].closureLoc);
      count++;
      if (count === 5 && p - lim > 7) {
        this.interp.message(InterpreterMessages.stackTraceEllipsis, p - (lim + 6));
        p = lim + 6;
      } else {
        this.interp.message(InterpreterMessages.stackTrace);
      }
    }
  }

  trace(c: Collector): void {
    if (this.sp) {
      for (let i = 0; i < this.sp; i++) {
        c.trace(this.stack_[i]);
      }
    }
    for (let i = 0; i < this.csp_; i++) {
      c.trace(this.controlStack_[i].protectClosure);
      c.trace(this.controlStack_[i].continuation);
    }
    c.trace(this.protectClosure);
  }

  // Stack reference by index
  stkRef(i: number): ELObj {
    return this.stack_[i];
  }

  // Stack set by index
  stkSet(i: number, obj: ELObj): void {
    this.stack_[i] = obj;
  }

  // Get argument from stack (relative to current frame)
  arg(i: number, spOverride?: number): ELObj {
    const sp = spOverride !== undefined ? spOverride : this.sp;
    return this.stack_[this.frame + i];
  }

  // Return from a primitive function
  returnFromPrimitive(n: number, obj: ELObj | null): void {
    this.sp -= n;
    if (obj) {
      this.stack_[this.sp++] = obj;
    }
  }
}

// EvalContext extended for VM
export class EvalContextExt extends EvalContext {
  processingMode: ProcessingMode | null = null;
  currentNode: any = null;  // NodePtr
}

// Interpreter messages
export const InterpreterMessages = {
  stackTrace: 'stackTrace',
  stackTraceEllipsis: 'stackTraceEllipsis',
  condFail: 'condFail',
  caseFail: 'caseFail',
  spliceNotList: 'spliceNotList',
  callNonFunction: 'callNonFunction',
  missingArg: 'missingArg',
  oddKeyArgs: 'oddKeyArgs',
  tooManyArgs: 'tooManyArgs',
  notAList: 'notAList',
  invalidKeyArg: 'invalidKeyArg',
  keyArgsNotKey: 'keyArgsNotKey',
  readOnly: 'readOnly',
  uninitializedVariableReference: 'uninitializedVariableReference',
  continuationDead: 'continuationDead',
  notAProcedure: 'notAProcedure',
  sosofoContext: 'sosofoContext',
  styleContext: 'styleContext',
  noCurrentProcessingMode: 'noCurrentProcessingMode',
  labelNotASymbol: 'labelNotASymbol',
  noCurrentNode: 'noCurrentNode'
} as const;

// Base instruction class (abstract)
abstract class InsnBase implements Insn {
  abstract execute(vm: VM): Insn | null;

  isReturn(_nArgs: { value: number }): boolean {
    return false;
  }

  isPopBindings(_n: { value: number }, _next: { insn: InsnPtr }): boolean {
    return false;
  }
}

// Error instruction
export class ErrorInsn extends InsnBase {
  execute(vm: VM): Insn | null {
    vm.sp = 0;
    return null;
  }
}

// Cond fail instruction
export class CondFailInsn extends ErrorInsn {
  private loc_: Location;

  constructor(loc: Location) {
    super();
    this.loc_ = loc;
  }

  override execute(vm: VM): Insn | null {
    vm.interp.setNextLocation(this.loc_);
    vm.interp.message(InterpreterMessages.condFail);
    return super.execute(vm);
  }
}

// Case fail instruction
export class CaseFailInsn extends ErrorInsn {
  private loc_: Location;

  constructor(loc: Location) {
    super();
    this.loc_ = loc;
  }

  override execute(vm: VM): Insn | null {
    vm.interp.setNextLocation(this.loc_);
    vm.interp.message(InterpreterMessages.caseFail, vm.top());
    return super.execute(vm);
  }
}

// Constant instruction
export class ConstantInsn extends InsnBase {
  private value_: ELObj;
  private next_: InsnPtr;

  constructor(obj: ELObj, next: InsnPtr) {
    super();
    this.value_ = obj;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.needStack(1);
    vm.push(this.value_);
    return this.next_;
  }
}

// Resolve quantities instruction
export class ResolveQuantitiesInsn extends InsnBase {
  private loc_: Location;
  private next_: InsnPtr;

  constructor(loc: Location, next: InsnPtr) {
    super();
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const tem = vm.top().resolveQuantities(true, vm.interp, this.loc_);
    if (!tem) {
      throw new Error('ASSERT: tem != 0');
    }
    if (vm.interp.isError(tem)) {
      vm.sp = 0;
      return null;
    }
    vm.setTop(tem);
    return this.next_;
  }
}

// Test instruction (if)
export class TestInsn extends InsnBase {
  private consequent_: InsnPtr;
  private alternative_: InsnPtr;

  constructor(consequent: InsnPtr, alternative: InsnPtr) {
    super();
    this.consequent_ = consequent;
    this.alternative_ = alternative;
  }

  execute(vm: VM): Insn | null {
    return vm.pop().isTrue() ? this.consequent_ : this.alternative_;
  }
}

// Or instruction
export class OrInsn extends InsnBase {
  private nextTest_: InsnPtr;
  private next_: InsnPtr;

  constructor(nextTest: InsnPtr, next: InsnPtr) {
    super();
    this.nextTest_ = nextTest;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (vm.top().isTrue()) {
      return this.next_;
    }
    vm.sp--;
    return this.nextTest_;
  }
}

// And instruction
export class AndInsn extends InsnBase {
  private nextTest_: InsnPtr;
  private next_: InsnPtr;

  constructor(nextTest: InsnPtr, next: InsnPtr) {
    super();
    this.nextTest_ = nextTest;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (!vm.top().isTrue()) {
      return this.next_;
    }
    vm.sp--;
    return this.nextTest_;
  }
}

// Case instruction
export class CaseInsn extends InsnBase {
  private obj_: ELObj;
  private match_: InsnPtr;
  private fail_: InsnPtr;

  constructor(obj: ELObj, match: InsnPtr, fail: InsnPtr) {
    super();
    this.obj_ = obj;
    this.match_ = match;
    this.fail_ = fail;
  }

  execute(vm: VM): Insn | null {
    if (ELObj.eqv(vm.top(), this.obj_)) {
      vm.sp--;
      return this.match_;
    }
    return this.fail_;
  }
}

// Pop instruction
export class PopInsn extends InsnBase {
  private next_: InsnPtr;

  constructor(next: InsnPtr) {
    super();
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.sp--;
    return this.next_;
  }
}

// Cons instruction
export class ConsInsn extends InsnBase {
  private next_: InsnPtr;

  constructor(next: InsnPtr) {
    super();
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const car = vm.stackGet(vm.sp - 1);
    const cdr = vm.stackGet(vm.sp - 2);
    vm.stackSet(vm.sp - 2, vm.interp.makePair(car, cdr));
    vm.sp--;
    return this.next_;
  }
}

// Append instruction
export class AppendInsn extends InsnBase {
  private loc_: Location;
  private next_: InsnPtr;

  constructor(loc: Location, next: InsnPtr) {
    super();
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    let source = vm.stackGet(vm.sp - 1);
    if (!source.isNil()) {
      let pair = source.asPair();
      if (!pair) {
        vm.interp.setNextLocation(this.loc_);
        vm.interp.message(InterpreterMessages.spliceNotList);
        vm.sp = 0;
        return null;
      }
      source = pair.cdr();
      const head = vm.interp.makePair(pair.car(), vm.interp.makeNil()) as PairObj;
      let tail = head;
      while (!source.isNil()) {
        pair = source.asPair();
        if (!pair) {
          vm.interp.setNextLocation(this.loc_);
          vm.interp.message(InterpreterMessages.spliceNotList);
          vm.sp = 0;
          return null;
        }
        const newTail = vm.interp.makePair(pair.car(), vm.interp.makeNil()) as PairObj;
        tail.setCdr(newTail);
        tail = newTail;
        source = pair.cdr();
      }
      tail.setCdr(vm.stackGet(vm.sp - 2));
      vm.stackSet(vm.sp - 2, head);
    }
    vm.sp--;
    return this.next_;
  }
}

// Apply base instruction (abstract)
export abstract class ApplyBaseInsn extends InsnBase {
  protected nArgs_: number;
  protected loc_: Location;

  constructor(nArgs: number, loc: Location) {
    super();
    this.nArgs_ = nArgs;
    this.loc_ = loc;
  }

  protected decodeArgs(vm: VM): FunctionObj | null {
    const funcObj = vm.pop();
    const func = funcObj.asFunction();
    if (!func) {
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.callNonFunction, funcObj);
      vm.sp = 0;
      return null;
    }
    const nReq = func.nRequiredArgs();
    if (this.nArgs_ < nReq) {
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.missingArg);
      vm.sp = 0;
      return null;
    }
    if (this.nArgs_ - nReq > func.nOptionalArgs()) {
      if (func.nKeyArgs()) {
        // Keyword args can be specified more than once
        // so we can only check there are an even number.
        if ((this.nArgs_ - nReq - func.nOptionalArgs()) & 1) {
          vm.interp.setNextLocation(this.loc_);
          vm.interp.message(InterpreterMessages.oddKeyArgs);
          vm.sp -= (this.nArgs_ - nReq) - func.nOptionalArgs();
        }
      } else if (!func.restArg()) {
        vm.interp.setNextLocation(this.loc_);
        vm.interp.message(InterpreterMessages.tooManyArgs);
        vm.sp -= (this.nArgs_ - nReq) - func.nOptionalArgs();
      }
    }
    return func;
  }
}

// Apply instruction
export class ApplyInsn extends ApplyBaseInsn {
  private next_: InsnPtr;

  constructor(nArgs: number, loc: Location, next: InsnPtr) {
    super(nArgs, loc);
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const func = this.decodeArgs(vm);
    vm.nActualArgs = this.nArgs_;
    if (func) {
      return func.call(vm, this.loc_, this.next_);
    }
    return null;
  }
}

// Tail apply instruction
export class TailApplyInsn extends ApplyBaseInsn {
  private nCallerArgs_: number;

  constructor(nCallerArgs: number, nArgs: number, loc: Location) {
    super(nArgs, loc);
    this.nCallerArgs_ = nCallerArgs;
  }

  execute(vm: VM): Insn | null {
    const func = this.decodeArgs(vm);
    vm.nActualArgs = this.nArgs_;
    if (func) {
      return func.tailCall(vm, this.loc_, this.nCallerArgs_);
    }
    return null;
  }
}

// Frame reference instruction
export class FrameRefInsn extends InsnBase {
  private index_: number;
  private next_: InsnPtr;

  constructor(index: number, next: InsnPtr) {
    super();
    this.index_ = index;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.needStack(1);
    vm.push(vm.stackGet(vm.frame + this.index_));
    return this.next_;
  }
}

// Stack reference instruction
export class StackRefInsn extends InsnBase {
  private index_: number;  // always negative
  private frameIndex_: number;
  private next_: InsnPtr;

  constructor(index: number, frameIndex: number, next: InsnPtr) {
    super();
    this.index_ = index;
    this.frameIndex_ = frameIndex;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.needStack(1);
    // ASSERT: vm.sp - vm.frame == frameIndex_ - index_
    vm.push(vm.stackGet(vm.sp + this.index_));
    return this.next_;
  }
}

// Closure reference instruction
export class ClosureRefInsn extends InsnBase {
  private index_: number;
  private next_: InsnPtr;

  constructor(index: number, next: InsnPtr) {
    super();
    this.index_ = index;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.needStack(1);
    vm.push(vm.closure![this.index_]);
    return this.next_;
  }
}

// Top reference instruction
export class TopRefInsn extends InsnBase {
  private var_: Identifier;
  private next_: InsnPtr;

  constructor(var_: Identifier, next: InsnPtr) {
    super();
    this.var_ = var_;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const tem = this.var_.computeValue(true, vm.interp);
    if (!tem || vm.interp.isError(tem)) {
      vm.sp = 0;
      return null;
    }
    vm.needStack(1);
    vm.push(tem);
    return this.next_;
  }
}

// Closure set box instruction
export class ClosureSetBoxInsn extends InsnBase {
  private index_: number;
  private loc_: Location;
  private next_: InsnPtr;

  constructor(index: number, loc: Location, next: InsnPtr) {
    super();
    this.index_ = index;
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const box = vm.closure![this.index_].asBox();
    if (!box) {
      throw new Error('ASSERT: box != 0');
    }
    if (box.readOnly()) {
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.readOnly);
      vm.sp = 0;
      return null;
    }
    const tem = box.value;
    box.value = vm.top();
    vm.setTop(tem);
    return this.next_;
  }
}

// Stack set box instruction
export class StackSetBoxInsn extends InsnBase {
  private index_: number;  // always negative
  private frameIndex_: number;
  private loc_: Location;
  private next_: InsnPtr;

  constructor(index: number, frameIndex: number, loc: Location, next: InsnPtr) {
    super();
    this.index_ = index;
    this.frameIndex_ = frameIndex;
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    // ASSERT: vm.sp - vm.frame == frameIndex_ - index_
    const box = vm.stackGet(vm.sp + this.index_).asBox();
    if (!box) {
      throw new Error('ASSERT: box != 0');
    }
    if (box.readOnly()) {
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.readOnly);
      vm.sp = 0;
      return null;
    }
    const tem = box.value;
    box.value = vm.top();
    vm.setTop(tem);
    return this.next_;
  }
}

// Stack set instruction
export class StackSetInsn extends InsnBase {
  private index_: number;  // always negative
  private frameIndex_: number;
  private next_: InsnPtr;

  constructor(index: number, frameIndex: number, next: InsnPtr) {
    super();
    this.index_ = index;
    this.frameIndex_ = frameIndex;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    // ASSERT: vm.sp - vm.frame == frameIndex_ - index_
    const tem = vm.stackGet(vm.sp + this.index_);
    vm.stackSet(vm.sp + this.index_, vm.top());
    vm.setTop(tem);
    return this.next_;
  }
}

// Pop bindings instruction
export class PopBindingsInsn extends InsnBase {
  private n_: number;
  private next_: InsnPtr;

  private constructor(n: number, next: InsnPtr) {
    super();
    this.n_ = n;
    this.next_ = next;
  }

  static make(n: number, next: InsnPtr): InsnPtr {
    if (next) {
      const retArgs = { value: 0 };
      if (next.isReturn(retArgs)) {
        return new ReturnInsn(n + retArgs.value);
      }
      const popN = { value: 0 };
      const popNext = { insn: null as InsnPtr };
      if (next.isPopBindings(popN, popNext)) {
        return new PopBindingsInsn(n + popN.value, popNext.insn);
      }
    }
    return new PopBindingsInsn(n, next);
  }

  execute(vm: VM): Insn | null {
    vm.sp -= this.n_;
    vm.stackSet(vm.sp - 1, vm.stackGet(vm.sp + this.n_ - 1));
    return this.next_;
  }

  override isPopBindings(n: { value: number }, next: { insn: InsnPtr }): boolean {
    n.value = this.n_;
    next.insn = this.next_;
    return true;
  }
}

// Return instruction
export class ReturnInsn extends InsnBase {
  private totalArgs_: number;

  constructor(totalArgs: number) {
    super();
    this.totalArgs_ = totalArgs;
  }

  override isReturn(nArgs: { value: number }): boolean {
    nArgs.value = this.totalArgs_;
    return true;
  }

  execute(vm: VM): Insn | null {
    const result = vm.pop();
    vm.sp -= this.totalArgs_;
    const next = vm.popFrame();
    vm.push(result);
    return next;
  }
}

// Set box instruction
export class SetBoxInsn extends InsnBase {
  private n_: number;
  private next_: InsnPtr;

  constructor(n: number, next: InsnPtr) {
    super();
    this.n_ = n;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.sp--;
    const box = vm.stackGet(vm.sp - this.n_).asBox();
    if (!box) {
      throw new Error('ASSERT: box != 0');
    }
    box.value = vm.stackGet(vm.sp);
    return this.next_;
  }
}

// Set immediate instruction
export class SetImmediateInsn extends InsnBase {
  private n_: number;
  private next_: InsnPtr;

  constructor(n: number, next: InsnPtr) {
    super();
    this.n_ = n;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.sp--;
    vm.stackSet(vm.sp - this.n_, vm.stackGet(vm.sp));
    return this.next_;
  }
}

// Check init instruction
export class CheckInitInsn extends InsnBase {
  private ident_: Identifier;
  private loc_: Location;
  private next_: InsnPtr;

  constructor(ident: Identifier, loc: Location, next: InsnPtr) {
    super();
    this.ident_ = ident;
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (vm.top() === null) {
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.uninitializedVariableReference, this.ident_.name());
      vm.sp = 0;
      return null;
    }
    return this.next_;
  }
}

// Unbox instruction
export class UnboxInsn extends InsnBase {
  private next_: InsnPtr;

  constructor(next: InsnPtr) {
    super();
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const box = vm.top().asBox();
    if (!box) {
      throw new Error('ASSERT: box != 0');
    }
    vm.setTop(box.value);
    return this.next_;
  }
}

// Box instruction
export class BoxInsn extends InsnBase {
  private next_: InsnPtr;

  constructor(next: InsnPtr) {
    super();
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.setTop(new BoxObj(vm.top()));
    return this.next_;
  }
}

// Box arg instruction
export class BoxArgInsn extends InsnBase {
  private n_: number;
  private next_: InsnPtr;

  constructor(n: number, next: InsnPtr) {
    super();
    this.n_ = n;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const argIndex = vm.sp + this.n_ - vm.nActualArgs;
    vm.stackSet(argIndex, new BoxObj(vm.stackGet(argIndex)));
    return this.next_;
  }
}

// Box stack instruction
export class BoxStackInsn extends InsnBase {
  private n_: number;
  private next_: InsnPtr;

  constructor(n: number, next: InsnPtr) {
    super();
    this.n_ = n;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const index = vm.sp + this.n_;
    vm.stackSet(index, new BoxObj(vm.stackGet(index)));
    return this.next_;
  }
}

// Vector instruction
export class VectorInsn extends InsnBase {
  private n_: number;
  private next_: InsnPtr;

  constructor(n: number, next: InsnPtr) {
    super();
    this.n_ = n;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (this.n_ === 0) {
      vm.needStack(1);
      vm.push(new VectorObj());
    } else {
      const v: ELObj[] = new Array(this.n_);
      let p = vm.sp;
      for (let n = this.n_; n > 0; n--) {
        p--;
        v[n - 1] = vm.stackGet(p);
      }
      vm.stackSet(p, new VectorObj(v));
      vm.sp = p + 1;
    }
    return this.next_;
  }
}

// List to vector instruction
export class ListToVectorInsn extends InsnBase {
  private next_: InsnPtr;

  constructor(next: InsnPtr) {
    super();
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const v: ELObj[] = [];
    let obj = vm.top();
    while (!obj.isNil()) {
      const pair = obj.asPair();
      if (!pair) {
        throw new Error('ASSERT: pair != 0');
      }
      v.push(pair.car());
      obj = pair.cdr();
    }
    vm.setTop(new VectorObj(v));
    return this.next_;
  }
}

// Test null instruction
export class TestNullInsn extends InsnBase {
  private offset_: number;
  private ifNull_: InsnPtr;
  private ifNotNull_: InsnPtr;

  constructor(offset: number, ifNull: InsnPtr, ifNotNull: InsnPtr) {
    super();
    this.offset_ = offset;
    this.ifNull_ = ifNull;
    this.ifNotNull_ = ifNotNull;
  }

  execute(vm: VM): Insn | null {
    if (vm.stackGet(vm.sp + this.offset_) === null) {
      return this.ifNull_;
    }
    return this.ifNotNull_;
  }
}

// Set key arg instruction
export class SetKeyArgInsn extends InsnBase {
  private offset_: number;
  private next_: InsnPtr;

  constructor(offset: number, next: InsnPtr) {
    super();
    this.offset_ = offset;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const val = vm.pop();
    vm.stackSet(vm.sp + this.offset_, val);
    return this.next_;
  }
}

// Varargs instruction
export class VarargsInsn extends InsnBase {
  private sig_: Signature;
  private entryPoints_: InsnPtr[];
  private loc_: Location;

  constructor(sig: Signature, entryPoints: InsnPtr[], loc: Location) {
    super();
    this.sig_ = sig;
    this.entryPoints_ = [...entryPoints];
    this.loc_ = loc;
  }

  execute(vm: VM): Insn | null {
    let n = vm.nActualArgs - this.sig_.nRequiredArgs;
    if ((this.sig_.restArg || this.sig_.nKeyArgs) &&
        n > this.entryPoints_.length - 2) {
      // cons up the rest args
      let restList = vm.interp.makeNil();
      for (let i = n - (this.entryPoints_.length - 2); i > 0; i--) {
        restList = vm.interp.makePair(vm.pop(), restList);
      }

      vm.needStack(this.sig_.nKeyArgs + (this.sig_.restArg ? 1 : 0));
      if (this.sig_.restArg) {
        vm.push(restList);
      }
      if (this.sig_.nKeyArgs) {
        for (let i = 0; i < this.sig_.nKeyArgs; i++) {
          vm.push(null as unknown as ELObj);  // null indicates unset
        }
        let tem = restList;
        for (let i = n - (this.entryPoints_.length - 2); i > 0; i -= 2) {
          const temPair = tem.asPair()!;
          const k = temPair.car().asKeyword();
          tem = temPair.cdr();
          if (k) {
            for (let j = 0; j < this.sig_.nKeyArgs; j++) {
              if (this.sig_.keys[j] === k.identifier()) {
                const stackPos = vm.sp - this.sig_.nKeyArgs + j;
                if (vm.stackGet(stackPos) === null) {
                  vm.stackSet(stackPos, (tem.asPair()!).car());
                }
                break;
              }
            }
            if (!this.sig_.restArg) {
              vm.interp.setNextLocation(this.loc_);
              vm.interp.message(InterpreterMessages.invalidKeyArg, k.identifier().name());
            }
          } else {
            vm.interp.setNextLocation(this.loc_);
            vm.interp.message(InterpreterMessages.keyArgsNotKey);
          }
          tem = (tem.asPair()!).cdr();
        }
      }
      return this.entryPoints_[this.entryPoints_.length - 1];
    }
    return this.entryPoints_[n];
  }
}

// Primitive call instruction
export class PrimitiveCallInsn extends InsnBase {
  private nArgs_: number;
  private prim_: PrimitiveObj;
  private loc_: Location;
  private next_: InsnPtr;

  constructor(nArgs: number, prim: PrimitiveObj, loc: Location, next: InsnPtr) {
    super();
    this.nArgs_ = nArgs;
    this.prim_ = prim;
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (this.nArgs_ === 0) {
      vm.needStack(1);
    }
    const argp = vm.sp - this.nArgs_;
    const args: ELObj[] = [];
    for (let i = 0; i < this.nArgs_; i++) {
      args.push(vm.stackGet(argp + i));
    }
    const result = this.prim_.primitiveCall(this.nArgs_, args, vm, vm.interp, this.loc_);
    vm.stackSet(argp, result);
    vm.sp = argp + 1;
    if (vm.interp.isError(result)) {
      vm.sp = 0;
      return null;
    }
    return this.next_;
  }
}

// Function call instruction
export class FunctionCallInsn extends InsnBase {
  private nArgs_: number;
  private function_: FunctionObj;  // must be permanent
  private loc_: Location;
  private next_: InsnPtr;

  constructor(nArgs: number, func: FunctionObj, loc: Location, next: InsnPtr) {
    super();
    this.nArgs_ = nArgs;
    this.function_ = func;
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.nActualArgs = this.nArgs_;
    return this.function_.call(vm, this.loc_, this.next_);
  }
}

// Function tail call instruction
export class FunctionTailCallInsn extends InsnBase {
  private nArgs_: number;
  private function_: FunctionObj;  // must be permanent
  private loc_: Location;
  private nCallerArgs_: number;

  constructor(nArgs: number, func: FunctionObj, loc: Location, nCallerArgs: number) {
    super();
    this.nArgs_ = nArgs;
    this.function_ = func;
    this.loc_ = loc;
    this.nCallerArgs_ = nCallerArgs;
  }

  execute(vm: VM): Insn | null {
    vm.nActualArgs = this.nArgs_;
    return this.function_.tailCall(vm, this.loc_, this.nCallerArgs_);
  }
}

// Closure instruction
export class ClosureInsn extends InsnBase {
  private sig_: Signature;
  private code_: InsnPtr;
  private displayLength_: number;
  private next_: InsnPtr;

  constructor(sig: Signature, code: InsnPtr, displayLength: number, next: InsnPtr) {
    super();
    this.sig_ = sig;
    this.code_ = code;
    this.displayLength_ = displayLength;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    let display: ELObj[] | null = null;
    if (this.displayLength_) {
      display = new Array(this.displayLength_);
      const tem = vm.sp - this.displayLength_;
      for (let i = 0; i < this.displayLength_; i++) {
        display[i] = vm.stackGet(tem + i);
      }
    }
    let tem: number;
    if (this.displayLength_ === 0) {
      vm.needStack(1);
      tem = vm.sp;
    } else {
      tem = vm.sp - this.displayLength_;
    }
    // Make sure objects in display are still visible on the stack
    // to the garbage collector.
    vm.stackSet(tem, new ClosureObj(this.sig_, this.code_, display));
    vm.sp = tem + 1;
    return this.next_;
  }
}

// Box object - holds a mutable value
// BoxObj is imported from ELObj as MutableBoxObj
// Re-export for compatibility
export { MutableBoxObj as BoxObj };

// Closure object
export class ClosureObj extends FunctionObj {
  private code_: InsnPtr;
  private display_: ELObj[] | null;  // terminated by null pointer, null if empty

  constructor(sig: Signature, code: InsnPtr, display: ELObj[] | null) {
    super(sig);
    this.hasSubObjects_ = true;
    this.code_ = code;
    this.display_ = display;
  }

  display(i?: number): ELObj | ELObj[] | null {
    if (i !== undefined) {
      return this.display_![i];
    }
    return this.display_;
  }

  call(vm: VM, loc: Location, next: Insn | null): Insn | null {
    vm.needStack(1);
    vm.pushFrame(next, vm.nActualArgs);
    vm.frame = vm.sp - vm.nActualArgs;
    vm.closure = this.display_;
    vm.protectClosure = this;
    vm.closureLoc = loc;
    return this.code_;
  }

  tailCall(vm: VM, loc: Location, nCallerArgs: number): Insn | null {
    vm.needStack(1);
    const nArgs = vm.nActualArgs;
    if (nCallerArgs) {
      const oldFrame = vm.sp - nArgs;
      const newFrame = oldFrame - nCallerArgs;
      for (let i = 0; i < nArgs; i++) {
        vm.stackSet(newFrame + i, vm.stackGet(oldFrame + i));
      }
      vm.frame = newFrame;
      vm.sp = newFrame + nArgs;
    } else {
      vm.frame = vm.sp - nArgs;
    }
    vm.closure = this.display_;
    vm.protectClosure = this;
    vm.closureLoc = loc;
    return this.code_;
  }

  setArgToCC(vm: VM): void {
    vm.setClosureArgToCC();
  }

  override traceSubObjects(c: Collector): void {
    if (this.display_) {
      for (const obj of this.display_) {
        if (obj) c.trace(obj);
      }
    }
  }
}

// Continuation object
export class ContinuationObj extends FunctionObj {
  private stackSize_: number = 0;
  private controlStackSize_: number = 0;

  private static readonly signature_: Signature = {
    nRequiredArgs: 1,
    nOptionalArgs: 0,
    restArg: false,
    nKeyArgs: 0,
    keys: []
  };

  constructor() {
    super(ContinuationObj.signature_);
  }

  set(stackSize: number, controlStackSize: number): void {
    this.stackSize_ = stackSize;
    this.controlStackSize_ = controlStackSize;
  }

  kill(): void {
    this.controlStackSize_ = 0;
  }

  live(): boolean {
    return this.controlStackSize_ > 0;
  }

  call(vm: VM, loc: Location, _next: Insn | null): Insn | null {
    if (!this.live() || this.readOnly()) {
      vm.interp.setNextLocation(loc);
      vm.interp.message(InterpreterMessages.continuationDead);
      vm.sp = 0;
      return null;
    }
    const result = vm.top();
    // ASSERT: vm.sp - vm.sbase >= stackSize_
    // ASSERT: vm.csp - vm.csbase >= controlStackSize_
    // ASSERT: vm.csbase[controlStackSize_ - 1].continuation == this
    while (vm.sp > this.controlStackSize_) {
      // Note: This is simplified - the original checks continuation entries
      vm.sp--;
    }
    vm.sp = this.stackSize_ - 1;
    const next = vm.popFrame();
    vm.push(result);
    return next;
  }

  tailCall(vm: VM, loc: Location, _nCallerArgs: number): Insn | null {
    return this.call(vm, loc, null);
  }
}

// Primitive object (abstract base for built-in functions)
export abstract class PrimitiveObj extends FunctionObj {
  private ident_: Identifier | null = null;

  constructor(sig: Signature) {
    super(sig);
  }

  setIdentifier(ident: Identifier): void {
    this.ident_ = ident;
  }

  abstract primitiveCall(
    nArgs: number,
    args: ELObj[],
    context: EvalContext,
    interp: Interpreter,
    loc: Location
  ): ELObj;

  call(vm: VM, loc: Location, next: Insn | null): Insn | null {
    if (vm.nActualArgs === 0) {
      vm.needStack(1);
    }
    const argp = vm.sp - vm.nActualArgs;
    const args: ELObj[] = [];
    for (let i = 0; i < vm.nActualArgs; i++) {
      args.push(vm.stackGet(argp + i));
    }
    const result = this.primitiveCall(vm.nActualArgs, args, vm, vm.interp, loc);
    vm.stackSet(argp, result);
    vm.sp = argp + 1;
    if (vm.interp.isError(result)) {
      vm.sp = 0;
      return null;
    }
    return next;
  }

  tailCall(vm: VM, loc: Location, nCallerArgs: number): Insn | null {
    const argp = vm.sp - vm.nActualArgs;
    const args: ELObj[] = [];
    for (let i = 0; i < vm.nActualArgs; i++) {
      args.push(vm.stackGet(argp + i));
    }
    const result = this.primitiveCall(vm.nActualArgs, args, vm, vm.interp, loc);
    if (vm.interp.isError(result)) {
      vm.sp = 0;
      return null;
    }
    vm.sp = argp - nCallerArgs;
    const next = vm.popFrame();
    vm.needStack(1);
    vm.push(result);
    return next;
  }

  override makeCallInsn(nArgs: number, _interp: Interpreter, loc: Location, next: InsnPtr): InsnPtr {
    return new PrimitiveCallInsn(nArgs, this, loc, next);
  }

  protected argError(
    interp: Interpreter,
    loc: Location,
    msg: string,
    index: number,
    obj: ELObj
  ): ELObj {
    const nl = obj.asNodeList();
    if (!nl || !nl.suppressError()) {
      interp.setNextLocation(loc);
      interp.message(msg, this.ident_?.name() ?? '', index + 1, obj);
    }
    return interp.makeError();
  }

  protected noCurrentNodeError(interp: Interpreter, loc: Location): ELObj {
    interp.setNextLocation(loc);
    interp.message(InterpreterMessages.noCurrentNode);
    return interp.makeError();
  }
}

// Apply primitive object
export class ApplyPrimitiveObj extends FunctionObj {
  private static readonly signature_: Signature = {
    nRequiredArgs: 2,
    nOptionalArgs: 0,
    restArg: true,
    nKeyArgs: 0,
    keys: []
  };

  constructor() {
    super(ApplyPrimitiveObj.signature_);
  }

  private shuffle(vm: VM, loc: Location): boolean {
    const nArgs = vm.nActualArgs;
    const func = vm.stackGet(vm.sp - nArgs);
    for (let i = nArgs - 2; i > 0; i--) {
      vm.stackSet(vm.sp - i - 2, vm.stackGet(vm.sp - i - 1));
    }
    vm.nActualArgs = nArgs - 2;
    let list = vm.pop();
    vm.sp--;
    while (!list.isNil()) {
      const tem = list.asPair();
      if (!tem) {
        vm.interp.setNextLocation(loc);
        vm.interp.message(InterpreterMessages.notAList, 'apply', nArgs, list);
        vm.sp = 0;
        return false;
      }
      vm.needStack(1);
      vm.nActualArgs++;
      vm.push(tem.car());
      list = tem.cdr();
    }
    vm.needStack(1);
    vm.push(func);
    return true;
  }

  call(vm: VM, loc: Location, next: Insn | null): Insn | null {
    if (!this.shuffle(vm, loc)) {
      return null;
    }
    const insn = new ApplyInsn(vm.nActualArgs, loc, next);
    return insn.execute(vm);
  }

  tailCall(vm: VM, loc: Location, nCallerArgs: number): Insn | null {
    if (!this.shuffle(vm, loc)) {
      return null;
    }
    const insn = new TailApplyInsn(nCallerArgs, vm.nActualArgs, loc);
    return insn.execute(vm);
  }
}

// Call with current continuation primitive
export class CallWithCurrentContinuationPrimitiveObj extends FunctionObj {
  private static readonly signature_: Signature = {
    nRequiredArgs: 1,
    nOptionalArgs: 0,
    restArg: false,
    nKeyArgs: 0,
    keys: []
  };

  constructor() {
    super(CallWithCurrentContinuationPrimitiveObj.signature_);
  }

  call(vm: VM, loc: Location, next: Insn | null): Insn | null {
    const f = vm.top().asFunction();
    if (!f) {
      vm.interp.setNextLocation(loc);
      vm.interp.message(InterpreterMessages.notAProcedure, 'call-with-current-continuation', 1, vm.top());
      vm.sp = 0;
      return null;
    }
    const protect = f;  // Keep reference to prevent GC
    vm.setTop(new ContinuationObj());
    const insn = f.call(vm, loc, next);
    f.setArgToCC(vm);
    return insn;
  }

  tailCall(vm: VM, loc: Location, nCallerArgs: number): Insn | null {
    const f = vm.top().asFunction();
    if (!f) {
      vm.interp.setNextLocation(loc);
      vm.interp.message(InterpreterMessages.notAProcedure, 'call-with-current-continuation', 1, vm.top());
      vm.sp = 0;
      return null;
    }
    const protect = f;  // Keep reference to prevent GC
    vm.setTop(new ContinuationObj());
    const insn = f.tailCall(vm, loc, nCallerArgs);
    f.setArgToCC(vm);
    return insn;
  }
}

// ============ Insn2.h instructions ============

// Check sosofo instruction
export class CheckSosofoInsn extends InsnBase {
  private loc_: Location;
  private next_: InsnPtr;

  constructor(loc: Location, next: InsnPtr) {
    super();
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (!vm.top().asSosofo()) {
      vm.sp = 0;
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.sosofoContext);
      return null;
    }
    return this.next_;
  }
}

// Check style instruction
export class CheckStyleInsn extends InsnBase {
  private loc_: Location;
  private next_: InsnPtr;

  constructor(loc: Location, next: InsnPtr) {
    super();
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (!vm.top().asStyle()) {
      vm.sp = 0;
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.styleContext);
      return null;
    }
    return this.next_;
  }
}

// Push mode instruction
export class PushModeInsn extends InsnBase {
  private mode_: ProcessingMode;
  private next_: InsnPtr;

  constructor(mode: ProcessingMode, next: InsnPtr) {
    super();
    this.mode_ = mode;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.modeStack.push(vm.processingMode);
    vm.processingMode = this.mode_;
    return this.next_;
  }
}

// Pop mode instruction
export class PopModeInsn extends InsnBase {
  private next_: InsnPtr;

  constructor(next: InsnPtr) {
    super();
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.processingMode = vm.modeStack.pop() ?? null;
    return this.next_;
  }
}

// Maybe override style instruction
export class MaybeOverrideStyleInsn extends InsnBase {
  private next_: InsnPtr;

  constructor(next: InsnPtr) {
    super();
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (vm.overridingStyle) {
      // vm.setTop(new OverriddenStyleObj(vm.top() as BasicStyleObj, vm.overridingStyle));
      // For now, leave style as is until Style.ts is ported
    }
    return this.next_;
  }
}

// Var style instruction
export class VarStyleInsn extends InsnBase {
  private styleSpec_: StyleSpec;
  private displayLength_: number;
  private hasUse_: boolean;
  private next_: InsnPtr;

  constructor(styleSpec: StyleSpec, displayLength: number, hasUse: boolean, next: InsnPtr) {
    super();
    this.styleSpec_ = styleSpec;
    this.displayLength_ = displayLength;
    this.hasUse_ = hasUse;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    let display: ELObj[] | null = null;
    if (this.displayLength_) {
      display = new Array(this.displayLength_);
      const tem = vm.sp - this.displayLength_;
      for (let i = 0; i < this.displayLength_; i++) {
        display[i] = vm.stackGet(tem + i);
      }
    }
    let tem: number;
    if (this.displayLength_ === 0) {
      vm.needStack(1);
      tem = vm.sp;
    } else {
      tem = vm.sp - this.displayLength_;
    }
    // Make sure objects in display are still visible on the stack
    // to the garbage collector.
    let use: StyleObj | null = null;
    if (this.hasUse_) {
      use = vm.stackGet(--tem) as StyleObj;
    }
    // Create VarStyleObj with the style specification
    const styleObj = new VarStyleObj(this.styleSpec_, use, display, vm.currentNode as NodePtr | null);
    vm.stackSet(tem, styleObj);
    vm.sp = tem + 1;
    vm.interp.makeReadOnly(styleObj);
    return this.next_;
  }
}

// Set style instruction
export class SetStyleInsn extends InsnBase {
  private next_: InsnPtr;

  constructor(next: InsnPtr) {
    super();
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const flowObj = vm.stackGet(vm.sp - 2) as FlowObj;
    const style = vm.stackGet(vm.sp - 1) as StyleObj;
    flowObj.setStyle(style);
    vm.sp--;
    return this.next_;
  }
}

// Sosofo append instruction
export class SosofoAppendInsn extends InsnBase {
  private n_: number;
  private next_: InsnPtr;

  constructor(n: number, next: InsnPtr) {
    super();
    this.n_ = n;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const obj = new AppendSosofoObj();
    const tem = vm.sp - this.n_;
    for (let i = 0; i < this.n_; i++) {
      obj.append(vm.stackGet(tem + i) as SosofoObj);
    }
    vm.sp -= this.n_ - 1;
    vm.setTop(obj);
    return this.next_;
  }
}

// Copy flow obj instruction
export class CopyFlowObjInsn extends InsnBase {
  private flowObj_: FlowObj;
  private next_: InsnPtr;

  constructor(flowObj: FlowObj, next: InsnPtr) {
    super();
    this.flowObj_ = flowObj;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    vm.needStack(1);
    vm.push(this.flowObj_.copy(vm.interp) as unknown as ELObj);
    return this.next_;
  }
}

// Set non inherited Cs sosofo instruction
export class SetNonInheritedCsSosofoInsn extends InsnBase {
  private code_: InsnPtr;
  private displayLength_: number;
  private next_: InsnPtr;

  constructor(code: InsnPtr, displayLength: number, next: InsnPtr) {
    super();
    this.code_ = code;
    this.displayLength_ = displayLength;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    let display: ELObj[] | null = null;
    if (this.displayLength_) {
      display = new Array(this.displayLength_);
      const tem = vm.sp - this.displayLength_;
      for (let i = 0; i < this.displayLength_; i++) {
        display[i] = vm.stackGet(tem + i);
        if (!display[i]) {
          throw new Error('ASSERT: display[i] != 0');
        }
      }
    }
    // Make sure objects in display are still visible on the stack
    // to the garbage collector.
    const tem = vm.sp - this.displayLength_ - 1;
    const flowObj = vm.stackGet(tem) as FlowObj;
    vm.stackSet(tem, new SetNonInheritedCsSosofoObj(flowObj as any, this.code_, display, vm.currentNode) as unknown as ELObj);
    vm.sp = tem + 1;
    return this.next_;
  }
}

// Set pseudo non inherited C instruction
export class SetPseudoNonInheritedCInsn extends InsnBase {
  protected loc_: Location;
  protected nic_: Identifier;
  protected next_: InsnPtr;

  constructor(nic: Identifier, loc: Location, next: InsnPtr) {
    super();
    this.nic_ = nic;
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const flowObj = vm.stackGet(vm.sp - 2) as FlowObj;
    flowObj.setNonInheritedC(this.nic_, vm.top(), this.loc_, vm.interp);
    vm.sp--;
    return this.next_;
  }
}

// Set non inherited C instruction
export class SetNonInheritedCInsn extends SetPseudoNonInheritedCInsn {
  constructor(nic: Identifier, loc: Location, next: InsnPtr) {
    super(nic, loc, next);
  }

  override execute(vm: VM): Insn | null {
    vm.actualDependencies.length = 0;
    return super.execute(vm);
  }
}

// Set implicit char instruction
export class SetImplicitCharInsn extends InsnBase {
  private loc_: Location;
  private next_: InsnPtr;

  constructor(loc: Location, next: InsnPtr) {
    super();
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    // if (vm.currentNode) {
    //   const value = vm.currentNode.property(ComponentName.idChar, vm.interp);
    //   if (value.result === accessOK) {
    //     (vm.top() as FlowObj).setImplicitChar(value.obj, this.loc_, vm.interp);
    //   }
    // }
    return this.next_;
  }
}

// Set content instruction
export class SetContentInsn extends InsnBase {
  private flowObj_: CompoundFlowObj;
  private next_: InsnPtr;

  constructor(flowObj: CompoundFlowObj, next: InsnPtr) {
    super();
    this.flowObj_ = flowObj;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const copy = this.flowObj_.copy(vm.interp) as CompoundFlowObj;
    const content = vm.top() as SosofoObj;
    copy.setContent(content);
    vm.setTop(copy as unknown as ELObj);
    return this.next_;
  }
}

// Set default content instruction
export class SetDefaultContentInsn extends InsnBase {
  private flowObj_: CompoundFlowObj;
  private loc_: Location;
  private next_: InsnPtr;

  constructor(flowObj: CompoundFlowObj, loc: Location, next: InsnPtr) {
    super();
    this.flowObj_ = flowObj;
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (!vm.processingMode) {
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.noCurrentProcessingMode);
      vm.sp = 0;
      return null;
    }
    vm.needStack(1);
    const copy = this.flowObj_.copy(vm.interp) as CompoundFlowObj;
    // Cast to any to bridge local ProcessingMode interface to Interpreter.ProcessingMode
    copy.setContent(new ProcessChildrenSosofoObj(vm.processingMode as any));
    vm.push(copy as unknown as ELObj);
    return this.next_;
  }
}

// Make default content instruction
export class MakeDefaultContentInsn extends InsnBase {
  private loc_: Location;
  private next_: InsnPtr;

  constructor(loc: Location, next: InsnPtr) {
    super();
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    if (!vm.processingMode) {
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.noCurrentProcessingMode);
      vm.sp = 0;
      return null;
    }
    vm.needStack(1);
    // vm.push(new ProcessChildrenSosofoObj(vm.processingMode));
    return this.next_;
  }
}

// Label sosofo instruction
export class LabelSosofoInsn extends InsnBase {
  private loc_: Location;
  private next_: InsnPtr;

  constructor(loc: Location, next: InsnPtr) {
    super();
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const sym = vm.top().asSymbol();
    if (!sym) {
      vm.interp.setNextLocation(this.loc_);
      vm.interp.message(InterpreterMessages.labelNotASymbol);
      vm.sp = 0;
      return null;
    }
    const content = vm.stackGet(vm.sp - 2) as SosofoObj;
    // vm.stackSet(vm.sp - 2, new LabelSosofoObj(sym, this.loc_, content));
    vm.sp--;
    return this.next_;
  }
}

// Content map sosofo instruction
export class ContentMapSosofoInsn extends InsnBase {
  private loc_: Location;
  private next_: InsnPtr;

  constructor(loc: Location, next: InsnPtr) {
    super();
    this.loc_ = loc;
    this.next_ = next;
  }

  execute(vm: VM): Insn | null {
    const content = vm.stackGet(vm.sp - 2) as SosofoObj;
    // vm.stackSet(vm.sp - 2, new ContentMapSosofoObj(vm.top(), this.loc_, content));
    vm.sp--;
    return this.next_;
  }
}

// Export factory functions for instruction creation (for Expression.ts compatibility)
export function createErrorInsn(): InsnPtr {
  return new ErrorInsn();
}

export function createConstantInsn(obj: ELObj, next: InsnPtr): InsnPtr {
  return new ConstantInsn(obj, next);
}

export function createResolveQuantitiesInsn(loc: Location, next: InsnPtr): InsnPtr {
  return new ResolveQuantitiesInsn(loc, next);
}

export function createTestInsn(consequent: InsnPtr, alternative: InsnPtr): InsnPtr {
  return new TestInsn(consequent, alternative);
}

export function createOrInsn(nextTest: InsnPtr, next: InsnPtr): InsnPtr {
  return new OrInsn(nextTest, next);
}

export function createAndInsn(nextTest: InsnPtr, next: InsnPtr): InsnPtr {
  return new AndInsn(nextTest, next);
}

export function createCondFailInsn(loc: Location): InsnPtr {
  return new CondFailInsn(loc);
}

export function createCaseFailInsn(loc: Location): InsnPtr {
  return new CaseFailInsn(loc);
}

export function createCaseInsn(obj: ELObj, match: InsnPtr, fail: InsnPtr): InsnPtr {
  return new CaseInsn(obj, match, fail);
}

export function createPopInsn(next: InsnPtr): InsnPtr {
  return new PopInsn(next);
}

export function createConsInsn(next: InsnPtr): InsnPtr {
  return new ConsInsn(next);
}

export function createAppendInsn(loc: Location, next: InsnPtr): InsnPtr {
  return new AppendInsn(loc, next);
}

export function createApplyInsn(nArgs: number, loc: Location, next: InsnPtr): InsnPtr {
  return new ApplyInsn(nArgs, loc, next);
}

export function createTailApplyInsn(callerArgs: number, nArgs: number, loc: Location): InsnPtr {
  return new TailApplyInsn(callerArgs, nArgs, loc);
}

export function createFrameRefInsn(index: number, next: InsnPtr): InsnPtr {
  return new FrameRefInsn(index, next);
}

export function createStackRefInsn(index: number, frameIndex: number, next: InsnPtr): InsnPtr {
  return new StackRefInsn(index, frameIndex, next);
}

export function createClosureRefInsn(index: number, next: InsnPtr): InsnPtr {
  return new ClosureRefInsn(index, next);
}

export function createTopRefInsn(ident: Identifier, next: InsnPtr): InsnPtr {
  return new TopRefInsn(ident, next);
}

export function createPopBindingsInsn(n: number, next: InsnPtr): InsnPtr {
  return PopBindingsInsn.make(n, next);
}

export function createReturnInsn(totalArgs: number): InsnPtr {
  return new ReturnInsn(totalArgs);
}

export function createBoxInsn(next: InsnPtr): InsnPtr {
  return new BoxInsn(next);
}

export function createBoxArgInsn(n: number, next: InsnPtr): InsnPtr {
  return new BoxArgInsn(n, next);
}

export function createBoxStackInsn(n: number, next: InsnPtr): InsnPtr {
  return new BoxStackInsn(n, next);
}

export function createUnboxInsn(next: InsnPtr): InsnPtr {
  return new UnboxInsn(next);
}

export function createCheckInitInsn(ident: Identifier, loc: Location, next: InsnPtr): InsnPtr {
  return new CheckInitInsn(ident, loc, next);
}

export function createSetBoxInsn(n: number, next: InsnPtr): InsnPtr {
  return new SetBoxInsn(n, next);
}

export function createSetImmediateInsn(n: number, next: InsnPtr): InsnPtr {
  return new SetImmediateInsn(n, next);
}

export function createStackSetBoxInsn(index: number, frameIndex: number, loc: Location, next: InsnPtr): InsnPtr {
  return new StackSetBoxInsn(index, frameIndex, loc, next);
}

export function createStackSetInsn(index: number, frameIndex: number, next: InsnPtr): InsnPtr {
  return new StackSetInsn(index, frameIndex, next);
}

export function createClosureSetBoxInsn(index: number, loc: Location, next: InsnPtr): InsnPtr {
  return new ClosureSetBoxInsn(index, loc, next);
}

export function createVectorInsn(n: number, next: InsnPtr): InsnPtr {
  return new VectorInsn(n, next);
}

export function createListToVectorInsn(next: InsnPtr): InsnPtr {
  return new ListToVectorInsn(next);
}

export function createTestNullInsn(offset: number, ifNull: InsnPtr, ifNotNull: InsnPtr): InsnPtr {
  return new TestNullInsn(offset, ifNull, ifNotNull);
}

export function createSetKeyArgInsn(offset: number, next: InsnPtr): InsnPtr {
  return new SetKeyArgInsn(offset, next);
}

export function createVarargsInsn(sig: Signature, entryPoints: InsnPtr[], loc: Location): InsnPtr {
  return new VarargsInsn(sig, entryPoints, loc);
}

export function createClosureInsn(sig: Signature, code: InsnPtr, displayLength: number, next: InsnPtr): InsnPtr {
  return new ClosureInsn(sig, code, displayLength, next);
}

export function createPushModeInsn(mode: ProcessingMode, next: InsnPtr): InsnPtr {
  return new PushModeInsn(mode, next);
}

export function createPopModeInsn(next: InsnPtr): InsnPtr {
  return new PopModeInsn(next);
}

export function createVarStyleInsn(styleSpec: StyleSpec, displayLength: number, hasUse: boolean, next: InsnPtr): InsnPtr {
  return new VarStyleInsn(styleSpec, displayLength, hasUse, next);
}

export function createMaybeOverrideStyleInsn(next: InsnPtr): InsnPtr {
  return new MaybeOverrideStyleInsn(next);
}

export function createCheckStyleInsn(loc: Location, next: InsnPtr): InsnPtr {
  return new CheckStyleInsn(loc, next);
}

export function createSetStyleInsn(next: InsnPtr): InsnPtr {
  return new SetStyleInsn(next);
}

export function createCheckSosofoInsn(loc: Location, next: InsnPtr): InsnPtr {
  return new CheckSosofoInsn(loc, next);
}

export function createSosofoAppendInsn(n: number, next: InsnPtr): InsnPtr {
  return new SosofoAppendInsn(n, next);
}

export function createCopyFlowObjInsn(flowObj: FlowObj, next: InsnPtr): InsnPtr {
  return new CopyFlowObjInsn(flowObj, next);
}

export function createSetNonInheritedCsSosofoInsn(code: InsnPtr, displayLength: number, next: InsnPtr): InsnPtr {
  return new SetNonInheritedCsSosofoInsn(code, displayLength, next);
}

export function createSetPseudoNonInheritedCInsn(ident: Identifier, loc: Location, next: InsnPtr): InsnPtr {
  return new SetPseudoNonInheritedCInsn(ident, loc, next);
}

export function createSetNonInheritedCInsn(ident: Identifier, loc: Location, next: InsnPtr): InsnPtr {
  return new SetNonInheritedCInsn(ident, loc, next);
}

export function createSetImplicitCharInsn(loc: Location, next: InsnPtr): InsnPtr {
  return new SetImplicitCharInsn(loc, next);
}

export function createSetContentInsn(flowObj: CompoundFlowObj, next: InsnPtr): InsnPtr {
  return new SetContentInsn(flowObj, next);
}

export function createSetDefaultContentInsn(flowObj: CompoundFlowObj, loc: Location, next: InsnPtr): InsnPtr {
  return new SetDefaultContentInsn(flowObj, loc, next);
}

export function createMakeDefaultContentInsn(loc: Location, next: InsnPtr): InsnPtr {
  return new MakeDefaultContentInsn(loc, next);
}

export function createLabelSosofoInsn(loc: Location, next: InsnPtr): InsnPtr {
  return new LabelSosofoInsn(loc, next);
}

export function createContentMapSosofoInsn(loc: Location, next: InsnPtr): InsnPtr {
  return new ContentMapSosofoInsn(loc, next);
}

export function createFunctionCallInsn(nArgs: number, func: FunctionObj, loc: Location, next: InsnPtr): InsnPtr {
  return new FunctionCallInsn(nArgs, func, loc, next);
}

export function createFunctionTailCallInsn(nArgs: number, func: FunctionObj, loc: Location, nCallerArgs: number): InsnPtr {
  return new FunctionTailCallInsn(nArgs, func, loc, nCallerArgs);
}

// Initialize factory functions in ELObj to avoid circular dependency
// This matches upstream where FunctionObj::makeCallInsn creates FunctionCallInsn
setInsnFactories(
  (nArgs, func, loc, next) => new FunctionCallInsn(nArgs, func, loc, next),
  (nArgs, func, loc, nCallerArgs) => new FunctionTailCallInsn(nArgs, func, loc, nCallerArgs)
);
