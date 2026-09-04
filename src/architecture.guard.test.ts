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
  'src/components/organization/PyramidTab.tsx', // 1046 (etait 1506 — NodeCard extrait le 2026-08-24)
  'src/components/TaskTable.tsx', // 890 (etait 1124 — filtres rapides et barre d'actions groupees extraits le 2026-08-29)
  'src/pages/AgendaPage.tsx', // 900
  'src/pages/SettingsPage.tsx', // 850
  'src/components/InboxMenu.tsx', // 802
  'src/components/task-modal/useTaskModal.ts', // 719
  'src/pages/TasksPage.tsx', // 712
  'src/modules/team-projects/local.repository.ts', // 710
  'src/components/task-modal/DesktopDetailsStep.tsx', // 703
  'src/components/task-modal/TaskModalMobileBody.tsx', // 698
  'src/components/organization/TeamTaskModal.tsx', // 685
  'src/pages/tasks/TaskListsBar.tsx', // 616
]);

/**
 * Somme des lignes des fichiers ci-dessus.
 *
 * 2026-08-24 (initial) : 17 fichiers, 13 103 lignes — dont 601 pour
 * `friends/supabase.repository.ts`, oublié du premier comptage manuel
 * (troisième fois que le comptage à la main se trompe dans cet audit : c’est
 * l’argument de ce fichier).
 *
 * 2026-08-25 (permissions par membre, mig. 115) : **15 fichiers, 11 915 lignes.**
 * `TeamProjectsTab.tsx` est sorti de la liste (603 → 576) par extraction de
 * `use-team-tasks-selection.ts`. Même mécanique que la fois précédente : la
 * feature ajoutait une poignée de lignes à trois fichiers déjà hors budget, le
 * cliquet a refusé la croissance nette, la découpe a suivi.
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
/**
 * 2026-08-24 (3e passe) : 11 915 -> 11 454, et le plus gros fichier du depot n'est
 * plus PyramidTab. Ses 385 lignes de `NodeCard` (le rendu recursif d'une carte)
 * sont parties dans `PyramidNodeCard.tsx` : 1 506 -> 1 046.
 *
 * La coupe suit une frontiere reelle, pas un compte de lignes : d'un cote le rendu
 * D'UNE carte, de l'autre l'orchestration de l'arbre (recherche, repli,
 * glisser-deposer, sheets). Aucune logique n'a change.
 *
 * PyramidTab reste hors budget a 1 046 : le decoupage n'est pas fini, il est
 * commence. La suite naturelle est d'extraire le glisser-deposer dans un hook.
 *
 * 2026-08-27 (4e passe) : 11 454 -> 10 811, 15 fichiers -> 14.
 * `TeamTasksTab.tsx` sort de la liste (651 -> 573) par extraction de
 * `TeamTasksToolbar.tsx` (recherche, tri, creation, filtres de statut).
 *
 * Et c'est encore le cliquet qui l'a impose, pour la quatrieme fois : le
 * correctif d'etat de chargement ajoutait 9 lignes a ce fichier deja hors
 * budget, le total est passe a 11 463, la garde a refuse. La decoupe a suivi.
 * La barre d'outils extraite est purement presentationnelle — aucun etat de
 * filtre n'a bouge, il reste dans l'onglet qui sait ce qu'il filtre.
 */
/**
 * 2026-08-29 (5e passe, T-45) : 10 185 -> 9 949, et le plus gros fichier du depot
 * n'est plus `TaskTable` : 1 124 -> 890, sous la barre des 900.
 *
 * Deux extractions, deux frontieres reelles : `TaskQuickFilters` (les cinq
 * pastilles et la portee perso / entreprise) et `TaskBulkActionsBar` (la barre du
 * mode selection). Aucune des deux ne connait une tache : elles recoivent un
 * nombre, des libelles, et rappellent. Toute la logique metier reste dans
 * `TaskTable`, seul a savoir ce qui est selectionne.
 *
 * ⚠️ Difference avec les quatre passes precedentes : celle-ci n'a PAS ete imposee
 * par le cliquet. C'est une coupe volontaire, la seule que la roadmap prevoyait
 * (T-45), et elle emporte un vrai defaut au passage : l'etat du menu « ... »
 * vivait dans `TaskTable`, ce qui obligeait cinq gestionnaires metier a le
 * refermer a la main. Il vit maintenant dans la barre, qui disparait avec le mode
 * selection : il n'y a plus rien a remettre a zero, donc plus d'oubli possible.
 */
// 2026-08-30 : 9949 → 9905. Le remplacement du picker de date natif par le
// calendrier COSMO ajoutait ~35 lignes à `TaskTable` ; le bandeau « En retard »
// a été extrait dans `task-table/OverdueBanner.tsx` à cette occasion. Le
// cliquet se resserre comme le demande le message d'échec de ce test.
// 2026-09-02 : 9905 → 9903. Même mécanique que la ligne du dessus, deuxième
// occurrence. Les correctifs R-16 (écouteur `pointerup` qui s'accumulait) et
// R-18 (report de créneau calculé en heure machine) ont fait remonter le stock
// à 9941, soit 36 lignes au-dessus. La revue des créneaux passés a donc été
// extraite dans `pages/agenda/useOverdueSlotReview.ts` : quatre gestionnaires,
// un état et un dérivé qui ne parlaient qu'entre eux. Aucun comportement
// changé, les corps sont repris à l'identique.
// 🔴 Le réflexe à ne pas avoir : relever ce nombre. C'est un cliquet, il ne
// tourne que dans un sens, et c'est ce qui l'a rendu utile deux fois de suite.
// 2026-09-02 (2) : 9903 → 9835. Troisième occurrence, même mécanique. Les
// correctifs R-02 (impact et réaffectation avant de supprimer une catégorie),
// R-07 (l'abandon d'un créneau devient annulable) et R-08 (« Annuler » restaure
// l'identifiant d'origine) ont dépassé le stock de 13 lignes. Compensé par
// l'extraction du dépôt de photo de profil dans `pages/settings/useAvatarUpload.ts`
// (71 lignes hors de `SettingsPage`). Au passage, `modules/tasks/hooks.ts` avait
// franchi le plafond des NOUVEAUX fichiers : `useRestoreTask` vit désormais dans
// `modules/tasks/restore.hooks.ts`, ce qui rend aussi visible qu'une restauration
// n'est pas une création.
// 2026-09-02 (3) : 9835 → 9791. L'externalisation des 179 chaînes en dur (R-05)
// a ajouté un traducteur `tCommon` dans plusieurs fichiers déjà hors budget.
// Compensé par l'extraction des actions sur un événement dans
// `pages/agenda/useAgendaEventActions.ts` (76 lignes hors d'`AgendaPage`).
// 2026-09-03 : 9791 → 9190, 13 fichiers → 12. `friends/supabase.repository.ts`
// sort de la liste (601 → 592) : l'externalisation de ses messages d'erreur a
// remplacé des littéraux par des appels au catalogue, plus courts. Le fichier
// est repassé sous la barre tout seul, sans découpe.
// ⚠️ Sortir un fichier de la liste ne suffit pas : le stock doit baisser
// D'AUTANT, sinon les 592 lignes libérées deviennent du mou distribué aux douze
// fichiers restants, et le cliquet a reculé sans que personne ne le voie. Le
// nombre ci-dessous est le stock RÉEL des douze, mesuré, pas déduit.
const OVERSIZED_BUDGET = 9190;

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
        'les 12 fichiers de KNOWN_OVERSIZED sont tous arrivés « juste au-dessus ».',
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
