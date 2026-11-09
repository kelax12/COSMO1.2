import { IHabitsRepository } from './repository';
import type { CreateOptions } from '@/lib/restore-id';
import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { safeGetItem, safeParseArray, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import { localizedDemoHabits } from './local.seed';
import { toggleCompletionDay } from './streak';

const STORAGE_KEY = 'cosmo_demo_habits';

// Mêmes refus que la base (contrat de parité V12.2) : CHECK `habits_frequency_check`
// (mig. 002) et format du jour que la bascule serveur accepte (mig. 121).
const FREQUENCIES: ReadonlySet<string> = new Set(['daily', 'weekly', 'monthly']);

function assertFrequency(frequency: unknown): void {
  if (frequency !== undefined && !FREQUENCIES.has(frequency as string)) throw makeApiError('invalid_input');
}

/** Jour réel au format `YYYY-MM-DD` (le 30 février est refusé, comme par le cast `::date`). */
function assertDayKey(date: string): void {
  const parsed = new Date(`${date}T00:00:00Z`);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
  if (!valid) throw makeApiError('invalid_input');
}

export class LocalStorageHabitsRepository implements IHabitsRepository {
  private getHabits(): Habit[] {
    const stored = safeParseArray<Habit>(safeGetItem(STORAGE_KEY));
    // Corrompu ou stockage indisponible : on re-seme plutot que de faire
    // tomber la page (regle B14, helper `safeParseArray`).
    if (!stored) {
      const seeded = localizedDemoHabits();
      this.saveHabits(seeded);
      return seeded;
    }
    return stored;
  }

  private saveHabits(habits: Habit[]): void {
    writeJsonOrThrow(STORAGE_KEY, habits);
  }

  async fetchHabits(): Promise<Habit[]> {
    return this.getHabits();
  }

  async createHabit(input: CreateHabitInput, options?: CreateOptions): Promise<Habit> {
    assertFrequency(input.frequency);
    const habits = this.getHabits();
    const newHabit: Habit = {
      ...input,
      // Parite avec le repository Supabase : `restoreId` vient d'un second
      // argument reserve aux « Annuler », jamais du payload (R-08).
      id: options?.restoreId ?? crypto.randomUUID(),
      completions: input.completions || {},
      createdAt: new Date().toISOString(),
    };
    this.saveHabits([newHabit, ...habits]);
    return newHabit;
  }

  async updateHabit(id: string, updates: UpdateHabitInput): Promise<Habit> {
    assertFrequency(updates.frequency);
    const habits = this.getHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) throw makeApiError('not_found');

    const updatedHabit = { ...habits[index], ...updates };
    habits[index] = updatedHabit;
    this.saveHabits(habits);
    return updatedHabit;
  }

  async deleteHabit(id: string): Promise<void> {
    const habits = this.getHabits();
    const filteredHabits = habits.filter(h => h.id !== id);
    this.saveHabits(filteredHabits);
  }

  async toggleCompletion(id: string, date: string): Promise<Habit> {
    assertDayKey(date);
    const habits = this.getHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) throw makeApiError('not_found');

    const habit = habits[index];
    // Même contrat que `habit_completions` (mig. 248) : un jour décoché
    // disparaît de la carte.
    const completions = toggleCompletionDay(habit.completions, date);

    const updatedHabit = { ...habit, completions };
    habits[index] = updatedHabit;
    this.saveHabits(habits);
    return updatedHabit;
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<Habit>> {
    const habits = this.getHabits();
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;
    let startIndex = 0;
    if (params.cursor) {
      const cursorIndex = habits.findIndex(h => h.id === params.cursor);
      if (cursorIndex !== -1) startIndex = cursorIndex + 1;
    }
    const slice = habits.slice(startIndex, startIndex + limit + 1);
    const hasMore = slice.length > limit;
    const items = hasMore ? slice.slice(0, limit) : slice;
    return {
      data: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      nextCursorDate: null,
    };
  }
}
