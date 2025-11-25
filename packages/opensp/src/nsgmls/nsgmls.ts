#!/usr/bin/env node
// Copyright (c) 1994, 1995 James Clark
// See the file COPYING for copying permission.

// onsgmls - SGML parser producing ESIS output
// Port of nsgmls from OpenSP

import * as fs from 'fs';
import { Char } from '../types';
import { StringC } from '../StringC';
import { String as StringOf } from '../StringOf';
import { SgmlParser } from '../SgmlParser';
import { ParserOptions } from '../ParserOptions';
import { SgmlsEventHandler } from './SgmlsEventHandler';
import { MessageEventHandler } from '../MessageEventHandler';
import { ErrorCountEventHandler } from '../ErrorCountEventHandler';
import { OutputCharStream } from '../OutputCharStream';
import { Message, Messenger, MessageFragment } from '../Message';
import { MessageBuilder, OtherMessageArg as OtherMessageArgBuilder } from '../MessageBuilder';
import { MessageArg, OtherMessageArg } from '../MessageArg';
import { EndPrologEvent } from '../Event';
import { Ptr } from '../Ptr';
import { createExtendEntityManager, ExtendEntityManager } from '../ExtendEntityManager';
import { CharsetInfo } from '../CharsetInfo';
import { UnivCharsetDesc } from '../UnivCharsetDesc';
import { SOCatalogManager } from '../SOEntityCatalog';
import { Vector } from '../Vector';

// Output option flags
interface OutputOption {
  name: string;
  flag: number;
}

const outputOptions: OutputOption[] = [
  { name: 'all', flag: SgmlsEventHandler.outputAll },
  { name: 'line', flag: SgmlsEventHandler.outputLine },
  { name: 'entity', flag: SgmlsEventHandler.outputEntity },
  { name: 'id', flag: SgmlsEventHandler.outputId },
  { name: 'included', flag: SgmlsEventHandler.outputIncluded },
  { name: 'notation-sysid', flag: SgmlsEventHandler.outputNotationSysid },
  { name: 'nonsgml', flag: SgmlsEventHandler.outputNonSgml },
  { name: 'empty', flag: SgmlsEventHandler.outputEmpty },
  { name: 'data-attribute', flag: SgmlsEventHandler.outputDataAtt },
  { name: 'comment', flag: SgmlsEventHandler.outputComment },
  { name: 'omitted', flag: SgmlsEventHandler.outputTagOmission | SgmlsEventHandler.outputAttributeOmission },
  { name: 'tagomit', flag: SgmlsEventHandler.outputTagOmission },
  { name: 'attromit', flag: SgmlsEventHandler.outputAttributeOmission },
  { name: 'version', flag: SgmlsEventHandler.outputParserInformation },
];

// Simple string message builder for formatting messages
class StringMessageBuilder extends MessageBuilder {
  private result_: string = '';

  appendNumber(n: number): void {
    this.result_ += n.toString();
  }

  appendOrdinal(n: number): void {
    // Simple ordinal formatting
    const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    this.result_ += n.toString() + suffix;
  }

  appendChars(chars: Char[] | null, size: number): void {
    if (chars) {
      for (let i = 0; i < size; i++) {
        this.result_ += String.fromCodePoint(chars[i]);
      }
    }
  }

  appendOther(arg: OtherMessageArgBuilder | null): void {
    if (arg) {
      this.result_ += '[other]';
    }
  }

  appendFragment(fragment: MessageFragment): void {
    if (fragment && (fragment as any).text) {
      this.result_ += (fragment as any).text();
    }
  }

  appendString(s: string): void {
    this.result_ += s;
  }

  getString(): string {
    return this.result_;
  }
}

// Format a message by substituting %1, %2, etc. with arguments
function formatMessage(msg: Message): string {
  const type = msg.type;
  if (!type) return '(no message type)';

  const template = type.text();
  if (!template) return `message:${type.number()}`;

  // Parse template and substitute %N with arguments
  let result = '';
  let i = 0;
  while (i < template.length) {
    if (template[i] === '%' && i + 1 < template.length) {
      const nextChar = template[i + 1];
      if (nextChar >= '1' && nextChar <= '9') {
        const argIndex = parseInt(nextChar) - 1;
        if (argIndex < msg.args.size()) {
          const arg = msg.args.get(argIndex);
          if (arg && arg.pointer()) {
            const builder = new StringMessageBuilder();
            arg.pointer().append(builder);
            result += builder.getString();
          }
        }
        i += 2;
        continue;
      }
    }
    result += template[i];
    i++;
  }
  return result;
}

// Simple console messenger
class ConsoleMessenger extends Messenger {
  private errorCount_: number = 0;

  constructor() {
    super();
  }

  dispatchMessage(msg: Message): void {
    if (msg.isError()) {
      this.errorCount_++;
    }
    // Format and output the message
    const formatted = formatMessage(msg);
    console.error(formatted);
  }

  errorCount(): number {
    return this.errorCount_;
  }
}

// Console output stream
class ConsoleOutputCharStream extends OutputCharStream {
  private buffer_: string = '';

  constructor() {
    super();
  }

  flush(): void {
    if (this.buffer_.length > 0) {
      process.stdout.write(this.buffer_);
      this.buffer_ = '';
    }
  }

  protected flushBuf(c: Char): void {
    this.buffer_ += String.fromCharCode(c);
    if (c === '\n'.charCodeAt(0)) {
      process.stdout.write(this.buffer_);
      this.buffer_ = '';
    }
  }
}

// Parse command line and run
function main(): number {
  const args = process.argv.slice(2);

  let suppressOutput = false;
  let prologOnly = false;
  let outputFlags = 0;
  const catalogs: string[] = [];
  const files: string[] = [];

  const options = new ParserOptions();

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('-')) {
      const opt = arg.substring(1);

      switch (opt) {
        case 's':
          suppressOutput = true;
          break;
        case 'p':
          prologOnly = true;
          break;
        case 'd':
          options.warnDuplicateEntity = true;
          break;
        case 'l':
          outputFlags |= SgmlsEventHandler.outputLine;
          break;
        case 'r':
          options.warnDefaultEntityReference = true;
          break;
        case 'u':
          options.warnUndefinedElement = true;
          break;
        case 'o':
          if (i + 1 < args.length) {
            const optName = args[++i];
            const found = outputOptions.find(o => o.name === optName);
            if (found) {
              outputFlags |= found.flag;
            } else {
              console.error(`Unknown output option: ${optName}`);
            }
          }
          break;
        case 'c':
        case 'm':
          if (i + 1 < args.length) {
            catalogs.push(args[++i]);
          }
          break;
        case 'h':
        case '-help':
          printUsage();
          return 0;
        case 'v':
        case '-version':
          console.log('onsgmls (OpenSP-JS) 1.0.0');
          return 0;
        default:
          if (opt.startsWith('-')) {
            // Long option
            const longOpt = opt.substring(1);
            if (longOpt === 'help') {
              printUsage();
              return 0;
            } else if (longOpt === 'version') {
              console.log('onsgmls (OpenSP-JS) 1.0.0');
              return 0;
            }
          }
          console.error(`Unknown option: ${arg}`);
          break;
      }
    } else {
      files.push(arg);
    }
  }

  // Set up events wanted based on output flags
  if (outputFlags & SgmlsEventHandler.outputComment) {
    options.eventsWanted.addCommentDecls();
    options.eventsWanted.addPrologMarkup();
  }
  if (outputFlags & SgmlsEventHandler.outputTagOmission) {
    options.eventsWanted.addInstanceMarkup();
  }

  if (files.length === 0) {
    console.error('No input files specified');
    printUsage();
    return 1;
  }

  const messenger = new ConsoleMessenger();
  let totalErrors = 0;

  // Create entity manager with Unicode charset
  // Create a Unicode charset descriptor for ISO 10646 (all codepoints 0-0x10FFFF)
  const range = { descMin: 0, count: 0x110000, univMin: 0 };
  const desc = new UnivCharsetDesc([range], 1);
  const charset = new CharsetInfo(desc);

  // Create file reader function
  const fileReader = (path: string): Uint8Array | null => {
    try {
      return fs.readFileSync(path);
    } catch {
      return null;
    }
  };

  const entityManager = createExtendEntityManager(charset, fileReader);

  // Set up catalog manager to read catalog files
  // Port of nsgmls catalog setup from nsgmls/nsgmlsMain.cxx
  const catalogSysids = new Vector<StringC>();

  // Add any catalogs specified via -c/-m options
  for (const cat of catalogs) {
    catalogSysids.push_back(stringToStringC(cat));
  }

  // Look for default catalog file in current directory (like upstream nsgmls)
  // The catalog file is expected to contain SGMLDECL directive pointing to xml.dcl
  if (fs.existsSync('catalog')) {
    catalogSysids.push_back(stringToStringC('catalog'));
  }

  // Create catalog manager if we have any catalogs
  if (catalogSysids.size() > 0) {
    const catalogManager = SOCatalogManager.make(
      catalogSysids,
      catalogs.length,  // Number of explicitly specified catalogs that must exist
      charset,          // sysidCharset
      charset,          // catalogCharset
      true              // useDocCatalog
    );
    (entityManager as ExtendEntityManager).setCatalogManager(catalogManager);
  }

  // Process each file
  for (const file of files) {
    const params = new SgmlParser.Params();
    params.sysid = stringToStringC(file);
    params.options = options;
    params.entityManager = new Ptr(entityManager);

    const parser = new SgmlParser(params);

    let handler: ErrorCountEventHandler;

    if (prologOnly) {
      handler = new PrologOnlyEventHandler(messenger);
    } else if (suppressOutput) {
      handler = new MessageEventHandler(messenger, parser);
    } else {
      const os = new ConsoleOutputCharStream();
      handler = new SgmlsEventHandler(parser, os, messenger, outputFlags);
    }

    try {
      parser.parseAll(handler);
    } catch (e: any) {
      console.error(`Error parsing ${file}: ${e}`);
      if (e.stack) console.error(e.stack);
    }

    // End output if SgmlsEventHandler
    if (handler instanceof SgmlsEventHandler) {
      handler.end();
    }

    totalErrors += handler.errorCount();
  }

  return totalErrors > 0 ? 1 : 0;
}

// Prolog-only event handler
class PrologOnlyEventHandler extends MessageEventHandler {
  endProlog(_event: EndPrologEvent): void {
    this.cancel();
  }
}

function stringToStringC(s: string): StringC {
  const result = new StringOf<Char>();
  for (let i = 0; i < s.length; i++) {
    result.append([s.charCodeAt(i)], 1);
  }
  return result;
}

function printUsage(): void {
  console.log(`Usage: onsgmls [OPTIONS] FILE...

SGML parser producing ESIS output.

Options:
  -s              Suppress output, just validate
  -p              Parse prolog only
  -d              Warn about duplicate entity declarations
  -l              Output line numbers (L command)
  -r              Warn about defaulted entity references
  -u              Warn about undefined elements
  -o OPTION       Enable output option:
                    all, line, entity, id, included, notation-sysid,
                    nonsgml, empty, data-attribute, comment, omitted,
                    tagomit, attromit, version
  -c FILE         Use catalog file
  -m FILE         Same as -c
  -h, --help      Show this help
  -v, --version   Show version

Output:
  ESIS (Element Structure Information Set) format to stdout
  Error messages to stderr
`);
}

// Run main
const exitCode = main();
process.exit(exitCode);
