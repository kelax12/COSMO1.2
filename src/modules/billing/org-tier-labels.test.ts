// Noms des paliers entreprise. Verrouille : une clé `common.orgTier.*` par
// palier de la grille, rien de plus, et chacune traduite en fr ET en en.
import { describe, it, expect } from 'vitest';
import frCommon from '@/locales/fr/common.json';
import enCommon from '@/locales/en/common.json';
import { ORG_TIER_LABEL_KEYS } from './org-tier-labels';
import { ENTERPRISE_PRICING_TIERS } from './premium-config';

function lookup(catalog: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    catalog,
  );
}

describe('ORG_TIER_LABEL_KEYS', () => {
  it('couvre exactement les paliers de la grille', () => {
    expect(Object.keys(ORG_TIER_LABEL_KEYS).sort()).toEqual(ENTERPRISE_PRICING_TIERS.map((t) => t.key).sort());
  });

  it('chaque palier pointe vers common.orgTier.<clé>', () => {
    for (const [tier, key] of Object.entries(ORG_TIER_LABEL_KEYS)) {
      expect(key).toBe(`orgTier.${tier}`);
    }
  });

  it.each([
    ['fr', frCommon],
    ['en', enCommon],
  ])('chaque libellé existe et n’est pas vide en %s', (_locale, catalog) => {
    for (const key of Object.values(ORG_TIER_LABEL_KEYS)) {
      const label = lookup(catalog, key);
      expect(typeof label, key).toBe('string');
      expect((label as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it('deux paliers ne portent jamais le même nom', () => {
    for (const catalog of [frCommon, enCommon]) {
      const labels = Object.values(ORG_TIER_LABEL_KEYS).map((k) => lookup(catalog, k));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});
