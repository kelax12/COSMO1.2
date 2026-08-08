// ═══════════════════════════════════════════════════════════════════
// Onglet Projets (mode entreprise) — helpers partagés
// Palette de couleurs projet, tri des tâches, stats, prefs UI persistées.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react';
import { isPast, isToday, parseISO } from 'date-fns';
import type { TeamTask } from '@/modules/team-projects';

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
  /** Densité des listes de tâches. */
  density: 'comfortable' | 'compact';
}

const DEFAULT_PREFS: ProjectsUiPrefs = {
  view: 'list',
  assigneeFilter: null,
  teamFilter: '',
  collapsed: {},
  showArchived: false,
  statusFilter: 'all',
  density: 'comfortable',
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
