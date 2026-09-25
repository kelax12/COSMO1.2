import { useState } from 'react';
import { Bell, BellOff, Trash2, UsersRound, X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OrgTeam } from '@/modules/org-teams';
import {
  useAddProjectTeam,
  useMyFollows,
  usePurgeArchivedProject,
  useRemoveProjectTeam,
  useTeamProjectTeams,
  useToggleFollow,
  type TeamProject,
} from '@/modules/team-projects';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useT } from '@/i18n/useT';

interface ProjectAudienceActionsProps {
  project: TeamProject;
  teams: OrgTeam[];
  /** `project.edit` : associer ou retirer une équipe change QUI LIT le projet (M5). */
  canManageAudience: boolean;
  /** `project.delete` : purger un projet archivé. */
  canPurge: boolean;
  /** Tâches du projet, pour annoncer ce que la purge emporte. */
  taskCount: number;
  onPurged: () => void;
}

const chip = 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))]';
const actionBtn =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors';

/**
 * Trois gestes que la page projet ne proposait pas (audit du 2026-09-24) :
 *
 * - **Projet mené par plusieurs équipes** : une seule `team_id` ne suffisait
 *   pas. Des équipes ASSOCIÉES (mig. 164) élargissent la lecture ; l'équipe
 *   principale reste celle de la carte, et ne change que par
 *   `ConfirmProjectAudienceDialog`.
 * - **Suivre** (M14) : être prévenu d'un projet sans y avoir de tâche.
 * - **Supprimer définitivement** un projet archivé : l'application n'avait
 *   que l'archivage, rien pour purger proprement. Irréversible, donc saisie du
 *   nom (modèle de `DeleteOrganizationDialog`).
 */
const ProjectAudienceActions = ({
  project, teams, canManageAudience, canPurge, taskCount, onPurged,
}: ProjectAudienceActionsProps) => {
  const { t } = useT('org');
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const { data: links = [] } = useTeamProjectTeams(project.orgId);
  const { data: follows } = useMyFollows(project.orgId);
  const toggleFollow = useToggleFollow(project.orgId);
  const addTeam = useAddProjectTeam(project.orgId);
  const removeTeam = useRemoveProjectTeam(project.orgId);
  const purge = usePurgeArchivedProject(project.orgId);
  const [managing, setManaging] = useState(false);
  const [confirmAdd, setConfirmAdd] = useState<OrgTeam | null>(null);
  const [purging, setPurging] = useState(false);

  const archived = !!project.archivedAt;
  const followed = follows?.projectIds.includes(project.id) ?? false;
  const associatedIds = new Set(links.filter((l) => l.projectId === project.id).map((l) => l.teamId));
  const associated = teams.filter((tm) => associatedIds.has(tm.id));
  // Un projet d'entreprise (`team_id` nul) est déjà lu par tous : y associer
  // une équipe ne changerait rien, le geste n'est pas proposé.
  const addable = project.teamId
    ? teams.filter((tm) => tm.id !== project.teamId && !associatedIds.has(tm.id))
    : [];

  return (
    <>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {associated.map((tm) => (
          <span key={tm.id} className={chip}>
            <UsersRound size={11} aria-hidden="true" /> {tm.name}
          </span>
        ))}
        {canManageAudience && project.teamId && !archived && (
          <button type="button" onClick={() => setManaging(true)} className={actionBtn}>
            <UsersRound size={14} aria-hidden="true" /> {ta('projectTeams.manage')}
          </button>
        )}
        <button
          type="button"
          aria-pressed={followed}
          onClick={() => toggleFollow.mutate({ target: 'project', id: project.id, follow: !followed })}
          className={actionBtn}
        >
          {followed ? <BellOff size={14} aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
          {t(followed ? 'follow.unfollow' : 'follow.follow')}
        </button>
        {canPurge && archived && (
          <button
            type="button"
            onClick={() => setPurging(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-red-500 border border-red-300/60 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} aria-hidden="true" /> {ta('projectPurge.action')}
          </button>
        )}
      </div>

      <Dialog open={managing} onOpenChange={setManaging}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ta('projectTeams.title', { name: project.name })}</DialogTitle>
            <DialogDescription>{ta('projectTeams.description')}</DialogDescription>
          </DialogHeader>
          {associated.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">{ta('projectTeams.none')}</p>
          ) : (
            <ul className="divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
              {associated.map((tm) => (
                <li key={tm.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 text-sm text-[rgb(var(--color-text-primary))] truncate">{tm.name}</span>
                  <button
                    type="button"
                    onClick={() => removeTeam.mutate({ projectId: project.id, teamId: tm.id })}
                    aria-label={ta('projectTeams.remove', { team: tm.name })}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {addable.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">{ta('projectTeams.add')}</p>
              <div className="flex flex-wrap gap-1.5">
                {addable.map((tm) => (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => setConfirmAdd(tm)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent))]"
                  >
                    <Plus size={11} aria-hidden="true" /> {tm.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {confirmAdd && (
        <OrgConfirmDialog
          title={ta('projectTeams.confirmTitle', { team: confirmAdd.name })}
          description={ta('projectTeams.confirmBody', { team: confirmAdd.name, project: project.name })}
          confirmLabel={ta('projectTeams.confirm')}
          tone="accent"
          pending={addTeam.isPending}
          onConfirm={() =>
            addTeam.mutate(
              { projectId: project.id, teamId: confirmAdd.id },
              { onSettled: () => setConfirmAdd(null) },
            )
          }
          onCancel={() => setConfirmAdd(null)}
        />
      )}

      {purging && (
        <OrgConfirmDialog
          title={ta('projectPurge.title', { name: project.name })}
          impact={[
            ...(taskCount > 0 ? [tpa('projectPurge.impactTasks', taskCount)] : []),
            ta('projectPurge.impactMilestones'),
            ta('projectPurge.impactIrreversible'),
          ]}
          confirmLabel={ta('projectPurge.confirm')}
          pending={purge.isPending}
          requireText={project.name}
          onConfirm={() =>
            purge.mutate(project.id, {
              onSuccess: () => { setPurging(false); onPurged(); },
            })
          }
          onCancel={() => setPurging(false)}
        />
      )}
    </>
  );
};

export default ProjectAudienceActions;
