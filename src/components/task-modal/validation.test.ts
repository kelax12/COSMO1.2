import { describe, it, expect } from 'vitest';
import {
  computeValidationErrors,
  isFormValid,
  isStep1Valid,
  missingStep1Fields,
} from './validation';

describe('TaskModal validation', () => {
  describe('computeValidationErrors', () => {
    it('flags an empty name as required', () => {
      const errors = computeValidationErrors({ name: '   ', estimatedTime: '' });
      expect(errors.name).toBe('Le nom de la tâche est obligatoire');
    });

    it('flags a name shorter than 3 characters', () => {
      const errors = computeValidationErrors({ name: 'ab', estimatedTime: '' });
      expect(errors.name).toBe('Le nom doit contenir au moins 3 caractères');
    });

    it('flags a name longer than 100 characters', () => {
      const errors = computeValidationErrors({ name: 'x'.repeat(101), estimatedTime: '' });
      expect(errors.name).toBe('Le nom ne peut pas dépasser 100 caractères');
    });

    it('accepts a valid name with no errors', () => {
      const errors = computeValidationErrors({ name: 'Réviser maths', estimatedTime: '' });
      expect(errors).toEqual({});
    });

    it('does not validate an empty estimatedTime (optional)', () => {
      const errors = computeValidationErrors({ name: 'Valid name', estimatedTime: '' });
      expect(errors.estimatedTime).toBeUndefined();
    });

    it('rejects a negative estimatedTime', () => {
      const errors = computeValidationErrors({ name: 'Valid name', estimatedTime: -5 });
      expect(errors.estimatedTime).toBe('Le temps estimé ne peut pas être négatif');
    });

    it('rejects a non-numeric estimatedTime', () => {
      const errors = computeValidationErrors({ name: 'Valid name', estimatedTime: 'abc' });
      expect(errors.estimatedTime).toBe('Veuillez entrer un nombre valide');
    });

    it('accepts a positive numeric estimatedTime', () => {
      const errors = computeValidationErrors({ name: 'Valid name', estimatedTime: 30 });
      expect(errors.estimatedTime).toBeUndefined();
    });
  });

  describe('isFormValid', () => {
    it('is false for an empty name', () => {
      expect(isFormValid({ name: '' })).toBe(false);
    });

    it('is true for a 1-char name (only name length, untrimmed)', () => {
      expect(isFormValid({ name: 'a' })).toBe(true);
    });

    it('is false for a name longer than 100 characters', () => {
      expect(isFormValid({ name: 'x'.repeat(101) })).toBe(false);
    });
  });

  describe('isStep1Valid', () => {
    it('is false for a whitespace-only name (trimmed)', () => {
      expect(isStep1Valid({ name: '   ' })).toBe(false);
    });

    it('is true for a valid name', () => {
      expect(isStep1Valid({ name: 'Tâche' })).toBe(true);
    });
  });

  describe('missingStep1Fields', () => {
    it('reports name as missing when empty', () => {
      expect(missingStep1Fields({ name: '  ' })).toEqual(['name']);
    });

    it('reports nothing missing for a valid name', () => {
      expect(missingStep1Fields({ name: 'Tâche' })).toEqual([]);
    });
  });
});
