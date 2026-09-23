// ═══════════════════════════════════════════════════════════════════
// TeamTaskCardLite — carte mobile pour une tâche d'équipe fusionnée dans la
// liste perso (VirtualizedTaskList). Même jeu d'actions restreint que
// TeamTaskRowLite (bascule complété + ouverture de TeamTaskModal) — pas de
// swipe, pas d'actions perso (favoris, dupliquer, partager…).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { CalendarClock, UsersRound } from 'lucide-react';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { isTaskOverdue, projectColor, formatDuration, taskDisplayStatus } from '@/components/organization/team-projects.helpers';
import { formatDeadlineSmart, formatOverdueSince } from './helpers';
import { useT } from '@/i18n/useT';

interface TeamTaskCardLiteProps {
  task: TeamTask;
  project: TeamProject | undefined;
  onToggleComplete: (task: TeamTask) => void;
  onEdit: (task: TeamTask) => void;
}

const TeamTaskCardLiteInner = React.forwardRef<HTMLDivElement, TeamTaskCardLiteProps>(
  ({ task, project, onToggleComplete, onEdit }, ref) => {
    const { t } = useT('tasks');
    const { t: tOrg } = useT('org');
    const overdue = isTaskOverdue(task);
    const color = project ? projectColor(project.color) : projectColor('blue');
    const status = taskDisplayStatus(task);

    return (
      <div
        ref={ref}
        data-testid="team-task-card"
        // ── Maquette 88 : une tâche partagée reste une ligne comme les autres ──
        //
        // Cette ligne portait TROIS marques d'appartenance à la fois : un fond
        // indigo, une barre de couleur de projet, et une pilule de projet. À
        // quoi s'ajoutaient un titre d'un cran plus gros que celui des tâches
        // personnelles et une pastille de statut. Résultat mesuré le
        // 2026-09-19 en 390 px : dans une liste de onze lignes, la SEULE ligne
        // d'équipe était la plus voyante de l'écran, avec sa durée cassée sur
        // deux lignes — la variante rare criait plus fort que la règle.
        //
        // Il en reste UNE : le nom du projet, dit comme une catégorie l'est
        // sur `TaskCard` (point + nom dans la ligne méta). Même gabarit, même
        // hauteur, même grille.
        //
        // ❌ Ne pas réintroduire le fond teinté : il n'ajoutait rien que la
        // pastille de projet ne dise, et il entrait en conflit avec le fond de
        // sélection du mode « ajouter à une liste ».
        className="relative flex items-stretch gap-3 px-3 py-2.5 cursor-pointer border-b border-[rgb(var(--color-border-muted))]"
        style={{ minHeight: '60px', backgroundColor: 'rgb(var(--color-background))' }}
        onClick={() => onEdit(task)}
      >

        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
          className="min-w-11 min-h-11 -my-1 -ml-1 p-2 flex items-center justify-center shrink-0"
          aria-label={t('team.completeAria', { name: task.name })}
          aria-pressed={task.completed}
        >
          <span
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              task.completed
                ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]'
                : 'border-[rgb(var(--color-text-muted))]'
            }`}
          >
            {task.completed && (
              <svg className="w-4 h-4 text-[rgb(var(--color-accent-solid-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          {/* Maquette 88 : `text-label`, comme une tâche personnelle. Le cran
              au-dessus (`text-body`) est réservé au RETARD sur `TaskCard` —
              l'accorder aussi à l'appartenance à une équipe rendait les deux
              signaux indiscernables. */}
          <p className={`task-title-boost font-medium text-label leading-tight line-clamp-2 ${task.completed ? 'line-through' : ''}`} style={{ color: 'rgb(var(--color-text-primary))' }}>
            {task.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption" style={{ color: 'rgb(var(--color-text-muted))' }}>
            {/* Le projet se dit comme une catégorie : point de la couleur du
                projet + nom. L'icône « équipe » reste, en 10 px, parce que
                c'est ELLE qui distingue un projet d'une catégorie perso. */}
            <span className="inline-flex min-w-0 items-center gap-1 shrink-0">
              <UsersRound size={10} aria-hidden="true" />
              <span className={`size-2 shrink-0 rounded-full ${color.dot}`} aria-hidden="true" />
              <span className="truncate">{project?.name ?? t('team.badge')}</span>
            </span>
            <span aria-hidden="true">·</span>
            {/* Maquette 87 : « 22/09/2026 » → « lundi » / « en retard de 2 j ». */}
            {task.deadline && (
              <>
                <span className={overdue ? 'text-red-500 font-semibold inline-flex items-center gap-0.5' : 'inline-flex items-center gap-0.5'}>
                  <CalendarClock size={11} aria-hidden="true" />
                  {overdue ? formatOverdueSince(task.deadline) : formatDeadlineSmart(task.deadline)}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{formatDuration(task.estimatedTime ?? 0)}</span>
            {/* ⚠️ Le statut d'équipe (« À faire », « En cours »…) a quitté la
                ligne : il ne se lit que dans `TeamTaskModal`, où on le change.
                Sur une liste, il ajoutait un quatrième signal coloré à une
                ligne qui en portait déjà trois. Le libellé reste accessible,
                il n'est plus dessiné. */}
            <span className="sr-only">{tOrg(status.labelKey as Parameters<typeof tOrg>[0])}</span>
          </div>
        </div>

        {task.priority > 0 && (
          <div className={`self-center shrink-0 px-1.5 py-0.5 rounded-md font-bold text-caption task-priority-${task.priority}`}>
            P{task.priority}
          </div>
        )}
      </div>
    );
  },
);
TeamTaskCardLiteInner.displayName = 'TeamTaskCardLite';

export const TeamTaskCardLite = React.memo(TeamTaskCardLiteInner);
