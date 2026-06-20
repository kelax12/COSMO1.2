// Insights purs pour la refonte « test » audacieuse du Dashboard.
// Présentation/dérivation uniquement — aucune logique métier (mutations via hooks).
import type { Task } from '@/modules/tasks';
import type { Habit } from '@/modules/habits';
import type { CalendarEvent } from '@/modules/events';

export const dayKey = (d: Date) => d.toLocaleDateString('en-CA');

/** Streak (jours consécutifs complétés) terminant aujourd'hui ou hier. */
export function computeStreak(completions: Record<string, boolean>, now: Date): number {
  const cursor = new Date(now);
  // Si aujourd'hui pas encore fait, le streak peut tenir via hier.
  if (!completions[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (completions[dayKey(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface TimelineItem {
  id: string;
  kind: 'event' | 'task';
  title: string;
  /** minutes depuis minuit pour le tri */
  sortMin: number;
  timeLabel: string;
  color?: string;
  completed?: boolean;
}

/** Fusionne les événements du jour + les tâches dues aujourd'hui, triés par heure. */
export function buildTodayTimeline(events: CalendarEvent[], tasks: Task[], now: Date): TimelineItem[] {
  const key = dayKey(now);
  const items: TimelineItem[] = [];

  for (const ev of events) {
    if (dayKey(new Date(ev.start)) !== key) continue;
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    const fmt = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    items.push({
      id: `ev-${ev.id}`,
      kind: 'event',
      title: ev.title,
      sortMin: s.getHours() * 60 + s.getMinutes(),
      timeLabel: `${fmt(s)} – ${fmt(e)}`,
      color: ev.color,
    });
  }

  for (const t of tasks) {
    if (!t.deadline || dayKey(new Date(t.deadline)) !== key) continue;
    const d = new Date(t.deadline);
    items.push({
      id: `task-${t.id}`,
      kind: 'task',
      title: t.name,
      sortMin: d.getHours() * 60 + d.getMinutes(),
      timeLabel: 'échéance',
      completed: t.completed,
    });
  }

  return items.sort((a, b) => a.sortMin - b.sortMin);
}

export interface DailyFocus {
  done: number;
  total: number;
  pct: number;
  tasksDone: number;
  tasksTotal: number;
  habitsDone: number;
  habitsTotal: number;
}

/** Avancement du jour : tâches dues aujourd'hui complétées + habitudes faites. */
export function computeDailyFocus(tasks: Task[], habits: Habit[], now: Date): DailyFocus {
  const key = dayKey(now);
  const todayTasks = tasks.filter((t) => t.deadline && dayKey(new Date(t.deadline)) === key);
  const tasksDone = todayTasks.filter((t) => t.completed).length;
  const tasksTotal = todayTasks.length;
  const habitsTotal = habits.length;
  const habitsDone = habits.filter((h) => h.completions[key]).length;
  const total = tasksTotal + habitsTotal;
  const done = tasksDone + habitsDone;
  return {
    done,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
    tasksDone,
    tasksTotal,
    habitsDone,
    habitsTotal,
  };
}
