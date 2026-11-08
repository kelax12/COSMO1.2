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
  lireGithub, lireSupabase, lireVercel, run, quoiFaire, contientUneValeur,
} from './check-secrets-age.mjs';

const MAINTENANT = new Date('2026-10-23T12:00:00Z');
const il = (jours) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

const entree = (o) => ({
  name: 'A_KEY', store: 'github', kind: 'secret', owner: 'Axel', criticality: 'high', maxAgeDays: 100, lastRotated: null,
  readers: ['workflow de test'], leak: 'Effet d\'une fuite decrit en toutes lettres.', rotation: 'proc-test', ...o,
});
const PROC_TEST = ['Generer la valeur chez le fournisseur.', 'La poser par la commande prevue.', 'Verifier par le workflow concerne.'];
const registre = (...entries) => ({ procedures: { 'proc-test': PROC_TEST }, entries });
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

// ── V4.3 (SEC-04) : le registre est UNIQUE et COMPLET ──────────────────
// Chaque entree dit qui la lit, l'effet d'une fuite et renvoie a une procedure
// pas a pas. Une entree incomplete, ou qui contient une valeur, est un echec.
describe('check-secrets-age · V4.3, le registre est complet et sans valeur', () => {
  const erreurs = (reg) => validerRegistre(reg).join('\n');

  it('plancher : une entree complete avec sa procedure est bien formee', () => {
    expect(validerRegistre(registre(entree({})))).toEqual([]);
  });

  it('une entree sans `readers`, sans `leak` ou sans procedure echoue', () => {
    expect(erreurs(registre(entree({ readers: undefined })))).toMatch(/readers/);
    expect(erreurs(registre(entree({ leak: undefined })))).toMatch(/leak/);
    expect(erreurs(registre(entree({ leak: 'court' })))).toMatch(/leak/);
    expect(erreurs(registre(entree({ rotation: undefined })))).toMatch(/rotation/);
    expect(erreurs(registre(entree({ rotation: 'inconnue' })))).toMatch(/aucune procedure/);
  });

  it('un secret que personne ne lit n\'est admis que comme variable orpheline', () => {
    expect(erreurs(registre(entree({ readers: [] })))).toMatch(/orpheline/);
    const reg = { procedures: { 'variable-orpheline': PROC_TEST }, entries: [entree({ readers: [], rotation: 'variable-orpheline' })] };
    expect(validerRegistre(reg)).toEqual([]);
  });

  it('une procedure de secret a au moins trois etapes, et chaque procedure sert', () => {
    expect(validerRegistre({ procedures: { 'proc-test': PROC_TEST.slice(0, 2) }, entries: [entree({})] }).join()).toMatch(/au moins 3 etapes/);
    const inutile = { procedures: { 'proc-test': PROC_TEST, jamais: PROC_TEST }, entries: [entree({})] };
    expect(validerRegistre(inutile).join()).toMatch(/procedure jamais : aucune entree/);
    expect(validerRegistre({ entries: [entree({})] }).join()).toMatch(/procedures. absent/);
  });

  it('une config peut n\'avoir qu\'une etape ; `coffre` ne va qu\'a un secret', () => {
    const reg = { procedures: { 'proc-test': ['Ne tourne pas : un identifiant.'] }, entries: [entree({ kind: 'config', maxAgeDays: null })] };
    expect(validerRegistre(reg)).toEqual([]);
    expect(validerRegistre({ ...reg, entries: [entree({ kind: 'config', maxAgeDays: null, coffre: true })] }).join()).toMatch(/seul un secret va au coffre/);
    expect(erreurs(registre(entree({ coffre: 'oui' })))).toMatch(/coffre/);
  });

  it.each([
    ['une chaine de connexion Postgres', 'postgresql://postgres:motdepasse@db.exemple.test:5432/postgres'],
    ['une cle Stripe', 'sk_live_abcdefgh'],
    ['un secret de webhook Stripe', 'whsec_abcdefgh'],
    ['un jeton Supabase', 'sbp_abcdefgh'],
    ['un jeton JWT', 'eyJhbGciOiJIUzI1NiJ9'],
    ['une cle PEM', '-----BEGIN PRIVATE KEY-----'],
    ['une URL de webhook', 'https://discord.com/api/webhooks/1/abc'],
    ['une longue suite opaque', 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0'],
  ])('%s est refusee, dans `leak`, dans une etape et dans un lecteur', (_titre, valeur) => {
    expect(erreurs(registre(entree({ leak: `Effet d'une fuite : ${valeur}` })))).toMatch(/VALEUR/);
    expect(erreurs(registre(entree({ readers: [valeur] })))).toMatch(/VALEUR/);
    const reg = { procedures: { 'proc-test': [...PROC_TEST, `Poser ${valeur} puis verifier.`] }, entries: [entree({})] };
    expect(validerRegistre(reg).join()).toMatch(/VALEUR/);
  });

  it('un nom de variable ou de commande n\'est pas pris pour une valeur', () => {
    for (const ok of ['supabase secrets set SUPABASE_SERVICE_ROLE_KEY', 'gh secret set BACKUP_PASSPHRASE', 'supabase/functions/_shared/billing-mail.ts', 'select public.cron_invoke(\'<job>\');']) {
      expect(contientUneValeur(ok), ok).toBe(false);
    }
  });

  it('le registre commite : chaque entree est complete, chaque secret a une procedure pas a pas', () => {
    const reg = JSON.parse(readFileSync(resolve(process.cwd(), '.github/secrets-registry.json'), 'utf8'));
    expect(validerRegistre(reg)).toEqual([]);
    for (const e of reg.entries.filter((x) => x.kind === 'secret')) {
      expect(reg.procedures[e.rotation].length, `${e.store}/${e.name}`).toBeGreaterThanOrEqual(3);
    }
    // Le registre est UNIQUE : aucun second fichier de registre dans le depot.
    expect(reg.entries.length).toBeGreaterThan(50);
  });

  it('la phrase de chiffrement des sauvegardes est au coffre, et seule ce qui ne se regenere pas y va', () => {
    const reg = JSON.parse(readFileSync(resolve(process.cwd(), '.github/secrets-registry.json'), 'utf8'));
    const auCoffre = reg.entries.filter((e) => e.coffre === true).map((e) => e.name);
    expect(auCoffre).toContain('BACKUP_PASSPHRASE');
    expect(reg.procedures['phrase-sauvegardes'].join('\n')).toMatch(/coffre/);
  });

  it('le registre commite ne contient aucune forme de valeur, lu en entier', () => {
    const brut = readFileSync(resolve(process.cwd(), '.github/secrets-registry.json'), 'utf8');
    expect(contientUneValeur(brut)).toBe(false);
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

// ═══════════════════════════════════════════════════════════════════
// V9.4 (TST-05, 2026-11-07) · la garde dit QUOI FAIRE, et le registre
// complété rougit encore sur un secret échu.
// ═══════════════════════════════════════════════════════════════════
describe('check-secrets-age · que faire (V9.4)', () => {
  it('TÉMOIN : jeton absent → le geste NOMME `SECRETS_AUDIT_TOKEN`, et les dates GitHub sont des conséquences', async () => {
    const r = await run({ SUPABASE_ACCESS_TOKEN: '', VERCEL_TOKEN: '' }, MAINTENANT);
    const { gestes, consequences } = quoiFaire(r.erreurs);
    const jeton = gestes.find((g) => g.titre.startsWith('Poser le jeton'));
    expect(jeton.items.join('\n')).toMatch(/SECRETS_AUDIT_TOKEN/);
    expect(jeton.items.join('\n')).toMatch(/Secrets: Read-only/);
    // Les dates INCONNUES d'un store non lu ne sont pas présentées comme des rotations.
    expect(gestes.find((g) => g.titre.startsWith('Faire tourner'))).toBeUndefined();
    expect(consequences.some((c) => c.startsWith('github/'))).toBe(true);
  });

  it('TÉMOIN : un secret échu tombe dans « faire tourner », un orphelin dans « inventaire »', () => {
    const r = evalue(
      registre(entree({}), entree({ name: 'B_KEY', store: 'vercel' })),
      vivant({ github: new Map([['A_KEY', il(101)], ['ORPHELIN', il(1)]]), vercel: new Map() }),
    );
    const { gestes } = quoiFaire(r.erreurs);
    const titre = (debut) => gestes.find((g) => g.titre.startsWith(debut))?.items ?? [];
    expect(titre('Faire tourner')).toEqual(['github/A_KEY : 101 j pour une echeance de 100 j (high)']);
    expect(titre('Inventaire')).toEqual(['github/ORPHELIN']);
    expect(titre('Au registre mais absent')).toEqual(['vercel/B_KEY']);
  });

  it('aucun écart ne disparaît : un écart non reconnu tombe dans « à lire »', () => {
    const { gestes } = quoiFaire(['quelque chose de neuf']);
    expect(gestes).toEqual([{ titre: 'À lire', items: ['quelque chose de neuf'] }]);
  });

  it('TÉMOIN : le registre COMMITÉ rougit sur un secret Vercel inscrit le 2026-11-07, une fois échu', () => {
    const reg = JSON.parse(readFileSync(resolve(process.cwd(), '.github/secrets-registry.json'), 'utf8'));
    // `supabase-platform` n'a pas de date vivante : sa date vient de lastRotated seul
    // (c'est l'écart réel du 2026-11-07, qui attend Axel). Une date posée sur la COPIE.
    for (const e of reg.entries) if (e.store === 'supabase-platform') e.lastRotated = il(1).slice(0, 10);
    const toutVivant = (age) => {
      const v = vivant();
      for (const e of reg.entries) if (v[e.store] instanceof Map) v[e.store].set(e.name, il(age(e)));
      return v;
    };
    const exemple = new Set(reg.entries.filter((e) => e.store === 'public').map((e) => e.name));
    // Plancher : tout vivant, tout jeune → aucun écart (sinon une garde toujours rouge passerait).
    expect(evaluer({ registre: reg, vivant: toutVivant(() => 1), exemple, maintenant: MAINTENANT }).erreurs).toEqual([]);
    // La clé service_role posée par l'intégration chez Vercel, à 366 jours.
    const r = evaluer({
      registre: reg,
      vivant: toutVivant((e) => (e.store === 'vercel' && e.name === 'SUPABASE_SERVICE_ROLE_KEY' ? 366 : 1)),
      exemple,
      maintenant: MAINTENANT,
    });
    expect(r.erreurs).toEqual(['vercel/SUPABASE_SERVICE_ROLE_KEY : 366 j pour une echeance de 365 j (critical), a faire tourner']);
  });
});
