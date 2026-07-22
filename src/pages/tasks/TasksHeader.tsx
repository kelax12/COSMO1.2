import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Search } from 'lucide-react';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader, TouchTarget } from '@/components/mobile';

interface TasksHeaderProps {
  showDeadlineCalendar: boolean;
  onToggleCalendar: () => void;
}

/**
 * En-tête de la page Tâches.
 *
 * Deux rendus distincts et assumés :
 * - mobile → `MobileHeader` (grand titre qui se compacte au scroll), partagé
 *   par toutes les pages mobile
 * - desktop (`hidden md:flex`) → le rendu historique, inchangé
 *
 * Les faire diverger explicitement vaut mieux qu'un compromis responsive qui
 * ne satisfait ni l'un ni l'autre — c'est ce compromis qui donnait au mobile
 * son allure de « desktop rétréci ».
 *
 * `data-tutorial-id` est porté par les DEUX boutons calendrier ; `findTarget`
 * (page-tutorial-helpers) sélectionne celui qui est réellement visible.
 */
const TasksHeader: React.FC<TasksHeaderProps> = ({ showDeadlineCalendar, onToggleCalendar }) => {
  const openSearch = () => window.dispatchEvent(new CustomEvent('open-command-palette'));

  return (
    <>
      {/* ── Mobile ── */}
      <MobileHeader
        title="Tâches"
        actions={
          <>
            {/* Recherche globale (#41) — sur mobile la loupe était enterrée sous « Plus » */}
            <TouchTarget aria-label="Recherche globale" onClick={openSearch}>
              <Search size={20} aria-hidden="true" />
            </TouchTarget>
            <TouchTarget
              aria-label={showDeadlineCalendar ? 'Masquer le calendrier' : 'Afficher le calendrier'}
              aria-pressed={showDeadlineCalendar}
              onClick={onToggleCalendar}
              data-tutorial-id="tasks-calendar-toggle"
              className={
                showDeadlineCalendar
                  ? 'bg-[rgb(var(--color-accent))] text-white'
                  : ''
              }
            >
              <CalendarDays size={20} aria-hidden="true" />
            </TouchTarget>
          </>
        }
      />

      {/* ── Desktop (inchangé) ── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="hidden md:flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <PageHeading as="h1" variant="compact">
              Tâches
            </PageHeading>
            <motion.p
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base"
            >
              Gérez vos tâches efficacement
            </motion.p>
          </div>

          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 shrink-0"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleCalendar}
              data-tutorial-id="tasks-calendar-toggle"
              aria-label={showDeadlineCalendar ? 'Masquer le calendrier' : 'Afficher le calendrier'}
              className={`flex items-center justify-center gap-2 rounded-lg min-w-11 min-h-11 px-3 sm:px-4 py-2 transition-all shadow-sm border font-medium text-sm ${
                showDeadlineCalendar
                  ? 'bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
              }`}
            >
              <CalendarDays
                size={18}
                className={
                  showDeadlineCalendar
                    ? 'text-white'
                    : 'text-blue-600'
                }
              />
              <span className="hidden sm:inline">Calendrier</span>
            </motion.button>
          </motion.div>
        </div>
      </motion.header>
    </>
  );
};

export default TasksHeader;
