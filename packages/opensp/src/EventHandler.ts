// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Event, MessageEvent } from './Event';
import { InputSource } from './InputSource';

export abstract class EventHandler {
  abstract message(event: MessageEvent): void;

  data(event: any): void {}
  startElement(event: any): void {}
  endElement(event: any): void {}
  pi(event: any): void {}
  sdataEntity(event: any): void {}
  externalDataEntity(event: any): void {}
  subdocEntity(event: any): void {}
  nonSgmlChar(event: any): void {}
  appinfo(event: any): void {}
  uselink(event: any): void {}
  usemap(event: any): void {}
  startDtd(event: any): void {}
  endDtd(event: any): void {}
  startLpd(event: any): void {}
  endLpd(event: any): void {}
  endProlog(event: any): void {}
  sgmlDecl(event: any): void {}
  commentDecl(event: any): void {}
  sSep(event: any): void {}
  ignoredRs(event: any): void {}
  ignoredRe(event: any): void {}
  reOrigin(event: any): void {}
  ignoredChars(event: any): void {}
  markedSectionStart(event: any): void {}
  markedSectionEnd(event: any): void {}
  entityStart(event: any): void {}
  entityEnd(event: any): void {}
  notationDecl(event: any): void {}
  entityDecl(event: any): void {}
  elementDecl(event: any): void {}
  attlistDecl(event: any): void {}
  linkAttlistDecl(event: any): void {}
  attlistNotationDecl(event: any): void {}
  linkDecl(event: any): void {}
  idLinkDecl(event: any): void {}
  shortrefDecl(event: any): void {}
  ignoredMarkup(event: any): void {}
  entityDefaulted(event: any): void {}
  inputClosed(inputSource: InputSource): void {}
  inputOpened(inputSource: InputSource): void {}
  sgmlDeclEntity(event: any): void {}
}
