// Copyright (c) 1997 James Clark
// See the file COPYING for copying permission.

import { Boolean } from './Boolean';
import { Char } from './types';
import { StringC } from './StringC';
import { CodingSystem, InputCodingSystem } from './CodingSystem';
import { Resource } from './Resource';
import { CharsetInfo } from './CharsetInfo';
import { TranslateCodingSystem } from './TranslateCodingSystem';
import { UTF8CodingSystem } from './UTF8CodingSystem';
import { UTF16CodingSystem } from './UTF16CodingSystem';
import { Fixed2CodingSystem } from './Fixed2CodingSystem';
import { Fixed4CodingSystem } from './Fixed4CodingSystem';
import { UnicodeCodingSystem } from './UnicodeCodingSystem';
import { EUCJPCodingSystem } from './EUCJPCodingSystem';
import { SJISCodingSystem } from './SJISCodingSystem';
import { Big5CodingSystem } from './Big5CodingSystem';
import { IdentityCodingSystem } from './IdentityCodingSystem';
import { XMLCodingSystem } from './XMLCodingSystem';
import { Win32CodingSystem, SpecialCodePage } from './Win32CodingSystem';
import { Owner } from './Owner';
import { CharsetRegistry } from './CharsetRegistry';
import { UnivCharsetDesc } from './UnivCharsetDesc';
import { WideChar, UnivChar } from './types';
import { charMax } from './constant';

const unicodeReplaceChar = 0xfffd;

export abstract class InputCodingSystemKit extends Resource {
  protected systemCharset_: CharsetInfo;

  constructor() {
    super();
    this.systemCharset_ = new CharsetInfo();
  }

  abstract identityInputCodingSystem(): InputCodingSystem | null;
  abstract makeInputCodingSystem(
    s: StringC,
    charset: CharsetInfo,
    isBctf: Boolean,
    staticName: { value: string | null }
  ): InputCodingSystem | null;
  abstract replacementChar(): Char;

  systemCharset(): CharsetInfo {
    return this.systemCharset_;
  }
}

export abstract class CodingSystemKit extends InputCodingSystemKit {
  abstract copy(): CodingSystemKit;
  abstract identityCodingSystem(): CodingSystem | null;
  abstract makeCodingSystem(name: string, isBctf: Boolean): CodingSystem | null;

  static make(systemCharsetName: string | null): CodingSystemKit {
    if (systemCharsetName && CodingSystemKitImpl.matchStatic(systemCharsetName, 'JIS')) {
      return new CodingSystemKitImpl(jis2Desc);
    }
    return new CodingSystemKitImpl(iso10646Desc);
  }
}

enum CodingSystemId {
  identity,
  fixed2,
  fixed4,
  utf8,
  utf16,
  unicode,
  eucjp,
  euccn,
  euckr,
  sjisBctf,
  eucBctf,
  sjis,
  big5,
  big5Bctf,
  ansi,
  oem,
  maybeUnicode,
  xml,
  iso8859_1,
  iso8859_2,
  iso8859_3,
  iso8859_4,
  iso8859_5,
  iso8859_6,
  iso8859_7,
  iso8859_8,
  iso8859_9,
  koi8_r
}

interface Entry {
  name: string;
  id: CodingSystemId;
}

// Character set descriptors
const iso10646Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO10646_UCS2, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const jisDesc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_JIS_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.JIS0201, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.JIS0208, add: 0x8080 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const jis2Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_JIS_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.JIS0201, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.JIS0208, add: 0x8080 },
  { number: CharsetRegistry.ISORegistrationNumber.JIS0212, add: 0x8000 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const gbDesc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.GB2312, add: 0x8080 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const big5Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.BIG5, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const kscDesc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.KSC5601, add: 0x8080 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const iso8859_1Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_1, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const iso8859_2Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_2, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const iso8859_3Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_3, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const iso8859_4Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_4, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const iso8859_5Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_5, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const iso8859_6Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_6, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const iso8859_7Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_7, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const iso8859_8Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_8, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const iso8859_9Desc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO6429, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO8859_9, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

const koi8_rDesc: TranslateCodingSystem.Desc[] = [
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_C0, add: 0x0 },
  { number: CharsetRegistry.ISORegistrationNumber.ISO646_ASCII_G0, add: 0x0 },
  // FIXME: only GR part of KOI8-R is handled (i.e. 160..255)
  //        since koi8-r does not follow ISO control/graphic model
  { number: CharsetRegistry.ISORegistrationNumber.KOI8_R, add: 0x80 },
  { number: CharsetRegistry.ISORegistrationNumber.UNREGISTERED, add: 0x0 }
];

class CodingSystemKitImpl extends CodingSystemKit {
  private fixed2CodingSystem_: Fixed2CodingSystem;
  private fixed4CodingSystem_: Fixed4CodingSystem;
  private utf8CodingSystem_: UTF8CodingSystem;
  private utf16CodingSystem_: UTF16CodingSystem;
  private unicodeCodingSystem_: UnicodeCodingSystem;
  private eucBctf_: EUCJPCodingSystem;
  private sjisBctf_: SJISCodingSystem;
  private big5Bctf_: Big5CodingSystem;
  private eucjpCodingSystem_: TranslateCodingSystem;
  private euccnCodingSystem_: TranslateCodingSystem;
  private euckrCodingSystem_: TranslateCodingSystem;
  private sjisCodingSystem_: TranslateCodingSystem;
  private big5CodingSystem_: TranslateCodingSystem;
  private iso8859_1CodingSystem_: TranslateCodingSystem;
  private iso8859_2CodingSystem_: TranslateCodingSystem;
  private iso8859_3CodingSystem_: TranslateCodingSystem;
  private iso8859_4CodingSystem_: TranslateCodingSystem;
  private iso8859_5CodingSystem_: TranslateCodingSystem;
  private iso8859_6CodingSystem_: TranslateCodingSystem;
  private iso8859_7CodingSystem_: TranslateCodingSystem;
  private iso8859_8CodingSystem_: TranslateCodingSystem;
  private iso8859_9CodingSystem_: TranslateCodingSystem;
  private koi8_rCodingSystem_: TranslateCodingSystem;
  private xmlCodingSystem_: XMLCodingSystem;
  private ansiCodingSystem_: Win32CodingSystem;
  private oemCodingSystem_: Win32CodingSystem;
  private maybeUnicodeCodingSystem_: UnicodeCodingSystem;
  private identityCodingSystem_: IdentityCodingSystem;
  private systemCharsetDesc_: TranslateCodingSystem.Desc[];

  private static readonly bctfTable_: Entry[] = [
    { name: 'IDENTITY', id: CodingSystemId.identity },
    { name: 'FIXED-2', id: CodingSystemId.fixed2 },
    { name: 'FIXED-4', id: CodingSystemId.fixed4 },
    { name: 'UTF-8', id: CodingSystemId.utf8 },
    { name: 'EUC', id: CodingSystemId.eucBctf },
    { name: 'SJIS', id: CodingSystemId.sjisBctf },
    { name: 'BIG5', id: CodingSystemId.big5Bctf },
    { name: '', id: CodingSystemId.identity }
  ];

  private static readonly nEncodingsRequireUnicode = 12;

  private static readonly encodingTable_: Entry[] = [
    { name: 'UTF-8', id: CodingSystemId.utf8 },
    { name: 'UCS-2', id: CodingSystemId.fixed2 },
    { name: 'ISO-10646-UCS-2', id: CodingSystemId.fixed2 },
    { name: 'UCS-4', id: CodingSystemId.fixed4 },
    { name: 'ISO-10646-UCS-4', id: CodingSystemId.fixed4 },
    { name: 'UTF-32', id: CodingSystemId.fixed4 },
    { name: 'UNICODE', id: CodingSystemId.unicode },
    { name: 'UTF-16', id: CodingSystemId.utf16 },
    { name: 'WINDOWS', id: CodingSystemId.ansi },
    { name: 'MS-DOS', id: CodingSystemId.oem },
    { name: 'WUNICODE', id: CodingSystemId.maybeUnicode },
    { name: 'XML', id: CodingSystemId.xml },
    // nEncodingsRequireUnicode = 12
    { name: 'IS8859-1', id: CodingSystemId.iso8859_1 },
    { name: 'ISO-8859-1', id: CodingSystemId.iso8859_1 },
    { name: 'IS8859-2', id: CodingSystemId.iso8859_2 },
    { name: 'ISO-8859-2', id: CodingSystemId.iso8859_2 },
    { name: 'IS8859-3', id: CodingSystemId.iso8859_3 },
    { name: 'ISO-8859-3', id: CodingSystemId.iso8859_3 },
    { name: 'IS8859-4', id: CodingSystemId.iso8859_4 },
    { name: 'ISO-8859-4', id: CodingSystemId.iso8859_4 },
    { name: 'IS8859-5', id: CodingSystemId.iso8859_5 },
    { name: 'ISO-8859-5', id: CodingSystemId.iso8859_5 },
    { name: 'IS8859-6', id: CodingSystemId.iso8859_6 },
    { name: 'ISO-8859-6', id: CodingSystemId.iso8859_6 },
    { name: 'IS8859-7', id: CodingSystemId.iso8859_7 },
    { name: 'ISO-8859-7', id: CodingSystemId.iso8859_7 },
    { name: 'IS8859-8', id: CodingSystemId.iso8859_8 },
    { name: 'ISO-8859-8', id: CodingSystemId.iso8859_8 },
    { name: 'IS8859-9', id: CodingSystemId.iso8859_9 },
    { name: 'ISO-8859-9', id: CodingSystemId.iso8859_9 },
    { name: 'KOI8-R', id: CodingSystemId.koi8_r },
    { name: 'KOI8', id: CodingSystemId.koi8_r },
    { name: 'EUC-JP', id: CodingSystemId.eucjp },
    { name: 'EUC-CN', id: CodingSystemId.euccn },
    { name: 'GB2312', id: CodingSystemId.euccn },
    { name: 'CN-GB', id: CodingSystemId.euccn },
    { name: 'EUC-KR', id: CodingSystemId.euckr },
    { name: 'SJIS', id: CodingSystemId.sjis },
    { name: 'SHIFT_JIS', id: CodingSystemId.sjis },
    { name: 'BIG5', id: CodingSystemId.big5 },
    { name: 'CN-BIG5', id: CodingSystemId.big5 },
    { name: '', id: CodingSystemId.identity }
  ];

  constructor(systemCharsetDesc: TranslateCodingSystem.Desc[]) {
    super();
    this.systemCharsetDesc_ = systemCharsetDesc;
    this.identityCodingSystem_ = new IdentityCodingSystem();
    this.fixed2CodingSystem_ = new Fixed2CodingSystem();
    this.fixed4CodingSystem_ = new Fixed4CodingSystem();
    this.utf8CodingSystem_ = new UTF8CodingSystem();
    this.utf16CodingSystem_ = new UTF16CodingSystem();
    this.unicodeCodingSystem_ = new UnicodeCodingSystem();
    this.eucBctf_ = new EUCJPCodingSystem();
    this.sjisBctf_ = new SJISCodingSystem();
    this.big5Bctf_ = new Big5CodingSystem();
    this.xmlCodingSystem_ = new XMLCodingSystem(this);
    this.ansiCodingSystem_ = new Win32CodingSystem(SpecialCodePage.codePageAnsi);
    this.oemCodingSystem_ = new Win32CodingSystem(SpecialCodePage.codePageOEM);
    this.maybeUnicodeCodingSystem_ = new UnicodeCodingSystem();

    // Initialize TranslateCodingSystems
    this.iso8859_1CodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      iso8859_1Desc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.iso8859_2CodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      iso8859_2Desc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.iso8859_3CodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      iso8859_3Desc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.iso8859_4CodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      iso8859_4Desc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.iso8859_5CodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      iso8859_5Desc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.iso8859_6CodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      iso8859_6Desc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.iso8859_7CodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      iso8859_7Desc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.iso8859_8CodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      iso8859_8Desc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.iso8859_9CodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      iso8859_9Desc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.koi8_rCodingSystem_ = new TranslateCodingSystem(
      this.identityCodingSystem_,
      koi8_rDesc,
      this.systemCharset_,
      0x100,
      unicodeReplaceChar
    );
    this.eucjpCodingSystem_ = new TranslateCodingSystem(
      this.eucBctf_,
      jis2Desc,
      this.systemCharset_,
      0x8000,
      unicodeReplaceChar
    );
    this.euccnCodingSystem_ = new TranslateCodingSystem(
      this.eucBctf_,
      gbDesc,
      this.systemCharset_,
      0x8000,
      unicodeReplaceChar
    );
    this.euckrCodingSystem_ = new TranslateCodingSystem(
      this.eucBctf_,
      kscDesc,
      this.systemCharset_,
      0x8000,
      unicodeReplaceChar
    );
    this.sjisCodingSystem_ = new TranslateCodingSystem(
      this.sjisBctf_,
      jisDesc,
      this.systemCharset_,
      0x8000,
      unicodeReplaceChar
    );
    this.big5CodingSystem_ = new TranslateCodingSystem(
      this.big5Bctf_,
      big5Desc,
      this.systemCharset_,
      0x0080,
      unicodeReplaceChar
    );

    // Build system charset
    const desc = new UnivCharsetDesc();
    for (const p of systemCharsetDesc) {
      if (p.number === CharsetRegistry.ISORegistrationNumber.UNREGISTERED) {
        break;
      }
      const iter = CharsetRegistry.makeIter(p.number);
      if (iter) {
        const min = { value: 0 as WideChar };
        const max = { value: 0 as WideChar };
        const univ = { value: 0 as UnivChar };
        while (iter.next(min, max, univ)) {
          let adjustedMin = min.value + p.add;
          let adjustedMax = max.value + p.add;
          if (adjustedMin <= charMax) {
            if (adjustedMax > charMax) {
              adjustedMax = charMax;
            }
            desc.addRange(adjustedMin, adjustedMax, univ.value);
          }
        }
      }
    }
    this.systemCharset_.set(desc);
  }

  copy(): CodingSystemKit {
    return new CodingSystemKitImpl(this.systemCharsetDesc_);
  }

  identityInputCodingSystem(): InputCodingSystem {
    return this.identityCodingSystem_;
  }

  identityCodingSystem(): CodingSystem {
    return this.identityCodingSystem_;
  }

  makeInputCodingSystem(
    s: StringC,
    charset: CharsetInfo,
    isBctf: Boolean,
    staticName: { value: string | null }
  ): InputCodingSystem | null {
    const entries = this.firstEntry(isBctf);
    for (const entry of entries) {
      if (!entry.name) break;
      if (CodingSystemKitImpl.match(s, charset, entry.name)) {
        staticName.value = entry.name;
        return this.makeCodingSystemById(entry.id);
      }
    }
    return null;
  }

  makeCodingSystem(name: string, isBctf: Boolean): CodingSystem | null {
    const entries = this.firstEntry(isBctf);
    for (const entry of entries) {
      if (!entry.name) break;
      if (CodingSystemKitImpl.matchStatic(name, entry.name)) {
        return this.makeCodingSystemById(entry.id);
      }
    }
    return null;
  }

  replacementChar(): Char {
    // FIXME should vary with systemCharset
    return unicodeReplaceChar;
  }

  private firstEntry(isBctf: Boolean): Entry[] {
    if (isBctf) {
      return CodingSystemKitImpl.bctfTable_;
    } else if (this.systemCharsetDesc_ !== iso10646Desc) {
      return CodingSystemKitImpl.encodingTable_.slice(
        CodingSystemKitImpl.nEncodingsRequireUnicode
      );
    } else {
      return CodingSystemKitImpl.encodingTable_;
    }
  }

  private makeCodingSystemById(id: CodingSystemId): CodingSystem | null {
    switch (id) {
      case CodingSystemId.identity:
        return this.identityCodingSystem_;
      case CodingSystemId.fixed2:
        return this.fixed2CodingSystem_;
      case CodingSystemId.fixed4:
        return this.fixed4CodingSystem_;
      case CodingSystemId.utf8:
        return this.utf8CodingSystem_;
      case CodingSystemId.utf16:
        return this.utf16CodingSystem_;
      case CodingSystemId.unicode:
        return this.unicodeCodingSystem_;
      case CodingSystemId.eucBctf:
        return this.eucBctf_;
      case CodingSystemId.sjisBctf:
        return this.sjisBctf_;
      case CodingSystemId.big5Bctf:
        return this.big5Bctf_;
      case CodingSystemId.eucjp:
        return this.eucjpCodingSystem_;
      case CodingSystemId.euccn:
        return this.euccnCodingSystem_;
      case CodingSystemId.euckr:
        return this.euckrCodingSystem_;
      case CodingSystemId.sjis:
        return this.sjisCodingSystem_;
      case CodingSystemId.big5:
        return this.big5CodingSystem_;
      case CodingSystemId.iso8859_1:
        if (this.systemCharsetDesc_ === iso10646Desc) {
          return this.identityCodingSystem_;
        } else {
          return this.iso8859_1CodingSystem_;
        }
      case CodingSystemId.iso8859_2:
        return this.iso8859_2CodingSystem_;
      case CodingSystemId.iso8859_3:
        return this.iso8859_3CodingSystem_;
      case CodingSystemId.iso8859_4:
        return this.iso8859_4CodingSystem_;
      case CodingSystemId.iso8859_5:
        return this.iso8859_5CodingSystem_;
      case CodingSystemId.iso8859_6:
        return this.iso8859_6CodingSystem_;
      case CodingSystemId.iso8859_7:
        return this.iso8859_7CodingSystem_;
      case CodingSystemId.iso8859_8:
        return this.iso8859_8CodingSystem_;
      case CodingSystemId.iso8859_9:
        return this.iso8859_9CodingSystem_;
      case CodingSystemId.koi8_r:
        return this.koi8_rCodingSystem_;
      case CodingSystemId.xml:
        return this.xmlCodingSystem_;
      case CodingSystemId.ansi:
        return this.ansiCodingSystem_;
      case CodingSystemId.oem:
        return this.oemCodingSystem_;
      case CodingSystemId.maybeUnicode:
        return this.maybeUnicodeCodingSystem_;
      default:
        return null;
    }
  }

  static match(s: StringC, charset: CharsetInfo, key: string): boolean {
    for (let i = 0; i < s.size(); i++) {
      if (i >= key.length) {
        return false;
      }
      const upper = charset.execToDesc(key[i].toUpperCase());
      const lower = charset.execToDesc(key[i].toLowerCase());
      if (s.get(i) !== upper && s.get(i) !== lower) {
        return false;
      }
    }
    return s.size() === key.length;
  }

  static matchStatic(s: string, key: string): boolean {
    if (s.length !== key.length) {
      return false;
    }
    for (let i = 0; i < s.length; i++) {
      if (s[i].toUpperCase() !== key[i].toUpperCase()) {
        return false;
      }
    }
    return true;
  }
}
