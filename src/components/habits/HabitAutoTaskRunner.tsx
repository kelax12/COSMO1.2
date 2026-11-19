// Crée, chaque jour prévu, la tâche des habitudes qui le demandent (mig. 265).
// Headless, monté une fois dans `Layout`. La réservation du jour (`claimDay`)
// passe AVANT la création : deux onglets ou deux appareils n'en créent qu'une.
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useHabits, useHabitAutoTasks, dueAutoTasks, autoTaskInput, habitAutoTaskKeys,
} from '@/modules/habits';
import { getHabitAutoTaskRepository } from '@/modules/habits/auto-task.instance';
import { useCreateTask } from '@/modules/tasks';

const HabitAutoTaskRunner: React.FC = () => {
  const { data: habits } = useHabits();
  const { data: settings } = useHabitAutoTasks();
  const createTask = useCreateTask();
  const queryClient = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (!habits || !settings || settings.length === 0 || running.current) return;
    // Même convention de jour que les coches d'habitude (date machine).
    const day = new Date().toLocaleDateString('en-CA');
    const due = dueAutoTasks(habits, settings, day);
    if (due.length === 0) return;
    running.current = true;
    void (async () => {
      const repo = getHabitAutoTaskRepository();
      for (const { habit, setting } of due) {
        try {
          if (await repo.claimDay(habit.id, day)) {
            await createTask.mutateAsync(autoTaskInput(habit, setting, day));
          }
        } catch {
          // L'erreur de création remonte déjà par le toast du hook ; on passe
          // à l'habitude suivante.
        }
      }
      await queryClient.invalidateQueries({ queryKey: habitAutoTaskKeys.list() });
      running.current = false;
    })();
  }, [habits, settings, createTask, queryClient]);

  return null;
};

export default HabitAutoTaskRunner;
