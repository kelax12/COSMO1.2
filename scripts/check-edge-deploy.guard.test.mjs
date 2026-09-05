// ═══════════════════════════════════════════════════════════════════
// check-edge-deploy.guard.test.mjs · UN TEMOIN PAR ANGLE MORT
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `check:edge` est la garde qui repond a C-35 : rien ne comparait le code
// deploye des Edge Functions a celui du depot, et les trois sources lues le
// 2026-09-03 divergeaient toutes les trois.
//
// Une garde de plus ne vaut que ce que vaut ce qu'elle REGARDE. En cinq
// jours, QUATRE gardes de ce depot ont ete prises en train de repondre sans
// mesurer (`check:bundle`, `uptime.yml`, `restore-drill.yml`, `i18n:scan`),
// et toutes les quatre sortaient en 0. La question n'est jamais « tourne-t-
// elle ? », c'est « sur quoi ? ».
//
// Chaque cas ci-dessous SOUMET au comparateur reel un ecart qu'il doit voir,
// et echoue s'il ne le voit pas. Le comparateur n'est jamais re-implemente
// ici : une garde qui reecrit la logique qu'elle teste ne teste que sa copie.
//
// Les deux temoins qui comptent le plus ne portent pas sur la detection :
//   · « lecture vide » refuse un verdict rendu sans avoir rien lu, la classe
//     de defaut exacte de `restore-drill.yml`, dont le controle ne POUVAIT
//     pas echouer ;
//   · « secret absent » refuse le `::warning::` dans un run vert, regle
//     ecrite de CLAUDE.md et deja violee deux fois.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  compareFunction,
  normalizeContent,
  assertReadSomething,
  cleDeployee,
  importsLocaux,
  repoFilesFor,
} from './check-edge-deploy.mjs';

const SCRIPT = resolve(process.cwd(), 'scripts/check-edge-deploy.mjs');

/** Construit une arborescence de fichiers a partir d'un objet simple. */
const arbre = (o) => new Map(Object.entries(o));

describe('check:edge · temoin de detection', () => {
  // 🔴 SANS CE CAS, tous les autres pourraient passer sur un comparateur
  // casse qui repondrait « divergence » a tout. Il fixe le plancher : la
  // mesure detecte, ET elle ne detecte pas n'importe quoi.
  it('ne voit aucune divergence entre deux arbres identiques', () => {
    const files = { 'report-bug/index.ts': 'const A = 1\n', '_shared/alert.ts': 'export {}\n' };
    expect(
      compareFunction({ slug: 'report-bug', repoFiles: arbre(files), deployedFiles: arbre(files) }),
    ).toEqual([]);
  });

  it('voit un seul caractere change dans l entrypoint', () => {
    const ecarts = compareFunction({
      slug: 'report-bug',
      repoFiles: arbre({ 'report-bug/index.ts': 'const TIMEOUT = 15000\n' }),
      deployedFiles: arbre({ 'report-bug/index.ts': 'const TIMEOUT = 25000\n' }),
    });
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toMatchObject({ chemin: 'report-bug/index.ts', genre: 'contenu-different' });
  });

  // Reproduit le defaut S-4 tel qu'il vivait en prod le 2026-09-03 : la
  // valeur par defaut d'expediteur, retiree du depot, toujours en ligne.
  it('voit le defaut S-4 reel · une valeur par defaut retiree du depot mais toujours deployee', () => {
    const ecarts = compareFunction({
      slug: 'renewal-notice',
      repoFiles: arbre({
        'renewal-notice/index.ts': "const FROM = Deno.env.get('BUG_REPORT_FROM')\n",
      }),
      deployedFiles: arbre({
        'renewal-notice/index.ts':
          "const FROM = Deno.env.get('BUG_REPORT_FROM') ?? 'Cosmo <bug@thecosmo.app>'\n",
      }),
    });
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0].premiereLigne).toBe(1);
  });
});

describe('check:edge · temoin d asymetrie', () => {
  // Un comparateur qui ne verifie que « chaque fichier du depot est en
  // prod » ne voit jamais un fichier que le depot a supprime et que la prod
  // execute toujours. Les deux sens, ou la garde est borgne.
  it('voit un fichier present dans le depot et absent de la prod', () => {
    const ecarts = compareFunction({
      slug: 'delete-account',
      repoFiles: arbre({ 'delete-account/index.ts': 'a\n', '_shared/rate-limit.ts': 'b\n' }),
      deployedFiles: arbre({ 'delete-account/index.ts': 'a\n' }),
    });
    expect(ecarts).toEqual([
      expect.objectContaining({ chemin: '_shared/rate-limit.ts', genre: 'absent-de-la-prod' }),
    ]);
  });

  it('voit un fichier present en prod et absent du depot', () => {
    const ecarts = compareFunction({
      slug: 'delete-account',
      repoFiles: arbre({ 'delete-account/index.ts': 'a\n' }),
      deployedFiles: arbre({ 'delete-account/index.ts': 'a\n', '_shared/vieux.ts': 'b\n' }),
    });
    expect(ecarts).toEqual([
      expect.objectContaining({ chemin: '_shared/vieux.ts', genre: 'absent-du-depot' }),
    ]);
  });
});

describe('check:edge · temoin de lecture vide', () => {
  // 🔴 LE TEMOIN CENTRAL. `restore-drill.yml` capturait le mot ROLLBACK au
  // lieu du compte : son controle ne POUVAIT pas echouer. Ici, un bundle
  // vide donnerait « aucune divergence » avec la meme serenite.
  it('refuse de conclure quand le bundle deploye n a rendu AUCUN fichier', () => {
    // La preuve que le piege est reel : le comparateur seul dit « identique ».
    expect(
      compareFunction({ slug: 'report-bug', repoFiles: new Map(), deployedFiles: new Map() }),
    ).toEqual([]);
    // Et la garde qui refuse ce verdict.
    expect(() => assertReadSomething('report-bug', new Map())).toThrow(/Lecture vide/);
  });

  it('refuse un bundle dont aucun fichier ne ressemble a l entrypoint', () => {
    // Cas d'une normalisation de chemins qui aurait change cote fournisseur :
    // le comparateur repondrait « tout diverge », jamais « je lis mal ».
    expect(() =>
      assertReadSomething('report-bug', arbre({ 'autre-chose/index.ts': 'x' })),
    ).toThrow(/Lecture douteuse/);
  });

  it('accepte un bundle qui porte bien l entrypoint attendu', () => {
    expect(() =>
      assertReadSomething('report-bug', arbre({ 'report-bug/index.ts': 'x' })),
    ).not.toThrow();
  });
});

describe('check:edge · temoin de secret absent', () => {
  // 🔴 « Ne jamais rendre une garde conditionnelle a la presence de son
  // propre secret » est une regle ECRITE de CLAUDE.md, violee deux fois :
  // `renewal-notice` le 2026-08-26 (`if (SECRET && ...)`) et `uptime.yml`,
  // qui sautait toute sa moitie backend en restant VERT.
  it('sort en 1 sans SUPABASE_ACCESS_TOKEN, et n emet pas un warning dans un run vert', () => {
    const env = { ...process.env };
    delete env.SUPABASE_ACCESS_TOKEN;

    const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env });
    const sortie = `${r.stdout}${r.stderr}`;

    expect(r.status).toBe(1);
    expect(sortie).toMatch(/::error::/);
    expect(sortie).toMatch(/SUPABASE_ACCESS_TOKEN/);
    // Le mot exact interdit : un avertissement laisserait le run vert.
    expect(sortie).not.toMatch(/::warning::/);
  });
});

describe('check:edge · temoin de normalisation', () => {
  // Une garde rouge a chaque checkout Windows serait desarmee dans la
  // semaine. Mais la tolerance s'arrete la : elle ne doit pas avaler un
  // vrai ecart d'espaces.
  it('ne compte pas CRLF contre LF comme une divergence', () => {
    expect(
      compareFunction({
        slug: 'x',
        repoFiles: arbre({ 'x/index.ts': 'const a = 1\r\nconst b = 2\r\n' }),
        deployedFiles: arbre({ 'x/index.ts': 'const a = 1\nconst b = 2\n' }),
      }),
    ).toEqual([]);
  });

  it('compte une indentation perdue comme une divergence', () => {
    const ecarts = compareFunction({
      slug: 'x',
      repoFiles: arbre({ 'x/index.ts': 'if (a) {\n  return 1\n}\n' }),
      deployedFiles: arbre({ 'x/index.ts': 'if (a) {\nreturn 1\n}\n' }),
    });
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0].premiereLigne).toBe(2);
  });

  it('compte une ligne finale manquante comme une divergence', () => {
    expect(
      compareFunction({
        slug: 'x',
        repoFiles: arbre({ 'x/index.ts': 'const a = 1\n' }),
        deployedFiles: arbre({ 'x/index.ts': 'const a = 1' }),
      }),
    ).toHaveLength(1);
  });

  it('retire le BOM et rien d autre', () => {
    expect(normalizeContent('﻿const a = 1\n')).toBe('const a = 1\n');
    expect(normalizeContent('  const a = 1  \n')).toBe('  const a = 1  \n');
  });
});

describe('check:edge · temoin de normalisation des chemins deployes', () => {
  // 🔴 Mesure du 2026-09-04 sur les sept fonctions en ligne : le prefixe
  // VARIE selon l'endroit d'ou la fonction a ete deployee. Sans cette
  // normalisation, la garde aurait annonce « tout diverge » pour tout le
  // monde, ce qui est une autre facon de ne rien mesurer.
  it('aligne les deux prefixes reellement observes en prod', () => {
    // `delete-account`, deploye depuis supabase/functions/
    expect(cleDeployee('source/delete-account/index.ts', 'delete-account')).toBe(
      'delete-account/index.ts',
    );
    // `stripe-webhook`, deploye depuis la racine du depot
    expect(cleDeployee('source/supabase/functions/stripe-webhook/index.ts', 'stripe-webhook')).toBe(
      'stripe-webhook/index.ts',
    );
    // Un module partage, embarque dans le bundle
    expect(cleDeployee('supabase/functions/_shared/alert.ts', 'report-bug')).toBe(
      '_shared/alert.ts',
    );
    expect(cleDeployee('_shared/alert.ts', 'delete-account')).toBe('_shared/alert.ts');
  });

  it('accepte les separateurs Windows', () => {
    expect(cleDeployee('supabase\\functions\\report-bug\\index.ts', 'report-bug')).toBe(
      'report-bug/index.ts',
    );
  });
});

describe('check:edge · temoin de perimetre', () => {
  // Une fonction redeployee il y a six semaines execute la version d'alors
  // de ses modules partages. Comparer le seul `index.ts` laisserait cet
  // ecart totalement invisible, alors que c'est la forme qu'a prise S-4.
  it('voit les imports locaux, et ignore les imports distants', () => {
    const source = `
      import { createClient } from 'npm:@supabase/supabase-js@2'
      import { opsAlert } from '../_shared/alert.ts'
      import { tierFromPriceId } from "../_shared/org-tiers.ts"
      export { x } from './local.ts'
      import 'jsr:@std/assert'
      const m = await import('../_shared/rate-limit.ts')
    `;
    expect(importsLocaux(source).sort()).toEqual([
      '../_shared/alert.ts',
      '../_shared/org-tiers.ts',
      '../_shared/rate-limit.ts',
      './local.ts',
    ]);
  });

  // Cas reel du depot, pas une fixture : si `report-bug` cesse un jour
  // d'embarquer `_shared/alert.ts`, ce test le dit.
  it('embarque bien _shared/alert.ts dans le perimetre reel de report-bug', () => {
    const fichiers = repoFilesFor('report-bug');
    expect([...fichiers.keys()].sort()).toContain('_shared/alert.ts');
    expect([...fichiers.keys()].sort()).toContain('report-bug/index.ts');
  });

  it('echoue franchement sur une fonction inexistante, plutot que de rendre un arbre vide', () => {
    expect(() => repoFilesFor('fonction-qui-nexiste-pas')).toThrow(/Entrypoint introuvable/);
  });
});
