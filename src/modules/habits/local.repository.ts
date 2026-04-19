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

// Raccourci pour créer une habitude rapidement
const h = (
  id: string, name: string, description: string,
  color: string, icon: string, estimatedTime: number,
  daysBack: number, rate: number, seed: number,
  frequency: 'daily' | 'weekly' | 'monthly' = 'daily'
): Habit => ({
  id, name, description, frequency, estimatedTime, color, icon,
  completions: generateCompletions(daysBack, rate, seed),
  createdAt: getDateString(daysBack),
});

// 10 habitudes — 2 par catégorie, historique varié
const DEMO_HABITS: Habit[] = [
  // ── BIEN-ÊTRE MENTAL ──────────────────────────────────────────────────
  h('h001','Méditation',           '15 min de pleine conscience',           '#8B5CF6','🧘', 15, -120, 0.87, 42),
  h('h002','Journaling',           'Écrire mes pensées du jour',            '#6366F1','✏️', 10, -110, 0.74, 188),

  // ── SANTÉ PHYSIQUE ────────────────────────────────────────────────────
  h('h003','Course à pied',        '30 min de running',                     '#EF4444','🏃', 30, -120, 0.71, 137),
  h('h004','Marche quotidienne',   '8000 pas minimum',                      '#F87171','👟', 45, -110, 0.84, 61),

  // ── ALIMENTATION ─────────────────────────────────────────────────────
  h('h005','Hydratation 2L',       'Boire 2 litres d\'eau par jour',        '#06B6D4','💧',  1, -120, 0.91, 319),
  h('h006','5 fruits & légumes',   'Minimum 5 portions par jour',           '#10B981','🥦',  5, -115, 0.73, 234),

  // ── PRODUCTIVITÉ ─────────────────────────────────────────────────────
  h('h007','Technique Pomodoro',   '4 sessions x 25 min de focus',          '#EF4444','⏱️', 100, -120, 0.82, 101),
  h('h008','Revue agenda matin',   'Planifier la journée en 5 min',         '#6366F1','📅',   5, -110, 0.88, 67),

  // ── APPRENTISSAGE ─────────────────────────────────────────────────────
  h('h009','Duolingo',             '15 min de pratique linguistique',       '#10B981','🌍',  15, -120, 0.84, 251),
  h('h010','Veille technologique', 'Lire Hacker News + Reddit tech',        '#F97316','🔭',  15,  -80, 0.82, 287),
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
