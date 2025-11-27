// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

// A garbage collector.
// In TypeScript/JavaScript we rely on native GC, but we preserve the interface
// for compatibility with the OpenJade class hierarchy.

export class Collector {
  totalObjects_: number = 0;
  maxSize_: number;

  // In C++, maxSize is set to maxObjSize() which computes the largest object size.
  // In JS with native GC, this is unused - we preserve it for interface compatibility.
  constructor(maxSize: number = 256) {
    this.maxSize_ = maxSize;
  }

  // Allocate object - in JS this is a no-op since we use native GC
  allocateObject(_hasFinalizer: boolean): void {
    this.totalObjects_++;
  }

  // Unallocate object - for when constructor throws
  unallocateObject(_obj: any): void {
    this.totalObjects_--;
  }

  // Trace an object - mark as reachable
  trace(_obj: CollectorObject | null): void {
    // In JS, native GC handles this - no-op
  }

  // Make object permanent - will never be collected
  makePermanent(obj: CollectorObject): void {
    obj.setPermanent(true);
  }

  // Collect garbage - returns number of live objects
  collect(): number {
    // In JS, native GC handles this
    return this.totalObjects_;
  }

  // Make object read-only
  makeReadOnly(obj: CollectorObject): void {
    if (!obj.hasSubObjects()) {
      obj.setReadOnly(true);
    } else if (!obj.readOnly()) {
      this.makeReadOnly1(obj);
    }
  }

  // Check if object may be live
  objectMaybeLive(_obj: CollectorObject): boolean {
    // In JS, if we have a reference, it's live
    return true;
  }

  // Trace static roots - override in subclasses
  protected traceStaticRoots(): void {
    // Override in subclasses
  }

  private makeReadOnly1(obj: CollectorObject): void {
    obj.setReadOnly(true);
    // For objects with sub-objects, recursively make read-only
    obj.traceSubObjects(this);
  }
}

// Base class for garbage-collected objects
export abstract class CollectorObject {
  private readOnly_: boolean = false;
  private permanent_: boolean = false;
  protected hasSubObjects_: boolean = false;

  constructor() {
    // Default constructor
  }

  readOnly(): boolean {
    return this.readOnly_;
  }

  setReadOnly(value: boolean): void {
    this.readOnly_ = value;
  }

  permanent(): boolean {
    return this.permanent_;
  }

  setPermanent(value: boolean): void {
    this.permanent_ = value;
  }

  hasSubObjects(): boolean {
    return this.hasSubObjects_;
  }

  // Override in subclasses with sub-objects to trace each direct subobject
  traceSubObjects(_collector: Collector): void {
    // Default: no sub-objects to trace
  }
}

// Dynamic root - tracks roots during collection
export class DynamicRoot {
  private collector_: Collector;

  constructor(collector: Collector) {
    this.collector_ = collector;
  }

  // Override to trace root objects
  trace(_collector: Collector): void {
    // Override in subclasses
  }

  protected getCollector(): Collector {
    return this.collector_;
  }
}

// Object dynamic root - wraps a single object
export class ObjectDynamicRoot extends DynamicRoot {
  private obj_: CollectorObject | null;

  constructor(collector: Collector, obj: CollectorObject | null = null) {
    super(collector);
    this.obj_ = obj;
  }

  assign(obj: CollectorObject | null): ObjectDynamicRoot {
    this.obj_ = obj;
    return this;
  }

  override trace(collector: Collector): void {
    collector.trace(this.obj_);
  }

  get(): CollectorObject | null {
    return this.obj_;
  }
}
