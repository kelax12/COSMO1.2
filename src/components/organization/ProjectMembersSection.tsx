// Membres d'un projet et leur rôle (mig. 190) — co-pilote, contributeur,
// lecteur. Être membre rend un projet VISIBLE, même hors de son équipe : c'est
// ainsi qu'on ouvre UN projet cloisonné à un prestataire, sans lui ouvrir les
// autres. Le rôle élargit (contributeur) ou restreint (lecteur) les droits
// d'organisation sur CE projet seulement ; un admin n'est jamais restreint.

import { useMemo, useState } from 'react';
import { UsersRound, X } from 'lucide-react';
import {
  useSetProjectMember, useRemoveProjectMember,
  type TeamProject, type TeamProjectMember, type TeamProjectRole,
} from '@/modules/team-projects';
import { isMemberActive, type OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import MemberSelectField from './MemberSelectField';
import { useT } from '@/i18n/useT';

const ROLES: TeamProjectRole[] = ['lead', 'contributor', 'viewer'];

interface ProjectMembersSectionProps {
  project: TeamProject;
  /** Membres de CE projet (déjà filtrés). */
  projectMembers: TeamProjectMember[];
  orgMembers: OrgMember[];
  /** Piloter le projet : `project.edit`, responsable, ou co-pilote. */
  canManage: boolean;
  currentUserId?: string;
}

const selectCls = 'rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2 py-1.5 text-xs text-[rgb(var(--color-text-primary))]';

const ProjectMembersSection = ({ project, projectMembers, orgMembers, canManage, currentUserId }: ProjectMembersSectionProps) => {
  const { t: pf } = useT('portfolio');
  const setMember = useSetProjectMember(project.orgId);
  const removeMember = useRemoveProjectMember(project.orgId);
  const [candidate, setCandidate] = useState('');
  const [role, setRole] = useState<TeamProjectRole>('contributor');

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

  const add = () => {
    if (!candidate) return;
    setMember.mutate({ projectId: project.id, userId: candidate, role }, { onSuccess: () => setCandidate('') });
  };

  return (
    <section aria-labelledby={`project-members-${project.id}`} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 id={`project-members-${project.id}`} className="flex items-center gap-1.5 text-sm font-bold text-[rgb(var(--color-text-primary))] mb-1">
        <UsersRound size={14} aria-hidden="true" /> {pf('members.title')}
      </h3>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">{pf('members.help')}</p>

      {rows.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">{pf('members.empty')}</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {rows.map((pm) => {
            const m = byId.get(pm.userId);
            const name = m?.displayName ?? pf('members.formerMember');
            const self = pm.userId === currentUserId;
            return (
              <li key={pm.userId} className="flex items-center gap-2">
                <MemberAvatar avatar={m?.avatar} name={name} size={22} />
                <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">
                  {name}{self && <span className="text-[rgb(var(--color-text-muted))]"> · {pf('members.you')}</span>}
                </span>
                {canManage ? (
                  <select
                    value={pm.role}
                    aria-label={pf('members.roleOf', { name })}
                    onChange={(e) => setMember.mutate({ projectId: project.id, userId: pm.userId, role: e.target.value as TeamProjectRole })}
                    className={selectCls}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{pf(`members.role.${r}`)}</option>)}
                  </select>
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

      {canManage && candidates.length > 0 && (
        <div className="space-y-2 border-t border-[rgb(var(--color-border))] pt-3">
          <MemberSelectField
            label={pf('members.addLabel')}
            members={candidates}
            value={candidate}
            onChange={setCandidate}
            emptyLabel={pf('members.choose')}
          />
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="sr-only">{pf('members.roleLabel')}</span>
              <select value={role} onChange={(e) => setRole(e.target.value as TeamProjectRole)} className={`${selectCls} w-full py-2`}>
                {ROLES.map((r) => <option key={r} value={r}>{pf(`members.role.${r}`)}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={add}
              disabled={!candidate || setMember.isPending}
              className="h-9 px-3 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pf('members.add')}
            </button>
          </div>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf(`members.roleHelp.${role}`)}</p>
        </div>
      )}
    </section>
  );
};

export default ProjectMembersSection;
