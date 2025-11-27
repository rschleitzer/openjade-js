// Copyright (c) 1996 James Clark
// See the file copying.txt for copying permission.

import { Location, StringC } from '@openjade-js/opensp';
import { NodePtr, GroveString, SdataMapper } from '../grove/Node';
import { ELObj, SymbolObj, PairObj, ELObjDynamicRoot, NodeListObj } from './ELObj';
import { Collector } from './Collector';
import { VM, InsnPtr } from './Insn';
import { StyleObj, StyleStack, VarStyleObj } from './Style';
import { FOTBuilder, SaveFOTBuilder, ConcreteSaveFOTBuilder, CharacterNIC } from './FOTBuilder';
import { SosofoObj, FlowObj } from './SosofoObj';
import { Interpreter, ProcessingMode, ProcessingModeRule, ProcessingModeSpecificity as PMSpecificity } from './Interpreter';

// Re-import ProcessingMode from Insn to use as compatible type
import { ProcessingMode as InsnProcessingMode } from './Insn';

// ProcessContext manages the evaluation context for DSSSL processing
export class ProcessContext {
  private vm_: VM;
  private ignoreFotb_: IgnoreFOTBuilder;
  private sdataMapper_: SdataMapper;
  private connectionStack_: Connection[] = [];
  private connectableStack_: Connectable[] = [];
  private connectableStackLevel_: number = 0;
  private tableStack_: Table[] = [];
  private principalPortSaveQueues_: SaveFOTBuilder[][] = [];
  private matchSpecificity_: ProcessingModeSpecificity;
  private flowObjLevel_: number = 0;
  private havePageType_: boolean = false;
  private pageType_: number = 0;
  private nodeStack_: NodeStackEntry[] = [];

  constructor(interp: Interpreter, fotb: FOTBuilder) {
    this.vm_ = new VM(interp);
    this.ignoreFotb_ = new IgnoreFOTBuilder();
    this.sdataMapper_ = new SdataMapper();
    this.matchSpecificity_ = new ProcessingModeSpecificity();
    // Initialize connection stack with root connection
    this.connectionStack_.push(new Connection(fotb));
  }

  // Get current FOTBuilder
  currentFOTBuilder(): FOTBuilder {
    const conn = this.connectionStack_[this.connectionStack_.length - 1];
    return conn.fotb;
  }

  // Alias for interface compatibility
  fotBuilder(): FOTBuilder {
    return this.currentFOTBuilder();
  }

  // Get current style stack
  currentStyleStack(): StyleStack {
    const conn = this.connectionStack_[this.connectionStack_.length - 1];
    return conn.styleStack;
  }

  // Get VM instance
  vm(): VM {
    return this.vm_;
  }

  // Get current node from VM
  currentNode(): NodePtr | null {
    return this.vm_.currentNode as NodePtr | null;
  }

  // Process all nodes in a node list
  processNodeList(nodeList: NodeListObj, mode: ProcessingMode | null): void {
    // Iterate through node list and process each node
    let currentList: NodeListObj | null = nodeList;
    while (currentList) {
      const node = currentList.nodeListFirst(this.vm_, this.interpreter());
      if (!node || !node.toBoolean()) break;
      this.processNode(node, mode);
      currentList = currentList.nodeListRest(this.vm_, this.interpreter());
    }
  }

  // Get the interpreter as the full Interpreter type
  private interpreter(): Interpreter {
    return this.vm_.interp as unknown as Interpreter;
  }

  // Process a node tree
  process(node: NodePtr): void {
    const interp = this.interpreter();
    const style = interp.initialStyle();
    if (style) {
      this.currentStyleStack().push(style as StyleObj, this.vm_, this.currentFOTBuilder());
      this.currentFOTBuilder().startSequence();
    }
    this.processNode(node, interp.initialProcessingMode() as ProcessingMode);
    if (style) {
      this.currentFOTBuilder().endSequence();
      this.currentStyleStack().pop();
    }
  }

  // Process a single node with loop detection
  processNodeSafe(nodePtr: NodePtr, processingMode: ProcessingMode | null, chunk: boolean = true): void {
    const elementIndex = nodePtr.elementIndex();
    if (elementIndex !== null) {
      const groveIndex = nodePtr.groveIndex();
      // Check for processing loop
      for (const nse of this.nodeStack_) {
        if (nse.elementIndex === elementIndex &&
            nse.groveIndex === groveIndex &&
            nse.processingMode === processingMode) {
          this.interpreter().setNodeLocation(nodePtr);
          this.interpreter().message('processNodeLoop');
          return;
        }
      }
      this.nodeStack_.push({
        elementIndex,
        groveIndex,
        processingMode
      });
      this.processNode(nodePtr, processingMode, chunk);
      this.nodeStack_.pop();
    } else {
      this.processNode(nodePtr, processingMode, chunk);
    }
  }

  // Process a single node
  processNode(nodePtr: NodePtr, processingMode: ProcessingMode | null, chunk: boolean = true): void {
    if (!processingMode) return;

    // Check if node is a character chunk
    const charChunk = nodePtr.charChunk(this.sdataMapper_);
    if (charChunk) {
      this.currentFOTBuilder().charactersFromNode(
        nodePtr,
        charChunk.data,
        chunk ? charChunk.size : 1
      );
      return;
    }

    // Non-character node - apply processing rules
    const saveNode = this.vm_.currentNode;
    const saveMode = this.vm_.processingMode;
    this.vm_.currentNode = nodePtr;
    this.vm_.processingMode = processingMode;

    const saveSpecificity = this.matchSpecificity_.clone();
    this.matchSpecificity_ = new ProcessingModeSpecificity();
    let hadStyle = false;

    this.currentFOTBuilder().startNode(nodePtr, processingMode.name());

    // Find matching rules
    for (;;) {
      const rule = processingMode.findMatch(
        nodePtr,
        this.interpreter(),
        this.matchSpecificity_
      );

      if (!rule) {
        if (hadStyle) {
          this.currentStyleStack().pushEnd(this.vm_, this.currentFOTBuilder());
          this.currentFOTBuilder().startSequence();
        }
        this.processChildren(processingMode);
        break;
      }

      if (!this.matchSpecificity_.isStyle()) {
        // Action rule
        const action = rule.action();
        if (hadStyle) {
          this.currentStyleStack().pushEnd(this.vm_, this.currentFOTBuilder());
          this.currentFOTBuilder().startSequence();
        }

        if (action.sosofo) {
          action.sosofo.process(this);
        } else if (action.insn) {
          const obj = this.vm_.eval(action.insn);
          if (this.interpreter().isError(obj)) {
            if (processingMode.name().length_ === 0) {
              this.processChildren(processingMode);
            }
          } else {
            const protect = new ELObjDynamicRoot(this.interpreter(), obj);
            (obj as SosofoObj).process(this);
          }
        }
        break;
      }

      // Style rule
      const action = rule.action();
      if (action.insn) {
        const obj = this.vm_.eval(action.insn);
        if (!this.interpreter().isError(obj)) {
          if (!hadStyle) {
            this.currentStyleStack().pushStart();
            hadStyle = true;
          }
          this.currentStyleStack().pushContinue(
            obj as StyleObj,
            rule as any,  // ProcessingModeRule compatible with ProcessingModeRule interface
            nodePtr,
            null  // No messenger for style rules
          );
        }
      }
    }

    if (hadStyle) {
      this.currentFOTBuilder().endSequence();
      this.currentStyleStack().pop();
    }
    this.currentFOTBuilder().endNode();

    this.matchSpecificity_ = saveSpecificity;
    this.vm_.currentNode = saveNode;
    this.vm_.processingMode = saveMode;
  }

  // Process next matching rule
  nextMatch(overridingStyle: StyleObj | null): void {
    const saveSpecificity = this.matchSpecificity_.clone();
    const saveOverridingStyle = this.vm_.overridingStyle;

    if (overridingStyle) {
      this.vm_.overridingStyle = overridingStyle;
    }

    const rule = this.vm_.processingMode?.findMatch(
      this.vm_.currentNode,
      this.interpreter(),
      this.matchSpecificity_
    );

    if (rule) {
      const action = rule.action();
      if (action.sosofo) {
        action.sosofo.process(this);
      } else if (action.insn) {
        const obj = this.vm_.eval(action.insn);
        if (this.interpreter().isError(obj)) {
          this.processChildren(this.vm_.processingMode as ProcessingMode | null);
        } else {
          const protect = new ELObjDynamicRoot(this.interpreter(), obj);
          (obj as SosofoObj).process(this);
        }
      }
    } else {
      this.processChildren(this.vm_.processingMode as ProcessingMode | null);
    }

    this.vm_.overridingStyle = saveOverridingStyle;
    this.matchSpecificity_ = saveSpecificity;
  }

  // Process children of current node
  processChildren(processingMode: ProcessingMode | null): void {
    const node = this.vm_.currentNode as NodePtr;
    const firstChild = node.firstChild();
    if (firstChild) {
      let child: NodePtr | null = firstChild;
      while (child) {
        this.processNode(child, processingMode);
        child = child.nextChunkSibling();
      }
    } else {
      // Try document element
      const docElem = node.getDocumentElement();
      if (docElem) {
        this.processNode(docElem, processingMode);
      }
    }
  }

  // Process children with whitespace trimming
  processChildrenTrim(processingMode: ProcessingMode | null): void {
    const node = this.vm_.currentNode as NodePtr;
    const firstChild = node.firstChild();
    if (!firstChild) {
      const docElem = node.getDocumentElement();
      if (docElem) {
        this.processNode(docElem, processingMode);
      }
      return;
    }

    let child: NodePtr | null = firstChild;
    let atStart = true;

    while (child) {
      const charChunk = child.charChunk(this.sdataMapper_);
      if (charChunk) {
        let s = charChunk.data;
        let n = charChunk.size;
        let offset = 0;

        if (atStart) {
          // Skip leading whitespace
          while (n > 0 && this.isWhiteSpace(s[offset])) {
            offset++;
            n--;
          }
          if (n > 0) {
            atStart = false;
          }
        }

        if (n > 0) {
          // Check for trailing whitespace at end
          if (this.isWhiteSpace(s[offset + n - 1]) && this.onlyWhiteSpaceFollows(child)) {
            while (n > 0 && this.isWhiteSpace(s[offset + n - 1])) {
              n--;
            }
            if (n > 0) {
              this.currentFOTBuilder().charactersFromNode(child, s.slice(offset), n);
            }
            return;
          }
          this.currentFOTBuilder().charactersFromNode(child, s.slice(offset), n);
        }
      } else {
        const gi = child.getGi();
        if (atStart && gi) {
          atStart = false;
        }
        this.processNode(child, processingMode);
      }
      child = child.nextChunkSibling();
    }
  }

  private isWhiteSpace(c: number): boolean {
    return this.interpreter().charProperty(
      Interpreter.makeStringC('input-whitespace?'),
      c,
      new Location(),
      null
    )?.isTrue() ?? false;
  }

  private onlyWhiteSpaceFollows(node: NodePtr): boolean {
    let sibling = node.nextChunkSibling();
    while (sibling) {
      const charChunk = sibling.charChunk(this.sdataMapper_);
      if (charChunk) {
        for (let i = 0; i < charChunk.size; i++) {
          if (!this.isWhiteSpace(charChunk.data[i])) {
            return false;
          }
        }
      } else if (sibling.getGi()) {
        return false;
      }
      sibling = sibling.nextChunkSibling();
    }
    return true;
  }

  // Flow object level management
  startFlowObj(): void {
    this.flowObjLevel_++;
  }

  endFlowObj(): void {
    this.flowObjLevel_--;
    if (this.flowObjLevel_ < this.principalPortSaveQueues_.length) {
      const saveQueue = this.principalPortSaveQueues_[this.flowObjLevel_];
      while (saveQueue.length > 0) {
        const saved = saveQueue.shift()!;
        saved.emit(this.currentFOTBuilder());
      }
    }
  }

  // Connection management (for label:)
  startConnection(label: SymbolObj, loc: Location): void {
    let connLevel = this.connectableStackLevel_;
    for (let i = this.connectableStack_.length - 1; i >= 0; i--, connLevel--) {
      const conn = this.connectableStack_[i];
      for (let j = 0; j < conn.ports.length; j++) {
        const port = conn.ports[j];
        for (const portLabel of port.labels) {
          if (portLabel === label) {
            this.restoreConnection(connLevel, j);
            return;
          }
        }
      }
      for (const principalLabel of conn.principalPortLabels) {
        if (principalLabel === label) {
          this.restoreConnection(connLevel, -1);
          return;
        }
      }
    }
    this.interpreter().setNextLocation(loc);
    this.interpreter().message('badConnection', label.name());
    this.connectionStack_[this.connectionStack_.length - 1].nBadFollow++;
  }

  endConnection(): void {
    if (this.inTableRow() &&
        this.tableStack_[this.tableStack_.length - 1].rowConnectableLevel === this.connectableStackLevel_) {
      this.endTableRow();
    }
    const head = this.connectionStack_[this.connectionStack_.length - 1];
    if (head.nBadFollow > 0) {
      head.nBadFollow--;
    } else {
      this.currentFOTBuilder().endNode();
      const port = head.port;
      if (port && --port.connected === 0) {
        while (port.saveQueue.length > 0) {
          const saved = port.saveQueue.shift()!;
          saved.emit(port.fotb!);
        }
      }
      this.connectionStack_.pop();
    }
  }

  private restoreConnection(connectableLevel: number, portIndex: number): void {
    let connLevel = this.connectableStackLevel_;
    let connIdx = this.connectableStack_.length - 1;
    while (connLevel !== connectableLevel) {
      connIdx--;
      connLevel--;
    }
    const conn = this.connectableStack_[connIdx];

    if (portIndex !== -1) {
      const port = conn.ports[portIndex];
      const c = new Connection(null, conn.styleStack.clone(), port, connLevel);
      if (port.connected) {
        port.connected++;
        const save = new ConcreteSaveFOTBuilder();
        c.fotb = save;
        port.saveQueue.push(save);
      } else {
        c.fotb = port.fotb!;
        port.connected = 1;
      }
      this.connectionStack_.push(c);
      this.currentFOTBuilder().startNode(
        this.vm_.currentNode,
        this.vm_.processingMode?.name() ?? Interpreter.makeStringC('')
      );
    } else {
      const c = new Connection(null, conn.styleStack.clone(), null, connLevel);
      if (conn.flowObjLevel === this.flowObjLevel_) {
        c.fotb = this.currentFOTBuilder();
      } else {
        const save = new ConcreteSaveFOTBuilder();
        c.fotb = save;
        while (this.principalPortSaveQueues_.length <= conn.flowObjLevel) {
          this.principalPortSaveQueues_.push([]);
        }
        this.principalPortSaveQueues_[conn.flowObjLevel].push(save);
      }
      this.connectionStack_.push(c);
      this.currentFOTBuilder().startNode(
        this.vm_.currentNode,
        this.vm_.processingMode?.name() ?? Interpreter.makeStringC('')
      );
    }
  }

  // Port management
  pushPorts(hasPrincipalPort: boolean, labels: SymbolObj[], fotbs: FOTBuilder[]): void {
    const c = new Connectable(labels.length, this.currentStyleStack().clone(), this.flowObjLevel_);
    this.connectableStack_.push(c);
    for (let i = 0; i < labels.length; i++) {
      c.ports[i].labels.push(labels[i]);
      c.ports[i].fotb = fotbs[i];
    }
    this.connectableStackLevel_++;
  }

  popPorts(): void {
    this.connectableStackLevel_--;
    this.connectableStack_.pop();
  }

  pushPrincipalPort(principalPort: FOTBuilder): void {
    this.connectionStack_.push(new Connection(principalPort));
  }

  popPrincipalPort(): void {
    this.connectionStack_.pop();
  }

  // Discard labeled content
  startDiscardLabeled(label: SymbolObj): void {
    this.startFlowObj();
    const c = new Connectable(1, this.currentStyleStack().clone(), this.flowObjLevel_);
    this.connectableStack_.push(c);
    c.ports[0].labels.push(label);
    c.ports[0].fotb = this.ignoreFotb_;
  }

  endDiscardLabeled(): void {
    this.connectableStack_.pop();
    this.endFlowObj();
  }

  // Content map support
  startMapContent(contentMap: ELObj, loc: Location): void {
    let badFlag = false;
    const headIdx = this.connectableStack_.length - 1;
    if (headIdx < 0 || this.connectableStack_[headIdx].flowObjLevel !== this.flowObjLevel_) {
      this.connectableStack_.push(new Connectable(0, this.currentStyleStack().clone(), this.flowObjLevel_));
    }
    const conn = this.connectableStack_[this.connectableStack_.length - 1];

    const portNames: SymbolObj[] = [];
    for (const port of conn.ports) {
      portNames.push(port.labels[0]);
      port.labels = [];
    }

    let map: ELObj | null = contentMap;
    while (map && !map.isNil()) {
      const tem = map.asPair();
      if (!tem) {
        this.badContentMap(badFlag, loc);
        break;
      }
      const entry = tem.car();
      map = tem.cdr();

      const entryPair = entry?.asPair();
      if (entryPair) {
        const label = entryPair.car()?.asSymbol();
        if (label) {
          const rest = entryPair.cdr()?.asPair();
          if (rest) {
            const port = rest.car()?.asSymbol();
            if (port) {
              for (let i = 0; i < portNames.length; i++) {
                if (portNames[i] === port) {
                  conn.ports[i].labels.push(label);
                  break;
                }
              }
            } else if (rest.car() === this.interpreter().makeFalse()) {
              conn.principalPortLabels.push(label);
            } else {
              this.badContentMap(badFlag, loc);
            }
            if (!rest.cdr()?.isNil()) {
              this.badContentMap(badFlag, loc);
            }
          } else {
            this.badContentMap(badFlag, loc);
          }
        } else {
          this.badContentMap(badFlag, loc);
        }
      } else {
        this.badContentMap(badFlag, loc);
      }
    }
  }

  endMapContent(): void {
    const head = this.connectableStack_[this.connectableStack_.length - 1];
    if (head.ports.length === 0) {
      this.connectableStack_.pop();
    }
  }

  private badContentMap(badFlag: boolean, loc: Location): void {
    if (badFlag) return;
    this.interpreter().setNextLocation(loc);
    this.interpreter().message('badContentMap');
  }

  // Table support
  startTable(): void {
    this.tableStack_.push(new Table());
  }

  endTable(): void {
    this.tableStack_.pop();
  }

  startTablePart(): void {
    const table = this.tableStack_[this.tableStack_.length - 1];
    table.currentColumn = 0;
    table.covered = [];
  }

  endTablePart(): void {
    // Nothing special needed
  }

  addTableColumn(columnIndex: number, span: number, style: StyleObj | null): void {
    const table = this.tableStack_[this.tableStack_.length - 1];
    while (table.columnStyles.length <= columnIndex) {
      table.columnStyles.push([]);
    }
    while (table.columnStyles[columnIndex].length < span) {
      table.columnStyles[columnIndex].push(null!);
    }
    table.columnStyles[columnIndex][span - 1] = style;
    if (columnIndex + span > table.nColumns) {
      table.nColumns = columnIndex + span;
    }
  }

  currentTableColumn(): number {
    return this.tableStack_[this.tableStack_.length - 1].currentColumn;
  }

  noteTableCell(colIndex: number, colSpan: number, rowSpan: number): void {
    const table = this.tableStack_[this.tableStack_.length - 1];
    table.currentColumn = colIndex + colSpan;
    if (rowSpan > 1) {
      while (table.covered.length <= colIndex + colSpan - 1) {
        table.covered.push(0);
      }
      for (let i = colIndex; i < colIndex + colSpan; i++) {
        table.covered[i] = rowSpan - 1;
      }
    }
  }

  tableColumnStyle(columnIndex: number, span: number): StyleObj | null {
    const table = this.tableStack_[this.tableStack_.length - 1];
    if (columnIndex >= table.columnStyles.length) {
      return null;
    }
    const styles = table.columnStyles[columnIndex];
    if (span - 1 >= styles.length) {
      return null;
    }
    return styles[span - 1];
  }

  tableRowStyle(): StyleObj | null {
    return this.tableStack_[this.tableStack_.length - 1].rowStyle;
  }

  startTableRow(style: StyleObj | null): void {
    const table = this.tableStack_[this.tableStack_.length - 1];
    table.rowStyle = style;
    table.inTableRow = true;
    table.rowConnectableLevel = this.connectableStackLevel_;
    table.currentColumn = 0;
    this.coverSpannedRows();
  }

  inTable(): boolean {
    return this.tableStack_.length > 0;
  }

  inTableRow(): boolean {
    return this.tableStack_.length > 0 &&
           this.tableStack_[this.tableStack_.length - 1].inTableRow;
  }

  endTableRow(): void {
    const table = this.tableStack_[this.tableStack_.length - 1];
    table.inTableRow = false;
    table.rowStyle = null;
  }

  private coverSpannedRows(): void {
    const table = this.tableStack_[this.tableStack_.length - 1];
    while (table.currentColumn < table.covered.length &&
           table.covered[table.currentColumn] > 0) {
      table.covered[table.currentColumn]--;
      table.currentColumn++;
    }
  }

  // Page type support
  clearPageType(): void {
    this.havePageType_ = false;
  }

  setPageType(n: number): void {
    this.havePageType_ = true;
    this.pageType_ = n;
  }

  getPageType(): { has: boolean; value: number } {
    return {
      has: this.havePageType_,
      value: this.pageType_
    };
  }

  // Garbage collection support
  trace(collector: Collector): void {
    for (const conn of this.connectionStack_) {
      conn.styleStack.trace(collector);
    }
    for (const connectable of this.connectableStack_) {
      connectable.styleStack.trace(collector);
    }
    for (const table of this.tableStack_) {
      if (table.rowStyle) {
        collector.trace(table.rowStyle);
      }
      for (const styles of table.columnStyles) {
        for (const style of styles) {
          if (style) {
            collector.trace(style);
          }
        }
      }
    }
  }
}

// Processing mode specificity for rule matching
class ProcessingModeSpecificity {
  private priority_: number = 0;
  private isStyle_: boolean = false;

  isStyle(): boolean {
    return this.isStyle_;
  }

  clone(): ProcessingModeSpecificity {
    const s = new ProcessingModeSpecificity();
    s.priority_ = this.priority_;
    s.isStyle_ = this.isStyle_;
    return s;
  }
}

// Node stack entry for loop detection
interface NodeStackEntry {
  elementIndex: number;
  groveIndex: number;
  processingMode: ProcessingMode | null;
}

// Port for flow object connections
class Port {
  fotb: FOTBuilder | null = null;
  saveQueue: SaveFOTBuilder[] = [];
  labels: SymbolObj[] = [];
  connected: number = 0;
}

// Connectable flow object
class Connectable {
  ports: Port[];
  styleStack: StyleStack;
  flowObjLevel: number;
  principalPortLabels: SymbolObj[] = [];

  constructor(nPorts: number, styleStack: StyleStack, flowObjLevel: number) {
    this.ports = [];
    for (let i = 0; i < nPorts; i++) {
      this.ports.push(new Port());
    }
    this.styleStack = styleStack;
    this.flowObjLevel = flowObjLevel;
  }
}

// Connection between flow object and flow parent
class Connection {
  fotb: FOTBuilder;
  styleStack: StyleStack;
  port: Port | null;
  connectableLevel: number;
  nBadFollow: number = 0;

  constructor(fotb: FOTBuilder | null, styleStack?: StyleStack, port?: Port | null, connectableLevel?: number) {
    this.fotb = fotb!;
    this.styleStack = styleStack ?? new StyleStack();
    this.port = port ?? null;
    this.connectableLevel = connectableLevel ?? 0;
  }
}

// Table state
class Table {
  currentColumn: number = 0;
  columnStyles: (StyleObj | null)[][] = [];
  covered: number[] = [];
  nColumns: number = 0;
  rowStyle: StyleObj | null = null;
  inTableRow: boolean = false;
  rowConnectableLevel: number = 0;
}

// FOTBuilder that ignores all output (for discard-labeled)
class IgnoreFOTBuilder extends FOTBuilder {
  // All methods do nothing - inherited defaults are fine
}
