// ═══════════════════════════════════════════════════════════════════
// okrs/mappers — frontière de mapping DB ↔ domaine (anti-mass-assignment).
// Extrait de supabase.repository.ts. Fonctions pures, testables. Le `mapToDb`
// ne doit JAMAIS émettre `user_id` (ajouté explicitement dans create()).
// ═══════════════════════════════════════════════════════════════════
import { OKR, KeyResult } from './types';

// ─── DB row types ────────────────────────────────────────────────────────────

export interface OKRRow {
  id: string;
  title: string;
  description: string;
  category: string;
  progress: number;
  completed: boolean;
  key_results: KeyResult[]; // JSONB — kept for backward compat
  start_date: string;
  end_date: string;
  user_id?: string;
  created_at?: string;
}

export interface KRRow {
  id: string;
  okr_id: string;
  user_id: string;
  title: string;
  unit: string;
  current_value: number;
  target_value: number;
  estimated_time: number;
  completed: boolean;
  completed_at: string | null;
}

export interface OKRDbInput {
  title?: string;
  description?: string;
  category?: string;
  progress?: number;
  completed?: boolean;
  key_results?: KeyResult[];
  start_date?: string;
  end_date?: string;
  user_id?: string;
}

// ─── Mappers ───────────────────────────────────────────────────────────────

export const mapKRFromDb = (row: KRRow): KeyResult => ({
  id: row.id,
  title: row.title,
  unit: row.unit,
  currentValue: Number(row.current_value),
  targetValue: Number(row.target_value),
  estimatedTime: row.estimated_time,
  completed: row.completed,
  completedAt: row.completed_at ?? null,
});

export const mapKRToDb = (kr: KeyResult, okrId: string, userId: string) => ({
  id: kr.id,
  okr_id: okrId,
  user_id: userId,
  title: kr.title,
  unit: kr.unit,
  current_value: kr.currentValue,
  target_value: kr.targetValue,
  estimated_time: kr.estimatedTime,
  completed: kr.completed,
});

export const mapOkrFromDb = (row: OKRRow, keyResults: KeyResult[]): OKR => ({
  id: row.id,
  title: row.title,
  description: row.description,
  category: row.category,
  progress: row.progress,
  completed: row.completed,
  keyResults,
  startDate: row.start_date,
  endDate: row.end_date,
});

// ⚠️ Ne JAMAIS émettre user_id ici (mass-assignment V1) — il est ajouté
// explicitement dans create() depuis supabase.auth.getUser().
export const mapOkrToDb = (input: Partial<OKR>): OKRDbInput => {
  const result: OKRDbInput = {};
  if (input.title !== undefined) result.title = input.title;
  if (input.description !== undefined) result.description = input.description;
  if (input.category !== undefined) result.category = input.category;
  if (input.progress !== undefined) result.progress = input.progress;
  if (input.completed !== undefined) result.completed = input.completed;
  if (input.keyResults !== undefined) result.key_results = input.keyResults;
  if (input.startDate !== undefined) result.start_date = input.startDate;
  if (input.endDate !== undefined) result.end_date = input.endDate;
  return result;
};
