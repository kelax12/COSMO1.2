// ═══════════════════════════════════════════════════════════════════
// Tableau des tâches perso : quatre colonnes de statut (mig. 214)
//
// Reçoit les tâches DÉJÀ filtrées par la page (recherche, liste, catégories),
// pour que les deux vues montrent le même sous-ensemble. Chargé en `lazy` par
// `TasksPage` : la vue Liste ne paie rien pour lui.
//
// Desktop : quatre colonnes côte à côte, glisser-déposer natif.
// Mobile : colonnes en défilement horizontal aimanté, et « Déplacer vers… »
// au lieu du glisser (le glisser HTML5 ne fonctionne pas au doigt).
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useMemo, useState } from 'react';
import type { Task, TaskStatus } from '@/modules/tasks';
import TaskModal from '@/components/TaskModal';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useT } from '@/i18n/useT';
import { BOARD_COLUMNS, groupTasksByStatus } from './board.helpers';
import { useMoveTask } from './use-move-task';
import TaskBoardColumn from './TaskBoardColumn';
import MoveTaskSheet from './MoveTaskSheet';

interface TaskBoardProps {
  tasks: Task[];
}

const TaskBoard = ({ tasks }: TaskBoardProps) => {
  const { t } = useT('tasks');
  const isMobile = useIsMobile();
  const move = useMoveTask();
  const columns = useMemo(() => groupTasksByStatus(tasks), [tasks]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Task | null>(null);

  // La fiche lit la tâche dans les données COURANTES : un déplacement ou une
  // modification faite ailleurs s'y voit tout de suite.
  const openTask = openId ? tasks.find((task) => task.id === openId) ?? null : null;

  const handleOpen = useCallback((task: Task) => setOpenId(task.id), []);
  const handleRequestMove = useCallback((task: Task) => setMoveTarget(task), []);
  const handleDrop = useCallback((taskId: string, to: TaskStatus) => {
    const task = tasks.find((x) => x.id === taskId);
    if (task) move(task, to);
  }, [tasks, move]);
  const canDrag = useCallback(() => !isMobile, [isMobile]);

  // Après un « Déplacer vers… », la carte change de colonne : le bouton qui a
  // ouvert la feuille n'existe plus, et la feuille n'a donc rien à qui rendre
  // le focus (mesuré le 2026-10-09 : `document.activeElement` = body). On le
  // pose sur la carte déplacée, dans sa nouvelle colonne.
  const moveFromSheet = useCallback((task: Task, to: TaskStatus) => {
    move(task, to);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-board-task="${task.id}"]`)?.focus();
    }, 50);
  }, [move]);

  return (
    <div role="region" aria-label={t('board.regionAria')}>
      <div className="flex md:grid md:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none pb-2 md:pb-0">
        {BOARD_COLUMNS.map((status) => (
          <div key={status} className="min-w-[82%] sm:min-w-[46%] md:min-w-0 snap-start">
            <TaskBoardColumn
              status={status}
              tasks={columns[status]}
              canDrag={canDrag}
              onOpen={handleOpen}
              onRequestMove={handleRequestMove}
              onDropTask={handleDrop}
            />
          </div>
        ))}
      </div>

      <MoveTaskSheet task={moveTarget} onClose={() => setMoveTarget(null)} onMove={moveFromSheet} />

      {openTask && (
        <TaskModal task={openTask} isOpen={!!openTask} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
};

export default TaskBoard;
