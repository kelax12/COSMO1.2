// Personnes d'un projet (mig. 190), deux fenêtres ouvertes depuis l'en-tête :
//
// - `ProjectRolesDialog` (clic sur la pile d'avatars) : tous ceux qui VOIENT le
//   projet, et leur fonction, responsable ou membre. Seuls les responsables
//   (et un admin) la modifient ; les autres la lisent.
// - `ProjectAddDialog` (bouton +, après le choix personne / équipe).
//
// Le rôle `viewer` (lecteur) n'est plus proposé (2026-10-13) : une ligne
// existante s'affiche « Membre » et le devient au premier changement.

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useSetProjectMember, useRemoveProjectMember, useAddProjectTeam, useTeamProjectTeams,
  type TeamProject, type TeamProjectMember,
} from '@/modules/team-projects';
import { isMemberActive, type OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import MemberAvatar from './MemberAvatar';
import MemberSelectField from './MemberSelectField';
import OrgConfirmDialog from './OrgConfirmDialog';
import MenuSelect from '@/components/organization/MenuSelect';
import { projectFunctionOf, type ProjectFunction } from './project-function';
import { useT } from '@/i18n/useT';

const selectCls = 'rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] h-9 px-3 text-sm text-[rgb(var(--color-text-primary))]';

interface RolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: TeamProject;
  projectMembers: TeamProjectMember[];
  /** Ceux qui voient le projet (`useVisibility`). */
  viewers: OrgMember[];
  /** Responsable du projet ou admin. */
  canManage: boolean;
  currentUserId?: string;
}

export const ProjectRolesDialog = ({
  open, onOpenChange, project, projectMembers, viewers, canManage, currentUserId,
}: RolesDialogProps) => {
  const { t: pf } = useT('portfolio');
  const setMember = useSetProjectMember(project.orgId);
  const removeMember = useRemoveProjectMember(project.orgId);
  const direct = useMemo(() => new Set(projectMembers.map((m) => m.userId)), [projectMembers]);
  const rows = useMemo(
    () => [...viewers].sort((a, b) =>
      (projectFunctionOf(a.userId, project, projectMembers) === 'lead' ? 0 : 1)
      - (projectFunctionOf(b.userId, project, projectMembers) === 'lead' ? 0 : 1)
      || a.displayName.localeCompare(b.displayName)),
    [viewers, project, projectMembers],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pf('members.rolesTitle')}</DialogTitle>
          <DialogDescription>{canManage ? pf('members.rolesHintManage') : pf('members.rolesHintRead')}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[60vh] overflow-y-auto space-y-1.5" data-guide-id="project-audience-who">
          {rows.map((m) => {
            const fn = projectFunctionOf(m.userId, project, projectMembers);
            const isOwner = m.userId === project.ownerId;
            const self = m.userId === currentUserId;
            return (
              <li key={m.userId} className="flex items-center gap-2">
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={24} />
                <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">
                  {m.displayName}{self && <span className="text-[rgb(var(--color-text-muted))]"> · {pf('members.you')}</span>}
                </span>
                {canManage && !isOwner ? (
                  <MenuSelect
                    value={fn}
                    aria-label={pf('members.roleOf', { name: m.displayName })}
                    onChange={(e) => setMember.mutate({ projectId: project.id, userId: m.userId, role: e.target.value as ProjectFunction })}
                    className={selectCls}
                  >
                    <option value="lead">{pf('members.role.lead')}</option>
                    <option value="contributor">{pf('members.role.contributor')}</option>
                  </MenuSelect>
                ) : (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${fn === 'lead' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]'}`}>
                    {pf(`members.role.${fn}`)}
                  </span>
                )}
                {direct.has(m.userId) && (canManage || self) ? (
                  <button
                    type="button"
                    onClick={() => removeMember.mutate({ projectId: project.id, userId: m.userId })}
                    aria-label={self ? pf('members.leave') : pf('members.remove', { name: m.displayName })}
                    title={self ? pf('members.leave') : pf('members.remove', { name: m.displayName })}
                    className="p-1 rounded-md text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-[rgb(var(--color-hover))]"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                ) : canManage && <span className="w-[22px]" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

interface AddDialogProps {
  mode: 'person' | 'team' | null;
  onClose: () => void;
  project: TeamProject;
  projectMembers: TeamProjectMember[];
  orgMembers: OrgMember[];
  teams: OrgTeam[];
}

export const ProjectAddDialog = ({ mode, onClose, project, projectMembers, orgMembers, teams }: AddDialogProps) => {
  const { t: pf } = useT('portfolio');
  const { t: ta } = useT('orgAdmin');
  const setMember = useSetProjectMember(project.orgId);
  const addTeam = useAddProjectTeam(project.orgId);
  const { data: links = [] } = useTeamProjectTeams(project.orgId);
  const [role, setRole] = useState<ProjectFunction>('contributor');
  const [confirmTeam, setConfirmTeam] = useState<OrgTeam | null>(null);

  // Candidats : membres actifs, pas déjà dans le projet, ni le responsable.
  const candidates = useMemo(() => {
    const inProject = new Set(projectMembers.map((m) => m.userId));
    return orgMembers.filter((m) => !inProject.has(m.userId) && m.userId !== project.ownerId && isMemberActive(m));
  }, [orgMembers, projectMembers, project.ownerId]);

  // Un projet d'entreprise (`team_id` nul) est déjà lu par tous : y associer
  // une équipe ne changerait rien.
  const addableTeams = useMemo(() => {
    if (!project.teamId) return [];
    const linked = new Set(links.filter((l) => l.projectId === project.id).map((l) => l.teamId));
    return teams.filter((tm) => tm.id !== project.teamId && !linked.has(tm.id));
  }, [teams, links, project.id, project.teamId]);

  return (
    <>
      <Dialog open={mode !== null && !confirmTeam} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === 'team' ? pf('members.addTeam') : pf('members.addMember')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3" data-guide-id="project-audience-add">
            {mode === 'person' && (candidates.length === 0 ? (
              <p className="text-sm text-[rgb(var(--color-text-muted))]">{pf('members.noCandidate')}</p>
            ) : (
              <>
                <label className="block">
                  <span className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{pf('members.roleLabel')}</span>
                  <MenuSelect value={role} onChange={(e) => setRole(e.target.value as ProjectFunction)} className={`${selectCls} w-full`}>
                    <option value="contributor">{pf('members.role.contributor')}</option>
                    <option value="lead">{pf('members.role.lead')}</option>
                  </MenuSelect>
                </label>
                <MemberSelectField
                  label={pf('members.person')}
                  members={candidates}
                  value=""
                  onChange={(userId) => {
                    if (userId) setMember.mutate({ projectId: project.id, userId, role }, { onSuccess: onClose });
                  }}
                  emptyLabel={pf('members.choose')}
                />
              </>
            ))}
            {mode === 'team' && (addableTeams.length === 0 ? (
              <p className="text-sm text-[rgb(var(--color-text-muted))]">{project.teamId ? pf('members.noTeam') : pf('members.wholeOrgTeam')}</p>
            ) : (
              <MenuSelect
                value=""
                aria-label={pf('members.addTeam')}
                onChange={(e) => setConfirmTeam(addableTeams.find((tm) => tm.id === e.target.value) ?? null)}
                className={`${selectCls} w-full`}
              >
                <option value="">{pf('members.choose')}</option>
                {addableTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
              </MenuSelect>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {confirmTeam && (
        <OrgConfirmDialog
          title={ta('projectTeams.confirmTitle', { team: confirmTeam.name })}
          description={ta('projectTeams.confirmBody', { team: confirmTeam.name, project: project.name })}
          confirmLabel={ta('projectTeams.confirm')}
          tone="accent"
          pending={addTeam.isPending}
          onConfirm={() =>
            addTeam.mutate({ projectId: project.id, teamId: confirmTeam.id }, {
              onSettled: () => setConfirmTeam(null),
              onSuccess: onClose,
            })
          }
          onCancel={() => setConfirmTeam(null)}
        />
      )}
    </>
  );
};
