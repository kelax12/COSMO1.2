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
import { useCategories } from '@/modules/categories';
import { useTeamTasks, useTeamProjects } from '@/modules/team-projects';
import { useTeamCategories } from '@/modules/team-categories';
import { useActiveOrganization } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';
import { useToggleTaskComplete } from '@/modules/tasks';
import { useUpdateTeamTask } from '@/modules/team-projects';
import { mergeTodayItems, type CategoryLite } from './today.helpers';
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
  const { data: categories = [] } = useCategories();
  const { data: teamTasks = [], isLoading: teamLoading } = useTeamTasks(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: teamCategories = [] } = useTeamCategories(orgId);

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

  const personalCategoryById = useMemo(
    () => new Map<string, CategoryLite>(categories.map((c) => [c.id, { name: c.name, color: c.color }])),
    [categories],
  );
  const teamCategoryById = useMemo(
    () => new Map<string, CategoryLite>(teamCategories.map((c) => [c.id, { name: c.name, color: c.color }])),
    [teamCategories],
  );

  const items = useMemo(
    () => mergeTodayItems({ tasks, teamTasks: myTeamTasks, projects, listNameByTaskId, personalCategoryById, teamCategoryById }),
    [tasks, myTeamTasks, projects, listNameByTaskId, personalCategoryById, teamCategoryById],
  );

  return {
    items,
    isLoading: tasksLoading || (!!orgId && teamLoading),
    hasOrg: !!orgId,
  };
}

/**
 * Cocher un élément de la vue unifiée, par SON chemin d'écriture d'origine.
 *
 * 🔴 C'est la règle non négociable du module : la vue LIT les deux tables, elle
 * n'en écrit jamais une à la place de l'autre. Récurrence serveur côté perso,
 * triggers de statut côté équipe — un chemin unifié les casserait tous deux.
 *
 * Extrait de `TodayUnified` quand `TodayMoments` (maquette 28) est devenu un
 * second consommateur : deux copies de cet aiguillage, c'est la garantie qu'un
 * jour l'une des deux cochera dans la mauvaise table.
 */
export function useCompleteTodayItem(): (item: TodayItem) => void {
  const { activeOrg } = useActiveOrganization();
  const togglePersonal = useToggleTaskComplete();
  const updateTeamTask = useUpdateTeamTask(activeOrg?.id ?? '');

  return (item: TodayItem) => {
    if (item.source === 'personal') togglePersonal.mutate(item.id);
    else updateTeamTask.mutate({ taskId: item.id, input: { completed: true } });
  };
}
