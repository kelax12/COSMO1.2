import { describe, it, expect } from 'vitest';
import { sanitizeEmail, isValidEmail, EMAIL_REGEX } from './email';

// Garde de sécurité/UX au chokepoint d'inscription & changement d'email.
// Couvre la sanitisation copier-coller (zero-width / espaces) et le rejet
// des domaines sans TLD qui bloquaient le flux Supabase (incident axelte@stcom).
describe('sanitizeEmail', () => {
  it('strips surrounding and inner whitespace', () => {
    expect(sanitizeEmail('  john@doe.com ')).toBe('john@doe.com');
    expect(sanitizeEmail('jo hn@doe.com')).toBe('john@doe.com');
  });

  it('strips zero-width characters (ZWSP/ZWNJ/ZWJ)', () => {
    expect(sanitizeEmail('john​@doe‌.com‍')).toBe('john@doe.com');
  });

  it('strips NBSP and BOM (covered by \\s)', () => {
    expect(sanitizeEmail('john @doe.com﻿')).toBe('john@doe.com');
  });

  it('is a no-op on a clean address', () => {
    expect(sanitizeEmail('john@doe.com')).toBe('john@doe.com');
  });
});

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('john@doe.com')).toBe(true);
    expect(isValidEmail('a.b+tag@sub.example.co.uk')).toBe(true);
  });

  it('accepts addresses that only need sanitisation', () => {
    expect(isValidEmail('  john@doe.com ')).toBe(true);
    expect(isValidEmail('john​@doe.com')).toBe(true);
  });

  it('rejects a domain without a TLD (Supabase email-change trap)', () => {
    expect(isValidEmail('user@stcom')).toBe(false);
  });

  it('rejects missing local part, missing @, or empty string', () => {
    expect(isValidEmail('@doe.com')).toBe(false);
    expect(isValidEmail('johndoe.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects addresses with internal spaces that survive as @ duplicates', () => {
    // After sanitisation "john@ex ample.com" -> "john@example.com" (valid),
    // but two @ must stay invalid.
    expect(isValidEmail('john@@doe.com')).toBe(false);
  });

  it('EMAIL_REGEX is anchored (no partial match)', () => {
    expect(EMAIL_REGEX.test('prefix john@doe.com suffix')).toBe(false);
  });
});
