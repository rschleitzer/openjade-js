// Copyright (c) 1996 James Clark, 1999 Matthias Clasen
// See the file COPYING for copying permission.
// Derived from comp.sources.unix/volume3/att_getopt.

import { Vector } from './Vector';

// This is a mildly C++ified version of getopt().
// (extended to include getopt_long() functionality.)
// It never prints any message.

const OPTION_CHAR = '-'.charCodeAt(0);

export class LongOption<T> {
  name: string | null;
  key: T;
  value: T;
  hasArgument: boolean;

  constructor(name: string | null, key: T, value: T, hasArgument: boolean) {
    this.name = name;
    this.key = key;
    this.value = value;
    this.hasArgument = hasArgument;
  }
}

export class Options<T extends number> {
  private argv_: string[];
  private argc_: number;
  private ind_: number;
  private opt_: T;
  private arg_: string | null;
  private sp_: number;
  private opts_: Vector<LongOption<T>>;
  private optInd_: number;

  constructor(argc: number, argv: string[], opts: Vector<LongOption<T>>) {
    this.argc_ = argc;
    this.argv_ = argv;
    this.ind_ = 1;
    this.sp_ = 1;
    this.opts_ = opts;
    this.optInd_ = -1;
    this.opt_ = 0 as T;
    this.arg_ = null;
  }

  arg(): string | null {
    return this.arg_;
  }

  opt(): T {
    return this.opt_;
  }

  ind(): number {
    return this.ind_;
  }

  longIndex(): number {
    return this.optInd_;
  }

  private search(c: T): boolean {
    for (this.optInd_ = 0; this.optInd_ < this.opts_.size(); this.optInd_++) {
      if (this.opts_.get(this.optInd_).key === c) {
        return true;
      }
    }
    this.optInd_ = -1;
    return false;
  }

  private searchLong(arg: string): boolean {
    // return true if a unique match is found
    // set sp_ to the char ending the option name ('\0' or '=')
    // set optInd_ to the index of the first match
    this.optInd_ = -1;
    for (let i = 0; i < this.opts_.size(); i++) {
      const opt = this.opts_.get(i);
      if (opt.name) {
        let t = 0;
        for (this.sp_ = 2; ; this.sp_++, t++) {
          if (this.sp_ >= arg.length || arg[this.sp_] === '=') {
            if (this.optInd_ >= 0) {
              return false; // ambiguous
            } else {
              this.optInd_ = i;
              if (t >= opt.name.length) {
                return true; // exact match
              } else {
                break; // match, continue with next option
              }
            }
          } else if (t >= opt.name.length || arg[this.sp_] !== opt.name[t]) {
            break; // no match, continue with next option
          }
        }
      }
    }
    return this.optInd_ >= 0;
  }

  get(c: { value: T }): boolean {
    if (this.sp_ === 1) {
      if (this.ind_ >= this.argc_) {
        return false;
      }
      if (this.argv_[this.ind_][0] !== String.fromCharCode(OPTION_CHAR) || this.argv_[this.ind_].length === 1) {
        return false;
      }
      if (this.argv_[this.ind_][0] === String.fromCharCode(OPTION_CHAR) &&
          this.argv_[this.ind_][1] === String.fromCharCode(OPTION_CHAR)) {
        if (this.argv_[this.ind_].length === 2) {
          this.ind_++;
          return false;
        } else {
          this.opt_ = 0 as T; // this marks a long option
          if (this.searchLong(this.argv_[this.ind_])) {
            c.value = this.opts_.get(this.optInd_).value;
            if (this.opts_.get(this.optInd_).hasArgument) {
              if (this.sp_ < this.argv_[this.ind_].length && this.argv_[this.ind_][this.sp_] === '=') {
                this.arg_ = this.argv_[this.ind_].substring(this.sp_ + 1);
              } else if (this.ind_ + 1 < this.argc_) {
                this.arg_ = this.argv_[++this.ind_];
              } else {
                c.value = '?'.charCodeAt(0) as T; // missing argument
              }
            } else if (this.sp_ < this.argv_[this.ind_].length && this.argv_[this.ind_][this.sp_] === '=') {
              c.value = '='.charCodeAt(0) as T; // erroneous argument
            }
          } else if (this.optInd_ >= 0) {
            c.value = '-'.charCodeAt(0) as T; // ambiguous option
          } else {
            c.value = '?'.charCodeAt(0) as T; // unknown option
          }
          this.ind_++;
          this.sp_ = 1;
          return true;
        }
      }
    }
    this.opt_ = c.value = this.argv_[this.ind_].charCodeAt(this.sp_) as T;
    if (!this.search(c.value)) {
      if (++this.sp_ >= this.argv_[this.ind_].length) {
        this.ind_++;
        this.sp_ = 1;
      }
      c.value = '?'.charCodeAt(0) as T;
      return true;
    }
    if (this.optInd_ >= 0 && this.opts_.get(this.optInd_).hasArgument) {
      if (this.sp_ + 1 < this.argv_[this.ind_].length) {
        this.arg_ = this.argv_[this.ind_++].substring(this.sp_ + 1);
      } else if (++this.ind_ >= this.argc_) {
        this.sp_ = 1;
        c.value = '?'.charCodeAt(0) as T;
        return true;
      } else {
        this.arg_ = this.argv_[this.ind_++];
      }
      this.sp_ = 1;
    } else {
      if (++this.sp_ >= this.argv_[this.ind_].length) {
        this.sp_ = 1;
        this.ind_++;
      }
      this.arg_ = null;
    }
    return true;
  }
}
