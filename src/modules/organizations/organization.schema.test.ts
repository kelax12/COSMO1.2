import { describe, it, expect } from 'vitest';
import { createOrganizationSchema, joinCodeSchema, JOIN_CODE_REGEX } from './organization.schema';
import { safeValidate } from '@/lib/validation/validate';

describe('createOrganizationSchema', () => {
  it('accepte un nom valide', () => {
    expect(safeValidate(createOrganizationSchema, { name: 'Nova Studio' }).success).toBe(true);
  });

  it('trim le nom', () => {
    const res = safeValidate(createOrganizationSchema, { name: '  Acme  ' });
    expect(res.success && res.data.name).toBe('Acme');
  });

  it('rejette un nom trop court', () => {
    expect(safeValidate(createOrganizationSchema, { name: 'A' }).success).toBe(false);
  });

  it('rejette un nom > 80 caractères', () => {
    expect(safeValidate(createOrganizationSchema, { name: 'x'.repeat(81) }).success).toBe(false);
  });
});

describe('joinCodeSchema', () => {
  it('accepte un code valide et le met en majuscules', () => {
    const res = safeValidate(joinCodeSchema, { code: 'cosmo-x7k2c9' });
    expect(res.success && res.data.code).toBe('COSMO-X7K2C9');
  });

  it('accepte un code déjà en majuscules avec espaces', () => {
    // Le trim est appliqué avant transform.
    const res = safeValidate(joinCodeSchema, { code: ' COSMO-ABCDEF ' });
    expect(res.success && res.data.code).toBe('COSMO-ABCDEF');
  });

  it('rejette un préfixe absent', () => {
    expect(safeValidate(joinCodeSchema, { code: 'X7K2C9' }).success).toBe(false);
  });

  it('rejette les caractères ambigus (0, O, 1, I, L)', () => {
    for (const c of ['COSMO-0BCDEF', 'COSMO-OBCDEF', 'COSMO-1BCDEF', 'COSMO-IBCDEF', 'COSMO-LBCDEF']) {
      expect(JOIN_CODE_REGEX.test(c)).toBe(false);
    }
  });

  it('rejette une longueur incorrecte', () => {
    expect(safeValidate(joinCodeSchema, { code: 'COSMO-ABC' }).success).toBe(false);
    expect(safeValidate(joinCodeSchema, { code: 'COSMO-ABCDEFG' }).success).toBe(false);
  });
});
