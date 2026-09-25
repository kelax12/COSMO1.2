import { Check, RotateCcw, Trash2, X, UserPlus, FolderInput, CircleDot, UserX, Flag, CalendarClock } from 'lucide-react';
import { addDays, format, nextMonday } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTaskStatus } from '@/modules/team-projects';
import { STATUS_ORDER, STATUS_META, projectColor } from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';
import { useT } from '@/i18n/useT';

interface BulkActionsBarProps {
  count: number;
  /** Au moins une tâche sélectionnée est déjà terminée → propose « Rouvrir ». */
  hasCompleted: boolean;
  /** Au moins une tâche sélectionnée est ouverte → propose « Terminer ». */
  hasOpen: boolean;
  onComplete: () => void;
  onReopen: () => void;
  onDelete: () => void;
  /** Quitte le mode sélection (et vide la sélection au passage). */
  onExit: () => void;
  /**
   * Réassignation groupée (audit 2026-09-24) : membres À PORTÉE seulement
   * (mig. 115) — proposer un membre hors portée finirait en erreur RLS.
   */
  assignableMembers?: OrgMember[];
  /** `userId` ajouté à chaque tâche, ou `null` = retirer tous les assignés. */
  onAssign?: (userId: string | null) => void;
  /** Projets vers lesquels déplacer la sélection. */
  projects?: TeamProject[];
  onMove?: (projectId: string) => void;
  onSetStatus?: (status: TeamTaskStatus) => void;
  /** Priorité 1..5 (audit du 2026-09-24). */
  onSetPriority?: (priority: number) => void;
  /** Échéance 'YYYY-MM-DD', `''` = la retirer. */
  onSetDeadline?: (deadline: string) => void;
}

/** Date locale 'YYYY-MM-DD' — jamais `toISOString`, qui décale d'un jour le soir. */
const localDay = (d: Date) => format(d, 'yyyy-MM-dd');

const actionClass =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]';

/**
 * Barre d'actions groupées — flottante, apparaît dès qu'une tâche est
 * sélectionnée, dans TOUTES les vues de l'onglet Projets (liste, tableau,
 * planning) depuis le 2026-09-24.
 *
 * Répartir vingt tâches demandait vingt aller-retours de modal ; c'est ce que
 * cette barre supprime. Elle ne proposait que terminer, rouvrir et supprimer :
 * réassigner, déplacer et changer de statut restaient tâche par tâche.
 * Elle est positionnée au-dessus de la barre d'onglets mobile (`bottom-20` en
 * petit écran) pour ne jamais la recouvrir.
 */
const BulkActionsBar = ({
  count, hasCompleted, hasOpen, onComplete, onReopen, onDelete, onExit,
  assignableMembers = [], onAssign, projects = [], onMove, onSetStatus, onSetPriority, onSetDeadline,
}: BulkActionsBarProps) => {
  const { t, tp } = useT('org');
  const { t: ta } = useT('orgAdmin');
  // La barre reste montée même à zéro sélection : elle porte désormais la SEULE
  // sortie du mode. Disparaître ici enfermerait l'utilisateur dans un mode
  // sélection qu'il ne pourrait plus quitter tant qu'il n'aurait pas coché
  // puis décoché une tâche.

  return (
    <div
      role="toolbar"
      aria-label={count > 0 ? tp('projects.selected', count) : t('projects.selectHint')}
      className="fixed left-1/2 -translate-x-1/2 bottom-20 sm:bottom-6 z-40 flex items-center gap-1 px-2 py-2 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg max-w-[calc(100vw-2rem)] overflow-x-auto hide-scrollbar"
    >
      <span
        className={`px-2 text-sm whitespace-nowrap tabular-nums ${
          count > 0
            ? 'font-semibold text-[rgb(var(--color-text-primary))]'
            : 'text-[rgb(var(--color-text-muted))]'
        }`}
      >
        {count > 0 ? tp('projects.selected', count) : t('projects.selectHint')}
      </span>

      {count > 0 && <span className="w-px h-6 bg-[rgb(var(--color-border))] shrink-0" aria-hidden="true" />}

      {hasOpen && (
        <button type="button" onClick={onComplete} className={actionClass}>
          <Check size={15} aria-hidden="true" /> {t('projects.bulkDone')}
        </button>
      )}

      {hasCompleted && (
        <button type="button" onClick={onReopen} className={actionClass}>
          <RotateCcw size={15} aria-hidden="true" /> {t('projects.bulkReopen')}
        </button>
      )}

      {count > 0 && onAssign && (
        <DropdownMenu>
          <DropdownMenuTrigger className={actionClass}>
            <UserPlus size={15} aria-hidden="true" /> {ta('bulk.assign')}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-56 max-h-72 overflow-y-auto">
            <DropdownMenuLabel>{ta('bulk.assignTo')}</DropdownMenuLabel>
            {assignableMembers.map((m) => (
              <DropdownMenuItem key={m.userId} onClick={() => onAssign(m.userId)}>
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={20} />
                <span className="truncate">{m.displayName}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAssign(null)}>
              <UserX size={14} aria-hidden="true" /> {ta('bulk.unassignAll')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {count > 0 && onMove && projects.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger className={actionClass}>
            <FolderInput size={15} aria-hidden="true" /> {ta('bulk.move')}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-56 max-h-72 overflow-y-auto">
            <DropdownMenuLabel>{ta('bulk.moveTo')}</DropdownMenuLabel>
            {projects.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => onMove(p.id)}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${projectColor(p.color).dot}`} aria-hidden="true" />
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {count > 0 && onSetStatus && (
        <DropdownMenu>
          <DropdownMenuTrigger className={actionClass}>
            <CircleDot size={15} aria-hidden="true" /> {ta('bulk.status')}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-48">
            {STATUS_ORDER.map((st) => (
              <DropdownMenuItem key={st} onClick={() => onSetStatus(st)}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_META[st].dot}`} aria-hidden="true" />
                {t(STATUS_META[st].labelKey as Parameters<typeof t>[0])}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {count > 0 && onSetPriority && (
        <DropdownMenu>
          <DropdownMenuTrigger className={actionClass}>
            <Flag size={15} aria-hidden="true" /> {ta('bulk.priority')}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-40">
            {[1, 2, 3, 4, 5].map((p) => (
              <DropdownMenuItem key={p} onClick={() => onSetPriority(p)}>
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-caption font-bold task-priority-${p}`}>{p}</span>
                {ta('bulk.priorityLevel', { level: p })}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {count > 0 && onSetDeadline && (
        <DropdownMenu>
          <DropdownMenuTrigger className={actionClass}>
            <CalendarClock size={15} aria-hidden="true" /> {ta('bulk.deadline')}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-48">
            <DropdownMenuItem onClick={() => onSetDeadline(localDay(new Date()))}>{ta('bulk.deadlineToday')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetDeadline(localDay(addDays(new Date(), 1)))}>{ta('bulk.deadlineTomorrow')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetDeadline(localDay(nextMonday(new Date())))}>{ta('bulk.deadlineNextWeek')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetDeadline(localDay(addDays(new Date(), 30)))}>{ta('bulk.deadlineMonth')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSetDeadline('')}>{ta('bulk.deadlineClear')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {count > 0 && (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors whitespace-nowrap"
        >
          <Trash2 size={15} aria-hidden="true" /> {t('projects.bulkDelete')}
        </button>
      )}

      <button
        type="button"
        onClick={onExit}
        aria-label={t('projects.selectExit')}
        title={t('projects.selectExit')}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default BulkActionsBar;
