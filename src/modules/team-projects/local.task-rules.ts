// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS : miroir DÉMO des triggers des mig. 197 et 198, dans l'ordre
// de la base : statut propre au projet, puis automatisations, puis
// `completed` qui suit le statut final (mig. 091). Séparé de
// `local.repository.ts` pour le garder sous le plafond de 600 lignes.
// ═══════════════════════════════════════════════════════════════════

import { makeApiError } from '@/lib/normalizeApiError';
import { applyAutomations, applyCustomStatus, readDemoTaskRules } from '@/modules/org-config/automation.helpers';
import type { TeamTask } from './types';

const finalize = (task: TeamTask, statusBefore: TeamTask['status']): TeamTask => {
  if (task.status === statusBefore) return task;
  const done = task.status === 'done';
  return { ...task, completed: done, completedAt: done ? task.completedAt ?? new Date().toISOString() : null };
};

/** `before` = la tâche avant écriture, null à la création. */
export function applyDemoTaskRules(task: TeamTask, before: TeamTask | null): TeamTask {
  const { statuses, rules } = readDemoTaskRules(task.orgId);
  let out: TeamTask;
  try {
    out = applyAutomations(applyCustomStatus(task, before, statuses), before, rules);
  } catch {
    throw makeApiError('invalid_input');
  }
  return finalize(out, task.status);
}
