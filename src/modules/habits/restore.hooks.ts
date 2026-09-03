// ═══════════════════════════════════════════════════════════════════
// HABITS — restauration d'une habitude supprimee (« Annuler »)
// ═══════════════════════════════════════════════════════════════════
//
// Jumeau de `src/modules/tasks/restore.hooks.ts`, ajoute par C-37.
//
// `HabitCard` recreait l'habitude avec `const { id: _id, ...rest }`, donc sous
// un NOUVEL identifiant. Tout ce qui est keye par l'identifiant d'habitude
// restait alors orphelin, en silence — au premier rang la pause
// (`use-habit-pauses`, clef `cosmo_habit_pauses`, indexee par `habit.id`) et
// l'historique de complétions cote Supabase.
//
// Contrat complet et raison du second argument : `src/lib/restore-id.ts` (R-08).
//
// ⚠️ N'appeler QUE depuis un toast d'annulation. Une DUPLICATION
//    (`HabitActionsMenu`) doit continuer de laisser la base choisir l'identifiant.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getHabitsRepository } from '@/lib/repository.factory';
import { splitRestore } from '@/lib/restore-id';
import { habitKeys } from './constants';
import type { CreateHabitInput, Habit } from './types';
import { toast } from 'sonner';
import * as Sentry from '@sentry/react';
import { translator } from '@/i18n/useT';

export const useRestoreHabit = () => {
  const queryClient = useQueryClient();
  const repository = getHabitsRepository();

  return useMutation({
    mutationFn: (snapshot: Habit) => {
      const { payload, options } = splitRestore(snapshot);
      return repository.createHabit(payload as CreateHabitInput, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
    },
    // Un « Annuler » rate doit se VOIR : `console.error` est supprime du bundle
    // de production (vite.config.ts), l'echec serait donc muet.
    onError: (error: Error) => {
      toast.error(
        translator('errors').t('mutation.restoreHabit', { message: error.message }),
      );
      Sentry.captureException(error, {
        level: 'error',
        tags: { context: 'restore-undo', restore_entity: 'habit' },
      });
    },
  });
};
