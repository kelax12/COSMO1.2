// Aiguillage de la route /okr : en mode « test » (desktop), monte la refonte
// shadcn ; sinon la page OKR d'origine, INCHANGÉE.
// Import direct pour la page prod (évite le double-lazy + Suspense fallback=null
// qui causait un flash blanc au premier chargement de route).
import { lazy, Suspense } from 'react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useTestMode } from '@/lib/hooks/use-test-mode';
import OKRPage from '@/pages/OKRPage';

const OKRPageTest = lazy(() => import('@/components/okr-test/OKRPageTest'));

export default function OKRPageSwitch() {
  const isMobile = useIsMobile();
  const testMode = useTestMode();
  if (testMode && !isMobile) {
    return (
      <Suspense fallback={null}>
        <OKRPageTest />
      </Suspense>
    );
  }
  return <OKRPage />;
}
