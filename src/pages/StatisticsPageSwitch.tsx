// Aiguillage de la route /statistics : en mode « test » (desktop), monte la
// refonte shadcn ; sinon la page Statistiques d'origine, INCHANGÉE.
// Import direct pour la page prod (évite le double-lazy + Suspense fallback=null
// qui causait un flash blanc au premier chargement de route).
import { lazy, Suspense } from 'react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useTestMode } from '@/lib/hooks/use-test-mode';
import StatisticsPage from '@/pages/StatisticsPage';

const StatisticsPageTest = lazy(() => import('@/components/statistics-test/StatisticsPageTest'));

export default function StatisticsPageSwitch() {
  const isMobile = useIsMobile();
  const testMode = useTestMode();
  if (testMode && !isMobile) {
    return (
      <Suspense fallback={null}>
        <StatisticsPageTest />
      </Suspense>
    );
  }
  return <StatisticsPage />;
}
