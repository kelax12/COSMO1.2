import { useState } from 'react';
import { Bell, BellOff, Trash2, UsersRound } from 'lucide-react';
import type { OrgTeam } from '@/modules/org-teams';
import {
  useMyFollows,
  usePurgeArchivedProject,
  useTeamProjectTeams,
  useToggleFollow,
  type TeamProject,
} from '@/modules/team-projects';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useT } from '@/i18n/useT';

interface ProjectAudienceActionsProps {
  project: TeamProject;
  teams: OrgTeam[];
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
 *   principale reste celle de la carte. Elles s'ajoutent depuis la popup
 *   « Ajouter au projet » de l'en-tête (le bouton « Équipes du projet » est
 *   retiré le 2026-10-13).
 * - **Suivre** (M14) : être prévenu d'un projet sans y avoir de tâche.
 * - **Supprimer définitivement** un projet archivé : l'application n'avait
 *   que l'archivage, rien pour purger proprement. Irréversible, donc saisie du
 *   nom (modèle de `DeleteOrganizationDialog`).
 */
const ProjectAudienceActions = ({
  project, teams, canPurge, taskCount, onPurged,
}: ProjectAudienceActionsProps) => {
  const { t } = useT('org');
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const { data: links = [] } = useTeamProjectTeams(project.orgId);
  const { data: follows } = useMyFollows(project.orgId);
  const toggleFollow = useToggleFollow(project.orgId);
  const purge = usePurgeArchivedProject(project.orgId);
  const [purging, setPurging] = useState(false);

  const archived = !!project.archivedAt;
  const followed = follows?.projectIds.includes(project.id) ?? false;
  const associatedIds = new Set(links.filter((l) => l.projectId === project.id).map((l) => l.teamId));
  const associated = teams.filter((tm) => associatedIds.has(tm.id));
  return (
    <>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {associated.map((tm) => (
          <span key={tm.id} className={chip}>
            <UsersRound size={11} aria-hidden="true" /> {tm.name}
          </span>
        ))}
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

      {purging && (
        <OrgConfirmDialog
          title={ta('projectPurge.title', { name: project.name })}
          impact={[
            ...(taskCount > 0 ? [tpa('projectPurge.impactTasks', taskCount)] : []),
            ta('projectPurge.impactLinks'),
            ta('projectPurge.impactIrreversible'),
          ]}
          confirmLabel={ta('projectPurge.confirm')}
          pending={purge.isPending}
          requireName={project.name}
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
