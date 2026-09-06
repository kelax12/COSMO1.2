import { useEffect, useRef } from 'react';
import { translator } from '@/i18n/useT';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useTasks } from '@/modules/tasks';
import { isDueToday, isOverdue } from '@/lib/deadline';

const SEEN_KEY = 'cosmo_deadline_reminder_seen';

/**
 * Rappel de deadlines v1 (#30) : à l'ouverture de l'app, un toast cliquable
 * signale les tâches qui arrivent à échéance aujourd'hui (+ celles en retard).
 * Une fois par jour (flag localStorage daté).
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

    // `.slice(0, 10)` rendait le jour UTC de l'instant stocké, comparé ici à
    // un jour LOCAL : les deux ne coïncident qu'à Greenwich (risque R-01).
    const dueToday = tasks.filter((t) => !t.completed && isDueToday(t.deadline)).length;
    const overdue = tasks.filter((t) => isOverdue(t.deadline, t.completed)).length;

    if (dueToday === 0 && overdue === 0) return;

    firedRef.current = true;
    try { localStorage.setItem(SEEN_KEY, today); } catch { /* ignore */ }

    // Le pluriel passe par `tp` (Intl.PluralRules) : `${n > 1 ? 's' : ''}` est
    // une règle FRANÇAISE écrite à la main, fausse dès qu'on change de langue
    // (l'anglais met 0 au pluriel, le français au singulier).
    const { t, tp } = translator('common');
    const parts: string[] = [];
    if (dueToday > 0) parts.push(tp('deadlineReminder.dueToday', dueToday, { count: dueToday }));
    if (overdue > 0) parts.push(t('deadlineReminder.overdue', { count: overdue }));

    toast(parts.join(' · '), {
      description: t('deadlineReminder.description'),
      duration: 8000,
      action: {
        label: t('deadlineReminder.action'),
        onClick: () => navigate('/tasks'),
      },
    });
  }, [isSuccess, tasks, navigate]);

  return null;
};

export default DeadlineReminder;
