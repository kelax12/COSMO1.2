// Garde statique du design system mobile (cf. docs/MOBILE.md).
//
// Le mobile de COSMO a dérivé parce que chaque composant inventait sa propre
// taille de texte : `text-[8px]`, `[9px]`, `[10px]`, `[11px]`, `[13px]`,
// `[15px]`, `[17px]` coexistaient avec les 9 tailles Tailwind — d'où un rendu
// illisible et incohérent sur téléphone.
//
// L'échelle mobile est désormais FERMÉE à 6 crans
// (display / title / headline / body / label / caption), plancher 11px.
//
// Ce fichier pose deux gardes de nature différente :
//
//  1. `ENFORCED_SCOPE` — plancher DUR de 11px. Toute zone déjà migrée y entre.
//     Le desktop n'y est volontairement pas : le migrer changerait son rendu,
//     ce qui est hors périmètre de la refonte mobile.
//  2. Budget global — le stock de tailles arbitraires restantes ne doit jamais
//     augmenter. Chaque migration doit faire BAISSER `ARBITRARY_BUDGET`.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

/** Zones où le plancher de 11px est appliqué strictement. À étendre à chaque migration.
 *  N'y entrent que les dossiers totalement exempts de `text-[Npx]`, y compris
 *  les variantes `md:`/`sm:` qui préservent volontairement un rendu desktop
 *  existant (le regex ne distingue pas le préfixe responsive). OKR/Statistiques/
 *  Agenda gardent quelques tailles arbitraires *desktop-only* (`md:text-[10px]`)
 *  pour ne jamais changer le rendu desktop lors de la migration mobile — elles
 *  restent donc hors de ce tableau, mais le budget global ci-dessous a bien
 *  baissé pour ces pages. Cf. docs/MOBILE.md.
 *
 *  Dashboard (2026-07-25) : mêmes règles. `src/pages/DashboardPage.tsx` et
 *  `InboxMenu.tsx` gardent chacun un `md:text-[10px]` desktop-only (tooltip du
 *  mini-graphique / badge de la boîte de réception) — même exception
 *  qu'OKR/Statistiques/Agenda — donc restent hors de ce tableau.
 *  `TodayTasks.tsx`, `MobileCollapsible.tsx`, `DemoConversionBanner.tsx`,
 *  `ActiveOKRs.tsx`, `TodayHabits.tsx` et `CollaborativeTasks.tsx` sont
 *  entièrement sur l'échelle mobile et y entrent. */
const ENFORCED_SCOPE = [
  'src/components/mobile',
  'src/pages/settings',
  'src/pages/premium',
  'src/components/TodayTasks.tsx',
  'src/components/MobileCollapsible.tsx',
  'src/components/DemoConversionBanner.tsx',
  'src/components/ActiveOKRs.tsx',
  'src/components/TodayHabits.tsx',
  'src/components/CollaborativeTasks.tsx',
];

const SCAN_ROOTS = ['src/components', 'src/pages'];
/** shadcn (non modifiable) + showcases marketing (déjà ignorés par ESLint). */
const EXCLUDED_DIRS = new Set(['ui', 'showcase']);

/**
 * Stock de tailles arbitraires en px hors zone migrée, mesuré au 2026-07-23
 * après migration de Réglages/OKR/Statistiques/Premium/Habitudes/Dashboard/Agenda.
 * Ce nombre ne doit JAMAIS monter. Il baisse au fil des pages migrées.
 *
 * ── 2026-08-07 : 202 → 204, et pourquoi c'est une hausse ASSUMÉE ──
 *
 * Ce test était ROUGE sur `main` (206 > 202) : quatre tailles arbitraires ont
 * été ajoutées après la pose du budget, et des commits sont passés dessus.
 * C'est le symptôme que l'audit architecture 2026-08-07 (H6) pointe — une gate
 * rouge en permanence finit par être ignorée. Analyse des quatre :
 *
 *  • ModuleOnboarding.tsx  `text-[11px]` → `text-caption`  ✅ corrigé (0 px d'écart)
 *  • TasksInboxMenu.tsx    `text-[10px]` → `text-caption`  ✅ corrigé (sous le
 *    plancher de 11px, donc violation franche de la règle)
 *  • TaskModalMobileBody.tsx : DEUX `text-[15px]` de plus, dans un fichier qui
 *    en compte déjà 28. Ce composant reproduit délibérément les métriques
 *    natives iOS (15/17px) et n'a jamais été migré ; ses deux ajouts sont
 *    cohérents avec son système LOCAL. Les migrer isolément produirait un
 *    fichier à moitié sur chaque échelle — pire que le statu quo.
 *
 * Le budget monte donc de 2, pas de 4, et l'écart est tracé plutôt que masqué.
 *
 * ── Puis 204 → 203 : la dernière violation FRANCHE du plancher ──
 *
 * `TaskModalMobileBody.tsx` contenait aussi un `text-[10px]` (badge « Envoyé »),
 * SOUS le plancher de 11px. Contrairement à ses 15/17px — cohérents entre eux
 * et alignés sur les métriques natives iOS — une taille sous le plancher n'est
 * la cohérence de rien : c'est juste illisible. Migrée en `text-caption`.
 * ➜ DETTE OUVERTE : migrer TaskModalMobileBody.tsx en entier
 *   (`text-[15px]` → `text-body`, `text-[17px]` → `text-headline` — mêmes px,
 *   line-height différente, donc à vérifier visuellement). Ce jour-là, ce
 *   budget doit tomber d'environ 30.
 *
 * ── 2026-08-24 : 205 (ROUGE) → 202 ──
 *
 * La vague entreprise du 2026-08-23/24 avait fait remonter le stock à 205 et
 * `main` était rouge. Les quatre ajouts étaient tous des violations FRANCHES
 * (deux `text-[10px]`, un `text-[9px]`, tous sous le plancher de 11px, dans
 * des fichiers qui n'ont aucun système local à préserver — contrairement à
 * `TaskModalMobileBody`) : migrés en `text-caption`.
 *   • TeamAssigneeGroups.tsx  `text-[10px]` → `text-caption`
 *   • TeamsSection.tsx        `text-[10px]` → `text-caption`
 *   • TeamTasksTab.tsx        `text-[10px]` et `text-[9px]` → `text-caption`
 * Le budget descend donc à 202 et le plancher sub-11px à 82, conformément à
 * la règle « chaque migration doit faire BAISSER ces nombres ».
 */
// 2026-08-24 (2e passe) : 202 -> 199, plancher sub-11px 82 -> 79.
// La garde etait ROUGE a l'arrivee de cette passe (203 > 202) : un badge
// `text-[10px]` etait entre par la vague entreprise APRES que le budget ait
// ete pose. Les quatre badges de `TeamProjectCard.tsx` sont passes en
// `text-caption`. C'est la deuxieme fois en une journee que cette garde
// attrape la meme chose au meme endroit : le mode entreprise n'a jamais ete
// migre sur l'echelle typographique, il la contourne badge par badge.
const ARBITRARY_BUDGET = 199;

/** `text-[10px]` → capture "10". Ignore rem/%/var — seul le px pose problème. */
const ARBITRARY_TEXT_SIZE = /text-\[(\d+(?:\.\d+)?)px\]/g;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc; // dossier pas encore créé (ex. src/components/mobile au 1er run)
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
const isEnforced = (file: string) => ENFORCED_SCOPE.some((scope) => rel(file).startsWith(scope));

describe('design system mobile — échelle typographique', () => {
  it('trouve bien des fichiers source à analyser', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('interdit toute taille de texte arbitraire dans les zones migrées', () => {
    const violations = files
      .filter(isEnforced)
      .flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(ARBITRARY_TEXT_SIZE)].map(
          (m) => `${rel(file)} → ${m[0]}`,
        ),
      );

    expect(
      violations,
      "Zone migrée : utiliser l'échelle mobile " +
        '(text-display/title/headline/body/label/caption), pas une taille arbitraire :\n' +
        violations.join('\n'),
    ).toEqual([]);
  });

  it('interdit partout une taille sous le plancher de 11px', () => {
    // Le plancher bas s'applique même hors zone migrée : personne ne doit
    // AJOUTER un nouveau text-[8px]. Les occurrences historiques sont listées
    // ici — cette liste ne doit que rétrécir.
    const KNOWN_SUB_11PX = 79;

    const count = files.reduce(
      (sum, file) =>
        sum +
        [...readFileSync(file, 'utf8').matchAll(ARBITRARY_TEXT_SIZE)].filter(
          (m) => Number(m[1]) < 11,
        ).length,
      0,
    );

    expect(
      count,
      `${count} tailles sous 11px détectées (référence : ${KNOWN_SUB_11PX}). ` +
        "Ne jamais en ajouter : le plancher mobile est text-caption (11px).",
    ).toBeLessThanOrEqual(KNOWN_SUB_11PX);
  });

  it('ne laisse pas repartir à la hausse le stock de tailles arbitraires', () => {
    const total = files.reduce(
      (sum, file) => sum + [...readFileSync(file, 'utf8').matchAll(ARBITRARY_TEXT_SIZE)].length,
      0,
    );

    expect(
      total,
      `Stock de tailles arbitraires : ${total} > budget ${ARBITRARY_BUDGET}. ` +
        "Utiliser l'échelle mobile. Si une migration fait baisser ce nombre, " +
        'baisser aussi ARBITRARY_BUDGET dans ce fichier.',
    ).toBeLessThanOrEqual(ARBITRARY_BUDGET);
  });
});


// ═══════════════════════════════════════════════════════════════════
// Échelle z-index — liste FERMÉE (cf. docs/UI-PATTERNS.md)
// ═══════════════════════════════════════════════════════════════════
//
// L'audit UI du 2026-08-14 a compté « 8 valeurs hors barème » et proposé de
// les rabattre sur les 7 paliers publiés. En les relisant une par une, ce
// n'était pas le bon diagnostic : ces valeurs ne sont pas des accidents, elles
// portent un ORDRE réel et voulu — `AdModal` (300) doit passer devant
// `CookieBanner` (200), `PageTutorial` (500) devant tout le chrome, un popover
// ouvert DANS une feuille portalisée (10000) devant la feuille (9999). Les
// rabattre sur 7 paliers aurait créé des collisions d'empilement pour faire
// entrer la réalité dans un tableau.
//
// Le vrai défaut était donc l'inverse de celui écrit : le barème publié ne
// décrivait que la moitié des couches réelles. On publie l'échelle COMPLÈTE et
// on la ferme ici. Deux valeurs seulement étaient de vrais accidents et ont été
// migrées : `z-[3]` (décor du hero entreprise, dans un parent `opacity-60` qui
// crée son propre contexte d'empilement — la valeur n'avait aucun effet) et
// `z-[75]` (`CompletedOKRsModal`, ramené sur le cran `z-[70]` voisin).
//
// La leçon est celle du reste du dossier : une échelle publiée sans outil ne
// tient pas. Elle avait été écrite en juillet 2026 et chaque composant livré
// depuis avait repris l'habitude de choisir sa valeur.
const Z_LADDER = new Set([
  60, 70, 80, 90,   // couches successives AU-DESSUS d'un modal ouvert
  100, 110,         // popovers Radix par-dessus un modal (110 = imbriqué dans 100)
  150,              // modal plein écran au-dessus du chrome applicatif
  190, 200,         // surfaces système (bannières, CommandPalette, PremiumGate)
  250, 300,         // interstitiels au-dessus des surfaces système
  500,              // tutoriel de page — au-dessus de tout le chrome
  9999, 10000,      // createPortal + fixed (feuille, puis popover dans la feuille)
]);

const ARBITRARY_Z = /z-\[(\d+)\]/g;

describe('design system — échelle z-index', () => {
  it("n'utilise aucune valeur de z-index hors de l'échelle publiée", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(ARBITRARY_Z)) {
        const value = Number(m[1]);
        if (!Z_LADDER.has(value)) offenders.push(`${rel(file)} → z-[${value}]`);
      }
    }
    expect(
      offenders,
      [
        'Valeur(s) de z-index hors échelle :',
        ...offenders,
        'Choisir un cran existant (docs/UI-PATTERNS.md → Échelle z-index).',
        "Si aucun cran ne convient, AJOUTER le cran ici ET dans la doc — mais justifier l'ordre voulu :",
        'un z-index inventé au cas par cas est exactement ce qui a produit 16 valeurs pour 7 paliers documentés.',
      ].join('\n'),
    ).toEqual([]);
  });
});


// ═══════════════════════════════════════════════════════════════════
// Mouvement des feuilles — `useSheetMotion`, pas un `y` en dur
// ═══════════════════════════════════════════════════════════════════
//
// `App.tsx` monte `<MotionConfig reducedMotion="user">`. MESURÉ dans le
// navigateur le 2026-08-24 (viewport 375x812, `prefers-reduced-motion: reduce`
// réellement actif, mode démo) : une feuille écrite
// `initial={{ y: '100%' }} animate={{ y: 0 }}` reste à
// `transform: matrix(1, 0, 0, 1, 0, 510)` — `top: 812` pour un viewport de 812,
// soit **0 px visible**. Le voile s'affiche, la feuille non.
//
// Le cas mesuré était `MobileMoreSheet` : le SEUL accès mobile à OKR,
// Statistiques, Paramètres et à la déconnexion. La navigation mobile était donc
// sans issue pour les utilisateurs en mouvement réduit — et invisible pour tous
// les autres, ce qui explique que ça ait tenu si longtemps.
//
// FORME : CLIQUET. Les fichiers ci-dessous portent encore un `y: '100%'` écrit
// à la main. Tous ne sont pas cassés — un `initial` qui contient AUSSI une clé
// non-transform se résout correctement (vérifié sur `WeeklyCheckinModal`, qui
// s'ouvre bien). Les rendre tous rouges d'un coup produirait une gate rouge en
// permanence, donc ignorée. La liste ne peut que RÉTRÉCIR : aucun nouveau
// fichier ne doit y entrer, et `useSheetMotion()` est le chemin par défaut.
const KNOWN_HANDROLLED_SHEETS = new Set([
  'src/components/AdModal.tsx',
  'src/components/ColorSettingsModal.tsx',
  'src/components/CompletedOKRsModal.tsx',
  'src/components/ConfirmDiscardDialog.tsx',
  'src/components/HabitModal.tsx',
  'src/components/LoginModal.tsx',
  'src/components/PremiumGateModal.tsx',
  'src/components/ShareInviteClaimer.tsx',
  'src/components/ShareListSheet.tsx',
  'src/components/TaskTable.tsx',
  'src/components/WeeklyCheckinModal.tsx',
  'src/components/add-to-list/MobileAddToList.tsx',
  'src/components/event-modal/EventModalForm.tsx',
  'src/components/event-modal/RecurrenceDaysModal.tsx',
  'src/components/mobile/BottomSheet.tsx',
  'src/components/task-modal/DeleteTaskConfirm.tsx',
  'src/pages/okr/DeleteObjectiveConfirm.tsx',
]);

// Le seul endroit ou `y: '100%'` est LEGITIME : le helper lui-meme, qui ne
// l'emet que lorsque le mouvement n'est PAS reduit.
const SHEET_MOTION_HOME = 'src/components/mobile/mobile-motion.ts';

const SHEET_SLIDE = /y:\s*['"]100%['"]/;

describe('design system — mouvement des feuilles sous mouvement réduit', () => {
  it("n'introduit aucune nouvelle feuille avec un `y: '100%'` écrit à la main", () => {
    const newcomers = files
      .filter((file) => SHEET_SLIDE.test(readFileSync(file, 'utf8')))
      .map(rel)
      .filter((file) => file !== SHEET_MOTION_HOME && !KNOWN_HANDROLLED_SHEETS.has(file));

    expect(
      newcomers,
      [
        'Feuille(s) animée(s) à la main :',
        ...newcomers,
        "Utiliser `useSheetMotion()` (src/components/mobile/mobile-motion.ts).",
        "Sous `prefers-reduced-motion`, un `initial={{ y: '100%' }}` peut rester",
        'appliqué : la feuille s ouvre alors 100 % sous l écran. Mesuré, pas supposé.',
      ].join('\n'),
    ).toEqual([]);
  });

  it('ne laisse pas la liste garder un fichier déjà migré', () => {
    const stale = [...KNOWN_HANDROLLED_SHEETS].filter((file) => {
      const full = files.find((f) => rel(f) === file);
      return full && !SHEET_SLIDE.test(readFileSync(full, 'utf8'));
    });

    expect(
      stale,
      [
        'Fichier(s) migré(s) mais encore listé(s) :',
        ...stale,
        'Les retirer de KNOWN_HANDROLLED_SHEETS — sinon la liste reprend du mou',
        'et un futur `y: 100%` y passerait inaperçu.',
      ].join('\n'),
    ).toEqual([]);
  });
});
