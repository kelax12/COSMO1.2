// Bascule Liste / Tableau de la page Tâches. Lit et écrit le store mémorisé
// (`view-mode.store.ts`) : aucun état à faire transiter par `TasksPage`.
import { LayoutList, SquareKanban } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { setTasksView, useTasksView, type TasksView } from './view-mode.store';

const OPTIONS: { value: TasksView; Icon: typeof LayoutList }[] = [
  { value: 'list', Icon: LayoutList },
  { value: 'board', Icon: SquareKanban },
];

const ViewModeToggle = ({ className = '' }: { className?: string }) => {
  const { t } = useT('tasks');
  const view = useTasksView();
  return (
    <div role="group" aria-label={t('board.view.label')} className={`inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 ${className}`}>
      {OPTIONS.map(({ value, Icon }) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setTasksView(value)}
            className={`min-h-9 inline-flex items-center gap-1.5 px-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 ${
              active
                ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
            }`}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{t(`board.view.${value}`)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ViewModeToggle;
