import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTasks } from '@/modules/tasks';

const SEEN_KEY = 'cosmo_deadline_reminder_seen';

/**
 * Rappel de deadlines v1 (#30) : à l'ouverture de l'app, un toast cliquable
 * signale les tâches qui arrivent à échéance aujourd'hui (+ celles en retard).
 * Une fois par jour (flag localStorage daté — pattern useDailyAdGate).
 * Composant headless monté dans Layout.
 */
const DeadlineReminder: React.FC = () => {
  const navigate = useNavigate();
  const { data: tasks = [], isSuccess } = useTasks();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isSuccess || firedRef.current) return;

    const today = new Date().toLocaleDateString('en-CA');
    try {
      if (localStorage.getItem(SEEN_KEY) === today) return;
    } catch { /* ignore */ }

    const dueToday = tasks.filter(
      (t) => !t.completed && t.deadline && t.deadline.slice(0, 10) === today
    ).length;
    const overdue = tasks.filter(
      (t) => !t.completed && t.deadline && t.deadline.slice(0, 10) < today
    ).length;

    if (dueToday === 0 && overdue === 0) return;

    firedRef.current = true;
    try { localStorage.setItem(SEEN_KEY, today); } catch { /* ignore */ }

    const parts: string[] = [];
    if (dueToday > 0) parts.push(`${dueToday} tâche${dueToday > 1 ? 's' : ''} pour aujourd'hui`);
    if (overdue > 0) parts.push(`${overdue} en retard`);

    toast(parts.join(' · '), {
      description: 'Touchez pour voir vos tâches',
      duration: 8000,
      action: {
        label: 'Voir',
        onClick: () => navigate('/tasks'),
      },
    });
  }, [isSuccess, tasks, navigate]);

  return null;
};

export default DeadlineReminder;
