// ═══════════════════════════════════════════════════════════════════
// TASKS — restauration d'une tache supprimee (« Annuler »)
// ═══════════════════════════════════════════════════════════════════
//
// Fichier separe de `hooks.ts`, pour deux raisons.
//
// 1. `hooks.ts` a franchi le plafond de 600 lignes du cliquet d'architecture
//    en accueillant ce hook (`src/architecture.guard.test.ts`). La reponse
//    documentee du depot est de decouper, jamais de relever le plafond.
// 2. La restauration N'EST PAS une creation : elle impose l'identifiant
//    d'origine via le second argument de `create()`, un chemin que seul un
//    « Annuler » doit emprunter. Le sortir de la liste des hooks CRUD rend
//    cette difference visible au lieu de la noyer.
//
// Contrat complet et raison du second argument : `src/lib/restore-id.ts` (R-08).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getTasksRepository } from '@/lib/repository.factory';
import { splitRestore } from '@/lib/restore-id';
import { taskKeys } from './constants';
import type { CreateTaskInput, Task } from './types';

// ═══════════════════════════════════════════════════════════════════
// RESTAURATION (« Annuler ») — recree l'objet sous SON identifiant
// ═══════════════════════════════════════════════════════════════════
//
// Separe de `useCreateTask` a dessein : l'identifiant passe par le second
// argument de `create()`, hors du payload, donc hors de portee d'un objet de
// formulaire enrichi depuis les devtools. Contrat complet et raison de ce
// decoupage : `src/lib/restore-id.ts` (R-08).
//
// ⚠️ N'appeler QUE depuis un toast d'annulation.
export const useRestoreTask = () => {
  const queryClient = useQueryClient();
  const repository = getTasksRepository();

  return useMutation({
    mutationFn: (snapshot: Task) => {
      const { payload, options } = splitRestore(snapshot);
      return repository.create(payload as CreateTaskInput, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (error: Error) => {
      console.error('[useRestoreTask]', error);
    },
  });
};
