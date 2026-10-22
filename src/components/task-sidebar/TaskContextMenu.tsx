// Menu contextuel (long-press mobile / clic droit desktop / bouton "...")
// d'une carte tâche de TaskSidebar. Extrait de TaskSidebar (frontière C-09 :
// une SURFACE complète, montée une seule fois via portal) — perso
// uniquement, une tâche d'équipe n'a pas ce menu ici (cf. TeamTaskCard).
import React from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Copy, CalendarX, Trash2 } from 'lucide-react';
import type { Task } from '@/modules/tasks';
import { useT } from '@/i18n/useT';

export interface ContextMenuState { task: Task; x: number; y: number }

interface TaskContextMenuProps {
  contextMenu: ContextMenuState;
  isLinkedToCalendar: boolean;
  linkedEventCount: number;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onDeleteLinkedEvents: (task: Task) => void;
  onDelete: (task: Task) => void;
}

const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  contextMenu, isLinkedToCalendar, linkedEventCount, onEdit, onDuplicate, onDeleteLinkedEvents, onDelete,
}) => {
  const { t, tp } = useT('agenda');

  return createPortal(
    <div
      className="fixed z-[9999] min-w-[200px] rounded-xl border shadow-2xl overflow-hidden py-1"
      style={{
        top: contextMenu.y,
        left: contextMenu.x,
        backgroundColor: 'rgb(var(--color-surface))',
        borderColor: 'rgb(var(--color-border))',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onEdit(contextMenu.task)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[rgb(var(--color-hover))]"
        style={{ color: 'rgb(var(--color-text-primary))' }}
      >
        <Pencil size={16} className="text-blue-500 shrink-0" />
        {t('sidebar.editTask')}
      </button>
      <button
        type="button"
        onClick={() => onDuplicate(contextMenu.task)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[rgb(var(--color-hover))]"
        style={{ color: 'rgb(var(--color-text-primary))' }}
      >
        <Copy size={16} className="text-blue-500 shrink-0" />
        {t('sidebar.duplicateTask')}
      </button>
      {isLinkedToCalendar && (
        <button
          type="button"
          onClick={() => onDeleteLinkedEvents(contextMenu.task)}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[rgb(var(--color-hover))]"
          style={{ color: 'rgb(var(--color-text-primary))' }}
        >
          <CalendarX size={16} className="text-orange-500 shrink-0" />
          {tp('sidebar.deleteLinkedEvents', linkedEventCount)}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDelete(contextMenu.task)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
      >
        <Trash2 size={16} className="shrink-0" />
        {t('sidebar.deleteTask')}
      </button>
    </div>,
    document.body,
  );
};

export default TaskContextMenu;
