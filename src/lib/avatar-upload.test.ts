import { describe, it, expect } from 'vitest';
import {
  validateAvatarFile, computeAvatarDimensions, AVATAR_MAX_BYTES,
} from './avatar-upload';

describe('validateAvatarFile (faille V5)', () => {
  it('accepts the whitelisted raster formats under the size cap', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(validateAvatarFile({ type, size: 1000 })).toEqual({ ok: true });
    }
  });

  it('REJECTS image/svg+xml (peut embarquer du JS) et tout type hors whitelist', () => {
    expect(validateAvatarFile({ type: 'image/svg+xml', size: 10 })).toEqual({ ok: false, reason: 'type' });
    expect(validateAvatarFile({ type: 'text/html', size: 10 })).toEqual({ ok: false, reason: 'type' });
    expect(validateAvatarFile({ type: '', size: 10 })).toEqual({ ok: false, reason: 'type' });
  });

  it('rejects files over 500 Ko (boundary exacte)', () => {
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES })).toEqual({ ok: true });
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toEqual({ ok: false, reason: 'size' });
  });
});

describe('computeAvatarDimensions', () => {
  it('downscales proportionally to fit 256 on the longest edge', () => {
    expect(computeAvatarDimensions(1024, 512)).toEqual({ width: 256, height: 128 });
    expect(computeAvatarDimensions(512, 1024)).toEqual({ width: 128, height: 256 });
  });

  it('never upscales small images (scale capped at 1)', () => {
    expect(computeAvatarDimensions(100, 50)).toEqual({ width: 100, height: 50 });
  });

  it('rounds to integer pixel dimensions', () => {
    const { width, height } = computeAvatarDimensions(333, 777);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(height).toBe(256);
  });
});
