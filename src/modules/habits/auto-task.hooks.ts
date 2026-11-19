import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Habit } from './types';
import { getHabitAutoTaskRepository } from './auto-task.instance';
import { habitKeys } from './constants';

export const habitAutoTaskKeys = {
  list: () => [...habitKeys.all, 'auto-tasks'] as const,
};

/** Habitudes qui créent une tâche chaque jour prévu (mig. 265). */
export const useHabitAutoTasks = () =>
  useQuery({
    queryKey: habitAutoTaskKeys.list(),
    queryFn: () => getHabitAutoTaskRepository().list(),
    staleTime: 1000 * 60 * 5,
  });

/** Active (avec sa catégorie) ou coupe l'option pour une habitude. */
export const useSetHabitAutoTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, enabled, category }: { habitId: string; enabled: boolean; category: string | null }) => {
      const repo = getHabitAutoTaskRepository();
      if (enabled) await repo.enable(habitId, category);
      else await repo.disable(habitId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: habitAutoTaskKeys.list() }),
  });
};

/** Case « Créer automatiquement une tâche » de `HabitModal` : état relu à l'ouverture, enregistré après la sauvegarde. */
export function useHabitAutoTask(isOpen: boolean, habit: Habit | undefined) {
  const { data: autoTasks = [] } = useHabitAutoTasks();
  const setMutation = useSetHabitAutoTask();
  const setting = habit ? autoTasks.find((a) => a.habitId === habit.id) : undefined;
  const [checked, setChecked] = useState(false);

  // Relu à l'ouverture seulement : un rafraîchissement de la liste ne doit pas
  // défaire une case cochée pendant la saisie.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `setting` omis : relu à l'ouverture (isOpen, habit.id), le suivre écraserait la saisie en cours
  useEffect(() => { if (isOpen) setChecked(!!setting); }, [isOpen, habit?.id]);

  /** À appeler après la sauvegarde de l'habitude, avec son identifiant. */
  const save = (habitId: string, selectedCategory: string | undefined) => {
    const category = selectedCategory ?? null;
    if (!checked && !setting) return;
    if (checked && setting?.category === category) return;
    setMutation.mutate({ habitId, enabled: checked, category });
  };

  const withDirty = (formDirty: boolean) => formDirty || checked !== !!setting;
  return { checked, setChecked, withDirty, savedCategory: setting?.category ?? null, save };
}
