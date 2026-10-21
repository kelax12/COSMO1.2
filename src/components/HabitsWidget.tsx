import { useNavigate } from 'react-router';
import { Circle, CheckCircle2, Flame, List, LayoutGrid } from 'lucide-react';
import { useHabits, useToggleHabitCompletion } from '@/modules/habits';
import { habitStreak } from '@/modules/habits/streak';
import { formatDurationMinutes } from '@/lib/duration';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { DashboardCardSkeleton } from '@/components/skeletons';
import TouchTarget from '@/components/mobile/TouchTarget';

export type HabitsView = 'list' | 'week';

interface HabitsWidgetProps {
  view: HabitsView;
  onViewChange: (view: HabitsView) => void;
}

/** Les 7 derniers jours, du plus ancien à aujourd'hui, en clé locale `YYYY-MM-DD`. */
const lastSevenDays = (): Date[] =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
const dayKey = (d: Date) => d.toLocaleDateString('en-CA');

/**
 * Widget Habitudes du tableau de bord (2026-10-21), deux vues :
 * - `list` (maquette 1) : rangées à séparateurs, comme les widgets tâches ;
 * - `week` (maquette 5) : une case par jour sur les 7 derniers jours.
 * Par défaut liste en petit, semaine en moyen et grand ; la personne peut
 * basculer, et la vue choisie est gardée quand on redimensionne.
 */
const HabitsWidget = ({ view, onViewChange }: HabitsWidgetProps) => {
  const { t, tp } = useT('dashboard');
  const navigate = useNavigate();
  const { data: habits = [], isLoading } = useHabits();
  const toggle = useToggleHabitCompletion();
  const days = lastSevenDays();
  const today = dayKey(days[6]);

  if (isLoading && habits.length === 0) return <DashboardCardSkeleton />;

  const done = habits.filter((h) => h.completions[today]).length;
  const doneTime = habits.reduce((s, h) => (h.completions[today] ? s + h.estimatedTime : s), 0);

  const viewButton = (v: HabitsView, Icon: typeof List, label: string) => (
    <button
      type="button"
      onClick={() => onViewChange(v)}
      aria-pressed={view === v}
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        view === v
          ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]'
          : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]'
      }`}
    >
      <Icon size={15} aria-hidden="true" />
    </button>
  );

  return (
    <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-headline sm:text-lg font-bold text-[rgb(var(--color-text-primary))]">{t('sections.todayHabits')}</h2>
          <p className="text-label sm:text-sm text-[rgb(var(--color-text-secondary))]">
            {t('habits.progress', { done, total: habits.length, duration: formatDurationMinutes(doneTime) })}
          </p>
        </div>
        <div role="group" className="flex shrink-0 gap-0.5">
          {viewButton('list', List, t('habitsWidget.viewList'))}
          {viewButton('week', LayoutGrid, t('habitsWidget.viewWeek'))}
        </div>
      </div>

      {habits.length === 0 ? (
        <button type="button" onClick={() => navigate('/habits')} className="text-sm text-[rgb(var(--color-accent))] hover:underline">
          {t('habits.create')}
        </button>
      ) : view === 'list' ? (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {habits.map((h) => {
            const isDone = !!h.completions[today];
            return (
              <li key={h.id} className="flex items-center gap-2 px-2 rounded-xl hover:bg-[rgb(var(--color-hover))]">
                <TouchTarget
                  onClick={() => toggle.mutate({ id: h.id, date: today })}
                  aria-label={t('habitsWidget.dayCell', { name: h.name, date: formatDate(days[6], { weekday: 'long' }) })}
                  aria-pressed={isDone}
                  className={`-my-1 -ml-1 ${isDone ? 'text-[rgb(var(--color-success))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-success))]'}`}
                >
                  {isDone
                    ? <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" />
                    : <Circle size={18} strokeWidth={1.75} aria-hidden="true" />}
                </TouchTarget>
                <span className={`flex-1 min-w-0 truncate text-sm font-medium ${isDone ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
                  {h.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-[rgb(var(--color-text-secondary))]">{formatDurationMinutes(h.estimatedTime)}</span>
                <span className="shrink-0 inline-flex items-center gap-0.5 text-xs tabular-nums text-orange-500" title={tp('habits.streak', habitStreak(h))}>
                  <Flame size={13} aria-hidden="true" />{habitStreak(h)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-1.5 text-sm">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">{t('sections.todayHabits')}</span></th>
                {days.map((d, i) => (
                  <th
                    key={dayKey(d)}
                    scope="col"
                    className={`w-7 text-center text-xs font-medium ${i === 6 ? 'text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'}`}
                  >
                    {formatDate(d, { weekday: 'narrow' })}
                  </th>
                ))}
                <th scope="col"><span className="sr-only">{tp('habits.streak', 0)}</span></th>
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => (
                <tr key={h.id}>
                  <th scope="row" className="max-w-0 w-full truncate pr-2 text-left font-medium text-[rgb(var(--color-text-primary))]">{h.name}</th>
                  {days.map((d, i) => {
                    const key = dayKey(d);
                    const isDone = !!h.completions[key];
                    return (
                      <td key={key} className="text-center">
                        <button
                          type="button"
                          onClick={() => toggle.mutate({ id: h.id, date: key })}
                          aria-pressed={isDone}
                          aria-label={`${t('habitsWidget.dayCell', { name: h.name, date: formatDate(d, { weekday: 'long', day: 'numeric' }) })} : ${isDone ? t('habitsWidget.done') : t('habitsWidget.notDone')}`}
                          className={`inline-block h-4 w-4 rounded align-middle transition-colors ${
                            isDone
                              ? 'bg-[rgb(var(--color-success))]'
                              : i === 6
                                ? 'border-[1.5px] border-dashed border-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-success)/0.3)]'
                                : 'bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-success)/0.3)]'
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="pl-2 text-right">
                    <span className="inline-flex items-center gap-0.5 text-xs tabular-nums text-orange-500" title={tp('habits.streak', habitStreak(h))}>
                      <Flame size={13} aria-hidden="true" />{habitStreak(h)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HabitsWidget;
