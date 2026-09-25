import { useState } from 'react';
import { Plus, Trash2, UserMinus, Crown, Search } from 'lucide-react';
import {
  useOrgTeams,
  useOrgTeamMembers,
  useCreateOrgTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useSetTeamLead,
  type OrgTeam,
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
import DeleteTeamDialog from './DeleteTeamDialog';
import { MEMBER_SEARCH_THRESHOLD, filterMembersByQuery } from './member-search.helpers';
import { normalize } from './pyramid.helpers';
import { useT } from '@/i18n/useT';
import { showUndoToast } from '@/lib/undo-toast';
import { useTeamProjects, useTeamProjectTeams } from '@/modules/team-projects';
import { projectsLostOnTeamLeave } from './team-audience.helpers';
import LeaveTeamConfirm from './LeaveTeamConfirm';
import TeamBulkAddDialog from './TeamBulkAddDialog';

interface TeamsSectionProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  /** Manager dérivé (a des subordonnés) — peut créer des équipes. */
  /** Droit `team.create` (mig. 115) — remplace l'ancien « est manager ». */
  canCreateTeam: boolean;
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
 * Audit « passage à l'échelle » du 2026-09-24 : à cent équipes, la section
 * empilait cent cartes au-dessus de l'annuaire, et une équipe de deux cents
 * personnes peignait deux cents pastilles. Au-delà de ces seuils, la liste se
 * replie et se cherche, et les pastilles se coupent avec un « +N ».
 */
const TEAMS_LIMIT = 6;
const TEAM_CHIPS_LIMIT = 24;

/**
 * Menu « Ajouter » d'une équipe. Composant à part pour porter l'état de SA
 * recherche : il est rendu une fois par carte.
 */
const AddTeamMemberMenu = ({ teamName, addable, currentUserId, onAdd }: {
  teamName: string;
  addable: OrgMember[];
  currentUserId?: string;
  onAdd: (userId: string) => void;
}) => {
  const { t } = useT('org');
  const [query, setQuery] = useState('');
  const searchable = addable.length > MEMBER_SEARCH_THRESHOLD;
  const shown = searchable ? filterMembersByQuery(addable, query) : addable;
  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setQuery(''); }}>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-[rgb(var(--color-chip-border))] px-2 py-0.5 text-xs text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:border-[rgb(var(--color-accent-solid-hover))] transition-colors"
        aria-label={t('team.addMemberAria', { team: teamName })}
      >
        <Plus size={11} aria-hidden="true" /> {t('common.add')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
        <DropdownMenuLabel>{t('team.addTo', { name: teamName })}</DropdownMenuLabel>
        {searchable && (
          <div className="px-1.5 pb-1.5">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Même raison que dans AssigneesPicker : le menu Radix capte les
              // touches pour sa saisie semi-automatique. Échap reste au menu.
              onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }}
              placeholder={t('assign.memberSearch')}
              aria-label={t('assign.memberSearch')}
              className="w-full px-2.5 py-1.5 text-sm rounded-md border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
            />
          </div>
        )}
        {shown.length === 0 && (
          <p className="px-2 py-3 text-xs text-center text-[rgb(var(--color-text-muted))]">{t('assign.noMemberMatch')}</p>
        )}
        {shown.map((m) => (
          <DropdownMenuItem key={m.userId} onClick={() => onAdd(m.userId)}>
            <MemberAvatar avatar={m.avatar} size={20} />
            <span className="truncate">{m.userId === currentUserId ? t('common.youBadge') : m.displayName}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * Équipes transverses de l'entreprise. Tout manager crée des équipes et y
 * ajoute SES subordonnés (+ lui-même) ; l'admin gère tout. Les projets
 * rattachés à une équipe sont cloisonnés à ses membres + leur hiérarchie.
 */
const TeamsSection = ({ orgId, members, currentUserId, isAdmin, canCreateTeam }: TeamsSectionProps) => {
  const { t, tp } = useT('org');
  const { t: ta } = useT('orgAdmin');
  const [showNewTeam, setShowNewTeam] = useState(false);

  // C-40 — sans `isLoading`, l'ecran AFFIRME une absence qu'il ne connait pas
  // encore : le premier rendu arrive avant la reponse, et la valeur par defaut
  // `[]` est indistinguable d'un compte reellement vide.
  const { data: teams = [], isLoading: loadingTeams } = useOrgTeams(orgId);
  const { data: memberships = [] } = useOrgTeamMembers(orgId);
  const createTeam = useCreateOrgTeam(orgId);
  // M5 : la suppression passe par une modale d'impact, jamais par un confirm().
  const [teamToDelete, setTeamToDelete] = useState<OrgTeam | null>(null);
  const addMember = useAddTeamMember(orgId);
  const removeMember = useRemoveTeamMember(orgId);
  const setLead = useSetTeamLead(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: projectTeams = [] } = useTeamProjectTeams(orgId);
  // Retrait qui coupe la vue sur des projets : confirmé, avec la liste.
  const [leaving, setLeaving] = useState<{ team: OrgTeam; member: OrgMember; lost: ReturnType<typeof projectsLostOnTeamLeave> } | null>(null);

  // Équipes : chaque geste réversible a son « Annuler » (audit du 2026-09-24,
  // cohérence des popups). Les tâches l'avaient, les équipes rien.
  const addWithUndo = (team: OrgTeam, userId: string) =>
    addMember.mutate({ teamId: team.id, userId }, {
      onSuccess: () => showUndoToast(ta('teamUndo.added', { team: team.name }), () =>
        removeMember.mutate({ teamId: team.id, userId })),
    });
  const removeWithUndo = (team: OrgTeam, userId: string, wasLead: boolean) =>
    removeMember.mutate({ teamId: team.id, userId }, {
      onSuccess: () => showUndoToast(ta('teamUndo.removed', { team: team.name }), () =>
        addMember.mutate({ teamId: team.id, userId }, {
          onSuccess: () => { if (wasLead) setLead.mutate({ teamId: team.id, userId, isLead: true }); },
        })),
    });
  const toggleLeadWithUndo = (team: OrgTeam, userId: string, isLead: boolean) =>
    setLead.mutate({ teamId: team.id, userId, isLead }, {
      onSuccess: () => showUndoToast(ta(isLead ? 'teamUndo.leadSet' : 'teamUndo.leadRemoved'), () =>
        setLead.mutate({ teamId: team.id, userId, isLead: !isLead })),
    });
  const requestRemove = (team: OrgTeam, member: OrgMember, wasLead: boolean) => {
    const lost = projectsLostOnTeamLeave({
      userId: member.userId, teamId: team.id, members, memberships, projects, projectTeams,
    });
    if (lost.length === 0) removeWithUndo(team, member.userId, wasLead);
    else setLeaving({ team, member, lost });
  };
  const [teamQuery, setTeamQuery] = useState('');
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => new Set());
  const toggleExpandedTeam = (id: string) =>
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const teamsSearchable = teams.length > TEAMS_LIMIT;
  const q = normalize(teamQuery.trim());
  const matchingTeams = teamsSearchable && q ? teams.filter((tm) => normalize(tm.name).includes(q)) : teams;
  // Une recherche montre tous ses résultats : la couper à six cacherait
  // précisément l'équipe qu'on cherche.
  const shownTeams = showAllTeams || q ? matchingTeams : matchingTeams.slice(0, TEAMS_LIMIT);
  const hiddenTeams = matchingTeams.length - shownTeams.length;

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
        {canCreateTeam && (
          <button
            type="button"
            onClick={() => setShowNewTeam(true)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-500 hover:text-blue-600 transition-colors"
          >
            <Plus size={14} aria-hidden="true" /> {t('team.add')}
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

      {loadingTeams ? null : teams.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-3">
          {canCreateTeam ? t('team.emptyManager') : t('team.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {teamsSearchable && (
            <label className="relative block">
              <span className="sr-only">{t('team.searchTeams')}</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
              <input
                type="search"
                value={teamQuery}
                onChange={(e) => setTeamQuery(e.target.value)}
                placeholder={t('team.searchTeams')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
              />
            </label>
          )}
          {matchingTeams.length === 0 && (
            <p className="text-xs text-[rgb(var(--color-text-muted))] py-3">{t('team.noTeamMatch')}</p>
          )}
          {shownTeams.map((team) => {
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
            const expanded = expandedTeams.has(team.id);
            const shownMemberIds = expanded ? teamMemberIds : teamMemberIds.slice(0, TEAM_CHIPS_LIMIT);
            const hiddenMembers = teamMemberIds.length - shownMemberIds.length;
            return (
              <div key={team.id} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[rgb(var(--color-accent-solid))] shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] flex-1 truncate">{team.name}</h3>
                  <span className="text-xs text-[rgb(var(--color-text-muted))]">{tp('team.memberCount', teamMemberIds.length)}</span>
                  {/* Suppression : admin ou créateur SEULEMENT, miroir exact de la
                      policy `org_teams_delete`. Un responsable gère ses membres,
                      il ne supprime pas l'équipe : le bouton lui promettait un
                      geste que le serveur refusait. */}
                  {(isAdmin || team.createdBy === currentUserId) && (
                    <button
                      type="button"
                      onClick={() => setTeamToDelete(team)}
                      aria-label={t('team.deleteAria', { name: team.name })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {shownMemberIds.map((uid) => {
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
                            onClick={() => toggleLeadWithUndo(team, uid, !isLead)}
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
                            onClick={() => requestRemove(team, m, isLead)}
                            aria-label={t('team.removeMemberAria', { member: m.displayName, team: team.name })}
                            className="text-[rgb(var(--color-text-muted))] hover:text-red-500"
                          >
                            <UserMinus size={11} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {teamMemberIds.length > TEAM_CHIPS_LIMIT && (
                    <button
                      type="button"
                      onClick={() => toggleExpandedTeam(team.id)}
                      aria-expanded={expanded}
                      className="rounded-full px-2 py-0.5 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
                    >
                      {expanded ? t('team.fewerMembers') : tp('team.moreMembers', hiddenMembers)}
                    </button>
                  )}
                  {addable.length > 0 && (
                    <AddTeamMemberMenu
                      teamName={team.name}
                      addable={addable}
                      currentUserId={currentUserId}
                      onAdd={(userId) => addWithUndo(team, userId)}
                    />
                  )}
                  <TeamBulkAddDialog orgId={orgId} team={team} addable={addable} />
                </div>
              </div>
            );
          })}
          {!q && teams.length > TEAMS_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllTeams((v) => !v)}
              aria-expanded={showAllTeams}
              className="w-full py-2 text-sm font-medium rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              {showAllTeams ? t('team.showFewerTeams') : tp('team.showMoreTeams', hiddenTeams)}
            </button>
          )}
        </div>
      )}
      {leaving && (
        <LeaveTeamConfirm
          orgId={orgId}
          memberName={leaving.member.displayName}
          userId={leaving.member.userId}
          teamName={leaving.team.name}
          lostProjects={leaving.lost}
          onConfirm={() => {
            const wasLead = memberships.some((m) => m.teamId === leaving.team.id && m.userId === leaving.member.userId && m.isLead);
            removeWithUndo(leaving.team, leaving.member.userId, wasLead);
            setLeaving(null);
          }}
          onCancel={() => setLeaving(null)}
        />
      )}
      {teamToDelete && (
        <DeleteTeamDialog
          orgId={orgId}
          team={teamToDelete}
          teams={teams}
          onClose={() => setTeamToDelete(null)}
        />
      )}
    </div>
  );
};

export default TeamsSection;
