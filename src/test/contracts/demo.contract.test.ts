// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Suites de contrat, côté DÉMO (localStorage). Le côté Supabase joue les MÊMES
// fonctions dans `e2e/rls/contrats.test.ts`. Cadre : `./harness.ts`.
// ═══════════════════════════════════════════════════════════════════
import { beforeAll } from 'vitest';
import { LocalStorageTasksRepository } from '@/modules/tasks/local.repository';
import { LocalStorageEventsRepository } from '@/modules/events/local.repository';
import { LocalStorageHabitsRepository } from '@/modules/habits/local.repository';
import { LocalStorageCategoriesRepository } from '@/modules/categories/local.repository';
import { LocalStorageListsRepository } from '@/modules/lists/local.repository';
import { LocalStorageOKRsRepository } from '@/modules/okrs/local.repository';
import { LocalStorageKRCompletionsRepository } from '@/modules/kr-completions/local.repository';
import { LocalStatsRepository } from '@/modules/stats/local.repository';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { LocalStorageTeamOKRsRepository } from '@/modules/team-okrs/local.repository';
import { LocalStorageTeamCategoriesRepository } from '@/modules/team-categories/local.repository';
import { LocalStorageTeamListsRepository } from '@/modules/team-lists/local.repository';
import { LocalStorageFriendsRepository } from '@/modules/friends/local.repository';
import { LocalStorageOrganizationsRepository } from '@/modules/organizations/local.repository';
import { DEMO_ORG_ID, DEMO_USER_ID } from '@/modules/team-projects/local.seed';
import { tasksContract } from './__test__/tasks.contract';
import { categoriesContract } from './__test__/categories.contract';
import { listsContract } from './__test__/lists.contract';
import { okrsContract } from './__test__/okrs.contract';
import { habitsContract } from './__test__/habits.contract';
import { eventsContract } from './__test__/events.contract';
import { teamTasksContract } from './__test__/team-tasks.contract';
import { teamOkrsContract } from './__test__/team-okrs.contract';
import { teamCategoriesContract } from './__test__/team-categories.contract';
import { teamListsContract } from './__test__/team-lists.contract';
import { friendsContract } from './__test__/friends.contract';
import { organizationsContract } from './__test__/organizations.contract';
import { teamProjectsContract } from './__test__/team-projects.contract';

const SIDE = 'démo (localStorage)';

beforeAll(() => {
  localStorage.clear();
});

tasksContract(SIDE, async () => ({ repo: new LocalStorageTasksRepository() }));
categoriesContract(SIDE, async () => ({ repo: new LocalStorageCategoriesRepository() }));
listsContract(SIDE, async () => ({ repo: new LocalStorageListsRepository() }));
habitsContract(SIDE, async () => ({
  repo: new LocalStorageHabitsRepository(),
  stats: new LocalStatsRepository(
    new LocalStorageTasksRepository(),
    new LocalStorageEventsRepository(),
    new LocalStorageHabitsRepository(),
    new LocalStorageOKRsRepository(),
    new LocalStorageKRCompletionsRepository(),
  ),
}));
eventsContract(SIDE, async () => {
  const tasks = new LocalStorageTasksRepository();
  return {
    repo: new LocalStorageEventsRepository(),
    // La démo n'a pas de clé étrangère : un identifiant de tâche suffit, mais on en crée une vraie.
    newTaskId: async () =>
      (await tasks.create({ name: 'Tâche de l’agenda', priority: 2, category: '', deadline: '', estimatedTime: 30, bookmarked: false, completed: false })).id,
  };
});
okrsContract(SIDE, async () => {
  const okrs = new LocalStorageOKRsRepository();
  const krCompletions = new LocalStorageKRCompletionsRepository();
  const stats = new LocalStatsRepository(
    new LocalStorageTasksRepository(),
    new LocalStorageEventsRepository(),
    new LocalStorageHabitsRepository(),
    okrs,
    krCompletions,
  );
  return { okrs, krCompletions, stats };
});

teamTasksContract(SIDE, async () => ({
  repo: new LocalStorageTeamProjectsRepository(),
  orgId: DEMO_ORG_ID,
  userId: DEMO_USER_ID,
}));
teamOkrsContract(SIDE, async () => ({
  repo: new LocalStorageTeamOKRsRepository(),
  orgId: DEMO_ORG_ID,
  userId: DEMO_USER_ID,
}));
teamCategoriesContract(SIDE, async () => ({ repo: new LocalStorageTeamCategoriesRepository(), orgId: DEMO_ORG_ID }));
teamListsContract(SIDE, async () => {
  const projects = new LocalStorageTeamProjectsRepository();
  const projectId = (await projects.createProject(DEMO_ORG_ID, { name: 'Projet des listes' })).id;
  return {
    repo: new LocalStorageTeamListsRepository(),
    orgId: DEMO_ORG_ID,
    newTaskId: async () => (await projects.createTask(DEMO_ORG_ID, { projectId, name: 'Tâche rangée' })).id,
  };
});

friendsContract(SIDE, async () => ({
  repo: new LocalStorageFriendsRepository(),
  recipient: async () => `ami-${crypto.randomUUID()}@example.com`,
}));
organizationsContract(SIDE, async () => ({ repo: new LocalStorageOrganizationsRepository(), userId: DEMO_USER_ID }));
teamProjectsContract(SIDE, async () => ({ repo: new LocalStorageTeamProjectsRepository(), orgId: DEMO_ORG_ID }));
