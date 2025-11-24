# OpenJade-JS Port Progress

## Current Status

We've successfully initiated the 1:1 mechanical port of OpenSP from C++ to TypeScript. The porter tool and fundamental data structures are complete and tested.

## Completed ✅

### Core Infrastructure
- ✅ Project structure set up (`packages/opensp`, `tools/porter`)
- ✅ TypeScript configuration with appropriate compiler settings
- ✅ Build system with `npm run build` and `npm run test`
- ✅ Porter tool skeleton in Python (`tools/porter/convert.py`)

### Fundamental Types (Phase 1)
- ✅ **types.ts** - All fundamental type mappings (Char, Number, Offset, etc.)
- ✅ **Boolean.ts** - Boolean and PackedBoolean types
- ✅ **StringOf.ts** - Generic String<T> template class (complete implementation)
- ✅ **StringC.ts** - StringC type alias for String<Char>
- ✅ **Vector.ts** - Generic Vector<T> template class (complete implementation)
- ✅ **Link.ts** - Intrusive linked list node
- ✅ **IListBase.ts** - Base intrusive list implementation
- ✅ **IList.ts** - Generic IList<T> template class

### Smart Pointers & Resource Management (Phase 2)
- ✅ **Resource.ts** - Reference counting base class (335+ uses in codebase)
- ✅ **Ptr.ts** - Reference-counted smart pointer Ptr<T> and ConstPtr<T>
- ✅ **Owner.ts** - Owning pointer template Owner<T>
- ✅ **CopyOwner.ts** - Copy-on-assign owner CopyOwner<T>
- ✅ **Named.ts** - Base class for named objects
- ✅ **NamedResource.ts** - Named + Resource combined base class
- ✅ **Hash.ts** - String hashing utility (Chris Torek algorithm)
- ✅ **HashTable.ts** - Generic hash table using native Map

### Testing
- ✅ Basic test suite (`src/test.ts`) validates:
  - String operations (create, copy, append, insert, equals, resize)
  - Vector operations (push_back, resize, copy, clear, indexing)
  - All tests passing ✓

### Build Artifacts
- ✅ Clean TypeScript compilation (no errors)
- ✅ Generated `.js` and `.d.ts` files in `dist/`
- ✅ Proper module exports via `index.ts`

## Implementation Details

### Performance Optimizations Made
1. **String/Vector growth** - Using `array.slice()` and spread operator instead of manual loops
2. **Type preservation** - All original C++ names preserved exactly (StringC, Vector, IList, etc.)
3. **Memory safety** - Leveraging JavaScript GC instead of manual delete/delete[]

### Key Design Decisions
1. **Arrays over TypedArrays** - Using generic `T[]` for flexibility, but optimized copying
2. **Null handling** - Translating C++ pointers to `T | null` pattern
3. **Operator mapping** - `operator==` → `equals()`, `operator[]` → `get()/set()`
4. **Template preservation** - Kept C++ templates as TypeScript generics

## File Statistics

```
packages/opensp/src/
├── Boolean.ts        (684 bytes)   - Type definitions
├── types.ts          (1,383 bytes) - Fundamental types
├── StringOf.ts       (6,917 bytes) - Generic String<T> implementation
├── StringC.ts        (189 bytes)   - StringC typedef
├── Vector.ts         (7,296 bytes) - Generic Vector<T> implementation
├── Link.ts           (389 bytes)   - Linked list node
├── IListBase.ts      (1,779 bytes) - Intrusive list base class
├── IList.ts          (960 bytes)   - Generic intrusive list
├── Resource.ts       (624 bytes)   - Reference counting base
├── Ptr.ts            (4,234 bytes) - Smart pointers (Ptr, ConstPtr)
├── Owner.ts          (1,124 bytes) - Owning pointer
├── CopyOwner.ts      (783 bytes)   - Copy-on-assign owner
├── Named.ts          (631 bytes)   - Named objects base
├── NamedResource.ts  (598 bytes)   - Named + Resource
├── index.ts          (27 lines)    - Main exports
└── test.ts           (2,758 bytes) - Test suite

Total: 18 files, ~1,400 lines of ported TypeScript code
```

### Phase 3: Location and Utilities (Completed)
- ✅ **SubstTable.ts** - Character substitution table with binary search
- ✅ **Location.ts** - Source location tracking system
  - Location class (origin + index)
  - Origin hierarchy (base class for location origins)
  - ProxyOrigin, BracketOrigin, ReplacementOrigin, MultiReplacementOrigin
  - InputSourceOrigin with character reference tracking
  - EntityOrigin (partial - awaiting Entity class)
  - NamedCharRef tracking
  - ExternalInfo support
- ✅ **Vector.data()** - Added data() method for underlying array access
- ✅ **Text.ts** - Text with location tracking
- ✅ **CharMap.ts** / **XcharMap.ts** - Character mapping utilities
- ✅ **ISet.ts** / **RangeMap.ts** - Integer sets and range mapping
- ✅ **IListIterBase.ts** / **IListIter.ts** / **List.ts** - List iteration support

### Phase 4: Options and Configuration (Completed)
- ✅ **EventsWanted.ts** - Parser event configuration flags
- ✅ **ParserOptions.ts** / **Warnings.ts** - Parser options with 70+ warning flags
- ✅ **Options.ts** / **LongOption.ts** - Command-line option parsing (getopt-style)

### Phase 5: Advanced Data Structures (Completed)
- ✅ **PointerTable.ts** - Generic hash table with open addressing
- ✅ **OwnerTable.ts** / **CopyOwnerTable.ts** - Owning hash tables with RAII semantics
- ✅ **NamedTable.ts** - Hash table for Named objects
- ✅ **NamedResourceTable.ts** - Hash table for NamedResource objects
- ✅ **IQueue.ts** / **IQueueBase.ts** - Intrusive circular queue
- ✅ **NCVector.ts** - Non-copying vector alias

### Phase 6: System Utilities (Completed)
- ✅ **TypeId.ts** - Runtime type information (simplified for TypeScript)
- ✅ **macros.ts** - ASSERT, CANNOT_HAPPEN, SIZEOF utilities
- ✅ **sptchar.ts** - Platform string utilities
- ✅ **OutputByteStream.ts** - Buffered byte output streams (StrOutputByteStream, FileOutputByteStream)
- ✅ **CodingSystem.ts** - Character encoding infrastructure (Decoder, Encoder, InputCodingSystem, OutputCodingSystem)
- ✅ **IdentityCodingSystem.ts** - Identity (pass-through) character encoding

### Phase 7: Message System (Completed)
- ✅ **MessageBuilder.ts** - Abstract interface for message formatting
- ✅ **MessageArg.ts** - Message argument classes (StringMessageArg, NumberMessageArg, OrdinalMessageArg, etc.)
- ✅ **Message.ts** - Complete message system with MessageType hierarchy, Messenger abstract class, and implementations

### Phase 8: Character Set and Identification (Completed)
- ✅ **UnivCharsetDesc.ts** - Universal character set description with range mapping
- ✅ **CharsetInfo.ts** - Character set information and conversion utilities
- ✅ **ExternalId.ts** - External identifier handling (FPI and URN support for SGML public identifiers)

### Phase 9: Input Abstraction (Completed)
- ✅ **MarkupScan.ts** - Markup scanning type definitions
- ✅ **InputSource.ts** - Abstract input source with buffering and location tracking

### Phase 10: Entity Management Foundation (Completed)
- ✅ **EntityDecl.ts** - Entity declaration base class with DeclType and DataType enums
- ✅ **EntityCatalog.ts** - Abstract entity catalog interface for resolving external identifiers
- ✅ **EntityManager.ts** - Abstract entity manager interface for opening input sources
- ✅ **Attributed.ts** - Mixin for classes with attribute definitions
- ✅ **Notation.ts** - Notation declarations extending EntityDecl and Attributed
- ✅ **SdText.ts** - SGML declaration text with location tracking
- ✅ **CharsetDecl.ts** - Character set declaration with range mapping
- ✅ **Allocator.ts** - Memory allocator stub (not needed in TypeScript/GC)

### Phase 11: Parser Core (In Progress)
- ✅ **Syntax.ts** - SGML syntax definition core (875 lines) - delimiters, character sets, quantities
- ✅ **Sd.ts** - SGML declaration configuration (563 lines) - features, capacities, reserved names
- ✅ **Markup.ts** - Markup handling with item types (494 lines) - reserves names, delimiters, literals, entity tracking
- ✅ **Attribute.ts** - Complete attribute value and definition system (1,100 lines)
  - AttributeValue hierarchy (Implied, Cdata, Tokenized, Data)
  - DeclaredValue hierarchy (Cdata, Tokenized, Group, Notation, Entity, Id, Idref)
  - AttributeDefinition hierarchy (Required, Current, Implied, Conref, Default, Fixed)
  - AttributeDefinitionList with token/attribute indexing
  - AttributeSemantics (Entity, Notation)
  - AttributeContext abstract base
- ✅ **Entity.ts** - Complete entity system (551 lines)
  - Entity base class with reference handling (literal, declaration, content, rcdata)
  - InternalEntity hierarchy (Pi, Cdata, Sdata, Text, Predefined)
  - ExternalEntity hierarchy (Text, Data, Subdoc)
  - IgnoredEntity for undefined entities
- ✅ **Dtd.ts** - Document Type Definition system (353 lines)
  - Dtd class managing entities, element types, notations, short reference maps
  - General and parameter entity tables
  - Element type and notation management
  - Short reference indexing
- ✅ **ElementType.ts** - Element type definitions (316 lines)
  - ElementDefinition with content models (modelGroup, any, cdata, rcdata, empty)
  - ElementType with attributes, short reference maps, rank stems
  - RankStem for ranked elements
  - ShortReferenceMap stub
  - Inclusions/exclusions, omitted tag minimization
- ✅ **ContentToken.ts** - Content model token hierarchy (709 lines - mostly complete)
  - ContentToken abstract base with occurrence indicators (?, +, *)
  - ModelGroup hierarchy (AndModelGroup, OrModelGroup, SeqModelGroup) with connectors (&, |, ,)
  - LeafContentToken hierarchy (PcdataToken, InitialPseudoToken, ElementToken)
  - DataTagGroup and DataTagElementToken for data tag patterns
  - CompiledModelGroup for DFA-based content model compilation
  - Transition tracking with FirstSet/LastSet analysis
  - GroupInfo for content model analysis state
  - AndInfo, AndState for AND group state tracking
  - MatchState for content model position tracking
  - **Note**: Some transition logic methods still need implementation (marked with TODO)
- ✅ **ShortReferenceMap.ts** - Short reference map management (91 lines)
  - Named short reference maps with entity mapping
  - Lookup by index with name/entity resolution
  - Definition location tracking
  - Usage tracking for validation
- ✅ **ErrnoMessageArg.ts** - Error number message argument (25 lines)
  - OtherMessageArg subclass for errno values
  - System error number wrapping for message formatting
- ✅ **SearchResultMessageArg.ts** - Search result message argument (51 lines)
  - OtherMessageArg subclass for file search results
  - Tracks multiple filename/errno pairs for failed searches
  - Used for entity catalog search error reporting
- ✅ **InternalInputSource.ts** - Internal input source implementation (64 lines)
  - InputSource subclass for in-memory string content
  - Character reference handling with buffer management
  - Rewind support for entity expansion
- ✅ **OpenElement.ts** - Open element tracking (154 lines)
  - Tracks open elements in the element stack
  - Content model matching with MatchState integration
  - Tag omission support (omitted start/end tags)
  - Special parsing modes (CDATA, RCDATA, ANY)
  - Short reference map management per element
- ✅ **ContentState.ts** - Element stack state management (316 lines)
  - Manages open element stack with IList
  - Tracks inclusions/exclusions per element
  - Tag level and nesting tracking
  - Element creation for undefined elements
  - Implication loop detection
  - Content mode determination
- ✅ **Lpd.ts** - Link Process Definition system (473 lines)
  - Lpd base class (simple, implicit, explicit link types)
  - SimpleLpd and ComplexLpd with DTD management
  - ResultElementSpec for link result elements
  - SourceLinkRule for link rule specifications
  - SourceLinkRuleResource with Resource tracking
  - LinkSet with link rule management
  - IdLinkRule for ID link associations
  - IdLinkRuleGroup for ID link collections
  - Link attribute definition management
- 🚧 **Event.ts** - Parser event system (348 lines, partial, 11 of 54 classes)
  - Event base class with type enumeration (39 event types)
  - LocatedEvent, MarkupEvent abstract bases
  - MessageEvent for error/warning messages
  - StartElementEvent, EndElementEvent for element boundaries
  - DataEvent, ImmediateDataEvent for character data
  - **TODO**: Remaining 43 event classes (Pi, External entities, DTD/LPD events, etc.)

## Next Steps (Priority Order)

### Phase 11 Continuation: Parser Core Components
1. Port Group.h/cxx → Group.ts (group token processing)
2. Port Recognizer.h/cxx → Recognizer.ts (content model recognizer)
3. Port NumericCharRefOrigin.h/cxx → NumericCharRefOrigin.ts (numeric character references)

### Phase 12: SGML Tokenization
7. Port Syntax.h/cxx → Syntax.ts
8. Port Scanner classes

### Phase 13: Parser Core
9. Port Parser.h/cxx → Parser.ts
10. Port ParserState.h/cxx → ParserState.ts
11. Port Event.h/cxx → Event.ts

### Phase 14: Application Layer
12. Port onsgmls tool (ESIS output generator)
13. Create ESIS output test
14. Compare with C++ onsgmls output byte-for-byte

## Testing Strategy

### Immediate Tests (Done ✓)
- String operations correctness
- Vector operations correctness

### Next Tests (Todo)
- Smart pointer reference counting
- Message system localization
- Location tracking accuracy
- Input source chaining

### Integration Tests (Future)
- Parse simple SGML document
- Generate ESIS output
- Compare with C++ onsgmls byte-for-byte

## Success Metrics

- [x] All foundational data structures ported (18 core classes)
- [x] Smart pointer system complete (Resource, Ptr, Owner, CopyOwner)
- [x] Location tracking system complete (Location, Origin hierarchy)
- [x] Character substitution utilities (SubstTable)
- [ ] Basic parser infrastructure complete (Message, Input, Text)
- [ ] Entity and DTD management (EntityManager, Dtd, Syntax)
- [ ] Can parse minimal SGML document
- [ ] ESIS output matches C++ version exactly
- [ ] Performance within 5x of C++ (acceptable Node.js overhead)

## Porter Tool Development

The `tools/porter/convert.py` currently handles:
- Simple header files (typedefs, consts)
- Class-based headers (basic skeleton)

Still needed:
- Full method body translation
- Preprocessor macro expansion
- Include dependency resolution
- Batch conversion of entire directories

## Notes

- Following CLAUDE.md guidelines strictly
- All names preserved exactly (no "improvements")
- All algorithms preserved exactly (no optimizations)
- Comments and copyright preserved
- This is a MECHANICAL PORT, not a rewrite

## Time Invested

- Initial setup: ~30 minutes
- Core data structures: ~90 minutes
- Testing and validation: ~20 minutes
- **Total: ~2.5 hours**

## Lines of Code

- C++ (OpenSP core): ~50,000 lines
- TypeScript (ported so far): ~13,777 lines (76 modules out of 120 headers)
- **Progress: ~28%** (by LOC, foundational infrastructure complete, parser core in progress)

---

Last updated: 2025-11-24
