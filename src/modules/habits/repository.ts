import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { PaginationParams, PaginatedResult } from '@/lib/pagination.types';

export interface IHabitsRepository {
  fetchHabits(): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  createHabit(habit: CreateHabitInput): Promise<Habit>;
  updateHabit(id: string, updates: UpdateHabitInput): Promise<Habit>;
  deleteHabit(id: string): Promise<void>;
  toggleCompletion(id: string, date: string): Promise<Habit>;
  getPage(params?: PaginationParams): Promise<PaginatedResult<Habit>>;
}
