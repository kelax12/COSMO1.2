import { useMemo, useState } from 'react';
import { Plus, UserMinus, Crown } from 'lucide-react';
import {
  useAddTeamMember,
  useRemoveTeamMember,
  useSetTeamLead,
  type OrgTeam,
  type OrgTeamMember,
} from '@/modules/org-teams';
import { subtreeOf, type OrgMember } from '@/modules/organizations';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import MemberAvatar from './MemberAvatar';
import { MEMBER_SEARCH_THRESHOLD, filterMembersByQuery } from './member-search.helpers';
import { sortTeamMembers } from './team-page.helpers';
import { useT } from '@/i18n/useT';

/**
 * Au-delà, les pastilles se coupent avec un « +N » (audit « passage à
 * l'échelle » du 2026-09-24 : une équipe de deux cents personnes en peignait
 * deux cents).
 */
const TEAM_CHIPS_LIMIT = 24;

/**
 * Menu « Ajouter » d'une équipe. Au-delà de `MEMBER_SEARCH_THRESHOLD`
 * candidats, il devient une liste avec recherche : un menu déroulant nu est
 * inutilisable à cinquante membres.
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

interface TeamMembersPanelProps {
  orgId: string;
  team: OrgTeam;
  /** Membres de l'organisation. */
  members: OrgMember[];
  /** Appartenances de CETTE équipe. */
  memberships: OrgTeamMember[];
  currentUserId?: string;
  isAdmin: boolean;
  /** Miroir de `can_manage_team` : nommer un responsable, retirer, ajouter. */
  canManage: boolean;
}

/**
 * Membres d'une équipe : pastilles (responsables en tête), couronne pour
 * nommer ou révoquer un responsable, retrait, ajout. Sorti de `TeamsSection`
 * quand l'équipe a eu sa page (audit Membres du 2026-09-24).
 */
const TeamMembersPanel = ({ orgId, team, members, memberships, currentUserId, isAdmin, canManage }: TeamMembersPanelProps) => {
  const { t, tp } = useT('org');
  const addMember = useAddTeamMember(orgId);
  const removeMember = useRemoveTeamMember(orgId);
  const setLead = useSetTeamLead(orgId);
  const [expanded, setExpanded] = useState(false);

  const memberIds = new Set(memberships.map((m) => m.userId));
  const leadIds = new Set(memberships.filter((m) => m.isLead).map((m) => m.userId));
  const teamMembers = sortTeamMembers(members.filter((m) => memberIds.has(m.userId)), memberships);
  const mySubtree = useMemo(
    () => (currentUserId ? subtreeOf(members, currentUserId) : new Set<string>()),
    [members, currentUserId],
  );
  // Ajoutables : membres de l'org pas encore dans l'équipe ; un non-admin ne
  // propose que soi + ses subordonnés (miroir de la policy d'insertion).
  const addable = canManage
    ? members.filter((m) => {
        if (memberIds.has(m.userId)) return false;
        if (isAdmin) return true;
        return m.userId === currentUserId || mySubtree.has(m.userId);
      })
    : [];

  const shown = expanded ? teamMembers : teamMembers.slice(0, TEAM_CHIPS_LIMIT);
  const hidden = teamMembers.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {teamMembers.length === 0 && (
        <p className="text-xs text-[rgb(var(--color-text-muted))] mr-2">{t('teamPage.noMembers')}</p>
      )}
      {shown.map((m) => {
        const isLead = leadIds.has(m.userId);
        return (
          <span
            key={m.userId}
            className={`inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2 py-0.5 ${
              isLead
                ? 'border-amber-400/60 bg-amber-400/10'
                : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]'
            }`}
          >
            <MemberAvatar avatar={m.avatar} size={20} />
            <span className="text-xs text-[rgb(var(--color-text-primary))]">
              {m.userId === currentUserId ? t('common.youBadge') : m.displayName}
            </span>
            {/* Rendu pour TOUS : savoir à qui s'adresser dans une équipe est
                une information de lecture. */}
            {isLead && (
              <span
                title={t('teams.leadHint')}
                className="inline-flex items-center gap-0.5 text-caption font-semibold text-amber-600 dark:text-amber-400"
              >
                <Crown size={10} aria-hidden="true" /> {t('teams.leadBadge')}
              </span>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => setLead.mutate({ teamId: team.id, userId: m.userId, isLead: !isLead })}
                aria-label={isLead ? t('teams.removeLead') : t('teams.makeLead')}
                className={`transition-colors ${
                  isLead ? 'text-amber-500 hover:text-amber-600' : 'text-[rgb(var(--color-text-muted))] hover:text-amber-500'
                }`}
              >
                <Crown size={11} aria-hidden="true" />
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => removeMember.mutate({ teamId: team.id, userId: m.userId })}
                aria-label={t('team.removeMemberAria', { member: m.displayName, team: team.name })}
                className="text-[rgb(var(--color-text-muted))] hover:text-red-500"
              >
                <UserMinus size={11} aria-hidden="true" />
              </button>
            )}
          </span>
        );
      })}
      {teamMembers.length > TEAM_CHIPS_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
        >
          {expanded ? t('team.fewerMembers') : tp('team.moreMembers', hidden)}
        </button>
      )}
      {addable.length > 0 && (
        <AddTeamMemberMenu
          teamName={team.name}
          addable={addable}
          currentUserId={currentUserId}
          onAdd={(userId) => addMember.mutate({ teamId: team.id, userId })}
        />
      )}
    </div>
  );
};

export default TeamMembersPanel;
