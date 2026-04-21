import React, { useState } from 'react';
import { Plus, Calendar, Grid3X3, List, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";

const VIEW_TABS: { mode: 'list' | 'table' | 'global'; icon: React.ElementType; label: string }[] = [
  { mode: 'list', icon: List, label: 'Liste' },
  { mode: 'table', icon: Grid3X3, label: 'Tableau' },
  { mode: 'global', icon: TrendingUp, label: 'Suivi global' },
];
import HabitCard from '../components/HabitCard';
import HabitModal from '../components/HabitModal';
import HabitTable from '../components/HabitTable';
import HabitGlobalTracking from '../components/HabitGlobalTracking';
import { useHabits } from '@/modules/habits';

type ViewMode = 'list' | 'table' | 'global';

const HabitsPage: React.FC = () => {
  const { data: habits = [], isLoading } = useHabits();
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const getTodayCompletionRate = () => {
    if (habits.length === 0) return 0;
    const today = new Date().toLocaleDateString('en-CA');
    const completedToday = habits.filter(habit => habit.completions[today]).length;
    return Math.round((completedToday / habits.length) * 100);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-6 w-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
          >
            <Plus size={18} />
            <span>Nouvelle</span>
          </motion.button>
        </div>
      </div>

      {viewMode === 'list' && (
        <div className="space-y-4 md:space-y-6">
          {habits.map(habit => (
            <HabitCard key={habit.id} habit={habit} />
          ))}

          {habits.length === 0 && (
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
                onClick={() => setShowModal(true)}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
              >
                Créer une habitude
              </Button>
            </div>
          )}
        </div>
      )}

      {viewMode === 'table' && <HabitTable />}
      {viewMode === 'global' && <HabitGlobalTracking />}

      <HabitModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
};

export default HabitsPage;
