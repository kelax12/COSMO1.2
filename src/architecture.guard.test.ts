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
/** shadcn (non modifiable) + vitrines marketing (déjà ignorées par ESLint). */
const EXCLUDED_DIRS = new Set(['ui', 'showcase', '__test__', 'test']);

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
// repository comme frontière de données UNIQUE, donc ce qui rend une sortie de
// Supabase envisageable en jours plutôt qu'en mois. Il était violé par
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
// 2. Taille des fichiers — cliquet
// ═══════════════════════════════════════════════════════════════════
//
// Objectif du refactor de juin 2026 : aucun fichier source > 600 lignes.
// L'objectif a cédé pendant la construction du mode entreprise. On ne peut pas
// le rétablir d'un test — découper `PyramidTab.tsx` (1 505 lignes) est un
// chantier, pas un correctif. Mais on peut arrêter l'hémorragie, et c'est ce
// que fait ce cliquet :
//
//   • aucun NOUVEAU fichier ne dépasse 600 lignes ;
//   • le total des fichiers déjà hors budget ne remonte JAMAIS.
//
// Le budget en TOTAL plutôt que par fichier est délibéré : il autorise à
// déplacer du code entre deux gros fichiers pendant un refactor en cours, tout
// en interdisant la croissance nette. Chaque découpage doit faire BAISSER
// `OVERSIZED_BUDGET`.
const MAX_FILE_LOC = 600;

/**
 * Fichiers hors budget au 2026-08-24, avec leur taille d'alors. Cette liste ne
 * doit que RÉTRÉCIR. Y ajouter un fichier est un aveu, pas une solution.
 */
const KNOWN_OVERSIZED = new Set([
  'src/components/organization/PyramidTab.tsx', // 1505 — le pire, à découper en premier
  'src/components/TaskTable.tsx', // 1124
  'src/pages/AgendaPage.tsx', // 900
  'src/pages/SettingsPage.tsx', // 850
  'src/components/InboxMenu.tsx', // 802
  'src/components/task-modal/useTaskModal.ts', // 719
  'src/pages/TasksPage.tsx', // 712
  'src/modules/team-projects/local.repository.ts', // 710
  'src/components/task-modal/DesktopDetailsStep.tsx', // 703
  'src/components/task-modal/TaskModalMobileBody.tsx', // 698
  'src/components/organization/TeamTaskModal.tsx', // 685
  'src/components/organization/TeamTasksTab.tsx', // 633
  'src/modules/auth/AuthContext.tsx', // 626
  'src/pages/tasks/TaskListsBar.tsx', // 615
  'src/components/organization/TeamProjectsTab.tsx', // 603
  'src/modules/friends/supabase.repository.ts', // 601
]);

/**
 * Somme des lignes des fichiers ci-dessus.
 *
 * 2026-08-24 (initial) : 17 fichiers, 13 103 lignes — dont 601 pour
 * `friends/supabase.repository.ts`, oublié du premier comptage manuel
 * (troisième fois que le comptage à la main se trompe dans cet audit : c’est
 * l’argument de ce fichier).
 *
 * 2026-08-24 (2ᵉ passe) : **16 fichiers, 12 503 lignes.**
 * `team-projects/supabase.repository.ts` est sorti de la liste (601 → 483) par
 * extraction de `supabase.mappers.ts`. Et c'est le cliquet lui-même qui l'a
 * imposé : le correctif de scalabilité (mig. 113) ajoutait du commentaire à ce
 * fichier, le budget a refusé la croissance nette, la découpe a suivi. C'est
 * exactement le comportement recherché — la garde ne demande pas de refactor,
 * elle rend le refactor moins cher que le contournement.
 *
 * Ne doit JAMAIS monter. Un découpage la fait baisser — baisser aussi ce
 * nombre le jour où c'est fait, sinon le cliquet reprend du mou.
 */
const OVERSIZED_BUDGET = 12503;

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
        'les 16 fichiers de KNOWN_OVERSIZED sont tous arrivés « juste au-dessus ».',
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
