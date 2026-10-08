// ═══════════════════════════════════════════════════════════════════
// Statut ↔ terminée : la règle, en TypeScript pur
// ═══════════════════════════════════════════════════════════════════
//
// Miroir du trigger `sync_task_status` (mig. 214). En production, c'est le
// serveur qui fait foi ; ce module sert deux endroits qui ne le voient pas :
//
//   · le repository local (démo), qui n'a pas de trigger ;
//   · les mises à jour optimistes des hooks, pour qu'une carte du Tableau
//     ne saute pas dans la mauvaise colonne en attendant la réponse.
//
// ⚠️ PARITÉ OBLIGATOIRE avec le trigger, même règle que `toggleComplete` et
// `toggle_task_complete_v2` : une règle métier qui n'existe que d'un côté
// diverge en silence, et la démo affiche juste pendant que la prod ment
// (c'est le défaut C-77, dix-sept jours).
import type { Task, TaskStatus } from './types';

type SyncFields = Pick<Task, 'completed' | 'completedAt' | 'status'>;

/** Statut effectif, y compris pour une ligne lue avant la mig. 214. */
export function effectiveStatus(task: Partial<SyncFields>): TaskStatus {
  return task.status ?? (task.completed ? 'done' : 'todo');
}

/**
 * Complète un patch pour que `status` et `completed` restent d'accord.
 *
 * `completed` l'emporte quand il figure dans le patch : c'est le chemin de la
 * case à cocher et de la RPC de bascule. Sinon, c'est `status` qui décide
 * (Tableau, fiche). Même ordre de priorité que le trigger.
 */
export function applyStatusSync<P extends Partial<Task>>(
  prev: Partial<SyncFields>,
  patch: P,
  nowIso: string = new Date().toISOString(),
): P {
  if (patch.completed !== undefined) {
    // 🔴 Ligne sans statut (servie avant la mig. 214) et patch sans statut :
    // ne RIEN inventer. Un statut ajouté ici dans le cache repartirait en base
    // avec la tâche entière (« Annuler » une suppression), vers une colonne
    // qui n'existe peut-être pas encore.
    if (prev.status === undefined && patch.status === undefined) {
      return patch.completed ? patch : { ...patch, completedAt: undefined };
    }
    if (patch.completed) {
      return { ...patch, status: 'done', completedAt: patch.completedAt ?? prev.completedAt ?? nowIso };
    }
    if (patch.status === undefined && effectiveStatus(prev) === 'done') {
      return { ...patch, completedAt: undefined, status: 'todo' };
    }
    return { ...patch, completedAt: undefined };
  }

  if (patch.status === undefined) return patch;

  const wasDone = effectiveStatus(prev) === 'done';
  if (patch.status === 'done') {
    return wasDone ? patch : { ...patch, completed: true, completedAt: prev.completedAt ?? nowIso };
  }
  return wasDone ? { ...patch, completed: false, completedAt: undefined } : patch;
}
