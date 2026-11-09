// ═══════════════════════════════════════════════════════════════════
// Témoin de ROB-02 (V8.1-8.2) : la comparaison base fraîche / production,
// le ledger local de la CLI, et la liste des migrations des gardes statiques.
// Chaque cas refuse un détecteur aveugle : un écart réel doit se voir.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { objets, ecarts, rapport, enAttente, fichiersPosterieurs, masquer, optionsClient } from './schema-prod.mjs';
import { comparerLedger } from './verifier-migrations.mjs';
import { listerMigrations, numero, NUM_NOUVELLE } from './migrations-fichiers.mjs';

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
    expect(o.ssl).toBeTruthy();
    expect(o.connectionString).not.toContain('sslmode');
  });
});

describe('schema-prod : migrations en attente de production', () => {
  const fichiers = ['20261109120000_baseline.sql', '20261109120200_245_cron_journal.sql', '20261110090000_nouvelle.sql', 'README.md'];

  it('la baseline et les fichiers hors format ne sont jamais « en attente »', () => {
    expect(fichiersPosterieurs(fichiers).map((m) => m.fichier)).toEqual(['20261109120200_245_cron_journal.sql', '20261110090000_nouvelle.sql']);
  });

  it('appliquée par la CLI (version) ou par apply_migration (nom) : en prod dans les deux cas', () => {
    const p = fichiersPosterieurs(fichiers);
    expect(enAttente(p, [{ version: '20261112000000', name: '245_cron_journal' }, { version: '20261110090000', name: 'x' }])).toEqual([]);
  });

  it('TÉMOIN : absente du ledger par version ET par nom = en attente', () => {
    const p = fichiersPosterieurs(fichiers);
    expect(enAttente(p, [{ version: '20261108001203', name: '247_index_fk_230_233_237' }]).map((m) => m.nom)).toEqual(['245_cron_journal', 'nouvelle']);
  });
});

describe('verifier-migrations : le ledger local de la CLI', () => {
  const fichiers = ['20261109120000_baseline.sql', '20261109120100_206_drop.sql'];
  it('tout appliqué : aucun écart', () => {
    expect(comparerLedger(fichiers, ['20261109120000', '20261109120100'])).toEqual({ manquantes: [], enTrop: [] });
  });
  it('TÉMOIN : une migration que la CLI n a pas appliquée, et une version sans fichier', () => {
    expect(comparerLedger(fichiers, ['20261109120000', '20990101000000'])).toEqual({
      manquantes: ['20261109120100_206_drop.sql'],
      enTrop: ['20990101000000'],
    });
  });
});

describe('migrations-fichiers : ce que lisent les gardes statiques', () => {
  it('historique puis CLI, baseline exclue, cliquets numérotés', () => {
    const racine = mkdtempSync(join(tmpdir(), 'migs-'));
    try {
      for (const [d, f] of [['supabase/migration', '001_a.sql'], ['supabase/migration', 'README.md'],
        ['supabase/migrations', '20261109120000_baseline.sql'], ['supabase/migrations', '20261109120200_245_cron.sql'],
        ['supabase/migrations', '20261110090000_nouvelle.sql'], ['supabase/migrations', '999_hors_format.sql']]) {
        mkdirSync(join(racine, d), { recursive: true });
        writeFileSync(join(racine, d, f), '');
      }
      const l = listerMigrations(racine);
      expect(l.map((e) => e.fichier)).toEqual(['001_a.sql', '20261109120200_245_cron.sql', '20261110090000_nouvelle.sql', '999_hors_format.sql']);
      expect(l.map((e) => e.valide)).toEqual([true, true, true, false]);
      expect(l.map((e) => e.num).slice(0, 3)).toEqual([1, 245, NUM_NOUVELLE]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('TÉMOIN : une migration née dans le dossier de la CLI est au-dessus de tous les cliquets', () => {
    expect(numero('20261110090000_ma_table.sql')).toBeGreaterThan(1000);
    expect(numero('227_x.sql')).toBe(227);
  });
});
