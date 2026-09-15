// ═══════════════════════════════════════════════════════════════════
// check-migration-coverage.guard.test.mjs · UN TEMOIN PAR VERDICT
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `check:migration-coverage` repond a C-79 : rien ne reliait les 152 fichiers
// de `supabase/migration/` aux 138 entrees du ledger de production, et
// l'enonce « tout le depot est applique, ledger relu » a ete ecrit CINQ FOIS
// sur une lecture qui n'en recouvrait que 120.
//
// Une garde de plus ne vaut que ce que vaut ce qu'elle REGARDE. En cinq jours,
// QUATRE gardes de ce depot ont ete prises en train de repondre sans mesurer,
// et toutes les quatre sortaient en 0. La question n'est jamais « tourne-t-
// elle ? », c'est « sur quoi ? ».
//
// Chaque cas ci-dessous SOUMET au classeur reel un jeu de migrations fabrique
// et une introspection fabriquee. Le classeur n'est jamais re-implemente ici :
// une garde qui reecrit la logique qu'elle teste ne teste que sa copie.
//
// Les deux temoins qui comptent le plus ne portent pas sur la detection :
//   · « introspection vide » refuse un verdict rendu sans avoir rien lu, la
//     classe de defaut exacte de `restore-drill.yml`, dont le controle NE
//     POUVAIT PAS echouer ;
//   · « dispense perimee » refuse qu'une declaration « non appliquee » survive
//     a l'application de la migration qu'elle dispense. Sans elle, la dispense
//     perimerait en silence, ce qui est le defaut que tout ce script ferme.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classer, VERDICT, objetsCrees, objetsSupprimes } from './check-migration-coverage.mjs';

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
    // C'est le cas reel des mig. 013 / 015 / 016, videes par la 141 (C-04).
    // ⚠️ Mesure, pas declaration : aucune de ces trois n'a d'entree dans une
    // liste ecrite a la main, et c'est le point.
    const out = classer(
      [
        { name: '002_cree.sql', sql: 'CREATE OR REPLACE FUNCTION public.jeton_premium() RETURNS void AS $$ $$ LANGUAGE sql;' },
        { name: '003_supprime.sql', sql: 'DROP FUNCTION IF EXISTS public.jeton_premium();\nCREATE TABLE public.tasks (id uuid);' },
      ],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '002_cree.sql')).toBe(VERDICT.RETIRE);
  });

  it("TEMOIN : l'ordre compte, un DROP ANTERIEUR n'excuse rien", () => {
    // 🔴 Sans ce cas, il suffirait qu'un objet soit supprime N IMPORTE OU dans
    // le depot pour excuser son absence, y compris AVANT sa creation. La garde
    // deviendrait alors une machine a fabriquer du vert.
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
    // 🔴 `DROP ... IF EXISTS` puis `CREATE` est le motif idempotent normal de
    // ce depot. Compte naivement, il faisait dire a la garde que la mig. 015
    // avait supprime `trg_subscriptions_guard`, alors qu'elle le repose.
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

  it('TEMOIN : une dispense PERIMEE fait echouer la garde', () => {
    // 🔴 La mig. 140 est declaree non appliquee. Le jour ou elle le sera, la
    // declaration doit TOMBER, pas survivre en silence : c'est exactement le
    // contrat de `.github/edge-deploy.json`, et la raison pour laquelle une
    // dispense ne peut jamais faire taire un ecart de CONTENU.
    const out = classer(
      [{
        name: '140_stripe_identifiers_reset.sql',
        sql: 'CREATE OR REPLACE FUNCTION public.get_my_tasks() RETURNS void AS $$ $$ LANGUAGE sql;',
      }],
      CATALOGUE_PLEIN,
    );
    expect(verdictDe(out, '140_stripe_identifiers_reset.sql')).toBe(VERDICT.ABSENT);
    expect(out[0].raison).toMatch(/DECLAREE non appliquee, mais elle L EST/);
  });

  it('un fichier sans objet NI suppression, NON declare, echoue', () => {
    // ❌ Une migration qu'on ne sait pas verifier ne passe pas en silence :
    // elle se DECLARE, avec son motif. C'est le prix a payer pour que la liste
    // des non-verifiables reste courte et lisible.
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

function lancer(introspection, migrations) {
  const bac = mkdtempSync(join(tmpdir(), 'cosmo-cov-'));
  try {
    const dirMig = join(bac, 'migration');
    mkdirSync(dirMig);
    for (const [nom, sql] of Object.entries(migrations)) writeFileSync(join(dirMig, nom), sql);
    const fIntro = join(bac, 'intro.json');
    writeFileSync(fIntro, JSON.stringify(introspection));
    return spawnSync(process.execPath, [SCRIPT, fIntro], {
      encoding: 'utf8',
      env: { ...process.env, COSMO_MIGRATION_DIR: dirMig },
    });
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}

describe('check-migration-coverage · le CLI', () => {
  it('TEMOIN : un LEDGER VIDE fait ECHOUER, il ne rend pas un verdict', () => {
    // 🔴 C'est la classe de defaut de `restore-drill.yml` : un controle qui NE
    // POUVAIT PAS echouer. Un ledger vide avec un catalogue plein rendrait
    // « OBJET EN BASE » partout, donc un VERT qui ne mesure rien.
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
    // ⚠️ Un vert qui ne dit pas ses limites est la moitie d'un mensonge : une
    // ligne au ledger ne prouve pas qu'un CREATE OR REPLACE a remplace le
    // corps vivant (mig. 144, rejouee par la 147).
    expect(r.stdout).toMatch(/CE QUE CE VERT NE DIT PAS/);
  });

  it('--print-sql rend la requete, et elle lit bien le ledger', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--print-sql'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/supabase_migrations\.schema_migrations/);
    expect(r.stdout).toMatch(/pg_constraint/);
  });
});
