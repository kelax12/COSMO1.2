// Carte d'une tâche PERSO, dans le panneau de tâches à glisser de l'Agenda
// (TaskSidebar). Extraite de TaskSidebar (frontière C-09 : une SURFACE
// complète — rendu + interactions de drag/long-press/menu — plutôt qu'une
// coupe à la ligne près).
//
// FRONTIÈRE : ce composant ne possède ni le menu contextuel (rendu par
// `TaskContextMenu`, monté une seule fois par TaskSidebar via portal), ni la
// modale d'édition — il ne fait que déclencher leur ouverture via les props.
import React from 'react';
import { Bookmark, CalendarDays, CheckCircle2, Clock, MoreHorizontal } from 'lucide-react';
import type { Task } from '@/modules/tasks';
import type { Friend } from '@/modules/friends';
import CollaboratorAvatars from '../CollaboratorAvatars';
import { formatDate } from '@/i18n/format';
import { deadlineLocalDate } from '@/lib/deadline';
import { useT } from '@/i18n/useT';

interface PersonalTaskCardProps {
  task: Task;
  isPlaced: boolean;
  isFirst: boolean;
  categoryColor: string;
  priorityClassName: string;
  collaboratorIds: string[];
  friends: Friend[];
  formatDuration: (minutes: number | undefined) => string;
  onOpen: () => void;
  onOpenContextMenu: (x: number, y: number) => void;
  onDragStart?: () => void;
  onLongPressStart: (e: React.PointerEvent) => void;
  onPressMove: (e: React.PointerEvent) => void;
  onPressEnd: () => void;
}

const PersonalTaskCard: React.FC<PersonalTaskCardProps> = ({
  task, isPlaced, isFirst, categoryColor, priorityClassName,
  collaboratorIds, friends, formatDuration, onOpen, onOpenContextMenu,
  onDragStart, onLongPressStart, onPressMove, onPressEnd,
}) => {
  const { t } = useT('agenda');
  const deadlineDate = task.deadline ? formatDate(deadlineLocalDate(task.deadline) ?? new Date()) : '';
  const deadlineText = t('sidebar.deadline', { date: deadlineDate });

  return (
    <div
      data-tutorial-id={isFirst ? 'agenda-first-task' : undefined}
      onClick={onOpen}
      onContextMenu={(e) => {
        // Clic droit (desktop) → menu contextuel.
        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - 220);
        const y = Math.min(e.clientY, window.innerHeight - 200);
        onOpenContextMenu(Math.max(8, x), Math.max(8, y));
      }}
      className={`external-event rounded-lg py-3 pr-3 pl-5 border group select-none ${
        isPlaced ? 'opacity-50 cursor-not-allowed' : 'cursor-move hover:shadow-md'
      }`}
      style={{
        backgroundColor: isPlaced ? 'rgb(var(--color-hover))' : 'rgb(var(--color-surface))',
        borderColor: 'rgb(var(--color-border))',
        position: 'relative',
        // pan-y : permet le scroll vertical tactile de la liste sans capturer
        // le geste comme une sélection/drag (bug scroll mobile).
        touchAction: 'pan-y',
        transition: isPlaced ? 'none' : 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => !isPlaced && (e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))')}
      onMouseLeave={(e) => !isPlaced && (e.currentTarget.style.backgroundColor = 'rgb(var(--color-surface))')}
      onPointerDown={(e) => { if (!isPlaced) onDragStart?.(); onLongPressStart(e); }}
      onPointerMove={onPressMove}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      data-task={JSON.stringify({ ...task, source: 'perso' })}
    >
      {isPlaced && (
        <div className="absolute inset-0 bg-black bg-opacity-10 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-[rgb(var(--color-surface))] rounded-full p-2 shadow-lg">
            <CheckCircle2 size={24} className="text-green-500" />
          </div>
        </div>
      )}

      {/* Barre colorée interne (couleur de la catégorie), à la place de la bordure gauche. */}
      <span
        aria-hidden="true"
        className="absolute left-2 top-2.5 bottom-2.5 w-1 rounded-full pointer-events-none"
        style={{ backgroundColor: categoryColor }}
      />

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-medium text-sm truncate ${isPlaced ? 'line-through' : ''}`} style={{ color: 'rgb(var(--color-text-primary))' }}>{task.name}</span>
          {task.bookmarked && (
            <Bookmark size={14} className="favorite-icon filled shrink-0" />
          )}
        </div>
        {collaboratorIds.length > 0 && (
          <CollaboratorAvatars collaboratorIds={collaboratorIds} friends={friends} size="sm" />
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>
        <span
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border whitespace-nowrap"
          style={{ borderColor: 'rgb(var(--color-border))' }}
          title={task.deadline ? deadlineText : undefined}
        >
          <CalendarDays size={12} aria-hidden="true" />
          {task.deadline ? deadlineDate : t('sidebar.noDeadline')}
        </span>
        <span
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border whitespace-nowrap"
          style={{ borderColor: 'rgb(var(--color-border))' }}
        >
          <Clock size={12} aria-hidden="true" />
          {formatDuration(task.estimatedTime)}
        </span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {task.priority > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityClassName}`}>
              P{task.priority}
            </span>
          )}
          {/* Point d'entrée VISIBLE vers le menu d'options (= long-press / clic droit).
              Toujours visible sur mobile, au survol sur desktop. */}
          <button
            type="button"
            aria-label={t('sidebar.taskOptions')}
            onPointerDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const x = Math.min(r.right - 200, window.innerWidth - 220);
              const y = Math.min(r.bottom + 4, window.innerHeight - 220);
              onOpenContextMenu(Math.max(8, x), Math.max(8, y));
            }}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-[rgb(var(--color-hover))]"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Drag indicator — masqué par défaut (n'occupe aucune place) et
          révélé au survol de la carte, pour supprimer l'espace vide sous la
          deadline hors survol. Animation grid-rows 0fr→1fr (+ fondu) pour une
          apparition/disparition progressive plutôt qu'un hidden/block abrupt. */}
      {!isPlaced ? (
        <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out">
          <div className="overflow-hidden">
            <div
              className="mt-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-hover:delay-75"
              style={{ color: 'rgb(var(--color-accent))' }}
            >
              {t('sidebar.dragHint')}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-xs font-semibold" style={{ color: 'rgb(var(--color-success))' }}>
          {t('sidebar.alreadyScheduled')}
        </div>
      )}
    </div>
  );
};

export default PersonalTaskCard;
