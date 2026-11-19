// Sélection du dépôt des tâches automatiques (démo / Supabase), hors du
// factory d'entrée : les deux côtés arrivent par `import()`, et un changement
// de mode oublie le dépôt choisi (même mécanisme que `org-config`).
import { defineRepository, lazy } from '@/lib/define-repository';
import type { IHabitAutoTaskRepository } from './auto-task.repository';

export const getHabitAutoTaskRepository = defineRepository<IHabitAutoTaskRepository>(
  lazy(() => import('./auto-task.local.repository').then((m) => new m.LocalStorageHabitAutoTaskRepository())),
  lazy(() => import('./auto-task.supabase.repository').then((m) => new m.SupabaseHabitAutoTaskRepository())),
);
