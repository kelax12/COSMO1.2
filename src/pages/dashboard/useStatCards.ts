// ═══════════════════════════════════════════════════════════════════
// Les quatre tuiles de statistiques du tableau de bord
//
// FRONTIÈRE : dérivation pure. Ce hook ne rend rien, n'écrit rien, ne
// connaît ni la mise en page, ni les modales, ni le fil de la journée. Il
// prend quatre gisements (tâches, événements, habitudes, complétions de KR)
// et une période, et rend quatre tuiles prêtes à peindre.
//
// ⚠️ Les jours sont découpés en date LOCALE (`toLocaleDateString('en-CA')`),
// jamais en UTC : c'est la convention de tout le produit, et l'inverse a
// déjà produit une série affichée à zéro entre 19 h et minuit en Amérique
// du Nord.
//
// ⚠️ `t` est dans les dépendances du `useMemo`, volontairement : les
// libellés sont traduits, et sans lui un tableau de bord déjà monté les
// garderait dans l'ancienne langue après un changement de langue.
//
// 💡 Le format « x/N » plutôt qu'un compteur brut (#32) n'est pas cosmétique :
// quatre zéros le matin sont du renforcement négatif, là où « 0/5 » crée une
// tension de complétion (Zeigarnik) et guide la décision.
//
// Extrait de `DashboardPage.tsx` le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useMemo } from 'react';
import type { Task } from '@/modules/tasks';
import type { CalendarEvent } from '@/modules/events';
import type { Habit } from '@/modules/habits';
import type { KRCompletion } from '@/modules/kr-completions';
import type { Translator } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';

import type { ViewMode } from '@/lib/view-mode';

export interface StatCard {
  label: string;
  color: string;
  value: string | number;
  chartData: { date: string; value: number }[];
}

interface Params {
  tasks: Task[];
  events: CalendarEvent[];
  habits: Habit[];
  krCompletions: KRCompletion[];
  viewMode: ViewMode;
  /** Jour courant en date LOCALE (`en-CA`), fourni par l'appelant. */
  today: string;
  t: Translator<'dashboard'>['t'];
}

export function useStatCards({ tasks, events, habits, krCompletions, viewMode, today, t }: Params): StatCard[] {
  return useMemo(() => {
    const localDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

    // KR helpers — count completion records per period (simple & reliable)
    const krCompletedInPeriod = (start: string, end: string) =>
      krCompletions.filter(c => {
        const d = localDay(c.completedAt);
        return d >= start && d <= end;
      }).length;

    const krChartByDay = (days: string[]) =>
      days.map(date => ({
        date,
        value: krCompletions.filter(c => localDay(c.completedAt) === date).length,
      }));

    if (viewMode === 'day') {
      const days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toLocaleDateString('en-CA'));
      }
      // #32 — format « objectif du jour » (x/N) plutôt que compteur brut :
      // quatre zéros le matin sont du renforcement négatif ; « 0/5 » crée une
      // tension de complétion (Zeigarnik) et guide la décision.
      const dueToday = tasks.filter(t => t.deadline && localDay(t.deadline) === today);
      const doneDueToday = dueToday.filter(t => t.completed).length;
      const completedToday = tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) === today).length;
      const habitsDoneToday = habits.filter(h => h.completions[today]).length;
      return [
        {
          label: dueToday.length > 0 ? t('stats.tasksToday') : t('stats.tasksCompleted'),
          color: '#3b82f6',
          value: dueToday.length > 0 ? `${doneDueToday}/${dueToday.length}` : completedToday,
          chartData: days.map(date => ({ date, value: tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) === date).length })),
        },
        {
          label: t('stats.agenda'),
          color: '#ef4444',
          value: events.filter(e => localDay(e.start) === today).length,
          chartData: days.map(date => ({ date, value: events.filter(e => localDay(e.start) === date).length })),
        },
        {
          label: t('stats.krCompleted'),
          color: '#22c55e',
          value: krCompletedInPeriod(today, today),
          chartData: krChartByDay(days),
        },
        {
          label: t('stats.habits'),
          color: '#eab308',
          value: habits.length > 0 ? `${habitsDoneToday}/${habits.length}` : 0,
          chartData: days.map(date => ({ date, value: habits.filter(h => h.completions[date]).length })),
        },
      ];
    }

    if (viewMode === 'week') {
      const weeks: { start: string; end: string; label: string }[] = [];
      for (let i = 3; i >= 0; i--) {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        weeks.push({
          start: start.toLocaleDateString('en-CA'),
          end: end.toLocaleDateString('en-CA'),
          // « S1 » en français, « W1 » en anglais : l'abréviation de « semaine »
          // n'est pas universelle, elle appartient au catalogue.
          label: t('chart.weekAbbr', { number: 4 - i }),
        });
      }
      const thisWeek = weeks[weeks.length - 1];
      return [
        {
          label: t('stats.tasksCompleted'),
          color: '#3b82f6',
          value: tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) >= thisWeek.start && localDay(t.completedAt) <= thisWeek.end).length,
          chartData: weeks.map(w => ({ date: w.label, value: tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) >= w.start && localDay(t.completedAt) <= w.end).length })),
        },
        {
          label: t('stats.agenda'),
          color: '#ef4444',
          value: events.filter(e => { const d = localDay(e.start); return d >= thisWeek.start && d <= thisWeek.end; }).length,
          chartData: weeks.map(w => ({ date: w.label, value: events.filter(e => { const d = localDay(e.start); return d >= w.start && d <= w.end; }).length })),
        },
        {
          label: t('stats.krCompleted'),
          color: '#22c55e',
          value: krCompletedInPeriod(thisWeek.start, thisWeek.end),
          chartData: weeks.map(w => ({ date: w.label, value: krCompletedInPeriod(w.start, w.end) })),
        },
        {
          label: t('stats.habits'),
          color: '#eab308',
          value: habits.reduce((sum, h) => sum + Object.keys(h.completions).filter(d => d >= thisWeek.start && d <= thisWeek.end).length, 0),
          chartData: weeks.map(w => ({ date: w.label, value: habits.reduce((sum, h) => sum + Object.keys(h.completions).filter(d => d >= w.start && d <= w.end).length, 0) })),
        },
      ];
    }

    // mois
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: formatDate(d, { month: 'short' }) });
    }
    const thisMonth = months[months.length - 1];
    const monthRange = (m: { year: number; month: number }) => {
      // toLocaleDateString (pas toISOString) : new Date(y, m, 1) est à minuit
      // LOCAL — converti en UTC il retombait sur le dernier jour du mois
      // précédent, excluant systématiquement le dernier jour de chaque mois.
      const start = new Date(m.year, m.month, 1).toLocaleDateString('en-CA');
      const end = new Date(m.year, m.month + 1, 0).toLocaleDateString('en-CA');
      return { start, end };
    };
    const tasksByMonth = (m: { year: number; month: number }) => { const { start, end } = monthRange(m); return tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) >= start && localDay(t.completedAt) <= end).length; };
    const eventsByMonth = (m: { year: number; month: number }) => events.filter(e => { const d = new Date(e.start); return d.getFullYear() === m.year && d.getMonth() === m.month; }).length;
    const habitsByMonth = (m: { year: number; month: number }) => { const { start, end } = monthRange(m); return habits.reduce((sum, h) => sum + Object.keys(h.completions).filter(d => d >= start && d <= end).length, 0); };

    const { start: thisMonthStart, end: thisMonthEnd } = monthRange(thisMonth);
    return [
      {
        label: t('stats.tasksCompleted'),
        color: '#3b82f6',
        value: tasksByMonth(thisMonth),
        chartData: months.map(m => ({ date: m.label, value: tasksByMonth(m) })),
      },
      {
        label: t('stats.agenda'),
        color: '#ef4444',
        value: eventsByMonth(thisMonth),
        chartData: months.map(m => ({ date: m.label, value: eventsByMonth(m) })),
      },
      {
        label: t('stats.krCompleted'),
        color: '#22c55e',
        value: krCompletedInPeriod(thisMonthStart, thisMonthEnd),
        chartData: months.map(m => { const { start, end } = monthRange(m); return { date: m.label, value: krCompletedInPeriod(start, end) }; }),
      },
      {
        label: t('stats.habits'),
        color: '#eab308',
        value: habitsByMonth(thisMonth),
        chartData: months.map(m => ({ date: m.label, value: habitsByMonth(m) })),
      },
    ];
    // `t` en dépendance : les libellés des cartes ET les noms de mois abrégés
    // (`formatDate`) sont calculés ici, donc ce mémo doit être recalculé au
    // changement de langue — sinon un tableau de bord déjà monté garderait ses
    // libellés dans l'ancienne langue.
  }, [tasks, events, habits, krCompletions, viewMode, today, t]);
}
