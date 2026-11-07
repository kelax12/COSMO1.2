// ═══════════════════════════════════════════════════════════════════
// Gardes statiques des invariants d'architecture (cf. docs/ARCHITECTURE.md)
//
// POURQUOI CE FICHIER EXISTE
// L'audit du 2026-08-24 a mesuré la même chose sur trois invariants
// différents : celui qui a un outil tient, ceux qui n'en ont pas reculent à
// chaque vague de features. La convention d'alias `@/` est passée de 1 à
// 6 entorses en dix jours (74 en réalité, le comptage initial était faux) ;
// l'objectif « aucun fichier > 600 LOC », acquis en juin, comptait 16 fichiers
// hors budget en août. Aucune revue ne l'a vu, parce qu'aucun script ne le
// mesurait.
//
// L'alias est désormais tenu par ESLint (`no-restricted-imports`). Les deux
// invariants qui restaient sans outil sont ici.
//
// FORME : CLIQUET, PAS AUDIT RÉTROACTIF
// Rendre ces règles rouges sur tout l'existant produirait une gate rouge en
// permanence — donc ignorée, exactement le travers que l'audit pointe. Le
// budget est posé AU RÉEL MESURÉ, et il ne peut que baisser.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SCAN_ROOTS = ['src'];
/**
 * shadcn (non modifiable) + vitrines marketing (déjà ignorées par ESLint) +
 * `generated` : types écrits par `scripts/contrat-donnees.mjs`, jamais à la
 * main, donc hors du budget de lecture humaine (ARC-07).
 */
const EXCLUDED_DIRS = new Set(['ui', 'showcase', '__test__', 'test', 'generated']);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = SCAN_ROOTS.flatMap((root) => collectSourceFiles(path.resolve(process.cwd(), root)));
const rel = (file: string) => path.relative(process.cwd(), file).replace(/\\/g, '/');

// ═══════════════════════════════════════════════════════════════════
// 1. `supabase.from()` uniquement dans un repository
// ═══════════════════════════════════════════════════════════════════
//
// Cet invariant n'est pas cosmétique : c'est lui qui garde le pattern
// repository comme frontière de données UNIQUE côté client (un seul endroit où
// une table est lue ou écrite, donc un seul endroit à relire quand une requête
// change). Il ne rend PAS une sortie de Supabase bon marché : l'autorisation
// (RLS), les agrégats, les triggers, le cron et l'authentification vivent dans
// le SQL et dans GoTrue, pas dans les repositories. Supabase est assumé, voir
// `docs/adr/0001-supabase-assume-rls-frontiere.md`. Il était violé par
// `SettingsPage.tsx` (deux `.update()` sur `profiles`), corrigé le 2026-08-24
// par `src/modules/user/profile.repository.ts`.
//
// Les RPC (`supabase.rpc`) et l'auth (`supabase.auth`) ne sont volontairement
// PAS concernées : ce sont des appels de fonction serveur, pas de l'accès
// direct à une table, et les gater ici n'apporterait rien.
describe("architecture — `supabase.from()` ne sort pas d'un repository", () => {
  const isRepository = (file: string) =>
    /\.repository\.ts$/.test(file) || rel(file) === 'src/lib/supabase.ts';

  // Les commentaires sont retirés AVANT la recherche : sans ça, la phrase
  // « aucune page n'appelle `supabase.from()` » — écrite pour expliquer la
  // règle — déclenchait la règle. Une garde qui se mord la queue finit
  // désactivée.
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  // 🔴 TEMOIN, ajoute le 2026-09-04. Ce balayage n'avait AUCUNE assertion sur
  // la taille de son corpus : si `walk()` cessait de trouver des fichiers — un
  // chemin qui change, un dossier deplace — la garde passerait au vert en ne
  // regardant plus rien, et personne ne le verrait. `design-system.guard` et
  // `rgpd-erasure.guard` portent deja ce controle sous une autre forme
  // (`files.length > 50`, `source.length > 1000`) ; celui-ci ne l'avait pas.
  it('TEMOIN : le balayage voit reellement des fichiers', () => {
    expect(files.length).toBeGreaterThan(100);
    // Et il voit bien des fichiers de PAGE ou de COMPOSANT, pas seulement des
    // repositories : filtrer sur `isRepository` ne doit pas tout vider.
    expect(files.filter((f) => !isRepository(f)).length).toBeGreaterThan(100);
  });

  it('aucune page ni composant ne lit une table en direct', () => {
    const violations = files
      .filter((f) => !isRepository(f))
      .filter((f) => /supabase\s*[.?]*\s*\.from\s*\(/.test(stripComments(readFileSync(f, 'utf8'))))
      .map(rel);

    expect(
      violations,
      'Ces fichiers appellent `supabase.from()` hors d\'un repository :\n' +
        `${violations.join('\n')}\n` +
        'Déplacer la requête dans un `*.repository.ts` du module concerné.\n' +
        'Cf. docs/ARCHITECTURE.md §2.',
    ).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Taille des fichiers · garde-fou de DERNIER RECOURS (1 000 lignes)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 2026-11-07 (ARC-05, V17.4) : le plafond passe de 600 à 1 000 lignes, et
// change de rôle. Mesuré ce jour-là sur les 1 034 fichiers de ce périmètre :
// 25 entre 550 et 599 lignes (`wc -l`) contre 24 entre 500 et 549, et 76 % des fichiers
// de plus de 300 lignes portent une fonction au-dessus des seuils de
// complexité. Le plafond faisait TASSER le code sous la barre, sans rien dire
// des fonctions : 35 fichiers de moins de 300 lignes ont une fonction trop
// complexe ou trop longue, que `wc -l` ne voyait pas.
//
// Le signal vit désormais dans `eslint.config.js` : `complexity`, `max-depth`
// et `max-lines-per-function`, en cliquet fonction par fonction
// (`eslint-rules/complexite.guard.test.mjs`). Ce plafond-ci ne sert plus
// qu'à arrêter le fichier fourre-tout que ces règles laisseraient passer
// (beaucoup de petites fonctions). Décision, mesures et motif :
// `docs/ARCHITECTURE.md` § 3. L'historique du plafond de 600 (C-09, liste
// vidée le 2026-09-05) est dans l'historique git de ce fichier.
//
// ❌ Ne pas le rabaisser à 600 pour « reprendre la main » : c'est rouvrir le
//    tassement. Un fichier qui grossit se juge à ses fonctions.
const MAX_FILE_LOC = 1000;

/**
 * Fichiers autorisés à dépasser `MAX_FILE_LOC`. 🔴 VIDE, et doit le rester :
 * le test « pas de fichier disparu ou déjà assaini » garde la liste honnête,
 * mais rien ne peut garder honnête une liste qu'on rallonge.
 */
const KNOWN_OVERSIZED = new Set<string>([]);

/** Somme des lignes de `KNOWN_OVERSIZED` : structurellement 0, ne monte jamais. */
const OVERSIZED_BUDGET = 0;

const loc = (file: string) => readFileSync(file, 'utf8').split('\n').length;

describe('architecture — taille des fichiers source', () => {
  it(`aucun NOUVEAU fichier ne dépasse ${MAX_FILE_LOC} lignes`, () => {
    const newcomers = files
      .map((f) => ({ file: rel(f), lines: loc(f) }))
      .filter(({ file, lines }) => lines > MAX_FILE_LOC && !KNOWN_OVERSIZED.has(file))
      .map(({ file, lines }) => `${file} (${lines} lignes)`);

    expect(
      newcomers,
      'Nouveau(x) fichier(s) au-dessus du budget :\n' +
        `${newcomers.join('\n')}\n` +
        "Découper avant de livrer. Un god component ne se répare jamais plus tard —\n" +
        "les douze qu'il a fallu reprendre en 2026 sont TOUS arrivés « juste\n" +
        "au-dessus », et il a fallu quinze mois pour revenir à zéro (C-09).\n" +
        "Chercher la frontière : un geste, une surface, une dérivation, un domaine,\n" +
        "un jeu de données. Jamais une coupe à la ligne près.",
    ).toEqual([]);
  });

  it('le stock de lignes hors budget ne remonte pas', () => {
    const total = files
      .map((f) => ({ file: rel(f), lines: loc(f) }))
      .filter(({ file }) => KNOWN_OVERSIZED.has(file))
      .reduce((sum, { lines }) => sum + lines, 0);

    expect(
      total,
      `Stock hors budget : ${total} > ${OVERSIZED_BUDGET} lignes.\n` +
        "Ces fichiers doivent maigrir, pas grossir. Si un découpage fait baisser ce\n" +
        'nombre, baisser aussi OVERSIZED_BUDGET dans ce fichier.',
    ).toBeLessThanOrEqual(OVERSIZED_BUDGET);
  });

  it('la liste KNOWN_OVERSIZED ne contient pas de fichier disparu ou déjà assaini', () => {
    // Sans ce test, un fichier découpé resterait dans la liste et y ferait de
    // la place pour un futur dépassement — le cliquet reprendrait du mou en
    // silence, ce qui est pire que pas de cliquet du tout.
    const current = new Set(files.map(rel));
    const stale = [...KNOWN_OVERSIZED].filter(
      (f) => !current.has(f) || loc(path.resolve(process.cwd(), f)) <= MAX_FILE_LOC,
    );

    expect(
      stale,
      'Entrées à retirer de KNOWN_OVERSIZED (fichier supprimé, renommé, ou repassé\n' +
        `sous ${MAX_FILE_LOC} lignes — bravo) :\n${stale.join('\n')}`,
    ).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Forme unique d'un module à repository (V12.3, constat ARC-04)
// ═══════════════════════════════════════════════════════════════════
//
// Le contrat annoncé (`repository.ts` = l'interface) n'était pas tenu : sept
// `repository.ts` logeaient une classe `LocalStorage…` et ses seeds (557 lignes
// pour `okrs`), les autres avaient un `local.repository.ts`, et le factory
// mélangeait trois manières d'instancier. La forme est écrite dans
// `src/modules/CLAUDE.md` § « Forme d'un module » ; ces règles la tiennent :
//
//   a. `repository.ts` (et `<facette>.repository.ts` quand la facette a ses
//      implémentations `<facette>.local|supabase.repository.ts`) ne contient
//      que des types : ni classe, ni fonction, ni constante, ni import de valeur ;
//   b. une classe qui implémente un `I…Repository` vit dans un
//      `*local.repository.ts` ou un `*supabase.repository.ts`, nulle part
//      ailleurs, et chaque dépôt démo a son interface voisine ;
//   c. un `*local.repository.ts` ne porte pas de jeu de données `DEMO_…` : il vit
//      dans le `*local.seed.ts` voisin, seul nom de seed admis ;
//   d. le code applicatif n'importe JAMAIS statiquement un dépôt ou un seed de
//      démo : seuls `src/lib/demo-repositories.ts`, les autres fichiers démo
//      (`local.*`, `*.local.*`) et les tests le font. C'est ce qui garde la démo
//      hors du chunk d'entrée ;
//   e. le factory ne déclare ses dépôts que par `defineRepository`.
//
// Les détecteurs sont des fonctions pures, essayées d'abord sur des sources
// fabriquées (TÉMOINS) : une garde qui ne détecte plus rien passerait au vert
// en silence.

const stripCode = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** a. Lignes d'un fichier d'interface qui exécuteraient quelque chose. */
function runtimeLinesInInterfaceFile(src: string): string[] {
  const RUNTIME = [
    /^\s*(export\s+)?(default\s+)?(abstract\s+)?class\b/,
    /^\s*(export\s+)?(async\s+)?function\b/,
    /^\s*(export\s+)?(const|let|var|enum)\s/,
    /^\s*import\s+(?!type\b)/,
    /^\s*export\s*(\*|\{)/,
    /^\s*export\s+default\b/,
  ];
  return stripCode(src)
    .split('\n')
    .filter((line) => RUNTIME.some((re) => re.test(line)))
    .map((line) => line.trim());
}

/** b. Noms des classes qui implémentent un `I…Repository`. */
function repositoryClassesIn(src: string): string[] {
  return [...stripCode(src).matchAll(/class\s+(\w+)[^{]*\bimplements\b[^{]*\bI\w*Repository\b/g)].map((m) => m[1]);
}

/** c. Jeux de données `DEMO_…` (tableau ou objet littéral) déclarés au premier niveau. */
function demoSeedsIn(src: string): string[] {
  return [...stripCode(src).matchAll(/^(?:export\s+)?const\s+(DEMO_\w+)\s*(?::[^=\n]+)?=\s*[[{]/gm)].map((m) => m[1]);
}

/** d. Imports STATIQUES de valeur d'un dépôt ou d'un seed de démo (`import()` et `import type` non comptés). */
function staticDemoImportsIn(src: string): string[] {
  return [
    ...stripCode(src).matchAll(
      /^\s*(import|export)(\s+type)?\b[^;]*?\bfrom\s+'([^']*(?:local\.repository|local\.seed|demo-repositories))'/gm,
    ),
  ]
    .filter((m) => !m[2])
    .map((m) => m[3]);
}

const moduleFiles = files.filter((f) => rel(f).startsWith('src/modules/'));
const moduleFileSet = new Set(moduleFiles.map(rel));
const base = (f: string) => path.basename(f);

/** Fichiers d'interface : `repository.ts`, et `<p>.repository.ts` dont la facette a une implémentation. */
const interfaceFiles = moduleFiles.filter((f) => {
  const name = base(f);
  if (name === 'repository.ts') return true;
  const m = /^([\w-]+)\.repository\.ts$/.exec(name);
  if (!m || m[1] === 'local' || m[1] === 'supabase') return false;
  const dir = rel(path.dirname(f));
  return ['local', 'supabase'].some((side) => moduleFileSet.has(`${dir}/${m[1]}.${side}.repository.ts`));
});
const localRepositoryFiles = moduleFiles.filter((f) => /(^|\.)local\.repository\.ts$/.test(base(f)));
/** Fichiers de la démo : `local.*.ts` et `<facette>.local.*.ts`. */
const isDemoFile = (f: string) => /(^|\.)local\.[\w.-]+$/.test(base(f));

describe("architecture — forme unique d'un module à repository (V12.3)", () => {
  it('TEMOIN : les détecteurs voient ce qu’ils doivent voir', () => {
    // La régression exacte qu'ARC-04 a relevée : une classe démo et un import de
    // valeur remis dans un `repository.ts`.
    const remis = [
      "import type { X } from './types';",
      "import { safeGetItem } from '@/lib/safe-json';",
      'export interface IXRepository { getAll(): Promise<X[]> }',
      'export class LocalStorageXRepository implements IXRepository {',
      '  async getAll() { return []; }',
      '}',
    ].join('\n');
    expect(runtimeLinesInInterfaceFile(remis)).toEqual([
      "import { safeGetItem } from '@/lib/safe-json';",
      'export class LocalStorageXRepository implements IXRepository {',
    ]);
    expect(repositoryClassesIn(remis)).toEqual(['LocalStorageXRepository']);
    // Un fichier d'interface propre, commentaires compris, ne rougit pas.
    expect(
      runtimeLinesInInterfaceFile(
        "// const DEMO = [] ; class Foo {}\nimport type { X } from './types';\nexport type Y = X;\n" +
          'export interface IX {\n  get(id: string): Promise<X>;\n}',
      ),
    ).toEqual([]);
    expect(
      demoSeedsIn(
        "const DEMO_USER_ID = 'demo-user';\nconst DEMO_TASKS: Task[] = [\n];\nexport const DEMO_EN: Record<string, P> = {\n};",
      ),
    ).toEqual(['DEMO_TASKS', 'DEMO_EN']);
    expect(
      staticDemoImportsIn(
        "import { A } from '@/modules/x/local.repository';\nimport type { B } from './local.seed';\n" +
          "const m = () => import('./local.repository');\nexport { C } from './local.seed';",
      ),
    ).toEqual(['@/modules/x/local.repository', './local.seed']);
  });

  it('TEMOIN : le balayage voit réellement les modules', () => {
    // Posé sous le réel du 2026-11-07 (24 interfaces, 18 dépôts démo) : un
    // chemin qui change ne doit pas vider la garde en silence.
    expect(interfaceFiles.length).toBeGreaterThanOrEqual(20);
    expect(localRepositoryFiles.length).toBeGreaterThanOrEqual(15);
    expect(moduleFileSet.has('src/modules/okrs/repository.ts')).toBe(true);
  });

  it("a. un fichier d'interface ne contient que des types", () => {
    const violations = interfaceFiles.flatMap((f) =>
      runtimeLinesInInterfaceFile(readFileSync(f, 'utf8')).map((line) => `${rel(f)} : ${line}`),
    );
    expect(
      violations,
      "Code exécutable dans un fichier d'interface :\n" +
        `${violations.join('\n')}\n` +
        'La classe démo va dans `local.repository.ts`, ses données dans `local.seed.ts`,\n' +
        "la classe Supabase dans `supabase.repository.ts`. Cf. src/modules/CLAUDE.md § Forme d'un module.",
    ).toEqual([]);
  });

  it('b. une classe de dépôt vit dans un *local.repository.ts ou un *supabase.repository.ts', () => {
    const misplaced = moduleFiles
      .filter((f) => !/(^|\.)(local|supabase)\.repository\.ts$/.test(base(f)))
      .flatMap((f) => repositoryClassesIn(readFileSync(f, 'utf8')).map((c) => `${rel(f)} : ${c}`));
    const orphans = localRepositoryFiles
      .filter((f) => !moduleFileSet.has(rel(f).replace(/local\.repository\.ts$/, 'repository.ts')))
      .map((f) => `${rel(f)} : pas d'interface voisine`);
    expect([...misplaced, ...orphans], 'Dépôt hors de sa place :\n' + [...misplaced, ...orphans].join('\n')).toEqual([]);
  });

  it('c. les seeds vivent dans *local.seed.ts, pas dans le dépôt démo', () => {
    const seedsInRepo = localRepositoryFiles.flatMap((f) =>
      demoSeedsIn(readFileSync(f, 'utf8')).map((n) => `${rel(f)} : ${n}`),
    );
    const badNames = moduleFiles.filter((f) => /seed/i.test(base(f)) && !/(^|\.)local\.seed\.ts$/.test(base(f))).map(rel);
    const all = [...seedsInRepo, ...badNames];
    expect(all, `Seed hors de \`local.seed.ts\` :\n${all.join('\n')}`).toEqual([]);
  });

  it("d. aucun code applicatif n'importe statiquement la démo", () => {
    const violations = files
      .filter((f) => rel(f) !== 'src/lib/demo-repositories.ts' && !isDemoFile(f))
      .flatMap((f) => staticDemoImportsIn(readFileSync(f, 'utf8')).map((spec) => `${rel(f)} : ${spec}`));
    expect(
      violations,
      'Import statique de la démo hors des fichiers démo :\n' +
        `${violations.join('\n')}\n` +
        "Passer par `lazy(() => import(...))` (src/lib/define-repository.ts) : un import statique est\n" +
        "retenu dans le chunk de l'importeur même quand sa branche est morte (123,9 ko le 2026-09-02).",
    ).toEqual([]);
  });

  it('e. le factory ne déclare ses dépôts que par defineRepository', () => {
    const factory = stripCode(readFileSync(path.resolve(process.cwd(), 'src/lib/repository.factory.ts'), 'utf8'));
    const getters = [...factory.matchAll(/^export\s+(?:const|function)\s+(get\w+Repository)\b(.*)$/gm)];
    expect(getters.length).toBeGreaterThanOrEqual(15);
    const handwritten = getters.filter((m) => !/^\s*=\s*defineRepository</.test(m[2])).map((m) => m[1]);
    const singletons = [...factory.matchAll(/^let\s+(\w+)/gm)].map((m) => m[1]);
    expect([...handwritten, ...singletons], 'Accesseur ou singleton écrit à la main dans le factory').toEqual([]);
  });
});
