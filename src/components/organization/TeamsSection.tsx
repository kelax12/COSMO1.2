import { useState } from 'react';
import { Plus, Trash2, UserMinus, Crown } from 'lucide-react';
import {
  useOrgTeams,
  useOrgTeamMembers,
  useCreateOrgTeam,
  useDeleteOrgTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useSetTeamLead,
} from '@/modules/org-teams';
import type { OrgMember } from '@/modules/organizations';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import MemberAvatar from './MemberAvatar';
import CreateTeamModal from './CreateTeamModal';
import { useT } from '@/i18n/useT';

interface TeamsSectionProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  /** Manager dérivé (a des subordonnés) — peut créer des équipes. */
  isManager: boolean;
}

/** Sous-arbre strict (ids) de `root`. */
function subtreeOf(members: OrgMember[], root: string): Set<string> {
  const out = new Set<string>();
  let frontier = [root];
  for (let depth = 0; depth < 50 && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const m of members) {
      if (m.managerId && frontier.includes(m.managerId) && !out.has(m.userId)) {
        out.add(m.userId);
        next.push(m.userId);
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * Équipes transverses de l'entreprise. Tout manager crée des équipes et y
 * ajoute SES subordonnés (+ lui-même) ; l'admin gère tout. Les projets
 * rattachés à une équipe sont cloisonnés à ses membres + leur hiérarchie.
 */
const TeamsSection = ({ orgId, members, currentUserId, isAdmin, isManager }: TeamsSectionProps) => {
  const { t } = useT('org');
  const [showNewTeam, setShowNewTeam] = useState(false);

  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: memberships = [] } = useOrgTeamMembers(orgId);
  const createTeam = useCreateOrgTeam(orgId);
  const deleteTeam = useDeleteOrgTeam(orgId);
  const addMember = useAddTeamMember(orgId);
  const removeMember = useRemoveTeamMember(orgId);
  const setLead = useSetTeamLead(orgId);

  const mySubtree = currentUserId ? subtreeOf(members, currentUserId) : new Set<string>();
  const memberOf = (userId: string) => members.find((m) => m.userId === userId);

  // Crée l'équipe (nom + couleur) PUIS y ajoute les membres choisis (#2).
  const handleCreateFull = async (input: { name: string; color: string }, memberIds: string[]) => {
    const team = await createTeam.mutateAsync(input);
    for (const userId of memberIds) {
      await addMember.mutateAsync({ teamId: team.id, userId });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
          {t('team.sectionTitle', { count: teams.length })}
        </h2>
        {isManager && (
          <button
            type="button"
            onClick={() => setShowNewTeam(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
          >
            <Plus size={13} aria-hidden="true" /> {t('team.add')}
          </button>
        )}
      </div>

      {showNewTeam && (
        <CreateTeamModal
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onSubmit={handleCreateFull}
          onClose={() => setShowNewTeam(false)}
        />
      )}

      {teams.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-3">
          {isManager ? t('team.emptyManager') : t('team.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => {
            const teamMemberships = memberships.filter((m) => m.teamId === team.id);
            const teamMemberIds = teamMemberships.map((m) => m.userId);
            const leadIds = new Set(teamMemberships.filter((m) => m.isLead).map((m) => m.userId));
            // Miroir EXACT de `can_manage_team` (mig. 107) : admin, créateur,
            // ou responsable de cette équipe. Toute divergence ferait afficher
            // des actions que le serveur refusera.
            const canManageThisTeam =
              isAdmin
              || team.createdBy === currentUserId
              || (!!currentUserId && leadIds.has(currentUserId));
            // Ajoutables : membres de l'org pas encore dans l'équipe ; un
            // non-admin ne propose que soi + ses subordonnés (miroir RLS).
            const addable = members.filter((m) => {
              if (teamMemberIds.includes(m.userId)) return false;
              if (!canManageThisTeam) return false;
              if (isAdmin) return true;
              return m.userId === currentUserId || mySubtree.has(m.userId);
            });
            return (
              <div key={team.id} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[rgb(var(--color-accent-solid))] shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] flex-1 truncate">{team.name}</h3>
                  <span className="text-xs text-[rgb(var(--color-text-muted))]">{teamMemberIds.length} membre{teamMemberIds.length > 1 ? 's' : ''}</span>
                  {canManageThisTeam && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('team.deleteConfirm', { name: team.name }))) {
                          deleteTeam.mutate(team.id);
                        }
                      }}
                      aria-label={t('team.deleteAria', { name: team.name })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {teamMemberIds.map((uid) => {
                    const m = memberOf(uid);
                    if (!m) return null;
                    const isLead = leadIds.has(uid);
                    return (
                      <span
                        key={uid}
                        className={`inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2 py-0.5 ${
                          isLead
                            ? 'border-amber-400/60 bg-amber-400/10'
                            : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]'
                        }`}
                      >
                        <MemberAvatar avatar={m.avatar} size={20} />
                        <span className="text-xs text-[rgb(var(--color-text-primary))]">
                          {uid === currentUserId ? t('common.youBadge') : m.displayName.split(' ')[0]}
                        </span>
                        {/* Le badge est rendu pour TOUS, pas seulement les
                            gestionnaires : savoir à qui s'adresser dans une
                            équipe est une information de lecture. */}
                        {isLead && (
                          <span
                            title={t('teams.leadHint')}
                            className="inline-flex items-center gap-0.5 text-caption font-semibold text-amber-600 dark:text-amber-400"
                          >
                            <Crown size={10} aria-hidden="true" /> {t('teams.leadBadge')}
                          </span>
                        )}
                        {canManageThisTeam && (
                          <button
                            type="button"
                            onClick={() => setLead.mutate({ teamId: team.id, userId: uid, isLead: !isLead })}
                            aria-label={
                              isLead
                                ? t('teams.removeLead')
                                : t('teams.makeLead')
                            }
                            className={`transition-colors ${
                              isLead
                                ? 'text-amber-500 hover:text-amber-600'
                                : 'text-[rgb(var(--color-text-muted))] hover:text-amber-500'
                            }`}
                          >
                            <Crown size={11} aria-hidden="true" />
                          </button>
                        )}
                        {canManageThisTeam && (
                          <button
                            type="button"
                            onClick={() => removeMember.mutate({ teamId: team.id, userId: uid })}
                            aria-label={t('team.removeMemberAria', { member: m.displayName, team: team.name })}
                            className="text-[rgb(var(--color-text-muted))] hover:text-red-500"
                          >
                            <UserMinus size={11} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {addable.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-[rgb(var(--color-chip-border))] px-2 py-0.5 text-xs text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:border-[rgb(var(--color-accent-solid-hover))] transition-colors"
                        aria-label={t('team.addMemberAria', { team: team.name })}
                      >
                        <Plus size={11} aria-hidden="true" /> {t('common.add')}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52 max-h-64 overflow-y-auto">
                        <DropdownMenuLabel>{t('team.addTo', { name: team.name })}</DropdownMenuLabel>
                        {addable.map((m) => (
                          <DropdownMenuItem
                            key={m.userId}
                            onClick={() => addMember.mutate({ teamId: team.id, userId: m.userId })}
                          >
                            <MemberAvatar avatar={m.avatar} size={20} />
                            <span className="truncate">{m.userId === currentUserId ? t('common.youBadge') : m.displayName}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamsSection;
