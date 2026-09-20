// ═══════════════════════════════════════════════════════════════════
// TÉMOIN — les deux gardes de couverture de l'outillage (C-82)
// ═══════════════════════════════════════════════════════════════════
//
// Une garde neuve repart avec un témoin. Ici, deux gardes :
//
//   · `check-tooling-coverage.mjs` — le périmètre `scripts/` est-il COMPLET
//     dans le rapport, et les seuils tiennent-ils ?
//   · `edge-function-coverage.mjs` — chaque Edge Function est-elle nommée par
//     au moins un témoin ?
//
// 🔴 CE QUE CE TÉMOIN PROTÈGE EN PRIORITÉ n'est pas le seuil, c'est le
// DÉTECTEUR DE PÉRIMÈTRE. Les seuils, on les voit tomber. Un périmètre qui
// rétrécit, lui, fait MONTER le pourcentage : le 2026-09-20, trois fichiers
// non analysables étaient sortis du rapport et la couverture affichée était de
// 27,60 % au lieu de 23,12 %. Une mesure plus flatteuse que la réalité est
// exactement celle qu'on ne va pas questionner.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { lister, porteUnShebang, fichiersAttendus } from './check-tooling-coverage.mjs';
import { listerFonctions, listerTemoins, temoinsParFonction } from './edge-function-coverage.mjs';

const RACINE = process.cwd();

describe('témoin — check-tooling-coverage (C-82)', () => {
  it('`porteUnShebang` voit un shebang, et seulement un shebang', () => {
    // Sabotage le plus simple : si ce prédicat rendait toujours `false`, la
    // règle qui interdit les shebangs ne détecterait plus rien, et le mode de
    // défaillance du 2026-09-20 reviendrait en silence.
    expect(porteUnShebang('#!/usr/bin/env node\nconst a = 1;')).toBe(true);
    expect(porteUnShebang('#!/bin/sh')).toBe(true);
    expect(porteUnShebang('const a = 1;')).toBe(false);
    expect(porteUnShebang('// #!/usr/bin/env node')).toBe(false);
    expect(porteUnShebang('')).toBe(false);
  });

  it('AUCUN fichier du perimetre ne porte de shebang, aujourd hui', () => {
    // 🔴 La mesure, pas la règle. Les quinze shebangs de `scripts/**` ont été
    // retirés le 2026-09-20 ; ce cas échoue le jour où l'un revient.
    const fautifs = fichiersAttendus(RACINE).filter((f) =>
      porteUnShebang(readFileSync(join(RACINE, f), 'utf8')),
    );
    expect(
      fautifs,
      'Un shebang fait sortir le fichier du rapport de couverture EN SILENCE. '
        + 'Le retirer : ces scripts sont lancés par `node`, jamais en exécutable.',
    ).toEqual([]);
  });

  it('`lister` trouve reellement des fichiers, et filtre sur l extension', () => {
    // Un `lister` qui rendrait `[]` ferait passer le contrôle de complétude
    // au vert sur zéro fichier attendu : la garde répondrait sans mesurer.
    const mjs = lister(RACINE, 'scripts', '.mjs');
    expect(mjs.length).toBeGreaterThan(20);
    expect(mjs.every((f) => f.endsWith('.mjs'))).toBe(true);
    expect(mjs).toContain('scripts/ops-alert.mjs');
    // Descente récursive : `scripts/cosmo/` ne doit pas être ignoré.
    expect(mjs.some((f) => f.startsWith('scripts/cosmo/'))).toBe(true);
    // Un dossier inexistant rend une liste vide plutôt que de jeter.
    expect(lister(RACINE, 'dossier-qui-n-existe-pas', '.mjs')).toEqual([]);
  });

  it('`fichiersAttendus` exclut les tests et garde les gardes', () => {
    const attendus = fichiersAttendus(RACINE);
    expect(attendus.some((f) => f.endsWith('.test.mjs'))).toBe(false);
    expect(attendus).toContain('scripts/check-bundle-budget.mjs');
    expect(attendus).toContain('scripts/i18n-scan.mjs');
    // Les sondes jetables et les outils lancés à la main sont hors périmètre :
    // les inclure ferait baisser un plancher pour du code qui n'est pas une
    // garde.
    expect(attendus).not.toContain('scripts/visual-audit.mjs');
    expect(attendus).not.toContain('scripts/profile-landing.mjs');
  });

  it('TEMOIN : un shebang pose a blanc EST vu', () => {
    // Le détecteur est soumis au défaut qu'il doit voir, dans un arbre jetable
    // — jamais en salissant le dépôt.
    const tmp = mkdtempSync(join(tmpdir(), 'c82-'));
    try {
      mkdirSync(join(tmp, 'scripts'));
      writeFileSync(join(tmp, 'scripts', 'sain.mjs'), 'export const a = 1;\n');
      writeFileSync(join(tmp, 'scripts', 'fautif.mjs'), '#!/usr/bin/env node\nexport const b = 2;\n');
      const attendus = fichiersAttendus(tmp);
      expect(attendus.sort()).toEqual(['scripts/fautif.mjs', 'scripts/sain.mjs']);
      const fautifs = attendus.filter((f) => porteUnShebang(readFileSync(join(tmp, f), 'utf8')));
      expect(fautifs).toEqual(['scripts/fautif.mjs']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('les deux listes d exclusion decrivent le MEME perimetre', () => {
    // 🔴 `vitest.tooling.config.ts` et `check-tooling-coverage.mjs` portent
    // chacun une liste d'exclusions. Deux listes qui divergent, c'est un
    // fichier exclu d'un côté et attendu de l'autre : la garde échouerait sur
    // un fichier que personne n'a décidé d'exclure, et on la ferait taire.
    const config = readFileSync(join(RACINE, 'vitest.tooling.config.ts'), 'utf8');
    for (const motif of [
      'scripts/visual-audit*.mjs',
      'scripts/capture-*.mjs',
      'scripts/profile-landing.mjs',
      'scripts/analyze-entry.mjs',
      'scripts/diagnose-rls-state.mjs',
      'scripts/optimize-images.mjs',
    ]) {
      expect(config, `motif absent de vitest.tooling.config.ts : ${motif}`).toContain(motif);
    }
  });
});

describe('témoin — edge-function-coverage (C-82)', () => {
  it('les huit Edge Functions sont vues, et `_shared` n en est pas une', () => {
    const fonctions = listerFonctions(RACINE);
    expect(fonctions).toContain('delete-account');
    expect(fonctions).toContain('stripe-webhook');
    expect(fonctions).toContain('stripe-create-checkout');
    expect(fonctions).not.toContain('_shared');
    expect(fonctions.length).toBeGreaterThanOrEqual(8);
  });

  it('`listerTemoins` ramasse les trois familles de tests', () => {
    // Un ramasseur qui ne verrait que `src/**` déclarerait « 0 témoin » pour
    // une fonction couverte depuis `scripts/` ou `e2e/`.
    const temoins = listerTemoins(RACINE);
    expect(temoins.some((t) => t.startsWith('src/') && t.endsWith('.test.ts'))).toBe(true);
    expect(temoins.some((t) => t.startsWith('scripts/') && t.endsWith('.test.mjs'))).toBe(true);
    expect(temoins.every((t) => /\.(test|spec)\.(ts|tsx|mjs)$/.test(t))).toBe(true);
  });

  it('AUCUNE Edge Function n est sans temoin', () => {
    // 🔴 La mesure du 2026-09-20 : `stripe-create-checkout` était à ZÉRO, et
    // c'est la fonction qui ouvre une session de paiement. Le témoin qui l'a
    // fermée est `src/stripe-create-checkout.guard.test.ts`.
    const nues = [...temoinsParFonction(RACINE)]
      .filter(([, temoins]) => temoins.length === 0)
      .map(([nom]) => nom);
    expect(
      nues,
      'Ce code est déployé. ❌ Ne pas baisser le plancher : lui écrire un témoin.',
    ).toEqual([]);
  });

  it('TEMOIN : une fonction sans temoin EST vue', () => {
    // Le détecteur soumis au défaut, dans un arbre jetable.
    const tmp = mkdtempSync(join(tmpdir(), 'c82e-'));
    try {
      mkdirSync(join(tmp, 'supabase', 'functions', 'orpheline'), { recursive: true });
      mkdirSync(join(tmp, 'supabase', 'functions', 'regardee'), { recursive: true });
      mkdirSync(join(tmp, 'supabase', 'functions', '_shared'), { recursive: true });
      mkdirSync(join(tmp, 'src'), { recursive: true });
      writeFileSync(join(tmp, 'src', 'x.test.ts'), "read('supabase/functions/regardee/index.ts');\n");

      expect(listerFonctions(tmp)).toEqual(['orpheline', 'regardee']);
      const par = temoinsParFonction(tmp);
      expect(par.get('regardee')).toEqual(['src/x.test.ts']);
      expect(par.get('orpheline')).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('le rapport de couverture de l outillage existe apres un run', () => {
    // Informatif : ce cas ne fait pas échouer la suite quand la couverture
    // n'a pas été lancée (c'est le cas d'un `npm test` simple). Il documente
    // où le rapport atterrit, pour qui cherche.
    const rapport = join(RACINE, 'coverage-tooling', 'coverage-summary.json');
    if (!existsSync(rapport)) return;
    const j = JSON.parse(readFileSync(rapport, 'utf8'));
    expect(j.total).toBeDefined();
    expect(typeof j.total.statements.pct).toBe('number');
  });
});
