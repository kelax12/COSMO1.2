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
  1: { dot: 'bg-slate-400', label: 'P1 · Très basse' },
  2: { dot: 'bg-sky-400', label: 'P2 · Basse' },
  3: { dot: 'bg-blue-500', label: 'P3 · Normale' },
  4: { dot: 'bg-amber-500', label: 'P4 · Haute' },
  5: { dot: 'bg-red-500', label: 'P5 · Critique' },
};

// ─── Tâches : retard, tri, stats ─────────────────────────────────────

export const isTaskOverdue = (task: TeamTask): boolean => {
  if (task.completed || !task.deadline) return false;
  const d = parseISO(task.deadline);
  return isPast(d) && !isToday(d);
};

/**
 * Tri des tâches ouvertes : deadline croissante (sans deadline en dernier),
 * puis priorité décroissante, puis date de création.
 */
export const sortOpenTasks = (tasks: TeamTask[]): TeamTask[] =>
  [...tasks].sort((a, b) => {
    const da = a.deadline || '9999-99-99';
    const db = b.deadline || '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
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

// ─── Prefs UI persistées (filtres, vue, projets repliés) ─────────────

export interface ProjectsUiPrefs {
  view: 'list' | 'kanban';
  /** null = toutes les tâches ; sinon userId de l'assigné filtré. */
  assigneeFilter: string | null;
  /** '' = toutes équipes, 'org' = sans équipe, sinon teamId. */
  teamFilter: string;
  collapsed: Record<string, boolean>;
  showArchived: boolean;
}

const DEFAULT_PREFS: ProjectsUiPrefs = {
  view: 'list',
  assigneeFilter: null,
  teamFilter: '',
  collapsed: {},
  showArchived: false,
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
