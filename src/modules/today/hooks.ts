// ═══════════════════════════════════════════════════════════════════
// Hooks de la vue « Aujourd'hui » (item #29)
//
// AUCUNE requête nouvelle : ce module compose des hooks existants. Les clés
// React Query sont donc partagées avec les écrans d'origine — monter cette
// vue ne double ni le cache ni le sondage de `useTeamTasks`.
//
// ⚠️ Pas de second canal Realtime ici : `useSharedTasksRealtime` est monté une
// seule fois dans `App.tsx`, et un canal par écran serait un WebSocket par
// écran (garde-fou CLAUDE.md).
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useTasks } from '@/modules/tasks';
import { useLists } from '@/modules/lists';
import { useTeamTasks, useTeamProjects } from '@/modules/team-projects';
import { useActiveOrganization } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';
import { mergeTodayItems } from './today.helpers';
import type { TodayItem } from './types';

export interface UseTodayItemsResult {
  items: TodayItem[];
  isLoading: boolean;
  /** L'utilisateur appartient-il à une organisation ? (sinon rien à unifier) */
  hasOrg: boolean;
}

/**
 * Éléments à faire aujourd'hui, les deux sources confondues.
 *
 * Les tâches d'équipe sont restreintes à celles qui me sont ASSIGNÉES : la
 * question posée par cet écran est « qu'est-ce que je dois faire », pas
 * « qu'est-ce que l'équipe doit faire » — la charge des autres se lit dans la
 * pyramide et dans la revue hebdomadaire (#19, #26).
 */
export function useTodayItems(): UseTodayItemsResult {
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: lists = [] } = useLists();
  const { data: teamTasks = [], isLoading: teamLoading } = useTeamTasks(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);

  // Contexte des tâches perso : leur liste. Les listes « smart » sont ignorées
  // — leur appartenance est calculée, pas déclarée, et une tâche y entre ou en
  // sort selon la règle. Afficher « Retard » comme contexte d'une tâche en
  // retard n'apprendrait rien.
  const listNameByTaskId = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of lists) {
      if (list.type === 'smart') continue;
      for (const taskId of list.taskIds) if (!map.has(taskId)) map.set(taskId, list.name);
    }
    return map;
  }, [lists]);

  const myTeamTasks = useMemo(
    () => (user ? teamTasks.filter((t) => t.assigneeIds.includes(user.id)) : []),
    [teamTasks, user],
  );

  const items = useMemo(
    () => mergeTodayItems({ tasks, teamTasks: myTeamTasks, projects, listNameByTaskId }),
    [tasks, myTeamTasks, projects, listNameByTaskId],
  );

  return {
    items,
    isLoading: tasksLoading || (!!orgId && teamLoading),
    hasOrg: !!orgId,
  };
}
