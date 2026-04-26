import React, { Suspense, lazy } from 'react';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

// Providers
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/modules/auth/AuthContext';
import { BillingProvider } from '@/modules/billing/billing.context';
import ProtectedRoute from '@/components/ProtectedRoute';
import CookieBanner from '@/components/CookieBanner';

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
const MessagingPage = lazyWithRetry(() => import('@/pages/MessagingPage'));
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
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
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

const AppRoutes = () => (
  <Routes>
    {/* Public pages — accessibles sans authentification */}
    <Route path="welcome" element={<PageWithSuspense><LandingPage /></PageWithSuspense>} />
    <Route path="login" element={<PageWithSuspense><LoginPage /></PageWithSuspense>} />
    <Route path="signup" element={<PageWithSuspense><SignupPage /></PageWithSuspense>} />
    <Route path="mentions-legales" element={<PageWithSuspense><MentionsLegalesPage /></PageWithSuspense>} />
    <Route path="politique-confidentialite" element={<PageWithSuspense><PolitiqueConfidentialitePage /></PageWithSuspense>} />
    <Route path="cgu" element={<PageWithSuspense><CGUPage /></PageWithSuspense>} />

    {/* Protected routes — require authentication */}
    <Route element={<ProtectedRoute />}>
      <Route element={<LayoutWithSuspense />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<PageWithSuspense><DashboardPage /></PageWithSuspense>} />
        <Route path="tasks" element={<PageWithSuspense><TasksPage /></PageWithSuspense>} />
        <Route path="agenda" element={<PageWithSuspense><AgendaPage /></PageWithSuspense>} />
        <Route path="habits" element={<PageWithSuspense><HabitsPage /></PageWithSuspense>} />
        <Route path="okr" element={<PageWithSuspense><OKRPage /></PageWithSuspense>} />
        <Route path="statistics" element={<PageWithSuspense><StatisticsPage /></PageWithSuspense>} />
        <Route path="settings" element={<PageWithSuspense><SettingsPage /></PageWithSuspense>} />
        <Route path="premium" element={<PageWithSuspense><PremiumPage /></PageWithSuspense>} />
        <Route path="messages" element={<PageWithSuspense><MessagingPage /></PageWithSuspense>} />
      </Route>
    </Route>

    {/* Fallback */}
    <Route path="*" element={<Navigate to="/welcome" replace />} />
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
          </TooltipProvider>
        </BillingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
