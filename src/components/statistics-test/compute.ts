// Type partagé des données statistiques (refonte « test »).
import type { Task } from '@/modules/tasks';
import type { CalendarEvent } from '@/modules/events';
import type { Habit } from '@/modules/habits';
import type { OKR } from '@/modules/okrs';

export interface StatsData {
  tasks: Task[];
  events: CalendarEvent[];
  habits: Habit[];
  okrs: OKR[];
}
