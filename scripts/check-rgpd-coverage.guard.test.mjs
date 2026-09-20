// ═══════════════════════════════════════════════════════════════════
// TÉMOIN — les deux gardes RGPD dérivées du schéma (C-92, C-94)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CES DEUX GARDES SONT DES DÉRIVATIONS, et une dérivation cassée rend le
// vide. Un extracteur de colonnes qui ne matche plus rend zéro table, donc
// zéro comparaison, donc « ✓ tout va bien » — sur le sujet où un faux vert
// coûte le plus cher : ce qu'il advient des données personnelles quand
// quelqu'un demande leur effacement.
//
// Les deux scripts portent chacun un plancher interne (« moins de 15 tables →
// l'extraction est cassée »). Ce témoin vérifie l'extracteur lui-même, sur
// des schémas jetables dont il connaît la réponse.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { tablesAvecUserId, cascadeProuvee, tablesPurgees } from './check-erasure-coverage.mjs';
import { colonnesParTable, entetesDeclarees } from './check-portability-export.mjs';

const LF = String.fromCharCode(10);

/** Un dossier de migrations jetable. */
function migrations(fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'rgpd-'));
  const d = join(racine, 'supabase', 'migration');
  mkdirSync(d, { recursive: true });
  for (const [nom, sql] of Object.entries(fichiers)) writeFileSync(join(d, nom), sql);
  return { racine, d };
}

describe('témoin — effacement dérivé du schéma (C-92)', () => {
  it('`tablesAvecUserId` voit `CREATE TABLE` ET `ALTER TABLE ADD COLUMN`', () => {
    const { racine, d } = migrations({
      '001_a.sql': [
        'CREATE TABLE public.avec (',
        '  id UUID PRIMARY KEY,',
        '  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,',
        '  nom TEXT',
        ');',
        'CREATE TABLE public.sans (',
        '  id UUID PRIMARY KEY,',
        '  nom TEXT',
        ');',
      ].join(LF),
      '002_b.sql': 'ALTER TABLE public.sans ADD COLUMN user_id UUID;',
    });
    try {
      const t = tablesAvecUserId(d);
      expect([...t.keys()].sort()).toEqual(['avec', 'sans']);
      expect(t.get('avec').fichier).toBe('001_a.sql');
      expect(t.get('sans').fichier).toBe('002_b.sql');
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('`cascadeProuvee` ne croit personne sur parole', () => {
    // 🔴 Le contrôle qui compte : une table DÉCLARÉE `cascade` sans la clause
    // affirme que Postgres efface ces lignes. Il ne le fait pas, et personne
    // ne s'en apercevrait avant une demande d'effacement.
    expect(cascadeProuvee('user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,')).toBe(true);
    expect(cascadeProuvee('user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,')).toBe(true);
    // Les pièges : une référence SANS cascade, une cascade vers une AUTRE
    // table, et une colonne nue.
    expect(cascadeProuvee('user_id UUID REFERENCES auth.users(id),')).toBe(false);
    expect(cascadeProuvee('user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,')).toBe(false);
    expect(cascadeProuvee('user_id UUID,')).toBe(false);
    expect(cascadeProuvee('user_id UUID NOT NULL,')).toBe(false);
  });

  it('`tablesPurgees` lit le bloc de delete-account', () => {
    const vues = tablesPurgees();
    expect(vues, 'bloc USER_OWNED_TABLES introuvable').not.toBeNull();
    expect(vues.has('tasks')).toBe(true);
    expect(vues.has('kr_completions')).toBe(true);
    // 🔴 `payment_records` ne doit JAMAIS y entrer : journal fiscal
    // inaltérable (mig. 125, CGI art. 286-I-3° bis).
    expect(vues.has('payment_records')).toBe(false);
    expect(vues.has('withdrawal_consents')).toBe(false);
  });

  it('le VRAI depot : 22 tables portent `user_id`, toutes decidees', () => {
    const t = tablesAvecUserId();
    expect(t.size).toBeGreaterThanOrEqual(20);
    expect(t.has('payment_records')).toBe(true);
    expect(t.has('withdrawal_consents')).toBe(true);
    // Les deux tables de PREUVE ne cascadent pas — sinon la conservation
    // annoncée n'existerait pas.
    expect(cascadeProuvee(t.get('payment_records').ligne)).toBe(false);
    expect(cascadeProuvee(t.get('withdrawal_consents').ligne)).toBe(false);
  });
});

describe('témoin — portabilité confrontée au schéma (C-94)', () => {
  it('`colonnesParTable` suit les ajouts ET les SUPPRESSIONS de colonnes', () => {
    // 🔴 Le `DROP COLUMN` est le cas qui a mordu à la pose : `collaborators`
    // avait été déclarée exclue de mémoire, alors que la mig. 028 l'a
    // supprimée. Un extracteur qui ignore les `DROP` décrit le schéma qu'on
    // croit avoir.
    const { racine, d } = migrations({
      '001.sql': [
        'CREATE TABLE public.t (',
        '  id UUID PRIMARY KEY,',
        '  garde TEXT,',
        '  partira TEXT',
        ');',
      ].join(LF),
      '002.sql': 'ALTER TABLE public.t ADD COLUMN ajoutee TEXT;',
      '003.sql': 'ALTER TABLE public.t DROP COLUMN IF EXISTS partira;',
    });
    try {
      const c = colonnesParTable(d);
      expect([...c.get('t')].sort()).toEqual(['ajoutee', 'garde', 'id']);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('`entetesDeclarees` lit a travers les COMMENTAIRES', () => {
    // 🔴 Le défaut rencontré à la pose : l'expression s'arrête à la première
    // parenthèse fermante, et un commentaire à l'intérieur d'un `cols(...)`
    // en contient. La lecture s'arrêtait au milieu du bloc, et le détecteur
    // accusait le code de ce dont il était lui-même coupable.
    const racine = mkdtempSync(join(tmpdir(), 'rgpd-e-'));
    try {
      const f = join(racine, 'faux-export.ts');
      writeFileSync(
        f,
        [
          'const headers = cols(',
          "  'un',",
          '  // un commentaire avec (des parentheses) et (C-94)',
          "  'deux',",
          '  /* et un bloc (aussi) */',
          "  'trois',",
          ');',
        ].join(LF),
      );
      expect([...entetesDeclarees(f)].sort()).toEqual(['deux', 'trois', 'un']);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('les quatre colonnes ajoutees le 2026-09-20 sont bien dans l export', () => {
    // La mesure du jour. Ces quatre-là étaient saisies par la personne et
    // absentes de l'export depuis toujours ; ce cas empêche leur retrait
    // silencieux.
    const entetes = entetesDeclarees();
    for (const e of ['icon', 'parent', 'krDurationMin', 'krWeight']) {
      expect(entetes.has(e), `en-tête \`${e}\` disparue de csv-export.ts`).toBe(true);
    }
  });

  it('les colonnes du VRAI schema sont extraites en nombre', () => {
    const c = colonnesParTable();
    expect(c.size).toBeGreaterThan(15);
    expect([...c.get('tasks')]).toContain('estimated_time');
    // Supprimée par la mig. 028 : elle ne doit PAS apparaître.
    expect([...c.get('tasks')]).not.toContain('collaborators');
    expect([...c.get('habits')]).toContain('icon');
    expect([...c.get('categories')]).toContain('parent_id');
  });
});
