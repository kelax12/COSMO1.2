import { Archive, CircleDot, UserRound, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { showUndoToast } from '@/lib/undo-toast';
import type { OrgMember } from '@/modules/organizations';
import { teamProjectKeys, type TeamProject, type TeamProjectStatus } from '@/modules/team-projects';
import { PROJECT_STATUSES } from './portfolio.helpers';
import MemberAvatar from './MemberAvatar';
import { useBulkRun } from './use-bulk-run';
import { useT } from '@/i18n/useT';

interface ProjectBulkBarProps {
  selected: TeamProject[];
  members: OrgMember[];
  /** `project.edit` : statut et responsable. */
  canEdit: boolean;
  /** `project.delete` : archiver. */
  canArchive: boolean;
  onDone: () => void;
  onExit: () => void;
}

const actionClass =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors whitespace-nowrap disabled:opacity-50';

/**
 * Actions groupées sur les PROJETS (audit du 2026-09-24, « changement de
 * configuration en masse »). Chaque geste n'apparaît qu'avec son droit : on ne
 * propose pas ce que le serveur refuserait (même règle que les menus « … »).
 *
 * L'archivage a son « Annuler » : c'est la cohérence retenue pour tout le mode
 * entreprise — un geste réversible s'annule, un geste irréversible se confirme.
 */
const ProjectBulkBar = ({ selected, members, canEdit, canArchive, onDone, onExit }: ProjectBulkBarProps) => {
  const { t } = useT('org');
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const { t: pf } = useT('portfolio');
  const { execute, pending } = useBulkRun([teamProjectKeys.all]);
  const repo = () => getTeamProjectsRepository();

  const setStatus = (status: TeamProjectStatus) =>
    void execute(selected.filter((p) => p.status !== status), (p) => repo().updateProject(p.id, { status })).then(onDone);

  const setOwner = (ownerId: string | null) =>
    void execute(selected.filter((p) => (p.ownerId ?? null) !== ownerId), (p) => repo().updateProject(p.id, { ownerId })).then(onDone);

  const archive = () => {
    const targets = selected.filter((p) => !p.archivedAt);
    void execute(targets, (p) => repo().updateProject(p.id, { archived: true })).then(({ done }) => {
      onDone();
      if (done > 0) {
        showUndoToast(tpa('bulk.projectsArchived', done), () =>
          void execute(targets, (p) => repo().updateProject(p.id, { archived: false })));
      }
    });
  };

  return (
    <div
      role="toolbar"
      aria-label={selected.length > 0 ? tpa('bulk.projectsSelected', selected.length) : ta('bulk.projectsSelectHint')}
      className="fixed left-1/2 -translate-x-1/2 bottom-20 sm:bottom-6 z-40 flex items-center gap-1 px-2 py-2 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg max-w-[calc(100vw-2rem)] overflow-x-auto hide-scrollbar"
    >
      <span className="px-2 text-sm whitespace-nowrap tabular-nums font-semibold text-[rgb(var(--color-text-primary))]">
        {selected.length > 0 ? tpa('bulk.projectsSelected', selected.length) : ta('bulk.projectsSelectHint')}
      </span>
      {selected.length > 0 && canEdit && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger className={actionClass} disabled={pending}>
              <CircleDot size={15} aria-hidden="true" /> {ta('bulk.status')}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" className="w-48">
              {PROJECT_STATUSES.map((st) => (
                <DropdownMenuItem key={st} onClick={() => setStatus(st)}>{pf(`status.${st}`)}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className={actionClass} disabled={pending}>
              <UserRound size={15} aria-hidden="true" /> {ta('bulk.owner')}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" className="w-60 max-h-72 overflow-y-auto">
              <DropdownMenuLabel>{ta('bulk.owner')}</DropdownMenuLabel>
              {members.map((m) => (
                <DropdownMenuItem key={m.userId} onClick={() => setOwner(m.userId)}>
                  <MemberAvatar avatar={m.avatar} name={m.displayName} size={20} />
                  <span className="truncate">{m.displayName}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOwner(null)}>{pf('noOwner')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      {selected.length > 0 && canArchive && (
        <button type="button" className={actionClass} disabled={pending} onClick={archive}>
          <Archive size={15} aria-hidden="true" /> {t('project.archive')}
        </button>
      )}
      <button
        type="button"
        onClick={onExit}
        aria-label={ta('bulk.exit')}
        title={ta('bulk.exit')}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default ProjectBulkBar;
