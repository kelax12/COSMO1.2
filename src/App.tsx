import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

// Providers
import { TaskProvider } from '@/context/TaskContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/modules/auth/AuthContext';
import { BillingProvider } from '@/modules/billing/billing.context';
import ProtectedRoute from '@/components/ProtectedRoute';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const SignupPage = lazy(() => import('@/pages/SignupPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TasksPage = lazy(() => import('@/pages/TasksPage'));
const AgendaPage = lazy(() => import('@/pages/AgendaPage'));
const HabitsPage = lazy(() => import('@/pages/HabitsPage'));
const OKRPage = lazy(() => import('@/pages/OKRPage'));
const StatisticsPage = lazy(() => import('@/pages/StatisticsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const PremiumPage = lazy(() => import('@/pages/PremiumPage'));
const MessagingPage = lazy(() => import('@/pages/MessagingPage'));

// Lazy load Layout
const Layout = lazy(() => import('@/components/Layout'));

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
  <div className=\"min-h-screen bg-slate-950 flex items-center justify-center\">
    <div className=\"flex flex-col items-center gap-4\">
      <div className=\"animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500\"></div>
      <p className=\"text-slate-400 text-sm\">Chargement...</p>
    </div>
  </div>
);

// Page loading fallback
const PageLoader = () => (
  <div className=\"flex items-center justify-center min-h-[60vh]\">
    <div className=\"animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500\"></div>
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
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);

const AppRoutes = () => (
  <Routes>
    {/* Public pages - outside Layout */}
    <Route path=\"welcome\" element={<PageWithSuspense><LandingPage /></PageWithSuspense>} />
    <Route path=\"login\" element={<PageWithSuspense><LoginPage /></PageWithSuspense>} />
    <Route path=\"signup\" element={<PageWithSuspense><SignupPage /></PageWithSuspense>} />

    {/* Protected routes — require authentication */}
    <Route element={<ProtectedRoute />}>
      <Route element={<LayoutWithSuspense />}>
        <Route index element={<Navigate to=\"/dashboard\" replace />} />
        <Route path=\"dashboard\" element={<PageWithSuspense><DashboardPage /></PageWithSuspense>} />
        <Route path=\"tasks\" element={<PageWithSuspense><TasksPage /></PageWithSuspense>} />
        <Route path=\"agenda\" element={<PageWithSuspense><AgendaPage /></PageWithSuspense>} />
        <Route path=\"habits\" element={<PageWithSuspense><HabitsPage /></PageWithSuspense>} />
        <Route path=\"okr\" element={<PageWithSuspense><OKRPage /></PageWithSuspense>} />
        <Route path=\"statistics\" element={<PageWithSuspense><StatisticsPage /></PageWithSuspense>} />
        <Route path=\"settings\" element={<PageWithSuspense><SettingsPage /></PageWithSuspense>} />
        <Route path=\"premium\" element={<PageWithSuspense><PremiumPage /></PageWithSuspense>} />
        <Route path=\"messages\" element={<PageWithSuspense><MessagingPage /></PageWithSuspense>} />
      </Route>
    </Route>

    {/* Fallback */}
    <Route path=\"*\" element={<Navigate to=\"/dashboard\" replace />} />
  </Routes>
);

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BillingProvider>
          <TooltipProvider>
            <TaskProvider>
              <Toaster
                position=\"top-right\"
                richColors
                closeButton
                theme=\"dark\"
                toastOptions={{
                  duration: 3000,
                }}
              />
              <AppRoutes />
            </TaskProvider>
          </TooltipProvider>
        </BillingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
