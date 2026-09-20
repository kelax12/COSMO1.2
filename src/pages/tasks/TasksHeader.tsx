import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader, TouchTarget } from '@/components/mobile';
import TasksInboxMenu from '@/components/task-table/TasksInboxMenu';
import { useT } from '@/i18n/useT';
import { OVERDUE_FOCUS_EVENT } from '@/lib/hooks/use-overdue-focus';

interface TasksHeaderProps {
  showDeadlineCalendar: boolean;
  onToggleCalendar: () => void;
  /** Nombre de tâches non terminées dans la vue courante. */
  openCount: number;
  /** Combien de ces tâches sont en retard. */
  overdueCount: number;
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
const TasksHeader: React.FC<TasksHeaderProps> = ({
  showDeadlineCalendar,
  onToggleCalendar,
  openCount,
  overdueCount,
}) => {
  const { t, tp } = useT('tasks');

  // Maquette 04 — « En-tête large qui se rétracte » : au repos le titre porte
  // ce qu'il y a à faire, au premier défilement il ne reste que « Tâches ».
  // Deux phrases complètes séparées par un point médian, jamais une phrase
  // recousue à partir de fragments : « en retard » n'existe pas seul.
  //
  // ── Maquette 122 : un nombre nu ne mène nulle part ───────────────────
  //
  // Relevé sur les captures du 2026-09-20 : la barre d'onglets affiche « 2 »
  // et « 1 », l'en-tête entreprise « 3 », la boîte de réception « 5 » ici et
  // « 8 » sur l'accueil, et ce sous-titre dit « 1 en retard ». Tous ces
  // compteurs portent déjà un libellé accessible complet — vérifié un par un
  // le 2026-09-21 : `MobileTabBar`, `TasksInboxMenu` (`inbox.withCount`, badge
  // `aria-hidden`) et `OrgNotificationsBell` (`notifications.bellUnread`).
  // La moitié accessibilité de la maquette était donc DÉJÀ faite.
  //
  // Ce qui manquait est l'autre moitié : « 1 en retard » obligeait à chercher
  // soi-même ce qu'il désignait. Il devient TAPABLE et applique le filtre
  // rapide « Retard », qui existait déjà dans `TaskQuickFilters`.
  //
  // ⚠️ L'état de ce filtre vit dans `TaskTable`, deux niveaux plus bas. On
  // passe donc par un évènement, comme `open-task-create` ou `open-quick-add`
  // le font déjà dans ce dépôt, plutôt que de remonter l'état jusqu'ici pour
  // un seul appui.
  const focusOverdue = () => {
    window.dispatchEvent(new CustomEvent(OVERDUE_FOCUS_EVENT));
  };

  const mobileSummary = (
    <>
      <span>{tp('header.openCount', openCount)}</span>
      {overdueCount > 0 && (
        <>
          <span aria-hidden="true"> · </span>
          <button
            type="button"
            onClick={focusOverdue}
            className="text-red-500 font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
            aria-label={tp('header.overdueFilter', overdueCount)}
          >
            {tp('header.overdueCount', overdueCount)}
          </button>
        </>
      )}
    </>
  );

  return (
    <>
      {/* ── Mobile ── */}
      <MobileHeader
        title={t('header.title')}
        subtitle={mobileSummary}
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
                  ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
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
