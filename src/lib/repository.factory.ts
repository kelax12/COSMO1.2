// ═══════════════════════════════════════════════════════════════════
// Repository Factory : sélection du dépôt (démo / Supabase)
// ═══════════════════════════════════════════════════════════════════
//
// Une déclaration par dépôt, toutes par `defineRepository(démo, production)`
// (`./define-repository.ts`, la seule manière d'instancier un dépôt).
//
// Règle de choix : démo toujours `lazy`, depuis `./demo-repositories`, pour que
// la démo reste hors du chunk d'entrée. Production `eager` pour les dépôts du
// quotidien, `lazy` pour ceux d'écrans rares (gouvernance, rôles, exécution des
// OKR). `org-config` et `org-reports` déclarent les leurs dans leur dossier, par
// le même `defineRepository`. `lazy` suppose une interface 100 % asynchrone.

import { appModeStore } from './app-mode.store';
import { defineRepository, eager, lazy, resetRepositories } from './define-repository';
import { LOCALE_STORAGE_KEY } from '@/i18n/locale';

import type { ITasksRepository } from '@/modules/tasks/repository';
import { SupabaseTasksRepository } from '@/modules/tasks/supabase.repository';
import type { IHabitsRepository } from '@/modules/habits/repository';
import { SupabaseHabitsRepository } from '@/modules/habits/supabase.repository';
import type { IEventsRepository } from '@/modules/events/repository';
import { SupabaseEventsRepository } from '@/modules/events/supabase.repository';
import type { ICategoriesRepository } from '@/modules/categories/repository';
import { SupabaseCategoriesRepository } from '@/modules/categories/supabase.repository';
import type { IListsRepository } from '@/modules/lists/repository';
import { SupabaseListsRepository } from '@/modules/lists/supabase.repository';
import type { IFriendsRepository } from '@/modules/friends/repository';
import { SupabaseFriendsRepository } from '@/modules/friends/supabase.repository';
import type { IOKRsRepository } from '@/modules/okrs/repository';
import { SupabaseOKRsRepository } from '@/modules/okrs/supabase.repository';
import type { IKRCompletionsRepository } from '@/modules/kr-completions/repository';
import { SupabaseKRCompletionsRepository } from '@/modules/kr-completions/supabase.repository';
import type { IOrganizationsRepository } from '@/modules/organizations/repository';
import { SupabaseOrganizationsRepository } from '@/modules/organizations/supabase.repository';
import type { ITeamProjectsRepository } from '@/modules/team-projects/repository';
import { SupabaseTeamProjectsRepository } from '@/modules/team-projects/supabase.repository';
import type { ITeamOKRsRepository } from '@/modules/team-okrs/repository';
import { SupabaseTeamOKRsRepository } from '@/modules/team-okrs/supabase.repository';
import type { IOrgTeamsRepository } from '@/modules/org-teams/repository';
import { SupabaseOrgTeamsRepository } from '@/modules/org-teams/supabase.repository';
import type { ITeamCategoriesRepository } from '@/modules/team-categories/repository';
import { SupabaseTeamCategoriesRepository } from '@/modules/team-categories/supabase.repository';
import type { ITeamListsRepository } from '@/modules/team-lists/repository';
import { SupabaseTeamListsRepository } from '@/modules/team-lists/supabase.repository';
import type { IStatsRepository } from '@/modules/stats/repository';
import { SupabaseStatsRepository } from '@/modules/stats/supabase.repository';
// Écrans rares : interfaces seules ici, les deux implémentations arrivent par `import()`.
import type { IOrgGovernanceRepository } from '@/modules/organizations/governance.repository';
import type { IOrgRolesRepository } from '@/modules/organizations/roles.repository';
import type { IOkrExecutionRepository } from '@/modules/team-okrs/execution.repository';

/** Chargement du module des dépôts de démonstration (un seul chunk, hors entrée). */
const demoModule = () => import('./demo-repositories');

// Oublie tous les dépôts déclarés (loginDemo, tests). Le mécanisme est dans
// `define-repository.ts`, qui couvre aussi org-config et org-reports.
export { resetRepositories };

// ═══════════════════════════════════════════════════════════════════
// LES DÉPÔTS
// ═══════════════════════════════════════════════════════════════════

export const getTasksRepository = defineRepository<ITasksRepository>(
  lazy(() => demoModule().then((m) => m.createDemoTasksRepository())),
  eager(() => new SupabaseTasksRepository()),
);

export const getHabitsRepository = defineRepository<IHabitsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoHabitsRepository())),
  eager(() => new SupabaseHabitsRepository()),
);

export const getEventsRepository = defineRepository<IEventsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoEventsRepository())),
  eager(() => new SupabaseEventsRepository()),
);

export const getCategoriesRepository = defineRepository<ICategoriesRepository>(
  lazy(() => demoModule().then((m) => m.createDemoCategoriesRepository())),
  eager(() => new SupabaseCategoriesRepository()),
);

export const getListsRepository = defineRepository<IListsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoListsRepository())),
  eager(() => new SupabaseListsRepository()),
);

export const getFriendsRepository = defineRepository<IFriendsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoFriendsRepository())),
  eager(() => new SupabaseFriendsRepository()),
);

export const getOKRsRepository = defineRepository<IOKRsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoOKRsRepository())),
  eager(() => new SupabaseOKRsRepository()),
);

export const getKRCompletionsRepository = defineRepository<IKRCompletionsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoKRCompletionsRepository())),
  eager(() => new SupabaseKRCompletionsRepository()),
);

export const getOrganizationsRepository = defineRepository<IOrganizationsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoOrganizationsRepository())),
  eager(() => new SupabaseOrganizationsRepository()),
);

export const getTeamProjectsRepository = defineRepository<ITeamProjectsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoTeamProjectsRepository())),
  eager(() => new SupabaseTeamProjectsRepository()),
);

export const getTeamOKRsRepository = defineRepository<ITeamOKRsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoTeamOKRsRepository())),
  eager(() => new SupabaseTeamOKRsRepository()),
);

export const getOrgTeamsRepository = defineRepository<IOrgTeamsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoOrgTeamsRepository())),
  eager(() => new SupabaseOrgTeamsRepository()),
);

export const getTeamCategoriesRepository = defineRepository<ITeamCategoriesRepository>(
  lazy(() => demoModule().then((m) => m.createDemoTeamCategoriesRepository())),
  eager(() => new SupabaseTeamCategoriesRepository()),
);

export const getTeamListsRepository = defineRepository<ITeamListsRepository>(
  lazy(() => demoModule().then((m) => m.createDemoTeamListsRepository())),
  eager(() => new SupabaseTeamListsRepository()),
);

/**
 * Stats : en démo, l'implémentation locale agrège via les dépôts des modules
 * sources, injectés ici pour éviter tout import circulaire. Sans le journal des
 * complétions de KR, `okrTime` vaut 0 : c'est sa seule source (incident C-77,
 * cf. src/lib/workTimeCalculator.ts).
 */
export const getStatsRepository = defineRepository<IStatsRepository>(
  lazy(() =>
    demoModule().then((m) =>
      m.createDemoStatsRepository({
        tasks: getTasksRepository(),
        events: getEventsRepository(),
        habits: getHabitsRepository(),
        okrs: getOKRsRepository(),
        krCompletions: getKRCompletionsRepository(),
      }),
    ),
  ),
  eager(() => new SupabaseStatsRepository()),
);

// ── Écrans rares : différés des deux côtés ──────────────────────────
// Importés en dur, ces dépôts entraient dans le chunk d'ENTRÉE dès qu'un écran
// lazy s'en servait (+1,9 ko gzip pour la gouvernance), pour des gestes
// d'administration que la plupart des visites ne font jamais.

/** Gouvernance d'organisation (cycle de vie des membres, audit, préférences). */
export const getOrgGovernanceRepository = defineRepository<IOrgGovernanceRepository>(
  lazy(() => demoModule().then((m) => m.createDemoOrgGovernanceRepository())),
  lazy(() =>
    import('@/modules/organizations/governance.supabase.repository').then((m) => new m.SupabaseOrgGovernanceRepository()),
  ),
);

/** Rôles personnalisés à durée limitée (mig. 219). */
export const getOrgRolesRepository = defineRepository<IOrgRolesRepository>(
  lazy(() => demoModule().then((m) => m.createDemoOrgRolesRepository())),
  lazy(() => import('@/modules/organizations/roles.supabase.repository').then((m) => new m.SupabaseOrgRolesRepository())),
);

/** Exécution des OKR (cycles, points d'étape, projets reliés). */
export const getOkrExecutionRepository = defineRepository<IOkrExecutionRepository>(
  lazy(() => demoModule().then((m) => m.createDemoOkrExecutionRepository())),
  lazy(() => import('@/modules/team-okrs/execution.supabase.repository').then((m) => new m.SupabaseOkrExecutionRepository())),
);

// ═══════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if app is running in demo mode
 */
export function isInDemoMode(): boolean {
  return appModeStore.isDemo;
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
    'cosmo_cookie_consent_at',
    'cosmo_demo_device_id',
    'cosmo_first_touch',
    'cosmo_aff',
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
