// ═══════════════════════════════════════════════════════════════════
// DÉPÔTS DE DÉMONSTRATION — chargés à la demande
// ═══════════════════════════════════════════════════════════════════
//
// Tous les dépôts de démo du factory, dans un module chargé par `import()` :
// chunk séparé, ni dans l'entrée ni préchargé. Un import statique serait
// retenu même quand sa branche est morte à l'exécution.
//
// Invariant : leurs interfaces n'exposent QUE des méthodes asynchrones (le
// mandataire de `define-repository.ts` n'attend le module qu'au premier
// appel). Un membre synchrone ajouté impose le chargement `eager`.
// ═══════════════════════════════════════════════════════════════════

import { LocalStorageOrganizationsRepository } from '@/modules/organizations/local.repository';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { LocalStorageTeamOKRsRepository } from '@/modules/team-okrs/local.repository';
import { LocalStorageOrgTeamsRepository } from '@/modules/org-teams/local.repository';
import { LocalStorageOrgGovernanceRepository } from '@/modules/organizations/governance.local.repository';
import { LocalStorageOkrExecutionRepository } from '@/modules/team-okrs/execution.local.repository';
import { LocalStorageOrgRolesRepository } from '@/modules/organizations/roles.local.repository';
import { LocalStorageCategoriesRepository } from '@/modules/categories/local.repository';
import { LocalStorageTasksRepository } from '@/modules/tasks/local.repository';
import { LocalStorageHabitsRepository } from '@/modules/habits/local.repository';
import { LocalStorageEventsRepository } from '@/modules/events/local.repository';
import { LocalStorageListsRepository } from '@/modules/lists/local.repository';
import { LocalStorageFriendsRepository } from '@/modules/friends/local.repository';
import { LocalStorageOKRsRepository } from '@/modules/okrs/local.repository';
import { LocalStorageKRCompletionsRepository } from '@/modules/kr-completions/local.repository';
import { LocalStorageTeamCategoriesRepository } from '@/modules/team-categories/local.repository';
import { LocalStorageTeamListsRepository } from '@/modules/team-lists/local.repository';
import { LocalStatsRepository } from '@/modules/stats/local.repository';

import type { IOrgGovernanceRepository } from '@/modules/organizations/governance.repository';
import type { IOrgRolesRepository } from '@/modules/organizations/roles.repository';
import type { IOkrExecutionRepository } from '@/modules/team-okrs/execution.repository';
import type { IOrganizationsRepository } from '@/modules/organizations/repository';
import type { ITeamProjectsRepository } from '@/modules/team-projects/repository';
import type { ITeamOKRsRepository } from '@/modules/team-okrs/repository';
import type { IOrgTeamsRepository } from '@/modules/org-teams/repository';
import type { ICategoriesRepository } from '@/modules/categories/repository';
import type { ITasksRepository } from '@/modules/tasks/repository';
import type { IHabitsRepository } from '@/modules/habits/repository';
import type { IEventsRepository } from '@/modules/events/repository';
import type { IListsRepository } from '@/modules/lists/repository';
import type { IFriendsRepository } from '@/modules/friends/repository';
import type { IOKRsRepository } from '@/modules/okrs/repository';
import type { IKRCompletionsRepository } from '@/modules/kr-completions/repository';
import type { ITeamCategoriesRepository } from '@/modules/team-categories/repository';
import type { ITeamListsRepository } from '@/modules/team-lists/repository';
import type { IStatsRepository } from '@/modules/stats/repository';

export const createDemoTasksRepository = (): ITasksRepository => new LocalStorageTasksRepository();
export const createDemoHabitsRepository = (): IHabitsRepository => new LocalStorageHabitsRepository();
export const createDemoEventsRepository = (): IEventsRepository => new LocalStorageEventsRepository();
export const createDemoCategoriesRepository = (): ICategoriesRepository => new LocalStorageCategoriesRepository();
export const createDemoListsRepository = (): IListsRepository => new LocalStorageListsRepository();
export const createDemoFriendsRepository = (): IFriendsRepository => new LocalStorageFriendsRepository();
export const createDemoOKRsRepository = (): IOKRsRepository => new LocalStorageOKRsRepository();
export const createDemoKRCompletionsRepository = (): IKRCompletionsRepository =>
  new LocalStorageKRCompletionsRepository();
export const createDemoOrganizationsRepository = (): IOrganizationsRepository =>
  new LocalStorageOrganizationsRepository();
export const createDemoTeamProjectsRepository = (): ITeamProjectsRepository =>
  new LocalStorageTeamProjectsRepository();
export const createDemoTeamOKRsRepository = (): ITeamOKRsRepository => new LocalStorageTeamOKRsRepository();
export const createDemoOrgTeamsRepository = (): IOrgTeamsRepository => new LocalStorageOrgTeamsRepository();
export const createDemoTeamCategoriesRepository = (): ITeamCategoriesRepository =>
  new LocalStorageTeamCategoriesRepository();
export const createDemoTeamListsRepository = (): ITeamListsRepository => new LocalStorageTeamListsRepository();
export const createDemoOrgGovernanceRepository = (): IOrgGovernanceRepository =>
  new LocalStorageOrgGovernanceRepository();
export const createDemoOrgRolesRepository = (): IOrgRolesRepository => new LocalStorageOrgRolesRepository();
export const createDemoOkrExecutionRepository = (): IOkrExecutionRepository =>
  new LocalStorageOkrExecutionRepository();

/** Les cinq sources du temps investi, injectées par le factory (pas d'import circulaire). */
export interface DemoStatsSources {
  tasks: ITasksRepository;
  events: IEventsRepository;
  habits: IHabitsRepository;
  okrs: IOKRsRepository;
  krCompletions: IKRCompletionsRepository;
}

export const createDemoStatsRepository = (s: DemoStatsSources): IStatsRepository =>
  new LocalStatsRepository(s.tasks, s.events, s.habits, s.okrs, s.krCompletions);
