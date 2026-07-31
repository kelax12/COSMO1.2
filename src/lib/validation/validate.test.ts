import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateOrThrow, safeValidate, ValidationError } from './validate';
import { createTaskSchema } from '@/modules/tasks/task.schema';
import frErrors from '@/locales/fr/errors.json';

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  age: z.number().min(0, 'Âge négatif'),
});

// ──────────────────────────────────────────────────────────────────
// Traduction des messages de schéma
//
// Les schémas zod portent des CLÉS (`validation.task.nameRequired`) parce que
// ce sont des constantes évaluées à l'import : y appeler `t()` figerait la
// langue pour toute la session. Sans la traduction faite ici, l'utilisateur
// verrait la clé brute dans un toast — un bug très visible et très gênant.
// ──────────────────────────────────────────────────────────────────
describe('traduction des clés de validation', () => {
  const validTask = {
    name: 'Faire les courses',
    priority: 3,
    category: 'cat-1',
    deadline: '2026-06-10',
    estimatedTime: 30,
    bookmarked: false,
    completed: false,
  };

  it('rend le message traduit, jamais la clé', () => {
    const result = safeValidate(createTaskSchema, { ...validTask, name: '   ' });
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.message).toBe(frErrors.validation.task.nameRequired);
    expect(result.message).not.toContain('validation.');
    expect(result.fieldErrors.name).toBe(frErrors.validation.task.nameRequired);
  });

  it('traduit aussi les messages levés par validateOrThrow', () => {
    try {
      validateOrThrow(createTaskSchema, { ...validTask, priority: 9 });
      throw new Error('aurait dû lever');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).message).toBe(frErrors.validation.task.priorityRange);
    }
  });

  it('laisse passer les messages internes de zod', () => {
    // Ils ne commencent pas par `validation.` : c'est ce qui permet de
    // convertir les schémas progressivement sans casser les autres.
    const internal = z.object({ n: z.number() });
    const result = safeValidate(internal, { n: 'pas un nombre' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).not.toContain('validation.');
  });
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
