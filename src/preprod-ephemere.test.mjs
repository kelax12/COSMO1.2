// Témoin de CI-04 : la préprod éphémère de `schema-prod.yml` ne vaut preuve que si la
// base a été jugée identique à la prod AVANT la preuve, et si la cible reste locale.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { load } from 'js-yaml';
import { cible, planifier, REF_PROD } from '../supabase/proofs/preuve-preprod.mjs';

describe('préprod éphémère', () => {
  const etapes = load(readFileSync('.github/workflows/schema-prod.yml', 'utf8')).jobs['depot-egal-prod'].steps;
  const rang = (n) => etapes.findIndex((e) => e.name?.startsWith(n));
  const preuve = etapes[rang('Preuve sur la preproduction')];

  it('TEMOIN : main seul, preuve APRES la comparaison a la prod, sans secret, sur le Postgres local', () => {
    expect(etapes[0].run).toContain('refs/heads/main');
    expect(rang('Preuve sur la preproduction')).toBeGreaterThan(rang('Comparer la base rejouee'));
    expect(JSON.stringify(preuve)).not.toMatch(/secrets\./);
    expect(preuve.env.SUPABASE_PREPROD_DB_URL).toMatch(/@127\.0\.0\.1:/);
    expect(preuve.run).toContain('--schema-rejoue');
  });

  it('la cible refuse une URL absente ou celle de la prod', () => {
    expect(() => cible({})).toThrow(/absent/);
    expect(() => cible({ SUPABASE_PREPROD_DB_URL: `postgresql://x@db.${REF_PROD}.supabase.co/postgres` })).toThrow(/production/);
  });

  it('--schema-rejoue inscrit le ledger sans rien rejouer ; sans lui, rejoue les migrations avant la preuve', () => {
    const tous = ['250_a.sql', '254_c.sql'];
    expect(planifier({ tous, faits: new Set(), debut: 253, schemaRejoue: true }).aAppliquer).toEqual([]);
    expect(planifier({ tous, faits: new Set(), debut: 253, schemaRejoue: false }).aAppliquer).toEqual(['250_a.sql']);
  });
});
