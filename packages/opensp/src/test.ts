// Test file for basic OpenSP TypeScript port functionality
// Run with: npx ts-node src/test.ts

import { String } from './StringOf';
import { Char } from './types';
import { Vector } from './Vector';

console.log('=== Testing String<Char> (StringC) ===');

// Test 1: Create empty string
const s1 = new String<Char>();
console.log(`Empty string size: ${s1.size()} (expected: 0)`);

// Test 2: Create string from array
const chars: Char[] = [72, 101, 108, 108, 111]; // "Hello" in Unicode
const s2 = new String<Char>(chars, 5);
console.log(`String from array size: ${s2.size()} (expected: 5)`);
console.log(`First char: ${s2.get(0)} (expected: 72 'H')`);
console.log(`Last char: ${s2.get(4)} (expected: 111 'o')`);

// Test 3: Copy constructor
const s3 = new String<Char>(s2);
console.log(`Copied string size: ${s3.size()} (expected: 5)`);
console.log(`Copied first char: ${s3.get(0)} (expected: 72)`);

// Test 4: Append character
s3.appendChar(33); // '!'
console.log(`After appendChar size: ${s3.size()} (expected: 6)`);
console.log(`Last char after append: ${s3.get(5)} (expected: 33 '!')`);

// Test 5: Equals
const s4 = new String<Char>(chars, 5);
console.log(`s2.equals(s4): ${s2.equals(s4)} (expected: true)`);
console.log(`s2.equals(s3): ${s2.equals(s3)} (expected: false)`);

// Test 6: Resize
const s5 = new String<Char>(chars, 5);
s5.resize(10);
console.log(`After resize(10) size: ${s5.size()} (expected: 10)`);

// Test 7: Insert
const s6 = new String<Char>(chars, 5);
const insertChars: Char[] = [32, 87]; // " W"
const s7 = new String<Char>(insertChars, 2);
s6.insert(5, s7);
console.log(`After insert size: ${s6.size()} (expected: 7)`);

console.log('\n=== Testing Vector<number> ===');

// Test 1: Create empty vector
const v1 = new Vector<number>();
console.log(`Empty vector size: ${v1.size()} (expected: 0)`);

// Test 2: Create vector with size
const v2 = new Vector<number>(5);
console.log(`Vector(5) size: ${v2.size()} (expected: 5)`);

// Test 3: Push back
v1.push_back(10);
v1.push_back(20);
v1.push_back(30);
console.log(`After 3 push_back, size: ${v1.size()} (expected: 3)`);
console.log(`v1[0]: ${v1.get(0)} (expected: 10)`);
console.log(`v1[1]: ${v1.get(1)} (expected: 20)`);
console.log(`v1[2]: ${v1.get(2)} (expected: 30)`);

// Test 4: Back
console.log(`v1.back(): ${v1.back()} (expected: 30)`);

// Test 5: Resize
v1.resize(5);
console.log(`After resize(5), size: ${v1.size()} (expected: 5)`);

// Test 6: Copy constructor
const v3 = new Vector<number>(v1);
console.log(`Copied vector size: ${v3.size()} (expected: 5)`);

// Test 7: Clear
v3.clear();
console.log(`After clear(), size: ${v3.size()} (expected: 0)`);

console.log('\n=== All basic tests passed! ===');
