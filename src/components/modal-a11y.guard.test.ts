// ═══════════════════════════════════════════════════════════════════
// C-53 — CLIQUET : toute surface modale maison passe par `useModalA11y`.
//
// 🔴 POURQUOI UNE GARDE STATIQUE, ET PAS UNE LISTE DANS UN MARKDOWN.
// Le cablage des 58 surfaces a pris trois passes. Ce qui le defait ne sera pas
// une decision, ce sera un fichier de plus : quelqu'un ecrit un overlay
// `fixed inset-0`, il marche, personne ne remarque qu'il ne piege rien. Une
// liste qu'on relit a la main est une liste qu'on oubliera de relire.
//
// La garde balaie `src/`, retient les fichiers qui montent une surface modale,
// et exige de chacun qu'il importe le hook. Les exceptions sont DECLAREES ici,
// une par une, avec leur motif — jamais un motif general.
//
// ❌ Ne JAMAIS ajouter une entree a `EXEMPTS` pour faire passer la CI. Une
//    surface qui capture l'ecran se cable ; une surface qui n'en est pas une
//    se declare, et la declaration doit dire pourquoi elle n'en est pas une.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const ROOT = join(process.cwd(), 'src');

/**
 * Fichiers qui contiennent un `fixed inset-0` SANS etre une surface modale.
 * Chacun porte son motif : c'est ce qui distingue une exception d'un oubli.
 */
const EXEMPTS: Record<string, string> = {
  'components/TaskTable.tsx':
    "n'a pas d'overlay a elle : elle HEBERGE ConfirmDeleteSheet, qui est cablee.",
  'components/event-modal/EventModalForm.tsx':
    "rendue A L'INTERIEUR de l'overlay d'EventModal, deja piege. Un second piege sur le meme contenu se disputerait le focus.",
  'components/task-modal/TaskModalMobileBody.tsx':
    "corps rendu dans le dialog de TaskModal ; l'overlay appartient au parent.",
  'components/task-table/TaskBulkActionsBar.tsx':
    "le `fixed inset-0` est le fond invisible d'un MENU deroulant (aria-hidden), pas une modale : un menu ne piege pas le focus, il se ferme.",
  'components/tutorial/PageTutorial.tsx':
    "surlignage de tutoriel en `pointer-events-none` + `aria-live` : il ne capture ni le clic ni le focus, il commente la page dessous.",
  'pages/AgendaPage.tsx':
    "le `fixed inset-0` est le voile du panneau lateral mobile, pas une boite de dialogue.",
  'components/InboxMenu.tsx':
    "POPOVER ancre au declencheur, non modal : pas de voile, pas d'aria-modal. Piéger le focus dans un popover empêcherait d'en sortir en tabulant, ce qui est justement sa maniere de se fermer.",
  'components/task-table/TasksInboxMenu.tsx': 'meme popover, cote page Taches.',
  'components/organization/OrgNotificationsPanel.tsx':
    'popover de notifications ancre a la cloche, non modal (sorti de OrgNotificationsBell le 2026-09-25, charge a l ouverture).',
  'components/organization/TeamCategoryTreeSelect.tsx':
    "confirmation EN LIGNE (une bande dans le flux d'un Popover Radix deja piege, pas un calque) : elle porte alertdialog pour etre annoncee, mais elle ne recouvre rien et un second piege se disputerait le focus avec celui du Popover.",
  'components/org-guide/use-guide-demo.tsx':
    "le `fixed inset-0` est un bouclier de clics transparent et aria-hidden, pose pendant la demo automatique des deux guides (entreprise, perso) : il empeche l'utilisateur de cliquer l'ecran dessous, il n'expose aucune boite de dialogue et n'a rien a focaliser. Le tiroir (Sheet Radix) piege deja le focus ; la barre de controle et les panneaux de fin sont des role=status/toolbar hors calque.",
  'components/tutorial/TutorialCard.tsx':
    'carton de tutoriel ancre, rendu dans PageTutorial qui est en pointer-events-none : il commente la page, il ne la capture pas.',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (f: string) => f.slice(ROOT.length + 1).split(sep).join(String.fromCharCode(47));

/**
 * Une surface modale maison : un overlay plein ecran, OU un role de dialogue
 * pose a la main. On exclut `components/ui/**`, qui est Radix.
 */
function isModalSurface(source: string, path: string): boolean {
  if (path.startsWith('components/ui/')) return false;
  return /fixed inset-0/.test(source) || /role="(dialog|alertdialog)"/.test(source);
}

const files = walk(ROOT).map((f) => ({ path: rel(f), source: readFileSync(f, 'utf8') }));
const surfaces = files.filter((f) => isModalSurface(f.source, f.path));

describe('C-53 — cliquet : toute surface modale maison passe par useModalA11y', () => {
  it('detecte bien des surfaces (temoin : une garde qui ne trouve rien passe toujours)', () => {
    // 🔴 Sans ce temoin, casser le detecteur rendrait le fichier VERT.
    // C'est le mode d'echec releve par la passe du 2026-09-03 : « une garde se
    // verifie sur ce qu'elle REGARDE ».
    expect(surfaces.length).toBeGreaterThan(40);
  });

  it('aucune surface non cablee et non declaree', () => {
    const orphans = surfaces
      .filter((f) => !f.source.includes('useModalA11y'))
      .filter((f) => !(f.path in EXEMPTS))
      .map((f) => f.path);
    expect(orphans, `surfaces sans piege de focus :\n  ${orphans.join('\n  ')}`).toEqual([]);
  });

  it('aucune exemption perimee', () => {
    // Une exemption dont le fichier a disparu, ou qui s'est fait cabler entre
    // temps, doit ETRE RETIREE : sinon la liste des motifs devient un cimetiere
    // qu'on cesse de lire, et la prochaine exception s'y cache.
    const stale = Object.keys(EXEMPTS).filter((p) => {
      const f = files.find((x) => x.path === p);
      return !f || f.source.includes('useModalA11y');
    });
    expect(stale, `exemptions a retirer : ${stale.join(', ')}`).toEqual([]);
  });

  it('aucune surface cablee ne garde un Echap ecrit a la main', () => {
    // Le hook est le proprietaire de la touche. Deux gestionnaires pour la meme
    // touche, c'est deux endroits ou la regle de fermeture peut diverger — et
    // c'est le defaut d'origine de HabitModal.
    const doubles = surfaces
      .filter((f) => f.source.includes('useModalA11y'))
      .filter((f) => /addEventListener\('keydown'[\s\S]{0,400}?'Escape'|'Escape'[\s\S]{0,200}?addEventListener\('keydown'/.test(f.source))
      .map((f) => f.path);
    expect(doubles, `Echap en double :\n  ${doubles.join('\n  ')}`).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FRO-01 (vague 16.3) : l'INVENTAIRE COMPLET : trois familles de surfaces modales.
//
// Le cliquet ci-dessus ne voyait que la famille MAISON (`fixed inset-0`, `role="dialog"`).
// L'audit externe du 2026-11-06 comptait « 10 surfaces sur 53 » : le chiffre mesurait la
// famille maison seule, et deux autres familles n'etaient inventoriees nulle part.
//
//   1. MAISON     : cablee par `useModalA11y` (garde ci-dessus + `keyboard-audit-coverage.guard`).
//   2. BOTTOMSHEET : les ecrans qui montent la primitive `BottomSheet`, cablee une fois pour
//                   toutes ; `ariaLabel` y est obligatoire par le TYPE (critere e).
//   3. RADIX      : `Dialog`, `Sheet`, `AlertDialog` de `components/ui/**`. Le piege, Echap et
//                   le role sont ceux de Radix ; la restitution du focus (d) et `aria-modal` (e)
//                   sont portes par les trois enveloppes et mesures par
//                   `components/ui/modal-contract.test.tsx`. Ici : chaque fichier est declare, et
//                   chaque `*Content` a son `*Title` (le nom accessible).
//
// ❌ Ne JAMAIS ajouter une entree pour faire passer la CI : une surface neuve se declare avec
//    le chemin par lequel elle est mesuree, pas avec un « on verra ».
// ═══════════════════════════════════════════════════════════════════

/** Fichiers (hors `components/ui/`) qui montent un `Dialog`, `Sheet` ou `AlertDialog` Radix. */
const RADIX_SURFACES = [
  'components/DescriptionField.tsx',
  'components/OKRModalSheet.tsx',
  'components/TaskModal.tsx',
  'components/org-guide/OrgGuideDrawer.tsx',
  'components/organization/AssignMembersDialog.tsx',
  'components/organization/ConfirmProjectAudienceDialog.tsx',
  'components/organization/DeleteTeamDialog.tsx',
  'components/organization/KRExecutionDialog.tsx',
  'components/organization/MemberAccessDialog.tsx',
  'components/organization/OrgConfirmDialog.tsx',
  'components/organization/OrgNotificationSettingsDialog.tsx',
  'components/organization/ProjectPeopleDialogs.tsx',
  'components/organization/TeamEventDialog.tsx',
  'components/organization/TeamOKRModal.tsx',
  'components/organization/TeamTaskDependencyPicker.tsx',
  'components/organization/TeamTrashDialog.tsx',
  'components/organization/TransferOwnershipDialog.tsx',
  'components/perso-guide/PersoGuideDrawer.tsx',
  'components/task-modal/TaskDependencyPicker.tsx',
  'pages/SettingsPage.tsx',
];

/** Fichiers qui montent la primitive `BottomSheet` (hors `components/mobile/`). */
const BOTTOMSHEET_CONSUMERS = [
  'components/organization/MobileTeamTasks.tsx',
  'components/share/WeeklyRecapSheet.tsx',
  'components/task-board/MoveTaskSheet.tsx',
  'pages/agenda/MobileScheduleSheet.tsx',
  'pages/okr/OKRCard.tsx',
  'pages/okr/OKRCategorySelect.tsx',
  'pages/settings/ImportTasksDialog.tsx',
  'pages/tasks/MobileDisplaySheet.tsx',
  'pages/tasks/MobileSortButton.tsx',
];

const RADIX_CONTENT = /<(DialogContent|SheetContent|AlertDialogContent)\b/g;
const RADIX_TITLE = /<(DialogTitle|SheetTitle|AlertDialogTitle)\b/g;

const nonUi = files.filter((f) => !f.path.startsWith('components/ui/'));
const radixFiles = nonUi.filter((f) => /<(DialogContent|SheetContent|AlertDialogContent)\b/.test(f.source));
const bottomSheetFiles = nonUi.filter(
  (f) => !f.path.startsWith('components/mobile/') && /<BottomSheet\b/.test(f.source),
);

describe('FRO-01 : inventaire des surfaces Radix et BottomSheet', () => {
  it('detecte bien des surfaces (temoin : un detecteur muet rendrait la garde verte)', () => {
    expect(radixFiles.length).toBeGreaterThan(15);
    expect(bottomSheetFiles.length).toBeGreaterThan(5);
  });

  it('chaque surface Radix est declaree, et aucune declaration ne designe un fichier disparu', () => {
    const detectees = radixFiles.map((f) => f.path).sort();
    const nouvelles = detectees.filter((p) => !RADIX_SURFACES.includes(p));
    const perimees = RADIX_SURFACES.filter((p) => !detectees.includes(p));
    expect(nouvelles, `surfaces Radix non declarees :\n  ${nouvelles.join('\n  ')}`).toEqual([]);
    expect(perimees, `declarations perimees :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('chaque surface BottomSheet est declaree, et aucune declaration ne designe un fichier disparu', () => {
    const detectees = bottomSheetFiles.map((f) => f.path).sort();
    const nouvelles = detectees.filter((p) => !BOTTOMSHEET_CONSUMERS.includes(p));
    const perimees = BOTTOMSHEET_CONSUMERS.filter((p) => !detectees.includes(p));
    expect(nouvelles, `feuilles non declarees :\n  ${nouvelles.join('\n  ')}`).toEqual([]);
    expect(perimees, `declarations perimees :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('chaque *Content Radix a son *Title (le nom accessible, critere e)', () => {
    // Sans titre, Radix ne leve qu'un avertissement console : la surface s'ouvre, muette.
    const sansTitre = radixFiles
      .filter((f) => (f.source.match(RADIX_CONTENT) ?? []).length > (f.source.match(RADIX_TITLE) ?? []).length)
      .map((f) => f.path);
    expect(sansTitre, `surfaces Radix sans titre :\n  ${sansTitre.join('\n  ')}`).toEqual([]);
  });

  it('aucune surface ne contourne les enveloppes `components/ui/` (primitives Radix importees en direct)', () => {
    // Les trois enveloppes portent `aria-modal` et la restitution du focus (FRO-01) : une
    // surface qui importe la primitive les perdrait sans que rien ne le signale.
    const directs = nonUi
      .filter((f) => /from ['"]@radix-ui\/react-(dialog|alert-dialog)['"]/.test(f.source))
      .map((f) => f.path);
    expect(directs, `primitive Radix importee en direct :\n  ${directs.join('\n  ')}`).toEqual([]);
  });

  it('aucune surface ne desactive Echap (critere c) : exception a justifier ici, par ecrit', () => {
    // Aucune exception n'existe a ce jour. `closeOnEscape: false` et `onEscapeKeyDown` qui
    // empeche la fermeture sont les deux facons de la desactiver.
    const muettes = files
      .filter((f) => /closeOnEscape\s*[:=]\s*\{?\s*false/.test(f.source) || /onEscapeKeyDown=\{[^}]*preventDefault/.test(f.source))
      .map((f) => f.path)
      .filter((p) => p !== 'hooks/use-modal-a11y.ts');
    expect(muettes, `Echap desactive sans justification :\n  ${muettes.join('\n  ')}`).toEqual([]);
  });

  it('le decompte, imprime', () => {
    // L'UNION, pas la somme : `MoveTaskSheet` et `ImportTasksDialog` sont cablees ET montent la
    // primitive `BottomSheet`. Les compter deux fois gonflerait le chiffre.
    const maison = new Set(files.filter((f) => f.source.includes('useModalA11y')).map((f) => f.path));
    const radix = new Set(radixFiles.map((f) => f.path));
    const feuilles = new Set(bottomSheetFiles.map((f) => f.path).filter((p) => !maison.has(p)));
    const total = maison.size + radix.size + feuilles.size;
    console.log(
      `::notice title=fro-01::${total} fichiers de surfaces modales : ${maison.size} maison, `
        + `${radix.size} Radix, ${feuilles.size} feuilles BottomSheet seules.`,
    );
    expect(total).toBeGreaterThan(80);
  });
});
