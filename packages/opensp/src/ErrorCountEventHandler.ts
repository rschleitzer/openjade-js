// Copyright (c) 1996 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { EventHandler } from './EventHandler';
import { MessageEvent } from './Event';
import { Message } from './Message';

export class ErrorCountEventHandler extends EventHandler {
  private maxErrors_: number;
  private errorCount_: number;
  private cancel_: number; // sig_atomic_t

  constructor(errorLimit: number = 0) {
    super();
    this.errorCount_ = 0;
    this.maxErrors_ = errorLimit;
    this.cancel_ = 0;
  }

  setErrorLimit(maxErrors: number): void {
    this.maxErrors_ = maxErrors;
  }

  cancelPtr(): number {
    return this.cancel_;
  }

  cancel(): void {
    this.cancel_ = 1;
  }

  cancelled(): Boolean {
    return this.cancel_ !== 0;
  }

  errorCount(): number {
    return this.errorCount_;
  }

  message(event: MessageEvent): void {
    this.noteMessage(event.message());
  }

  noteMessage(message: Message): void {
    if (message.isError() && ++this.errorCount_ === this.maxErrors_) {
      this.cancel_ = 1;
    }
  }
}
