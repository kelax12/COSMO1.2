import { addDays, format, parseISO } from 'date-fns';
import { deadlineDayKey } from '@/lib/deadline';
import { safeGetItem, safeParse, safeSetItem } from '@/lib/safe-json';
import type { TeamTask } from '@/modules/team-projects';

/* ─────────────────────────── Mes échéances ─────────────────────────── */

export const OVERDUE_BUCKET = 'overdue';

export interface DeadlineBucket {
  /** 'overdue' ou une clé de jour 'YYYY-MM-DD'. */
  key: string;
  date: Date | null;
  tasks: TeamTask[];
}

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Mes tâches ouvertes rangées sur sept jours à partir d'aujourd'hui, plus un
 * panier « en retard » en tête quand il y en a. Les jours vides sont gardés :
 * la frise montre aussi où il n'y a rien.
 */
export function deadlineBuckets(open: readonly TeamTask[], now: Date = new Date()): DeadlineBucket[] {
  const today = dayKey(now);
  const days: DeadlineBucket[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(parseISO(today), i);
    return { key: dayKey(date), date, tasks: [] };
  });
  const byKey = new Map(days.map((b) => [b.key, b]));
  const overdue: TeamTask[] = [];
  for (const task of open) {
    const key = deadlineDayKey(task.deadline);
    if (!key) continue;
    if (key < today) overdue.push(task);
    else byKey.get(key)?.tasks.push(task);
  }
  overdue.sort((a, b) => deadlineDayKey(a.deadline).localeCompare(deadlineDayKey(b.deadline)));
  return overdue.length > 0 ? [{ key: OVERDUE_BUCKET, date: null, tasks: overdue }, ...days] : days;
}

/** Premier panier non vide, sinon aujourd'hui. */
export const defaultBucketKey = (buckets: readonly DeadlineBucket[]): string =>
  (buckets.find((b) => b.tasks.length > 0) ?? buckets.find((b) => b.key !== OVERDUE_BUCKET) ?? buckets[0])?.key ?? '';

/** Reporter d'un jour : demain pour une tâche en retard, sinon le lendemain de l'échéance. */
export function postponedDeadline(deadline: string | undefined, now: Date = new Date()): string {
  const today = dayKey(now);
  const current = deadlineDayKey(deadline);
  const base = !current || current < today ? today : current;
  return dayKey(addDays(parseISO(base), 1));
}

/**
 * Pastille d'échéance d'une tâche : « hier », « aujourd'hui », « demain »
 * pour ces trois jours, sinon le jour et le mois en toutes lettres. `kind`
 * donne la teinte (passé = rouge).
 */
export type DeadlineKind = 'past' | 'yesterday' | 'today' | 'tomorrow' | 'later';

export function deadlineKind(deadline: string | undefined, now: Date = new Date()): DeadlineKind | null {
  const key = deadlineDayKey(deadline);
  if (!key) return null;
  const today = dayKey(now);
  if (key === today) return 'today';
  if (key === dayKey(addDays(parseISO(today), -1))) return 'yesterday';
  if (key === dayKey(addDays(parseISO(today), 1))) return 'tomorrow';
  return key < today ? 'past' : 'later';
}

/* ─────────────────────────── Note épinglée ─────────────────────────── */

export interface PinnedNote {
  id: string;
  text: string;
  updatedAt: string;
}

/** Note personnelle : reste dans ce navigateur, une liste par entreprise et par personne. */
const notesKey = (orgId: string, userId: string) => `cosmo_apercu_notes_v1:${orgId}:${userId}`;

export function loadNotes(orgId: string, userId: string): PinnedNote[] {
  const raw = safeParse<unknown>(safeGetItem(notesKey(orgId, userId)) ?? '');
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is PinnedNote =>
    !!n && typeof n === 'object'
    && typeof (n as PinnedNote).id === 'string'
    && typeof (n as PinnedNote).text === 'string'
    && typeof (n as PinnedNote).updatedAt === 'string');
}

export function saveNotes(orgId: string, userId: string, notes: readonly PinnedNote[]): void {
  safeSetItem(notesKey(orgId, userId), JSON.stringify(notes));
}
