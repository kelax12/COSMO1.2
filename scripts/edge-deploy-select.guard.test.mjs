// ═══════════════════════════════════════════════════════════════════
// edge-deploy-select.guard.test.mjs · le TEMOIN du deploiement continu (AM-6)
//
// 🔴 POURQUOI · `edge-deploy.yml` deploie ce que `edge-deploy-select.mjs`
// selectionne, et rien d'autre. Un selecteur qui oublie une fonction
// reproduit la derive C-35 EN AUTOMATIQUE : le run est vert, la fonction
// tourne sur son ancien code, et c'est `check:edge` qui le dira, apres coup.
//
// Chaque cas soumet au selecteur REEL une situation qu'il doit voir. Les
// trois qui comptent le plus :
//   · un `_shared/` modifie part avec TOUTES ses fonctions importatrices,
//     y compris par un import transitif (W-2, `verify-org-domain`) ;
//   · un run ancien qui finit apres un recent ne fait PAS reculer la prod ;
//   · une fonction sans section `config.toml` ou sans sonde fait echouer.
// Les derniers cas lisent le VRAI depot et le vrai workflow : un temoin vert
// sur des fixtures pendant que le workflow n'appelle plus le script ne
// garderait rien.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  shaDuTitre,
  choisirBase,
  sectionsDeclarees,
  selectionner,
  planifier,
  verifierTriple,
  decider,
} from './edge-deploy-select.mjs';
import { repoFilesFor } from './check-edge-deploy.mjs';
import { SONDES } from './check-edge-smoke.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

// Un depot miniature : `beta` importe `_shared/x.ts`, qui importe
// `_shared/y.ts`. `gamma` n'importe rien.
const SLUGS = ['alpha', 'beta', 'gamma'];
const PERIMETRES = {
  alpha: ['alpha/index.ts', '_shared/alert.ts'],
  beta: ['beta/index.ts', '_shared/x.ts', '_shared/y.ts'],
  gamma: ['gamma/index.ts'],
};
const SOURCES = {
  alpha: "import { opsAlert } from '../_shared/alert.ts'\n",
  beta: "import { x } from '../_shared/x.ts'\n",
  gamma: 'Deno.serve(() => new Response())\n',
};
const choisir = (changes) =>
  selectionner({ changes, slugs: SLUGS, perimetre: (s) => PERIMETRES[s], source: (s) => SOURCES[s] }).slugs;

describe('edge-deploy · selection des fonctions', () => {
  // Plancher : sans ce cas, un selecteur qui rend toujours tout passerait
  // tous les autres.
  it('ne selectionne rien quand rien sous supabase/ ne change', () => {
    expect(choisir(['src/App.tsx', 'docs/DEPLOYMENT.md'])).toEqual([]);
  });

  it('selectionne la fonction dont un fichier change', () => {
    expect(choisir(['supabase/functions/gamma/index.ts'])).toEqual(['gamma']);
  });

  it('selectionne toute fonction qui importe un _shared modifie', () => {
    expect(choisir(['supabase/functions/_shared/alert.ts'])).toEqual(['alpha']);
  });

  // 🔴 W-2 : le `grep -l` du runbook ne voit que l'import DIRECT. `y.ts`
  // n'est importe que par `x.ts` ; seul le perimetre transitif le voit.
  it('selectionne un importeur TRANSITIF d un _shared (W-2)', () => {
    expect(choisir(['supabase/functions/_shared/y.ts'])).toEqual(['beta']);
  });

  // Et le sens inverse : le `grep` du runbook rattrape un import que la
  // resolution ne verrait pas (specificateur non relatif, par exemple).
  it('retient aussi un importeur vu par le seul grep', () => {
    const r = selectionner({
      changes: ['supabase/functions/_shared/rate-limit.ts'],
      slugs: SLUGS,
      perimetre: (s) => PERIMETRES[s],
      source: (s) => (s === 'gamma' ? "import 'supabase/functions/_shared/rate-limit.ts'" : SOURCES[s]),
    });
    expect(r.slugs).toEqual(['gamma']);
  });

  it('nomme un _shared que personne n importe, sans rien deployer', () => {
    const r = selectionner({
      changes: ['supabase/functions/_shared/mort.ts'],
      slugs: SLUGS,
      perimetre: (s) => PERIMETRES[s],
      source: (s) => SOURCES[s],
    });
    expect(r.slugs).toEqual([]);
    expect(r.orphelins).toEqual(['supabase/functions/_shared/mort.ts']);
  });

  // W-1 : un `verify_jwt` ne prend effet qu'au deploiement.
  it('selectionne TOUT quand supabase/config.toml change', () => {
    expect(choisir(['supabase/config.toml'])).toEqual(SLUGS);
  });

  it('selectionne TOUT pour un fichier a la racine de supabase/functions/', () => {
    expect(choisir(['supabase/functions/deno.json'])).toEqual(SLUGS);
  });

  it('ignore la documentation des fonctions', () => {
    expect(choisir(['supabase/functions/CLAUDE.md', 'supabase/functions/gamma/README.md'])).toEqual([]);
  });

  it('ignore un dossier de fonction supprime du depot', () => {
    expect(choisir(['supabase/functions/disparue/index.ts'])).toEqual([]);
  });

  it('accepte des separateurs Windows', () => {
    expect(choisir(['supabase\\functions\\gamma\\index.ts'])).toEqual(['gamma']);
  });

  it('dit pourquoi chaque fonction part', () => {
    const r = selectionner({
      changes: ['supabase/functions/alpha/index.ts', 'supabase/functions/_shared/alert.ts'],
      slugs: SLUGS,
      perimetre: (s) => PERIMETRES[s],
      source: (s) => SOURCES[s],
    });
    expect(r.raisons.get('alpha')).toEqual([
      'supabase/functions/alpha/index.ts',
      'supabase/functions/_shared/alert.ts',
    ]);
  });
});

describe('edge-deploy · le dernier SHA deploye', () => {
  it('lit le SHA dans le titre du run, jamais ailleurs', () => {
    expect(shaDuTitre(`Edge deploy ${A}`)).toBe(A);
    expect(shaDuTitre('Edge deploy (CI non verte, rien a faire)')).toBeNull();
    expect(shaDuTitre(undefined)).toBeNull();
  });

  // 🔴 Le cas qui ferait perdre un deploiement : un run vert SANS deploiement
  // (CI rouge, job saute) pris pour la base. Ses changements ne partiraient
  // jamais.
  it('ignore un run vert dont le titre ne porte pas de SHA', () => {
    const runs = [
      { conclusion: 'success', display_title: 'Edge deploy (CI non verte, rien a faire)', head_sha: C },
      { conclusion: 'failure', display_title: `Edge deploy ${B}` },
      { conclusion: 'success', display_title: `Edge deploy ${A}`, head_sha: C },
    ];
    expect(choisirBase(runs)).toBe(A);
  });

  it('rend null sans aucun run vert (amorcage)', () => {
    expect(choisirBase([])).toBeNull();
    expect(choisirBase(undefined)).toBeNull();
  });
});

describe('edge-deploy · le plan', () => {
  const diff = () => ['supabase/functions/gamma/index.ts'];

  it('deploie tout a l amorcage', () => {
    expect(planifier({ base: null, tete: A, estAncetre: () => true, diff })).toEqual({
      mode: 'amorcage',
      changes: null,
    });
  });

  // 🔴 Un run du commit A qui finit apres celui de B (descendant de A) ne
  // doit PAS redeployer le code de A par-dessus celui de B.
  it('ne deploie rien quand la tete est deja contenue dans la base', () => {
    const estAncetre = (x, y) => x === A && y === B;
    expect(planifier({ base: B, tete: A, estAncetre, diff })).toEqual({ mode: 'deja-deploye', changes: [] });
  });

  it('deploie tout quand la base n est pas un ancetre (historique reecrit)', () => {
    expect(planifier({ base: A, tete: B, estAncetre: () => false, diff }).mode).toBe('historique-reecrit');
  });

  it('suit le diff dans le cas nominal', () => {
    const estAncetre = (x, y) => x === A && y === B;
    expect(planifier({ base: A, tete: B, estAncetre, diff })).toEqual({
      mode: 'diff',
      changes: ['supabase/functions/gamma/index.ts'],
    });
  });

  it('refuse un SHA a deployer invalide', () => {
    expect(() => planifier({ base: A, tete: 'main', estAncetre: () => true, diff })).toThrow(/invalide/);
    expect(() => planifier({ base: A, tete: undefined, estAncetre: () => true, diff })).toThrow(/invalide/);
  });
});

describe('edge-deploy · une fonction, une section, une sonde', () => {
  it('lit les sections de config.toml, commentaires exclus', () => {
    const s = sectionsDeclarees('[functions.a]\nverify_jwt = false\n# [functions.b]\n[db]\n');
    expect([...s]).toEqual(['a']);
  });

  it('refuse une fonction sans section ou sans sonde', () => {
    const manques = verifierTriple(['a', 'b', 'c'], {
      sections: new Set(['a', 'b']),
      sondes: [{ fonction: 'a' }, { fonction: 'c' }],
    });
    expect(manques).toHaveLength(2);
    expect(manques[0]).toMatch(/« b ».*sonde/);
    expect(manques[1]).toMatch(/« c ».*config\.toml/);
  });
});

describe('edge-deploy · decision complete', () => {
  const base = {
    tete: B,
    estAncetre: (x, y) => x === A && y === B,
    diff: () => ['supabase/functions/_shared/y.ts'],
    slugs: SLUGS,
    perimetre: (s) => PERIMETRES[s],
    source: (s) => SOURCES[s],
    sections: new Set(SLUGS),
    sondes: SLUGS.map((fonction) => ({ fonction })),
  };

  it('enchaine base, plan, selection et triple', async () => {
    const d = await decider({ ...base, lireRuns: async () => [{ conclusion: 'success', display_title: `Edge deploy ${A}` }] });
    expect(d).toMatchObject({ base: A, mode: 'diff', slugs: ['beta'], manques: [] });
  });

  it('a l amorcage, verifie le triple sur TOUTES les fonctions', async () => {
    const d = await decider({ ...base, lireRuns: async () => [], sondes: [{ fonction: 'alpha' }] });
    expect(d.mode).toBe('amorcage');
    expect(d.slugs).toEqual(SLUGS);
    expect(d.manques).toHaveLength(2);
  });

  // Une API en panne n'est pas « aucun run vert » : ce serait un amorcage,
  // donc tout redeployer sur une lecture ratee.
  it('echoue si les runs sont illisibles, au lieu de tout redeployer', async () => {
    await expect(
      decider({ ...base, lireRuns: async () => { throw new Error('HTTP 502'); } }),
    ).rejects.toThrow('HTTP 502');
  });
});

describe('edge-deploy · le vrai depot', () => {
  // Le perimetre reel de `check:edge` : si `verify-org-domain` cessait d'y
  // voir `_shared/org-integrations.ts`, le cas W-2 repartirait en silence.
  it('un changement de _shared/org-integrations.ts emporte verify-org-domain', () => {
    const r = selectionner({
      changes: ['supabase/functions/_shared/org-integrations.ts'],
      slugs: ['verify-org-domain', 'report-bug'],
      perimetre: (s) => [...repoFilesFor(s).keys()],
      source: (s) => readFileSync(resolve(process.cwd(), 'supabase/functions', s, 'index.ts'), 'utf8'),
    });
    expect(r.slugs).toContain('verify-org-domain');
  });

  it('chaque fonction du depot a sa section et sa sonde', () => {
    const toml = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
    const sondees = SONDES.map((s) => s.fonction);
    const manques = verifierTriple(sondees, { sections: sectionsDeclarees(toml), sondes: SONDES });
    expect(sondees.length).toBeGreaterThanOrEqual(13);
    expect(manques).toEqual([]);
  });
});

describe('edge-deploy · le workflow appelle REELLEMENT ce selecteur', () => {
  const yml = readFileSync(resolve(process.cwd(), '.github/workflows/edge-deploy.yml'), 'utf8');

  it('ne part qu apres une CI verte, sur un push de main', () => {
    expect(yml).toMatch(/workflow_run:\s*\n\s*workflows:\s*\[CI\]/);
    expect(yml).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(yml).toContain("github.event.workflow_run.event == 'push'");
    expect(yml).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  it('deploie le SHA que la CI a valide, et le porte dans son titre', () => {
    expect(yml).toContain('ref: ${{ github.event.workflow_run.head_sha }}');
    expect(yml).toMatch(/run-name:[\s\S]{0,300}?format\('Edge deploy \{0\}', github\.event\.workflow_run\.head_sha\)/);
  });

  it('serialise les deploiements sans annuler celui en cours', () => {
    expect(yml).toMatch(/concurrency:\s*\n\s*group: edge-deploy\s*\n\s*cancel-in-progress: false/);
  });

  it('selectionne par ce script, deploie par l API, puis rejoue check:edge et la fumee', () => {
    expect(yml).toContain('node scripts/edge-deploy-select.mjs');
    expect(yml).toContain('supabase functions deploy "$slug" --use-api --project-ref');
    expect(yml).toContain('npm run check:edge\n');
    expect(yml).toContain('npm run check:edge-smoke');
  });

  it('est branche sur ci-alert.yml', () => {
    const alerte = readFileSync(resolve(process.cwd(), '.github/workflows/ci-alert.yml'), 'utf8');
    expect(alerte).toMatch(/^\s*- Edge deploy$/m);
  });
});
