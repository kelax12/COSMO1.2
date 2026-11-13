// ═══════════════════════════════════════════════════════════════════
// Témoin de TST-06 : la comparaison du dépôt rejoué à la production (repris
// de `noyau/migrations-cli`, 2026-11-09), et la liste des migrations retirées
// du rejeu parce que la prod ne les a pas. Chaque cas refuse un détecteur
// aveugle : un écart réel doit se voir.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { describe, it, expect } from 'vitest';

import { objets, ecarts, rapport, enAttente, masquer, optionsClient, SUPABASE_ROOT_CA, expliquerErreurTls } from './schema-prod.mjs';

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
});
