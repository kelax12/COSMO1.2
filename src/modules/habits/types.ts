export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  estimatedTime: number;
  color: string;
  icon: string;
  completions: Record<string, boolean>;
  createdAt?: string;
  userId?: string;
}

export type CreateHabitInput = Omit<Habit, 'id' | 'createdAt' | 'completions'> & {
  completions?: Record<string, boolean>;
};

export type UpdateHabitInput = Partial<Omit<Habit, 'id' | 'createdAt'>>;
