// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { String } from './StringOf';
import { Resource } from './Resource';

export class StringResource<T> extends Resource {
  private string_: String<T>;

  constructor(s: String<T>) {
    super();
    this.string_ = s;
  }

  // Provide String<T> interface methods
  size(): number {
    return this.string_.size();
  }

  get(i: number): T {
    return this.string_.get(i);
  }

  set(i: number, value: T): void {
    this.string_.set(i, value);
  }

  data(): T[] | null {
    return this.string_.data();
  }

  appendChar(c: T): StringResource<T> {
    this.string_.appendChar(c);
    return this;
  }

  appendString(s: String<T>): StringResource<T> {
    this.string_.appendString(s);
    return this;
  }

  equals(s: String<T>): boolean {
    return this.string_.equals(s);
  }

  // Get the underlying string
  getString(): String<T> {
    return this.string_;
  }
}
