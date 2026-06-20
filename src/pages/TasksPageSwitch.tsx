// Aiguillage de la route /tasks : en mode « test » (desktop), monte la refonte
// shadcn (TasksPageTest) ; sinon la page To-Do d'origine, INCHANGÉE.
// Import direct pour la page prod (évite le double-lazy + Suspense fallback=null
// qui causait un flash blanc au premier chargement de route).
import { lazy, Suspense } from 'react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useTestMode } from '@/lib/hooks/use-test-mode';
import TasksPage from '@/pages/TasksPage';

const TasksPageTest = lazy(() => import('@/components/tasks-test/TasksPageTest'));

export default function TasksPageSwitch() {
  const isMobile = useIsMobile();
  const testMode = useTestMode();
  if (testMode && !isMobile) {
    return (
      <Suspense fallback={null}>
        <TasksPageTest />
      </Suspense>
    );
  }
  return <TasksPage />;
}
