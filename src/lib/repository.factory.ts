// ═══════════════════════════════════════════════════════════════════
// Repository Factory - Centralized repository selection
// ═══════════════════════════════════════════════════════════════════

import { appModeStore } from './app-mode.store';

// Tasks
import { ITasksRepository } from '@/modules/tasks/repository';
import { LocalStorageTasksRepository } from '@/modules/tasks/local.repository';
import { SupabaseTasksRepository } from '@/modules/tasks/supabase.repository';

// Habits
import { IHabitsRepository } from '@/modules/habits/repository';
import { LocalStorageHabitsRepository } from '@/modules/habits/local.repository';
import { SupabaseHabitsRepository } from '@/modules/habits/supabase.repository';

// Events
import { IEventsRepository } from '@/modules/events/repository';
import { LocalStorageEventsRepository } from '@/modules/events/repository';
import { SupabaseEventsRepository } from '@/modules/events/supabase.repository';

// Categories
import { ICategoriesRepository } from '@/modules/categories/repository';
import { LocalStorageCategoriesRepository } from '@/modules/categories/repository';
import { SupabaseCategoriesRepository } from '@/modules/categories/supabase.repository';

// Lists
import { IListsRepository } from '@/modules/lists/repository';
import { LocalStorageListsRepository } from '@/modules/lists/repository';
import { SupabaseListsRepository } from '@/modules/lists/supabase.repository';

// Friends
import { IFriendsRepository } from '@/modules/friends/repository';
import { LocalStorageFriendsRepository } from '@/modules/friends/repository';
import { SupabaseFriendsRepository } from '@/modules/friends/supabase.repository';

// OKRs
import { IOKRsRepository } from '@/modules/okrs/repository';
import { LocalStorageOKRsRepository } from '@/modules/okrs/repository';
import { SupabaseOKRsRepository } from '@/modules/okrs/supabase.repository';

// KR Completions
import { IKRCompletionsRepository } from '@/modules/kr-completions/repository';
import { LocalStorageKRCompletionsRepository } from '@/modules/kr-completions/repository';
import { SupabaseKRCompletionsRepository } from '@/modules/kr-completions/supabase.repository';

// Organizations (mode entreprise)
import { IOrganizationsRepository } from '@/modules/organizations/repository';
import { LocalStorageOrganizationsRepository } from '@/modules/organizations/local.repository';
import { SupabaseOrganizationsRepository } from '@/modules/organizations/supabase.repository';

// Team projects & tasks (mode entreprise)
import { ITeamProjectsRepository } from '@/modules/team-projects/repository';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { SupabaseTeamProjectsRepository } from '@/modules/team-projects/supabase.repository';

// Team OKRs (mode entreprise)
import { ITeamOKRsRepository } from '@/modules/team-okrs/repository';
import { LocalStorageTeamOKRsRepository } from '@/modules/team-okrs/local.repository';
import { SupabaseTeamOKRsRepository } from '@/modules/team-okrs/supabase.repository';

// Org teams (équipes transverses, v2)
import { IOrgTeamsRepository } from '@/modules/org-teams/repository';
import { LocalStorageOrgTeamsRepository } from '@/modules/org-teams/local.repository';
import { SupabaseOrgTeamsRepository } from '@/modules/org-teams/supabase.repository';

// Stats (agrégats « temps investi » — RPC SQL en prod, calcul local en démo)
import { IStatsRepository, LocalStatsRepository } from '@/modules/stats/repository';
import { SupabaseStatsRepository } from '@/modules/stats/supabase.repository';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY SINGLETONS
// ═══════════════════════════════════════════════════════════════════

let tasksRepository: ITasksRepository | null = null;
let habitsRepository: IHabitsRepository | null = null;
let eventsRepository: IEventsRepository | null = null;
let categoriesRepository: ICategoriesRepository | null = null;
let listsRepository: IListsRepository | null = null;
let friendsRepository: IFriendsRepository | null = null;
let okrsRepository: IOKRsRepository | null = null;
let krCompletionsRepository: IKRCompletionsRepository | null = null;
let organizationsRepository: IOrganizationsRepository | null = null;
let teamProjectsRepository: ITeamProjectsRepository | null = null;
let teamOKRsRepository: ITeamOKRsRepository | null = null;
let orgTeamsRepository: IOrgTeamsRepository | null = null;
let statsRepository: IStatsRepository | null = null;

// Auto-reset singletons whenever the demo flag flips. Without this, any
// code path that calls `appModeStore.setDemo(...)` outside `loginDemo()`
// leaves stale repositories pointing at the wrong backend (faille B20).
appModeStore.subscribe(() => {
  tasksRepository = null;
  habitsRepository = null;
  eventsRepository = null;
  categoriesRepository = null;
  listsRepository = null;
  friendsRepository = null;
  okrsRepository = null;
  krCompletionsRepository = null;
  organizationsRepository = null;
  teamProjectsRepository = null;
  teamOKRsRepository = null;
  orgTeamsRepository = null;
  statsRepository = null;
});

// ═══════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get the Tasks repository based on current mode
 */
export function getTasksRepository(): ITasksRepository {
  if (!tasksRepository) {
    tasksRepository = appModeStore.isDemo
      ? new LocalStorageTasksRepository()
      : new SupabaseTasksRepository();
  }
  return tasksRepository;
}

/**
 * Get the Habits repository based on current mode
 */
export function getHabitsRepository(): IHabitsRepository {
  if (!habitsRepository) {
    habitsRepository = appModeStore.isDemo
      ? new LocalStorageHabitsRepository()
      : new SupabaseHabitsRepository();
  }
  return habitsRepository;
}

/**
 * Get the Events repository based on current mode
 */
export function getEventsRepository(): IEventsRepository {
  if (!eventsRepository) {
    eventsRepository = appModeStore.isDemo
      ? new LocalStorageEventsRepository()
      : new SupabaseEventsRepository();
  }
  return eventsRepository;
}

/**
 * Get the Categories repository based on current mode
 */
export function getCategoriesRepository(): ICategoriesRepository {
  if (!categoriesRepository) {
    categoriesRepository = appModeStore.isDemo
      ? new LocalStorageCategoriesRepository()
      : new SupabaseCategoriesRepository();
  }
  return categoriesRepository;
}

/**
 * Get the Lists repository based on current mode
 */
export function getListsRepository(): IListsRepository {
  if (!listsRepository) {
    listsRepository = appModeStore.isDemo
      ? new LocalStorageListsRepository()
      : new SupabaseListsRepository();
  }
  return listsRepository;
}

/**
 * Get the Friends repository based on current mode
 */
export function getFriendsRepository(): IFriendsRepository {
  if (!friendsRepository) {
    friendsRepository = appModeStore.isDemo
      ? new LocalStorageFriendsRepository()
      : new SupabaseFriendsRepository();
  }
  return friendsRepository;
}

/**
 * Get the OKRs repository based on current mode
 */
export function getOKRsRepository(): IOKRsRepository {
  if (!okrsRepository) {
    okrsRepository = appModeStore.isDemo
      ? new LocalStorageOKRsRepository()
      : new SupabaseOKRsRepository();
  }
  return okrsRepository;
}

/**
 * Get the KR Completions repository based on current mode
 */
export function getKRCompletionsRepository(): IKRCompletionsRepository {
  if (!krCompletionsRepository) {
    krCompletionsRepository = appModeStore.isDemo
      ? new LocalStorageKRCompletionsRepository()
      : new SupabaseKRCompletionsRepository();
  }
  return krCompletionsRepository;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════

/**
 * Get the Organizations repository based on current mode
 */
export function getOrganizationsRepository(): IOrganizationsRepository {
  if (!organizationsRepository) {
    organizationsRepository = appModeStore.isDemo
      ? new LocalStorageOrganizationsRepository()
      : new SupabaseOrganizationsRepository();
  }
  return organizationsRepository;
}

/**
 * Get the Team Projects repository based on current mode
 */
export function getTeamProjectsRepository(): ITeamProjectsRepository {
  if (!teamProjectsRepository) {
    teamProjectsRepository = appModeStore.isDemo
      ? new LocalStorageTeamProjectsRepository()
      : new SupabaseTeamProjectsRepository();
  }
  return teamProjectsRepository;
}

/**
 * Get the Team OKRs repository based on current mode
 */
export function getTeamOKRsRepository(): ITeamOKRsRepository {
  if (!teamOKRsRepository) {
    teamOKRsRepository = appModeStore.isDemo
      ? new LocalStorageTeamOKRsRepository()
      : new SupabaseTeamOKRsRepository();
  }
  return teamOKRsRepository;
}

/**
 * Get the Org Teams repository based on current mode
 */
export function getOrgTeamsRepository(): IOrgTeamsRepository {
  if (!orgTeamsRepository) {
    orgTeamsRepository = appModeStore.isDemo
      ? new LocalStorageOrgTeamsRepository()
      : new SupabaseOrgTeamsRepository();
  }
  return orgTeamsRepository;
}

/**
 * Get the Stats repository based on current mode.
 * En démo, l'implémentation locale agrège via les repositories des 4 modules
 * sources (injectés ici pour éviter tout import circulaire avec la factory).
 */
export function getStatsRepository(): IStatsRepository {
  if (!statsRepository) {
    statsRepository = appModeStore.isDemo
      ? new LocalStatsRepository(
          getTasksRepository(),
          getEventsRepository(),
          getHabitsRepository(),
          getOKRsRepository()
        )
      : new SupabaseStatsRepository();
  }
  return statsRepository;
}

/**
 * Check if app is running in demo mode
 */
export function isInDemoMode(): boolean {
  return appModeStore.isDemo;
}

/**
 * Reset all repository singletons (useful for testing)
 */
export function resetRepositories(): void {
  tasksRepository = null;
  habitsRepository = null;
  eventsRepository = null;
  categoriesRepository = null;
  listsRepository = null;
  friendsRepository = null;
  okrsRepository = null;
  krCompletionsRepository = null;
  organizationsRepository = null;
  teamProjectsRepository = null;
  teamOKRsRepository = null;
  orgTeamsRepository = null;
  statsRepository = null;
}

/**
 * Efface les données démo du localStorage pour forcer le rechargement des seeds.
 *
 * Faille B21 — the previous version enumerated keys manually and silently
 * skipped any new demo key. Sweep every `cosmo_*` key plus the legacy
 * un-prefixed ones the older modules wrote.
 */
export function clearDemoStorage(): void {
  const LEGACY_KEYS = [
    'cosmo-okrs',
    'cosmo-okrs-v2',
    'cosmo-okrs-v3',
    'cosmo-okrs-v4',
    'cosmo-okrs-v5',
    'cosmo_user',
    'cosmo_messages',
  ];
  // Préférences à préserver à travers les resets démo : le consentement cookies
  // est une décision légale/RGPD de l'utilisateur, il ne doit PAS réapparaître à
  // chaque loginDemo() (bug B05 — sinon la bannière revient à chaque entrée démo).
  // cosmo_demo_device_id : identifiant anonyme du compteur de visiteurs démo
  // (migration 055, src/lib/demo-metrics.ts) — doit survivre aux resets pour
  // compter chaque appareil une seule fois.
  const PRESERVE_KEYS = new Set(['cosmo_cookie_consent', 'cosmo_demo_device_id']);
  LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  // Sweep every cosmo-namespaced key so newly-added demo modules are covered
  // without having to remember to update this list.
  const allKeys = Object.keys(localStorage);
  for (const key of allKeys) {
    if (PRESERVE_KEYS.has(key)) continue;
    if (key.startsWith('cosmo_demo_') || key.startsWith('cosmo_') || key.startsWith('cosmo-')) {
      localStorage.removeItem(key);
    }
  }
}
