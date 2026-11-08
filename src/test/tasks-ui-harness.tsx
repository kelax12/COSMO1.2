// ═══════════════════════════════════════════════════════════════════
// Harnais des tests d'écran « tâches » (vague 15.1, TST-02)
//
// Les écrans de tâches (fiche, tableau, barre latérale de l'agenda, page) lisent
// une dizaine de modules. Les tester avec des hooks simulés module par module
// reviendrait à tester les simulacres ; on monte donc les VRAIS hooks React Query
// sur les VRAIS dépôts de démonstration (`localStorage`), avec seulement :
//   - la session (`useAuth`) et la facturation (`useBilling`), qui demandent un
//     fournisseur absent d'un test de composant ;
//   - un jeu de tâches déterministe, posé dans `cosmo_demo_tasks`.
//
// Les `vi.mock` ne se partagent pas : chaque fichier de test pose les siens et
// appelle `authModuleOverride()` / `billingModuleOverride()` ci-dessous.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { it as vitestIt } from 'vitest';
import { render, configure, screen, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { appModeStore } from '@/lib/app-mode.store';
import { resetRepositories, getCategoriesRepository, getListsRepository } from '@/lib/repository.factory';
import { deadlineFromDayKey } from '@/lib/deadline';
import { translator } from '@/i18n/useT';
import { ActiveOrgProvider } from '@/modules/organizations/ActiveOrgContext';
import { categoryKeys } from '@/modules/categories/constants';
import { listKeys } from '@/modules/lists/constants';
import type { Task } from '@/modules/tasks';

// Les dépôts de démonstration des tâches sont servis par `import()` (cf.
// `lazyDemoRepository`). On charge le module d'avance : sur une machine chargée,
// sa transformation par Vitest dépasse sinon le délai d'un premier `waitFor`.
await import('@/lib/demo-repositories');

// Machine partagée (C-47) : le délai par défaut de 1 s de `waitFor` / `findBy*`
// mesure la charge de la machine plutôt que le composant.
configure({ asyncUtilTimeout: 8000 });

export const DEMO_USER = {
  id: 'demo-user',
  name: 'Demo',
  email: 'demo@cosmo.app',
} as const;

/** Valeur de `useAuth()` : l'utilisateur de démonstration, déjà connecté. */
export function fakeAuth() {
  return {
    user: DEMO_USER,
    isAuthenticated: true,
    isDemo: true,
    isLoading: false,
    login: async () => undefined,
    logout: async () => undefined,
    register: async () => undefined,
    loginWithGoogle: async () => undefined,
    updateDemoProfile: () => undefined,
  };
}

/** Valeur de `useBilling()` : premium ouvert (le partage n'est plus un gate). */
export function fakeBilling() {
  return {
    isPremium: () => true,
    isLoading: false,
    stats: null,
    subscription: null,
    refreshBillingStatus: async () => undefined,
  };
}

/** Jour de référence des tests : un samedi, pour que « demain » ne tombe pas un lundi. */
export const TODAY_KEY = '2026-11-07';

/** Clé de jour décalée de `days` jours par rapport à `TODAY_KEY` (calendrier UTC). */
export function dayKeyFromToday(days: number): string {
  const d = new Date(`${TODAY_KEY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Fabrique une tâche complète ; l'échéance est un JOUR, stocké comme l'app le stocke. */
export function makeTask(overrides: Partial<Task> & { id: string; name: string; dueDay?: string }): Task {
  const { dueDay, ...rest } = overrides;
  return {
    description: '',
    priority: 3,
    category: '',
    deadline: dueDay ? deadlineFromDayKey(dueDay) : '',
    estimatedTime: 30,
    createdAt: '2026-11-01T08:00:00.000Z',
    bookmarked: false,
    completed: false,
    isCollaborative: false,
    pendingInvites: [],
    ...rest,
  } as Task;
}

/**
 * Remet le monde de démonstration à zéro : mode démo, dépôts neufs, stockage vide,
 * puis les tâches fournies. À appeler dans `beforeEach`.
 */
export function resetDemoWorld(tasks: Task[] = []): void {
  localStorage.clear();
  appModeStore.setDemo(true);
  resetRepositories();
  localStorage.setItem('cosmo_demo_tasks', JSON.stringify(tasks));
  // Les tutoriels de page s'ouvrent seuls au premier passage sur desktop : on
  // les déclare vus, ils ne sont pas l'objet de ces tests.
  for (const page of ['tasks', 'agenda']) {
    for (const device of ['desktop', 'mobile']) localStorage.setItem(`cosmo_tutorial_seen_${page}_${device}`, '1');
  }
}

/** Catégories et listes de démonstration, lues UNE fois par fichier (cf. `warmDemoCaches`). */
let warm: { categories: unknown[]; lists: unknown[] } = { categories: [], lists: [] };

/**
 * Lit les catégories et les listes de démonstration pour amorcer le cache de
 * chaque test. À appeler dans un `beforeAll`.
 */
export async function warmDemoCaches(): Promise<void> {
  localStorage.clear();
  appModeStore.setDemo(true);
  resetRepositories();
  warm = {
    categories: await getCategoriesRepository().getAll(),
    lists: await getListsRepository().getAll(),
  };
  localStorage.clear();
  resetRepositories();
}

/**
 * Client React Query de test, avec catégories et listes DÉJÀ en cache et
 * fraîches, comme dans l'application une fois la page chargée.
 *
 * Pourquoi. `TasksPage` (`useTaskLists`), `EventModal` et `useTaskModal` lisent
 * `const { data = [] } = useX()` et relancent un effet qui dépend de ce
 * tableau ou de sa longueur. Tant que la requête charge, `data` est indéfini, le
 * `= []` est un tableau NEUF à chaque rendu, l'effet remet un état neuf, et le
 * rendu suivant recommence : dans `act()` (Testing Library) cette boucle ne se
 * vide jamais et le test ne rend pas la main. Et quand les données arrivent
 * pendant la saisie, ces effets réinitialisent le formulaire (cf. les tests
 * « survit à l'arrivée des catégories »). Cf. rapport de la vague 15.1.
 */
export function makeQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(categoryKeys.lists(), warm.categories);
  queryClient.setQueryData(listKeys.lists(), warm.lists);
  return queryClient;
}

/** Rend `ui` dans un routeur mémoire et un client React Query neuf. */
export function renderApp(
  ui: React.ReactElement,
  options: { route?: string | { pathname: string; state?: unknown }; queryClient?: QueryClient } = {},
): RenderResult & { queryClient: QueryClient } {
  const queryClient = options.queryClient ?? makeQueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider>
        <MemoryRouter initialEntries={[options.route ?? '/tasks']}>{ui}</MemoryRouter>
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
  return Object.assign(result, { queryClient });
}

/** Lit les tâches telles que le dépôt de démonstration les a écrites. */
export function storedTasks(): Task[] {
  return JSON.parse(localStorage.getItem('cosmo_demo_tasks') ?? '[]') as Task[];
}

/**
 * jsdom n'a ni `matchMedia`, ni `ResizeObserver`, ni `scrollIntoView`, ni
 * mise en page : on pose les stubs minimaux et la largeur de la fenêtre
 * (`useIsMobile` lit `innerWidth`). Idempotent ; à appeler dans `beforeEach`.
 */
export function setViewport(kind: 'desktop' | 'mobile'): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: kind === 'mobile' ? 390 : 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: kind === 'mobile' ? 844 : 900 });
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  if (!('ResizeObserver' in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  Element.prototype.scrollIntoView = () => undefined;
}

/**
 * Traducteur PARESSEUX d'un namespace. `translator('x')` lu à l'import d'un
 * fichier de test s'exécute avant l'enregistrement des catalogues (`beforeAll`
 * de `src/test/setup.ts`) et rend des clés brutes : on le résout à chaque appel.
 */
export function lazyT<N extends Parameters<typeof translator>[0]>(namespace: N) {
  return {
    t: (...args: Parameters<ReturnType<typeof translator<N>>['t']>) =>
      (translator(namespace).t as (...a: unknown[]) => string)(...args),
    tp: (...args: Parameters<ReturnType<typeof translator<N>>['tp']>) =>
      (translator(namespace).tp as (...a: unknown[]) => string)(...args),
  };
}

/**
 * Attend l'en-tête d'une fiche. Le titre accessible du dialogue (`DialogTitle`,
 * réservé aux lecteurs d'écran) et le `h2` visible portent le même texte en
 * édition : `findByRole('heading', { name })` échoue sur ce doublon.
 */
export async function findFiche(name: string): Promise<HTMLElement> {
  const all = await screen.findAllByRole('heading', { name });
  return all[0];
}

/**
 * `true` : les tests de bug tournent comme de simples `it` et montrent POURQUOI
 * ils échouent (à lire avant de les figer). `false` : `it.fails`, ils passent
 * tant que le bug existe et rougissent le jour où il est corrigé.
 */
export const VERIFIER_LES_BUGS = false;
export const itBug = VERIFIER_LES_BUGS ? vitestIt : vitestIt.fails;
