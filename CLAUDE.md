# OpenJade-JS Porter Development Instructions

## Mission
Create a Python tool that performs a 1:1 port of OpenSP and OpenJade from C++ to TypeScript, preserving all names, algorithms, and logic exactly as in the original.

## Project Structure
```
openjade-js/
  packages/
    opensp/
      src/           # Merged from include/* and lib/*
        *.ts         # One .ts per .h/.cxx pair
        nsgmls/      # Tool subdirectory
        spam/        # Tool subdirectory
    openjade/
      src/
        jade/        # Keep original structure
        dsssl/       # Keep original structure
        grove/       # Keep original structure
        style/       # Keep original structure
        spgrove/     # Keep original structure
  tools/
    porter/          # Your Python converter
      convert.py     # Main script
      patterns/      # Pattern rules
      tests/         # Porter tests
  upstream/          # Git submodules
    opensp/          # Original C++ source
    openjade/        # Original C++ source
```

## Core Requirements

### 1. Name Preservation
- ALL class names, method names, variable names must be EXACTLY preserved
- `FOTBuilder` stays `FOTBuilder`, not `FlowObjectTreeBuilder`
- `StringC` stays `StringC`, not `StringClass`
- Even "bad" names like `sp_` prefixes must be kept

### 2. File Merging Strategy
For OpenSP:
- `include/StringC.h` + `lib/StringC.cxx` → `src/StringC.ts`
- `include/Parser.h` + `lib/parser.cxx` → `src/Parser.ts`
- Remove include/lib separation, everything goes to src/

For OpenJade:
- Keep existing directory structure (already well organized)
- `jade/TeXFOTBuilder.h` + `jade/TeXFOTBuilder.cxx` → `jade/TeXFOTBuilder.ts`

### 3. Type Mappings

#### Fundamental Types
```python
TYPE_MAPPINGS = {
    'char': 'number',
    'unsigned char': 'number',
    'short': 'number', 
    'unsigned short': 'number',
    'int': 'number',
    'unsigned int': 'number',
    'long': 'number',
    'unsigned long': 'number',
    'size_t': 'number',
    'Boolean': 'boolean',
    'bool': 'boolean',
    'void': 'void',
    'const char*': 'string',
    'Char': 'number',  # 32-bit codepoint
    'WideChar': 'number',
    'float': 'number',
    'double': 'number'
}
```

#### String Handling
```typescript
// C++: const StringC &
// TS:  str: StringC

// C++: StringC *
// TS:  str: StringC | null

// StringC class must be implemented as:
class StringC {
    private chars: Uint32Array;  // Preserve 32-bit semantics
    // ... methods
}
```

#### Template Mappings
```python
TEMPLATE_MAPPINGS = {
    'Vector<{T}>': '{T}[]',
    'IList<{T}>': '{T}[]',
    'IListIter<{T}>': 'Iterator<{T}>',
    'Ptr<{T}>': '{T} | null',
    'ConstPtr<{T}>': 'Readonly<{T} | null>',
    'Owner<{T}>': '{T}',  # Just remove ownership semantics
    'CopyOwner<{T}>': '{T}',
    'HashTable<{K},{V}>': 'Map<{K},{V}>',
    'HashTableIter<{K},{V}>': 'IterableIterator<[{K},{V}]>'
}
```

### 4. Syntax Transformations

#### Classes
```cpp
// C++
class SP_API StringC {
public:
    StringC();
    ~StringC();
    size_t size() const;
private:
    Char *ptr_;
    size_t size_;
};

// TypeScript
export class StringC {
    private ptr_: Uint32Array;
    private size_: number;
    
    constructor() {
        this.ptr_ = new Uint32Array(0);
        this.size_ = 0;
    }
    
    size(): number {
        return this.size_;
    }
}
```

#### Namespaces
```cpp
// C++
#ifdef SP_NAMESPACE
namespace SP_NAMESPACE {
#endif

// TypeScript
// Just remove - TypeScript modules handle this
```

#### Const Methods
```cpp
// C++
size_t size() const { return size_; }

// TypeScript  
size(): number { return this.size_; }
// Note: Consider adding readonly where appropriate
```

#### References
```cpp
// C++ 
void foo(const StringC &str);
StringC &operator+=(const StringC &str);

// TypeScript
foo(str: StringC): void;
append(str: StringC): StringC;  // Return this for chaining
```

#### Pointers
```cpp
// C++
Node *parent_;
const Node *getParent() const;

// TypeScript
private parent_: Node | null;
getParent(): Node | null;
```

### 5. Special Cases

#### Operator Overloading
```python
OPERATOR_MAPPINGS = {
    'operator==': 'equals',
    'operator!=': 'notEquals',
    'operator<': 'lessThan',
    'operator>': 'greaterThan',
    'operator<=': 'lessOrEqual',
    'operator>=': 'greaterOrEqual',
    'operator[]': 'get',  # Or use proxy for actual [] access
    'operator()': 'invoke',
    'operator*': 'deref',  # For iterators
    'operator++': 'next',  # For iterators
    'operator+=': 'append',
    'operator=': null  # Handle in constructor/assignment
}
```

#### Multiple Inheritance
```cpp
// C++
class TeXFOTBuilder : public FOTBuilder, public OutputByteStream::Escaper {

// TypeScript - use interfaces
interface Escaper {
    escape(ch: number): void;
}

class TeXFOTBuilder extends FOTBuilder implements Escaper {
```

#### Friend Classes
```cpp
// C++
friend class Parser;

// TypeScript
// Make methods public or use /** @internal */ comment
```

#### Unions
```cpp
// C++
union {
    int i;
    float f;
    void *p;
};

// TypeScript
type UnionValue = 
    | { type: 'int'; value: number }
    | { type: 'float'; value: number }
    | { type: 'pointer'; value: any };
```

### 6. Preprocessor Handling

#### Conditional Compilation
```cpp
#ifdef WIN32
    // Windows code
#else
    // Unix code
#endif

// TypeScript - use runtime detection
if (process.platform === 'win32') {
    // Windows code
} else {
    // Unix code
}
```

#### Macros
```python
# Simple macros → const
#define SGML_PARSE_STATE_SIZE 20
# becomes:
const SGML_PARSE_STATE_SIZE = 20;

# Function macros → inline functions
#define MIN(a,b) ((a)<(b)?(a):(b))
# becomes:
function MIN(a: number, b: number): number { return a < b ? a : b; }

# Complex macros → regular functions
```

### 7. Message System
OpenSP/OpenJade use message resource files (.rc, .msg). Convert to TypeScript:

```typescript
// From ParserMessages.msg
enum ParserMessages {
    unexpectedEof = 1001,
    invalidChar = 1002,
    // ...
}

const MessageTexts = {
    [ParserMessages.unexpectedEof]: "Unexpected end of file",
    [ParserMessages.invalidChar]: "Invalid character in input",
    // ...
};
```

### 8. Memory Management
IGNORE all of these - JavaScript GC handles it:
- `delete`
- `delete[]`
- Destructors (unless they do more than free memory)
- `Owner<T>`, `CopyOwner<T>` (just unwrap the type)

### 9. Include/Import Generation
```python
# Analyze C++ includes and generate appropriate imports
#include "StringC.h"
#include "types.h"

# becomes:
import { StringC } from './StringC';
import { types } from './types';
```

### 10. Critical Files to Start With

Port in this order for OpenSP:
1. `types.h` → `types.ts` (fundamental type definitions)
2. `StringC.h/cxx` → `StringC.ts`
3. `Vector.h/cxx` → `Vector.ts` 
4. `IList.h/cxx` → `IList.ts`
5. `Message.h/cxx` → `Message.ts`
6. `Location.h/cxx` → `Location.ts`
7. `EntityManager.h/cxx` → `EntityManager.ts`

## Porter Algorithm

### Phase 1: Analysis
1. Scan all .h files to build class/type registry
2. Match .h files with corresponding .cxx files
3. Build dependency graph

### Phase 2: Conversion
For each file pair:
1. Parse header file for class declaration
2. Parse implementation file for method bodies
3. Merge into single TypeScript class
4. Apply type mappings
5. Transform syntax
6. Generate imports based on dependencies

### Phase 3: Output
1. Write TypeScript files preserving directory structure
2. Generate index.ts exports
3. Create package.json

## Testing Strategy

1. **Immediate Test**: After porting StringC
```bash
# Create test that makes StringC, does operations, prints results
# Compare with C++ version doing same operations
```

2. **ESIS Test**: After minimal parser port
```bash
original-onsgmls test.sgml > expected.esis
node ./onsgmls.js test.sgml > actual.esis
diff expected.esis actual.esis
```

## Error Handling

**CRITICAL**: When the porter encounters unknown patterns:
```python
# DO NOT GUESS - FAIL LOUD
raise Exception(f"UNKNOWN PATTERN at {filename}:{line_num}: {line}")
```

Better to have 100 manual fixes than 1 silent mistranslation.

## Specific Patterns to Watch For

### Static Members
```cpp
class Foo {
    static const int maxSize = 100;
    static HashMap<StringC,int> cache;
};

// TypeScript
class Foo {
    static readonly maxSize = 100;
    static cache = new Map<StringC, number>();
}
```

### RAII Patterns (Can Ignore)
```cpp
class InputSourceOrigin : public Origin {
public:
    ~InputSourceOrigin();  // Just closing files - ignore in TS
};
```

### Character Handling
```cpp
// These are everywhere in OpenSP
Char c = 0x1234;
if (c > 127) { ... }

// TypeScript - preserve exact semantics
let c: number = 0x1234;
if (c > 127) { ... }
```

## Preservation Rules

### MUST Preserve:
- All algorithm logic (even if inefficient)
- All class/method/variable names
- Directory structure (except include/lib merge)
- Comments (especially copyright notices)
- Order of operations (some code relies on side effects)

### Can Modify:
- Pointer arithmetic → array indexing
- Manual memory management → remove
- Platform #ifdefs → runtime checks or Node.js APIs
- Operator overloading → named methods

### NEVER Do:
- "Improve" algorithms
- Rename for clarity
- Refactor for "better" structure
- Use modern JS features if they change semantics
- Skip "useless" code (it might have side effects)

## Start Commands

```bash
# 1. Clone OpenSP and OpenJade sources
cd upstream
git clone [opensp-repo]
git clone [openjade-repo]

# 2. Start porter development
cd ../tools/porter
python convert.py --analyze ../upstream/opensp

# 3. Port first file
python convert.py \
    --header ../upstream/opensp/include/StringC.h \
    --impl ../upstream/opensp/lib/StringC.cxx \
    --output ../../packages/opensp/src/StringC.ts

# 4. Test immediately
cd ../../packages/opensp
npm init -y
npm install --save-dev typescript @types/node
npx tsc StringC.ts
```

## Success Criteria

1. `onsgmls` produces byte-identical ESIS output
2. All original test cases pass
3. Performance within 5x of C++ version (Node.js overhead acceptable)
4. Code is recognizable to anyone familiar with OpenSP/OpenJade

## Remember

This is a MECHANICAL PORT. No creativity, no improvements, no "better ways". James Clark's code has worked for 25+ years. Preserve it exactly, just translate the syntax.

When in doubt:
- Keep the original name
- Keep the original structure  
- Keep the original algorithm
- Just make it valid TypeScript

Good luck!