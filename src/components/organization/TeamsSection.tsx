import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Trash2, Search, Crown, ChevronRight } from 'lucide-react';
import {
  useOrgTeams,
  useOrgTeamMembers,
  type OrgTeam,
} from '@/modules/org-teams';
import type { OrgMember } from '@/modules/organizations';
import { useTeamProjects } from '@/modules/team-projects';
import MemberAvatar from './MemberAvatar';
import { useOrgCreate } from './org-create.context';
import DeleteTeamDialog from './DeleteTeamDialog';
import { orgTeamPath } from './deep-link.helpers';
import { teamProjectsOf } from './team-page.helpers';
import { normalize } from './pyramid.helpers';
import { useT } from '@/i18n/useT';

interface TeamsSectionProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  /** Droit `team.create` (mig. 115) — remplace l'ancien « est manager ». */
  canCreateTeam: boolean;
}

/**
 * Audit « passage à l'échelle » du 2026-09-24 : à cent équipes, la section
 * empilait cent cartes. Au-delà de ce seuil, la liste se replie et se cherche.
 */
const TEAMS_LIMIT = 6;
/** Responsables nommés sur la carte ; au-delà, « +N ». */
const LEADS_SHOWN = 3;

/**
 * Équipes transverses de l'entreprise, section `/entreprise/teams`. Une carte
 * par équipe, qui ouvre sa page (`/entreprise/teams/:id`) : description,
 * responsables, membres, projets, OKR, statistiques. La gestion des membres
 * vit sur cette page (`TeamMembersPanel`), plus dans la liste.
 */
const TeamsSection = ({ orgId, members, currentUserId, isAdmin, canCreateTeam }: TeamsSectionProps) => {
  const { t, tp } = useT('org');
  const create = useOrgCreate();

  // C-40 — sans `isLoading`, l'ecran AFFIRME une absence qu'il ne connait pas
  // encore : le premier rendu arrive avant la reponse, et la valeur par defaut
  // `[]` est indistinguable d'un compte reellement vide.
  const { data: teams = [], isLoading: loadingTeams } = useOrgTeams(orgId);
  const { data: memberships = [] } = useOrgTeamMembers(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  // M5 : la suppression passe par une modale d'impact, jamais par un confirm().
  const [teamToDelete, setTeamToDelete] = useState<OrgTeam | null>(null);
  const [teamQuery, setTeamQuery] = useState('');
  const [showAllTeams, setShowAllTeams] = useState(false);

  const teamsSearchable = teams.length > TEAMS_LIMIT;
  const q = normalize(teamQuery.trim());
  const matchingTeams = teamsSearchable && q
    ? teams.filter((tm) => normalize(tm.name).includes(q) || normalize(tm.description ?? '').includes(q))
    : teams;
  // Une recherche montre tous ses résultats : la couper à six cacherait
  // précisément l'équipe qu'on cherche.
  const shownTeams = showAllTeams || q ? matchingTeams : matchingTeams.slice(0, TEAMS_LIMIT);
  const hiddenTeams = matchingTeams.length - shownTeams.length;
  const memberById = new Map(members.map((m) => [m.userId, m]));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
          {t('team.sectionTitle', { count: teams.length })}
        </h2>
        {canCreateTeam && (
          <button
            type="button"
            onClick={() => create.openTeam()}
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-500 hover:text-blue-600 transition-colors"
          >
            <Plus size={14} aria-hidden="true" /> {t('team.add')}
          </button>
        )}
      </div>


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
          <ul className="grid gap-3 md:grid-cols-2">
            {shownTeams.map((team) => {
              const teamMemberships = memberships.filter((m) => m.teamId === team.id);
              const leads = teamMemberships
                .filter((m) => m.isLead)
                .map((m) => memberById.get(m.userId))
                .filter((m): m is OrgMember => !!m);
              const projectCount = teamProjectsOf(team, projects).filter((p) => !p.archivedAt).length;
              const leadNames = leads
                .slice(0, LEADS_SHOWN)
                .map((m) => (m.userId === currentUserId ? t('common.youBadge') : m.displayName))
                .join(', ');
              return (
                <li
                  key={team.id}
                  className="relative rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3.5 hover:border-[rgb(var(--color-accent)/0.5)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {/* La couleur CHOISIE à la création : la pastille prenait
                        la couleur d'accent, la même pour toutes les équipes. */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: team.color }}
                      aria-hidden="true"
                    />
                    {/* Le lien couvre toute la carte (`after:inset-0`) ; le
                        bouton de suppression passe au-dessus (`relative z-10`). */}
                    <Link
                      to={orgTeamPath(team.id)}
                      className="text-sm font-bold text-[rgb(var(--color-text-primary))] flex-1 truncate after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[rgb(var(--color-accent))]"
                    >
                      {team.name}
                    </Link>
                    <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                      {tp('team.memberCount', teamMemberships.length)}
                    </span>
                    {/* Suppression : admin ou créateur SEULEMENT, miroir exact de
                        la policy `org_teams_delete`. Un responsable gère son
                        équipe, il ne la supprime pas. */}
                    {(isAdmin || team.createdBy === currentUserId) && (
                      <button
                        type="button"
                        onClick={() => setTeamToDelete(team)}
                        aria-label={t('team.deleteAria', { name: team.name })}
                        className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                    <ChevronRight size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
                  </div>
                  {team.description && (
                    <p className="mt-1.5 text-xs text-[rgb(var(--color-text-secondary))] line-clamp-2">{team.description}</p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[rgb(var(--color-text-muted))]">
                    {leads.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <Crown size={11} className="text-amber-500 shrink-0" aria-hidden="true" />
                        <span className="flex -space-x-1.5 shrink-0" aria-hidden="true">
                          {leads.slice(0, LEADS_SHOWN).map((m) => (
                            <MemberAvatar key={m.userId} avatar={m.avatar} name={m.displayName} size={18} />
                          ))}
                        </span>
                        <span className="truncate">
                          {leads.length > LEADS_SHOWN
                            ? t('team.leadsMore', { names: leadNames, count: leads.length - LEADS_SHOWN })
                            : leadNames}
                        </span>
                      </span>
                    ) : (
                      <span>{t('teamPage.noLead')}</span>
                    )}
                    <span>{tp('team.projectCount', projectCount)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
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
