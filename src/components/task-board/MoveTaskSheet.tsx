// « Déplacer vers… » : le chemin du Tableau qui ne dépend d'aucun geste.
//
// 🔴 C-111 (WCAG 2.1.1, niveau A) : un geste n'est jamais le seul chemin vers
// une action. Le glisser-déposer HTML5 ne marche ni au doigt ni au clavier ;
// cette feuille est atteinte par un bouton de la carte, par la touche menu
// contextuel et par Maj+F10. Feuille du bas sur mobile, dialogue sur desktop
// (`BottomSheet`), focus piégé et rendu au déclencheur (`useModalA11y`).
import { Check } from 'lucide-react';
import { BottomSheet } from '@/components/mobile';
import { effectiveStatus, type Task, type TaskStatus } from '@/modules/tasks';
import { useT } from '@/i18n/useT';
import { BOARD_COLUMNS } from './board.helpers';
import { STATUS_DOT } from './status-style';

interface MoveTaskSheetProps {
  task: Task | null;
  onClose: () => void;
  onMove: (task: Task, to: TaskStatus) => void;
}

const MoveTaskSheet = ({ task, onClose, onMove }: MoveTaskSheetProps) => {
  const { t } = useT('tasks');
  const current = task ? effectiveStatus(task) : null;
  const title = task ? t('board.moveSheetTitle', { name: task.name }) : '';

  return (
    <BottomSheet open={!!task} onClose={onClose} ariaLabel={title}>
      <div className="px-5 pt-3 pb-5">
        <h2 className="text-base font-semibold mb-3 line-clamp-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
          {title}
        </h2>
        <ul className="space-y-1">
          {BOARD_COLUMNS.map((status) => {
            const isCurrent = status === current;
            return (
              <li key={status}>
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => { if (task) onMove(task, status); onClose(); }}
                  className="w-full min-h-11 flex items-center gap-3 px-3 rounded-xl text-left text-sm hover:bg-[rgb(var(--color-hover))] disabled:cursor-default disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60"
                  style={{ color: 'rgb(var(--color-text-primary))' }}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                  <span className="flex-1">{t(`board.columns.${status}`)}</span>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                      <Check size={14} aria-hidden="true" /> {t('board.current')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </BottomSheet>
  );
};

export default MoveTaskSheet;
