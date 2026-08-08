import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader, TouchTarget } from '@/components/mobile';
import TasksInboxMenu from '@/components/task-table/TasksInboxMenu';
import { useT } from '@/i18n/useT';

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
  const { t } = useT('tasks');
  return (
    <>
      {/* ── Mobile ── */}
      <MobileHeader
        title={t('header.title')}
        actions={
          <>
            {/* Loupe retirée du header mobile : redondante avec la barre de
                recherche visible juste en dessous. La recherche globale reste
                accessible via la palette (Cmd/Ctrl+K) et l'onglet « Plus ». */}
            {/* Tâches/listes partagées en attente, regroupées ici plutôt
                qu'en bandeaux inline (cf. TaskTable, masqués sur mobile). */}
            <TasksInboxMenu />
            <TouchTarget
              aria-label={showDeadlineCalendar ? t('header.hideCalendar') : t('header.showCalendar')}
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
              {t('header.title')}
            </PageHeading>
            <motion.p
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base"
            >
              {t('header.subtitle')}
            </motion.p>
          </div>

          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 shrink-0"
          >
            {/* Tâches/listes partagées en attente : plus de bandeaux inline
                dans le tableau (cf. TaskTable), tout passe par cette boîte de
                réception — comme sur mobile, avec un déclencheur en pastille
                assortie au bouton Calendrier. */}
            <TasksInboxMenu variant="desktop" />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleCalendar}
              data-tutorial-id="tasks-calendar-toggle"
              aria-label={showDeadlineCalendar ? t('header.hideCalendar') : t('header.showCalendar')}
              className={`flex items-center justify-center gap-2 rounded-lg min-w-11 min-h-11 px-3 sm:px-4 py-2 transition-all shadow-sm border font-medium text-sm ${
                showDeadlineCalendar
                  ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))] dark:bg-[rgb(var(--color-accent-solid))] dark:border-[rgb(var(--color-accent-solid))] shadow-md'
                  : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] hover:border-[rgb(var(--color-border-strong))]'
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
              <span className="hidden sm:inline">{t('header.calendar')}</span>
            </motion.button>
          </motion.div>
        </div>
      </motion.header>
    </>
  );
};

export default TasksHeader;
