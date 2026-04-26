import React from 'react';
import {
  Bookmark, BookmarkCheck, Calendar, MoreHorizontal,
  Trash2, UserPlus, AlertTriangle, CheckCircle2, Users
} from 'lucide-react';

// ─── Static data ───────────────────────────────────────────────────
const CATEGORIES: Record<string, { name: string; color: string }> = {
  'cat-1': { name: 'Personnel',    color: '#3B82F6' },
  'cat-2': { name: 'Travail',      color: '#EF4444' },
  'cat-3': { name: 'Santé',        color: '#10B981' },
  'cat-4': { name: 'Loisirs',      color: '#F59E0B' },
  'cat-5': { name: 'Finance',      color: '#8B5CF6' },
};

const today = new Date();
const d = (n: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const TASKS = [
  { id:'1', name:'Finaliser le rapport mensuel',    priority:5, category:'cat-2', deadline: d(1),  estimatedTime:120, bookmarked:true,  completed:false, createdAt: d(-5) },
  { id:'2', name:'Séance de sport (HIIT)',           priority:4, category:'cat-3', deadline: d(0),  estimatedTime:45,  bookmarked:false, completed:true,  createdAt: d(-3) },
  { id:'3', name:'Préparer la roadmap Q2',           priority:5, category:'cat-2', deadline: d(2),  estimatedTime:180, bookmarked:true,  completed:false, createdAt: d(-1) },
  { id:'4', name:'Appeler la banque (prêt immo)',    priority:3, category:'cat-5', deadline: d(-1), estimatedTime:20,  bookmarked:false, completed:false, createdAt: d(-7) },
  { id:'5', name:'Lecture : Atomic Habits',          priority:2, category:'cat-1', deadline: d(3),  estimatedTime:30,  bookmarked:false, completed:false, createdAt: d(-2) },
  { id:'6', name:'Réviser la proposition client',    priority:4, category:'cat-2', deadline: d(1),  estimatedTime:90,  bookmarked:true,  completed:false, createdAt: d(-1), isCollaborative: true },
];

// Priority badge — dark-mode hardcoded
const PRIORITY_STYLES: Record<number, string> = {
  5: 'bg-red-600/30    text-red-400    border border-red-700',
  4: 'bg-orange-600/30 text-orange-400 border border-orange-700',
  3: 'bg-yellow-900/20 text-yellow-300 border border-yellow-800',
  2: 'bg-blue-900/20   text-blue-300   border border-blue-800',
  1: 'bg-slate-800     text-slate-300  border border-slate-700',
};

const FILTER_BTNS = [
  { label: 'Favoris',        icon: Bookmark,      active: true  },
  { label: 'Terminées',      icon: CheckCircle2,  active: false },
  { label: 'Retard',         icon: AlertTriangle, active: false },
  { label: 'Collaboration',  icon: Users,         active: false },
];

const TaskTableShowcase: React.FC = () => (
  <div className="w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl text-sm select-none">

    {/* ── Filter bar ── */}
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-slate-900/70 border-b border-white/10">
      {FILTER_BTNS.map(({ label, icon: Icon, active }) => (
        <div
          key={label}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-semibold cursor-default ${
            active
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-slate-800/60 border-slate-700 text-slate-400'
          }`}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </div>
      ))}
    </div>

    {/* ── Table ── */}
    <div className="overflow-x-auto bg-slate-800/50">
      <table className="w-full" style={{ minWidth: 780 }}>
        <thead>
          <tr className="bg-slate-900/60 border-b border-white/10">
            <th className="px-3 py-3 w-10" />
            <th className="px-2 py-3 w-7" />
            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Nom de la tâche
            </th>
            <th className="px-2 py-3 w-16 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Priorité
            </th>
            <th className="px-3 py-3 w-28 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Deadline
            </th>
            <th className="px-2 py-3 w-20 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Temps
            </th>
            <th className="px-2 py-3 w-36 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Actions
            </th>
            <th className="px-3 py-3 w-24 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Créé
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-white/5">
          {TASKS.map((task) => {
            const cat = CATEGORIES[task.category];
            const isLate = task.deadline === d(-1) && !task.completed;
            const bgColor = task.bookmarked ? 'rgba(234,179,8,0.12)' : 'transparent';
            const borderLeft = task.bookmarked
              ? '4px solid #EAB308'
              : `3px solid ${cat?.color ?? '#6B7280'}`;

            return (
              <tr
                key={task.id}
                className={`transition-colors cursor-default ${task.completed ? 'opacity-60' : ''}`}
                style={{ backgroundColor: bgColor, borderLeft }}
              >
                {/* Checkbox */}
                <td className="px-3 py-3.5">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      task.completed ? 'bg-blue-500 border-blue-500' : 'border-slate-500'
                    }`}
                  >
                    {task.completed && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </td>

                {/* Category square */}
                <td className="px-2 py-3.5">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: cat?.color ?? '#CBD5E1' }} />
                </td>

                {/* Name */}
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium text-sm ${task.completed ? 'line-through text-slate-500' : 'text-white'}`}
                    >
                      {task.name}
                    </span>
                    {task.isCollaborative && (
                      <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold shrink-0">
                        Collaboratif
                      </span>
                    )}
                  </div>
                </td>

                {/* Priority badge */}
                <td className="px-2 py-3.5 text-center">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${PRIORITY_STYLES[task.priority]}`}>
                    {task.priority}
                  </span>
                </td>

                {/* Deadline */}
                <td className={`px-3 py-3.5 text-sm font-medium ${isLate ? 'text-red-400' : 'text-slate-300'}`}>
                  {task.deadline}
                </td>

                {/* Estimated time */}
                <td className="px-2 py-3.5 text-center text-sm font-medium text-slate-300">
                  {task.estimatedTime}
                </td>

                {/* Actions */}
                <td className="px-2 py-3.5">
                  <div className="flex items-center justify-center gap-0.5">
                    {task.bookmarked
                      ? <BookmarkCheck size={15} className="p-1 w-7 h-7 text-yellow-400" />
                      : <Bookmark size={15} className="p-1 w-7 h-7 text-slate-500" />
                    }
                    <Calendar    size={15} className="p-1 w-7 h-7 text-slate-500" />
                    <MoreHorizontal size={15} className="p-1 w-7 h-7 text-slate-500" />
                    <UserPlus    size={15} className="p-1 w-7 h-7 text-slate-500" />
                    <Trash2      size={15} className="p-1 w-7 h-7 text-slate-500" />
                  </div>
                </td>

                {/* Created */}
                <td className="px-3 py-3.5 text-sm text-slate-400">
                  {task.createdAt}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default TaskTableShowcase;
