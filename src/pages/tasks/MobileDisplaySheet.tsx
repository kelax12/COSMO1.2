import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import { BottomSheet, Segmented, TouchTarget } from '@/components/mobile';
import { useT } from '@/i18n/useT';
import { setTasksView, useTasksView } from '@/components/task-board/view-mode.store';

interface Props {
  showDeadlineCalendar: boolean;
  onToggleCalendar: () => void;
  onOpenColorSettings: () => void;
}

/**
 * « Affichage » de la page Tâches, sur MOBILE (maquette 140, 2026-10-10).
 *
 * L'en-tête portait quatre icônes : boîte de réception, vue tableau, réglages
 * des couleurs, mini-calendrier. Trois d'entre elles règlent la MÊME chose,
 * la façon dont la liste se montre : elles se rangent ici, et l'en-tête n'en
 * garde que deux (la boîte, et ce bouton).
 *
 * Un point d'accent sur le bouton dit qu'un réglage s'écarte du défaut (vue
 * tableau, ou calendrier ouvert) : sans lui, ces deux états deviendraient
 * invisibles depuis l'en-tête, alors qu'ils changent ce que montre la page.
 */
const MobileDisplaySheet: React.FC<Props> = ({ showDeadlineCalendar, onToggleCalendar, onOpenColorSettings }) => {
  const { t } = useT('tasks');
  const { t: tCommon } = useT('common');
  const [open, setOpen] = useState(false);
  const tasksView = useTasksView();
  const changed = tasksView === 'board' || showDeadlineCalendar;

  return (
    <>
      <TouchTarget
        aria-label={t('board.view.label')}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        data-tutorial-id="tasks-display"
        className="relative"
      >
        <SlidersHorizontal size={20} aria-hidden="true" />
        {changed && (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 size-2 rounded-full bg-[rgb(var(--color-accent))] ring-2 ring-[rgb(var(--color-background))]"
          />
        )}
      </TouchTarget>

      {/* Portail : l'en-tête mobile est `sticky z-30`, un contexte
          d'empilement qui gardait la feuille SOUS la barre du bas. */}
      {createPortal(
      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel={t('board.view.label')}>
        <div className="px-gutter pb-4">
          <h2 className="text-title font-bold py-3 text-[rgb(var(--color-text-primary))]">
            {t('board.view.label')}
          </h2>

          <Segmented
            ariaLabel={t('board.view.label')}
            value={tasksView}
            onChange={(value) => setTasksView(value)}
            options={[
              { value: 'list', label: t('board.view.list') },
              { value: 'board', label: t('board.view.board') },
            ]}
          />

          <div className="mt-4 rounded-2xl bg-[rgb(var(--color-surface))] px-4">
            <div className="flex items-center gap-3 min-h-touch border-b border-[rgb(var(--color-border))]">
              <span className="flex-1 text-body text-[rgb(var(--color-text-primary))]">{t('header.deadlineCalendar')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={showDeadlineCalendar}
                aria-label={t('header.deadlineCalendar')}
                onClick={onToggleCalendar}
                className={`relative w-[51px] h-[31px] shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] ${
                  showDeadlineCalendar ? 'bg-[rgb(var(--color-accent-solid))]' : 'bg-[rgb(var(--color-border-strong))]'
                }`}
              >
                <span
                  className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-md transition-[left] duration-200"
                  style={{ left: showDeadlineCalendar ? 'calc(100% - 29px)' : '2px' }}
                />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenColorSettings();
              }}
              className="flex w-full items-center gap-3 min-h-touch text-left"
            >
              <span className="flex-1 text-body text-[rgb(var(--color-text-primary))]">{tCommon('colorLegend.edit')}</span>
              <ChevronRight size={18} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
            </button>
          </div>
        </div>
      </BottomSheet>,
      document.body,
      )}
    </>
  );
};

export default MobileDisplaySheet;
