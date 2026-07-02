// Rappel de fin de journée (#24) — bandeau in-app, opt-in via Settings.
// Affiché après 18 h quand des habitudes du jour ne sont pas cochées, une
// seule fois par jour (flag localStorage daté), jamais en pause.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repeat, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHabits } from '@/modules/habits';
import { useHabitReminderPref } from '@/modules/ui-states';
import { useHabitPauses } from '@/lib/hooks/use-habit-pauses';

const DISMISSED_KEY = 'cosmo_habit_reminder_dismissed';
const REMINDER_HOUR = 18;

const todayKey = () => new Date().toLocaleDateString('en-CA');

const readDismissedToday = (): boolean => {
  try { return localStorage.getItem(DISMISSED_KEY) === todayKey(); } catch { return false; }
};

const HabitEveningReminder = () => {
  const navigate = useNavigate();
  const { habitReminderEnabled } = useHabitReminderPref();
  const { data: habits = [] } = useHabits();
  const { isPaused } = useHabitPauses();
  const [dismissed, setDismissed] = useState(readDismissedToday);

  if (!habitReminderEnabled || dismissed) return null;
  if (new Date().getHours() < REMINDER_HOUR) return null;

  const today = todayKey();
  const remaining = habits.filter(h => !h.completions[today] && !isPaused(h.id));
  if (remaining.length === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, today); } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        className="sticky top-0 z-40 flex items-center gap-3 px-4 py-2.5 border-b bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
        role="status"
      >
        <Repeat size={16} className="text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
        <button
          type="button"
          onClick={() => { dismiss(); navigate('/habits'); }}
          className="flex-1 text-left text-sm font-medium text-amber-800 dark:text-amber-200 hover:underline underline-offset-2"
        >
          {remaining.length} habitude{remaining.length > 1 ? 's' : ''} pas encore cochée{remaining.length > 1 ? 's' : ''} aujourd'hui — voir
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Masquer le rappel pour aujourd'hui"
          className="shrink-0 p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors"
        >
          <X size={14} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default HabitEveningReminder;
