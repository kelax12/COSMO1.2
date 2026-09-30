// Membres d'un projet et leur rôle (mig. 190) — co-pilote, contributeur,
// lecteur. Être membre rend un projet VISIBLE, même hors de son équipe : c'est
// ainsi qu'on ouvre UN projet cloisonné à un prestataire, sans lui ouvrir les
// autres. Le rôle élargit (contributeur) ou restreint (lecteur) les droits
// d'organisation sur CE projet seulement ; un admin n'est jamais restreint.

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  useSetProjectMember, useRemoveProjectMember, useAddProjectTeam, useTeamProjectTeams,
  type TeamProject, type TeamProjectMember, type TeamProjectRole,
} from '@/modules/team-projects';
import { isMemberActive, type OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import type { OrgTeam } from '@/modules/org-teams';
import MemberSelectField from './MemberSelectField';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useT } from '@/i18n/useT';
import MenuSelect from '@/components/organization/MenuSelect';

const ROLES: TeamProjectRole[] = ['lead', 'contributor', 'viewer'];

interface ProjectMembersSectionProps {
  project: TeamProject;
  /** Membres de CE projet (déjà filtrés). */
  projectMembers: TeamProjectMember[];
  orgMembers: OrgMember[];
  /** Piloter le projet : `project.edit`, responsable, ou co-pilote. */
  canManage: boolean;
  currentUserId?: string;
  /** Équipes de l'organisation, pour associer une équipe au projet (mig. 164). */
  teams: OrgTeam[];
}

const selectCls = 'rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] h-9 px-3 text-sm text-[rgb(var(--color-text-primary))]';

const ProjectMembersSection = ({ project, projectMembers, orgMembers, canManage, currentUserId, teams }: ProjectMembersSectionProps) => {
  const { t: pf } = useT('portfolio');
  const setMember = useSetProjectMember(project.orgId);
  const removeMember = useRemoveProjectMember(project.orgId);
  const { t: ta } = useT('orgAdmin');
  const addTeam = useAddProjectTeam(project.orgId);
  const { data: links = [] } = useTeamProjectTeams(project.orgId);
  const [confirmTeam, setConfirmTeam] = useState<OrgTeam | null>(null);

  const byId = useMemo(() => new Map(orgMembers.map((m) => [m.userId, m])), [orgMembers]);
  const rows = useMemo(
    () => [...projectMembers].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role)
      || (byId.get(a.userId)?.displayName ?? '').localeCompare(byId.get(b.userId)?.displayName ?? '')),
    [projectMembers, byId],
  );
  // Candidats : membres actifs de l'organisation, pas déjà dans le projet, ni
  // le responsable (il pilote déjà).
  const candidates = useMemo(() => {
    const inProject = new Set(projectMembers.map((m) => m.userId));
    return orgMembers.filter((m) => !inProject.has(m.userId) && m.userId !== project.ownerId && isMemberActive(m));
  }, [orgMembers, projectMembers, project.ownerId]);

  // Un projet d'entreprise (`team_id` nul) est déjà lu par tous : y associer
  // une équipe ne changerait rien, le choix n'est pas proposé.
  const addableTeams = useMemo(() => {
    if (!project.teamId) return [];
    const linked = new Set(links.filter((l) => l.projectId === project.id).map((l) => l.teamId));
    return teams.filter((tm) => tm.id !== project.teamId && !linked.has(tm.id));
  }, [teams, links, project.id, project.teamId]);

  // Ajout direct au choix, rôle contributeur : il se change ensuite dans la liste.
  const addMember = (userId: string) => {
    if (userId) setMember.mutate({ projectId: project.id, userId, role: 'contributor' });
  };

  return (
    <section aria-labelledby={`project-members-${project.id}`} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 id={`project-members-${project.id}`} className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
        {pf('members.title')}
      </h3>

      {rows.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {rows.map((pm) => {
            const m = byId.get(pm.userId);
            const name = m?.displayName ?? pf('members.formerMember');
            const self = pm.userId === currentUserId;
            return (
              <li key={pm.userId} className="flex items-center gap-2">
                <MemberAvatar avatar={m?.avatar} name={name} size={20} />
                <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">
                  {name}{self && <span className="text-[rgb(var(--color-text-muted))]"> · {pf('members.you')}</span>}
                </span>
                {canManage ? (
                  <MenuSelect
                    value={pm.role}
                    aria-label={pf('members.roleOf', { name })}
                    onChange={(e) => setMember.mutate({ projectId: project.id, userId: pm.userId, role: e.target.value as TeamProjectRole })}
                    className={selectCls}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{pf(`members.role.${r}`)}</option>)}
                  </MenuSelect>
                ) : (
                  <span className="text-xs font-semibold text-[rgb(var(--color-text-secondary))]">{pf(`members.role.${pm.role}`)}</span>
                )}
                {(canManage || self) && (
                  <button
                    type="button"
                    onClick={() => removeMember.mutate({ projectId: project.id, userId: pm.userId })}
                    aria-label={self ? pf('members.leave') : pf('members.remove', { name })}
                    title={self ? pf('members.leave') : pf('members.remove', { name })}
                    className="p-1 rounded-md text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-[rgb(var(--color-hover))]"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (candidates.length > 0 || addableTeams.length > 0) && (
        <div className="space-y-3">
          {candidates.length > 0 && (
            <MemberSelectField
              label={pf('members.addMember')}
              members={candidates}
              value=""
              onChange={addMember}
              emptyLabel={pf('members.choose')}
            />
          )}
          {addableTeams.length > 0 && (
            <label className="block">
              <span className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{pf('members.addTeam')}</span>
              <MenuSelect
                value=""
                onChange={(e) => setConfirmTeam(addableTeams.find((tm) => tm.id === e.target.value) ?? null)}
                className={`${selectCls} w-full py-2`}
              >
                <option value="">{pf('members.choose')}</option>
                {addableTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
              </MenuSelect>
            </label>
          )}
        </div>
      )}

      {confirmTeam && (
        <OrgConfirmDialog
          title={ta('projectTeams.confirmTitle', { team: confirmTeam.name })}
          description={ta('projectTeams.confirmBody', { team: confirmTeam.name, project: project.name })}
          confirmLabel={ta('projectTeams.confirm')}
          tone="accent"
          pending={addTeam.isPending}
          onConfirm={() =>
            addTeam.mutate({ projectId: project.id, teamId: confirmTeam.id }, { onSettled: () => setConfirmTeam(null) })
          }
          onCancel={() => setConfirmTeam(null)}
        />
      )}
    </section>
  );
};

export default ProjectMembersSection;
