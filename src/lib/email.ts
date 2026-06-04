// ═══════════════════════════════════════════════════════════════════
// Email helpers — single source of truth for format validation and
// copy-paste sanitisation across auth (signup), settings (email change)
// and sharing flows.
//
// Why a stricter regex than the browser's `type="email"`: HTML5 validation
// and Supabase signup both ACCEPT malformed domains without a TLD
// (e.g. "user@stcom"). Such an account then gets stuck — Supabase's secure
// email-change flow rejects the (invalid) current email, so the user can
// never fix it from the app. Validating here at the chokepoint prevents
// these accounts from ever being created. (cf. axelte@stcom incident.)
// ═══════════════════════════════════════════════════════════════════

// Pragmatic format check (not RFC-exhaustive on purpose): non-space/@ local
// part, non-space/@ domain, and at least one dot followed by a TLD.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Strips whitespace and zero-width characters (ZWSP/ZWNJ/ZWJ U+200B–U+200D)
// that copy-pasting from contact cards / mail clients often injects. In JS
// `\s` already covers NBSP (U+00A0) and BOM (U+FEFF). An email never
// legitimately contains any whitespace, so removing all of it is safe.
const ZERO_WIDTH = new RegExp('[\\s\\u200B-\\u200D]', 'g');

export function sanitizeEmail(raw: string): string {
  return raw.replace(ZERO_WIDTH, '');
}

export function isValidEmail(raw: string): boolean {
  return EMAIL_REGEX.test(sanitizeEmail(raw));
}
