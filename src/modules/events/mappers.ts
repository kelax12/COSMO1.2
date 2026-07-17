// ═══════════════════════════════════════════════════════════════════
// Events — pure DB <-> domain mappers (extracted for unit-testability).
// `mapEventToDb` is a SECURITY BOUNDARY: never emit `user_id` (anti
// mass-assignment, faille V1).
// ═══════════════════════════════════════════════════════════════════
import { CalendarEvent } from './types';

/** Supabase DB row type for the `events` table (snake_case). */
export interface EventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  description?: string;
  notes?: string;
  task_id?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'custom';
  recurrence_days?: number[];
  exceptions?: string[];
  user_id?: string;
  created_by?: string;
  created_at?: string;
}

/** DB input type for insert/update operations (snake_case). */
export interface EventDbInput {
  title?: string;
  start_time?: string;
  end_time?: string;
  color?: string;
  description?: string;
  notes?: string;
  task_id?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'custom';
  recurrence_days?: number[];
  exceptions?: string[];
  user_id?: string;
}

export function mapEventFromDb(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    start: row.start_time,
    end: row.end_time,
    color: row.color,
    description: row.description,
    notes: row.notes,
    taskId: row.task_id,
    recurrence: row.recurrence ?? 'none',
    recurrenceDays: row.recurrence_days ?? [],
    exceptions: row.exceptions ?? [],
    createdBy: row.created_by,
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
  return result;
}
