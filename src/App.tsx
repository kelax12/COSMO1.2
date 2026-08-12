import React, { Suspense, lazy } from 'react';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from '@/modules/auth/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import { installMobileFocusRecovery } from '@/lib/mobileFocus';
import { isTimeoutError } from '@/lib/withTimeout';
import { useLocale } from '@/i18n/store';
import { routeSlug } from '@/i18n/routes';
import { getLastVisitedPage } from '@/modules/ui-states';
import { useSharedTasksRealtime } from '@/modules/tasks/useSharedTasksRealtime';
// Import `/react` (pas `/next` — réservé aux apps Next.js) : ce projet est
// Vite + React Router, hébergé sur Vercel (cf. vercel.json).
import { Analytics } from '@vercel/analytics/react';

// Providers
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/modules/auth/AuthContext';
import { ActiveOrgProvider } from '@/modules/organizations';
import { BillingProvider } from '@/modules/billing/billing.context';
import { PREMIUM_ENFORCED } from '@/modules/billing/premium-config';
import ProtectedRoute from '@/components/ProtectedRoute';
import CookieBanner from '@/components/CookieBanner';
import ShareInviteClaimer from '@/components/ShareInviteClaimer';
import { useActiveModules, type ModuleKey } from '@/modules/ui-states';
// Audit perf 2026-05-29 — CommandPalette only renders on Ctrl/Cmd+K. Lazy-load
// it so its imports (framer-motion subset, lucide icons, fuzzy search) don't
// land in the entry chunk. Suspense fallback is null because the palette
// itself is invisible until opened.
const CommandPalette = lazy(() => import('@/components/CommandPalette'));
// AM10 — onboarding « Que voulez-vous gérer ? » : invisible tant que non
// déclenché (1er login réel), donc lazy avec fallback null.
const ModuleOnboarding = lazy(() => import('@/components/onboarding/ModuleOnboarding'));

// ──────────────────────────────────────────────────────────────────
// Lazy import wrapper — recharge la page si un chunk est obsolète
// (cas après déploiement : le vieux index.html du navigateur référence
// des chunks qui n'existent plus sur le CDN). On retry une fois, puis
// on force un reload pour récupérer un index.html frais.
// ──────────────────────────────────────────────────────────────────
const lazyWithRetry = <T extends React.ComponentType<Record<string, never>>>(
  factory: () => Promise<{ default: T }>
) =>
  lazy(async () => {
    const STORAGE_KEY = 'cosmo:chunk-reload-attempt';
    try {
      const mod = await factory();
      sessionStorage.removeItem(STORAGE_KEY);
      return mod;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isChunkError =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed') ||
        message.includes('error loading dynamically imported module');

      if (isChunkError && !sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.setItem(STORAGE_KEY, '1');
        window.location.reload();
        // Promise jamais résolue : la page va recharger
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });

// Lazy load pages for code splitting
const LandingPage = lazyWithRetry(() => import('@/pages/LandingPage'));
const LoginPage = lazyWithRetry(() => import('@/pages/LoginPage'));
const SignupPage = lazyWithRetry(() => import('@/pages/SignupPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/ResetPasswordPage'));
const DashboardPage = lazyWithRetry(() => import('@/pages/DashboardPage'));
const TasksPage = lazyWithRetry(() => import('@/pages/TasksPage'));
const AgendaPage = lazyWithRetry(() => import('@/pages/AgendaPage'));
const HabitsPage = lazyWithRetry(() => import('@/pages/HabitsPage'));
const OKRPage = lazyWithRetry(() => import('@/pages/OKRPage'));
const StatisticsPage = lazyWithRetry(() => import('@/pages/StatisticsPage'));
const SettingsPage = lazyWithRetry(() => import('@/pages/SettingsPage'));
const PremiumPage = lazyWithRetry(() => import('@/pages/PremiumPage'));
const GuidePage = lazyWithRetry(() => import('@/pages/GuidePage'));
const MentionsLegalesPage = lazyWithRetry(() => import('@/pages/MentionsLegalesPage'));
const PolitiqueConfidentialitePage = lazyWithRetry(() => import('@/pages/PolitiqueConfidentialitePage'));
const CGUPage = lazyWithRetry(() => import('@/pages/CGUPage'));
const InvitePage = lazyWithRetry(() => import('@/pages/InvitePage'));
const AdminPage = lazyWithRetry(() => import('@/pages/AdminPage'));
const OrganizationOnboardingPage = lazyWithRetry(() => import('@/pages/OrganizationOnboardingPage'));
const OrganizationPage = lazyWithRetry(() => import('@/pages/OrganizationPage'));
const ClaimOrgInvitePage = lazyWithRetry(() => import('@/pages/ClaimOrgInvitePage'));
const NotFoundPage = lazyWithRetry(() => import('@/pages/NotFoundPage'));
const BlogIndexPage = lazyWithRetry(() => import('@/pages/BlogIndexPage'));
const BlogArticlePage = lazyWithRetry(() => import('@/pages/BlogArticlePage'));
const AProposPage = lazyWithRetry(() => import('@/pages/AProposPage'));
const UseCasePage = lazyWithRetry(() => import('@/pages/UseCasePage'));

// Lazy load Layout
const Layout = lazyWithRetry(() => import('@/components/Layout'));

// Query client config optimized
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 minutes
      gcTime: 1000 * 60 * 30,      // 30 minutes
      // Skip retry on definitive RLS / Postgrest errors AND on timeout/abort —
      // on iOS Safari, the first cold connection routinely stalls past our 8 s
      // fetch timeout. A blind retry serializes 8 s + 1 s + 8 s = ~17 s before
      // we surface the error, which the user perceives as "loading 20 seconds".
      // Better to fail fast: the localStorage cache (AuthContext) keeps every
      // subsequent open instant, and visibilitychange → refetchQueries (mobileFocus)
      // recovers the stale state without making the user wait for a second 8 s window.
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        const msg = error instanceof Error ? error.message : '';
        if (msg.includes('PGRST') || msg.includes('row-level security')) return false;
        // i18n — identification par code stable, pas par sous-chaîne du message
        // FR (`includes('Délai')` mourait dès la traduction du message de
        // withTimeout, faisant silencieusement retomber iOS sur ~17 s perçues).
        if (isTimeoutError(error)) return false;
        return true;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 3000),
      refetchOnWindowFocus: false,
      // `networkMode: 'always'` runs queries regardless of `navigator.onLine`.
      // The default ('online') pauses queries when the browser thinks it's
      // offline — and `navigator.onLine` is notoriously unreliable on mobile
      // Safari (often falsely reports offline after a backgrounding event),
      // leaving every page stuck on its loading skeleton even though the
      // network is fine. Faille: TasksPage + HabitsPage stuck loading on iOS.
      networkMode: 'always',
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    },
  },
});

installMobileFocusRecovery(queryClient);

// Pendant le boot (auth en cours, chunks en vol), on n'affiche rien :
// le body garde son fond thémé, pas d'écran « Chargement... » plein écran.

// Page loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[rgb(var(--color-accent-solid))]"></div>
  </div>
);

// Layout wrapper with Suspense
const LayoutWithSuspense = () => (
  <Suspense fallback={null}>
    <Layout />
  </Suspense>
);

// Page wrapper with Suspense
const PageWithSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </AppErrorBoundary>
);

// Pages protégées éligibles à la réouverture « dernière page visitée » (#34).
const RESUMABLE_PAGES = ['/dashboard', '/tasks', '/agenda', '/habits', '/okr', '/statistics', '/settings', '/entreprise'];

// AM10 — Garde de module : si l'utilisateur a désactivé un module optionnel
// (Agenda / Habitudes / OKR / Statistiques) dans l'onboarding ou les réglages,
// l'accès direct par URL redirige vers le Dashboard. En démo, tout est actif.
const RequireModule: React.FC<{ module: ModuleKey; children: React.ReactNode }> = ({
  module,
  children,
}) => {
  const activeModules = useActiveModules();
  if (!activeModules[module]) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const RootRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) {
    // Rouvre l'app sur la dernière page quittée (mémorisée par Layout),
    // fallback dashboard si inconnue ou invalide.
    const last = getLastVisitedPage();
    const target = last && RESUMABLE_PAGES.includes(last) ? last : '/dashboard';
    return <Navigate to={target} replace />;
  }
  return <PageWithSuspense><LandingPage /></PageWithSuspense>;
};

/**
 * Abonnement Realtime aux partages de tâches — monté UNE SEULE FOIS ici.
 *
 * Un canal Realtime est une connexion WebSocket : le monter dans un composant
 * de page en ouvrirait une par écran affiché. Au niveau App, il suit la session
 * et se referme proprement au changement d'utilisateur.
 *
 * Composant vide (pas de rendu) : c'est uniquement un point d'ancrage de cycle
 * de vie. Cf. audit archi 2026-08-07, point C2.
 */
const SharedTasksRealtime: React.FC = () => {
  const { user, isDemo } = useAuth();
  useSharedTasksRealtime(isDemo ? undefined : user?.id);
  return null;
};

const AppRoutes = () => {
  // Locale servie pour ce montage. `basename` étant figé au montage du routeur,
  // elle ne change pas sans rechargement complet (cf. src/i18n/bootstrap.ts) —
  // il n'y a donc jamais de désynchronisation entre le préfixe de l'URL et les
  // slugs déclarés ici.
  const activeLocale = useLocale();

  return (
  <Routes>
    {/* Racine — LandingPage publique, redirect /dashboard si connecté */}
    <Route index element={<RootRoute />} />

    {/* Public pages — accessibles sans authentification */}
    <Route path="welcome" element={<Navigate to="/" replace />} />
    <Route path="login" element={<PageWithSuspense><LoginPage /></PageWithSuspense>} />
    <Route path="signup" element={<PageWithSuspense><SignupPage /></PageWithSuspense>} />
    <Route path="forgot-password" element={<PageWithSuspense><ForgotPasswordPage /></PageWithSuspense>} />
    <Route path="reset-password" element={<PageWithSuspense><ResetPasswordPage /></PageWithSuspense>} />
    <Route path="guide" element={<PageWithSuspense><GuidePage /></PageWithSuspense>} />
    <Route path="blog" element={<PageWithSuspense><BlogIndexPage /></PageWithSuspense>} />
    <Route path="blog/:slug" element={<PageWithSuspense><BlogArticlePage /></PageWithSuspense>} />
    {/* Slugs publics localisés — cf. src/i18n/routes.ts.
        `basename` retire déjà le préfixe de locale, donc ces chemins restent
        relatifs ; seul le SLUG change selon la langue servie. Conséquence
        voulue : `/en/about` répond, `/en/a-propos` tombe en 404 — une seule URL
        canonique par langue et par page. */}
    <Route path={routeSlug('about', activeLocale)} element={<PageWithSuspense><AProposPage /></PageWithSuspense>} />
    <Route path={routeSlug('freelancers', activeLocale)} element={<PageWithSuspense><UseCasePage /></PageWithSuspense>} />
    <Route path={routeSlug('students', activeLocale)} element={<PageWithSuspense><UseCasePage /></PageWithSuspense>} />
    <Route path={routeSlug('managers', activeLocale)} element={<PageWithSuspense><UseCasePage /></PageWithSuspense>} />
    <Route path={routeSlug('teams', activeLocale)} element={<PageWithSuspense><UseCasePage /></PageWithSuspense>} />
    <Route path={routeSlug('legalNotice', activeLocale)} element={<PageWithSuspense><MentionsLegalesPage /></PageWithSuspense>} />
    <Route path={routeSlug('privacy', activeLocale)} element={<PageWithSuspense><PolitiqueConfidentialitePage /></PageWithSuspense>} />
    <Route path={routeSlug('terms', activeLocale)} element={<PageWithSuspense><CGUPage /></PageWithSuspense>} />
    {/* Lien d'invitation de partage — public : pose le token puis redirige
        (login/signup si déconnecté) ; ShareInviteClaimer fait le claim. */}
    <Route path="invite/:token" element={<PageWithSuspense><InvitePage /></PageWithSuspense>} />
    {/* Lien d'invitation entreprise placé (v2) — public : la page gère
        elle-même l'état connecté/déconnecté + consentement RGPD. */}
    <Route path="org-invite/:token" element={<PageWithSuspense><ClaimOrgInvitePage /></PageWithSuspense>} />

    {/* Protected routes — require authentication */}
    <Route element={<ProtectedRoute />}>
      {/* Onboarding entreprise — plein écran, hors Layout (pas de nav) */}
      <Route path="entreprise/onboarding" element={<PageWithSuspense><OrganizationOnboardingPage /></PageWithSuspense>} />
      <Route element={<LayoutWithSuspense />}>
        <Route path="dashboard" element={<PageWithSuspense><DashboardPage /></PageWithSuspense>} />
        <Route path="tasks" element={<PageWithSuspense><TasksPage /></PageWithSuspense>} />
        <Route path="agenda" element={<RequireModule module="agenda"><PageWithSuspense><AgendaPage /></PageWithSuspense></RequireModule>} />
        <Route path="habits" element={<RequireModule module="habits"><PageWithSuspense><HabitsPage /></PageWithSuspense></RequireModule>} />
        <Route path="okr" element={<RequireModule module="okr"><PageWithSuspense><OKRPage /></PageWithSuspense></RequireModule>} />
        <Route path="statistics" element={<RequireModule module="statistics"><PageWithSuspense><StatisticsPage /></PageWithSuspense></RequireModule>} />
        <Route path="settings" element={<PageWithSuspense><SettingsPage /></PageWithSuspense>} />
        {/* Espace entreprise — visible pour les membres d'une organisation */}
        <Route path="entreprise" element={<PageWithSuspense><OrganizationPage /></PageWithSuspense>} />
        {/* Admin — URL non référencée (aucun lien dans l'UI), gating réel
            côté serveur : la RPC get_admin_stats rejette les non-admins. */}
        <Route path="admin" element={<PageWithSuspense><AdminPage /></PageWithSuspense>} />
        {/* Premium masqué tant que PREMIUM_ENFORCED=false : la route redirige
            vers le dashboard. Page + import conservés (réactivation via le flag). */}
        <Route path="premium" element={PREMIUM_ENFORCED ? <PageWithSuspense><PremiumPage /></PageWithSuspense> : <Navigate to="/" replace />} />
      </Route>
    </Route>

    {/* Fallback */}
    <Route path="*" element={<PageWithSuspense><NotFoundPage /></PageWithSuspense>} />
  </Routes>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ActiveOrgProvider>
        <BillingProvider>
          <TooltipProvider>
            {/* reducedMotion="user" : respecte `prefers-reduced-motion` du système
                pour TOUTES les animations Framer Motion (transforms réduits, pas
                de mouvement décoratif). Exigence WCAG 2.3.3 / EAA. */}
            <MotionConfig reducedMotion="user">
            <Toaster
              position="top-right"
              richColors
              closeButton
              theme="system"
              toastOptions={{
                duration: 3000,
              }}
            />
            <SharedTasksRealtime />
            <AppRoutes />
            <CookieBanner />
            {/* Popup d'invitation de partage — niveau App pour survivre aux
                changements de route (claim après login OU fin d'inscription). */}
            <ShareInviteClaimer />
            <Suspense fallback={null}>
              <CommandPalette />
            </Suspense>
            <Suspense fallback={null}>
              <ModuleOnboarding />
            </Suspense>
            <Analytics />
            </MotionConfig>
          </TooltipProvider>
        </BillingProvider>
        </ActiveOrgProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
