// ═══════════════════════════════════════════════════════════════════
// Déplacer une tâche d'une colonne à l'autre du Tableau
//
// Deux chemins d'écriture, et le choix n'est pas cosmétique :
//
//   · Vers « Terminée », la tâche passe par la bascule
//     (`useToggleTaskComplete` → `toggle_task_complete_v2`), exactement comme
//     la case à cocher : c'est le seul chemin qui génère l'occurrence suivante
//     d'une tâche récurrente, et qui propose « Annuler ».
//   · Tout le reste écrit le statut ; le trigger de la mig. 214 tient
//     `completed` d'accord.
//
// Une tâche REÇUE suit le même chemin depuis la mig. 215 : la RPC laisse la
// RLS décider, donc un ami « editor » la coche ; un « viewer » est refusé,
// le hook remet la carte à sa place et l'erreur s'affiche par `onError`.
// ═══════════════════════════════════════════════════════════════════
import { useCallback } from 'react';
import {
  effectiveStatus, useToggleTaskComplete, useUpdateTask,
  type Task, type TaskStatus,
} from '@/modules/tasks';
import { moveIntent } from './board.helpers';

export function useMoveTask(): (task: Task, to: TaskStatus) => void {
  // `.mutate` est stable d'un rendu à l'autre, l'objet de mutation non.
  const { mutate: toggle } = useToggleTaskComplete();
  const { mutate: update } = useUpdateTask();

  return useCallback((task: Task, to: TaskStatus) => {
    const intent = moveIntent(effectiveStatus(task), to);
    if (intent === 'none') return;
    if (intent === 'toggle') { toggle(task.id); return; }
    update({ id: task.id, updates: { status: to } });
  }, [toggle, update]);
}
