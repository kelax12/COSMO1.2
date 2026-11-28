// ═══════════════════════════════════════════════════════════════════
// Events — pure DB <-> domain mappers (extracted for unit-testability).
// `mapEventToDb` is a SECURITY BOUNDARY: never emit `user_id` (anti
// mass-assignment, faille V1).
// ═══════════════════════════════════════════════════════════════════
import { CalendarEvent } from './types';
import type { ColumnsExist, DbPatch, DbRow, Verified } from '@/lib/db-contract';

/**
 * Ligne `events` lue (snake_case). Les colonnes facultatives tolèrent `null` :
 * Postgres rend NULL pour une colonne vide, jamais `undefined`.
 */
export interface EventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  description?: string | null;
  notes?: string | null;
  task_id?: string | null;
  recurrence?: string | null;
  recurrence_days?: number[] | null;
  exceptions?: string[] | null;
  user_id?: string;
  created_by?: string | null;
  created_at?: string | null;
  is_private?: boolean | null;
  review_dismissed_at?: string | null;
}

/** Ce que `mapEventToDb` émet : sans `id` ni `user_id` (faille V1, garantie par `DbPatch`). */
export type EventDbInput = DbPatch<'events'>;

// ARC-07 : une colonne renommée en base casse `tsc` ici, pas en production.
export type EventRowContract = Verified<ColumnsExist<EventRow, DbRow<'events'>>>;

export function mapEventFromDb(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    start: row.start_time,
    end: row.end_time,
    // NULL en base → absent du domaine (même règle que `mapTaskFromDb`).
    color: row.color ?? undefined,
    description: row.description ?? undefined,
    notes: row.notes ?? undefined,
    taskId: row.task_id ?? undefined,
    recurrence: (row.recurrence as CalendarEvent['recurrence'] | null | undefined) ?? 'none',
    recurrenceDays: row.recurrence_days ?? [],
    exceptions: row.exceptions ?? [],
    createdBy: row.created_by ?? undefined,
    isPrivate: row.is_private ?? false,
    reviewDismissedAt: row.review_dismissed_at ?? null,
  };
}

export function mapEventToDb(input: Partial<CalendarEvent>): EventDbInput {
  const result: EventDbInput = {};
  if (input.title !== undefined) result.title = input.title;
  if (input.start !== undefined) result.start_time = input.start;
  if (input.end !== undefined) result.end_time = input.end;
  if (input.color !== undefined) result.color = input.color;
  if (input.description !== undefined) result.description = input.description;
  if (input.notes !== undefined) result.notes = input.notes;
  if (input.taskId !== undefined) result.task_id = input.taskId;
  if (input.recurrence !== undefined) result.recurrence = input.recurrence;
  if (input.recurrenceDays !== undefined) result.recurrence_days = input.recurrenceDays;
  if (input.exceptions !== undefined) result.exceptions = input.exceptions;
  if (input.isPrivate !== undefined) result.is_private = input.isPrivate;
  // `null` est une valeur SIGNIFIANTE ici (« ne plus ignorer ce créneau »), pas
  // une absence : la garde reste `!== undefined`, jamais un test de vérité.
  if (input.reviewDismissedAt !== undefined) result.review_dismissed_at = input.reviewDismissedAt;
  return result;
}
