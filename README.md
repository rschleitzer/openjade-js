# OpenJade-JS

A faithful 1:1 port of OpenSP and OpenJade from C++ to TypeScript, preserving all original algorithms, names, and logic.

## What is this?

OpenJade-JS is a mechanical translation of two critical SGML/DSSSL tools to TypeScript:

- **OpenSP**: An SGML parser implementing ISO 8879:1986 (Standard Generalized Markup Language)
- **OpenJade**: A DSSSL (Document Style Semantics and Specification Language) engine for document transformation

This project maintains 100% compatibility with the original C++ implementations while enabling these tools to run in JavaScript/TypeScript environments.

## Why?

OpenSP and OpenJade are battle-tested tools that have worked reliably for 25+ years. Rather than reimagining or modernizing them, this project provides a direct translation that:

- Preserves James Clark's original algorithms exactly
- Maintains all class, method, and variable names
- Produces identical output to the C++ versions
- Enables SGML/DSSSL processing in Node.js environments

## Project Structure

```
openjade-js/
├── packages/
│   ├── opensp/              # SGML parser
│   │   └── src/
│   │       ├── StringC.ts
│   │       ├── Parser.ts
│   │       ├── EntityManager.ts
│   │       ├── nsgmls/      # onsgmls tool
│   │       └── spam/        # spam tool
│   └── openjade/            # DSSSL engine
│       └── src/
│           ├── jade/
│           ├── dsssl/
│           ├── grove/
│           ├── style/
│           └── spgrove/
├── tools/
│   └── porter/              # C++ to TypeScript converter
│       ├── convert.py
│       ├── patterns/
│       └── tests/
└── upstream/                # Git submodules (original C++ source)
    ├── opensp/
    └── openjade/
```

## Installation

```bash
npm install openjade-js
```

Or for individual packages:

```bash
npm install @openjade-js/opensp
npm install @openjade-js/openjade
```

## Usage

### onsgmls (SGML Parser)

```bash
# Parse SGML document to ESIS format
onsgmls document.sgml > output.esis

# With catalog
onsgmls -c catalog document.sgml
```

### OpenJade (DSSSL Processor)

```bash
# Process SGML with DSSSL stylesheet
openjade -t tex -d style.dsl document.sgml > output.tex
```

### Programmatic API

```typescript
import { Parser } from '@openjade-js/opensp';
import { StringC } from '@openjade-js/opensp';

// Create an SGML parser
const parser = new Parser();
// ... use exactly as you would in C++
```

## Development

### Prerequisites

- Node.js 18+
- Python 3.8+ (for the porter tool)
- TypeScript 5+

### Building from Source

```bash
# Clone repository
git clone https://github.com/yourusername/openjade-js.git
cd openjade-js

# Initialize upstream submodules
git submodule update --init --recursive

# Install dependencies
npm install

# Build packages
npm run build
```

### Running the Porter

The `porter` tool converts C++ source files to TypeScript:

```bash
cd tools/porter

# Analyze source files
python convert.py --analyze ../../upstream/opensp

# Convert a specific file
python convert.py \
  --header ../../upstream/opensp/include/StringC.h \
  --impl ../../upstream/opensp/lib/StringC.cxx \
  --output ../../packages/opensp/src/StringC.ts
```

## Testing

This project aims for byte-identical output with the original C++ implementations:

```bash
# Test ESIS output matches original
original-onsgmls test.sgml > expected.esis
node ./packages/opensp/src/nsgmls/onsgmls.js test.sgml > actual.esis
diff expected.esis actual.esis
```

## Philosophy

This is a **mechanical port**, not a modernization:

### We DO:
- Preserve all original names (even "bad" ones like `sp_` prefixes)
- Keep all original algorithms (even if inefficient)
- Maintain original directory structures
- Translate syntax mechanically
- Preserve comments and copyright notices

### We DON'T:
- "Improve" algorithms
- Rename for clarity
- Refactor for "better" structure
- Use modern JS features if they change semantics
- Skip code that seems "useless"

**When in doubt**: Keep it exactly as the original. James Clark's code has worked for 25+ years.

## Type Mappings

Key C++ to TypeScript conversions:

```typescript
// Fundamental types
char, int, size_t          → number
Boolean, bool              → boolean
const char*                → string
Char, WideChar             → number (32-bit codepoint)

// Templates
Vector<T>                  → T[]
Ptr<T>                     → T | null
HashTable<K,V>             → Map<K,V>

// Operators
operator==                 → equals()
operator[]                 → get()
operator+=                 → append()
```

## Contributing

Contributions should maintain the 1:1 porting philosophy:

1. All PRs must preserve original names and algorithms
2. Test output must match C++ version byte-for-byte
3. Porter improvements welcome (better pattern detection, etc.)
4. Documentation improvements welcome
5. Performance optimizations only if semantics unchanged

## License

This project maintains the original licenses from OpenSP and OpenJade. See LICENSE files in respective package directories.

## Acknowledgments

- **James Clark**: Original author of SP, OpenSP, Jade, and OpenJade
- **OpenJade Contributors**: All contributors to the original C++ projects
- **SGML/DSSSL Community**: For decades of standardization work

## Status

🚧 **Work in Progress** 🚧

Current progress:
- [ ] Core type system (StringC, Vector, IList)
- [ ] SGML parser core
- [ ] Entity manager
- [ ] Message system
- [ ] onsgmls tool
- [ ] DSSSL engine
- [ ] OpenJade tools

## Resources

- [OpenSP Documentation](http://openjade.sourceforge.net/doc/)
- [SGML Standard (ISO 8879:1986)](https://www.iso.org/standard/16387.html)
- [DSSSL Standard (ISO/IEC 10179:1996)](https://www.iso.org/standard/18878.html)
- [Original OpenJade Project](http://openjade.sourceforge.net/)

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/openjade-js/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/openjade-js/discussions)
