import { describe, it, expect } from 'vitest';
import { assertValidCursor } from './pagination.types';

const UUID = '3f9a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b';

describe('assertValidCursor', () => {
  it('accepte un UUID + ISO valides', () => {
    expect(() => assertValidCursor(UUID, '2026-06-10T12:00:00.000Z')).not.toThrow();
  });

  it('accepte une date ISO sans millisecondes ni Z', () => {
    expect(() => assertValidCursor(UUID, '2026-06-10T12:00:00')).not.toThrow();
  });

  it('accepte un offset de fuseau horaire', () => {
    expect(() => assertValidCursor(UUID, '2026-06-10T12:00:00+02:00')).not.toThrow();
  });

  it('rejette un cursor non-UUID', () => {
    expect(() => assertValidCursor('not-a-uuid', '2026-06-10T12:00:00.000Z')).toThrow();
  });

  it('rejette une tentative d’injection PostgREST dans le cursor', () => {
    expect(() =>
      assertValidCursor(`${UUID},id.gt.0`, '2026-06-10T12:00:00.000Z'),
    ).toThrow('Invalid pagination cursor');
  });

  it('rejette une date non ISO', () => {
    expect(() => assertValidCursor(UUID, '10/06/2026')).toThrow();
  });

  it('rejette une injection dans cursorDate', () => {
    expect(() =>
      assertValidCursor(UUID, '2026-06-10T12:00:00.000Z,created_at.is.null'),
    ).toThrow();
  });

  it('rejette des chaînes vides', () => {
    expect(() => assertValidCursor('', '')).toThrow();
  });
});
