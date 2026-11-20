// ═══════════════════════════════════════════════════════════════════
// Témoin de TST-06 : dépôt rejoué contre production, migrations retirées du
// rejeu. Chaque cas refuse un détecteur aveugle : un écart réel doit se voir.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { describe, it, expect } from 'vitest';

import { tmpdir } from 'node:os';
import { fichierEnAttente, objets, ecarts, rapport, enAttente, masquer, optionsClient, SUPABASE_ROOT_CA, expliquerErreurTls } from './schema-prod.mjs';

const bloc = (nom, type, corps) => `--\n-- Name: ${nom}; Type: ${type}; Schema: public; Owner: -\n--\n\n${corps}\n\n`;
const DUMP = [
  'SET x = 1;\n\n',
  bloc('tasks', 'TABLE', 'CREATE TABLE public.tasks (\n    id uuid NOT NULL,\n    user_id uuid NOT NULL\n);'),
  bloc('f()', 'FUNCTION', 'CREATE FUNCTION public.f() RETURNS int LANGUAGE sql AS $$ select 1 $$;'),
  bloc('idx_a', 'INDEX', 'CREATE INDEX idx_a ON public.tasks USING btree (user_id);'),
  '-- ─── Objets poses hors du schema `public` par les migrations ───\n\n',
  '-- pg_cron (nom, planning, commande)\n\n',
  "SELECT cron.schedule('a', '0 3 * * *', 'select 1');\n",
].join('');

describe('schema-prod : comparaison objet par objet', () => {
  it('deux instantanés identiques : aucun écart', () => {
    const e = ecarts(DUMP, DUMP);
    expect([e.seulementProd, e.seulementDepot, e.differents]).toEqual([[], [], []]);
    expect(e.total).toBeGreaterThanOrEqual(4);
  });

  it('TÉMOIN : une colonne devenue nullable en prod est une définition différente', () => {
    const prod = DUMP.replace('    user_id uuid NOT NULL\n', '    user_id uuid\n');
    const e = ecarts(DUMP, prod);
    expect(e.differents).toEqual(['TABLE public.tasks']);
    expect(rapport(e)).toContain('+     user_id uuid');
  });

  it('TÉMOIN : un index ajouté au Dashboard est « en prod seulement », un trigger perdu « dans le dépôt seulement »', () => {
    const prod = DUMP.replace(bloc('idx_a', 'INDEX', 'CREATE INDEX idx_a ON public.tasks USING btree (user_id);'),
      bloc('idx_b', 'INDEX', 'CREATE INDEX idx_b ON public.tasks USING btree (id);'));
    const e = ecarts(DUMP, prod);
    expect(e.seulementProd).toEqual(['INDEX public.idx_b']);
    expect(e.seulementDepot).toEqual(['INDEX public.idx_a']);
  });

  it('TÉMOIN : une tâche pg_cron absente de la prod se voit (les compléments comptent)', () => {
    const e = ecarts(DUMP, DUMP.replace("SELECT cron.schedule('a', '0 3 * * *', 'select 1');\n", ''));
    expect(e.seulementDepot).toHaveLength(1);
    expect(e.seulementDepot[0]).toContain("cron.schedule('a'");
  });

  it('le rapport complet porte la définition de prod entière, délimitée', () => {
    const prod = DUMP.replace('select 1 $$', () => 'select 2 $$');
    const t = rapport(ecarts(DUMP, prod), { complet: true });
    expect(t).toContain('<<< prod FUNCTION public.f()\nCREATE FUNCTION public.f() RETURNS int LANGUAGE sql AS $$ select 2 $$;\n>>>');
  });

  it('TÉMOIN : une fonction présente d un seul côté est un écart, dans les deux sens (262)', () => {
    const g = bloc('g()', 'FUNCTION', 'CREATE FUNCTION public.g() RETURNS int LANGUAGE sql AS $$ select 2 $$;');
    const avec = DUMP.replace('-- ─── Objets', () => g + '-- ─── Objets');
    expect(ecarts(avec, DUMP).seulementDepot).toEqual(['FUNCTION public.g()']);
    expect(ecarts(DUMP, avec).seulementProd).toEqual(['FUNCTION public.g()']);
  });

  it('TÉMOIN : une migration en attente est un écart, que sa base fraîche ne bâtit pas (262)', () => {
    const e = ecarts(DUMP, DUMP, ['262_dependances_taches_partagees.sql']);
    expect([e.seulementProd, e.seulementDepot, e.differents]).toEqual([[], [], []]);
    expect(e.enAttente).toEqual(['262_dependances_taches_partagees.sql']);
    expect(rapport(e)).toContain('! 262_dependances_taches_partagees.sql');
    expect(ecarts(DUMP, DUMP).enAttente).toEqual([]);
  });

  it('les surcharges de même nom ne s écrasent pas', () => {
    const d = bloc('tasks', 'TABLE', 'CREATE TABLE public.tasks2 ();') + DUMP;
    expect(objets(d).has('TABLE public.tasks #2')).toBe(true);
  });

  it('rien de personnel ni de secret ne part au journal', () => {
    const t = masquer("'a.b@exemple.fr' eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.x sk_live_abc whsec_x postgres://u:p@h/db");
    expect(t).not.toMatch(/@exemple|eyJhbGci|sk_live_abc|whsec_x|u:p@h/);
  });

  it('TLS vers la prod, pas en local ; le sslmode de l URL est retiré', () => {
    expect(optionsClient('postgresql://postgres:postgres@127.0.0.1:54322/postgres').ssl).toBeUndefined();
    const o = optionsClient('postgresql://u:p@pooler.supabase.com:5432/postgres?sslmode=require');
    expect(o.ssl.rejectUnauthorized).toBe(true);
    expect(o.ssl.ca).toBe(SUPABASE_ROOT_CA);
    expect(o.connectionString).not.toContain('sslmode');
  });
});

describe('schema-prod : vérification TLS de la production', () => {
  it('TÉMOIN : la racine embarquée est un vrai certificat Supabase, autosigné, non expiré', () => {
    const c = new X509Certificate(SUPABASE_ROOT_CA);
    expect(c.subject).toContain('Supabase Root 2021 CA');
    expect(c.verify(c.publicKey)).toBe(true);
    expect(new Date(c.validTo).getTime()).toBeGreaterThan(Date.now());
  });

  it('TÉMOIN : jamais de contournement de la vérification dans le script', () => {
    const src = readFileSync(new URL('./schema-prod.mjs', import.meta.url), 'utf8');
    expect(src).not.toMatch(/rejectUnauthorized:s*false/);
  });

  it('un échec de certificat se dit en clair, une autre erreur passe telle quelle', () => {
    const e = Object.assign(new Error('self-signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' });
    expect(expliquerErreurTls(e).message).toMatch(/verification TLS.*SELF_SIGNED/);
    const autre = new Error('password authentication failed');
    expect(expliquerErreurTls(autre)).toBe(autre);
  });
});

describe('schema-prod : bruit normalisé, écart réel conservé', () => {
  const FN = 'CREATE FUNCTION public.f() RETURNS int LANGUAGE sql AS $$ select 1 $$;';
  const diff = (a, b) => ecarts(DUMP.replace(FN, () => a), DUMP.replace(FN, () => b)).differents;
  const cols = (c) => DUMP.replace('    id uuid NOT NULL,\n    user_id uuid NOT NULL\n', c);
  it('commentaires et mise en page du corps, ordre des colonnes : pas un écart', () => {
    expect(diff(FN, 'CREATE FUNCTION public.f() RETURNS int\n LANGUAGE sql AS $$\n -- note\n select 1 /* x */\n$$;')).toEqual([]);
    expect(ecarts(DUMP, cols('    user_id uuid NOT NULL,\n    id uuid NOT NULL\n')).differents).toEqual([]);
  });
  it("TÉMOIN : instruction changée, littéral aux espaces ou '--' différents, colonne nullable : écart", () => {
    expect(diff(FN, FN.replace('select 1', 'select 2'))).toEqual(['FUNCTION public.f()']);
    expect(diff(FN.replace('select 1', "select 'a  -- b'"), FN.replace('select 1', "select 'a -- b'"))).toEqual(['FUNCTION public.f()']);
    expect(ecarts(DUMP, cols('    user_id uuid,\n    id uuid NOT NULL\n')).differents).toEqual(['TABLE public.tasks']);
  });
});

describe('schema-prod : migrations retirées du rejeu', () => {
  const INTRO = {
    ledger: ['20260101000000_001_socle'],
    ledger_names: ['001_socle'],
    tables: ['tasks'], columns: [], functions: [], indexes: [], policies: [], triggers: [], constraints: [],
  };

  it('TÉMOIN : une migration absente de la prod est retirée, une migration au ledger reste', () => {
    const out = enAttente([
      { name: '001_socle.sql', sql: 'CREATE TABLE public.tasks (id uuid);' },
      { name: '245_cron.sql', sql: 'CREATE TABLE public.cron_runs (id uuid);' },
    ], INTRO);
    expect(out).toEqual(['245_cron.sql']);
  });

  it('TÉMOIN : hors ledger, fonction déjà en base mais table à retirer encore là : non appliquée (mig. 206)', () => {
    const fichiers = [
      { name: '001_socle.sql', sql: 'CREATE TABLE public.tasks (id uuid);' },
      { name: '206_retrait.sql', sql: 'CREATE OR REPLACE FUNCTION public.f() RETURNS int AS $$ select 1 $$ LANGUAGE sql;\nDROP TABLE IF EXISTS public.jalons;' },
    ];
    expect(enAttente(fichiers, { ...INTRO, tables: ['tasks', 'jalons'], functions: ['f'] })).toEqual(['206_retrait.sql']);
    expect(enAttente(fichiers, { ...INTRO, tables: ['tasks'], functions: ['f'] })).toEqual([]);
  });
});

it('TEMOIN : liste des migrations en attente sous RUNNER_TEMP, jamais dans le temporaire du systeme (js/insecure-temporary-file)', () => {
  expect(fichierEnAttente({ RUNNER_TEMP: '/j' }).split(String.fromCharCode(92)).join('/')).toBe('/j/cosmo-migrations-en-attente.json');
  expect(fichierEnAttente({}).startsWith(tmpdir())).toBe(false);
});
