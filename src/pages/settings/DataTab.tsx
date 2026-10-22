// ═══════════════════════════════════════════════════════════════════
// settings/DataTab — onglet « Mes données » (export RGPD CSV).
// Extrait verbatim de SettingsPage (god-component refactor).
// ═══════════════════════════════════════════════════════════════════
import React, { Suspense, lazy, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, FileUp } from 'lucide-react';
import { useTasks, useTaskDependencies } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs } from '@/modules/okrs';
import { useCategories } from '@/modules/categories';
import { useLists } from '@/modules/lists';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  exportTasksCSV,
  exportTaskDependenciesCSV,
  exportHabitsCSV,
  exportEventsCSV,
  exportOKRsCSV,
  exportCategoriesCSV,
  exportListsCSV,
  exportProfileCSV,
  exportAllCSV,
} from '@/lib/csv-export';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';
import ManageCookiesButton from '@/components/ManageCookiesButton';
import { Link } from 'react-router';
import { useLocalizedPath } from '@/i18n/useLocalizedPath';

// Fenêtre d'import (point 44) : chargée au premier clic, l'onglet n'en paie rien.
const ImportTasksDialog = lazy(() => import('./ImportTasksDialog'));

export function DataTab() {
  const { t, tp } = useT('settings');
  const { data: tasks = [] } = useTasks();
  // Le graphe « bloquée par » (mig. 132) est saisi par la personne : il est dû
  // au titre de l'article 20 au même titre que les tâches qu'il ordonne.
  const { data: taskDependencies = [] } = useTaskDependencies();
  const { data: habits = [] } = useHabits();
  const { data: events = [] } = useEvents();
  const { data: okrs = [] } = useOkrs();
  const { data: categories = [] } = useCategories();
  const { data: lists = [] } = useLists();
  const { user } = useAuth();
  const localizedPath = useLocalizedPath();
  const [importOpen, setImportOpen] = useState(false);
  const [importMounted, setImportMounted] = useState(false);

  // Profil exporte au titre de l'article 20 : le nom et l'adresse sont les
  // donnees les plus evidemment « fournies par la personne concernee ». Le
  // repli sur des chaines vides couvre le rendu avant resolution de la session,
  // jamais un cas nominal — DataTab vit derriere ProtectedRoute.
  const profile = {
    id: user?.id ?? '',
    name: user?.name ?? '',
    email: user?.email ?? '',
    avatar: user?.avatar,
    autoValidation: user?.autoValidation,
  };

  const exports: { label: string; icon: React.ElementType; count: number; run: () => void }[] = [
    { label: t('data.tasks'), icon: FileSpreadsheet, count: tasks.length, run: () => { exportTasksCSV(tasks); toast.success(t('data.tasksExported', { count: tasks.length })); } },
    { label: t('data.taskDependencies'), icon: FileSpreadsheet, count: taskDependencies.length, run: () => { exportTaskDependenciesCSV(taskDependencies, tasks); toast.success(t('data.taskDependenciesExported', { count: taskDependencies.length })); } },
    { label: t('data.habits'), icon: FileSpreadsheet, count: habits.length, run: () => { exportHabitsCSV(habits); toast.success(t('data.habitsExported', { count: habits.length })); } },
    { label: t('data.events'), icon: FileSpreadsheet, count: events.length, run: () => { exportEventsCSV(events); toast.success(t('data.eventsExported', { count: events.length })); } },
    { label: t('data.okrs'), icon: FileSpreadsheet, count: okrs.length, run: () => { exportOKRsCSV(okrs); toast.success(t('data.okrsExported', { count: okrs.length })); } },
    { label: t('data.categories'), icon: FileSpreadsheet, count: categories.length, run: () => { exportCategoriesCSV(categories); toast.success(t('data.categoriesExported', { count: categories.length })); } },
    { label: t('data.lists'), icon: FileSpreadsheet, count: lists.length, run: () => { exportListsCSV(lists); toast.success(t('data.listsExported', { count: lists.length })); } },
    { label: t('data.profile'), icon: FileSpreadsheet, count: 1, run: () => { exportProfileCSV(profile); toast.success(t('data.profileExported')); } },
  ];

  const handleExportAll = () => {
    exportAllCSV({ tasks, taskDependencies, habits, events, okrs, categories, lists, profile });
    toast.success(t('data.exportingAll'), {
      description: t('data.exportingAllHint', {
        count:
          tasks.length + taskDependencies.length + habits.length + events.length + okrs.length
          + categories.length + lists.length,
      }),
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
          {t('data.title')}
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          {t('data.description')}
        </p>
      </div>

      {/* CTA : tout exporter */}
      <button
        type="button"
        onClick={handleExportAll}
        // Maquette 213 : sur mobile, une ligne d'action (texte bleu), plus une carte teintée.
        className="w-full flex items-center gap-4 p-5 max-md:px-4 max-md:py-3 rounded-2xl bg-[rgb(var(--color-accent-solid))]/10 max-md:bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-accent-solid))]/30 max-md:border-0 hover:bg-[rgb(var(--color-accent-solid))]/15 transition-colors text-left"
      >
        <div className="hidden md:flex w-12 h-12 rounded-xl bg-[rgb(var(--color-accent-solid))] items-center justify-center shrink-0">
          <Download size={22} className="text-[rgb(var(--color-accent-solid-foreground))]" />
        </div>
        <div className="flex-1">
          <div className="font-bold max-md:font-semibold text-[rgb(var(--color-text-primary))] max-md:text-[rgb(var(--color-accent))] text-base">
            {t('data.exportAll')}
          </div>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-0.5">
            {t('data.exportAllHint')}
          </p>
        </div>
      </button>

      {/* Exports individuels */}
      <div>
        <h3 className="text-sm font-semibold text-[rgb(var(--color-text-secondary))] mb-3 md:uppercase md:tracking-wider">
          {t('data.byCategory')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-md:gap-0 max-md:rounded-2xl max-md:bg-[rgb(var(--color-surface))] max-md:px-4">
          {exports.map(ex => {
            const Icon = ex.icon;
            return (
              <button
                key={ex.label}
                type="button"
                onClick={ex.run}
                disabled={ex.count === 0}
                className="flex items-center gap-3 p-4 max-md:px-0 max-md:py-2.5 max-md:min-h-touch rounded-xl max-md:rounded-none border border-[rgb(var(--color-border))] max-md:border-0 max-md:border-b max-md:last:border-b-0 bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="hidden md:flex w-10 h-10 rounded-lg bg-[rgb(var(--color-hover))] items-center justify-center shrink-0">
                  <Icon size={18} className="text-[rgb(var(--color-text-secondary))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[rgb(var(--color-text-primary))]">
                    {ex.label}
                  </div>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {tp('data.item', ex.count)}
                  </p>
                </div>
                <Download size={16} className="text-[rgb(var(--color-text-muted))]" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Import (point 44) : remplace la mention « bientôt disponible ». */}
      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[rgb(var(--color-hover))] flex items-center justify-center shrink-0">
          <FileUp size={18} className="text-[rgb(var(--color-text-secondary))]" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[rgb(var(--color-text-primary))]">{t('import.cardTitle')}</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('import.cardHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => { setImportMounted(true); setImportOpen(true); }}
          className="min-h-11 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] shrink-0"
        >
          {t('import.open')}
        </button>
      </div>
      {importMounted && (
        <Suspense fallback={null}>
          <ImportTasksDialog open={importOpen} onClose={() => setImportOpen(false)} />
        </Suspense>
      )}

      {/* Consentement aux traceurs : revenir sur son choix (RGPD art. 7.3) */}
      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] flex items-center justify-between gap-3">
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('data.cookiesHint')}</p>
        <ManageCookiesButton className="shrink-0 text-sm font-semibold underline underline-offset-2 text-[rgb(var(--color-text-primary))]" />
      </div>

      {/* 🔴 LCEN : mentions légales, CGU et politique « directement et
          facilement accessibles ». Avant le 2026-10-13, une fois connecté,
          aucun écran de l'application n'y menait. Nouvel onglet : on ne quitte
          pas ses réglages pour lire un contrat. */}
      <nav aria-label={t('data.legalTitle')} className="p-4 rounded-xl border border-[rgb(var(--color-border))]">
        <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))] mb-2">{t('data.legalTitle')}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {([['legalNotice', 'data.legalNotice'], ['terms', 'data.legalTerms'], ['privacy', 'data.legalPrivacy']] as const).map(([route, label]) => (
            <li key={route}>
              <Link
                to={localizedPath(route)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center underline underline-offset-2 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]"
              >
                {t(label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </motion.div>
  );
}
