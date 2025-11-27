// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Messenger, StringC, CharsetInfo, InputSource, InternalInputSource, InputSourceOrigin } from '@openjade-js/opensp';
import { NodePtr } from '../grove/Node';
import { FOTBuilder } from './FOTBuilder';
import { Interpreter } from './Interpreter';
import { ProcessContext } from './ProcessContext';
import { SchemeParser } from './SchemeParser';

// Forward declaration for GroveManager - must match Interpreter.ts
export interface GroveManager {
  mapSysid(sysid: StringC): void;
  readEntity(sysid: StringC, src: { value: StringC }): boolean;
}

// Forward declaration for SgmlParser
export interface SgmlParser {
  // SGML parser interface
}

// Forward declaration for FOTBuilder extensions
export interface FOTBuilderExtension {
  name: string;
  // Extension properties
}

// StyleEngine orchestrates DSSSL stylesheet processing
export class StyleEngine {
  private interpreter_: Interpreter;
  private cmdline_: StringC;

  constructor(
    mgr: Messenger,
    groveManager: GroveManager,
    unitsPerInch: number,
    debugMode: boolean,
    dsssl2: boolean,
    strictMode: boolean,
    extensionTable?: FOTBuilderExtension[]
  ) {
    this.interpreter_ = new Interpreter(
      groveManager,
      mgr,
      unitsPerInch,
      debugMode,
      dsssl2,
      strictMode,
      extensionTable
    );
    this.cmdline_ = Interpreter.makeStringC('');
  }

  // Define a variable from command line
  defineVariable(str: StringC): void {
    // Interpret "name=value" as a string variable setting
    if (str.length_ > 0 && str.ptr_ && str.ptr_[0] === 0x28) { // '('
      // Raw Scheme expression
      this.cmdline_ = this.appendStringC(this.cmdline_, str);
    } else {
      // Look for '=' separator
      let eqPos = -1;
      for (let i = 0; i < str.length_; i++) {
        if (str.ptr_ && str.ptr_[i] === 0x3D) { // '='
          eqPos = i;
          break;
        }
      }

      if (eqPos <= 0 || eqPos >= str.length_) {
        // No '=' or at start/end - treat as boolean #t
        this.cmdline_ = this.appendStringC(this.cmdline_, Interpreter.makeStringC('(define '));
        this.cmdline_ = this.appendStringC(this.cmdline_, str);
        this.cmdline_ = this.appendStringC(this.cmdline_, Interpreter.makeStringC(' #t)'));
      } else {
        // name=value
        this.cmdline_ = this.appendStringC(this.cmdline_, Interpreter.makeStringC('(define '));
        this.cmdline_ = this.appendStringC(this.cmdline_, this.substringC(str, 0, eqPos));
        this.cmdline_ = this.appendStringC(this.cmdline_, Interpreter.makeStringC(' "'));
        if (str.length_ - (eqPos + 1) > 0) {
          this.cmdline_ = this.appendStringC(this.cmdline_, this.substringC(str, eqPos + 1, str.length_ - (eqPos + 1)));
        }
        this.cmdline_ = this.appendStringC(this.cmdline_, Interpreter.makeStringC('")'));
      }
    }
  }

  // Parse a DSSSL specification
  parseSpec(
    specParser: SgmlParser,
    charset: CharsetInfo,
    id: StringC,
    mgr: Messenger
  ): void {
    // In the full implementation, this would:
    // 1. Use DssslSpecEventHandler to load specification parts
    // 2. Parse declaration elements (char-repertoire, standard-chars, etc.)
    // 3. Parse command line definitions
    // 4. Parse style specification body
    // 5. Compile the interpreter

    // For now, simplified implementation:
    // Parse command line definitions if any
    if (this.cmdline_.length_ > 0) {
      const origin = InputSourceOrigin.make();
      const inSrc = new InternalInputSource(this.cmdline_, origin);
      const scm = new SchemeParser(this.interpreter_, inSrc);
      scm.parse();
      this.interpreter_.endPart();
    }

    // Compile the interpreter
    this.interpreter_.compile();
  }

  // Process a node tree with the loaded stylesheet
  process(node: NodePtr, fotb: FOTBuilder): void {
    const context = new ProcessContext(this.interpreter_, fotb);
    context.process(node);
  }

  // Get the interpreter (for testing/debugging)
  interpreter(): Interpreter {
    return this.interpreter_;
  }

  // Helper to append two StringC values
  private appendStringC(a: StringC, b: StringC): StringC {
    if (a.length_ === 0) return b;
    if (b.length_ === 0) return a;

    const result: number[] = [];
    if (a.ptr_) {
      for (let i = 0; i < a.length_; i++) {
        result.push(a.ptr_[i]);
      }
    }
    if (b.ptr_) {
      for (let i = 0; i < b.length_; i++) {
        result.push(b.ptr_[i]);
      }
    }
    return {
      ptr_: result,
      length_: result.length
    } as StringC;
  }

  // Helper to get substring of StringC
  private substringC(s: StringC, start: number, length: number): StringC {
    if (!s.ptr_ || start >= s.length_ || length <= 0) {
      return Interpreter.makeStringC('');
    }
    const result: number[] = [];
    const end = Math.min(start + length, s.length_);
    for (let i = start; i < end; i++) {
      result.push(s.ptr_[i]);
    }
    return {
      ptr_: result,
      length_: result.length
    } as StringC;
  }
}
