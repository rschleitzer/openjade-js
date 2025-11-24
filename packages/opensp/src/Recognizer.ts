// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Resource } from './Resource';
import { Owner } from './Owner';
import { XcharMap } from './XcharMap';
import { Token, EquivCode } from './types';
import { Vector } from './Vector';
import { Trie, BlankTrie } from './Trie';
import { Boolean } from './Boolean';
import { Messenger } from './Message';
import { InputSource } from './InputSource';

export class Recognizer extends Resource {
  private multicode_: Boolean;
  private trie_: Owner<Trie>;
  private map_: XcharMap<EquivCode>;
  private suppressTokens_: Vector<Token>;

  constructor(trie: Trie, map: XcharMap<EquivCode>, suppressTokens?: Vector<Token>) {
    super();
    this.trie_ = new Owner<Trie>(trie);
    this.map_ = map;

    if (suppressTokens) {
      this.multicode_ = true;
      this.suppressTokens_ = new Vector<Token>();
      this.suppressTokens_.swap(suppressTokens);
    } else {
      this.multicode_ = false;
      this.suppressTokens_ = new Vector<Token>();
    }
  }

  recognize(inputSource: InputSource, mgr: Messenger): Token {
    if (this.multicode_) {
      inputSource.startToken();
      if (inputSource.scanSuppress()) {
        const tokenChar = inputSource.tokenChar(mgr);
        return this.suppressTokens_[this.map_.get(tokenChar)];
      }
    } else {
      inputSource.startTokenNoMulticode();
    }

    let pos = this.trie_.pointer();
    if (!pos) {
      return 0;
    }

    do {
      const tokenChar = inputSource.tokenChar(mgr);
      pos = pos.next(this.map_.get(tokenChar));
    } while (pos.hasNext());

    const blankTrie = pos.blank();
    if (!blankTrie) {
      inputSource.endToken(pos.tokenLength());
      return pos.token();
    }

    const b = blankTrie;
    let newPos: Trie = b;
    const maxBlanks = b.maxBlanksToScan();
    let nBlanks: number;

    for (nBlanks = 0; nBlanks < maxBlanks; nBlanks++) {
      const tokenChar = inputSource.tokenChar(mgr);
      const code = this.map_.get(tokenChar);
      if (!b.codeIsBlank(code)) {
        if (newPos.hasNext()) {
          newPos = newPos.next(code);
        }
        break;
      }
    }

    while (newPos.hasNext()) {
      const tokenChar = inputSource.tokenChar(mgr);
      newPos = newPos.next(this.map_.get(tokenChar));
    }

    if (newPos.token() !== 0) {
      inputSource.endToken(newPos.tokenLength() + b.additionalLength() + nBlanks);
      return newPos.token();
    } else {
      inputSource.endToken(pos.tokenLength() + (pos.includeBlanks() ? nBlanks : 0));
      return pos.token();
    }
  }
}
