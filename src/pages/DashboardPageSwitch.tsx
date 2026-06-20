// Aiguillage de la route / (dashboard) : en mode « test » (desktop), monte la
// refonte shadcn ; sinon le Dashboard d'origine, INCHANGÉ.
// Import direct pour la page prod (évite le double-lazy + Suspense fallback=null
// qui causait un flash blanc au premier chargement de route).
import { lazy, Suspense } from 'react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useTestMode } from '@/lib/hooks/use-test-mode';
import DashboardPage from '@/pages/DashboardPage';

const DashboardPageTest = lazy(() => import('@/components/dashboard-test/DashboardPageTest'));

export default function DashboardPageSwitch() {
  const isMobile = useIsMobile();
  const testMode = useTestMode();
  if (testMode && !isMobile) {
    return (
      <Suspense fallback={null}>
        <DashboardPageTest />
      </Suspense>
    );
  }
  return <DashboardPage />;
}
