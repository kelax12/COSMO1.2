// ═══════════════════════════════════════════════════════════════════
// C-96 · 61 surfaces modales MESURÉES au clavier sur 63 (10 sur 51 au 2026-09-20)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LA DISTINCTION QUI FAIT TOUT L'ITEM. `modal-a11y.guard.test.ts` garantit
// que chaque surface modale IMPORTE `useModalA11y` : c'est un CÂBLAGE, vérifié
// statiquement, et c'est déjà beaucoup. Mais câblé n'est pas mesuré.
// `e2e/a11y-keyboard-audit*.spec.ts` ouvrent 61 surfaces et vérifient au clavier
// ce qui s'y passe réellement. Les 2 autres sont câblées, et personne ne les
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
//    combien : 23 mesurées sur 63 câblées, au 2026-10-22 (AM-2).
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(process.cwd(), 'src');
const SPECS = [
  join(process.cwd(), 'e2e', 'a11y-keyboard-audit.spec.ts'),
  join(process.cwd(), 'e2e', 'a11y-keyboard-audit-surfaces.spec.ts'),
  join(process.cwd(), 'e2e', 'stubbed', 'a11y-keyboard-audit-stubbed.spec.ts'),
];

/**
 * Les surfaces MESURÉES par les specs `e2e/a11y-keyboard-audit*.spec.ts` (`SPECS`).
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
  // Rôles personnalisés (mig. 219) : déclarées « dette » du 2026-10-15 au
  // 2026-10-22, mesurées depuis, ouvertes au clavier en démo. Le parcours
  // empilé (l'éditeur ouvert depuis l'attribution) a sa propre garde.
  'components/organization/AssignRoleDialog.tsx': 'MESURE — AssignRoleDialog',
  'components/organization/RoleEditorSheet.tsx': 'MESURE — RoleEditorSheet',
  // Mesurée par la garde des frères d'EventModal (entrée du focus, piège, Échap),
  // les trois détecteurs ; elle restait déclarée « dette » jusqu'au 2026-10-22.
  'components/ColorSettingsModal.tsx': "surface: 'ColorSettingsModal'",
  // AM-2 (2026-10-22) : dix surfaces de plus, déclencheur au clavier sauf le créneau d'agenda.
  'components/organization/TeamTaskModal.tsx': 'MESURE · TeamTaskModal',
  'components/CompletedOKRsModal.tsx': 'MESURE · CompletedOKRsModal',
  'pages/okr/DeleteObjectiveConfirm.tsx': 'MESURE · DeleteObjectiveConfirm',
  'pages/agenda/QuickEventCard.tsx': 'MESURE · QuickEventCard',
  'components/TodayTasks.tsx': 'MESURE · TodayTasks',
  'components/QuickAddBar.tsx': 'MESURE · QuickAddBar',
  'components/CommandPalette.tsx': 'MESURE · CommandPalette',
  'components/ShortcutsHelp.tsx': 'MESURE · ShortcutsHelp',
  'components/task-board/MoveTaskSheet.tsx': 'MESURE · MoveTaskSheet',
  'pages/tasks/CreateListSheet.tsx': 'MESURE · CreateListSheet',
  // AM-2 (2026-10-23) : toutes les surfaces atteignables, mesurées par
  // `e2e/a11y-keyboard-audit-surfaces.spec.ts` (démo) et `e2e/stubbed/a11y-keyboard-audit-stubbed.spec.ts`
  // (hors démo : `FirstRunSetup`, `ShareInviteClaimer`).
  'components/organization/TemplatePicker.tsx': 'MESURE · TemplatePicker',
  'components/organization/AddWidgetPage.tsx': 'MESURE · AddWidgetPage',
  'components/organization/OrgGlossarySheet.tsx': 'MESURE · OrgGlossarySheet',
  'components/organization/InviteModeDialog.tsx': 'MESURE · InviteModeDialog',
  'components/organization/MemberBulkPicker.tsx': 'MESURE · MemberBulkPicker',
  'components/organization/ProjectEditDialog.tsx': 'MESURE · ProjectEditDialog',
  'components/organization/ProjectAddTaskPicker.tsx': 'MESURE · ProjectAddTaskPicker',
  'components/organization/AssignEventDialog.tsx': 'MESURE · AssignEventDialog',
  'components/organization/AssignTaskSheet.tsx': 'MESURE · AssignTaskSheet',
  'components/organization/CreateTeamModal.tsx': 'MESURE · CreateTeamModal',
  'components/organization/DeleteOrganizationDialog.tsx': 'MESURE · DeleteOrganizationDialog',
  'components/organization/DeleteTeamCategoryConfirm.tsx': 'MESURE · DeleteTeamCategoryConfirm',
  'components/organization/InviteByEmailDialog.tsx': 'MESURE · InviteByEmailDialog',
  'components/organization/InviteOrJoinModal.tsx': 'MESURE · InviteOrJoinModal',
  'components/organization/MemberPermissionsSheet.tsx': 'MESURE · MemberPermissionsSheet',
  'components/organization/MemberSheet.tsx': 'MESURE · MemberSheet',
  'components/organization/OffboardMemberDialog.tsx': 'MESURE · OffboardMemberDialog',
  'components/organization/PyramidPlacementSheet.tsx': 'MESURE · PyramidPlacementSheet',
  'components/organization/WeeklyReviewSheet.tsx': 'MESURE · WeeklyReviewSheet',
  'components/organization/OrgSectionSheet.tsx': 'MESURE · OrgSectionSheet',
  'components/BugReportModal.tsx': 'MESURE · BugReportModal',
  'components/CollaborativeTasks.tsx': 'MESURE · CollaborativeTasks',
  'components/LoginModal.tsx': 'MESURE · LoginModal',
  'components/OKRDeadlineReviewModal.tsx': 'MESURE · OKRDeadlineReviewModal',
  'components/RemoveFriendConfirm.tsx': 'MESURE · RemoveFriendConfirm',
  'components/WeeklyCheckinModal.tsx': 'MESURE · WeeklyCheckinModal',
  'components/ListActionsSheet.tsx': 'MESURE · ListActionsSheet',
  'components/ShareInviteClaimer.tsx': 'MESURE · ShareInviteClaimer',
  'components/add-to-list/BulkAddToListModal.tsx': 'MESURE · BulkAddToListModal',
  'components/add-to-list/DesktopAddToList.tsx': 'MESURE · DesktopAddToList',
  'components/category/DeleteCategoryDialog.tsx': 'MESURE · DeleteCategoryDialog',
  'components/category/MoveCategoryDialog.tsx': 'MESURE · MoveCategoryDialog',
  'components/onboarding/enterprise/OrgWelcomeVideo.tsx': 'MESURE · OrgWelcomeVideo',
  'components/onboarding/FirstRunSetup.tsx': 'MESURE · FirstRunSetup',
  'components/task-modal/MobileActionSheet.tsx': 'MESURE · MobileActionSheet',
  'components/task-table/ConfirmDeleteSheet.tsx': 'MESURE · ConfirmDeleteSheet',
  'pages/settings/ImportTasksDialog.tsx': 'MESURE · ImportTasksDialog',
  'pages/tasks/MobileTaskSearch.tsx': 'MESURE · MobileTaskSearch',
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
  'components/organization/TeamBulkAddToListDialog.tsx':
    'dette : « Liste » de la barre de sélection multiple d entreprise (2026-10-30), '
    + 'câblée par useModalA11y, pas encore couverte par e2e/a11y-keyboard-audit.spec.ts.',
  'components/organization/TeamTaskListsField.tsx':
    'dette : popup « Ajouter à une liste » de la fiche de tâche d entreprise (2026-10-30), '
    + 'câblée par useModalA11y, pas encore couverte par e2e/a11y-keyboard-audit.spec.ts.',
  'components/PremiumGateModal.tsx':
    'inatteignable : `PREMIUM_ENFORCED` est à false, aucune gate ne s ouvre '
    + '(décision 2026-06-11, le partage est gratuit).',
  'components/mobile/BottomSheet.tsx':
    'PRIMITIVE, pas une surface : c est elle que montent la plupart des '
    + 'feuilles ci-dessus, et quatre de ses consommatrices sont mesurées.',
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
    for (const f of SPECS) expect(existsSync(f), `${f} introuvable`).toBe(true);
    const spec = SPECS.map((f) => readFileSync(f, 'utf8')).join('\n');
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

  it('L ECART, CHIFFRE · 61 mesurees sur 63 cablees au 2026-10-23', () => {
    // 🔴 Ce cas n'est pas décoratif : il est le seul endroit du dépôt où le
    // chiffre existe. Il change quand le produit change, et c'est voulu — on
    // le relit alors, au lieu de recopier « 10 sur 53 » d'un document plus
    // ancien. (Le 09-16 disait 53 ; le décompte du 09-20, refait ici par le
    // détecteur et non repris d une table, en trouve 51.)
    const mesurees = cablees.filter((f) => f in MESUREES).length;
    const dette = Object.values(NON_MESUREES).filter((r) => r.includes('dette')).length;
    const total = cablees.length;
    // Un CLIQUET : la couverture ne peut que monter. 10 au 2026-09-20, 12 au
    // 2026-10-22 (rôles personnalisés mesurés), 23 le même jour (AM-2, dix
    // surfaces de plus et ColorSettingsModal reclassée), 61 le 2026-10-23
    // (AM-2, les 38 surfaces atteignables restantes).
    expect(
      mesurees,
      `Couverture clavier en BAISSE : ${mesurees} surfaces mesurées sur ${total}.`,
    ).toBeGreaterThanOrEqual(61);
    // …et le chiffre est imprimé, pour qu'il soit lisible sans ouvrir ce fichier.
    console.log(
      `::notice title=c96::${mesurees} surface(s) modale(s) mesurée(s) au clavier sur `
        + `${total} câblée(s) · ${dette} déclarée(s) comme dette, le reste inatteignable `
        + 'en démo ou variante d une surface déjà mesurée.',
    );
  });
});
