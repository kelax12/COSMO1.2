import { IHabitsRepository } from './repository';
import type { CreateOptions } from '@/lib/restore-id';
import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { safeGetItem, safeParse, safeParseArray, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import { localizedDemoHabits } from './local.seed';
import { toggleCompletionDay } from './streak';
import { checkedDays, isRealDayKey } from './completion-days';
import { MAX_SCHEDULE_HISTORY, normalizeScheduledDays } from './schedule';
import { HABITS_STORAGE_KEY as STORAGE_KEY, HABIT_COMPLETIONS_STORAGE_KEY as COMPLETIONS_KEY } from './constants';

/** `{ [habitId]: jours cochés }` : la forme de `habit_completions` (une ligne par jour coché). */
type CompletionRows = Record<string, string[]>;

// Mêmes refus que la base (contrat de parité V12.2) : CHECK `habits_frequency_check`
// (mig. 002) et format du jour que la bascule serveur accepte (mig. 121).
const FREQUENCIES: ReadonlySet<string> = new Set(['daily', 'weekly', 'monthly']);

function assertFrequency(frequency: unknown): void {
  if (frequency !== undefined && !FREQUENCIES.has(frequency as string)) throw makeApiError('invalid_input');
}

/** Jour réel au format `YYYY-MM-DD` (le 30 février est refusé, comme par le cast `::date`). */
function assertDayKey(date: string): void {
  if (!isRealDayKey(date)) throw makeApiError('invalid_input');
}

/**
 * Jours prévus rangés comme la base les rend (mig. 254) : mêmes refus que les
 * CHECK `habits_scheduled_days_check` / `habits_schedule_history_check`, et
 * « tous les jours » (vide ou 7 jours) relu ABSENT, comme `scheduled_days`
 * NULL et `schedule_history` '[]' côté Supabase.
 */
function applySchedule<T extends Partial<Habit>>(input: T): T {
  const out: T = { ...input };
  if (input.scheduledDays !== undefined) {
    const days = normalizeScheduledDays(input.scheduledDays);
    if (days.length === 0 || days.length === 7) delete out.scheduledDays;
    else out.scheduledDays = days;
  }
  if (input.scheduleHistory !== undefined) {
    if (input.scheduleHistory.length > MAX_SCHEDULE_HISTORY) throw makeApiError('invalid_input');
    const history = input.scheduleHistory.map((e) => {
      const days = normalizeScheduledDays(e.days);
      if (days.length === 0 || !isRealDayKey(e.from)) throw makeApiError('invalid_input');
      return { from: e.from, days };
    });
    if (history.length === 0) delete out.scheduleHistory;
    else out.scheduleHistory = history;
  }
  return out;
}

const asMap = (days: readonly string[] | undefined): Record<string, boolean> =>
  Object.fromEntries([...(days ?? [])].sort().map((day) => [day, true]));

export class LocalStorageHabitsRepository implements IHabitsRepository {
  /**
   * Habitudes + jours cochés, lus dans DEUX clés comme la prod les lit dans deux
   * tables (DAT-02). `Habit.completions` n'est que la carte dérivée des lignes.
   *
   * Reprise d'une démo existante : une habitude qui porte encore une carte
   * `completions` dans `cosmo_demo_habits` (ancien format) voit ses jours cochés
   * versés dans `cosmo_demo_habit_completions`, puis la carte est retirée de
   * l'habitude. Les clés à `false` ou qui ne sont pas un jour réel n'ont pas de
   * ligne, comme dans la table. Idempotent, et sans effet sur la lecture si
   * l'écriture échoue (quota, navigation privée).
   */
  private getHabits(): Habit[] {
    const stored = safeParseArray<Habit>(safeGetItem(STORAGE_KEY));
    // Corrompu ou stockage indisponible : on re-seme plutot que de faire
    // tomber la page (regle B14, helper `safeParseArray`).
    if (!stored) {
      const seeded = localizedDemoHabits();
      this.saveHabits(seeded);
      return seeded.map((h) => ({ ...h, completions: asMap(checkedDays(h.completions)) }));
    }

    const parsed = safeParse<CompletionRows>(safeGetItem(COMPLETIONS_KEY));
    const rows: CompletionRows = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};

    let legacy = false;
    const habits = stored.map((habit) => {
      const known = Array.isArray(rows[habit.id]) ? rows[habit.id].filter(isRealDayKey) : [];
      if (habit.completions === undefined) return { ...habit, completions: asMap(known) };
      legacy = true;
      return { ...habit, completions: asMap([...new Set([...known, ...checkedDays(habit.completions)])]) };
    });

    if (legacy) {
      try {
        this.saveHabits(habits);
      } catch {
        // La démo reste lisible : la reprise sera retentée à la lecture suivante.
      }
    }
    return habits;
  }

  /** Écrit les lignes d'abord, puis les habitudes SANS carte : jamais l'inverse (un crash entre les deux ne perd aucun jour). */
  private saveHabits(habits: Habit[]): void {
    const rows: CompletionRows = {};
    for (const habit of habits) {
      const days = [...new Set(checkedDays(habit.completions))].sort();
      if (days.length > 0) rows[habit.id] = days;
    }
    writeJsonOrThrow(COMPLETIONS_KEY, rows);
    writeJsonOrThrow(
      STORAGE_KEY,
      habits.map(({ completions: _completions, ...habit }) => habit),
    );
  }

  async fetchHabits(): Promise<Habit[]> {
    return this.getHabits();
  }

  async createHabit(input: CreateHabitInput, options?: CreateOptions): Promise<Habit> {
    assertFrequency(input.frequency);
    const habits = this.getHabits();
    const newHabit: Habit = {
      ...applySchedule(input),
      // Parite avec le repository Supabase : `restoreId` vient d'un second
      // argument reserve aux « Annuler », jamais du payload (R-08).
      id: options?.restoreId ?? crypto.randomUUID(),
      completions: asMap(checkedDays(input.completions)),
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

    // Fusion PUIS rangement : « tous les jours » efface le réglage précédent,
    // comme le NULL écrit en base par `mapHabitToDb`.
    // `completions` d'un update est ignoré, comme côté Supabase : un jour ne se
    // coche que par `toggleCompletion` (l'historique n'est pas une colonne).
    const { completions: _ignored, ...patch } = updates;
    const updatedHabit: Habit = applySchedule({ ...habits[index], ...patch });
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
