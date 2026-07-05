import { getTasksRepository, getHabitsRepository, getEventsRepository } from '@/lib/repository.factory';
import { appModeStore } from '@/lib/app-mode.store';
import type { Task } from '@/modules/tasks';
import type { Habit } from '@/modules/habits';
import type { CalendarEvent } from '@/modules/events';

/**
 * Migration des données démo vers un compte réel (amélioration UX n°9).
 *
 * Séquence :
 *  1. `snapshotDemoData()` — appelé AVANT `exitDemoIfActive()` dans
 *     `register()` : photographie tasks/habits/events démo dans localStorage
 *     (clé datée, TTL 24 h). Le snapshot survit à un éventuel détour par la
 *     confirmation d'email (même appareil).
 *  2. `runPendingDemoMigration()` — appelé à l'ouverture d'une session réelle
 *     (AuthContext) : rejoue le snapshot via les repositories Supabase, puis
 *     supprime la clé. Idempotent : la clé est retirée dès le démarrage pour
 *     qu'un double événement auth ne duplique pas les données.
 *
 * Limites assumées (v1) : catégories, listes, OKR et collaborateurs ne sont
 * pas migrés — les tâches arrivent sans catégorie/liste.
 */

const PENDING_KEY = 'cosmo_demo_migration_pending';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface DemoSnapshot {
  at: number;
  tasks: Task[];
  habits: Habit[];
  events: CalendarEvent[];
}

export async function snapshotDemoData(): Promise<void> {
  if (!appModeStore.isDemo) return;
  try {
    const [tasks, habits, events] = await Promise.all([
      getTasksRepository().getAll(),
      getHabitsRepository().fetchHabits(),
      getEventsRepository().getAll(),
    ]);
    // Ne migre que ce que l'utilisateur a réellement touché serait idéal, mais
    // indistinguable des seeds — on migre tout ; l'utilisateur fait le tri.
    const snapshot: DemoSnapshot = { at: Date.now(), tasks, habits, events };
    localStorage.setItem(PENDING_KEY, JSON.stringify(snapshot));
  } catch {
    // Snapshot best-effort : l'inscription ne doit jamais échouer pour ça.
  }
}

export function hasPendingDemoMigration(): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) !== null;
  } catch {
    return false;
  }
}

/** Rejoue le snapshot vers Supabase. Retourne le nombre d'éléments migrés. */
export async function runPendingDemoMigration(): Promise<number> {
  if (appModeStore.isDemo) return 0;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return 0;
    // Retrait immédiat : un double SIGNED_IN ne doit pas dupliquer les données.
    localStorage.removeItem(PENDING_KEY);
  } catch {
    return 0;
  }
  const snapshot = safeParse<DemoSnapshot>(raw, { at: 0, tasks: [], habits: [], events: [] });
  if (!snapshot.at || Date.now() - snapshot.at > MAX_AGE_MS) return 0;

  const tasksRepo = getTasksRepository();
  const habitsRepo = getHabitsRepository();
  const eventsRepo = getEventsRepository();
  let migrated = 0;

  // Écritures séquentielles par type, best-effort : un échec unitaire ne
  // bloque pas le reste de la migration.
  for (const t of snapshot.tasks) {
    try {
      await tasksRepo.create({
        name: t.name,
        description: t.description,
        priority: t.priority,
        // Catégories/listes démo non migrées : les ids n'existent pas côté compte.
        category: '',
        deadline: t.deadline,
        estimatedTime: t.estimatedTime,
        bookmarked: t.bookmarked,
        completed: t.completed,
        completedAt: t.completedAt,
        subtasks: t.subtasks,
      });
      migrated++;
    } catch { /* continue */ }
  }
  for (const h of snapshot.habits) {
    try {
      await habitsRepo.createHabit({
        name: h.name,
        description: h.description,
        frequency: h.frequency,
        estimatedTime: h.estimatedTime,
        color: h.color,
        icon: h.icon,
        completions: h.completions,
      });
      migrated++;
    } catch { /* continue */ }
  }
  for (const e of snapshot.events) {
    try {
      await eventsRepo.create({
        title: e.title,
        start: e.start,
        end: e.end,
        color: e.color,
        description: e.description,
        notes: e.notes,
        recurrence: e.recurrence,
        recurrenceDays: e.recurrenceDays,
        exceptions: e.exceptions,
      });
      migrated++;
    } catch { /* continue */ }
  }
  return migrated;
}
