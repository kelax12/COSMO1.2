// Tâches de fond quotidiennes du Layout, headless : rappel des échéances du
// jour (#30) et tâches créées par les habitudes les jours prévus (mig. 265,
// chargé à part : la plupart des comptes n'activent pas l'option).
import { Suspense } from 'react';
import DeadlineReminder from './DeadlineReminder';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

const HabitAutoTaskRunner = lazyWithRetry(() => import('./habits/HabitAutoTaskRunner'));

const DailyRunners: React.FC = () => (
  <>
    <DeadlineReminder />
    <Suspense fallback={null}>
      <HabitAutoTaskRunner />
    </Suspense>
  </>
);

export default DailyRunners;
