import { useMemo } from 'react';
import { Check, Users2 } from 'lucide-react';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import { useMyOrgPermissions } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

interface TeamAssigneeGroupsProps {
  orgId: string;
  /** auth.users.id des assignés déjà choisis. */
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * Sélection d'équipe au-dessus d'une liste de personnes à assigner —
 * sélectionner une équipe ajoute TOUS ses membres à `value` (bascule : si
 * l'équipe est déjà entièrement sélectionnée, le clic la retire entière).
 * N'affiche rien si l'organisation n'a aucune équipe.
 */
const TeamAssigneeGroups = ({ orgId, value, onChange }: TeamAssigneeGroupsProps) => {
  const { t } = useT('org');
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: teamMembers = [] } = useOrgTeamMembers(orgId);
  const { canAssign } = useMyOrgPermissions(orgId);

  const memberIdsByTeam = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tm of teamMembers) {
      const arr = map.get(tm.teamId);
      if (arr) arr.push(tm.userId);
      else map.set(tm.teamId, [tm.userId]);
    }
    return map;
  }, [teamMembers]);

  if (teams.length === 0) return null;

  /**
   * Membres d'une équipe RÉELLEMENT manipulables : ceux à portée
   * d'assignation, plus ceux déjà cochés (le serveur ne contrôle que les
   * ajouts — retirer une équipe entière doit rester possible). Sans ce filtre,
   * cocher une équipe dont un seul membre est hors portée ferait rejeter TOUT
   * l'enregistrement de la tâche.
   */
  const reachable = (teamId: string) =>
    (memberIdsByTeam.get(teamId) ?? []).filter((id) => canAssign(id) || value.includes(id));

  const toggleTeam = (teamId: string) => {
    const ids = reachable(teamId);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => value.includes(id));
    onChange(allSelected ? value.filter((id) => !ids.includes(id)) : [...new Set([...value, ...ids])]);
  };

  return (
    <div className="border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
      <p className="px-3 pt-2 pb-1 text-caption font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--color-text-muted))' }}>
        {t('team.sectionTitle', { count: teams.length })}
      </p>
      {teams.map((team) => {
        const ids = reachable(team.id);
        const checked = ids.length > 0 && ids.every((id) => value.includes(id));
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => toggleTeam(team.id)}
            disabled={ids.length === 0}
            aria-pressed={checked}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[rgb(var(--color-hover))] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="w-[26px] h-[26px] rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
              <Users2 size={13} aria-hidden="true" />
            </span>
            <span className="text-sm truncate flex-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {team.name} <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>({ids.length})</span>
            </span>
            <span
              className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                checked ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]' : 'border-[rgb(var(--color-border))]'
              }`}
              aria-hidden="true"
            >
              {checked && <Check size={13} />}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default TeamAssigneeGroups;
