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
import { LOCALE_STORAGE_KEY } from '@/i18n/locale';

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
import { SupabaseOrganizationsRepository } from '@/modules/organizations/supabase.repository';

// Team projects & tasks (mode entreprise)
import { ITeamProjectsRepository } from '@/modules/team-projects/repository';
import { SupabaseTeamProjectsRepository } from '@/modules/team-projects/supabase.repository';

// Team OKRs (mode entreprise)
import { ITeamOKRsRepository } from '@/modules/team-okrs/repository';
import { SupabaseTeamOKRsRepository } from '@/modules/team-okrs/supabase.repository';

// Org teams (équipes transverses, v2)
import { IOrgTeamsRepository } from '@/modules/org-teams/repository';
import { SupabaseOrgTeamsRepository } from '@/modules/org-teams/supabase.repository';

// Org OKR categories (catégories d'OKR d'entreprise, partagées)
import {
  IOrgOKRCategoriesRepository,
  LocalStorageOrgOKRCategoriesRepository,
} from '@/modules/org-okr-categories/repository';
import { SupabaseOrgOKRCategoriesRepository } from '@/modules/org-okr-categories/supabase.repository';

// Team categories (catégories d'entreprise — distinctes des projets, mig. 111)
import {
  ITeamCategoriesRepository,
  LocalStorageTeamCategoriesRepository,
} from '@/modules/team-categories/repository';
import { SupabaseTeamCategoriesRepository } from '@/modules/team-categories/supabase.repository';

// Stats (agrégats « temps investi » — RPC SQL en prod, calcul local en démo)
import { IStatsRepository, LocalStatsRepository } from '@/modules/stats/repository';
import { SupabaseStatsRepository } from '@/modules/stats/supabase.repository';

// ═══════════════════════════════════════════════════════════════════
// DÉPÔTS DE DÉMO DU MODE ENTREPRISE — chargés à la demande
// ═══════════════════════════════════════════════════════════════════
//
// Mesuré le 2026-09-02 : les dépôts de démonstration pesaient **123,9 ko
// bruts** dans le chunk d'entrée, soit un quart de son poids, téléchargés par
// chaque visiteur — y compris celui qui repart de la landing sans se
// connecter. La cause : ce fichier importait STATIQUEMENT les deux
// implémentations de chaque module pour n'en instancier qu'une, et un import
// statique est retenu même quand sa branche est morte à l'exécution.
//
// Les quatre du mode entreprise (52 ko bruts) partent donc dans un chunk à
// part, via `src/lib/demo-repositories.ts`.
//
// 🔴 CE QUI REND LA COUPE SÛRE, ET CE QUI LA CASSERAIT. Les quatre interfaces
// n'exposent QUE des méthodes asynchrones — vérifié avant d'écrire ce code.
// Le mandataire ci-dessous reste donc synchrone à la construction et n'attend
// le module qu'au premier APPEL, ce qui laisse intacts tous les appelants et
// toute la séquence de `loginDemo()`. Qu'une de ces interfaces gagne un membre
// synchrone — une propriété, un getter — et le mandataire cesse d'être
// transparent pour lui : il faudra alors renoncer au différé pour ce module.
//
// ⚠️ Le mode PRODUCTION ne passe jamais ici : il instancie directement sa
// classe Supabase, importée statiquement comme avant.

/**
 * Mandataire synchrone d'un dépôt dont le module arrive plus tard.
 *
 * Chaque méthode appelée attend le chargement puis délègue. Le module n'est
 * demandé qu'une fois : `pending` mémorise l'import en vol, sinon deux appels
 * simultanés (le cas normal — plusieurs hooks montent ensemble) en
 * déclencheraient deux.
 */
function lazyDemoRepository<T extends object>(load: () => Promise<T>): T {
  let instance: T | null = null;
  let pending: Promise<T> | null = null;

  const resolve = (): Promise<T> => {
    if (instance) return Promise.resolve(instance);
    pending ??= load().then((repo) => {
      instance = repo;
      return repo;
    });
    return pending;
  };

  return new Proxy({} as T, {
    get: (_target, prop) => {
      // `then` doit rester absent : sans ça, `await getXRepository()` prendrait
      // le mandataire pour une promesse et tenterait de la dérouler.
      if (prop === 'then') return undefined;
      return (...args: unknown[]) =>
        resolve().then((repo) => {
          const method = (repo as Record<string | symbol, unknown>)[prop];
          if (typeof method !== 'function') {
            throw new Error(
              `demo-repositories: « ${String(prop)} » n'est pas une méthode. ` +
                'Le chargement différé suppose une interface 100 % asynchrone.',
            );
          }
          return (method as (...a: unknown[]) => unknown).apply(repo, args);
        });
    },
  });
}

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
let orgOKRCategoriesRepository: IOrgOKRCategoriesRepository | null = null;
let teamCategoriesRepository: ITeamCategoriesRepository | null = null;
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
  orgOKRCategoriesRepository = null;
  teamCategoriesRepository = null;
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
      ? lazyDemoRepository<IOrganizationsRepository>(() =>
          import('./demo-repositories').then((m) => m.createDemoOrganizationsRepository()),
        )
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
      ? lazyDemoRepository<ITeamProjectsRepository>(() =>
          import('./demo-repositories').then((m) => m.createDemoTeamProjectsRepository()),
        )
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
      ? lazyDemoRepository<ITeamOKRsRepository>(() =>
          import('./demo-repositories').then((m) => m.createDemoTeamOKRsRepository()),
        )
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
      ? lazyDemoRepository<IOrgTeamsRepository>(() =>
          import('./demo-repositories').then((m) => m.createDemoOrgTeamsRepository()),
        )
      : new SupabaseOrgTeamsRepository();
  }
  return orgTeamsRepository;
}

/**
 * Get the Org OKR categories repository based on current mode.
 */
export function getOrgOKRCategoriesRepository(): IOrgOKRCategoriesRepository {
  if (!orgOKRCategoriesRepository) {
    orgOKRCategoriesRepository = appModeStore.isDemo
      ? new LocalStorageOrgOKRCategoriesRepository()
      : new SupabaseOrgOKRCategoriesRepository();
  }
  return orgOKRCategoriesRepository;
}

/**
 * Get the Team categories repository based on current mode.
 */
export function getTeamCategoriesRepository(): ITeamCategoriesRepository {
  if (!teamCategoriesRepository) {
    teamCategoriesRepository = appModeStore.isDemo
      ? new LocalStorageTeamCategoriesRepository()
      : new SupabaseTeamCategoriesRepository();
  }
  return teamCategoriesRepository;
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
          getOKRsRepository(),
          // Sans le journal des complétions de KR, `okrTime` vaut 0 : c'est sa
          // seule source (cf. src/lib/workTimeCalculator.ts).
          getKRCompletionsRepository()
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
  orgOKRCategoriesRepository = null;
  teamCategoriesRepository = null;
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
  // cosmo_locale : la langue est un réglage d'INTERFACE, pas une donnée de
  // démo. Sans cette entrée, le balayage `cosmo_*` l'effaçait — un utilisateur
  // qui passait l'app en anglais puis entrait en démo se retrouvait en
  // français, sans comprendre pourquoi.
  // cosmo_first_touch : source d'acquisition (src/lib/attribution.ts). Le
  // parcours le plus fréquent du plan d'acquisition est « lien ?ref=canal →
  // Essayer la démo → inscription » : sans cette entrée, le sweep effacerait
  // l'attribution juste avant l'inscription qu'elle doit expliquer.
  // cosmo_demo_bridge_snooze : report du pont démo → compte
  // (src/lib/hooks/use-demo-bridge.ts). Un refus doit tenir 24 h. Sans cette
  // entrée, fermer la carte puis relancer la démo la ferait revenir aussitôt —
  // le bug B05 à nouveau, appliqué à une sollicitation commerciale cette fois.
  // Le COMPTEUR d'engagement (cosmo_demo_creations / cosmo_demo_started_at)
  // n'est volontairement PAS préservé : une nouvelle démo est un nouveau
  // visiteur, son engagement repart de zéro.
  const PRESERVE_KEYS = new Set([
    'cosmo_cookie_consent',
    'cosmo_demo_device_id',
    'cosmo_first_touch',
    'cosmo_demo_bridge_snooze',
    LOCALE_STORAGE_KEY,
  ]);
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
