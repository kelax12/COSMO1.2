import { useState } from 'react';
import { Trash2, UsersRound, X } from 'lucide-react';
import type { OrgTeam } from '@/modules/org-teams';
import {
  usePurgeArchivedProject,
  useRemoveProjectTeam,
  useTeamProjectTeams,
  type TeamProject,
} from '@/modules/team-projects';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useT } from '@/i18n/useT';

interface ProjectAudienceActionsProps {
  project: TeamProject;
  teams: OrgTeam[];
  /** Même garde que l'ajout depuis « Ajouter au projet » : retirer une équipe change QUI LIT le projet. */
  canManageTeams: boolean;
  /** `project.delete` : purger un projet archivé. */
  canPurge: boolean;
  /** Tâches du projet, pour annoncer ce que la purge emporte. */
  taskCount: number;
  onPurged: () => void;
}

const chip = 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))]';

/**
 * Trois gestes que la page projet ne proposait pas (audit du 2026-09-24) :
 *
 * - **Projet mené par plusieurs équipes** : une seule `team_id` ne suffisait
 *   pas. Des équipes ASSOCIÉES (mig. 164) élargissent la lecture ; l'équipe
 *   principale reste celle de la carte. Elles s'ajoutent depuis la popup
 *   « Ajouter au projet » de l'en-tête (le bouton « Équipes du projet » est
 *   retiré le 2026-10-13). Elles se retirent par la croix de leur pastille :
 *   sans elle, rien ne défaisait un ajout depuis ce retrait.
 * - **Suivre** (M14) : déplacé dans la barre d'actions de l'en-tête le 2026-10-13.
 * - **Supprimer définitivement** un projet archivé : l'application n'avait
 *   que l'archivage, rien pour purger proprement. Irréversible, donc saisie du
 *   nom (modèle de `DeleteOrganizationDialog`).
 */
const ProjectAudienceActions = ({
  project, teams, canManageTeams, canPurge, taskCount, onPurged,
}: ProjectAudienceActionsProps) => {
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const { data: links = [] } = useTeamProjectTeams(project.orgId);
  const removeTeam = useRemoveProjectTeam(project.orgId);
  const purge = usePurgeArchivedProject(project.orgId);
  const [purging, setPurging] = useState(false);

  const archived = !!project.archivedAt;
  const associatedIds = new Set(links.filter((l) => l.projectId === project.id).map((l) => l.teamId));
  const associated = teams.filter((tm) => associatedIds.has(tm.id));
  return (
    <>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {associated.map((tm) => (
          <span key={tm.id} className={chip}>
            <UsersRound size={11} aria-hidden="true" /> {tm.name}
            {canManageTeams && !archived && (
              <button
                type="button"
                onClick={() => removeTeam.mutate({ projectId: project.id, teamId: tm.id })}
                disabled={removeTeam.isPending}
                aria-label={ta('projectTeams.remove', { team: tm.name })}
                title={ta('projectTeams.remove', { team: tm.name })}
                className="-mr-1 w-4 h-4 rounded-full flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
              >
                <X size={11} aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
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
