import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { OrgTeam } from '@/modules/org-teams';
import { useTeamProjects } from '@/modules/team-projects';
import {
  canUseHierarchy,
  leadableTeams,
  parseScopeKey,
  scopeKey,
  type ScopeContext,
  type StatsScope,
} from './stats-scope.helpers';
import { useT } from '@/i18n/useT';
import MenuSelect from '@/components/organization/MenuSelect';

interface StatsScopeSelectProps {
  orgId: string;
  scope: StatsScope;
  onScope: (scope: StatsScope) => void;
  teams: OrgTeam[];
  ctx: ScopeContext;
}

/**
 * « Qui je regarde » dans les statistiques (M3), et pourquoi je le vois.
 *
 * La règle était implicite : un manager voyait son sous-arbre, un admin tout,
 * un responsable d'équipe rien. Elle est désormais choisie ET expliquée.
 */
const StatsScopeSelect = ({ orgId, scope, onScope, teams, ctx }: StatsScopeSelectProps) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const [explain, setExplain] = useState(false);
  const { data: projects = [] } = useTeamProjects(orgId);
  const hierarchy = canUseHierarchy(ctx);
  const myTeams = leadableTeams(teams, ctx);
  const activeProjects = projects.filter((p) => !p.archivedAt);

  const why = scope.kind === 'hierarchy'
    ? (ctx.isAdmin ? tOrgAdmin('statsScope.whyAdmin') : tOrgAdmin('statsScope.whyManager'))
    : scope.kind === 'team'
      ? (ctx.isAdmin ? tOrgAdmin('statsScope.whyTeamAdmin') : tOrgAdmin('statsScope.whyTeamLead'))
      : tOrgAdmin('statsScope.whyProject');

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <label htmlFor="stats-scope" className="sr-only">{tOrgAdmin('statsScope.label')}</label>
        <MenuSelect
          id="stats-scope"
          value={scopeKey(scope)}
          onChange={(e) => onScope(parseScopeKey(e.target.value))}
          className="h-9 max-w-[16rem] rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2 text-sm text-[rgb(var(--color-text-primary))]"
        >
          {hierarchy && (
            <option value="hierarchy">{ctx.isAdmin ? tOrgAdmin('statsScope.wholeOrg') : tOrgAdmin('statsScope.mySubtree')}</option>
          )}
          {myTeams.length > 0 && (
            <optgroup label={tOrgAdmin('statsScope.teams')}>
              {myTeams.map((team) => <option key={team.id} value={`team:${team.id}`}>{team.name}</option>)}
            </optgroup>
          )}
          {hierarchy && activeProjects.length > 0 && (
            <optgroup label={tOrgAdmin('statsScope.projects')}>
              {activeProjects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}
            </optgroup>
          )}
        </MenuSelect>
        <button
          type="button"
          onClick={() => setExplain((v) => !v)}
          aria-expanded={explain}
          aria-label={tOrgAdmin('statsScope.why')}
          className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
        >
          <HelpCircle size={16} aria-hidden="true" />
        </button>
      </div>
      {explain && <p className="mt-1 max-w-md text-xs text-[rgb(var(--color-text-muted))]">{why}</p>}
    </div>
  );
};

export default StatsScopeSelect;
