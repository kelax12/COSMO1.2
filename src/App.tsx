import React, { Suspense, lazy } from 'react';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/modules/auth/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { installMobileFocusRecovery } from '@/lib/mobileFocus';

// Providers
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/modules/auth/AuthContext';
import { BillingProvider } from '@/modules/billing/billing.context';
import ProtectedRoute from '@/components/ProtectedRoute';
import CookieBanner from '@/components/CookieBanner';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import CommandPalette from '@/components/CommandPalette';

// ──────────────────────────────────────────────────────────────────
// Lazy import wrapper — recharge la page si un chunk est obsolète
// (cas après déploiement : le vieux index.html du navigateur référence
// des chunks qui n'existent plus sur le CDN). On retry une fois, puis
// on force un reload pour récupérer un index.html frais.
// ──────────────────────────────────────────────────────────────────
const lazyWithRetry = <T extends React.ComponentType<unknown>>(
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
        if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('aborted') || msg.includes('Délai')) return false;
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

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <p className="text-slate-400 text-sm">Chargement...</p>
    </div>
  </div>
);

// Page loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// Layout wrapper with Suspense
const LayoutWithSuspense = () => (
  <Suspense fallback={<LoadingSpinner />}>
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

const RootRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <PageWithSuspense><LandingPage /></PageWithSuspense>;
};

const AppRoutes = () => (
  <Routes>
    {/* Racine — LandingPage publique, redirect /dashboard si connecté */}
    <Route index element={<RootRoute />} />

    {/* Public pages — accessibles sans authentification */}
    <Route path="welcome" element={<Navigate to="/" replace />} />
    <Route path="login" element={<PageWithSuspense><LoginPage /></PageWithSuspense>} />
    <Route path="signup" element={<PageWithSuspense><SignupPage /></PageWithSuspense>} />
    <Route path="guide" element={<PageWithSuspense><GuidePage /></PageWithSuspense>} />
    <Route path="mentions-legales" element={<PageWithSuspense><MentionsLegalesPage /></PageWithSuspense>} />
    <Route path="politique-confidentialite" element={<PageWithSuspense><PolitiqueConfidentialitePage /></PageWithSuspense>} />
    <Route path="cgu" element={<PageWithSuspense><CGUPage /></PageWithSuspense>} />

    {/* Protected routes — require authentication */}
    <Route element={<ProtectedRoute />}>
      <Route element={<LayoutWithSuspense />}>
        <Route path="dashboard" element={<PageWithSuspense><DashboardPage /></PageWithSuspense>} />
        <Route path="tasks" element={<PageWithSuspense><TasksPage /></PageWithSuspense>} />
        <Route path="agenda" element={<PageWithSuspense><AgendaPage /></PageWithSuspense>} />
        <Route path="habits" element={<PageWithSuspense><HabitsPage /></PageWithSuspense>} />
        <Route path="okr" element={<PageWithSuspense><OKRPage /></PageWithSuspense>} />
        <Route path="statistics" element={<PageWithSuspense><StatisticsPage /></PageWithSuspense>} />
        <Route path="settings" element={<PageWithSuspense><SettingsPage /></PageWithSuspense>} />
        <Route path="premium" element={<PageWithSuspense><PremiumPage /></PageWithSuspense>} />
      </Route>
    </Route>

    {/* Fallback */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BillingProvider>
          <TooltipProvider>
            <Toaster
              position="top-right"
              richColors
              closeButton
              theme="system"
              toastOptions={{
                duration: 3000,
              }}
            />
            <AppRoutes />
            <CookieBanner />
            <OnboardingOverlay />
            <CommandPalette />
          </TooltipProvider>
        </BillingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
