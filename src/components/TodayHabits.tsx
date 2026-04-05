import React from 'react';
import { Repeat, Clock, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHabits, useToggleHabitCompletion } from '@/modules/habits';

const TodayHabits: React.FC = () => {
  const { data: habits = [], isLoading } = useHabits();
  const toggleCompletionMutation = useToggleHabitCompletion();
  const navigate = useNavigate();

  const today = new Date().toLocaleDateString('en-CA');

  const todayHabits = habits.map((habit) => ({
    ...habit,
    completedToday: habit.completions[today] || false
  }));

  const completedCount = todayHabits.filter((h) => h.completedToday).length;
  const totalTime = todayHabits.reduce((sum, habit) =>
  habit.completedToday ? sum + habit.estimatedTime : sum, 0
  );

  const handleToggle = (habitId: string) => {
    toggleCompletionMutation.mutate({ id: habitId, date: today });
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-50 dark:bg-purple-900/20 rounded-xl border border-indigo-100 dark:border-purple-800/30">
            <Repeat size={24} className="text-indigo-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[rgb(var(--color-text-primary))]">Habitudes du jour</h2>
            <p className="text-[rgb(var(--color-text-secondary))] text-sm">Chargement...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2 bg-indigo-50 dark:bg-purple-900/20 rounded-xl border border-indigo-100 dark:border-purple-800/30">
        <Repeat size={24} className="text-indigo-600 dark:text-purple-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[rgb(var(--color-text-primary))]">Habitudes du jour</h2>
        <p className="text-[rgb(var(--color-text-secondary))] text-sm">
          {completedCount}/{todayHabits.length} complétées • {Math.floor(totalTime / 60)}h{totalTime % 60}min
        </p>
      </div>
    </div>

    <div className="space-y-4">
        {todayHabits.map((habit) =>
        <div
          key={habit.id}
            className={`p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-lg ${
              habit.completedToday ?
              'bg-blue-600 dark:bg-blue-900 border-blue-400 dark:border-blue-700 shadow-md' :
              'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-slate-700/50'}`
              }
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('.completion-toggle')) {
                handleToggle(habit.id);
              } else {
                navigate('/habits', { state: { selectedHabitId: habit.id } });
              }
            }}>

              <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 completion-toggle" onClick={(e) => e.stopPropagation()}>
                      <div
                        onClick={() => handleToggle(habit.id)}
                        className={`h-7 w-7 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                          habit.completedToday 
                            ? 'bg-white text-blue-600 border-white dark:bg-blue-500 dark:text-white dark:border-blue-600 shadow-md' 
                            : 'bg-slate-200 border-slate-300 dark:bg-slate-800 dark:border-slate-600 text-transparent hover:border-blue-500 hover:bg-blue-100'
                        }`}
                      >
                      <Check className="h-4 w-4" strokeWidth={4} />
                    </div>
                  </div>
                
                  <div className="flex-1">
                    <h3 className={`font-bold ${habit.completedToday ? 'text-white dark:text-blue-300 line-through' : 'text-[rgb(var(--color-text-primary))]'}`}>
                      {habit.name}
                    </h3>
                <div className="flex items-center gap-4 mt-1">
                  <div className={`flex items-center gap-1 text-sm ${habit.completedToday ? 'text-blue-100 dark:text-blue-400/80' : 'text-[rgb(var(--color-text-secondary))]'}`}>
                    <Clock size={14} />
                    <span>{habit.estimatedTime} min</span>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${habit.completedToday ? 'text-white/90 dark:text-orange-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    <span>🔥</span>
                    <span>{Object.values(habit.completions).filter(Boolean).length} jours</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {todayHabits.length === 0 &&
        <div className="text-center py-8 text-[rgb(var(--color-text-muted))]">
            <Repeat size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p>Aucune habitude configurée</p>
            <p className="text-sm">Ajoutez des habitudes dans la section dédiée</p>
          </div>
        }
      </div>
    </div>);

};

export default TodayHabits;
