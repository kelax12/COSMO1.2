// ═══════════════════════════════════════════════════════════════════
// Tableau des tâches perso : colonnes par Statut ou par État (mig. 214)
//
// Reçoit les tâches DÉJÀ filtrées par la page (recherche, liste, catégories),
// pour que les deux vues montrent le même sous-ensemble. Chargé en `lazy` par
// `TasksPage` : la vue Liste ne paie rien pour lui.
//
// Deux axes de colonnes, mémorisés par appareil (`view-mode.store.ts`) :
//   · Statut : À faire, En cours, Bloquée, Terminée (7 jours) ;
//   · État (2026-10-09) : Dans les temps, À risque, En difficulté, Sans état,
//     tâches ouvertes seulement. Déplacer une carte y change son État.
//
// Desktop : colonnes côte à côte, glisser-déposer natif.
// Mobile : défilement horizontal aimanté, et « Déplacer vers… » au lieu du
// glisser (le glisser HTML5 ne fonctionne pas au doigt).
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useMemo, useState } from 'react';
import { effectiveStatus, useUpdateTask, type Task, type TaskHealth, type TaskStatus } from '@/modules/tasks';
import TaskModal from '@/components/TaskModal';
import { HEALTH_DOT } from '@/components/organization/health-state.helpers';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useT } from '@/i18n/useT';
import {
  BOARD_COLUMNS, HEALTH_COLUMNS, groupTasksByHealth, groupTasksByStatus, healthColumnOf,
} from './board.helpers';
import { useMoveTask } from './use-move-task';
import { STATUS_DOT } from './status-style';
import { setBoardAxis, useBoardAxis, type BoardAxis } from './view-mode.store';
import TaskBoardColumn, { type BoardColumnDef } from './TaskBoardColumn';
import MoveTaskSheet from './MoveTaskSheet';

const NO_HEALTH_DOT = 'bg-slate-300 dark:bg-slate-600';
const AXES: readonly BoardAxis[] = ['status', 'health'];

interface TaskBoardProps {
  tasks: Task[];
}

const TaskBoard = ({ tasks }: TaskBoardProps) => {
  const { t } = useT('tasks');
  const isMobile = useIsMobile();
  const axis = useBoardAxis();
  const move = useMoveTask();
  const { mutate: update } = useUpdateTask();
  const [openId, setOpenId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Task | null>(null);

  const columns: BoardColumnDef[] = useMemo(() => {
    if (axis === 'health') {
      const byHealth = groupTasksByHealth(tasks);
      return HEALTH_COLUMNS.map((h) => ({
        id: h,
        label: h === 'none' ? t('board.health.unset') : t(`board.health.${h}`),
        dot: h === 'none' ? NO_HEALTH_DOT : HEALTH_DOT[h],
        tasks: byHealth[h],
        newTask: { health: h === 'none' ? null : h },
      }));
    }
    const byStatus = groupTasksByStatus(tasks);
    return BOARD_COLUMNS.map((s) => ({
      id: s,
      label: t(`board.columns.${s}`),
      dot: STATUS_DOT[s],
      tasks: byStatus[s],
      newTask: s === 'done' ? null : { status: s },
      footer: s === 'done' ? t('board.doneWindow') : undefined,
    }));
  }, [axis, tasks, t]);

  // La fiche lit la tâche dans les données COURANTES : un déplacement ou une
  // modification faite ailleurs s'y voit tout de suite.
  const openTask = openId ? tasks.find((task) => task.id === openId) ?? null : null;

  /** Applique un déplacement vers une colonne de l'axe courant. */
  const moveTo = useCallback((task: Task, columnId: string) => {
    if (axis === 'status') { move(task, columnId as TaskStatus); return; }
    const health = columnId === 'none' ? null : (columnId as TaskHealth);
    if (health !== (task.health ?? null)) update({ id: task.id, updates: { health } });
  }, [axis, move, update]);

  const handleOpen = useCallback((task: Task) => setOpenId(task.id), []);
  const handleRequestMove = useCallback((task: Task) => setMoveTarget(task), []);
  const handleDrop = useCallback((taskId: string, columnId: string) => {
    const task = tasks.find((x) => x.id === taskId);
    if (task) moveTo(task, columnId);
  }, [tasks, moveTo]);
  const canDrag = useCallback(() => !isMobile, [isMobile]);

  // Après un « Déplacer vers… », la carte change de colonne : le bouton qui a
  // ouvert la feuille n'existe plus, et la feuille n'a donc rien à qui rendre
  // le focus (mesuré le 2026-10-09 : `document.activeElement` = body). On le
  // pose sur la carte déplacée, dans sa nouvelle colonne.
  const moveFromSheet = useCallback((task: Task, columnId: string) => {
    moveTo(task, columnId);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-board-task="${task.id}"]`)?.focus();
    }, 50);
  }, [moveTo]);

  const currentColumn = (task: Task | null): string | null => {
    if (!task) return null;
    return axis === 'status' ? effectiveStatus(task) : healthColumnOf(task);
  };

  return (
    <div role="region" aria-label={t('board.regionAria')} className="space-y-3">
      <div role="group" aria-label={t('board.axis.label')} className="flex items-center gap-2 text-sm">
        <span className="text-[rgb(var(--color-text-muted))]">{t('board.axis.label')}</span>
        <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5">
          {AXES.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={axis === a}
              onClick={() => setBoardAxis(a)}
              className={`min-h-11 md:min-h-8 px-3 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 ${
                axis === a
                  ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                  : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
              }`}
            >
              {t(`board.axis.${a}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex md:grid md:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none pb-2 md:pb-0">
        {columns.map((column) => (
          <div key={column.id} className="min-w-[82%] sm:min-w-[46%] md:min-w-0 snap-start">
            <TaskBoardColumn
              column={column}
              showStatus={axis === 'health'}
              canDrag={canDrag}
              onOpen={handleOpen}
              onRequestMove={handleRequestMove}
              onDropTask={handleDrop}
            />
          </div>
        ))}
      </div>

      <MoveTaskSheet
        task={moveTarget}
        targets={columns}
        currentId={currentColumn(moveTarget)}
        onClose={() => setMoveTarget(null)}
        onMove={moveFromSheet}
      />

      {openTask && (
        <TaskModal task={openTask} isOpen={!!openTask} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
};

export default TaskBoard;
