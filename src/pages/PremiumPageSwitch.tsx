// Aiguillage de la route /premium : en mode « test » (desktop), monte la
// refonte shadcn ; sinon la page Premium d'origine, INCHANGÉE.
// Import direct pour la page prod (évite le double-lazy + Suspense fallback=null
// qui causait un flash blanc au premier chargement de route).
import { lazy, Suspense } from 'react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useTestMode } from '@/lib/hooks/use-test-mode';
import PremiumPage from '@/pages/PremiumPage';

const PremiumPageTest = lazy(() => import('@/components/premium-test/PremiumPageTest'));

export default function PremiumPageSwitch() {
  const isMobile = useIsMobile();
  const testMode = useTestMode();
  if (testMode && !isMobile) {
    return (
      <Suspense fallback={null}>
        <PremiumPageTest />
      </Suspense>
    );
  }
  return <PremiumPage />;
}
