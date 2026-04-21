import React, { useState } from 'react';
import { Clock, Flame, Calendar, Edit2, Trash2, CheckCircle, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Habit, useDeleteHabit, useToggleHabitCompletion } from '@/modules/habits';
import { Button } from '@/components/ui/button';
import HabitModal from './HabitModal';

interface HabitCardProps {
  habit: Habit;
}

const calculateStreak = (completions: Record<string, boolean>): number => {
  const completed = Object.entries(completions)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort()
    .reverse();

  if (completed.length === 0) return 0;

  const today = new Date().toLocaleDateString('en-CA');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');

  if (completed[0] !== today && completed[0] !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 1; i < completed.length; i++) {
    const curr = new Date(completed[i - 1]);
    const prev = new Date(completed[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
};

const HabitCard: React.FC<HabitCardProps> = React.memo(({ habit }) => {
  const deleteHabitMutation = useDeleteHabit();
  const toggleCompletionMutation = useToggleHabitCompletion();

  const [showDetails, setShowDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const streak = calculateStreak(habit.completions);

  const handleDelete = () => {
    deleteHabitMutation.mutate(habit.id);
    setIsDeleting(false);
  };

  const generateDays = (count: number) => {
    const today = new Date();
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (count - 1 - i));
      return {
        date: date.toLocaleDateString('en-CA'),
        dayName: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
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
    const createdDate = habit.createdAt ? habit.createdAt.split('T')[0] : '';
    const isBeforeCreation = createdDate ? day.date < createdDate : false;
    const btnSize = size === 'normal' ? 'w-9 h-9 md:w-10 md:h-10' : 'w-8 h-8 md:w-9 md:h-9';
    const iconSize = size === 'normal' ? 18 : 14;

    return (
      <div className="flex flex-col items-center">
        <div className="text-[10px] md:text-xs text-slate-500 mb-1 font-medium">{day.dayName}</div>
        <button
          onClick={() => !isBeforeCreation && handleDayClick(day.date)}
          disabled={isBeforeCreation}
          className={`${btnSize} rounded-lg border-2 transition-all flex items-center justify-center ${
            day.isToday
              ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 shadow-sm'
              : 'border-slate-200 dark:border-slate-700'
          } ${
            isCompleted
              ? 'border-blue-500 text-white'
              : isBeforeCreation
              ? 'opacity-30 grayscale cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-transparent'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
          style={{ backgroundColor: isCompleted ? '#2563EB' : undefined }}
        >
          {isCompleted ? (
            <CheckCircle size={iconSize} className="md:w-5 md:h-5" />
          ) : isBeforeCreation ? (
            <Circle size={iconSize - 4} className="opacity-10" />
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
              <div className="flex items-center gap-4 mt-1 text-xs md:text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Clock size={12} className="md:w-3.5 md:h-3.5" />
                  <span>{habit.estimatedTime} min</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame size={12} className="md:w-3.5 md:h-3.5 text-orange-500" />
                  <span>{streak} jours</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDetails(!showDetails)}
              className={`flex items-center gap-2 md:px-3 md:w-auto ${
                showDetails ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : ''
              }`}
            >
              <Calendar size={18} className="md:w-4 md:h-4" />
              <span className="text-xs font-medium md:hidden">Historique</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
              <Edit2 size={18} className="md:w-4 md:h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsDeleting(true)}>
              <Trash2 size={18} className="md:w-4 md:h-4" />
            </Button>
          </div>
        </div>

        {/* Confirmation suppression */}
        <AnimatePresence>
          {isDeleting && (
            <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                    <Trash2 className="text-red-600 dark:text-red-400" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    Supprimer l'habitude
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                    Êtes-vous sûr de vouloir supprimer l'habitude "{habit.name}" ? Cette action est
                    irréversible.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsDeleting(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1"
                      onClick={handleDelete}
                    >
                      <Trash2 size={14} data-icon="inline-start" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
            <h4 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Suivi détaillé (30 jours)
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
    JSON.stringify(prev.habit.completions) === JSON.stringify(next.habit.completions)
  );
});

export default HabitCard;
