// ═══════════════════════════════════════════════════════════════════
// check-secrets-age.guard.test.mjs · LE TEMOIN DE LA GARDE D'AGE (AM-3)
//
// Chaque cas soumet a `evaluer()` / `run()` une situation qu'elle DOIT
// refuser, et echoue si elle repond « vert ». Le cas de reference (tout
// conforme) pose le plancher : sans lui, une garde qui echoue toujours
// passerait tous les autres.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evaluer, validerRegistre, nomsDeLExemple, dateEffective,
  lireGithub, lireSupabase, lireVercel, run,
} from './check-secrets-age.mjs';

const MAINTENANT = new Date('2026-10-23T12:00:00Z');
const il = (jours) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

const entree = (o) => ({ name: 'A_KEY', store: 'github', kind: 'secret', owner: 'Axel', criticality: 'high', maxAgeDays: 100, lastRotated: null, ...o });
const registre = (...entries) => ({ entries });
const vivant = (o = {}) => ({
  github: new Map(), 'supabase-edge': new Map(), vercel: new Map(), ...o,
});
const ex = new Set();
const regPublic = (...noms) => noms.map((name) => entree({ name, store: 'public', kind: 'config', maxAgeDays: null }));

const evalue = (reg, viv, exemple = ex) => evaluer({ registre: reg, vivant: viv, exemple, maintenant: MAINTENANT });

describe('check-secrets-age · plancher', () => {
  it('un secret dans son echeance et inscrit passe', () => {
    const r = evalue(registre(entree({})), vivant({ github: new Map([['A_KEY', il(10)]]) }));
    expect(r.erreurs).toEqual([]);
    expect(r.lignes[0].age).toBe(10);
  });
});

describe('check-secrets-age · ce que la garde DOIT refuser', () => {
  it('un secret plus vieux que son echeance echoue', () => {
    const r = evalue(registre(entree({})), vivant({ github: new Map([['A_KEY', il(101)]]) }));
    expect(r.erreurs.join('\n')).toMatch(/101 j pour une echeance de 100 j/);
  });

  it('a l\'echeance exacte, passe ; un jour de plus, echoue (pas de decalage)', () => {
    expect(evalue(registre(entree({})), vivant({ github: new Map([['A_KEY', il(100)]]) })).erreurs).toEqual([]);
    expect(evalue(registre(entree({})), vivant({ github: new Map([['A_KEY', il(101)]]) })).erreurs).not.toEqual([]);
  });

  it('date inconnue = echue (ni date vivante ni lastRotated)', () => {
    const r = evalue(registre(entree({})), vivant({ github: new Map([['A_KEY', null]]) }));
    expect(r.erreurs.join('\n')).toMatch(/INCONNUE, donc echue/);
  });

  it('un secret vivant sans entree au registre echoue', () => {
    const r = evalue(registre(entree({})), vivant({ github: new Map([['A_KEY', il(1)], ['ORPHELIN', il(1)]]) }));
    expect(r.erreurs.join('\n')).toMatch(/github\/ORPHELIN : existe sans entree/);
  });

  it('une entree sans secret vivant echoue (l\'inverse)', () => {
    const r = evalue(registre(entree({})), vivant());
    expect(r.erreurs.join('\n')).toMatch(/github\/A_KEY : au registre mais absent/);
  });

  it('une source non lue est un echec, jamais un saut', () => {
    const r = evalue(registre(entree({})), vivant({ vercel: null }));
    expect(r.erreurs.join('\n')).toMatch(/vercel : source non lue/);
  });

  it('un nom de .env.example sans entree echoue, et l\'inverse', () => {
    const reg = registre(entree({}), ...regPublic('PUB_A'));
    const viv = vivant({ github: new Map([['A_KEY', il(1)]]) });
    expect(evalue(reg, viv, new Set(['PUB_A', 'PUB_B'])).erreurs.join('\n')).toMatch(/public\/PUB_B : dans \.env\.example/);
    expect(evalue(reg, viv, new Set()).erreurs.join('\n')).toMatch(/public\/PUB_A : au registre mais absent/);
  });

  it('une config (identifiant) n\'a pas d\'age mais son existence est verifiee', () => {
    const reg = registre(entree({ name: 'ID', kind: 'config', maxAgeDays: null }));
    expect(evalue(reg, vivant({ github: new Map([['ID', il(5000)]]) })).erreurs).toEqual([]);
    expect(evalue(reg, vivant()).erreurs.join('\n')).toMatch(/absent de github/);
  });

  it('les SUPABASE_* injectes par la plateforme ne sont pas des orphelins', () => {
    const viv = vivant({ 'supabase-edge': new Map([['SUPABASE_URL', null]]) });
    expect(evalue(registre(), viv).erreurs.join('\n')).not.toMatch(/SUPABASE_URL/);
  });
});

describe('check-secrets-age · la date', () => {
  it('lastRotated plus recent que la date vivante l\'emporte', () => {
    const d = dateEffective(entree({ lastRotated: '2026-10-20' }), il(400));
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-20');
  });
  it('lastRotated seul suffit quand l\'API ne donne pas de date', () => {
    const r = evalue(registre(entree({ store: 'supabase-edge', lastRotated: il(5).slice(0, 10) })),
      vivant({ 'supabase-edge': new Map([['A_KEY', null]]) }));
    expect(r.erreurs).toEqual([]);
  });
});

describe('check-secrets-age · le registre', () => {
  it('refuse un secret sans echeance, un doublon, un store inconnu, une date mal formee', () => {
    expect(validerRegistre(registre(entree({ maxAgeDays: null }))).join()).toMatch(/echeance/);
    expect(validerRegistre(registre(entree({}), entree({}))).join()).toMatch(/double/);
    expect(validerRegistre(registre(entree({ store: 'ailleurs' }))).join()).toMatch(/store inconnu/);
    expect(validerRegistre(registre(entree({ lastRotated: '23/10/2026' }))).join()).toMatch(/AAAA-MM-JJ/);
    expect(validerRegistre({}).length).toBe(1);
  });

  it('le registre commite est bien forme et ne contient aucune valeur', () => {
    const brut = readFileSync(resolve(process.cwd(), '.github/secrets-registry.json'), 'utf8');
    const reg = JSON.parse(brut);
    expect(validerRegistre(reg)).toEqual([]);
    expect(brut).not.toMatch(/sk_(live|test)_|whsec_|sbp_|eyJ[A-Za-z0-9]{10}|https?:\/\/[^"]*hooks/);
  });

  it('chaque nom de .env.example est inscrit sous `public`', () => {
    const reg = JSON.parse(readFileSync(resolve(process.cwd(), '.github/secrets-registry.json'), 'utf8'));
    const noms = nomsDeLExemple(readFileSync(resolve(process.cwd(), '.env.example'), 'utf8'));
    const inscrits = new Set(reg.entries.filter((e) => e.store === 'public').map((e) => e.name));
    expect([...noms].filter((n) => !inscrits.has(n))).toEqual([]);
  });
});

describe('check-secrets-age · les lecteurs ne gardent aucune valeur', () => {
  it('GitHub, Supabase et Vercel rendent { nom -> date } et rien d\'autre', () => {
    const g = lireGithub({ secrets: [{ name: 'A', value: 'SECRET', updated_at: 't' }] });
    const s = lireSupabase([{ name: 'B', value: 'HASH', updated_at: 'u' }]);
    const v = lireVercel({ envs: [{ key: 'C', value: 'SECRET', updatedAt: 0 }, { key: 'C', updatedAt: 86_400_000 }] });
    expect([...g]).toEqual([['A', 't']]);
    expect([...s]).toEqual([['B', 'u']]);
    expect(v.get('C')).toBe('1970-01-01T00:00:00.000Z'); // la plus ancienne
    expect(JSON.stringify([...g, ...s, ...v])).not.toMatch(/SECRET|HASH/);
  });
  it('une reponse de forme inattendue leve au lieu de rendre une liste vide', () => {
    expect(() => lireGithub({})).toThrow();
    expect(() => lireSupabase({})).toThrow();
    expect(() => lireVercel({})).toThrow();
  });
});

describe('check-secrets-age · jeton absent = exit 1', () => {
  it('sans aucun jeton, run() sort en 1 et nomme chaque source', async () => {
    const r = await run({}, MAINTENANT);
    expect(r.exit).toBe(1);
    const t = r.erreurs.join('\n');
    expect(t).toMatch(/github : GH_TOKEN/);
    expect(t).toMatch(/supabase-edge : SUPABASE_ACCESS_TOKEN/);
    expect(t).toMatch(/vercel : VERCEL_TOKEN/);
  });
});
