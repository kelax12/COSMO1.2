import React, { useState } from 'react';
import { Clock, Flame, Calendar, Edit2, Trash2, CheckCircle, Pause } from 'lucide-react';
import { useHabitPauses } from '@/lib/hooks/use-habit-pauses';
import { format } from 'date-fns';
import { formatDate, getDateLocale } from '@/i18n/format';
import { Habit, useDeleteHabit, useToggleHabitCompletion, useRestoreHabit } from '@/modules/habits';
import { useT } from '@/i18n/useT';
import { habitStreak } from '@/modules/habits/streak';
import { showUndoToast } from '@/lib/undo-toast';
import { Button } from '@/components/ui/button';
import HabitModal from './HabitModal';
import HabitActionsMenu from './HabitActionsMenu';

interface HabitCardProps {
  habit: Habit;
}

const HabitCard: React.FC<HabitCardProps> = React.memo(({ habit }) => {
  const { t } = useT('habits');
  const deleteHabitMutation = useDeleteHabit();
  // « Annuler » uniquement : rend l'habitude sous SON identifiant, sinon sa
  // pause (keyee par id) et son historique restent orphelins (R-08, C-37).
  const restoreHabitMutation = useRestoreHabit();
  const toggleCompletionMutation = useToggleHabitCompletion();

  const [showDetails, setShowDetails] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Série de jours consécutifs (logique : modules/habits/streak.ts).
  const streak = habitStreak(habit);
  const { isPaused, getPauseUntil } = useHabitPauses();
  const paused = isPaused(habit.id);
  const pausedUntil = getPauseUntil(habit.id);

  const handleDelete = () => {
    const snapshot = habit;
    deleteHabitMutation.mutate(habit.id, {
      onSuccess: () => {
        // Raccourci d'annulation (barre de progression 5 s, haut à droite).
        // On rend l'habitude sous SON identifiant, avec son historique.
        showUndoToast(t('card.deleted'), () => {
          restoreHabitMutation.mutate(snapshot);
        });
      },
    });
  };

  const generateDays = (count: number) => {
    const today = new Date();
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (count - 1 - i));
      return {
        date: date.toLocaleDateString('en-CA'),
        dayName: formatDate(date, { weekday: 'short' }),
        dayNumber: date.getDate(),
        isToday: i === count - 1,
      };
    });
  };

  const compactDays = generateDays(7);
  const detailedDays = generateDays(30);

  const handleDayClick = (date: string) => {
    toggleCompletionMutation.mutate({ id: habit.id, date });
  };

  const habitColor = habit.color.startsWith('#') ? habit.color : '#3B82F6';

  const DayButton = ({
    day,
    size = 'normal',
  }: {
    day: { date: string; dayName: string; dayNumber: number; isToday: boolean };
    size?: 'normal' | 'small';
  }) => {
    const isCompleted = habit.completions[day.date];
    const btnSize = size === 'normal' ? 'w-11 h-11 md:w-10 md:h-10' : 'w-11 h-11 md:w-9 md:h-9';
    const iconSize = size === 'normal' ? 18 : 14;

    return (
      <div className="flex flex-col items-center">
        <div className="text-caption md:text-xs text-slate-500 mb-1 font-medium">{day.dayName}</div>
        <button
          onClick={() => handleDayClick(day.date)}
          className={`${btnSize} rounded-lg border-2 transition-all flex items-center justify-center ${
            day.isToday
              ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 shadow-sm'
              : 'border-[rgb(var(--color-border))]'
          } ${
            isCompleted
              ? 'border-[rgb(var(--color-accent-solid))] text-white'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-[rgb(var(--color-border-strong))]'
          }`}
          style={{ backgroundColor: isCompleted ? '#2563EB' : undefined }}
        >
          {isCompleted ? (
            <CheckCircle size={iconSize} className="md:w-5 md:h-5" />
          ) : (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{day.dayNumber}</span>
          )}
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="card p-4 md:p-6 hover:shadow-md transition-all">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: habitColor }} />
            <div>
              <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                {habit.name}
              </h3>
              <div className="flex items-center gap-4 mt-1 text-xs md:text-sm text-slate-600 flex-wrap">
                <div className="flex items-center gap-1">
                  <Clock size={12} className="md:w-3.5 md:h-3.5" />
                  <span>{habit.estimatedTime} min</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame size={12} className="md:w-3.5 md:h-3.5 text-orange-500" />
                  <span>{streak} jours</span>
                </div>
                {paused && pausedUntil && (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-caption font-medium"
                    title={t('card.pausedUntil', { date: format(pausedUntil, 'd MMMM yyyy', { locale: getDateLocale() }) })}
                  >
                    <Pause size={10} />
                    <span>{t('card.paused')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-1 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0">
            {/* Historique — gauche sur mobile, inline sur desktop */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className={`flex items-center gap-1.5 px-2 h-11 sm:h-9 min-w-11 sm:min-w-0 ${
                showDetails ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : ''
              }`}
            >
              <Calendar size={16} />
              <span className="text-xs font-medium md:hidden">{t('card.history')}</span>
            </Button>
            {/* Ordre demandé : crayon (édition) → « ... » (actions) → corbeille (suppression) */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" onClick={() => setEditOpen(true)}>
                <Edit2 size={18} className="md:w-4 md:h-4" />
              </Button>
              {/* Menu « ... » — popover avec « Créer une tâche » + « Planifier dans l'agenda » */}
              <HabitActionsMenu habit={habit} />
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" onClick={handleDelete}>
                <Trash2 size={18} className="md:w-4 md:h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendrier compact 7 jours */}
        <div className="mb-4 overflow-x-auto pb-2 -mx-1 px-1 hide-scrollbar">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300">
              7 derniers jours
            </span>
          </div>
          <div className="flex gap-2 min-w-max">
            {compactDays.map((day) => (
              <DayButton key={day.date} day={day} size="normal" />
            ))}
          </div>
        </div>

        {/* Vue détaillée 30 jours */}
        {showDetails && (
          <div className="border-t border-[rgb(var(--color-border))] pt-4 mt-2">
            <h4 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
              {t('card.detailedTracking')}
            </h4>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
              {detailedDays.map((day) => (
                <DayButton key={day.date} day={day} size="small" />
              ))}
            </div>
          </div>
        )}
      </div>

      <HabitModal isOpen={editOpen} onClose={() => setEditOpen(false)} habit={habit} />
    </>
  );
}, (prev, next) => {
  return (
    prev.habit.id === next.habit.id &&
    prev.habit.name === next.habit.name &&
    prev.habit.estimatedTime === next.habit.estimatedTime &&
    prev.habit.color === next.habit.color &&
    // ⚠️ La série SERVEUR fait partie de ce qui est rendu (mig. 119) : sans
    // elle ici, une correction venue du serveur pouvait être JETÉE quand la
    // mise à jour optimiste produisait exactement le même JSON de complétions.
    // La carte restait alors sur la valeur optimiste, et l'écart avec le
    // tableau (qui, lui, re-rendait) devenait invisible à déboguer.
    prev.habit.streakCurrent === next.habit.streakCurrent &&
    prev.habit.completionsTotal === next.habit.completionsTotal &&
    JSON.stringify(prev.habit.completions) === JSON.stringify(next.habit.completions)
  );
});

export default HabitCard;
