// ═══════════════════════════════════════════════════════════════════
// C-96 — 10 surfaces modales MESURÉES au clavier sur 51
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LA DISTINCTION QUI FAIT TOUT L'ITEM. `modal-a11y.guard.test.ts` garantit
// que chaque surface modale IMPORTE `useModalA11y` : c'est un CÂBLAGE, vérifié
// statiquement, et c'est déjà beaucoup. Mais câblé n'est pas mesuré.
// `e2e/a11y-keyboard-audit.spec.ts` ouvre 10 surfaces et vérifie au clavier
// ce qui s'y passe réellement. Les 41 autres sont câblées, et personne ne les
// a jamais parcourues à la touche Tab.
//
// L'écart était INVISIBLE : deux chiffres dans deux fichiers différents, que
// rien ne rapprochait. C'est exactement la forme du défaut de C-80, où un
// « 0 cible tactile sous 44 px » décrivait huit routes protégées et se lisait
// comme une propriété du produit.
//
// ── CE QUE CETTE GARDE FAIT, ET CE QU'ELLE NE FAIT PAS ──────────────
//
// ✅ Elle NOMME l'écart, surface par surface, avec une raison par ligne. Une
//    surface neuve arrive donc sans raison, et la garde rougit : on ne peut
//    plus élargir le produit sans dire ce qu'on ne mesure pas.
// ✅ Elle vérifie que les surfaces déclarées MESURÉES le sont vraiment, en
//    relisant le spec : une mesure retirée du spec fait rougir ici.
//
// ❌ Elle NE mesure PAS l'accessibilité au clavier. Ce serait le travail du
//    spec Playwright, et l'étendre aux 51 surfaces demande d'ouvrir chacune
//    par un parcours réel — dont plusieurs sont inatteignables en mode démo
//    (mode entreprise avec une organisation peuplée, `FirstRunSetup` hors
//    démo). Cette garde ne remplace pas ce travail : elle le CHIFFRE et
//    l'empêche de grandir en silence.
//
// ❌ NE JAMAIS ÉCRIRE « les modales sont accessibles au clavier ». Écrire
//    combien : 10 mesurées sur 51 câblées, au 2026-09-20.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(process.cwd(), 'src');
const SPEC = join(process.cwd(), 'e2e', 'a11y-keyboard-audit.spec.ts');

/**
 * Les surfaces MESURÉES par `e2e/a11y-keyboard-audit.spec.ts`.
 *
 * La clé est le fichier de la surface ; la valeur est un fragment du nom du
 * cas qui la mesure. 🔴 Le fragment est VÉRIFIÉ contre le spec : sans ça,
 * cette liste deviendrait une déclaration d'intention, et une mesure
 * supprimée du spec resterait comptée ici.
 */
const MESUREES: Record<string, string> = {
  'components/HabitModal.tsx': 'MESURE — HabitModal',
  'components/EventModal.tsx': 'MESURE — EventModal',
  'components/layout/MobileMoreSheet.tsx': 'MESURE — MobileMoreSheet',
  'components/task-table/TaskActionsSheet.tsx': 'MESURE — TaskActionsSheet',
  'components/add-to-list/MobileAddToList.tsx': 'MESURE — MobileAddToList',
  'components/ShareListSheet.tsx': 'MESURE — ShareListSheet',
  'components/event-modal/RecurrenceDaysModal.tsx': 'prend le piège, puis le rend',
  'pages/agenda/RecurringEventsManager.tsx': 'prend le piège, puis le rend',
  'components/ConfirmDiscardDialog.tsx': 'Échap passe par guardedClose',
  'components/task-modal/DeleteTaskConfirm.tsx': 'prend le piège, puis le rend',
};

/**
 * Les surfaces NON MESURÉES, et pourquoi. Une ligne par surface.
 *
 * ⚠️ Les raisons se répartissent en trois familles, et seule la troisième est
 * une vraie dette :
 *   · INATTEIGNABLE EN DÉMO — le mode entreprise demande une organisation
 *     peuplée, des rôles, parfois un abonnement. Le project `supabase-stub`
 *     existe pour ça et ne porte que quatre parcours ;
 *   · VARIANTE D'UNE SURFACE DÉJÀ MESURÉE — même composant de base, même
 *     piège ; la mesurer deux fois mesurerait le même code ;
 *   · NON MESURÉE, SANS OBSTACLE — la dette. Elle est nommée comme telle.
 */
const NON_MESUREES: Record<string, string> = {
  'components/BugReportModal.tsx':
    'dette : atteignable en démo, jamais parcourue au clavier.',
  'components/CollaborativeTasks.tsx':
    'dette : atteignable en démo depuis une tâche partagée.',
  'components/ColorSettingsModal.tsx': 'dette : atteignable depuis /settings.',
  'components/CommandPalette.tsx':
    'dette, et la plus gênante des trois : une palette de commandes EST un '
    + 'geste clavier. Elle devrait être la première mesurée.',
  'components/CompletedOKRsModal.tsx': 'dette : atteignable depuis /okr.',
  'components/organization/OrgSectionSwitcher.tsx':
    'dette : atteignable en démo sur mobile (/entreprise, sélecteur de section). '
    + 'Échap vérifié à la main le 2026-09-23, piège de focus jamais mesuré.',
  'components/organization/MemberBulkPicker.tsx':
    'dette : atteignable en démo (/entreprise/members, Sélectionner, puis une '
    + 'action groupée). Câblée sur useModalA11y, jamais parcourue au clavier.',
  'components/LoginModal.tsx':
    'inatteignable en démo : elle ne s ouvre que sur une session expirée.',
  'components/OKRDeadlineReviewModal.tsx':
    'inatteignable sans un OKR dont l échéance tombe dans la fenêtre de revue.',
  'components/PremiumGateModal.tsx':
    'inatteignable : `PREMIUM_ENFORCED` est à false, aucune gate ne s ouvre '
    + '(décision 2026-06-11, le partage est gratuit).',
  'components/QuickAddBar.tsx': 'dette : atteignable en démo.',
  'components/RemoveFriendConfirm.tsx': 'dette : atteignable depuis les amis.',
  'components/ShareInviteClaimer.tsx':
    'inatteignable en démo : exige un lien d invitation valide, donc le '
    + 'project `supabase-stub`.',
  'components/ShortcutsHelp.tsx':
    'dette, et ironique : l aide des raccourcis clavier n est pas mesurée au clavier.',
  'components/TodayTasks.tsx': 'dette : atteignable sur /dashboard.',
  'components/WeeklyCheckinModal.tsx':
    'inatteignable : ne s ouvre qu à un moment précis de la semaine.',
  'components/add-to-list/BulkAddToListModal.tsx':
    'variante de `MobileAddToList`, mesurée : même corps, même piège, ouverture '
    + 'depuis la barre de sélection.',
  'components/add-to-list/DesktopAddToList.tsx':
    'variante desktop de `MobileAddToList`, mesurée.',
  'components/category/DeleteCategoryDialog.tsx': 'dette : atteignable depuis /settings.',
  'components/category/MoveCategoryDialog.tsx': 'dette : atteignable depuis /settings.',
  'components/mobile/BottomSheet.tsx':
    'PRIMITIVE, pas une surface : c est elle que montent la plupart des '
    + 'feuilles ci-dessus, et quatre de ses consommatrices sont mesurées.',
  'components/onboarding/FirstRunSetup.tsx':
    'inatteignable en démo par conception (`!isDemo`) — c est même le parcours '
    + 'qui a motivé la création du project `supabase-stub`.',
  'components/organization/AddUnderSheet.tsx': 'mode entreprise : exige une organisation peuplée.',
  'components/organization/AssignEventDialog.tsx': 'mode entreprise.',
  'components/organization/AssignTaskSheet.tsx': 'mode entreprise.',
  'components/organization/CreateTeamModal.tsx': 'mode entreprise.',
  'components/organization/DeleteOrganizationDialog.tsx':
    'mode entreprise, et destructrice : elle est parcourue par `e2e/stubbed/delete-org.spec.ts`, '
    + 'mais à la souris, pas au clavier.',
  'components/organization/DeleteTeamCategoryConfirm.tsx': 'mode entreprise.',
  'components/organization/InviteOrJoinModal.tsx': 'mode entreprise.',
  'components/organization/MemberPermissionsSheet.tsx': 'mode entreprise.',
  'components/organization/MemberPlacementSheet.tsx': 'mode entreprise.',
  'components/organization/MemberSheet.tsx': 'mode entreprise.',
  'components/organization/NewTeamProjectModal.tsx': 'mode entreprise.',
  'components/organization/OrgProfileSheet.tsx': 'mode entreprise.',
  'components/organization/ReassignManagerSheet.tsx': 'mode entreprise.',
  'components/organization/TeamTaskModal.tsx':
    'mode entreprise. ⚠️ Elle EST mesurée par `touch-targets.spec.ts` (cibles '
    + 'tactiles), donc atteignable : c est de la dette, pas un obstacle.',
  'components/organization/WeeklyReviewSheet.tsx': 'mode entreprise.',
  'components/task-modal/MobileActionSheet.tsx':
    'variante de `TaskActionsSheet`, mesurée : même primitive, même piège.',
  'components/task-table/ConfirmDeleteSheet.tsx':
    'variante de `DeleteTaskConfirm`, mesurée depuis `EventModal`.',
  'components/ListActionsSheet.tsx': 'dette : atteignable par appui long sur une puce de liste.',
  'pages/agenda/QuickEventCard.tsx': 'dette : atteignable sur /agenda.',
  'pages/okr/DeleteObjectiveConfirm.tsx':
    'atteignable, et déjà ouverte par `reduced-motion-sheets.spec.ts` — mais '
    + 'pour mesurer son ANIMATION, pas son clavier. Dette.',
  'pages/tasks/CreateListSheet.tsx': 'dette : atteignable sur /tasks.',
  'pages/tasks/MobileTaskSearch.tsx':
    'dette : atteignable sur /tasks sous 768 px. Le harnais clavier tourne '
    + 'en viewport desktop, où la surface est `md:hidden` : la mesurer demande '
    + 'un cas en viewport mobile, pas seulement une tabulation de plus.',
};

/** Les fichiers de `src/` qui câblent `useModalA11y`. */
function surfacesCablees(): string[] {
  const out: string[] = [];
  const marcher = (rep: string) => {
    for (const entree of readdirSync(rep)) {
      const chemin = join(rep, entree);
      if (statSync(chemin).isDirectory()) marcher(chemin);
      else if (/\.tsx$/.test(entree) && !/\.test\.tsx$/.test(entree)) out.push(chemin);
    }
  };
  marcher(SRC);
  return out
    .filter((f) => readFileSync(f, 'utf8').includes('useModalA11y'))
    .map((f) => relative(SRC, f).split(sep).join('/'))
    .sort();
}

describe('C-96 — couverture clavier des surfaces modales', () => {
  const cablees = surfacesCablees();

  it('le detecteur trouve bien les surfaces cablees', () => {
    // 🔴 Anti-« garde qui répond sans mesurer » : un `walk` cassé rendrait
    // zéro surface, donc zéro écart, donc un vert.
    expect(cablees.length).toBeGreaterThan(40);
    expect(cablees).toContain('components/EventModal.tsx');
    expect(cablees).toContain('components/organization/TeamTaskModal.tsx');
  });

  it('chaque surface cablee est MESUREE ou declaree non mesuree', () => {
    const orphelines = cablees.filter((f) => !(f in MESUREES) && !(f in NON_MESUREES));
    expect(
      orphelines,
      'Une surface modale neuve est arrivée sans que personne dise si son\n'
        + 'comportement au clavier est mesuré. La déclarer dans MESUREES (avec le\n'
        + 'cas du spec qui la couvre) ou dans NON_MESUREES (avec sa raison).\n'
        + '❌ « on verra plus tard » n est pas une raison : écrire « dette », qui\n'
        + '   en est une, et qui se compte.',
    ).toEqual([]);
  });

  it('aucune declaration ne designe une surface disparue', () => {
    const fantomes = [...Object.keys(MESUREES), ...Object.keys(NON_MESUREES)].filter(
      (f) => !cablees.includes(f),
    );
    expect(
      fantomes,
      'Ces fichiers sont déclarés ici mais ne câblent plus `useModalA11y` : '
        + 'supprimés, renommés, ou — le cas grave — DÉCÂBLÉS.',
    ).toEqual([]);
  });

  it('les surfaces declarees MESUREES le sont vraiment dans le spec', () => {
    // 🔴 Sans ce cas, `MESUREES` serait une déclaration d'intention : on
    // pourrait supprimer un cas du spec Playwright et continuer d'annoncer
    // « 10 surfaces mesurées ». C'est exactement le mécanisme du « avant
    // recopié au lieu d être relu » que `CLAUDE.md` documente.
    expect(existsSync(SPEC), `${SPEC} introuvable`).toBe(true);
    const spec = readFileSync(SPEC, 'utf8');
    const absents = Object.entries(MESUREES)
      .filter(([, fragment]) => !spec.includes(fragment))
      .map(([f, fragment]) => `${f} → « ${fragment} »`);
    expect(
      absents,
      "Ces surfaces sont déclarées mesurées, et le cas qui les mesure n'existe "
        + 'plus dans e2e/a11y-keyboard-audit.spec.ts.',
    ).toEqual([]);
  });

  it('chaque non-mesuree porte une raison, pas un vide', () => {
    const muettes = Object.entries(NON_MESUREES)
      .filter(([, raison]) => !raison || raison.trim().length < 15)
      .map(([f]) => f);
    expect(muettes).toEqual([]);
  });

  it('L ECART, CHIFFRE — 10 mesurees sur 51 cablees au 2026-09-20', () => {
    // 🔴 Ce cas n'est pas décoratif : il est le seul endroit du dépôt où le
    // chiffre existe. Il change quand le produit change, et c'est voulu — on
    // le relit alors, au lieu de recopier « 10 sur 53 » d'un document plus
    // ancien. (Le 09-16 disait 53 ; le décompte du 09-20, refait ici par le
    // détecteur et non repris d une table, en trouve 51.)
    const mesurees = cablees.filter((f) => f in MESUREES).length;
    const dette = Object.values(NON_MESUREES).filter((r) => r.includes('dette')).length;
    const total = cablees.length;
    // Un CLIQUET : la couverture ne peut que monter.
    expect(
      mesurees,
      `Couverture clavier en BAISSE : ${mesurees} surfaces mesurées sur ${total}.`,
    ).toBeGreaterThanOrEqual(10);
    // …et le chiffre est imprimé, pour qu'il soit lisible sans ouvrir ce fichier.
    console.log(
      `::notice title=c96::${mesurees} surface(s) modale(s) mesurée(s) au clavier sur `
        + `${total} câblée(s) · ${dette} déclarée(s) comme dette, le reste inatteignable `
        + 'en démo ou variante d une surface déjà mesurée.',
    );
  });
});
