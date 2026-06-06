import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateOrThrow, safeValidate, ValidationError } from './validate';

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  age: z.number().min(0, 'Âge négatif'),
});

describe('validateOrThrow', () => {
  it('renvoie la donnée parsée quand valide', () => {
    expect(validateOrThrow(schema, { name: 'a', age: 1 })).toEqual({ name: 'a', age: 1 });
  });

  it('lève une ValidationError avec message FR du premier problème', () => {
    expect(() => validateOrThrow(schema, { name: '', age: 1 })).toThrow(ValidationError);
    try {
      validateOrThrow(schema, { name: '', age: 1 });
    } catch (e) {
      expect((e as ValidationError).message).toBe('Nom requis');
      expect((e as ValidationError).fieldErrors).toEqual({ name: 'Nom requis' });
    }
  });

  it('agrège les erreurs par champ', () => {
    try {
      validateOrThrow(schema, { name: '', age: -2 });
    } catch (e) {
      const err = e as ValidationError;
      expect(err.fieldErrors).toEqual({ name: 'Nom requis', age: 'Âge négatif' });
    }
  });
});

describe('safeValidate', () => {
  it('success: true avec data', () => {
    const r = safeValidate(schema, { name: 'x', age: 3 });
    expect(r).toEqual({ success: true, data: { name: 'x', age: 3 } });
  });

  it('success: false avec fieldErrors', () => {
    const r = safeValidate(schema, { name: '', age: 3 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.fieldErrors.name).toBe('Nom requis');
  });
});
