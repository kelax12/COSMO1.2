import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { PaginationParams, PaginatedResult } from '@/lib/pagination.types';
import type { CreateOptions } from '@/lib/restore-id';

export interface IHabitsRepository {
  fetchHabits(): Promise<Habit[]>;
  /**
   * `options.restoreId` n'est renseigne que par un « Annuler » (R-08) : il
   * passe par un SECOND argument, jamais par le payload, qui vient d'un etat
   * de formulaire. Contrat complet : `src/lib/restore-id.ts`.
   */
  createHabit(habit: CreateHabitInput, options?: CreateOptions): Promise<Habit>;
  updateHabit(id: string, updates: UpdateHabitInput): Promise<Habit>;
  deleteHabit(id: string): Promise<void>;
  toggleCompletion(id: string, date: string): Promise<Habit>;
  getPage(params?: PaginationParams): Promise<PaginatedResult<Habit>>;
}
