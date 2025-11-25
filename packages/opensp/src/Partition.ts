// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

import { Char, EquivCode } from './types';
import { SubstTable } from './SubstTable';
import { String } from './StringOf';
import { ISet, ISetIter } from './ISet';
import { XcharMap } from './XcharMap';
import { Vector } from './Vector';
import { Link } from './Link';
import { IList, IListIter } from './IList';
import { Owner } from './Owner';
import { Boolean } from './Boolean';
import { charMax } from './constant';
import { EquivClass } from './EquivClass';
import { ASSERT } from './macros';

enum RefineResult {
  allIn = 0,
  allOut = 1,
  someInSomeOut = 2,
}

function refineByChar(classes: IList<EquivClass>, c: Char): void {
  // Avoid modifying *classes, while there's an active iter on it.
  let found: EquivClass | null = null;
  {
    for (
      let iter = new IListIter<EquivClass>(classes);
      !iter.done();
      iter.next()
    ) {
      if (iter.cur()!.set.contains(c)) {
        found = iter.cur();
        break;
      }
    }
  }
  if (found && !found.set.isSingleton()) {
    found.set.remove(c);
    classes.insert(new EquivClass(found.inSets));
    classes.head()!.set.add(c);
  }
}

function addUpTo(to: ISet<Char>, limit: Char, from: ISet<Char>): void {
  const iter = new ISetIter<Char>(from);
  const result = { fromMin: 0 as Char, fromMax: 0 as Char };
  while (iter.next(result) && result.fromMin < limit) {
    to.addRange(
      result.fromMin,
      result.fromMax >= limit ? (limit - 1) as Char : result.fromMax
    );
  }
}

function refine(
  set: ISet<Char>,
  refiner: ISet<Char>,
  inp: ISet<Char>,
  outp: ISet<Char>
): RefineResult {
  let setMin: Char, setMax: Char, refMin: Char, refMax: Char;
  const refIter = new ISetIter<Char>(refiner);
  const setIter = new ISetIter<Char>(set);
  let oneIn: Boolean = false;
  let oneOut: Boolean = false;

  const refResult = { fromMin: 0 as Char, fromMax: 0 as Char };
  const setResult = { fromMin: 0 as Char, fromMax: 0 as Char };

  if (!refIter.next(refResult)) {
    return RefineResult.allOut;
  }
  refMin = refResult.fromMin;
  refMax = refResult.fromMax;

  while (setIter.next(setResult)) {
    setMin = setResult.fromMin;
    setMax = setResult.fromMax;
    while (setMin <= setMax) {
      while (refMax < setMin && refIter.next(refResult)) {
        refMin = refResult.fromMin;
        refMax = refResult.fromMax;
      }
      if (refMax < setMin || setMin < refMin) {
        if (!oneOut) {
          if (oneIn) {
            addUpTo(inp, setMin, set);
          }
          oneOut = true;
        }
        if (refMax < setMin || refMin > setMax) {
          if (oneIn) {
            outp.addRange(setMin, setMax);
          }
          break;
        } else {
          if (oneIn) {
            outp.addRange(setMin, (refMin - 1) as Char);
          }
          setMin = refMin;
        }
      } else {
        if (!oneIn) {
          if (oneOut) {
            addUpTo(outp, setMin, set);
          }
          oneIn = true;
        }
        if (setMax <= refMax) {
          if (oneOut) {
            inp.addRange(setMin, setMax);
          }
          break;
        } else {
          // refMax < setMax
          if (oneOut) {
            inp.addRange(setMin, refMax);
          }
          // avoid wrapping round
          if (refMax === charMax) {
            break;
          }
          setMin = (refMax + 1) as Char;
        }
      }
    }
  }
  if (oneIn) {
    return oneOut ? RefineResult.someInSomeOut : RefineResult.allIn;
  } else {
    return RefineResult.allOut;
  }
}

function refineBySet(
  classes: IList<EquivClass>,
  set: ISet<Char>,
  setFlag: number
): void {
  const inOwner = new Owner<EquivClass>(new EquivClass());
  const outOwner = new Owner<EquivClass>(new EquivClass());
  const newClasses = new IList<EquivClass>();
  for (;;) {
    const p = classes.head();
    if (!p) {
      break;
    }
    if (!outOwner.pointer()) {
      outOwner.reset(new EquivClass());
    }
    const inClass = inOwner.pointer()!;
    const outClass = outOwner.pointer()!;
    switch (refine(p.set, set, inClass.set, outClass.set)) {
      case RefineResult.someInSomeOut:
        inClass.inSets = p.inSets | setFlag;
        newClasses.insert(inOwner.extract()!);
        outClass.inSets = p.inSets;
        newClasses.insert(outOwner.extract()!);
        inOwner.reset(classes.get()!);
        inOwner.pointer()!.set.clear();
        inOwner.pointer()!.inSets = 0;
        break;
      case RefineResult.allIn:
        p.inSets |= setFlag;
        newClasses.insert(classes.get()!);
        break;
      case RefineResult.allOut:
        newClasses.insert(classes.get()!);
        break;
    }
  }
  classes.swap(newClasses);
}

export class Partition {
  private maxCode_: EquivCode;
  private setCodes_: Vector<String<EquivCode>>;
  private map_: XcharMap<EquivCode>;

  constructor(
    chars: ISet<Char>,
    sets: Array<ISet<Char> | null>,
    nSets: number,
    subst: SubstTable
  ) {
    this.map_ = new XcharMap<EquivCode>(0); // eE gets code 0
    this.setCodes_ = new Vector<String<EquivCode>>();
    this.maxCode_ = 0;

    const classes = new IList<EquivClass>();
    classes.insert(new EquivClass());
    classes.head()!.set.addRange(0, charMax);

    {
      const iter = new ISetIter<Char>(chars);
      const result = { fromMin: 0 as Char, fromMax: 0 as Char };
      while (iter.next(result)) {
        let min = result.fromMin;
        const max = result.fromMax;
        do {
          refineByChar(classes, subst.get(min));
        } while (min++ !== max);
      }
    }

    let i: number;
    for (i = 0; i < nSets; i++) {
      if (sets[i]) {
        refineBySet(classes, sets[i]!, 1 << i);
      }
    }

    this.maxCode_ = 0;

    this.setCodes_.resize(nSets);
    for (i = 0; i < nSets; i++) {
      this.setCodes_.set(i, new String<EquivCode>());
    }

    for (
      let listIter = new IListIter<EquivClass>(classes);
      !listIter.done();
      listIter.next()
    ) {
      ++this.maxCode_;
      ASSERT(this.maxCode_ !== 0);
      const p = listIter.cur()!;
      for (i = 0; i < nSets; i++) {
        if ((1 << i) & p.inSets) {
          this.setCodes_.get(i).appendChar(this.maxCode_);
        }
      }
      const setIter = new ISetIter<Char>(p.set);
      const setResult = { fromMin: 0 as Char, fromMax: 0 as Char };
      while (setIter.next(setResult)) {
        this.map_.setRange(setResult.fromMin, setResult.fromMax, this.maxCode_);
      }
    }

    {
      const iter = new ISetIter<Char>(chars);
      const result = { fromMin: 0 as Char, fromMax: 0 as Char };
      while (iter.next(result)) {
        let min = result.fromMin;
        const max = result.fromMax;
        do {
          const str = subst.inverse(min);
          const code = this.map_.get(min);
          for (let j = 0; j < str.size(); j++) {
            this.map_.setChar(str.get(j), code);
          }
        } while (min++ !== max);
      }
    }
  }

  maxCode(): EquivCode {
    return this.maxCode_;
  }

  charCode(c: Char): EquivCode {
    return this.map_.get(c);
  }

  eECode(): EquivCode {
    return 0;
  }

  setCodes(i: number): String<EquivCode> {
    return this.setCodes_.get(i);
  }

  map(): XcharMap<EquivCode> {
    return this.map_;
  }
}
