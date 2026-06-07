import { describe, it, expect } from 'vitest';
import { isImageAvatar, isEmojiAvatar } from './avatar';

describe('isImageAvatar', () => {
  it.each([
    'https://cdn.example.com/a.png',
    'http://example.com/a.jpg',
    'data:image/jpeg;base64,/9j/4AAQ',
    'blob:https://app/uuid',
    '/relative/path.png',
    '  https://example.com/a.png  ', // trims
  ])('detects image source %j', (src) => {
    expect(isImageAvatar(src)).toBe(true);
  });

  it.each(['🦊', '👨‍💻', 'AB', '', null, undefined])(
    'rejects non-image %j',
    (src) => {
      expect(isImageAvatar(src as string | null | undefined)).toBe(false);
    }
  );

  it('does NOT treat a javascript: string as an image', () => {
    expect(isImageAvatar('javascript:alert(1)')).toBe(false);
  });
});

describe('isEmojiAvatar', () => {
  it('accepts short emoji', () => {
    expect(isEmojiAvatar('🦊')).toBe(true);
    expect(isEmojiAvatar('👤')).toBe(true);
  });

  it('accepts a composed emoji (>2 UTF-16 length, <=4 code points)', () => {
    expect('👨‍💻'.length).toBeGreaterThan(2); // sanity: surrogate pairs + ZWJ
    expect(isEmojiAvatar('👨‍💻')).toBe(true);
  });

  it('rejects long strings (likely a name/URL)', () => {
    expect(isEmojiAvatar('Alexandre')).toBe(false);
  });

  it('rejects image sources', () => {
    expect(isEmojiAvatar('https://x/a.png')).toBe(false);
    expect(isEmojiAvatar('data:image/png;base64,AAA')).toBe(false);
  });

  it('rejects empty / null / undefined without throwing', () => {
    // Regression: a wrong `avatar is string` predicate on isImageAvatar used
    // to narrow `avatar` to `never` and break this path.
    expect(isEmojiAvatar('')).toBe(false);
    expect(isEmojiAvatar(null)).toBe(false);
    expect(isEmojiAvatar(undefined)).toBe(false);
  });
});
