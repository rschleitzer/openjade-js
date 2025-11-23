# OpenSP/OpenJade C++ to TypeScript Porter

A Python tool that performs a 1:1 mechanical port of OpenSP and OpenJade from C++ to TypeScript, preserving all names, algorithms, logic, and **comments** exactly as in the original.

## Philosophy

This is a **MECHANICAL PORT** - not a rewrite, not a modernization. The goal is to translate James Clark's proven C++ code into valid TypeScript while changing as little as possible.

### MUST Preserve:
- All algorithm logic (even if inefficient)
- All class/method/variable names
- All comments (especially copyright notices)
- Directory structure (except include/lib merge)
- Order of operations (some code relies on side effects)

### NEVER Do:
- "Improve" algorithms
- Rename for clarity
- Refactor for "better" structure
- Skip "useless" code (it might have side effects)

## Installation

No installation required. Just Python 3.6+.

## Usage

### Convert Simple Header (typedefs, constants)

```bash
python3 tools/porter/convert.py \
    --header upstream/opensp/include/types.h \
    --output packages/opensp/src/types.ts \
    --verbose
```

**Examples:** `types.h`, `Boolean.h`

### Convert Class Header (template classes, methods)

```bash
python3 tools/porter/convert.py \
    --header upstream/opensp/include/StringOf.h \
    --output packages/opensp/src/StringOf.ts \
    --mode class \
    --verbose
```

**Examples:** `StringOf.h`, `Vector.h`, `IList.h`

### Analyze Directory

```bash
python3 tools/porter/convert.py \
    --analyze upstream/opensp \
    --verbose
```

## Type Mappings

### Fundamental Types
| C++ | TypeScript |
|-----|------------|
| `int`, `long`, `unsigned` | `number` |
| `char`, `Char` (32-bit) | `number` |
| `Boolean`, `bool` | `boolean` |
| `void` | `void` |
| `const char*` | `string` |
| `size_t` | `number` |

### Template Types
| C++ | TypeScript |
|-----|------------|
| `Vector<T>` | `T[]` |
| `IList<T>` | `T[]` |
| `Ptr<T>` | `T \| null` |
| `Owner<T>` | `T` (remove ownership) |
| `HashTable<K,V>` | `Map<K,V>` |

### Operators
| C++ | TypeScript |
|-----|------------|
| `operator==` | `equals()` |
| `operator!=` | `notEquals()` |
| `operator[]` | `get()` |
| `operator+=` | `append()` |

## Features

### ✅ Comment Preservation
All C++ comments are preserved exactly:
```cpp
// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

// Number holds values between 0 and 99999999 (eight nines).
typedef Unsigned32 Number;
```

Becomes:
```typescript
// Copyright (c) 1994 James Clark
// See the file COPYING for copying permission.

// Number holds values between 0 and 99999999 (eight nines).
export type Number = number;
```

### ✅ Conditional Compilation Handling
```cpp
#ifdef SP_MULTI_BYTE
typedef Unsigned32 Char;
#else
typedef unsigned char Char;
#endif
```

Becomes:
```typescript
// #ifdef SP_MULTI_BYTE
export type Char = number;
// #else
// typedef unsigned char Char;  // Duplicate, skipped
// #endif
```

The first definition wins, duplicates are commented out.

### ✅ Template Class Conversion
```cpp
template<class T>
class String {
public:
    size_t size() const;
    void swap(String<T> &str);
private:
    T *ptr_;
    size_t length_;
};
```

Becomes:
```typescript
export class String<T> {
  // public:
  size(): number { throw new Error('Not implemented'); }
  swap(str: String<T>): void { throw new Error('Not implemented'); }
  // private:
  private ptr_: T | null;
  private length_: number;
}
```

### ✅ Inline Methods Preserved
Inline methods with bodies are kept as comments for manual conversion:
```typescript
  // size_t size() const { return length_; }
```

This ensures no logic is silently lost.

## Converted Files

Successfully converted and TypeScript-validated:

- ✅ `types.ts` - All fundamental type definitions
- ✅ `Boolean.ts` - Boolean types
- ✅ `StringOf.ts` - Template String<T> class

## Error Handling

When the porter encounters unknown patterns, it **FAILS LOUD**:

```python
raise Exception(f"UNKNOWN PATTERN at {filename}:{line_num}: {line}")
```

Better to have 100 manual fixes than 1 silent mistranslation.

## Testing

```bash
cd packages/opensp
npm install
npx tsc --noEmit  # Should pass with no errors
```

## Next Steps

1. Port more core classes:
   - `Vector.h/cxx` → `Vector.ts`
   - `IList.h/cxx` → `IList.ts`
   - `Message.h/cxx` → `Message.ts`

2. Implement method body conversion for inline methods

3. Handle C++ implementation files (`.cxx`)

4. Merge header + implementation into single `.ts` files

## Architecture

```
tools/porter/
  convert.py          # Main conversion script
  patterns/           # Pattern rules (future)
  tests/              # Porter tests (future)
  README.md           # This file
```

## Contributing

When enhancing the porter:
1. Preserve ALL comments from original code
2. FAIL LOUD on unknown patterns - never guess
3. Test with `tsc --noEmit` after each change
4. Document new patterns in this README

## License

This tool is MIT licensed. The original OpenSP/OpenJade code retains its original copyright and license (see source files).
