// ═══════════════════════════════════════════════════════════════════
// Fusion des deux listes de tâches (item #29) — calcul pur, testé.
//
// Règle de périmètre, tranchée avec Axel : « échéance ≤ aujourd'hui, ou en
// retard, et non terminée ». Elle est OBJECTIVE — une heuristique mêlant
// priorité et favoris se serait avérée impossible à expliquer le jour où
// l'utilisateur demande pourquoi telle tâche est là.
// ═══════════════════════════════════════════════════════════════════

import type { Task } from '@/modules/tasks';
import type { TeamTask, TeamProject } from '@/modules/team-projects';
import type { TodayItem } from './types';

/**
 * Date LOCALE au format `YYYY-MM-DD` (convention en-CA du projet).
 *
 * Surtout pas `toISOString()` : à 23 h dans un fuseau à l'est de Greenwich, il
 * renvoie le lendemain, et la vue « aujourd'hui » se vide le soir. C'est la
 * classe de bug éradiquée par l'audit archi 2026-06 — on ne la réintroduit pas.
 */
export const localYMD = (d: Date): string => d.toLocaleDateString('en-CA');

/** `YYYY-MM-DD` bien formé ? */
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ramène une échéance à sa date locale `YYYY-MM-DD`, ou null si illisible.
 *
 * Les deux modèles DOCUMENTENT `YYYY-MM-DD`, mais les tâches perso portent
 * parfois un horodatage ISO complet (`…T12:43:30.618Z`). N'accepter que la
 * forme courte vidait silencieusement toute la moitié perso de la vue —
 * constaté sur les données de démo, pas déduit.
 *
 * La forme courte est prise TELLE QUELLE : la passer par `new Date()` la
 * lirait comme minuit UTC et la reculerait d'un jour à l'ouest de Greenwich.
 */
const toLocalDeadline = (raw: string | undefined): string | null => {
  if (!raw) return null;
  if (YMD_RE.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : localYMD(parsed);
};

/** Nom + couleur d'une catégorie — forme commune aux deux modèles. */
export interface CategoryLite {
  name: string;
  color: string;
}

export interface MergeTodayInput {
  tasks: Task[];
  teamTasks: TeamTask[];
  /** Projets d'équipe — donnent le contexte affiché. */
  projects: TeamProject[];
  /** Nom de liste par id de tâche perso — contexte affiché. */
  listNameByTaskId: Map<string, string>;
  /** Catégories perso (`categories`), par id. */
  personalCategoryById: Map<string, CategoryLite>;
  /** Catégories d'équipe (`team_categories`), par id. */
  teamCategoryById: Map<string, CategoryLite>;
  now?: Date;
}

/**
 * Fusionne les deux sources en une liste de LECTURE triée.
 *
 * Les deux tables gardent leurs ids ; la clé d'affichage est donc `(source,
 * id)` et non `id` seul. Confondre les deux ferait cocher la mauvaise ligne
 * dans la mauvaise table — le seul vrai danger de cette vue.
 */
export function mergeTodayItems({
  tasks,
  teamTasks,
  projects,
  listNameByTaskId,
  personalCategoryById,
  teamCategoryById,
  now = new Date(),
}: MergeTodayInput): TodayItem[] {
  const today = localYMD(now);
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  /** Échéance retenue (date locale) si ≤ aujourd'hui et tâche non terminée. */
  const dueDate = (deadline: string | undefined, completed: boolean): string | null => {
    if (completed) return null;
    const date = toLocalDeadline(deadline);
    return date && date <= today ? date : null;
  };

  const items: TodayItem[] = [];

  for (const t of tasks) {
    const deadline = dueDate(t.deadline, t.completed);
    if (!deadline) continue;
    const category = personalCategoryById.get(t.category);
    items.push({
      id: t.id,
      source: 'personal',
      name: t.name,
      deadline,
      done: t.completed,
      priority: t.priority,
      contextLabel: listNameByTaskId.get(t.id) ?? null,
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      href: `/tasks?task=${t.id}`,
      overdue: deadline < today,
    });
  }

  for (const t of teamTasks) {
    const deadline = dueDate(t.deadline, t.completed);
    if (!deadline) continue;
    const category = t.categoryId ? teamCategoryById.get(t.categoryId) : undefined;
    items.push({
      id: t.id,
      source: 'team',
      name: t.name,
      deadline,
      done: t.completed,
      priority: t.priority,
      contextLabel: projectNameById.get(t.projectId) ?? null,
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      href: `/entreprise?tab=projects&task=${t.id}`,
      overdue: deadline < today,
    });
  }

  // Le plus en retard d'abord, puis la priorité (1 = plus urgent dans les DEUX
  // modèles — vérifié), puis le nom pour que l'ordre soit stable d'un rendu à
  // l'autre. Aucune source n'est avantagée : ce serait dire à l'utilisateur
  // laquelle de ses deux vies compte le plus.
  return items.sort(
    (a, b) =>
      (a.deadline ?? '').localeCompare(b.deadline ?? '') ||
      a.priority - b.priority ||
      a.name.localeCompare(b.name),
  );
}
