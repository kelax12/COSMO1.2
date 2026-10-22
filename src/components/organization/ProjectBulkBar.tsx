import { useState } from 'react';
import { Activity, Archive, CircleDot, Trash2, UserRound, X } from 'lucide-react';
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
import { teamProjectKeys, type TeamProject, type TeamProjectHealth, type TeamProjectStatus } from '@/modules/team-projects';
import { PROJECT_STATUSES } from './portfolio.helpers';
import MemberAvatar from './MemberAvatar';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useBulkRun } from './use-bulk-run';
import { HEALTH_DOT, HEALTHS } from './health-state.helpers';
import { useT } from '@/i18n/useT';

interface ProjectBulkBarProps {
  selected: TeamProject[];
  members: OrgMember[];
  /** `project.edit` : statut et responsable. */
  canEdit: boolean;
  /** `project.delete` : archiver, et supprimer définitivement. */
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

  // État (même menu que les KR) : « Atteint » passe par le statut « Terminé ».
  const setHealth = (health: TeamProjectHealth) =>
    void execute(selected.filter((p) => (p.health ?? null) !== health), (p) => repo().updateProject(p.id, { health })).then(onDone);

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

  // Suppression définitive : l'archivage d'abord (la RPC de purge refuse un
  // projet actif), puis `purge_archived_team_project`. Irréversible, donc
  // confirmée par saisie, jamais annulable par toast.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteForever = () => {
    const targets = [...selected];
    void execute(targets, async (p) => {
      if (!p.archivedAt) await repo().updateProject(p.id, { archived: true });
      await repo().purgeArchivedProject(p.id);
    }).then(() => { setConfirmDelete(false); onDone(); });
  };

  return (
    <>
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
              <Activity size={15} aria-hidden="true" /> {pf('krExec.statusLabel')}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" className="w-48">
              {HEALTHS.map((h) => (
                <DropdownMenuItem key={h} onClick={() => setHealth(h)}>
                  <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[h]}`} aria-hidden="true" />
                  {pf(`health.${h}`)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => setStatus('done')}>
                <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                {pf('okrFilters.stateDone')}
              </DropdownMenuItem>
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
      {selected.length > 0 && canArchive && (
        <button type="button" className={`${actionClass} !text-red-500 hover:!bg-red-500/10`} disabled={pending} onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} aria-hidden="true" /> {ta('bulk.delete')}
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
    {confirmDelete && (
      <OrgConfirmDialog
        title={tpa('bulk.deleteProjectsTitle', selected.length)}
        impact={[ta('projectPurge.impactLinks'), ta('projectPurge.impactIrreversible')]}
        confirmLabel={ta('projectPurge.confirm')}
        pending={pending}
        requireName={ta('bulk.deleteWord')}
        onConfirm={deleteForever}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  );
};

export default ProjectBulkBar;
