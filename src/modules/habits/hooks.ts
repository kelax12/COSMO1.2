import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getHabitsRepository } from '@/lib/repository.factory';
import { withTimeout } from '@/lib/withTimeout';
import { IHabitsRepository } from './repository';
import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { habitKeys } from './constants';
import { calculateStreak } from './streak';
import { translator } from '@/i18n/useT';
import { recordDemoCreationIfDemo } from '@/lib/demo-engagement';

// Sélection du repository : le factory est déjà un singleton paramétré par
// `appModeStore.isDemo`, et `resetRepositories()` le vide à chaque bascule
// (AuthContext). Le `useMemo(..., [isDemo])` qui vivait ici était donc
// redondant, et son commentaire était faux : `resetRepositories()` est aussi
// appelé sur des chemins où `isDemo` NE change pas (déconnexion d'une vraie
// session), où la mémo rendait alors l'instance que le factory venait de
// jeter. Six modules (events, lists, categories, friends, team-projects,
// organizations) font déjà cet appel direct. Audit A-2, item C-06.
const useHabitsRepository = (): IHabitsRepository => getHabitsRepository();

/**
 * Fetch all habits
 */
export const useHabits = () => {
  const repository = useHabitsRepository();
  return useQuery({
    queryKey: habitKeys.lists(),
    queryFn: () => withTimeout(repository.fetchHabits(), 10_000),
    staleTime: 1000 * 60 * 2, // 2 minutes — les habitudes se cochent souvent
  });
};

/**
 * Create a new habit
 */
export const useCreateHabit = () => {
  const queryClient = useQueryClient();
  const repository = useHabitsRepository();
  
  return useMutation({
    mutationFn: (input: CreateHabitInput) => repository.createHabit(input),
    onSuccess: () => {
      // Engagement démo (src/lib/demo-engagement.ts) : no-op hors démo.
      recordDemoCreationIfDemo();
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.createHabit', { message: error.message }));
    },
  });
};

/**
 * Update an existing habit
 */
export const useUpdateHabit = () => {
  const queryClient = useQueryClient();
  const repository = useHabitsRepository();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateHabitInput }) =>
      repository.updateHabit(id, updates),

    // Optimistic update : la liste reflète la modification immédiatement
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: habitKeys.lists() });
      const previousHabits = queryClient.getQueryData<Habit[]>(habitKeys.lists());
      if (previousHabits) {
        queryClient.setQueryData<Habit[]>(habitKeys.lists(), (old) =>
          old?.map((habit) => (habit.id === id ? { ...habit, ...updates } : habit))
        );
      }
      return { previousHabits };
    },

    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
      queryClient.invalidateQueries({ queryKey: habitKeys.detail(id) });
    },

    // Rollback on error
    onError: (error: Error, _vars, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(habitKeys.lists(), context.previousHabits);
      }
      toast.error(translator('errors').t('mutation.updateHabit2', { message: error.message }));
    },
  });
};

/**
 * Delete a habit
 */
export const useDeleteHabit = () => {
  const queryClient = useQueryClient();
  const repository = useHabitsRepository();
  
  return useMutation({
    mutationFn: (id: string) => repository.deleteHabit(id),

    // Optimistic update : l'habitude disparaît immédiatement de la liste
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: habitKeys.lists() });
      const previousHabits = queryClient.getQueryData<Habit[]>(habitKeys.lists());
      if (previousHabits) {
        queryClient.setQueryData<Habit[]>(habitKeys.lists(), (old) =>
          old?.filter((habit) => habit.id !== id)
        );
      }
      return { previousHabits };
    },

    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
      queryClient.removeQueries({ queryKey: habitKeys.detail(id) });
    },

    // Rollback on error
    onError: (error: Error, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(habitKeys.lists(), context.previousHabits);
      }
      toast.error(translator('errors').t('mutation.deleteHabit', { message: error.message }));
    },
  });
};

/**
 * Toggle habit completion for a specific date
 */
export const useToggleHabitCompletion = () => {
  const queryClient = useQueryClient();
  const repository = useHabitsRepository();
  
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      repository.toggleCompletion(id, date),

    // Optimistic update : le check du jour s'affiche immédiatement (0 ms),
    // sans attendre l'aller-retour réseau. Rollback si le serveur refuse.
    onMutate: async ({ id, date }) => {
      await queryClient.cancelQueries({ queryKey: habitKeys.lists() });
      const previousHabits = queryClient.getQueryData<Habit[]>(habitKeys.lists());
      if (previousHabits) {
        queryClient.setQueryData<Habit[]>(habitKeys.lists(), (old) =>
          old?.map((habit) => {
            if (habit.id !== id) return habit;
            const completions = { ...habit.completions, [date]: !habit.completions[date] };
            return {
              ...habit,
              completions,
              // ⚠️ La série DOIT être recalculée ici, sinon elle ne bouge pas
              // au clic. Depuis la mig. 119 elle vient du serveur
              // (`streakCurrent`) : garder l'ancienne valeur afficherait un
              // compteur figé jusqu'au refetch, alors que c'est précisément
              // le retour visuel qu'on attend en cochant.
              //
              // Le recalcul porte sur la FENÊTRE (400 j) et non sur
              // l'historique complet : exact pour toute série de moins de
              // 400 jours consécutifs, et de toute façon corrigé par le
              // refetch de `onSuccess` juste après.
              streakCurrent: calculateStreak(completions),
              completionsTotal:
                habit.completionsTotal === undefined
                  ? undefined
                  : habit.completionsTotal + (completions[date] ? 1 : -1),
            };
          })
        );
      }
      return { previousHabits };
    },

    // La RPC renvoie la ligne FRAÎCHE (bornée + agrégats serveur, mig. 121) :
    // on l'écrit directement au lieu d'invalider la liste. Avant, chaque coche
    // déclenchait un `get_my_habits()` COMPLET — toutes les habitudes — pour
    // retrouver un état que le serveur venait de nous renvoyer.
    //
    // ⚠️ En mode démo/local, `updated` vient du repository local et porte tout
    // l'historique : l'écriture reste correcte, seuls les agrégats sont
    // absents (les helpers retombent alors sur le calcul JS).
    onSuccess: (updated, { id }) => {
      let written = false;
      queryClient.setQueryData<Habit[]>(habitKeys.lists(), (old) => {
        if (!old) return old;
        written = true;
        return old.map((habit) => (habit.id === id ? updated : habit));
      });
      // ⚠️ Filet indispensable. `setQueryData` n'écrit RIEN si le cache de
      // liste est absent (première ouverture, erreur précédente, cache vidé) :
      // sans cette invalidation, plus rien ne rafraîchissait la liste et la
      // coche restait invisible. L'ancienne version invalidait toujours, donc
      // ce cas était couvert par accident.
      if (!written) {
        queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
      }
      queryClient.invalidateQueries({ queryKey: habitKeys.detail(id) });
    },

    // Rollback on error
    onError: (error: Error, _vars, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(habitKeys.lists(), context.previousHabits);
      }
      toast.error(translator('errors').t('mutation.updateHabit', { message: error.message }));
    },
  });
};
