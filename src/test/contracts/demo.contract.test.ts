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
import { orgBillingContract } from './__test__/org-billing.contract';
import type { OrgBillingScenario } from './__test__/org-billing.contract';
import { effectiveQuota } from '@/modules/billing/org-billing.logic';
import {
  deleteLocalOrgBillingContact,
  getLocalOrgBillingContact,
  getLocalOrgBillingHistory,
  getLocalOrgSubscription,
  saveLocalOrgBillingContact,
} from '@/modules/billing/org-billing.local';
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
categoriesContract(SIDE, async () => ({
  repo: new LocalStorageCategoriesRepository(),
  tasks: new LocalStorageTasksRepository(),
  okrs: new LocalStorageOKRsRepository(),
}));
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
    deleteTask: (id) => tasks.delete(id),
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
  return { okrs, krCompletions, stats, categories: new LocalStorageCategoriesRepository() };
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
teamCategoriesContract(SIDE, async () => ({
  repo: new LocalStorageTeamCategoriesRepository(),
  orgId: DEMO_ORG_ID,
  projects: new LocalStorageTeamProjectsRepository(),
  okrs: new LocalStorageTeamOKRsRepository(),
}));
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

// Facturation d'organisation : la démo ne simule aucun abonnement ni paiement (`org-billing.local.ts`).
// Le quota de sièges est la règle TS (`effectiveQuota`) que la base rejoue dans `org_seats_allowed`.
const demoScenarios = new Map<string, OrgBillingScenario>();
const NO_STRIPE_IN_DEMO = 'la démo ne simule ni abonnement ni paiement (palier gratuit constant)';
const NO_ACCESS_CONTROL_IN_DEMO = 'la démo n’a qu’une identité : le refus par rôle est une RLS / un contrôle de RPC';
orgBillingContract(
  SIDE,
  async () => ({
    port: {
      getSubscription: () => getLocalOrgSubscription(),
      getHistory: () => getLocalOrgBillingHistory(),
      getContact: (orgId) => getLocalOrgBillingContact(orgId),
      saveContact: (orgId, input) => saveLocalOrgBillingContact(orgId, input),
      deleteContact: (orgId) => deleteLocalOrgBillingContact(orgId),
      seatsAllowed: async (orgId) => {
        const sc = demoScenarios.get(orgId) ?? { members: 1 };
        const sub = sc.subscription
          ? { orgId, ...sc.subscription, billingInterval: 'monthly' as const, currentPeriodEnd: null, startedAt: null, cancelAtPeriodEnd: false, discountCode: null }
          : null;
        const quota = effectiveQuota(sub);
        return quota === null || sc.members < quota;
      },
    },
    newOrg: async (scenario = { members: 1 }) => {
      const id = crypto.randomUUID();
      demoScenarios.set(id, scenario);
      return id;
    },
  }),
  {
    skip: {
      'un abonnement actif se lit avec son palier, ses sièges et ses valeurs par défaut': NO_STRIPE_IN_DEMO,
      'périodicité annuelle, résiliation programmée et date de conclusion se lisent': NO_STRIPE_IN_DEMO,
      'l’historique rend les lignes de l’organisation seule, du plus récent au plus ancien, remboursement négatif': NO_STRIPE_IN_DEMO,
      'l’historique est refusé à un simple membre et à qui vise une organisation inconnue': NO_ACCESS_CONTROL_IN_DEMO,
      'un simple membre ne lit ni n’écrit le contact du propriétaire': NO_ACCESS_CONTROL_IN_DEMO,
    },
  },
);
