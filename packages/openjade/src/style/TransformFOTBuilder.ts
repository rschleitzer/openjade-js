// Copyright (c) 1997 James Clark
// See the file copying.txt for copying permission.

import { StringC, Char } from '@openjade-js/opensp';
import { String as StringOf } from '@openjade-js/opensp';
import { NodePtr, GroveString } from '../grove/Node';
import { FOTBuilder } from './FOTBuilder';

const RE = 0x0D; // carriage return (SGML record end) - matches upstream

// Document type non-inherited characteristics
export interface DocumentTypeNIC {
  name: StringC;
  publicId: StringC;
  systemId: StringC;
}

// Element non-inherited characteristics
export interface ElementNIC {
  gi: StringC;
  attributes: StringC[];
}

// Output character stream interface
export interface OutputCharStream {
  write(s: string): void;
  put(c: number): void;
  flush(): void;
  close?(): void;
}

// Simple string-based output stream
export class StringOutputStream implements OutputCharStream {
  private buffer_: string[] = [];

  write(s: string): void {
    this.buffer_.push(s);
  }

  put(c: number): void {
    this.buffer_.push(String.fromCharCode(c));
  }

  flush(): void {
    // Nothing to flush for in-memory string
  }

  toString(): string {
    return this.buffer_.join('');
  }

  clear(): void {
    this.buffer_ = [];
  }
}

// File-based output stream
export class FileOutputStream implements OutputCharStream {
  private filename_: string;
  private buffer_: string[] = [];
  private fs_: typeof import('fs') | null = null;

  constructor(filename: string) {
    this.filename_ = filename;
    // Dynamic import of fs to avoid issues in browser environments
    try {
      this.fs_ = require('fs');
    } catch {
      // fs not available - will fail on flush
    }
  }

  write(s: string): void {
    this.buffer_.push(s);
  }

  put(c: number): void {
    this.buffer_.push(String.fromCharCode(c));
  }

  flush(): void {
    if (this.fs_ && this.buffer_.length > 0) {
      const content = this.buffer_.join('');
      this.fs_.writeFileSync(this.filename_, content, 'utf8');
      this.buffer_ = [];
    }
  }

  close(): void {
    this.flush();
  }
}

// Record output stream wrapper - handles RS/RE translation like upstream RecordOutputCharStream
// Converts CR (RE = 0x0D) to LF (platform newline), strips LF (RS = 0x0A).
// This handles: CRLF pairs → LF, lone CR → LF, lone LF → stripped
export class RecordOutputStream implements OutputCharStream {
  private os_: OutputCharStream;

  constructor(os: OutputCharStream) {
    this.os_ = os;
  }

  write(s: string): void {
    // Convert CR to LF, strip original LF (following upstream RecordOutputCharStream::outputBuf)
    let result = '';
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 0x0D) {
        // CR (RE) → convert to LF
        result += '\n';
      } else if (c === 0x0A) {
        // LF (RS) → ignore/strip
      } else {
        result += s[i];
      }
    }
    this.os_.write(result);
  }

  put(c: number): void {
    if (c === 0x0D) {
      // CR (RE) → convert to LF
      this.os_.put(0x0A);
    } else if (c === 0x0A) {
      // LF (RS) → ignore/strip
    } else {
      this.os_.put(c);
    }
  }

  flush(): void {
    this.os_.flush();
  }

  close(): void {
    this.os_.close?.();
  }
}

// Record end state
enum ReState {
  stateMiddle = 0,
  stateStartOfElement = 1,
  statePendingRe = 2
}

// Open file info for entity stack
interface OpenFile {
  systemId: string;
  saveOs: OutputCharStream;
  os: OutputCharStream | null;
}

// Helper function to output numeric character reference
function outputNumericCharRef(os: OutputCharStream, c: number): void {
  os.write('&#' + c.toString() + ';');
}

// Helper function to check if string contains a character
function containsChar(str: StringC, c: number): boolean {
  const len = str.size();
  const ptr = str.ptr_;
  if (!ptr) return false;
  for (let i = 0; i < len; i++) {
    if (ptr[i] === c) return true;
  }
  return false;
}

// Helper to convert StringC to string
function stringCToString(str: StringC): string {
  const len = str.size();
  const ptr = str.ptr_;
  if (!ptr) return '';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(ptr[i] as number);
  }
  return result;
}

// Helper to create a StringC from a JavaScript string
function makeStringC(s: string): StringC {
  const arr: Char[] = [];
  for (let i = 0; i < s.length; i++) {
    arr.push(s.charCodeAt(i));
  }
  return new StringOf<Char>(arr, arr.length);
}

// Transform FOT Builder - outputs SGML/XML
export class TransformFOTBuilder extends FOTBuilder {
  private os_: OutputCharStream;
  private openElements_: StringC[] = [];
  private undefGi_: StringC;
  private xml_: boolean;
  private state_: ReState = ReState.stateMiddle;
  private preserveSdata_: boolean = false;
  private RE_: string;
  private SP_: string;
  private preserveSdataStack_: boolean[] = [false];
  private openFileStack_: OpenFile[] = [];

  constructor(os: OutputCharStream, xml: boolean = false, options: string[] = []) {
    super();
    this.os_ = os;
    this.xml_ = xml;
    this.undefGi_ = makeStringC('#UNDEF');

    this.RE_ = String.fromCharCode(RE);
    this.SP_ = String.fromCharCode(RE);

    // Check for "raw" option
    for (const opt of options) {
      if (opt === 'raw') {
        this.RE_ = '';
        this.SP_ = ' ';
      }
    }
  }

  private os(): OutputCharStream {
    return this.os_;
  }

  private flushPendingRe(): void {
    if (this.state_ === ReState.statePendingRe) {
      this.os().put(RE);
      this.state_ = ReState.stateMiddle;
    }
  }

  private flushPendingReCharRef(): void {
    if (this.state_ === ReState.statePendingRe) {
      this.os().write('&#10;'); // LF for Unix-style newlines
      this.state_ = ReState.stateMiddle;
    }
  }

  private outputAttributes(atts: StringC[]): void {
    for (let i = 0; i < atts.length; i += 2) {
      this.os().write(this.SP_ + stringCToString(atts[i]) + '=');
      const s = atts[i + 1];

      // Determine best quote character
      let quoteChar = '';
      if (!containsChar(s, 0x26)) { // &
        if (!containsChar(s, 0x22)) { // "
          quoteChar = '"';
        } else if (!containsChar(s, 0x27)) { // '
          quoteChar = "'";
        }
      }

      if (quoteChar) {
        this.os().write(quoteChar + stringCToString(s) + quoteChar);
      } else {
        this.os().write('"');
        const len = s.size();
        const ptr = s.ptr_;
        if (ptr) {
          for (let j = 0; j < len; j++) {
            const c = ptr[j] as number;
            if (c === 0x22) { // "
              if (this.xml_) {
                this.os().write('&quot;');
              } else {
                outputNumericCharRef(this.os(), 0x22);
              }
            } else if (c === 0x26) { // &
              if (this.xml_) {
                this.os().write('&amp;');
              } else {
                outputNumericCharRef(this.os(), 0x26);
              }
            } else {
              this.os().put(c);
            }
          }
        }
        this.os().write('"');
      }
    }
  }

  // Public API methods

  documentType(nic: DocumentTypeNIC): void {
    this.flushPendingRe();
    if (nic.name.size() > 0) {
      this.os().write('<!DOCTYPE ' + stringCToString(nic.name));
      if (nic.publicId.size() > 0) {
        this.os().write(' PUBLIC "' + stringCToString(nic.publicId) + '"');
      } else {
        this.os().write(' SYSTEM');
      }
      if (nic.systemId.size() > 0) {
        if (nic.publicId.size() > 0) {
          this.os().write(' ');
        }
        const quote = containsChar(nic.systemId, 0x22) ? "'" : '"';
        this.os().write(quote + stringCToString(nic.systemId) + quote);
      }
      this.os().write('>' + String.fromCharCode(RE));
    }
  }

  startElement(nic: ElementNIC): void {
    this.flushPendingRe();
    this.os().write('<');
    const gi = nic.gi.size() === 0 ? this.undefGi_ : nic.gi;
    this.os().write(stringCToString(gi));
    this.outputAttributes(nic.attributes);
    this.os().write(this.RE_ + '>');
    this.openElements_.push(gi);
    this.start();
    this.state_ = ReState.stateStartOfElement;
  }

  endElement(): void {
    this.flushPendingReCharRef();
    const gi = this.openElements_.pop();
    if (gi) {
      this.os().write('</' + stringCToString(gi) + this.RE_ + '>');
    }
    this.end();
    this.state_ = ReState.stateMiddle;
  }

  emptyElement(nic: ElementNIC): void {
    this.flushPendingRe();
    this.os().write('<');
    const gi = nic.gi.size() === 0 ? this.undefGi_ : nic.gi;
    this.os().write(stringCToString(gi));
    this.outputAttributes(nic.attributes);
    if (this.xml_) {
      this.os().write('/>');
    } else {
      this.os().write('>');
    }
    this.state_ = ReState.stateMiddle;
  }

  processingInstruction(s: StringC): void {
    this.flushPendingReCharRef();
    this.os().write('<?' + stringCToString(s));
    if (this.xml_) {
      this.os().write('?>');
    } else {
      this.os().write('>');
    }
  }

  override formattingInstruction(s: string): void {
    this.flushPendingRe();
    this.os().write(s);
  }

  entityRef(s: StringC): void {
    this.flushPendingRe();
    this.os().write('&' + stringCToString(s) + ';');
  }

  override characters(s: Uint32Array, n: number): void {
    if (n === 0) return;

    this.flushPendingRe();
    let start = 0;

    if (this.state_ === ReState.stateStartOfElement && s[0] === RE) {
      start = 1;
      this.os().write('&#10;'); // LF for Unix-style newlines
      if (n === 1) {
        this.state_ = ReState.stateMiddle;
        return;
      }
    }

    if (s[n - 1] === RE) {
      n--;
      this.state_ = ReState.statePendingRe;
    } else {
      this.state_ = ReState.stateMiddle;
    }

    for (let i = start; i < n; i++) {
      const c = s[i];
      switch (c) {
        case 0x26: // &
          if (this.xml_) {
            this.os().write('&amp;');
          } else {
            outputNumericCharRef(this.os(), c);
          }
          break;
        case 0x3C: // <
          if (this.xml_) {
            this.os().write('&lt;');
          } else {
            outputNumericCharRef(this.os(), c);
          }
          break;
        case 0x3E: // >
          if (this.xml_) {
            this.os().write('&gt;');
          } else {
            outputNumericCharRef(this.os(), c);
          }
          break;
        default:
          this.os().put(c);
          break;
      }
    }
  }

  charactersFromNode(nd: NodePtr, s: Uint32Array, n: number): void {
    if (this.preserveSdata_ && n === 1) {
      const name = nd.getGi(); // Use getGi as proxy for entity name for now
      if (name) {
        this.flushPendingRe();
        this.os().write('&');
        const data = name.data();
        const len = name.size();
        if (data) {
          for (let i = 0; i < len; i++) {
            this.os().put(name.get(i));
          }
        }
        this.os().write(';');
        return;
      }
    }
    this.characters(s, n);
  }

  setPreserveSdata(b: boolean): void {
    this.preserveSdata_ = b;
  }

  start(): void {
    this.preserveSdataStack_.push(this.preserveSdata_);
  }

  end(): void {
    this.preserveSdataStack_.pop();
    const last = this.preserveSdataStack_[this.preserveSdataStack_.length - 1];
    this.preserveSdata_ = last ?? false;
  }

  // Start a new entity (output file)
  override startEntity(systemId: StringC): void {
    this.flushPendingRe();
    const sysIdStr = stringCToString(systemId);

    const openFile: OpenFile = {
      systemId: sysIdStr,
      saveOs: this.os_,
      os: null
    };

    if (sysIdStr.length > 0) {
      // Wrap FileOutputStream with RecordOutputStream for RS/RE handling
      openFile.os = new RecordOutputStream(new FileOutputStream(sysIdStr));
      this.os_ = openFile.os;
    }

    this.openFileStack_.push(openFile);
  }

  // End current entity (close output file)
  override endEntity(): void {
    this.flushPendingRe();

    if (this.openFileStack_.length === 0) {
      return;
    }

    const openFile = this.openFileStack_.pop()!;
    if (openFile.os) {
      openFile.os.flush();
      openFile.os.close();
    }
    this.os_ = openFile.saveOs;
  }

  // Flush output buffer when done
  override flush(): void {
    this.os_.flush();
  }
}

// Factory function to create Transform FOT Builder
export function makeTransformFOTBuilder(
  os: OutputCharStream,
  xml: boolean = false,
  options: string[] = []
): TransformFOTBuilder {
  return new TransformFOTBuilder(os, xml, options);
}
