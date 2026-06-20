// Calcul pur des stat-cards du Dashboard — copié verbatim depuis DashboardPage
// (logique inline non exportée) pour rester self-contained sans modifier
// l'original. Aucune dépendance React/DOM. Voir DashboardPage.tsx pour la source.
import type { Task } from '@/modules/tasks';
import type { Habit } from '@/modules/habits';
import type { CalendarEvent } from '@/modules/events';

export type ViewMode = 'jour' | 'semaine' | 'mois';

export interface StatCard {
  label: string;
  color: string;
  value: number;
  chartData: { date: string; value: number }[];
}

interface KRCompletionLike {
  completedAt: string;
}

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export const formatBarDate = (raw: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (raw === todayStr) return "Aujourd'hui";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (raw === yesterday.toLocaleDateString('en-CA')) return 'Hier';
  const [, m, d] = raw.split('-');
  return `${d} ${MONTHS_FR[parseInt(m, 10) - 1]}`;
};

export function computeStatCards(
  viewMode: ViewMode,
  tasks: Task[],
  events: CalendarEvent[],
  habits: Habit[],
  krCompletions: KRCompletionLike[],
  today: string,
): StatCard[] {
  const localDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

  const krCompletedInPeriod = (start: string, end: string) =>
    krCompletions.filter((c) => {
      const d = localDay(c.completedAt);
      return d >= start && d <= end;
    }).length;

  const krChartByDay = (days: string[]) =>
    days.map((date) => ({
      date,
      value: krCompletions.filter((c) => localDay(c.completedAt) === date).length,
    }));

  if (viewMode === 'jour') {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-CA'));
    }
    return [
      {
        label: 'Tâches complétées',
        color: '#3b82f6',
        value: tasks.filter((t) => t.completed && t.completedAt && localDay(t.completedAt) === today).length,
        chartData: days.map((date) => ({ date, value: tasks.filter((t) => t.completed && t.completedAt && localDay(t.completedAt) === date).length })),
      },
      {
        label: 'Agenda',
        color: '#ef4444',
        value: events.filter((e) => localDay(e.start) === today).length,
        chartData: days.map((date) => ({ date, value: events.filter((e) => localDay(e.start) === date).length })),
      },
      {
        label: 'KR réalisés',
        color: '#22c55e',
        value: krCompletedInPeriod(today, today),
        chartData: krChartByDay(days),
      },
      {
        label: 'Habitudes',
        color: '#eab308',
        value: habits.filter((h) => h.completions[today]).length,
        chartData: days.map((date) => ({ date, value: habits.filter((h) => h.completions[date]).length })),
      },
    ];
  }

  if (viewMode === 'semaine') {
    const weeks: { start: string; end: string; label: string }[] = [];
    for (let i = 3; i >= 0; i--) {
      const end = new Date();
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      weeks.push({
        start: start.toLocaleDateString('en-CA'),
        end: end.toLocaleDateString('en-CA'),
        label: `S${4 - i}`,
      });
    }
    const thisWeek = weeks[weeks.length - 1];
    return [
      {
        label: 'Tâches complétées',
        color: '#3b82f6',
        value: tasks.filter((t) => t.completed && t.completedAt && localDay(t.completedAt) >= thisWeek.start && localDay(t.completedAt) <= thisWeek.end).length,
        chartData: weeks.map((w) => ({ date: w.label, value: tasks.filter((t) => t.completed && t.completedAt && localDay(t.completedAt) >= w.start && localDay(t.completedAt) <= w.end).length })),
      },
      {
        label: 'Agenda',
        color: '#ef4444',
        value: events.filter((e) => { const d = localDay(e.start); return d >= thisWeek.start && d <= thisWeek.end; }).length,
        chartData: weeks.map((w) => ({ date: w.label, value: events.filter((e) => { const d = localDay(e.start); return d >= w.start && d <= w.end; }).length })),
      },
      {
        label: 'KR réalisés',
        color: '#22c55e',
        value: krCompletedInPeriod(thisWeek.start, thisWeek.end),
        chartData: weeks.map((w) => ({ date: w.label, value: krCompletedInPeriod(w.start, w.end) })),
      },
      {
        label: 'Habitudes',
        color: '#eab308',
        value: habits.reduce((sum, h) => sum + Object.keys(h.completions).filter((d) => d >= thisWeek.start && d <= thisWeek.end).length, 0),
        chartData: weeks.map((w) => ({ date: w.label, value: habits.reduce((sum, h) => sum + Object.keys(h.completions).filter((d) => d >= w.start && d <= w.end).length, 0) })),
      },
    ];
  }

  // mois
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('fr-FR', { month: 'short' }) });
  }
  const thisMonth = months[months.length - 1];
  const monthRange = (m: { year: number; month: number }) => {
    const start = new Date(m.year, m.month, 1).toLocaleDateString('en-CA');
    const end = new Date(m.year, m.month + 1, 0).toLocaleDateString('en-CA');
    return { start, end };
  };
  const tasksByMonth = (m: { year: number; month: number }) => { const { start, end } = monthRange(m); return tasks.filter((t) => t.completed && t.completedAt && localDay(t.completedAt) >= start && localDay(t.completedAt) <= end).length; };
  const eventsByMonth = (m: { year: number; month: number }) => events.filter((e) => { const d = new Date(e.start); return d.getFullYear() === m.year && d.getMonth() === m.month; }).length;
  const habitsByMonth = (m: { year: number; month: number }) => { const { start, end } = monthRange(m); return habits.reduce((sum, h) => sum + Object.keys(h.completions).filter((d) => d >= start && d <= end).length, 0); };

  const { start: thisMonthStart, end: thisMonthEnd } = monthRange(thisMonth);
  return [
    {
      label: 'Tâches complétées',
      color: '#3b82f6',
      value: tasksByMonth(thisMonth),
      chartData: months.map((m) => ({ date: m.label, value: tasksByMonth(m) })),
    },
    {
      label: 'Agenda',
      color: '#ef4444',
      value: eventsByMonth(thisMonth),
      chartData: months.map((m) => ({ date: m.label, value: eventsByMonth(m) })),
    },
    {
      label: 'KR réalisés',
      color: '#22c55e',
      value: krCompletedInPeriod(thisMonthStart, thisMonthEnd),
      chartData: months.map((m) => { const { start, end } = monthRange(m); return { date: m.label, value: krCompletedInPeriod(start, end) }; }),
    },
    {
      label: 'Habitudes',
      color: '#eab308',
      value: habitsByMonth(thisMonth),
      chartData: months.map((m) => ({ date: m.label, value: habitsByMonth(m) })),
    },
  ];
}
