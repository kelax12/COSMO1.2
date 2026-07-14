// ═══════════════════════════════════════════════════════════════════
// settings/DataTab — onglet « Mes données » (export RGPD CSV).
// Extrait verbatim de SettingsPage (god-component refactor).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs } from '@/modules/okrs';
import {
  exportTasksCSV,
  exportHabitsCSV,
  exportEventsCSV,
  exportOKRsCSV,
  exportAllCSV,
} from '@/lib/csv-export';
import { toast } from 'sonner';

export function DataTab() {
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: events = [] } = useEvents();
  const { data: okrs = [] } = useOkrs();

  const exports: { label: string; icon: React.ElementType; count: number; run: () => void }[] = [
    { label: 'Tâches', icon: FileSpreadsheet, count: tasks.length, run: () => { exportTasksCSV(tasks); toast.success(`${tasks.length} tâches exportées`); } },
    { label: 'Habitudes', icon: FileSpreadsheet, count: habits.length, run: () => { exportHabitsCSV(habits); toast.success(`${habits.length} habitudes exportées`); } },
    { label: 'Agenda', icon: FileSpreadsheet, count: events.length, run: () => { exportEventsCSV(events); toast.success(`${events.length} événements exportés`); } },
    { label: 'OKR', icon: FileSpreadsheet, count: okrs.length, run: () => { exportOKRsCSV(okrs); toast.success(`${okrs.length} OKR exportés`); } },
  ];

  const handleExportAll = () => {
    exportAllCSV({ tasks, habits, events, okrs });
    toast.success('Export de toutes vos données en cours…', {
      description: `${tasks.length + habits.length + events.length + okrs.length} éléments répartis dans 4 fichiers CSV`,
    });
  };

  return (
    <motion.div
      key="data"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="max-w-3xl flex flex-col gap-6"
    >
      <div>
        <h2
         
          className="text-xl font-extrabold text-[rgb(var(--color-text-primary))] mb-1"
        >
          Mes données
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          Exportez vos données au format CSV pour les ouvrir dans Excel, Google Sheets ou Numbers.
        </p>
      </div>

      {/* CTA : tout exporter */}
      <button
        type="button"
        onClick={handleExportAll}
        className="w-full flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 transition-colors text-left"
      >
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <Download size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-[rgb(var(--color-text-primary))] text-base">
            Tout exporter
          </div>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-0.5">
            4 fichiers CSV — tâches, habitudes, agenda, OKR
          </p>
        </div>
      </button>

      {/* Exports individuels */}
      <div>
        <h3 className="text-sm font-semibold text-[rgb(var(--color-text-secondary))] mb-3 uppercase tracking-wider">
          Export par catégorie
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {exports.map(ex => {
            const Icon = ex.icon;
            return (
              <button
                key={ex.label}
                type="button"
                onClick={ex.run}
                disabled={ex.count === 0}
                className="flex items-center gap-3 p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-lg bg-[rgb(var(--color-hover))] flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-[rgb(var(--color-text-secondary))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[rgb(var(--color-text-primary))]">
                    {ex.label}
                  </div>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {ex.count} élément{ex.count > 1 ? 's' : ''}
                  </p>
                </div>
                <Download size={16} className="text-[rgb(var(--color-text-muted))]" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Note import */}
      <div className="p-4 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))]">
        <p className="text-xs text-[rgb(var(--color-text-muted))]">
          <strong className="text-[rgb(var(--color-text-secondary))]">Import depuis Todoist / Notion / TickTick</strong> — bientôt disponible. En attendant, vous pouvez exporter vos données depuis l'app source en CSV puis nous contacter pour l'import manuel.
        </p>
      </div>
    </motion.div>
  );
}
