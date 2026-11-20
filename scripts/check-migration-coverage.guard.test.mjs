// check-migration-coverage.guard.test.mjs · UN TEMOIN PAR VERDICT, sur le classeur reel (jamais
// re-implemente ici) : « introspection vide » (verdict sans rien lire) et « dispense perimee » comptent le plus.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classer, VERDICT, objetsCrees, objetsSupprimes, NON_APPLIQUEES_DELIBEREMENT,
  entreesSansFichier, enAttenteDeProduction, LEDGER_FICHIER_OBLIGATOIRE_DEPUIS,
} from './check-migration-coverage.mjs';

/** Un catalogue de prod minimal mais NON VIDE. */
const CATALOGUE_PLEIN = {
  ledger_names: ['001_socle'],
  ledger: ['20260101000000_001_socle'],
  tables: ['tasks'],
  columns: ['tasks.deadline'],
  functions: ['get_my_tasks'],
  indexes: ['idx_tasks_user_id'],
  policies: ['tasks_select_own_or_shared@@tasks'],
  triggers: ['trg_tasks_updated_at'],
  constraints: ['tasks_pkey'],
};

const verdictDe = (resultats, nom) => resultats.find((r) => r.name === nom)?.verdict;

describe('check-migration-coverage · le classeur', () => {
  it('TEMOIN : une migration dont l OBJET N EXISTE PAS est ABSENTE DES DEUX', () => {
    // 🔴 C'est le temoin demande par le critere de sortie de C-79. Sans lui,
    // un classeur casse rendrait tout vert et la garde ne prouverait rien.
    const out = classer(
      [{ name: '999_fantome.sql', sql: 'CREATE TABLE public.table_qui_n_existe_pas (id uuid);' }],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '999_fantome.sql')).toBe(VERDICT.ABSENT);
  });

  it('une migration AU LEDGER est reconnue, prefixe numerique ou pas', () => {
    const out = classer(
      [{ name: '001_socle.sql', sql: 'CREATE TABLE public.tasks (id uuid);' }],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '001_socle.sql')).toBe(VERDICT.LEDGER);
  });

  it('absente du ledger mais son objet EXISTE : OBJET EN BASE', () => {
    const out = classer(
      [{ name: '002_hors_ledger.sql', sql: 'CREATE INDEX idx_tasks_user_id ON public.tasks (user_id);' }],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '002_hors_ledger.sql')).toBe(VERDICT.OBJET);
  });

  it('un objet SUPPRIME PAR UNE MIGRATION ULTERIEURE ne compte pas comme absent', () => {
    // Mig. 013 / 015 / 016, videes par la 141 (C-04) : mesure, pas declaration.
    const out = classer(
      [
        { name: '002_cree.sql', sql: 'CREATE OR REPLACE FUNCTION public.jeton_premium() RETURNS void AS $$ $$ LANGUAGE sql;' },
        { name: '003_supprime.sql', sql: 'DROP FUNCTION IF EXISTS public.jeton_premium();\nCREATE TABLE public.tasks (id uuid);' },
      ],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '002_cree.sql')).toBe(VERDICT.RETIRE);
  });

  it('un DROP TABLE ULTERIEUR emporte les index, policies, triggers et contraintes de la table', () => {
    // Mig. 196 : la 200 fait `DROP TABLE` de ses tables, et tout ce qui leur est attache part sans etre nomme.
    const out = classer(
      [
        {
          name: '002_cree.sql',
          sql: [
            'CREATE TABLE IF NOT EXISTS public.capacite (id uuid,',
            '  CONSTRAINT capacite_range CHECK (true));',
            'CREATE INDEX IF NOT EXISTS idx_capacite ON public.capacite (id);',
            'CREATE TRIGGER trg_capacite BEFORE INSERT ON public.capacite FOR EACH ROW EXECUTE FUNCTION f();',
            'CREATE POLICY "capacite_select" ON public.capacite FOR SELECT USING (true);',
            'ALTER TABLE public.capacite ADD CONSTRAINT capacite_fk FOREIGN KEY (id) REFERENCES t(id);',
          ].join('\n'),
        },
        { name: '003_supprime.sql', sql: 'DROP TABLE IF EXISTS public.capacite;' },
      ],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '002_cree.sql')).toBe(VERDICT.RETIRE);
  });

  it("TEMOIN : un DROP TABLE n'emporte QUE les objets de CETTE table", () => {
    const out = classer(
      [
        {
          name: '002_cree.sql',
          sql: 'CREATE TABLE public.capacite (id uuid);\nCREATE INDEX idx_capacite ON public.capacite (id);',
        },
        { name: '003_supprime_autre.sql', sql: 'DROP TABLE IF EXISTS public.autre_table;' },
      ],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '002_cree.sql')).toBe(VERDICT.ABSENT);
  });

  it("TEMOIN : un DROP TABLE n'emporte PAS une fonction, qui ne lui est pas attachee", () => {
    const out = classer(
      [
        {
          name: '002_cree.sql',
          sql: 'CREATE TABLE public.capacite (id uuid);\n'
            + 'CREATE OR REPLACE FUNCTION public.capacite_avant() RETURNS trigger AS $$ $$ LANGUAGE plpgsql;',
        },
        { name: '003_supprime.sql', sql: 'DROP TABLE IF EXISTS public.capacite;' },
      ],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '002_cree.sql')).toBe(VERDICT.ABSENT);
  });

  it("TEMOIN : l'ordre compte, un DROP ANTERIEUR n'excuse rien", () => {
    // 🔴 Sans ce cas, un DROP N'IMPORTE OU, meme AVANT la creation, excuserait l'absence.
    const out = classer(
      [
        { name: '002_supprime_avant.sql', sql: 'DROP FUNCTION IF EXISTS public.jeton_premium();' },
        { name: '003_cree_apres.sql', sql: 'CREATE OR REPLACE FUNCTION public.jeton_premium() RETURNS void AS $$ $$ LANGUAGE sql;' },
      ],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '003_cree_apres.sql')).toBe(VERDICT.ABSENT);
  });

  it("TEMOIN : un DROP suivi d'un CREATE dans le MEME fichier n'est pas une suppression", () => {
    // 🔴 `DROP ... IF EXISTS` puis `CREATE` : motif idempotent normal (mig. 015, `trg_subscriptions_guard`).
    const out = classer(
      [
        { name: '002_cree.sql', sql: 'CREATE TRIGGER trg_x BEFORE INSERT ON public.tasks EXECUTE FUNCTION f();' },
        {
          name: '003_repose.sql',
          sql: 'DROP TRIGGER IF EXISTS trg_x ON public.tasks;\n'
            + 'CREATE TRIGGER trg_x BEFORE INSERT ON public.tasks EXECUTE FUNCTION f();',
        },
      ],
      CATALOGUE_PLEIN,
    );
    // `trg_x` n'est PAS au catalogue et n'est PAS reellement supprime : la
    // garde doit le reclamer, pas l'excuser.
    expect(verdictDe(out, '002_cree.sql')).toBe(VERDICT.ABSENT);
  });

  it('une migration purement SUPPRESSIVE se verifie par l absence de ses cibles', () => {
    const out = classer(
      [{ name: '002_menage.sql', sql: 'DROP POLICY IF EXISTS "vieille policy" ON public.tasks;' }],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '002_menage.sql')).toBe(VERDICT.SUPPRESSION);
  });

  it('TEMOIN : une suppression dont la CIBLE EST TOUJOURS LA echoue', () => {
    // Sans ce cas, « suppression verifiee » serait rendu sans rien verifier.
    const out = classer(
      [{ name: '002_menage.sql', sql: 'DROP POLICY IF EXISTS tasks_select_own_or_shared ON public.tasks;' }],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '002_menage.sql')).toBe(VERDICT.ABSENT);
  });

  // Une dispense FICTIVE : la vraie table est vide depuis le 2026-10-22, s'y appuyer laisserait ces temoins sans objet.
  const DISPENSE_FICTIVE = { '998_dispense_fictive': 'Motif fictif, declare pour le temoin.' };

  it('une migration declaree et REELLEMENT non appliquee rend le verdict « declaree »', () => {
    const out = classer(
      [{ name: '998_dispense_fictive.sql', sql: 'CREATE TABLE public.table_pas_encore_la (id uuid);' }],
      CATALOGUE_PLEIN,
      DISPENSE_FICTIVE,
    );
    expect(verdictDe(out, '998_dispense_fictive.sql')).toBe(VERDICT.DECLAREE);
    expect(out[0].raison).toBe(DISPENSE_FICTIVE['998_dispense_fictive']);
  });

  it('TEMOIN : une dispense PERIMEE (objet en base) fait echouer la garde', () => {
    // 🔴 Une migration declaree non appliquee qui l'est devient : la declaration doit TOMBER (mig. 140).
    const out = classer(
      [{
        name: '998_dispense_fictive.sql',
        sql: 'CREATE OR REPLACE FUNCTION public.get_my_tasks() RETURNS void AS $$ $$ LANGUAGE sql;',
      }],
      CATALOGUE_PLEIN,
      DISPENSE_FICTIVE,
    );
    expect(verdictDe(out, '998_dispense_fictive.sql')).toBe(VERDICT.ABSENT);
    expect(out[0].raison).toMatch(/DECLAREE non appliquee, mais elle L EST : objet\(s\) en base/);
  });

  it('TEMOIN : une dispense PERIMEE (ligne au ledger) fait echouer la garde', () => {
    // Le chemin de la mig. 140 : une ligne au ledger suffit, meme sans qu'un
    // objet du fichier soit lisible au catalogue.
    const out = classer(
      [{ name: '998_dispense_fictive.sql', sql: 'CREATE TABLE public.table_pas_encore_la (id uuid);' }],
      { ...CATALOGUE_PLEIN, ledger_names: [...CATALOGUE_PLEIN.ledger_names, 'dispense_fictive'] },
      DISPENSE_FICTIVE,
    );
    expect(verdictDe(out, '998_dispense_fictive.sql')).toBe(VERDICT.ABSENT);
    expect(out[0].raison).toMatch(/DECLAREE non appliquee, mais elle L EST : une ligne au ledger/);
  });

  it('sans dispense passee, le classeur lit la VRAIE table', () => {
    // Par defaut, `NON_APPLIQUEES_DELIBEREMENT` fait foi : `dispenses` n'est pas une porte ouverte.
    const out = classer(
      [{ name: '998_dispense_fictive.sql', sql: 'CREATE TABLE public.table_pas_encore_la (id uuid);' }],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '998_dispense_fictive.sql')).toBe(VERDICT.ABSENT);
    expect(NON_APPLIQUEES_DELIBEREMENT).not.toHaveProperty('140_stripe_identifiers_reset');
  });

  it('un fichier sans objet NI suppression, NON declare, echoue', () => {
    // ❌ Un fichier non verifiable se DECLARE, avec son motif.
    const out = classer(
      [{ name: '002_data.sql', sql: "INSERT INTO public.tasks (id) VALUES (gen_random_uuid());" }],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '002_data.sql')).toBe(VERDICT.ABSENT);
    expect(out[0].raison).toMatch(/SANS_OBJET_VERIFIABLE/);
  });

  it('les commentaires SQL ne sont jamais pris pour du SQL', () => {
    // Un en-tete de migration de ce depot cite abondamment du SQL en exemple.
    const objets = objetsCrees('-- CREATE TABLE public.exemple_documente (id uuid);\nSELECT 1;');
    expect(objets.tables).toEqual([]);
    const sup = objetsSupprimes('-- DROP TABLE public.exemple_documente;\nSELECT 1;');
    expect(sup.tables).toEqual([]);
  });
});

// ─── Le CLI, et son refus de rendre un verdict sans avoir lu ────────

const SCRIPT = resolve(import.meta.dirname, 'check-migration-coverage.mjs');

function lancer(introspection, migrations, args = []) {
  const bac = mkdtempSync(join(tmpdir(), 'cosmo-cov-'));
  try {
    const dirMig = join(bac, 'migration');
    mkdirSync(dirMig);
    for (const [nom, sql] of Object.entries(migrations)) writeFileSync(join(dirMig, nom), sql);
    const fIntro = join(bac, 'intro.json');
    writeFileSync(fIntro, JSON.stringify(introspection));
    return spawnSync(process.execPath, [SCRIPT, fIntro, ...args], {
      encoding: 'utf8',
      env: { ...process.env, COSMO_MIGRATION_DIR: dirMig },
    });
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

describe('check-migration-coverage · le CLI', () => {
  it('TEMOIN : un LEDGER VIDE fait ECHOUER, il ne rend pas un verdict', () => {
    // 🔴 Un ledger vide avec un catalogue plein rendrait « OBJET EN BASE » partout : un VERT qui ne mesure rien.
    const r = lancer(
      { ...CATALOGUE_PLEIN, ledger: [], ledger_names: [] },
      { '001_socle.sql': 'CREATE TABLE public.tasks (id uuid);' },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/ledger lu est VIDE/);
  });

  it('TEMOIN : un CATALOGUE VIDE fait ECHOUER aussi', () => {
    const r = lancer(
      { ...CATALOGUE_PLEIN, tables: [] },
      { '001_socle.sql': 'CREATE TABLE public.tasks (id uuid);' },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/catalogue lu est VIDE/);
  });

  it('sort en 1 et NOMME le fichier quand il est absent des deux', () => {
    const r = lancer(CATALOGUE_PLEIN, {
      '999_fantome.sql': 'CREATE TABLE public.table_qui_n_existe_pas (id uuid);',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/999_fantome\.sql/);
  });

  it('sort en 0 quand tout est couvert, et DIT ce que ce vert ne prouve pas', () => {
    const r = lancer(CATALOGUE_PLEIN, { '001_socle.sql': 'CREATE TABLE public.tasks (id uuid);' });
    expect(r.status).toBe(0);
    // ⚠️ Un vert qui ne dit pas ses limites est la moitie d'un mensonge (mig. 144, rejouee par la 147).
    expect(r.stdout).toMatch(/CE QUE CE VERT NE DIT PAS/);
  });

  it('--print-sql rend la requete, et elle lit bien le ledger', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--print-sql'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/supabase_migrations\.schema_migrations/);
    expect(r.stdout).toMatch(/pg_constraint/);
  });
});

// ─── ROB-03 et CI-05 : les deux sens, et la porte du deploiement Edge ──
describe('check-migration-coverage · registre de prod sans fichier (ROB-03)', () => {
  const AVEC_238 = {
    ...CATALOGUE_PLEIN,
    ledger: [...CATALOGUE_PLEIN.ledger, '20261101143700_238_affiliation_deduction'],
    ledger_names: [...CATALOGUE_PLEIN.ledger_names, '238_affiliation_deduction'],
  };
  const SOCLE = { '001_socle.sql': 'CREATE TABLE public.tasks (id uuid);' };

  it('TEMOIN : une entree de ledger RECENTE sans fichier fait ECHOUER et la NOMME', () => {
    const r = lancer(AVEC_238, SOCLE);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/SANS FICHIER/);
    expect(r.stderr).toMatch(/20261101143700_238_affiliation_deduction/);
  });

  it('le fichier commite sous le meme nom la couvre, avec ou sans prefixe numerique', () => {
    const fichiers = [{ name: '001_socle.sql' }, { name: '238_affiliation_deduction.sql' }];
    expect(entreesSansFichier(fichiers, AVEC_238)).toEqual([]);
    const sansPrefixe = { ledger: ['20261101143700_affiliation_deduction'] };
    expect(entreesSansFichier(fichiers, sansPrefixe)).toEqual([]);
  });

  it('une entree ANTERIEURE a la mesure C-79 est listee, pas fatale', () => {
    const out = entreesSansFichier([], { ledger: ['20260406180828_create_subscriptions_table'] });
    expect(out).toEqual([{ entree: '20260406180828_create_subscriptions_table', version: '20260406180828', recente: false }]);
    expect('20260406180828' < LEDGER_FICHIER_OBLIGATOIRE_DEPUIS).toBe(true);
  });

  it('--sens=depot ne juge pas le registre : la porte Edge ne bloque que sur le depot', () => {
    expect(lancer(AVEC_238, SOCLE, ['--sens=depot']).status).toBe(0);
  });
});

describe('check-migration-coverage · migrations en attente de prod (CI-05)', () => {
  it('TEMOIN : un fichier hors ledger PARTIEL depuis la 200 est en attente (mig. 248)', () => {
    const out = classer(
      [{ name: '248_partiel.sql', sql: 'CREATE TABLE public.tasks (id uuid); CREATE TABLE public.nouvelle (id uuid);' }],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '248_partiel.sql')).toBe(VERDICT.OBJET);
    expect(enAttenteDeProduction(out).map((r) => r.name)).toEqual(['248_partiel.sql']);
  });

  it('un partiel ANTERIEUR a la 200 et un fichier hors ledger COMPLET ne bloquent pas (206)', () => {
    const out = classer([
      { name: '012_ancien.sql', sql: 'CREATE TABLE public.tasks (id uuid); CREATE INDEX idx_perdu ON public.tasks (id);' },
      { name: '206_complet.sql', sql: 'CREATE OR REPLACE FUNCTION public.get_my_tasks() RETURNS void AS $$ $$ LANGUAGE sql;' },
    ], CATALOGUE_PLEIN);
    expect(enAttenteDeProduction(out)).toEqual([]);
  });

  // Depuis la 200, hors ledger, le NOM ne suffit plus : la definition se mesure (ROB-02).
  const F = (corps) => `CREATE OR REPLACE FUNCTION public.get_my_tasks() RETURNS void AS $$ ${corps} $$ LANGUAGE sql;`;
  const AVEC = { ...CATALOGUE_PLEIN, function_bodies: { get_my_tasks: ['select 1;'] } };
  const attente = (sql, intro = AVEC) => enAttenteDeProduction(classer([{ name: '262_remplace.sql', sql }], intro)).map((r) => r.name);

  it('TEMOIN (a)(b) : corps different de la prod = pas « en base » ; meme corps (blancs, commentaires a part) = accepte', () => {
    expect(attente(F('select 2;'))).toEqual(['262_remplace.sql']);
    expect(attente(F('-- note\n  select   1;'))).toEqual([]);
    expect(attente(F('select 2;'), CATALOGUE_PLEIN)).toEqual([]); // sans corps de prod lu : rien ne se conclut
  });

  const P = (using, extra = '') => `CREATE POLICY tasks_select_own_or_shared ON public.tasks FOR SELECT TO authenticated ${extra} USING (${using});`;
  const POL = { ...CATALOGUE_PLEIN, policy_defs: { 'tasks_select_own_or_shared@@tasks': { c: 'SELECT', r: ['authenticated'], q: '(user_id = ( SELECT auth.uid() AS uid))', w: null } } };

  it('TEMOIN : une policy recreee sous son nom se mesure sur USING, roles et commande', () => {
    expect(attente(P('user_id = (select auth.uid())'), POL)).toEqual([]);
    expect(attente(P('true'), POL)).toEqual(['262_remplace.sql']);
    expect(attente(P('user_id = (select auth.uid())').replace('authenticated', 'anon'), POL)).toEqual(['262_remplace.sql']);
    expect(attente(P('user_id = (select auth.uid())').replace('FOR SELECT', 'FOR ALL'), POL)).toEqual(['262_remplace.sql']);
  });

  it('TEMOIN (c) : DROP POLICY dont la cible est ENCORE en base = non appliquee ; une policy recreee plus tard ne compte pas', () => {
    const drop = { name: '264_drop.sql', sql: 'DROP POLICY IF EXISTS tasks_select_own_or_shared ON public.tasks; CREATE POLICY nouvelle ON public.tasks FOR SELECT USING (true);' };
    const intro = { ...CATALOGUE_PLEIN, policies: ['tasks_select_own_or_shared@@tasks', 'nouvelle@@tasks'] };
    expect(enAttenteDeProduction(classer([drop], intro)).map((r) => r.name)).toEqual(['264_drop.sql']);
    expect(enAttenteDeProduction(classer([drop], { ...intro, policies: ['nouvelle@@tasks'] }))).toEqual([]);
    const relance = { name: '270_recree.sql', sql: 'CREATE POLICY tasks_select_own_or_shared ON public.tasks FOR SELECT USING (true);' };
    expect(enAttenteDeProduction(classer([drop, relance], intro)).map((r) => r.name)).not.toContain('264_drop.sql');
  });

  it('TEMOIN : une fonction redefinie par un fichier ULTERIEUR ne rougit pas l ancien ; un fichier AU LEDGER n est pas juge', () => {
    const f = (n, c) => ({ name: n, sql: F(c) });
    expect(enAttenteDeProduction(classer([f('250_ancien.sql', 'select 0;'), f('260_recent.sql', 'select 1;')], AVEC)).map((r) => r.name)).toEqual([]);
    expect(enAttenteDeProduction(classer([f('001_socle.sql', 'select 9;')], AVEC))).toEqual([]);
  });

  it('TEMOIN CLI : --sens=depot sort en 1 sur une migration absente des deux', () => {
    const r = lancer(CATALOGUE_PLEIN, {
      ...{ '001_socle.sql': 'CREATE TABLE public.tasks (id uuid);' },
      '245_cron.sql': 'CREATE OR REPLACE FUNCTION public.cron_lease_acquire() RETURNS void AS $$ $$ LANGUAGE sql;',
    }, ['--sens=depot']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/245_cron\.sql/);
  });
});

// ─── CI-05 : la porte de `ci-vert.yml` (pas de tag vert avant la migration) ──
describe('check-migration-coverage · porte du tag ci-vert', () => {
  const PRESENTE = { '001_socle.sql': 'CREATE TABLE public.tasks (id uuid);' };
  const ABSENTE = { ...PRESENTE, '262_neuve.sql': 'CREATE TABLE public.dependances (id uuid);' };

  it('TEMOIN : tout est en production, accord (sortie 0)', () => {
    expect(lancer(CATALOGUE_PLEIN, PRESENTE, ['--sens=depot']).status).toBe(0);
  });

  it('TEMOIN : un fichier absent de la production, refus qui le NOMME', () => {
    const r = lancer(CATALOGUE_PLEIN, ABSENTE, ['--sens=depot']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/^ +262_neuve\.sql/m);
  });

  it('TEMOIN : un ledger illisible (ni JSON, ni lisible), refus', () => {
    const bac = mkdtempSync(join(tmpdir(), 'cosmo-cov-'));
    try {
      writeFileSync(join(bac, 'intro.json'), 'psql: error: connection refused');
      const r = spawnSync(process.execPath, [SCRIPT, join(bac, 'intro.json'), '--sens=depot'], { encoding: 'utf8' });
      expect(r.status).toBe(2);
    } finally {
      rmSync(bac, { recursive: true, force: true });
    }
  });
});
