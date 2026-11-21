// ═══════════════════════════════════════════════════════════════════
// noyau-ci.guard.test.mjs · LE NOYAU BLOQUANT, COMPLET ET COURT (vague 2.2, 2026-11-06)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Le 2026-11-06, `main` était rouge sur 49 des 60 derniers runs : le job
// bloquant jugeait aussi des dates, des documents et des scores variables
// (Lighthouse, e2e), et un rouge permanent ne signalait plus rien. Le noyau
// (`ci-noyau.yml`, workflow `CI noyau`) est désormais LE verdict bloquant du
// commit : pre-push, `edge-deploy.yml` et `ci-alert.yml` ne lisent que lui.
//
// Ce témoin refuse :
//   · un noyau amputé d'une des gardes qui jugent le commit (lint, tsc,
//     tests + couverture, i18n, fichiers sensibles, RLS d'intégration,
//     build + budget de bundle, parcours e2e sur vraie base locale) ;
//   · une garde de calendrier, un job lent ou variable (e2e en mode démo,
//     Lighthouse, audit, mutation, visuel, sabotages) remis dans le noyau ;
//   · un job du noyau resté en double dans `ci.yml`.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { lireEtapes } from './ci-toutes-les-gardes.mjs';

const lire = (f) => readFileSync(join(process.cwd(), '.github/workflows', f), 'utf8').replace(/\r\n/g, '\n');
const NOYAU = lire('ci-noyau.yml');
const ETENDUE = lire('ci.yml');

/** Les jobs de premier niveau d'un workflow, dans l'ordre. */
const jobsDe = (yaml) => {
  const i = yaml.indexOf('\njobs:\n');
  if (i < 0) throw new Error('aucun bloc `jobs:`');
  return [...yaml.slice(i).matchAll(/^ {2}([A-Za-z_][\w-]*):\s*$/gm)].map((m) => m[1]);
};

const commandes = (job) => lireEtapes(NOYAU, job).map((e) => e.run ?? '').join('\n');

describe('ci-noyau.yml : la composition du noyau', () => {
  it('six jobs parallèles, sans `needs:` (le verdict tombe au rythme du plus lent)', () => {
    expect(jobsDe(NOYAU)).toEqual(['noyau', 'lint-test-build', 'fichiers-sensibles', 'rls-integration', 'contrat-donnees', 'e2e-supabase']);
    expect(NOYAU).not.toMatch(/^\s+needs:/m);
  });

  it.each([
    ['noyau', ['npm run lint', 'npx tsc -b', 'npm run test:coverage\n', 'npm run check:edge-coverage']],
    ['lint-test-build', [
      'npm run i18n:check', 'npm run i18n:scan', 'npm run i18n:pages', 'npm run i18n:identical',
      'npm run i18n:quality', 'npm run build', 'npm run check:bundle', 'npm run check:prerender', 'npm run validate:migrations',
      'npm run check:rls', 'npm run check:legal-journal', 'npm run check:legal\n', 'npm run check:docs',
      'npm run check:commentaires', 'npm run check:faits',
    ]],
    ['fichiers-sensibles', ['node scripts/check-fichiers-sensibles.mjs --arbre --plage']],
    ['rls-integration', ['node scripts/apply-migrations.mjs', 'npm run test:rls']],
    ['contrat-donnees', ['node scripts/apply-migrations.mjs', 'node scripts/contrat-donnees.mjs --verifier --sortie']],
    ['e2e-supabase', ['node scripts/apply-migrations.mjs', 'npx playwright test -c playwright.real.config.ts']],
  ])('TÉMOIN : le job `%s` lance ses gardes', (job, attendues) => {
    const texte = commandes(job);
    for (const c of attendues) expect(texte, `${job} : ${c}`).toContain(c);
  });

  // Une garde dont le verdict peut changer SANS commit rend `main` rouge un
  // matin, et un noyau rouge bloque toute poussée, sans contournement.
  it('TÉMOIN : aucune garde de calendrier, aucun job lent ou variable dans le noyau', () => {
    const interdits = [
      'check:study', 'check:lecteurs-ecran', 'check:exercice-violation',
      'check:peremption-chantiers', 'check:acquisition', 'check:coffre', 'lhci', 'npm audit',
      'stryker', 'test:mutation', 'check:sabotages', 'test:e2e',
      // V18.1 (2026-11-08) : plancher de couverture de l'outillage, planifie.
      'test:coverage:tooling',
    ];
    // Les commandes et les actions, pas les commentaires (l'en-tête nomme ce qui est HORS noyau).
    const lance = jobsDe(NOYAU).flatMap((j) => lireEtapes(NOYAU, j)).map((e) => `${e.run ?? ''} ${e.uses ?? ''}`).join('\n');
    expect(lance).toContain('npm run lint');
    for (const g of interdits) expect(lance, g).not.toContain(g);
    expect(lance.match(/playwright test(?! -c playwright\.real\.config\.ts)/g)).toBeNull();
    expect(NOYAU).not.toMatch(/^\s+schedule:/m);
  });

  // V18.1 (2026-11-08) : sortie du noyau, la couverture de `scripts/` reste
  // jouée chaque semaine. Une garde déplacée qui ne tourne plus nulle part
  // serait un retrait déguisé.
  it('TÉMOIN : la couverture de l outillage tourne encore, chaque semaine, dans Sabotages', () => {
    const sabotages = lire('sabotages.yml');
    expect(sabotages).toMatch(/^\s+run: npm run test:coverage:tooling$/m);
    expect(sabotages).toMatch(/^\s+schedule:/m);
  });

  it('juge chaque poussée de main et des branches de réparation `noyau/**`, et chaque PR', () => {
    expect(NOYAU).toMatch(/^name: CI noyau$/m);
    expect(NOYAU).toMatch(/\non:\n {2}push:\n {4}branches: \[main, 'noyau\/\*\*'\]\n {2}pull_request:\n {4}branches: \[main\]\n/);
  });

  it('fichiers-sensibles : la première poussée d’une branche de réparation se juge contre main, jamais à vide', () => {
    const run = lireEtapes(NOYAU, 'fichiers-sensibles').map((e) => e.run ?? '').join('\n');
    expect(run).toContain('PLAGE="origin/main..$GITHUB_SHA"');
    expect(run).toContain('PLAGE="$AVANT..$GITHUB_SHA"');
    expect(run).toContain('set -euo pipefail');
  });
});

describe('ci.yml : la CI étendue ne porte plus aucun job du noyau', () => {
  it('ses jobs sont les non bloquants, et aucun du noyau', () => {
    expect(ETENDUE).toMatch(/^name: CI etendue$/m);
    expect(jobsDe(ETENDUE)).toEqual(['e2e', 'lighthouse']);
  });

  // Vague 2.3 : une alerte quand le noyau est rouge, plus aucune pour un job
  // de test non bloquant (CI-01 : un salon qui sonne à chaque run ne dit rien).
  it('TÉMOIN ci-alert.yml : sonne sur le noyau, jamais sur un job de test non bloquant', () => {
    const alerte = lire('ci-alert.yml');
    const bloc = alerte.match(/\n {4}workflows:\n((?: {6}.*\n)+)/);
    expect(bloc, 'liste `workflows:` introuvable').not.toBeNull();
    const suivis = bloc[1].split('\n').map((l) => l.match(/^ {6}- (.+)$/)?.[1]).filter(Boolean);
    expect(suivis).toContain('CI noyau');
    for (const muet of ['CI', 'CI etendue', 'Visual', 'Mutation', 'Sabotages', 'scalability-volume', 'Gardes de calendrier']) {
      expect(suivis, muet).not.toContain(muet);
    }
  });

  it('edge-deploy.yml ne part que sur le noyau', () => {
    const deploy = lire('edge-deploy.yml');
    expect(deploy).toMatch(/^\s*workflows: \[CI noyau\]$/m);
    expect(deploy).not.toMatch(/CI etendue/);
  });
});

// V18.1 (2026-11-08) : `check:legal` et `check:drift` n'étaient lancés par
// AUCUN workflow ; le premier a été trouvé rouge à la main, le second ne
// servait plus. Une garde que rien ne lance ne garde rien : chaque garde de
// `package.json` est jouée par un workflow, ou nommée ici comme outil manuel.
describe('package.json : chaque garde est lancée par un workflow', () => {
  const OUTILS_MANUELS = new Map([
    ['check:mail', 'SPF / DKIM / DMARC, lu à la main'],
    ['check:tooling-coverage', 'seconde moitié de test:coverage:tooling, joué par Sabotages'],
    ['i18n:namespaces', 'mesure importée par src/i18n/lazy-namespaces.guard.test.ts, donc par le noyau'],
  ]);
  const scripts = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).scripts;
  const workflows = readdirSync(join(process.cwd(), '.github/workflows'))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => lire(f))
    .join('\n');
  const gardes = Object.keys(scripts).filter((n) => /^(check|i18n|validate):/.test(n));

  it.each(gardes)('`%s` tourne quelque part', (nom) => {
    if (OUTILS_MANUELS.has(nom)) return;
    const fichier = scripts[nom].match(/scripts\/[\w./-]+\.mjs/)?.[0];
    // `npm run check:legal` ne doit pas compter pour `check:legal-journal` :
    // la commande est suivie d'une fin de ligne, d'une espace ou d'un `&`.
    const lancee = [`npm run ${nom}\n`, `npm run ${nom} `, `npm run ${nom}&`].some((c) => workflows.includes(c))
      || (fichier !== undefined && workflows.includes(`node ${fichier}`));
    expect(lancee, `${nom} n'est lancé par aucun workflow : le brancher, ou le déclarer outil manuel`).toBe(true);
  });

  it('TÉMOIN : un outil manuel déclaré existe encore dans package.json', () => {
    for (const nom of OUTILS_MANUELS.keys()) expect(scripts[nom], nom).toBeDefined();
  });
});

// SEC-13 : l'étape est JOUÉE avec un faux `gh` (nouvelle alerte, analyse absente ou
// en erreur, appel refusé = rouge ; alerte connue de `main` = vert).
describe('ci-noyau.yml : la porte CodeQL', () => {
  const ETAPE = lireEtapes(NOYAU, 'fichiers-sensibles').find((e) => e.run?.includes('code-scanning'))?.run ?? '';
  const jouer = (env, script = ETAPE) => {
    const dir = mkdtempSync(join(tmpdir(), 'faux-gh-'));
    writeFileSync(join(dir, 'gh'), `#!/usr/bin/env bash
[ -n "$FAKE_KO" ] && exit 1
case "$*" in
  *'.error!=null'*) echo "\${FAKE_ERR:-0}";;
  *analyses*) echo "\${FAKE_N:-2}";;
  *"state=open&ref=refs/heads/main"*) printf '%s\n' "\${FAKE_MAIN:-1 2}" | tr ' ' '\n';;
  *"state=dismissed"*) printf '%s\n' "\${FAKE_CLASSEES:-}" | tr ' ' '\n';;
  *) printf '%s\n' "\${FAKE_REF:-1 2}" | tr ' ' '\n';;
esac
`, { mode: 0o755 });
    const r = spawnSync('bash', ['-c', script.replace('seq 1 45', 'seq 1 2').replace('"$i" = 45', '"$i" = 2').replace('sleep 20', ':')], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, GITHUB_REPOSITORY: 'o/r', GITHUB_REF: 'refs/heads/noyau/x', GITHUB_SHA: 'abc', ...env },
    });
    rmSync(dir, { recursive: true, force: true });
    return r;
  };

  it('l’étape existe et ne se contourne pas (ni `continue-on-error`, ni `|| true`)', () => {
    expect(ETAPE).toContain('set -euo pipefail');
    expect(ETAPE).not.toMatch(/\|\| true/);
    expect(NOYAU).not.toMatch(/CodeQL \(aucune alerte nouvelle\)[^\n]*\n(?:[^\n]*\n){0,3}\s+continue-on-error/);
  });
  it('TÉMOIN : alerte connue de main (ouverte ou classée) = vert', () => {
    expect(jouer({}).status).toBe(0);
    expect(jouer({ FAKE_REF: '1 2 3', FAKE_CLASSEES: '3' }).status).toBe(0);
  }, 60_000);
  it('TÉMOIN : une alerte absente de main = rouge, et le journal la nomme', () => {
    const r = jouer({ FAKE_REF: '1 2 3' });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain('3');
  });
  it('TÉMOIN : échec fermé, analyse absente, en erreur ou appel refusé = rouge', () => {
    expect(jouer({ FAKE_N: '0' }).status).not.toBe(0);
    expect(jouer({ FAKE_ERR: '1' }).status).not.toBe(0);
    expect(jouer({ FAKE_KO: '1' }).status).not.toBe(0);
  }, 60_000);
});
