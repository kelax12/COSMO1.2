// ═══════════════════════════════════════════════════════════════════
// Onglet Projets (mode entreprise) — helpers partagés
// Palette de couleurs projet, tri des tâches, stats, prefs UI persistées.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react';
import { isPast, isToday, parseISO } from 'date-fns';
import type { TeamActivityField, TeamTask, TeamTaskStatus } from '@/modules/team-projects';

// ─── Couleurs de projet (champ TeamProject.color) ────────────────────

export interface ProjectColorDef {
  /** Pastille / barre de progression. */
  dot: string;
  /** Fond léger (badges). */
  soft: string;
}

export const PROJECT_COLORS: Record<string, ProjectColorDef> = {
  blue: { dot: 'bg-blue-500', soft: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  indigo: { dot: 'bg-indigo-500', soft: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  purple: { dot: 'bg-purple-500', soft: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  pink: { dot: 'bg-pink-500', soft: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  red: { dot: 'bg-red-500', soft: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  amber: { dot: 'bg-amber-500', soft: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  green: { dot: 'bg-emerald-500', soft: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  teal: { dot: 'bg-teal-500', soft: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  slate: { dot: 'bg-slate-500', soft: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
};

export const PROJECT_COLOR_NAMES = Object.keys(PROJECT_COLORS);

export const projectColor = (color: string): ProjectColorDef =>
  PROJECT_COLORS[color] ?? PROJECT_COLORS.blue;

/** Équivalent hex de PROJECT_COLORS — pour les champs qui exigent une couleur
 *  CSS littérale (ex. `CalendarEvent.color`) plutôt qu'une classe Tailwind. */
export const PROJECT_COLOR_HEX: Record<string, string> = {
  blue: '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  pink: '#ec4899',
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#10b981',
  teal: '#14b8a6',
  slate: '#64748b',
};

export const projectColorHex = (color: string): string =>
  PROJECT_COLOR_HEX[color] ?? PROJECT_COLOR_HEX.blue;

// ─── Fusion avec la page Tâches perso ─────────────────────────────────

/** Tâches d'équipe assignées à `userId` — toutes, sans filtre de statut. */
export const myAssignedTasks = (tasks: TeamTask[], userId: string): TeamTask[] =>
  tasks.filter((t) => t.assigneeIds.includes(userId));

// ─── Priorités (1..5) ────────────────────────────────────────────────

export const PRIORITY_META: Record<number, { dot: string; label: string }> = {
  1: { dot: 'bg-red-500', label: 'P1 · Critique' },
  2: { dot: 'bg-amber-500', label: 'P2 · Haute' },
  3: { dot: 'bg-blue-500', label: 'P3 · Normale' },
  4: { dot: 'bg-sky-400', label: 'P4 · Basse' },
  5: { dot: 'bg-slate-400', label: 'P5 · Très basse' },
};

// ─── Tâches : retard, tri, stats ─────────────────────────────────────

export const isTaskOverdue = (task: TeamTask): boolean => {
  if (task.completed || !task.deadline) return false;
  const d = parseISO(task.deadline);
  return isPast(d) && !isToday(d);
};

/**
 * Tri des tâches ouvertes : deadline croissante (sans deadline en dernier),
 * puis priorité croissante (P1 = plus prioritaire d'abord), puis date de création.
 */
export const sortOpenTasks = (tasks: TeamTask[]): TeamTask[] =>
  [...tasks].sort((a, b) => {
    const da = a.deadline || '9999-99-99';
    const db = b.deadline || '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt < b.createdAt ? -1 : 1;
  });

/** Terminées, les plus récemment complétées d'abord. */
export const sortCompletedTasks = (tasks: TeamTask[]): TeamTask[] =>
  [...tasks].sort((a, b) => ((a.completedAt ?? '') > (b.completedAt ?? '') ? -1 : 1));

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const completedThisWeek = (tasks: TeamTask[]): number => {
  const cutoff = Date.now() - WEEK_MS;
  return tasks.filter(
    (t) => t.completed && t.completedAt && new Date(t.completedAt).getTime() >= cutoff,
  ).length;
};

// ─── Filtre de statut (pastilles cliquables) ─────────────────────────

/** Filtre actif des pastilles de synthèse. `all` = aucun filtre. */
export type TaskStatusFilter = 'all' | 'open' | 'overdue' | 'doneThisWeek';

/**
 * Restreint une liste de tâches au filtre de statut choisi.
 *
 * `doneThisWeek` réutilise la MÊME fenêtre de 7 jours que `completedThisWeek` :
 * si les deux divergeaient, la pastille afficherait un compte que le filtre
 * serait incapable de reproduire.
 */
export const filterByStatus = (tasks: TeamTask[], filter: TaskStatusFilter): TeamTask[] => {
  if (filter === 'all') return tasks;
  if (filter === 'open') return tasks.filter((t) => !t.completed);
  if (filter === 'overdue') return tasks.filter(isTaskOverdue);
  const cutoff = Date.now() - WEEK_MS;
  return tasks.filter(
    (t) => t.completed && t.completedAt && new Date(t.completedAt).getTime() >= cutoff,
  );
};

// ─── Durées estimées ─────────────────────────────────────────────────

/** Somme des `estimatedTime` (minutes) ; une tâche sans estimation vaut 0. */
export const sumEstimatedTime = (tasks: TeamTask[]): number =>
  tasks.reduce((sum, t) => sum + (t.estimatedTime ?? 0), 0);

/**
 * Minutes → libellé court (`45 min`, `2 h`, `2 h 15`).
 *
 * Renvoie '' pour 0 ou moins : l'appelant n'affiche alors rien du tout, plutôt
 * qu'un « 0 min » qui ferait croire à une estimation saisie et nulle.
 */
export const formatDuration = (minutes: number): string => {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
};

// ─── Prefs UI persistées (filtres, vue, projets repliés) ─────────────

export interface ProjectsUiPrefs {
  view: 'list' | 'kanban' | 'timeline';
  /** null = toutes les tâches ; sinon userId de l'assigné filtré. */
  assigneeFilter: string | null;
  /** '' = toutes équipes, 'org' = sans équipe, sinon teamId. */
  teamFilter: string;
  collapsed: Record<string, boolean>;
  showArchived: boolean;
  /** Pastille de synthèse active. */
  statusFilter: TaskStatusFilter;
  /** Axe des colonnes du kanban : charge par personne, ou flux par statut. */
  kanbanGroupBy: 'assignee' | 'status';
  /** Axe des lignes du Planning : une ligne par projet, ou par personne. */
  timelineGroupBy: 'project' | 'assignee';
}

const DEFAULT_PREFS: ProjectsUiPrefs = {
  view: 'list',
  assigneeFilter: null,
  teamFilter: '',
  collapsed: {},
  showArchived: false,
  statusFilter: 'all',
  // Par défaut le FLUX : c'est la lecture attendue d'un kanban. La vue par
  // personne reste à un clic, mais elle répond à « qui fait quoi », pas à
  // « où en est-on » — et c'est la seconde question qu'un kanban doit servir.
  kanbanGroupBy: 'status',
  // Par défaut, PAR PROJET : c'est la lecture qui répond à « où en est ce
  // projet », la question la plus fréquente en ouvrant le Planning. « Par
  // personne » répond à « qui est chargé quand » et reste à un clic.
  timelineGroupBy: 'project',
};

const prefsKey = (orgId: string) => `cosmo_org_projects_ui_${orgId}`;

function readPrefs(orgId: string): ProjectsUiPrefs {
  try {
    const raw = localStorage.getItem(prefsKey(orgId));
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...DEFAULT_PREFS, ...(parsed as Partial<ProjectsUiPrefs>) };
    }
  } catch { /* ignore (B14) */ }
  return DEFAULT_PREFS;
}

/** Prefs de l'onglet Projets, persistées par org dans localStorage. */
export const useProjectsUiPrefs = (orgId: string) => {
  const [prefs, setPrefs] = useState<ProjectsUiPrefs>(() => readPrefs(orgId));

  const updatePrefs = useCallback(
    (patch: Partial<ProjectsUiPrefs> | ((prev: ProjectsUiPrefs) => Partial<ProjectsUiPrefs>)) => {
      setPrefs((prev) => {
        const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
        try { localStorage.setItem(prefsKey(orgId), JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    },
    [orgId],
  );

  return { prefs, updatePrefs };
};

// ─── Statuts de flux (mig. 091) ──────────────────────────────────────

/** Ordre d'affichage des colonnes de statut — le flux de gauche à droite. */
export const STATUS_ORDER: TeamTaskStatus[] = ['todo', 'in_progress', 'review', 'blocked', 'done'];

/** Clé de catalogue et pastille par statut. */
export const STATUS_META: Record<TeamTaskStatus, { labelKey: string; dot: string }> = {
  todo: { labelKey: 'projects.statusTodo', dot: 'bg-slate-400' },
  in_progress: { labelKey: 'projects.statusInProgress', dot: 'bg-blue-500' },
  review: { labelKey: 'projects.statusReview', dot: 'bg-violet-500' },
  blocked: { labelKey: 'projects.statusBlocked', dot: 'bg-red-500' },
  done: { labelKey: 'projects.statusDone', dot: 'bg-emerald-500' },
};

/**
 * Pastille « Non attribué » (dérivée de `assigneeIds`, PAS un statut réel en
 * base) — même sémantique que la colonne `KANBAN_UNASSIGNED` du kanban par
 * assigné. Une tâche sans assigné l'affiche à la place de son statut de
 * flux : personne n'étant sur la tâche, son statut réel (à faire, bloquée…)
 * est une information secondaire tant qu'elle n'est attribuée à personne.
 */
export const UNASSIGNED_STATUS_META = { labelKey: 'projects.tasksTabStatusUnassigned', dot: 'bg-slate-300 dark:bg-slate-600' };

/** Pastille de statut à afficher pour une tâche (table, badges…). */
export const taskDisplayStatus = (task: TeamTask): { labelKey: string; dot: string } =>
  task.assigneeIds.length === 0 ? UNASSIGNED_STATUS_META : STATUS_META[task.status];

/**
 * Groupe les tâches par statut, colonnes vides comprises.
 *
 * Une colonne vide se garde volontairement : un kanban dont les colonnes
 * apparaissent et disparaissent selon le contenu empêche de déposer une carte
 * dans un état encore inutilisé — c'est précisément là qu'on veut la mettre.
 */
export const groupByStatus = (tasks: TeamTask[]): Record<TeamTaskStatus, TeamTask[]> => {
  const groups = {
    todo: [] as TeamTask[],
    in_progress: [] as TeamTask[],
    review: [] as TeamTask[],
    blocked: [] as TeamTask[],
    done: [] as TeamTask[],
  } satisfies Record<TeamTaskStatus, TeamTask[]>;
  for (const task of tasks) {
    (groups[task.status] ?? groups.todo).push(task);
  }
  return groups;
};

// ─── Sous-tâches (mig. 092) ──────────────────────────────────────────

/**
 * Avancement d'une checklist, en pourcentage entier.
 *
 * Renvoie `null` — et non 0 — quand la liste est vide : « aucune sous-tâche »
 * et « aucune sous-tâche faite » sont deux états différents, et afficher 0 %
 * sur une tâche sans checklist donnerait l'impression d'un retard inexistant.
 */
export const subtaskProgress = (subtasks: { completed: boolean }[]): number | null => {
  if (subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.completed).length;
  return Math.round((done / subtasks.length) * 100);
};

// ─── Historique (mig. 094) : rendu des valeurs brutes ────────────────

/** Résolveurs injectés — le helper reste pur, l'i18n vit dans le composant. */
export interface ActivityValueResolvers {
  /** Libellé d'un statut de flux ('in_progress' → « En cours »). */
  statusLabel: (status: string) => string;
  /** Nom d'un membre par `userId`, repli lisible si le membre n'existe plus. */
  memberName: (userId: string) => string;
  /** Nom d'un projet par id, repli lisible si le projet n'existe plus. */
  projectName: (projectId: string) => string;
  /** Libellé d'une priorité ('4' → « P4 · Basse »). */
  priorityLabel: (priority: string) => string;
}

/**
 * Traduit une valeur du journal `team_task_activity` pour l'affichage.
 *
 * Le trigger écrit volontairement des valeurs BRUTES (identifiant de statut,
 * UUID de membres joints par des virgules, UUID de projet) : un journal
 * append-only doit rester vrai même si un libellé, une langue ou un nom de
 * projet change plus tard. La résolution appartient donc à la couche de rendu,
 * pas à la base — c'est ce que fait cette fonction.
 *
 * Renvoie `null` quand la valeur est absente ou vide (aucun assigné, aucune
 * échéance) : l'appelant affiche alors son propre libellé « aucun ».
 */
export const resolveActivityValue = (
  field: TeamActivityField,
  value: string | null,
  resolvers: ActivityValueResolvers,
): string | null => {
  const raw = value?.trim() ?? '';
  if (raw === '') return null;

  switch (field) {
    case 'status':
      return resolvers.statusLabel(raw);
    case 'assignees': {
      // `array_to_string(assignee_ids, ',')` — liste possiblement vide, et
      // pouvant citer un membre parti depuis (d'où le repli côté résolveur).
      const names = raw.split(',').map((id) => id.trim()).filter(Boolean).map(resolvers.memberName);
      return names.length > 0 ? names.join(', ') : null;
    }
    case 'project':
      return resolvers.projectName(raw);
    case 'priority':
      return resolvers.priorityLabel(raw);
    default:
      // deadline : déjà lisible telle quelle.
      return raw;
  }
};
