import React, { useState } from 'react';
import { Plus, Calendar, Grid3X3, List } from 'lucide-react';
import HabitCard from '../components/HabitCard';
import HabitForm from '../components/HabitForm';
import HabitTable from '../components/HabitTable';

// ═══════════════════════════════════════════════════════════════════
// Module habits - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useHabits } from '@/modules/habits';

const HabitsPage: React.FC = () => {
  // Use new module for habits
  const { data: habits = [], isLoading } = useHabits();
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list');

    const getTodayCompletionRate = () => {
      if (habits.length === 0) return 0;
      const today = new Date().toLocaleDateString('en-CA');
      const completedToday = habits.filter(habit => habit.completions[today]).length;
      return Math.round((completedToday / habits.length) * 100);
    };

    // Loading state
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
            <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>Habitudes</h1>
            <p className="text-sm md:text-base" style={{ color: 'rgb(var(--color-text-secondary))' }}>Développez de bonnes habitudes au quotidien</p>
            {habits.length > 0 && (
              <div className="mt-2 text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>
                Progression : {getTodayCompletionRate()}% ({habits.filter(h => h.completions[new Date().toLocaleDateString('en-CA')]).length}/{habits.length})
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {habits.length > 0 && (
              <div className="flex items-center rounded-lg p-1 transition-colors bg-opacity-50" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                <button
                  onClick={() => setViewMode('list')}
                  className="flex items-center gap-2 px-3 py-1.5 md:py-2 rounded-md transition-all text-sm md:text-base"
                  style={{
                    backgroundColor: viewMode === 'list' ? 'rgb(var(--color-surface))' : 'transparent',
                    color: viewMode === 'list' ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))',
                    boxShadow: viewMode === 'list' ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                >
                  <List size={16} />
                  <span>Liste</span>
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className="flex items-center gap-2 px-3 py-1.5 md:py-2 rounded-md transition-all text-sm md:text-base"
                  style={{
                    backgroundColor: viewMode === 'table' ? 'rgb(var(--color-surface))' : 'transparent',
                    color: viewMode === 'table' ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))',
                    boxShadow: viewMode === 'table' ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                >
                  <Grid3X3 size={16} />
                  <span>Tableau</span>
                </button>
              </div>
            )}
            <button
              onClick={() => setShowAddForm(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 transform transition-all active:scale-95 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-sm md:text-base"
            >
              <Plus size={18} />
              <span>Nouvelle</span>
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="mb-8">
            <HabitForm onClose={() => setShowAddForm(false)} />
          </div>
        )}

        {/* Content based on view mode */}
        {viewMode === 'list' ? (
          /* Habits List */
          <div className="space-y-4 md:space-y-6">
            {habits.map(habit => (
              <HabitCard key={habit.id} habit={habit} />
            ))}

            {habits.length === 0 && (
              <div className="card p-8 md:p-12 text-center">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                  <Calendar size={24} className="md:w-8 md:h-8" style={{ color: 'rgb(var(--color-text-muted))' }} />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>Aucune habitude</h3>
                <p className="mb-6 text-sm md:text-base" style={{ color: 'rgb(var(--color-text-secondary))' }}>Commencez par créer votre première habitude</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 transform transition-all active:scale-95 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
                >
                  Créer une habitude
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <HabitTable />
        )}
      </div>
  );
};

export default HabitsPage;
