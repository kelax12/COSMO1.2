// ═══════════════════════════════════════════════════════════════════
// Déplacer une tâche d'une colonne à l'autre du Tableau
//
// Deux chemins d'écriture, et le choix n'est pas cosmétique :
//
//   · Vers « Terminée », une tâche À SOI passe par la bascule
//     (`useToggleTaskComplete` → `toggle_task_complete_v2`), exactement comme
//     la case à cocher : c'est le seul chemin qui génère l'occurrence suivante
//     d'une tâche récurrente, et qui propose « Annuler ».
//   · Tout le reste écrit le statut ; le trigger de la mig. 214 tient
//     `completed` d'accord.
//
// ⚠️ Une tâche REÇUE écrit toujours le statut, même vers Terminée : la RPC de
// bascule ne connaît que le propriétaire (`user_id = auth.uid()`, relu au
// catalogue le 2026-10-08), alors que la policy UPDATE laisse un ami
// « editor » modifier la tâche. Un ami « viewer » est refusé par la RLS :
// le hook remet la carte à sa place et l'erreur s'affiche par `onError`.
// ═══════════════════════════════════════════════════════════════════
import { useCallback } from 'react';
import {
  effectiveStatus, useToggleTaskComplete, useUpdateTask,
  type Task, type TaskStatus,
} from '@/modules/tasks';
import { useAuth } from '@/modules/auth/AuthContext';
import { useIsDemo } from '@/lib/app-mode.store';
import { moveIntent } from './board.helpers';

/** Tâche partagée avec moi, dont je ne suis pas propriétaire. */
export function isReceivedTask(task: Task, userId: string | undefined, isDemo: boolean): boolean {
  return !isDemo && !!task.userId && !!userId && task.userId !== userId;
}

export function useMoveTask(): (task: Task, to: TaskStatus) => void {
  const { user } = useAuth();
  const isDemo = useIsDemo();
  // `.mutate` est stable d'un rendu à l'autre, l'objet de mutation non.
  const { mutate: toggle } = useToggleTaskComplete();
  const { mutate: update } = useUpdateTask();

  return useCallback((task: Task, to: TaskStatus) => {
    const intent = moveIntent(effectiveStatus(task), to);
    if (intent === 'none') return;
    if (intent === 'toggle' && !isReceivedTask(task, user?.id, isDemo)) {
      toggle(task.id);
      return;
    }
    update({ id: task.id, updates: { status: to } });
  }, [toggle, update, user?.id, isDemo]);
}
