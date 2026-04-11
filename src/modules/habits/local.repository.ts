import { IHabitsRepository } from './repository';
import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';

const STORAGE_KEY = 'cosmo_demo_habits';

// Helper pour générer des dates
const getDateString = (daysFromNow: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
};

// Génère un historique de complétion déterministe sur toute une période
const generateCompletions = (daysBack: number, rate: number, seed: number): Record<string, boolean> => {
  const completions: Record<string, boolean> = {};
  for (let i = daysBack; i <= 0; i++) {
    const date = getDateString(i);
    // Hash déterministe basé sur le jour et la graine — pas de Math.random()
    const hash = Math.abs((i * 1664525 + seed * 1013904223 + i * seed * 22695477) % 100);
    completions[date] = hash < rate * 100;
  }
  return completions;
};

// Données de démonstration — 14 mois d'historique complet
const DEMO_HABITS: Habit[] = [
  {
    id: 'habit-1',
    name: 'Méditation',
    description: '15 minutes de méditation le matin',
    frequency: 'daily',
    estimatedTime: 15,
    color: '#8B5CF6',
    icon: '🧘',
    completions: generateCompletions(-430, 0.87, 42),
    createdAt: getDateString(-430),
  },
  {
    id: 'habit-2',
    name: 'Sport',
    description: "30 minutes d'exercice quotidien",
    frequency: 'daily',
    estimatedTime: 30,
    color: '#EF4444',
    icon: '🏃',
    completions: generateCompletions(-400, 0.71, 137),
    createdAt: getDateString(-400),
  },
  {
    id: 'habit-3',
    name: 'Lecture',
    description: 'Lire 20 pages minimum',
    frequency: 'daily',
    estimatedTime: 30,
    color: '#3B82F6',
    icon: '📚',
    completions: generateCompletions(-420, 0.79, 73),
    createdAt: getDateString(-420),
  },
  {
    id: 'habit-4',
    name: 'Apprentissage langue',
    description: '15 minutes de pratique quotidienne',
    frequency: 'daily',
    estimatedTime: 15,
    color: '#10B981',
    icon: '🌍',
    completions: generateCompletions(-380, 0.64, 251),
    createdAt: getDateString(-380),
  },
  {
    id: 'habit-5',
    name: 'Journaling',
    description: 'Écrire dans mon journal',
    frequency: 'daily',
    estimatedTime: 10,
    color: '#F97316',
    icon: '✏️',
    completions: generateCompletions(-365, 0.74, 188),
    createdAt: getDateString(-365),
  },
  {
    id: 'habit-6',
    name: 'Gratitude',
    description: '3 choses pour lesquelles je suis reconnaissant',
    frequency: 'daily',
    estimatedTime: 5,
    color: '#EC4899',
    icon: '🙏',
    completions: generateCompletions(-180, 0.83, 91),
    createdAt: getDateString(-180),
  },
  {
    id: 'habit-7',
    name: 'Hydratation',
    description: 'Boire 2L d\'eau par jour',
    frequency: 'daily',
    estimatedTime: 1,
    color: '#06B6D4',
    icon: '💧',
    completions: generateCompletions(-120, 0.91, 319),
    createdAt: getDateString(-120),
  },
];

export class LocalStorageHabitsRepository implements IHabitsRepository {
  private getHabits(): Habit[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      this.saveHabits(DEMO_HABITS);
      return DEMO_HABITS;
    }
    return JSON.parse(data);
  }

  private saveHabits(habits: Habit[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }

  async fetchHabits(): Promise<Habit[]> {
    return this.getHabits();
  }

  async getById(id: string): Promise<Habit | null> {
    const habits = this.getHabits();
    const habit = habits.find(h => h.id === id);
    return habit || null;
  }

  async createHabit(input: CreateHabitInput): Promise<Habit> {
    const habits = this.getHabits();
    const newHabit: Habit = {
      ...input,
      id: crypto.randomUUID(),
      completions: input.completions || {},
      createdAt: new Date().toISOString(),
    };
    this.saveHabits([newHabit, ...habits]);
    return newHabit;
  }

  async updateHabit(id: string, updates: UpdateHabitInput): Promise<Habit> {
    const habits = this.getHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) throw new Error('Habit not found');

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
    const habits = this.getHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) throw new Error('Habit not found');

    const habit = habits[index];
    const completions = { ...habit.completions };
    completions[date] = !completions[date];

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
