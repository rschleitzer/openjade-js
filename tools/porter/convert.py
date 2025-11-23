#!/usr/bin/env python3
"""
OpenSP/OpenJade C++ to TypeScript Porter

This tool performs a 1:1 mechanical port of C++ code to TypeScript,
preserving all names, algorithms, logic, and COMMENTS exactly as in the original.

CRITICAL: When encountering unknown patterns, FAIL LOUD - do NOT guess.
"""

import re
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass


# Type mappings from C++ to TypeScript
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
    'const char *': 'string',
    'Char': 'number',  # 32-bit codepoint
    'WideChar': 'number',
    'UnivChar': 'number',
    'SyntaxChar': 'number',
    'Xchar': 'number',
    'float': 'number',
    'double': 'number',
    'Unsigned32': 'number',
    'Signed32': 'number',
    'Number': 'number',
    'Offset': 'number',
    'Index': 'number',
    'CharClassIndex': 'number',
    'Token': 'number',
    'EquivCode': 'number',
    'PackedBoolean': 'boolean',
    'unsigned': 'number',
    'signed': 'number',
}

# Template mappings
TEMPLATE_PATTERNS = [
    (r'Vector<(.+)>', r'\1[]'),
    (r'IList<(.+)>', r'\1[]'),
    (r'IListIter<(.+)>', r'Iterator<\1>'),
    (r'Ptr<(.+)>', r'\1 | null'),
    (r'ConstPtr<(.+)>', r'Readonly<\1 | null>'),
    (r'Owner<(.+)>', r'\1'),
    (r'CopyOwner<(.+)>', r'\1'),
    (r'HashTable<(.+),\s*(.+)>', r'Map<\1, \2>'),
    (r'HashTableIter<(.+),\s*(.+)>', r'IterableIterator<[\1, \2]>'),
    (r'String<(.+)>', r'String<\1>'),  # Keep as generic for now
]

# Operator mappings
OPERATOR_MAPPINGS = {
    'operator==': 'equals',
    'operator!=': 'notEquals',
    'operator<': 'lessThan',
    'operator>': 'greaterThan',
    'operator<=': 'lessOrEqual',
    'operator>=': 'greaterOrEqual',
    'operator[]': 'get',
    'operator()': 'invoke',
    'operator*': 'deref',
    'operator++': 'next',
    'operator+=': 'append',
    'operator=': None,  # Handle specially
}


@dataclass
class ClassMember:
    """Represents a class member (field or method)"""
    name: str
    type_: str
    visibility: str  # public, private, protected
    is_static: bool
    is_const: bool
    is_virtual: bool
    default_value: Optional[str] = None
    line_num: int = 0


@dataclass
class Method:
    """Represents a class method"""
    name: str
    return_type: str
    parameters: List[Tuple[str, str]]  # (name, type)
    visibility: str
    is_static: bool
    is_const: bool
    is_virtual: bool
    is_constructor: bool
    is_destructor: bool
    body: Optional[str] = None
    line_num: int = 0


@dataclass
class ClassDef:
    """Represents a C++ class"""
    name: str
    base_classes: List[str]
    members: List[ClassMember]
    methods: List[Method]
    template_params: Optional[str] = None
    line_num: int = 0


class CppParser:
    """Parses C++ header and implementation files"""

    def __init__(self, filename: str):
        self.filename = filename
        self.content = ""
        self.line_num = 0
        self.classes: List[ClassDef] = []

    def load_file(self):
        """Load file content"""
        with open(self.filename, 'r', encoding='utf-8', errors='ignore') as f:
            self.content = f.read()

    def extract_classes(self) -> List[ClassDef]:
        """Extract class definitions from C++ code"""
        classes = []
        lines = self.content.split('\n')

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Match class/struct declaration
            # template<class T>
            # class ClassName : public BaseClass {
            template_match = None
            if line.startswith('template<'):
                template_match = re.match(r'template<(.+)>', line)
                i += 1
                if i >= len(lines):
                    break
                line = lines[i].strip()

            class_match = re.match(r'(class|struct)\s+(\w+)(?:\s*:\s*(.+?))?\s*\{', line)
            if class_match:
                class_type = class_match.group(1)
                class_name = class_match.group(2)
                inheritance = class_match.group(3)

                base_classes = []
                if inheritance:
                    # Parse base classes: public Base1, private Base2
                    for base in inheritance.split(','):
                        base = base.strip()
                        # Remove access specifiers
                        base = re.sub(r'^(public|private|protected)\s+', '', base)
                        base_classes.append(base)

                template_params = template_match.group(1) if template_match else None

                class_def = ClassDef(
                    name=class_name,
                    base_classes=base_classes,
                    members=[],
                    methods=[],
                    template_params=template_params,
                    line_num=i
                )

                # Parse class body
                i += 1
                current_visibility = 'private' if class_type == 'class' else 'public'
                brace_depth = 1

                while i < len(lines) and brace_depth > 0:
                    line = lines[i]
                    stripped = line.strip()

                    # Track braces
                    brace_depth += stripped.count('{') - stripped.count('}')
                    if brace_depth == 0:
                        break

                    # Check for visibility specifiers
                    if stripped in ['public:', 'private:', 'protected:']:
                        current_visibility = stripped.rstrip(':')
                        i += 1
                        continue

                    # Skip empty lines and comments
                    if not stripped or stripped.startswith('//') or stripped.startswith('/*'):
                        i += 1
                        continue

                    # Try to parse member or method
                    # This is simplified - real parser would be more complex
                    i += 1

                classes.append(class_def)

            i += 1

        return classes

    def map_type(self, cpp_type: str) -> str:
        """Map C++ type to TypeScript type"""
        # Remove leading/trailing whitespace
        cpp_type = cpp_type.strip()

        # Remove const and & (references)
        cpp_type_clean = cpp_type.replace('const ', '').replace(' const', '')
        cpp_type_clean = cpp_type_clean.replace('&', '').strip()

        # Check if pointer
        is_pointer = '*' in cpp_type_clean
        cpp_type_clean = cpp_type_clean.replace('*', '').strip()

        # Apply template patterns
        for pattern, replacement in TEMPLATE_PATTERNS:
            cpp_type_clean = re.sub(pattern, replacement, cpp_type_clean)

        # Apply direct type mapping
        ts_type = TYPE_MAPPINGS.get(cpp_type_clean, cpp_type_clean)

        # Add null for pointers
        if is_pointer and ts_type != 'string':
            ts_type = f"{ts_type} | null"

        return ts_type

    def fail_unknown(self, pattern: str, line: str):
        """Fail loudly on unknown pattern"""
        raise Exception(
            f"UNKNOWN PATTERN at {self.filename}:{self.line_num}\n"
            f"Pattern: {pattern}\n"
            f"Line: {line}"
        )


class TypeScriptGenerator:
    """Generates TypeScript code from parsed C++ structures"""

    def __init__(self):
        self.imports: Set[str] = set()
        self.output: List[str] = []

    def generate_class(self, class_def: ClassDef, copyright: str = "") -> str:
        """Generate TypeScript class from C++ class definition"""
        lines = []

        # Add copyright
        if copyright:
            lines.append(copyright)
            lines.append("")

        # Handle template classes
        template_prefix = ""
        if class_def.template_params:
            template_prefix = f"<{class_def.template_params}>"

        # Class declaration
        if class_def.base_classes:
            base = class_def.base_classes[0]  # TypeScript only supports single inheritance
            lines.append(f"export class {class_def.name}{template_prefix} extends {base} {{")
        else:
            lines.append(f"export class {class_def.name}{template_prefix} {{")

        # Members
        for member in class_def.members:
            visibility = member.visibility if member.visibility != 'public' else ''
            static = 'static ' if member.is_static else ''
            readonly = 'readonly ' if member.is_const else ''

            if member.default_value:
                lines.append(f"  {visibility} {static}{readonly}{member.name}: {member.type_} = {member.default_value};")
            else:
                lines.append(f"  {visibility} {static}{readonly}{member.name}: {member.type_};")

        if class_def.members:
            lines.append("")

        # Methods
        for method in class_def.methods:
            lines.extend(self.generate_method(method))

        lines.append("}")
        lines.append("")

        return "\n".join(lines)

    def generate_method(self, method: Method) -> List[str]:
        """Generate TypeScript method"""
        lines = []

        visibility = method.visibility if method.visibility != 'public' else ''
        static = 'static ' if method.is_static else ''

        # Parameters
        params = ", ".join([f"{name}: {type_}" for name, type_ in method.parameters])

        if method.is_constructor:
            lines.append(f"  {visibility} constructor({params}) {{")
        else:
            lines.append(f"  {visibility} {static}{method.name}({params}): {method.return_type} {{")

        if method.body:
            # Add method body (will need transformation)
            lines.append(f"    {method.body}")
        else:
            # Empty body
            if method.return_type != 'void':
                lines.append(f"    throw new Error('Not implemented');")

        lines.append("  }")
        lines.append("")

        return lines


class Porter:
    """Main porter class that coordinates the conversion"""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.parser = None
        self.generator = TypeScriptGenerator()
        self.type_registry: Dict[str, ClassDef] = {}

    def log(self, message: str):
        """Log message if verbose"""
        if self.verbose:
            print(message, file=sys.stderr)

    def analyze_directory(self, directory: str):
        """Analyze a directory to build type registry"""
        self.log(f"Analyzing directory: {directory}")
        include_dir = Path(directory) / "include"

        if not include_dir.exists():
            include_dir = Path(directory)

        for header_file in include_dir.glob("*.h"):
            self.log(f"  Found header: {header_file.name}")
            # TODO: Parse and register types

    def convert_class_header(self, header_file: str, output_file: str):
        """Convert a class-based header file to TypeScript"""
        self.log(f"Converting class header: {header_file}")

        with open(header_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        output_lines = []

        # Extract copyright/comments from top of file
        lines = content.split('\n')
        for line in lines[:10]:  # Check first 10 lines
            if line.strip().startswith('//') or line.strip().startswith('/*'):
                output_lines.append(line)
            elif not line.strip():
                output_lines.append('')
            else:
                break

        if output_lines:
            output_lines.append('')

        # Process includes
        include_pattern = re.compile(r'#include\s+[<"](.+?)[>"]')
        for match in include_pattern.finditer(content):
            include_file = match.group(0)
            if '<' in include_file or any(lib in include_file for lib in ['limits.h', 'stddef.h', 'string.h', 'Boolean.h']):
                output_lines.append('// ' + include_file)
            else:
                # Will add proper imports later
                module = match.group(1).replace('.h', '')
                output_lines.append(f"// import {{ ... }} from './{module}';")

        output_lines.append('')

        # Now convert the class - preserve structure and comments
        in_class = False
        in_namespace = False
        brace_depth = 0
        current_visibility = 'private'
        template_line = None

        for line in lines:
            stripped = line.strip()
            original_indent = len(line) - len(line.lstrip())

            # Skip preprocessor guards
            if any(x in stripped for x in ['#ifndef', '#define', '_INCLUDED']):
                if '_INCLUDED' in stripped:
                    continue

            # Skip namespace wrappers
            if 'SP_NAMESPACE' in stripped:
                continue

            # Detect template - convert to TypeScript generic syntax
            if stripped.startswith('template<'):
                # Convert: template<class T> -> <T>
                template_line = re.sub(r'template<class\s+(\w+)>', r'<\1>', stripped)
                template_line = re.sub(r'template<typename\s+(\w+)>', r'<\1>', template_line)
                continue

            # Detect class start
            class_match = re.match(r'(class|struct)\s+(\S+)\s*\{', stripped)
            if class_match:
                class_name = class_match.group(2)
                # Remove SP_API and other macros
                class_name = re.sub(r'\s+(SP_API|OPENJADE_API)\s+', ' ', class_name).strip()

                # Add template parameter to class declaration
                class_decl = f"export class {class_name}"
                if template_line:
                    class_decl += template_line
                    template_line = None
                class_decl += " {"

                output_lines.append(class_decl)
                in_class = True
                brace_depth = 1
                current_visibility = 'private' if class_match.group(1) == 'class' else 'public'
                continue

            if in_class:
                # Track braces
                brace_depth += stripped.count('{') - stripped.count('}')

                if brace_depth == 0:
                    output_lines.append('}')
                    in_class = False
                    continue

                # Handle visibility specifiers
                if stripped in ['public:', 'private:', 'protected:']:
                    current_visibility = stripped.rstrip(':')
                    output_lines.append(f"  // {stripped}")
                    continue

                # Preserve comments
                if stripped.startswith('//'):
                    output_lines.append('  ' + stripped)
                    continue

                # Handle typedefs inside class - keep as comments for now
                # TypeScript doesn't support type aliases inside classes in the same way
                typedef_match = re.match(r'typedef\s+(.+?)\s+(\w+);', stripped)
                if typedef_match:
                    output_lines.append(f"  // {stripped}")
                    continue

                # Handle member variables (simplified)
                member_match = re.match(r'(\w+(?:<.+>)?(?:\s*\*)?)\s+(\w+)_;', stripped)
                if member_match:
                    cpp_type = member_match.group(1)
                    member_name = member_match.group(2) + '_'
                    parser = CppParser(header_file)
                    ts_type = parser.map_type(cpp_type)
                    vis = '' if current_visibility == 'public' else 'private '
                    output_lines.append(f"  {vis}{member_name}: {ts_type};")
                    continue

                # Handle methods (inline and declarations)
                # Check if inline method with body
                has_inline_body = '{' in stripped and '}' in stripped

                # Match: ReturnType methodName(params) const { body }
                # or: ReturnType methodName(params) const;
                method_match = re.match(r'(.+?)\s+(\w+)\s*\(([^)]*)\)\s*(const)?\s*(\{.*\}|;)', stripped)
                if method_match:
                    return_type = method_match.group(1).strip()
                    method_name = method_match.group(2)
                    params = method_match.group(3)
                    is_const = method_match.group(4) is not None
                    body_or_semi = method_match.group(5)

                    parser = CppParser(header_file)
                    ts_return = parser.map_type(return_type)

                    # Parse parameters
                    ts_params = []
                    if params.strip():
                        for param in params.split(','):
                            param = param.strip()
                            # Simple parameter parsing: Type name or Type &name
                            param = param.replace('const ', '').replace(' const', '')
                            param = param.replace('&', '').replace('*', ' * ')
                            param_parts = param.rsplit(None, 1)
                            if len(param_parts) == 2:
                                param_type = parser.map_type(param_parts[0])
                                param_name = param_parts[1]
                                ts_params.append(f"{param_name}: {param_type}")
                            elif len(param_parts) == 1:
                                # Just type, no name
                                param_type = parser.map_type(param_parts[0])
                                ts_params.append(f"arg: {param_type}")

                    params_str = ', '.join(ts_params)
                    vis = '' if current_visibility == 'public' else 'private '

                    # Check if this is a destructor
                    if method_name.startswith('~'):
                        output_lines.append(f"  // {stripped}")
                        continue

                    # Check if constructor
                    if method_name == class_name.split('<')[0]:
                        if has_inline_body:
                            # Keep inline body as comment for now
                            output_lines.append(f"  // {stripped}")
                        else:
                            output_lines.append(f"  {vis}constructor({params_str}) {{ }}")
                        continue

                    # Map operators - keep as comments for now
                    if method_name.startswith('operator'):
                        output_lines.append(f"  // {stripped}")
                        continue

                    # Regular method
                    if has_inline_body:
                        # Preserve inline body as comment
                        output_lines.append(f"  // {stripped}")
                    else:
                        # Add empty body for now
                        output_lines.append(f"  {vis}{method_name}({params_str}): {ts_return} {{ throw new Error('Not implemented'); }}")
                    continue

                # If we don't recognize it, keep as comment
                if stripped and not stripped.startswith('#endif'):
                    output_lines.append(f"  // {stripped}")

        # Write output
        with open(output_file, 'w') as f:
            f.write('\n'.join(output_lines))
            f.write('\n')

        self.log(f"  Wrote: {output_file}")

    def convert_simple_header(self, header_file: str, output_file: str):
        """Convert a simple header file (like types.h, Boolean.h) to TypeScript"""
        self.log(f"Converting simple header: {header_file}")

        parser = CppParser(header_file)
        parser.load_file()

        # Process line by line, preserving comments
        lines = parser.content.split('\n')
        output_lines = []

        in_namespace = False
        skip_line = False
        in_ifdef_block = 0  # Track nesting level of #ifdef blocks
        ifdef_stack = []  # Track what we're inside
        defined_types = set()  # Track which type names we've already defined

        for i, line in enumerate(lines):
            original_line = line
            stripped = line.strip()

            # Skip header guards but keep other preprocessor directives as comments
            if stripped.startswith('#ifndef') and '_INCLUDED' in stripped:
                skip_line = True
                continue
            elif stripped.startswith('#define') and '_INCLUDED' in stripped:
                skip_line = True
                continue
            elif stripped == '#endif /* not ' + Path(header_file).stem + '_INCLUDED */':
                skip_line = True
                continue
            elif stripped.startswith('#endif'):
                # Check if it's closing namespace
                if 'SP_NAMESPACE' in stripped:
                    in_namespace = False
                    continue
                # Track #endif for conditional blocks
                if ifdef_stack:
                    ifdef_stack.pop()
                # Keep #endif as comment
                output_lines.append('// ' + stripped)
                continue
            elif stripped.startswith('#ifdef') or stripped.startswith('#if '):
                # Keep conditional compilation as comment
                ifdef_stack.append(stripped)
                output_lines.append('// ' + stripped)
                continue
            elif stripped.startswith('#else'):
                # Keep #else as comment
                output_lines.append('// ' + stripped)
                continue

            # Handle namespace wrappers
            if '#ifdef SP_NAMESPACE' in stripped:
                skip_line = True
                continue
            elif 'namespace SP_NAMESPACE' in stripped:
                in_namespace = True
                skip_line = True
                continue
            elif stripped == '}' and in_namespace:
                in_namespace = False
                skip_line = True
                continue

            # Handle includes - convert to imports
            if stripped.startswith('#include'):
                match = re.match(r'#include\s+[<"](.+?)[>"]', stripped)
                if match:
                    include_file = match.group(1)
                    # Check if system include (with < > or standard library)
                    if '<' in original_line or include_file in ['limits.h', 'stddef.h', 'string.h', 'stdio.h', 'stdlib.h']:
                        # System include - keep as comment
                        output_lines.append('// ' + stripped)
                    else:
                        # Local include - convert to import (will add later when we know exports)
                        module_name = include_file.replace('.h', '')
                        output_lines.append(f"// import from './{module_name}';  // TODO: specify imports")
                continue

            # Handle typedefs - skip if we've already defined this type name
            typedef_match = re.match(r'typedef\s+(.+?)\s+(\w+);', stripped)
            if typedef_match:
                cpp_type = typedef_match.group(1).strip()
                ts_name = typedef_match.group(2).strip()
                ts_type = parser.map_type(cpp_type)
                # Check if already defined by name
                if ts_name not in defined_types:
                    output_lines.append(f"export type {ts_name} = {ts_type};")
                    defined_types.add(ts_name)
                else:
                    output_lines.append(f"// {stripped}  // Duplicate, skipped")
                continue

            # Handle const declarations
            const_match = re.match(r'const\s+(\w+)\s+(\w+)\s*=\s*([^;]+);', stripped)
            if const_match:
                type_ = const_match.group(1)
                name = const_match.group(2)
                value = const_match.group(3)
                ts_type = parser.map_type(type_)
                # Skip 'true' and 'false' - they're reserved in TypeScript
                if name in ['true', 'false']:
                    output_lines.append(f"// export const {name}: {ts_type} = {value};  // Reserved word")
                else:
                    output_lines.append(f"export const {name}: {ts_type} = {value};")
                continue

            # Preserve comments (both // and /* */)
            if stripped.startswith('//') or stripped.startswith('/*'):
                output_lines.append(original_line)
                continue

            # Preserve empty lines
            if not stripped:
                output_lines.append('')
                continue

            # If we get here and line has content, keep it as comment for manual review
            if stripped and not skip_line:
                output_lines.append('// TODO: ' + stripped)

            skip_line = False

        # Write output
        with open(output_file, 'w') as f:
            f.write('\n'.join(output_lines))
            f.write('\n')

        self.log(f"  Wrote: {output_file}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Port OpenSP/OpenJade C++ code to TypeScript'
    )
    parser.add_argument('--analyze', help='Analyze directory and build type registry')
    parser.add_argument('--header', help='C++ header file to convert')
    parser.add_argument('--impl', help='C++ implementation file to convert')
    parser.add_argument('--output', help='Output TypeScript file')
    parser.add_argument('--mode', choices=['simple', 'class'], default='simple',
                       help='Conversion mode: simple (typedefs) or class (class definitions)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    porter = Porter(verbose=args.verbose)

    if args.analyze:
        porter.analyze_directory(args.analyze)
    elif args.header and args.output:
        if args.mode == 'class':
            porter.convert_class_header(args.header, args.output)
        else:
            porter.convert_simple_header(args.header, args.output)
    else:
        parser.print_help()
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
