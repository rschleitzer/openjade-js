// Copyright (c) 1997 James Clark, 2000 Matthias Clasen
// See the file COPYING for copying permission.

import { Char } from './types';
import { Resource } from './Resource';

// 4-level hierarchical sparse array for efficient Unicode character mapping
// Ported from OpenSP's CharMap.h/cxx

// Bit layout for 21-bit Unicode codepoints:
// level0 (plane):  5 bits = 32 planes
// level1 (page):   8 bits = 256 pages per plane
// level2 (column): 4 bits = 16 columns per page
// level3 (cell):   4 bits = 16 cells per column

const level0 = 5;
const level1 = 8;
const level2 = 4;
const level3 = 4;

const planes = 1 << level0;              // 32
const pagesPerPlane = 1 << level1;       // 256
const columnsPerPage = 1 << level2;      // 16
const cellsPerColumn = 1 << level3;      // 16

const planeSize = 1 << (level1 + level2 + level3);   // 65536
const pageSize = 1 << (level2 + level3);             // 256
const columnSize = 1 << level3;                       // 16

function planeIndex(c: number): number {
  return c >>> (level1 + level2 + level3);
}

function pageIndex(c: number): number {
  return (c >>> (level2 + level3)) & (pagesPerPlane - 1);
}

function columnIndex(c: number): number {
  return (c >>> level3) & (columnsPerPage - 1);
}

function cellIndex(c: number): number {
  return c & (cellsPerColumn - 1);
}

function maxInPlane(c: number): number {
  return c | (planeSize - 1);
}

function maxInPage(c: number): number {
  return c | (pageSize - 1);
}

function maxInColumn(c: number): number {
  return c | (columnSize - 1);
}

class CharMapColumn<T> {
  values: T[] | null = null;
  value!: T;

  copyFrom(col: CharMapColumn<T>): void {
    if (col.values) {
      this.values = col.values.slice();
    } else {
      this.values = null;
      this.value = col.value;
    }
  }

  swap(col: CharMapColumn<T>): void {
    const temValues = this.values;
    this.values = col.values;
    col.values = temValues;

    const temValue = this.value;
    this.value = col.value;
    col.value = temValue;
  }
}

class CharMapPage<T> {
  values: CharMapColumn<T>[] | null = null;
  value!: T;

  copyFrom(pg: CharMapPage<T>): void {
    if (pg.values) {
      this.values = new Array(columnsPerPage);
      for (let i = 0; i < columnsPerPage; i++) {
        this.values[i] = new CharMapColumn<T>();
        this.values[i].copyFrom(pg.values[i]);
      }
    } else {
      this.values = null;
      this.value = pg.value;
    }
  }

  swap(pg: CharMapPage<T>): void {
    const temValues = this.values;
    this.values = pg.values;
    pg.values = temValues;

    const temValue = this.value;
    this.value = pg.value;
    pg.value = temValue;
  }
}

class CharMapPlane<T> {
  values: CharMapPage<T>[] | null = null;
  value!: T;

  copyFrom(pl: CharMapPlane<T>): void {
    if (pl.values) {
      this.values = new Array(pagesPerPlane);
      for (let i = 0; i < pagesPerPlane; i++) {
        this.values[i] = new CharMapPage<T>();
        this.values[i].copyFrom(pl.values[i]);
      }
    } else {
      this.values = null;
      this.value = pl.value;
    }
  }

  swap(pl: CharMapPlane<T>): void {
    const temValues = this.values;
    this.values = pl.values;
    pl.values = temValues;

    const temValue = this.value;
    this.value = pl.value;
    pl.value = temValue;
  }
}

export class CharMap<T> {
  private lo_: T[];
  private values_: CharMapPlane<T>[];

  constructor();
  constructor(dflt: T);
  constructor(dflt?: T) {
    this.lo_ = new Array(256);
    this.values_ = new Array(planes);
    for (let i = 0; i < planes; i++) {
      this.values_[i] = new CharMapPlane<T>();
    }

    if (dflt !== undefined) {
      for (let i = 0; i < 256; i++) {
        this.lo_[i] = dflt;
      }
      for (let i = 0; i < planes; i++) {
        this.values_[i].value = dflt;
      }
    }
  }

  get(c: Char): T {
    if (c < 256) {
      return this.lo_[c];
    }
    const pl = this.values_[planeIndex(c)];
    if (pl.values) {
      const pg = pl.values[pageIndex(c)];
      if (pg.values) {
        const column = pg.values[columnIndex(c)];
        if (column.values) {
          return column.values[cellIndex(c)];
        } else {
          return column.value;
        }
      } else {
        return pg.value;
      }
    } else {
      return pl.value;
    }
  }

  getRange(c: Char, max: { value: Char }): T {
    if (c < 256) {
      max.value = c;
      return this.lo_[c];
    }
    const pl = this.values_[planeIndex(c)];
    if (pl.values) {
      const pg = pl.values[pageIndex(c)];
      if (pg.values) {
        const column = pg.values[columnIndex(c)];
        if (column.values) {
          max.value = c;
          return column.values[cellIndex(c)];
        } else {
          max.value = maxInColumn(c);
          return column.value;
        }
      } else {
        max.value = maxInPage(c);
        return pg.value;
      }
    } else {
      max.value = maxInPlane(c);
      return pl.value;
    }
  }

  swap(map: CharMap<T>): void {
    for (let i = 0; i < 256; i++) {
      const tem = this.lo_[i];
      this.lo_[i] = map.lo_[i];
      map.lo_[i] = tem;
    }
    for (let i = 0; i < planes; i++) {
      this.values_[i].swap(map.values_[i]);
    }
  }

  setChar(c: Char, val: T): void {
    if (c < 256) {
      this.lo_[c] = val;
      return;
    }
    const pl = this.values_[planeIndex(c)];
    if (pl.values) {
      const pg = pl.values[pageIndex(c)];
      if (pg.values) {
        const column = pg.values[columnIndex(c)];
        if (column.values) {
          column.values[cellIndex(c)] = val;
        } else if (val !== column.value) {
          column.values = new Array(cellsPerColumn);
          for (let i = 0; i < cellsPerColumn; i++) {
            column.values[i] = column.value;
          }
          column.values[cellIndex(c)] = val;
        }
      } else if (val !== pg.value) {
        pg.values = new Array(columnsPerPage);
        for (let i = 0; i < columnsPerPage; i++) {
          pg.values[i] = new CharMapColumn<T>();
          pg.values[i].value = pg.value;
        }
        const column = pg.values[columnIndex(c)];
        column.values = new Array(cellsPerColumn);
        for (let i = 0; i < cellsPerColumn; i++) {
          column.values[i] = column.value;
        }
        column.values[cellIndex(c)] = val;
      }
    } else if (val !== pl.value) {
      pl.values = new Array(pagesPerPlane);
      for (let i = 0; i < pagesPerPlane; i++) {
        pl.values[i] = new CharMapPage<T>();
        pl.values[i].value = pl.value;
      }
      const page = pl.values[pageIndex(c)];
      page.values = new Array(columnsPerPage);
      for (let i = 0; i < columnsPerPage; i++) {
        page.values[i] = new CharMapColumn<T>();
        page.values[i].value = page.value;
      }
      const column = page.values[columnIndex(c)];
      column.values = new Array(cellsPerColumn);
      for (let i = 0; i < cellsPerColumn; i++) {
        column.values[i] = column.value;
      }
      column.values[cellIndex(c)] = val;
    }
  }

  setRange(from: Char, to: Char, val: T): void {
    // Handle low range first
    while (from < 256) {
      this.lo_[from] = val;
      if (from === to) return;
      from++;
    }

    do {
      if ((from & (columnSize - 1)) === 0 && to - from >= columnSize - 1) {
        if ((from & (pageSize - 1)) === 0 && to - from >= pageSize - 1) {
          if ((from & (planeSize - 1)) === 0 && to - from >= planeSize - 1) {
            // Set a complete plane
            const pl = this.values_[planeIndex(from)];
            pl.value = val;
            pl.values = null;
            from += planeSize - 1;
          } else {
            // Set a complete page
            const pl = this.values_[planeIndex(from)];
            if (pl.values) {
              const pg = pl.values[pageIndex(from)];
              pg.value = val;
              pg.values = null;
            } else if (val !== pl.value) {
              // Split the plane
              pl.values = new Array(pagesPerPlane);
              for (let i = 0; i < pagesPerPlane; i++) {
                pl.values[i] = new CharMapPage<T>();
                pl.values[i].value = pl.value;
              }
              const page = pl.values[pageIndex(from)];
              page.value = val;
            }
            from += pageSize - 1;
          }
        } else {
          // Set a complete column
          const pl = this.values_[planeIndex(from)];
          if (pl.values) {
            const pg = pl.values[pageIndex(from)];
            if (pg.values) {
              const column = pg.values[columnIndex(from)];
              column.value = val;
              column.values = null;
            } else if (val !== pg.value) {
              // Split the page
              pg.values = new Array(columnsPerPage);
              for (let i = 0; i < columnsPerPage; i++) {
                pg.values[i] = new CharMapColumn<T>();
                pg.values[i].value = pg.value;
              }
              const column = pg.values[columnIndex(from)];
              column.value = val;
            }
          } else if (val !== pl.value) {
            // Split the plane
            pl.values = new Array(pagesPerPlane);
            for (let i = 0; i < pagesPerPlane; i++) {
              pl.values[i] = new CharMapPage<T>();
              pl.values[i].value = pl.value;
            }
            const pg = pl.values[pageIndex(from)];
            pg.value = val;
            // Split the page
            pg.values = new Array(columnsPerPage);
            for (let i = 0; i < columnsPerPage; i++) {
              pg.values[i] = new CharMapColumn<T>();
              pg.values[i].value = pg.value;
            }
            const column = pg.values[columnIndex(from)];
            column.value = val;
          }
          from += columnSize - 1;
        }
      } else {
        this.setChar(from, val);
      }
    } while (from++ !== to);
  }

  setAll(val: T): void {
    for (let i = 0; i < 256; i++) {
      this.lo_[i] = val;
    }
    for (let i = 0; i < planes; i++) {
      this.values_[i].value = val;
      this.values_[i].values = null;
    }
  }

  // Additional methods for TypeScript port

  getDefault(): T | undefined {
    // Return the value of plane 0 if it has no sub-values
    return this.values_[0].values === null ? this.values_[0].value : undefined;
  }

  *entriesNotDefault(): IterableIterator<[Char, T]> {
    // Get default value from plane 0
    const dflt = this.values_[0].values === null ? this.values_[0].value : undefined;

    for (let i = 0; i < 256; i++) {
      if (this.lo_[i] !== dflt) {
        yield [i, this.lo_[i]];
      }
    }

    // For high values, iterate through the hierarchy
    for (let pli = 0; pli < planes; pli++) {
      const pl = this.values_[pli];
      if (pl.values) {
        for (let pgi = 0; pgi < pagesPerPlane; pgi++) {
          const pg = pl.values[pgi];
          if (pg.values) {
            for (let coli = 0; coli < columnsPerPage; coli++) {
              const col = pg.values[coli];
              if (col.values) {
                for (let celli = 0; celli < cellsPerColumn; celli++) {
                  const c = (pli << (level1 + level2 + level3)) |
                            (pgi << (level2 + level3)) |
                            (coli << level3) |
                            celli;
                  if (c >= 256 && col.values[celli] !== dflt) {
                    yield [c, col.values[celli]];
                  }
                }
              } else if (col.value !== dflt) {
                const baseC = (pli << (level1 + level2 + level3)) |
                              (pgi << (level2 + level3)) |
                              (coli << level3);
                for (let celli = 0; celli < cellsPerColumn; celli++) {
                  const c = baseC | celli;
                  if (c >= 256) {
                    yield [c, col.value];
                  }
                }
              }
            }
          } else if (pg.value !== dflt) {
            const baseC = (pli << (level1 + level2 + level3)) |
                          (pgi << (level2 + level3));
            for (let i = 0; i < pageSize; i++) {
              const c = baseC | i;
              if (c >= 256) {
                yield [c, pg.value];
              }
            }
          }
        }
      }
      // If pl.values is null, the whole plane has pl.value which is dflt (or we'd emit all chars)
    }
  }

  copyFrom(other: CharMap<T>): void {
    for (let i = 0; i < 256; i++) {
      this.lo_[i] = other.lo_[i];
    }
    for (let i = 0; i < planes; i++) {
      this.values_[i].copyFrom(other.values_[i]);
    }
  }
}

export class CharMapResource<T> extends Resource {
  private charMap_: CharMap<T>;

  constructor();
  constructor(defaultValue: T);
  constructor(defaultValue?: T) {
    super();
    if (defaultValue === undefined) {
      this.charMap_ = new CharMap<T>();
    } else {
      this.charMap_ = new CharMap<T>(defaultValue);
    }
  }

  // Delegate to CharMap
  get(c: Char): T {
    return this.charMap_.get(c);
  }

  getRange(from: Char, to: { value: Char }): T {
    return this.charMap_.getRange(from, to);
  }

  swap(map: CharMapResource<T>): void {
    this.charMap_.swap(map.charMap_);
  }

  setChar(c: Char, val: T): void {
    this.charMap_.setChar(c, val);
  }

  setRange(from: Char, to: Char, val: T): void {
    this.charMap_.setRange(from, to, val);
  }

  setAll(val: T): void {
    this.charMap_.setAll(val);
  }
}
