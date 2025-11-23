// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Boolean, PackedBoolean } from './Boolean';

export class EventsWanted {
  private instanceMarkup_: PackedBoolean;
  private commentDecls_: PackedBoolean;
  private markedSections_: PackedBoolean;
  private prologMarkup_: PackedBoolean;

  constructor() {
    this.instanceMarkup_ = false;
    this.commentDecls_ = false;
    this.markedSections_ = false;
    this.prologMarkup_ = false;
  }

  wantInstanceMarkup(): Boolean {
    return this.instanceMarkup_;
  }

  wantCommentDecls(): Boolean {
    return this.commentDecls_;
  }

  wantMarkedSections(): Boolean {
    return this.markedSections_;
  }

  wantPrologMarkup(): Boolean {
    return this.prologMarkup_;
  }

  addInstanceMarkup(): void {
    this.instanceMarkup_ = true;
    this.commentDecls_ = true;
    this.markedSections_ = true;
  }

  addCommentDecls(): void {
    this.commentDecls_ = true;
  }

  addMarkedSections(): void {
    this.markedSections_ = true;
  }

  addPrologMarkup(): void {
    this.prologMarkup_ = true;
  }
}
