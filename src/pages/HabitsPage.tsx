import React, { useState } from 'react';
import { Plus, Calendar, Grid3X3, List, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";

// Ordre : Tableau (défaut, plus dense) → Liste → Suivi global
const VIEW_TABS: { mode: 'list' | 'table' | 'global'; icon: React.ElementType; label: string }[] = [
  { mode: 'table', icon: Grid3X3, label: 'Tableau' },
  { mode: 'list', icon: List, label: 'Liste' },
  { mode: 'global', icon: TrendingUp, label: 'Suivi global' },
];
import HabitCard from '../components/HabitCard';
import HabitModal from '../components/HabitModal';
import HabitTable from '../components/HabitTable';
import HabitGlobalTracking from '../components/HabitGlobalTracking';
import { useHabits } from '@/modules/habits';
import { HabitListSkeleton } from '@/components/skeletons';
import { usePullToRefresh } from '@/lib/hooks/use-pull-to-refresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import PageTutorial from '@/components/tutorial/PageTutorial';
import { useTutorial } from '@/components/tutorial/useTutorial';
import { habitsTutorialStepsDesktop } from '@/tutorials/habits.desktop';
import { habitsTutorialStepsMobile } from '@/tutorials/habits.mobile';
import { useIsMobile } from '@/lib/hooks/use-mobile';

type ViewMode = 'list' | 'table' | 'global';

const HabitsPage: React.FC = () => {
  const isMobile = useIsMobile();
  const tutorial = useTutorial(isMobile ? 'habits_mobile' : 'habits_desktop');
  const tutorialSteps = isMobile ? habitsTutorialStepsMobile : habitsTutorialStepsDesktop;
  const { data: habits = [], isLoading, isError, error, refetch } = useHabits();
  const { pullY, isRefreshing, threshold } = usePullToRefresh(() => refetch());
  const [showModal, setShowModal] = useState(false);
  // Vue par défaut = Tableau (vue dense, panorama 30 jours d'un coup d'œil)
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const getTodayCompletionRate = () => {
    if (habits.length === 0) return 0;
    const today = new Date().toLocaleDateString('en-CA');
    const completedToday = habits.filter(habit => habit.completions[today]).length;
    return Math.round((completedToday / habits.length) * 100);
  };

  if (isError) {
    return (
      <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">
          Impossible de charger les habitudes
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))] max-w-md">
          {(error as Error)?.message || 'Vérifie ta connexion internet, puis réessaie.'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] p-4 md:p-8 pb-[calc(64px+env(safe-area-inset-bottom)+24px)] md:pb-8" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      <PullToRefreshIndicator pullY={pullY} isRefreshing={isRefreshing} threshold={threshold} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
            Habitudes
          </h1>
          <p className="text-sm md:text-base" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            Développez de bonnes habitudes au quotidien
          </p>
          {habits.length > 0 && (
            <div className="mt-2 text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>
              Progression : {getTodayCompletionRate()}% (
              {habits.filter(h => h.completions[new Date().toLocaleDateString('en-CA')]).length}/
              {habits.length})
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {habits.length > 0 && (
            <div
              className="flex items-center rounded-xl p-1 border transition-colors"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                borderColor: 'rgb(var(--color-border))',
              }}
              data-tutorial-id="habits-view-switcher"
            >
              {VIEW_TABS.map(({ mode, icon: Icon, label }) => (
                <motion.button
                  key={mode}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode(mode)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: viewMode === mode ? '#2563EB' : 'transparent',
                    color: viewMode === mode ? 'white' : 'rgb(var(--color-text-secondary))',
                  }}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </motion.button>
              ))}
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowModal(true)}
            data-tutorial-id="habits-create-button"
            className="hidden sm:flex flex-none items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
          >
            <Plus size={18} />
            <span>Nouvelle</span>
          </motion.button>
        </div>
      </div>

      {viewMode === 'list' && (
        <div className="space-y-4 md:space-y-6" data-tutorial-id="habits-list">
          {isLoading && habits.length === 0 && <HabitListSkeleton count={4} />}

          {habits.map(habit => (
            <HabitCard key={habit.id} habit={habit} />
          ))}

          {!isLoading && habits.length === 0 && (
            <div className="card p-8 md:p-12 text-center">
              <div
                className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgb(var(--color-hover))' }}
              >
                <Calendar size={24} className="md:w-8 md:h-8" style={{ color: 'rgb(var(--color-text-muted))' }} />
              </div>
              <h3
                className="text-lg md:text-xl font-semibold mb-2"
                style={{ color: 'rgb(var(--color-text-primary))' }}
              >
                Aucune habitude
              </h3>
              <p className="mb-6 text-sm md:text-base" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                Commencez par créer votre première habitude
              </p>
              <Button
                variant="default"
                size="lg"
                onClick={() => setShowModal(true)}
                className="mx-auto flex items-center justify-center gap-2 px-10 py-3 text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
              >
                Créer une habitude
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Mobile : quand aucune habitude, on ne montre QUE l'empty state avec
          le bouton « Créer une habitude » (pas la table vide qui doublonnait).
          Sur desktop, on garde le comportement actuel par vue. */}
      {viewMode === 'table' && (
        isMobile && habits.length === 0 && !isLoading ? (
          <div className="card p-8 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(var(--color-hover))' }}
            >
              <Calendar size={24} style={{ color: 'rgb(var(--color-text-muted))' }} />
            </div>
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: 'rgb(var(--color-text-primary))' }}
            >
              Aucune habitude
            </h3>
            <p className="mb-6 text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              Commencez par créer votre première habitude
            </p>
            <Button
              variant="default"
              size="lg"
              onClick={() => setShowModal(true)}
              className="mx-auto flex items-center justify-center gap-2 px-10 py-3 text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
            >
              Créer une habitude
            </Button>
          </div>
        ) : <HabitTable />
      )}
      {viewMode === 'global' && (
        isMobile && habits.length === 0 && !isLoading ? (
          <div className="card p-8 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(var(--color-hover))' }}
            >
              <Calendar size={24} style={{ color: 'rgb(var(--color-text-muted))' }} />
            </div>
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: 'rgb(var(--color-text-primary))' }}
            >
              Aucune habitude
            </h3>
            <p className="mb-6 text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              Commencez par créer votre première habitude
            </p>
            <Button
              variant="default"
              size="lg"
              onClick={() => setShowModal(true)}
              className="mx-auto flex items-center justify-center gap-2 px-10 py-3 text-base bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
            >
              Créer une habitude
            </Button>
          </div>
        ) : <HabitGlobalTracking />
      )}

      <HabitModal isOpen={showModal} onClose={() => setShowModal(false)} />

      {/* FAB Nouvelle habitude — mobile only */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowModal(true)}
        data-tutorial-id="habits-fab"
        aria-label="Nouvelle habitude"
        className="md:hidden fixed right-4 bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] z-30 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 monochrome:from-white monochrome:to-neutral-200 monochrome:text-black text-white shadow-lg shadow-blue-500/40 flex items-center justify-center"
      >
        <Plus size={28} />
      </motion.button>

      {/* Tutoriel page Habitudes — variante adaptée au viewport */}
      <PageTutorial
        steps={tutorialSteps}
        isOpen={tutorial.isOpen}
        onClose={tutorial.close}
        accentColor="#EAB308"
      />
    </div>
  );
};

export default HabitsPage;
