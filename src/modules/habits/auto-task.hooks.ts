import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
