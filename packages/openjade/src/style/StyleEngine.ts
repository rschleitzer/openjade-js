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

// Default builtin filename
const DEFAULT_SCHEME_BUILTINS = 'builtins.dsl';

// StyleEngine orchestrates DSSSL stylesheet processing
export class StyleEngine {
  private interpreter_: Interpreter;
  private cmdline_: StringC;
  private groveManager_: GroveManager;

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
    this.groveManager_ = groveManager;

    // Load builtins like upstream does
    this.installBuiltins();
  }

  // Install built-in Scheme definitions from builtins.dsl
  private installBuiltins(): void {
    const sysid = Interpreter.makeStringC(DEFAULT_SCHEME_BUILTINS);
    const src: { value: StringC } = { value: Interpreter.makeStringC('') };
    this.groveManager_.mapSysid(sysid);
    if (this.groveManager_.readEntity(sysid, src)) {
      // Convert StringC to JS string
      let builtinsStr = '';
      if (src.value.ptr_) {
        for (let i = 0; i < src.value.length_; i++) {
          builtinsStr += String.fromCharCode(src.value.ptr_[i]);
        }
      }
      // Parse the builtins as pure Scheme code
      const builtinsSource = Interpreter.makeStringC(builtinsStr);
      const origin = InputSourceOrigin.make();
      const inSrc = new InternalInputSource(builtinsSource, origin);
      const scm = new SchemeParser(this.interpreter_, inSrc);
      scm.parse();
      this.interpreter_.endPart();
    }
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

  // Load and parse a DSSSL stylesheet from a string
  loadStylesheet(dsssl: string): void {
    // Check if this is an SGML-wrapped DSSSL file (has <!doctype or CDATA sections)
    // If so, extract the Scheme code from CDATA sections
    let schemeCode = dsssl;


    if (dsssl.toLowerCase().includes('<!doctype') || dsssl.includes('<![cdata[')) {
      // Extract all CDATA sections
      const cdataRegex = /<!\[cdata\[([\s\S]*?)\]\]>/gi;
      const matches = dsssl.matchAll(cdataRegex);
      const cdataContent: string[] = [];

      for (const match of matches) {
        if (match[1]) {
          cdataContent.push(match[1]);
        }
      }

      if (cdataContent.length > 0) {
        schemeCode = cdataContent.join('\n');
      } else {
        // No CDATA found - might be using marked sections differently
        // Try to extract content between style-specification-body tags
        const bodyRegex = /<style-specification-body[^>]*>([\s\S]*?)<\/style-specification-body>/gi;
        const bodyMatches = dsssl.matchAll(bodyRegex);
        const bodyContent: string[] = [];

        for (const match of bodyMatches) {
          if (match[1]) {
            bodyContent.push(match[1]);
          }
        }

        if (bodyContent.length > 0) {
          schemeCode = bodyContent.join('\n');
        }
      }
    }

    // Convert JS string to StringC
    const styleSource = Interpreter.makeStringC(schemeCode);

    // Parse the stylesheet
    const origin = InputSourceOrigin.make();
    const inSrc = new InternalInputSource(styleSource, origin);
    const scm = new SchemeParser(this.interpreter_, inSrc);
    scm.parse();
    this.interpreter_.endPart();

    // Compile the interpreter
    this.interpreter_.compile();

    // Debug: check if root rule was parsed
    const initMode = this.interpreter_.initialProcessingMode();
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
