import React from 'react';
import { Bookmark, CheckCircle2, Circle, Clock, Flag } from 'lucide-react';

const CATEGORIES = [
  { id: 'cat-1', name: 'Personnel', color: '#3B82F6' },
  { id: 'cat-2', name: 'Travail', color: '#EF4444' },
  { id: 'cat-3', name: 'Santé', color: '#10B981' },
  { id: 'cat-4', name: 'Loisirs', color: '#F59E0B' },
  { id: 'cat-5', name: 'Finance', color: '#8B5CF6' },
];

const TASKS = [
  { id: '1', name: 'Finaliser le rapport mensuel', priority: 5, category: 'cat-2', deadline: '+1j', estimatedTime: 120, bookmarked: true, completed: false },
  { id: '2', name: 'Séance de HIIT intense', priority: 4, category: 'cat-3', deadline: "Auj.", estimatedTime: 45, bookmarked: false, completed: true },
  { id: '3', name: 'Préparer la roadmap Q2', priority: 5, category: 'cat-2', deadline: '+2j', estimatedTime: 180, bookmarked: true, completed: false },
  { id: '4', name: 'Appeler la banque', priority: 3, category: 'cat-5', deadline: "Auj.", estimatedTime: 20, bookmarked: false, completed: false },
  { id: '5', name: 'Lecture : Atomic Habits', priority: 2, category: 'cat-1', deadline: '+3j', estimatedTime: 30, bookmarked: false, completed: false },
  { id: '6', name: 'Réviser la proposition client', priority: 4, category: 'cat-2', deadline: '+1j', estimatedTime: 90, bookmarked: true, completed: false },
];

const PRIORITY_COLORS: Record<number, string> = {
  5: '#EF4444',
  4: '#F97316',
  3: '#EAB308',
  2: '#22C55E',
  1: '#3B82F6',
};

const PRIORITY_LABELS: Record<number, string> = {
  5: 'Critique',
  4: 'Haute',
  3: 'Moyenne',
  2: 'Basse',
  1: 'Mineure',
};

const FILTER_CHIPS = ['Toutes', 'Favoris', 'Terminées', 'En retard'];

const TaskTableShowcase: React.FC = () => {
  const getCat = (id: string) => CATEGORIES.find(c => c.id === id);

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-slate-800/80 border border-white/10 shadow-2xl text-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/60">
        <div className="flex items-center gap-2">
          {FILTER_CHIPS.map((chip, i) => (
            <span
              key={chip}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-default ${
                i === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}
            >
              {chip}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <Clock size={12} />
          <span>{TASKS.length} tâches</span>
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1.8fr_0.7fr_0.7fr_0.6fr_0.5fr] gap-2 px-4 py-2.5 border-b border-white/5 bg-slate-900/40 text-slate-500 text-xs font-semibold uppercase tracking-wider">
        <span>Tâche</span>
        <span>Priorité</span>
        <span>Catégorie</span>
        <span>Échéance</span>
        <span className="text-center">Durée</span>
      </div>

      {/* Rows */}
      <div>
        {TASKS.map((task, i) => {
          const cat = getCat(task.category);
          return (
            <div
              key={task.id}
              className={`grid grid-cols-[1.8fr_0.7fr_0.7fr_0.6fr_0.5fr] gap-2 px-4 py-3 items-center border-b border-white/5 transition-colors cursor-default ${
                i % 2 === 0 ? 'bg-slate-800/40' : 'bg-slate-800/20'
              } ${task.completed ? 'opacity-50' : ''}`}
            >
              {/* Name */}
              <div className="flex items-center gap-2.5 min-w-0">
                {task.completed ? (
                  <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                ) : (
                  <Circle size={16} className="text-slate-600 flex-shrink-0" />
                )}
                <span className={`font-medium truncate ${task.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                  {task.name}
                </span>
                {task.bookmarked && (
                  <Bookmark size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                )}
              </div>

              {/* Priority */}
              <div className="flex items-center gap-1.5">
                <Flag size={12} style={{ color: PRIORITY_COLORS[task.priority] }} />
                <span className="text-xs font-medium" style={{ color: PRIORITY_COLORS[task.priority] }}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              </div>

              {/* Category */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat?.color ?? '#6B7280' }}
                />
                <span className="text-xs text-slate-300 truncate">{cat?.name ?? '—'}</span>
              </div>

              {/* Deadline */}
              <span className={`text-xs font-medium ${
                task.deadline === 'Auj.' ? 'text-orange-400' : 'text-slate-400'
              }`}>
                {task.deadline}
              </span>

              {/* Time */}
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs">
                <Clock size={11} />
                <span>{task.estimatedTime}m</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskTableShowcase;
