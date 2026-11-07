// ═══════════════════════════════════════════════════════════════════
// DÉPÔTS DE DÉMONSTRATION DU MODE ENTREPRISE — chargés à la demande
// ═══════════════════════════════════════════════════════════════════
//
// Pourquoi ce fichier : `repository.factory.ts` importait STATIQUEMENT les deux
// implémentations de chaque module, et un import statique est retenu même quand
// sa branche est morte. Les quatre dépôts de démo du mode entreprise (les plus
// gros) vivent donc ici, dans un module chargé par `import()` : chunk séparé,
// ni dans l'entrée ni préchargé.
//
// Pourquoi ces quatre : ils ont des fichiers `local.repository.ts` DÉDIÉS. Les
// autres mélangent interface et implémentation locale dans un même
// `repository.ts` ; les sortir demande d'abord de séparer les deux.
//
// Invariant : leurs interfaces n'exposent QUE des méthodes asynchrones. Le
// factory rend un mandataire synchrone dont chaque méthode attend le module au
// premier appel : aucun appelant ne change et `loginDemo()` garde son ordre.
// Si l'une gagne un membre SYNCHRONE (propriété, getter), le mandataire n'est
// plus transparent : l'ajouter à la garde de `repository.factory.ts` ou
// renoncer au chargement différé pour ce module.
// ═══════════════════════════════════════════════════════════════════

import { LocalStorageOrganizationsRepository } from '@/modules/organizations/local.repository';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { LocalStorageTeamOKRsRepository } from '@/modules/team-okrs/local.repository';
import { LocalStorageOrgTeamsRepository } from '@/modules/org-teams/local.repository';
import { LocalStorageOrgGovernanceRepository } from '@/modules/organizations/governance.local.repository';
import { LocalStorageOkrExecutionRepository } from '@/modules/team-okrs/execution.local.repository';
import type { IOrgGovernanceRepository } from '@/modules/organizations/governance.repository';
import { LocalStorageOrgRolesRepository } from '@/modules/organizations/roles.local.repository';
import type { IOrgRolesRepository } from '@/modules/organizations/roles.repository';
import type { IOkrExecutionRepository } from '@/modules/team-okrs/execution.repository';

import type { IOrganizationsRepository } from '@/modules/organizations/repository';
import type { ITeamProjectsRepository } from '@/modules/team-projects/repository';
import type { ITeamOKRsRepository } from '@/modules/team-okrs/repository';
import type { IOrgTeamsRepository } from '@/modules/org-teams/repository';

import type { ICategoriesRepository } from '@/modules/categories/repository';
import { LocalStorageCategoriesRepository } from '@/modules/categories/local.repository';

import type { ITasksRepository } from '@/modules/tasks/repository';
import { LocalStorageTasksRepository } from '@/modules/tasks/local.repository';
import type { IHabitsRepository } from '@/modules/habits/repository';
import { LocalStorageHabitsRepository } from '@/modules/habits/local.repository';

// Tâches et habitudes : interfaces 100 % asynchrones, sorties du chunk d'entrée.
export const createDemoTasksRepository = (): ITasksRepository =>
  new LocalStorageTasksRepository();

export const createDemoHabitsRepository = (): IHabitsRepository =>
  new LocalStorageHabitsRepository();

export const createDemoCategoriesRepository = (): ICategoriesRepository =>
  new LocalStorageCategoriesRepository();

export const createDemoOrganizationsRepository = (): IOrganizationsRepository =>
  new LocalStorageOrganizationsRepository();

export const createDemoTeamProjectsRepository = (): ITeamProjectsRepository =>
  new LocalStorageTeamProjectsRepository();

export const createDemoTeamOKRsRepository = (): ITeamOKRsRepository =>
  new LocalStorageTeamOKRsRepository();

export const createDemoOrgTeamsRepository = (): IOrgTeamsRepository =>
  new LocalStorageOrgTeamsRepository();

export const createDemoOrgGovernanceRepository = (): IOrgGovernanceRepository =>
  new LocalStorageOrgGovernanceRepository();

export const createDemoOrgRolesRepository = (): IOrgRolesRepository =>
  new LocalStorageOrgRolesRepository();

export const createDemoOkrExecutionRepository = (): IOkrExecutionRepository =>
  new LocalStorageOkrExecutionRepository();
