// Copyright (c) 1996 James Clark
// See the file COPYING for copying permission.

import { CodingSystem, Decoder, Encoder } from './CodingSystem';
import { Boolean } from './Boolean';
import { Char } from './types';
import { OutputByteStream } from './OutputByteStream';
import { PackedBoolean } from './Boolean';
import { ASSERT } from './macros';

// Note: This is a stub implementation for Win32CodingSystem.
// On non-Windows platforms or in Node.js environments where Windows code pages
// are not available, this provides a fallback that attempts to use standard
// encodings where possible.

export enum SpecialCodePage {
  codePageOEM,
  codePageAnsi
}

// Common Windows code pages and their rough equivalents
const CODE_PAGE_MAPPINGS: { [key: number]: string } = {
  1252: 'windows-1252', // Western European
  1250: 'windows-1250', // Central European
  1251: 'windows-1251', // Cyrillic
  1253: 'windows-1253', // Greek
  1254: 'windows-1254', // Turkish
  1255: 'windows-1255', // Hebrew
  1256: 'windows-1256', // Arabic
  1257: 'windows-1257', // Baltic
  1258: 'windows-1258', // Vietnamese
  932: 'shift_jis', // Japanese
  936: 'gbk', // Simplified Chinese
  949: 'euc-kr', // Korean
  950: 'big5', // Traditional Chinese
  437: 'cp437', // DOS US
  850: 'cp850', // DOS Latin 1
  866: 'cp866' // DOS Cyrillic
};

class SingleByteWin32Decoder extends Decoder {
  private map_: Char[];

  constructor(codePage: number, defaultChar: Char) {
    super();
    this.map_ = new Array(256);

    // Try to build a mapping table
    const encoding = CODE_PAGE_MAPPINGS[codePage];
    if (encoding && this.isEncodingSupported(encoding)) {
      // Build mapping using TextDecoder
      try {
        const decoder = new TextDecoder(encoding, { fatal: false });
        for (let i = 0; i < 256; i++) {
          const buf = new Uint8Array([i]);
          const decoded = decoder.decode(buf);
          if (decoded.length > 0) {
            this.map_[i] = decoded.charCodeAt(0);
          } else {
            this.map_[i] = defaultChar;
          }
        }
      } catch (e) {
        // Fallback to identity mapping
        for (let i = 0; i < 256; i++) {
          this.map_[i] = i < 128 ? i : defaultChar;
        }
      }
    } else {
      // Fallback: assume ASCII for 0-127, use default char for 128-255
      for (let i = 0; i < 256; i++) {
        this.map_[i] = i < 128 ? i : defaultChar;
      }
    }
  }

  private isEncodingSupported(encoding: string): boolean {
    try {
      new TextDecoder(encoding);
      return true;
    } catch {
      return false;
    }
  }

  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    const fromBytes = typeof from === 'string' ? this.stringToBytes(from) : from;

    for (let i = 0; i < fromLen; i++) {
      to[i] = this.map_[fromBytes[i] & 0xff];
    }
    rest.value = fromLen;
    return fromLen;
  }

  private stringToBytes(s: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < s.length; i++) {
      bytes.push(s.charCodeAt(i) & 0xff);
    }
    return bytes;
  }

  convertOffset(offset: { value: number }): Boolean {
    return true;
  }
}

class MultiByteWin32Decoder extends Decoder {
  private codePage_: number;
  private defaultChar_: Char;
  private isLeadByte_: PackedBoolean[];
  private encoding_: string | null;

  constructor(codePage: number, defaultChar: Char, leadByte: number[]) {
    super();
    this.codePage_ = codePage;
    this.defaultChar_ = defaultChar;
    this.isLeadByte_ = new Array(256);
    this.encoding_ = CODE_PAGE_MAPPINGS[codePage] || null;

    for (let i = 0; i < 256; i++) {
      this.isLeadByte_[i] = false;
    }

    // MAX_LEADBYTES is 12 in Windows API
    for (let i = 0; i < leadByte.length && i < 12; i += 2) {
      if (leadByte[i] === 0 && leadByte[i + 1] === 0) {
        break;
      }
      const lim = leadByte[i + 1];
      for (let j = leadByte[i]; j <= lim; j++) {
        this.isLeadByte_[j] = true;
      }
    }
  }

  decode(to: Char[], from: string | number[], fromLen: number, rest: { value: number }): number {
    const fromBytes = typeof from === 'string' ? this.stringToBytes(from) : from;

    // Find trailing lead bytes
    let i = fromLen;
    while (i > 0) {
      if (!this.isLeadByte_[fromBytes[i - 1] & 0xff]) {
        break;
      }
      i--;
    }
    if ((fromLen - i) & 1) {
      fromLen--;
    }

    if (this.encoding_ && this.isEncodingSupported(this.encoding_)) {
      try {
        const decoder = new TextDecoder(this.encoding_, { fatal: false });
        const buf = new Uint8Array(fromBytes.slice(0, fromLen));
        const decoded = decoder.decode(buf);

        let toIdx = 0;
        for (let j = 0; j < decoded.length; j++) {
          to[toIdx++] = decoded.charCodeAt(j);
        }
        rest.value = fromLen;
        return toIdx;
      } catch (e) {
        // Fall through to character-by-character decoding
      }
    }

    // Character-by-character fallback
    let toIdx = 0;
    let fromIdx = 0;
    while (fromIdx < fromLen) {
      const nBytes = 1 + (this.isLeadByte_[fromBytes[fromIdx] & 0xff] ? 1 : 0);
      ASSERT(nBytes <= fromLen - fromIdx);

      if (this.encoding_ && this.isEncodingSupported(this.encoding_)) {
        try {
          const decoder = new TextDecoder(this.encoding_, { fatal: true });
          const buf = new Uint8Array(fromBytes.slice(fromIdx, fromIdx + nBytes));
          const decoded = decoder.decode(buf);
          if (decoded.length > 0) {
            to[toIdx] = decoded.charCodeAt(0);
          } else {
            to[toIdx] = this.defaultChar_;
          }
        } catch {
          to[toIdx] = this.defaultChar_;
        }
      } else {
        // Fallback: use default char for multi-byte sequences
        to[toIdx] = this.defaultChar_;
      }

      fromIdx += nBytes;
      toIdx++;
    }

    rest.value = fromIdx;
    return toIdx;
  }

  private stringToBytes(s: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < s.length; i++) {
      bytes.push(s.charCodeAt(i) & 0xff);
    }
    return bytes;
  }

  private isEncodingSupported(encoding: string): boolean {
    try {
      new TextDecoder(encoding);
      return true;
    } catch {
      return false;
    }
  }
}

class Win32Encoder extends Encoder {
  private codePage_: number;
  private buf_: number[] | null;
  private bufLen_: number;
  private encoding_: string | null;

  constructor(codePage: number) {
    super();
    this.codePage_ = codePage;
    this.buf_ = null;
    this.bufLen_ = 0;
    this.encoding_ = CODE_PAGE_MAPPINGS[codePage] || null;
  }

  output(s: number[], n: number, sb: OutputByteStream | null): void {
    if (!sb || n === 0) return;

    const neededLen = n * 2;
    if (neededLen > this.bufLen_) {
      this.buf_ = null;
      this.bufLen_ = neededLen;
      this.buf_ = new Array(this.bufLen_);
    }

    if (this.encoding_ && this.isEncodingSupported(this.encoding_)) {
      try {
        // Convert Char array to string
        let str = '';
        for (let i = 0; i < n; i++) {
          str += String.fromCharCode(s[i]);
        }

        const encoder = new TextEncoder();
        // Note: TextEncoder always uses UTF-8, so this is an approximation
        // For true Windows code page encoding, we'd need a platform-specific library
        const encoded = encoder.encode(str);

        for (let i = 0; i < encoded.length; i++) {
          sb.sputc(encoded[i]);
        }
        return;
      } catch (e) {
        // Fall through to simple output
      }
    }

    // Fallback: simple byte output (assumes characters fit in bytes)
    for (let i = 0; i < n; i++) {
      sb.sputc(s[i] & 0xff);
    }
  }

  private isEncodingSupported(encoding: string): boolean {
    try {
      new TextDecoder(encoding);
      return true;
    } catch {
      return false;
    }
  }
}

export class Win32CodingSystem extends CodingSystem {
  private codePage_: number;
  private defaultChar_: Char;

  constructor(codePage: number | SpecialCodePage, defaultChar: Char = 0xfffd) {
    super();
    this.defaultChar_ = defaultChar;

    if (typeof codePage === 'number' && codePage in SpecialCodePage) {
      // Special code page
      if (codePage === SpecialCodePage.codePageAnsi) {
        // ANSI code page - on Windows this would be GetACP()
        // Default to Windows-1252 (Western European)
        this.codePage_ = 1252;
      } else {
        // OEM code page - on Windows this would be GetOEMCP()
        // Default to CP437 (DOS US)
        this.codePage_ = 437;
      }
    } else {
      this.codePage_ = codePage as number;
    }
  }

  isValid(): Boolean {
    // Check if we have a known mapping for this code page
    return this.codePage_ in CODE_PAGE_MAPPINGS || this.codePage_ === 1252 || this.codePage_ === 437;
  }

  makeDecoder(): Decoder {
    // For simplicity, we assume single-byte encoding for most code pages
    // except the known multi-byte ones
    const multiByteCodePages = [932, 936, 949, 950]; // Japanese, Chinese, Korean

    if (multiByteCodePages.includes(this.codePage_)) {
      // Provide lead byte ranges for common multi-byte code pages
      const leadBytes = this.getLeadByteRanges(this.codePage_);
      return new MultiByteWin32Decoder(this.codePage_, this.defaultChar_, leadBytes);
    } else {
      return new SingleByteWin32Decoder(this.codePage_, this.defaultChar_);
    }
  }

  makeEncoder(): Encoder {
    return new Win32Encoder(this.codePage_);
  }

  private getLeadByteRanges(codePage: number): number[] {
    // Approximate lead byte ranges for common multi-byte code pages
    switch (codePage) {
      case 932: // Shift-JIS
        return [0x81, 0x9f, 0xe0, 0xfc, 0, 0];
      case 936: // GBK
        return [0x81, 0xfe, 0, 0];
      case 949: // EUC-KR
        return [0x81, 0xfe, 0, 0];
      case 950: // Big5
        return [0x81, 0xfe, 0, 0];
      default:
        return [0, 0];
    }
  }
}
