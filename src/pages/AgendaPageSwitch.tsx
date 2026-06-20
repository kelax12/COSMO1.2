// Aiguillage de la route /agenda : en mode « test » (desktop), monte la refonte
// shadcn ; sinon la page Agenda d'origine, INCHANGÉE.
// Import direct pour la page prod (évite le double-lazy + Suspense fallback=null
// qui causait un flash blanc au premier chargement de route).
import { lazy, Suspense } from 'react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useTestMode } from '@/lib/hooks/use-test-mode';
import AgendaPage from '@/pages/AgendaPage';

const AgendaPageTest = lazy(() => import('@/components/agenda-test/AgendaPageTest'));

export default function AgendaPageSwitch() {
  const isMobile = useIsMobile();
  const testMode = useTestMode();
  if (testMode && !isMobile) {
    return (
      <Suspense fallback={null}>
        <AgendaPageTest />
      </Suspense>
    );
  }
  return <AgendaPage />;
}
