// ═══════════════════════════════════════════════════════════════════
// Prefetch des chunks de route au survol de la nav
// ═══════════════════════════════════════════════════════════════════
//
// Les pages sont lazy-loadées (App.tsx). Au survol d'un lien de la sidebar,
// on déclenche le `import()` du chunk de la page cible : quand l'utilisateur
// clique, le module est déjà en cache → navigation quasi instantanée (gain
// surtout net pour /agenda qui tire FullCalendar, ~76 kB gzip).
//
// `import()` est dédupliqué par le navigateur / Vite : appeler ces factories
// est idempotent. On garde quand même un Set pour éviter le bruit.

const ROUTE_IMPORTS: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/DashboardPage'),
  '/dashboard': () => import('@/pages/DashboardPage'),
  '/tasks': () => import('@/pages/TasksPage'),
  '/agenda': () => import('@/pages/AgendaPage'),
  '/okr': () => import('@/pages/OKRPage'),
  '/habits': () => import('@/pages/HabitsPage'),
  '/statistics': () => import('@/pages/StatisticsPage'),
  '/premium': () => import('@/pages/PremiumPage'),
  '/settings': () => import('@/pages/SettingsPage'),
  '/entreprise': () => import('@/pages/OrganizationPage'),
};

const prefetched = new Set<string>();

/**
 * Précharge le chunk de la route `to` (no-op si inconnue ou déjà préchargée).
 * À appeler sur `onMouseEnter` / `onPointerDown` d'un lien de navigation.
 */
export function prefetchRoute(to: string): void {
  if (prefetched.has(to)) return;
  const factory = ROUTE_IMPORTS[to];
  if (!factory) return;
  prefetched.add(to);
  // Échec réseau → on autorise une nouvelle tentative au prochain survol.
  factory().catch(() => { prefetched.delete(to); });
}
