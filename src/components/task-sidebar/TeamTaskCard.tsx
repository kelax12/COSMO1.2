// Carte d'une tâche d'équipe assignée, dans le panneau de tâches à glisser
// de l'Agenda (TaskSidebar). Extraite de TaskSidebar (frontière C-09 :
// une SURFACE complète — rendu + payload de drag — plutôt qu'une coupe à la
// ligne près).
//
// ⚠️ Distincte de la carte perso : bordure pointillée, icône `Building2`,
// pas de menu contextuel (édition/suppression d'une tâche d'équipe passe par
// le mode entreprise, pas par ce panneau), pas d'état « déjà planifiée »
// (rien ne relie aujourd'hui un événement perso à une tâche d'équipe).
import React from 'react';
import { Building2, Clock } from 'lucide-react';
import type { TeamTask } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

interface TeamTaskCardProps {
  task: TeamTask;
  categoryColor: string;
  categoryName: string;
  priorityClassName: string;
  formatDuration: (minutes: number | undefined) => string;
  onDragStart?: () => void;
  isFirst: boolean;
}

const TeamTaskCard: React.FC<TeamTaskCardProps> = ({
  task, categoryColor, categoryName, priorityClassName, formatDuration, onDragStart, isFirst,
}) => {
  const { t } = useT('agenda');

  // Payload de drag consommé par `AgendaPage` (Draggable.eventData, via
  // `resolveDraggedTaskEventData`) : couleur/nom de catégorie déjà résolus
  // ICI (ce composant connaît à la fois les catégories perso ET d'équipe),
  // pour qu'`AgendaPage` n'ait pas besoin de connaître `team_categories`.
  const dragPayload = {
    id: task.id,
    name: task.name,
    priority: task.priority,
    estimatedTime: task.estimatedTime,
    categoryColor,
    categoryName,
    // 🔴 PAS de `taskId` réutilisable côté `events.task_id` : cette colonne
    // porte une FK vers `tasks` (perso), jamais vers `team_tasks`
    // (migration 004) — un id d'équipe la ferait échouer. `source: 'pro'`
    // dit à `handleEventReceive` de ne jamais l'assigner
    // (cf. useCalendarGridGestures.ts).
    source: 'pro' as const,
  };

  return (
    <div
      data-tutorial-id={isFirst ? 'agenda-first-task' : undefined}
      className="external-event rounded-lg p-3 border-2 border-dashed group select-none cursor-move hover:shadow-md"
      style={{
        backgroundColor: 'rgb(var(--color-surface))',
        borderColor: 'rgb(var(--color-border))',
        borderLeftWidth: '4px',
        borderLeftStyle: 'solid',
        borderLeftColor: categoryColor,
        position: 'relative',
        touchAction: 'pan-y',
        transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgb(var(--color-surface))')}
      onPointerDown={() => onDragStart?.()}
      data-task={JSON.stringify(dragPayload)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 size={14} className="shrink-0" style={{ color: categoryColor }} aria-label={t('sidebar.proTaskBadge')} />
          <span className="font-medium text-sm truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{task.name}</span>
        </div>
        {task.priority > 0 && (
          <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${priorityClassName}`}>
            P{task.priority}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{formatDuration(task.estimatedTime)}</span>
        </div>
        <span className="text-xs px-2 py-1 rounded border" style={{
          backgroundColor: 'rgb(var(--color-surface))',
          borderColor: 'rgb(var(--color-border))',
          color: 'rgb(var(--color-text-secondary))',
        }}>
          {categoryName}
        </span>
      </div>

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
    </div>
  );
};

export default TeamTaskCard;
