// Copyright (c) 1996 James Clark
// See the file COPYING for copying permission.

// Platform-specific character and string utilities
// In TypeScript, these map directly to native string/character operations

export type SP_TCHAR = string;
export type SP_TUCHAR = string;

export function tgetenv(s: string): string | undefined {
  return process.env[s];
}

export function tcscmp(s1: string, s2: string): number {
  if (s1 < s2) return -1;
  if (s1 > s2) return 1;
  return 0;
}

export function tcsncmp(s1: string, s2: string, n: number): number {
  const sub1 = s1.substring(0, n);
  const sub2 = s2.substring(0, n);
  return tcscmp(sub1, sub2);
}

export function tcstoul(s: string, base: number = 10): number {
  return parseInt(s, base) >>> 0; // unsigned
}

export function tcschr(s: string, c: string): number {
  return s.indexOf(c);
}

export function tcslen(s: string): number {
  return s.length;
}

export function totupper(c: number): number {
  return String.fromCharCode(c).toUpperCase().charCodeAt(0);
}

export function istalnum(c: number): boolean {
  const ch = String.fromCharCode(c);
  return /[a-zA-Z0-9]/.test(ch);
}
