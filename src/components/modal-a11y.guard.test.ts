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
  'components/organization/OrgNotificationsBell.tsx':
    'popover de notifications ancre a la cloche, non modal.',
  'components/organization/TeamCategoryPicker.tsx':
    "confirmation EN LIGNE (une bande dans le flux, pas un calque) : elle porte alertdialog pour etre annoncee, mais elle ne recouvre rien.",
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
