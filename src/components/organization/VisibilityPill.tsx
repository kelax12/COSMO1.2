import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOrgMembers } from '@/modules/organizations';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import { useTeamProjectMembers, useTeamProjectTeams } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import MemberAvatar from './MemberAvatar';
import { visibilityOf, type VisibilityReason } from './visibility.helpers';

interface VisibilityPillProps {
  orgId: string;
  /** Équipes de l'objet (principale et associées) ; [] = toute l'entreprise. */
  teamIds: string[];
  /**
   * Projet : ses équipes ASSOCIÉES (mig. 164) et ses membres directs (mig. 190)
   * s'ajoutent à `teamIds`. Absent pour un objectif.
   */
  projectId?: string;
  /** OKR 'teams' ou 'custom' (mig. 205) : fermé même sans équipe. */
  closed?: boolean;
  /** Personnes nommées d'un OKR 'custom' (mig. 205). */
  namedIds?: string[];
}

const REASON_ORDER: VisibilityReason[] = ['team', 'direct', 'hierarchy', 'admin', 'org'];
const SHOWN = 40;

/**
 * « Visible : équipe Produit + hiérarchie · 14 personnes » (audit 2026-09-24,
 * M12), sur un projet ou un objectif EXISTANT. Un clic dit qui, et pourquoi.
 */
const VisibilityPill = ({ orgId, teamIds: ownTeamIds, projectId, closed = false, namedIds = [] }: VisibilityPillProps) => {
  const { t, tp } = useT('portfolio');
  const { data: members = [] } = useOrgMembers(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: memberships = [] } = useOrgTeamMembers(orgId);
  const { data: projectTeams = [] } = useTeamProjectTeams(projectId ? orgId : undefined);
  const { data: projectMembers = [] } = useTeamProjectMembers(projectId ? orgId : undefined);
  const [query, setQuery] = useState('');
  // Un projet sans équipe principale reste visible par TOUTE l'entreprise,
  // quelles que soient ses équipes associées (`p.team_id IS NULL`, mig. 194).
  const teamIds = ownTeamIds.length === 0 ? [] : [...new Set([
    ...ownTeamIds,
    ...projectTeams.filter((l) => l.projectId === projectId).map((l) => l.teamId),
  ])];
  const directIds = projectId ? projectMembers.filter((m) => m.projectId === projectId).map((m) => m.userId) : [];

  // Pas de mémo : le calcul est linéaire en membres, et les tableaux reçus
  // changent d'identité à chaque rendu du parent.
  const vis = visibilityOf({ members, teamIds, memberships, directIds, closed, namedIds });
  const names = teamIds.map((id) => teams.find((x) => x.id === id)?.name).filter(Boolean).join(', ');
  const scope = vis.wholeOrg
    ? t('visibility.wholeOrg')
    : namedIds.length > 0
      // OKR « Personnaliser » (mig. 205) : personnes nommées, avec ou sans équipes.
      ? names ? t('visibility.teamsPeopleHierarchy', { teams: names }) : t('visibility.peopleHierarchy')
      : directIds.length > 0
        ? t('visibility.teamsHierarchyMembers', { teams: names })
        : names ? t('visibility.teamsHierarchy', { teams: names }) : t('visibility.adminsOnly');
  const count = vis.viewers.size;

  const reasonLabel: Record<VisibilityReason, string> = {
    team: t('visibility.reasonTeam'),
    direct: t('visibility.reasonDirect'),
    hierarchy: t('visibility.reasonHierarchy'),
    admin: t('visibility.reasonAdmin'),
    org: t('visibility.reasonOrg'),
  };
  const q = query.trim().toLowerCase();
  const people = members
      .filter((m) => vis.viewers.has(m.userId) && (!q || m.displayName.toLowerCase().includes(q)))
      .sort((a, b) =>
        REASON_ORDER.indexOf(vis.viewers.get(a.userId)!) - REASON_ORDER.indexOf(vis.viewers.get(b.userId)!)
        || a.displayName.localeCompare(b.displayName));

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t('visibility.aria', { scope, count })}
        className="inline-flex items-center gap-1 text-caption font-medium px-2 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
      >
        <Eye size={11} aria-hidden="true" />
        <span className="truncate max-w-[260px]">{t('visibility.pill', { scope })}</span>
        <span className="tabular-nums">· {tp('visibility.people', count)}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="p-3 border-b border-[rgb(var(--color-border))] space-y-1">
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{tp('visibility.title', count)}</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{vis.wholeOrg ? t('visibility.ruleOrg') : t('visibility.ruleTeams')}</p>
        </div>
        {count > 8 && (
          <div className="p-2 border-b border-[rgb(var(--color-border))]">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('visibility.search')}
              aria-label={t('visibility.search')}
              className="w-full h-8 px-2 rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm"
            />
          </div>
        )}
        <ul className="max-h-64 overflow-y-auto py-1">
          {people.slice(0, SHOWN).map((m) => (
            <li key={m.userId} className="flex items-center gap-2 px-3 py-1.5">
              <MemberAvatar avatar={m.avatar} name={m.displayName} size={20} />
              <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{m.displayName}</span>
              <span className="text-caption text-[rgb(var(--color-text-muted))] shrink-0">{reasonLabel[vis.viewers.get(m.userId)!]}</span>
            </li>
          ))}
          {people.length > SHOWN && (
            <li className="px-3 py-1.5 text-caption text-[rgb(var(--color-text-muted))]">{tp('visibility.more', people.length - SHOWN)}</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

export default VisibilityPill;
