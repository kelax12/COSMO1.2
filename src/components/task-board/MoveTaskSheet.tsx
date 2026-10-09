// « Déplacer vers… » : le chemin du Tableau qui ne dépend d'aucun geste.
//
// 🔴 C-111 (WCAG 2.1.1, niveau A) : un geste n'est jamais le seul chemin vers
// une action. Le glisser-déposer HTML5 ne marche ni au doigt ni au clavier ;
// cette feuille est atteinte par un bouton de la carte, par la touche menu
// contextuel et par Maj+F10. Feuille du bas sur mobile, dialogue sur desktop
// (`BottomSheet`), focus piégé et rendu au déclencheur (`useModalA11y`).
//
// Indépendante de l'axe (2026-10-09) : le Tableau lui passe ses colonnes,
// de Statut ou d'État, et la colonne courante de la tâche.
import { Check } from 'lucide-react';
import { BottomSheet } from '@/components/mobile';
import type { Task } from '@/modules/tasks';
import { useT } from '@/i18n/useT';

export interface MoveTarget { id: string; label: string; dot: string }

interface MoveTaskSheetProps {
  task: Task | null;
  targets: readonly MoveTarget[];
  currentId: string | null;
  onClose: () => void;
  onMove: (task: Task, targetId: string) => void;
}

const MoveTaskSheet = ({ task, targets, currentId, onClose, onMove }: MoveTaskSheetProps) => {
  const { t } = useT('tasks');
  const title = task ? t('board.moveSheetTitle', { name: task.name }) : '';

  return (
    <BottomSheet open={!!task} onClose={onClose} ariaLabel={title}>
      <div className="px-5 pt-3 pb-5">
        <h2 className="text-base font-semibold mb-3 line-clamp-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
          {title}
        </h2>
        <ul className="space-y-1">
          {targets.map((target) => {
            const isCurrent = target.id === currentId;
            return (
              <li key={target.id}>
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => { if (task) onMove(task, target.id); onClose(); }}
                  className="w-full min-h-11 flex items-center gap-3 px-3 rounded-xl text-left text-sm hover:bg-[rgb(var(--color-hover))] disabled:cursor-default disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60"
                  style={{ color: 'rgb(var(--color-text-primary))' }}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${target.dot}`} aria-hidden="true" />
                  <span className="flex-1">{target.label}</span>
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
