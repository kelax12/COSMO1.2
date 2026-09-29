// ═══════════════════════════════════════════════════════════════════
// LA barre de filtres des tâches du mode entreprise (Tâches ET Projets)
//
// Une ligne pour « qu'est-ce que je regarde ? » : recherche, périmètre
// (tout / moi / une personne / une équipe), état. Puis, seulement s'il y en a,
// la rangée des filtres actifs avec « Tout effacer ». L'état vit dans l'URL
// (`task-filters.ts`) : les deux onglets posent la même question avec le même
// geste, et un lien partage ce qu'on voit.
//
// Composant présentationnel : il affiche et modifie `filters`, il ne filtre rien.
// ═══════════════════════════════════════════════════════════════════

import { Search, UserRound, Users, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import type { TeamProject } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import MemberAvatar from './MemberAvatar';
import TeamColorDot from './TeamColorDot';
import type { TaskStatusFilter } from './team-projects.helpers';
import { CLEARED_ATTRIBUTE_FILTERS, type OrgTaskFilters } from './task-filters';

interface OrgTaskFilterBarProps {
  filters: OrgTaskFilters;
  setFilters: (patch: Partial<OrgTaskFilters>) => void;
  /** État par défaut de l'onglet : c'est lui que « Tout effacer » rétablit. */
  defaultStatus: TaskStatusFilter;
  members: OrgMember[];
  teams: OrgTeam[];
  /** Pour nommer le projet filtré dans sa puce (onglet Tâches). */
  projects?: TeamProject[];
  currentUserId?: string;
  searchPlaceholder: string;
  searchAria: string;
  /** « + Créer une équipe » au bas du menu d'équipe, si le droit existe. */
  onCreateTeam?: () => void;
  /** Ce que la barre trie. `projects` : onglet Projets, sans pastilles d'état
   *  (répartition Projets / Tâches du 2026-09-27). */
  entity?: 'tasks' | 'projects';
}

const segBase = 'h-8 px-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';
const segOn = 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-sm';
const segOff = 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]';

const OrgTaskFilterBar = ({
  filters, setFilters, defaultStatus, members, teams, projects = [], currentUserId,
  searchPlaceholder, searchAria, onCreateTeam, entity = 'tasks',
}: OrgTaskFilterBarProps) => {
  // Catalogue `portfolio`, chargé avec les deux seuls onglets qui montrent cette
  // barre (Tâches, Projets) : `org` est payé par toute visite de /entreprise.
  const { t } = useT('portfolio');
  const { team, assignee, project, status, q } = filters;

  const scopeIsAll = assignee === null && team === '';
  const scopeIsMine = !!currentUserId && assignee === currentUserId && team === '';
  const assigneeMember = members.find((m) => m.userId === assignee);
  const scopeIsMember = !!assignee && assignee !== currentUserId;
  const selectedTeam = teams.find((tm) => tm.id === team);
  const teamLabel = team === 'org' ? t('filters.orgNoTeam') : selectedTeam?.name ?? t('filters.allTeams');
  const statusLabel: Record<TaskStatusFilter, string> = {
    open: t('filters.statusOpen'),
    overdue: t('filters.statusOverdue'),
    doneThisWeek: t('filters.statusDoneThisWeek'),
    all: t('filters.statusAll'),
  };

  // ─── Filtres actifs : un seul endroit pour voir CE QUI filtre ─────
  const chips: { key: string; label: string; clear: Partial<OrgTaskFilters> }[] = [];
  if (q.trim()) chips.push({ key: 'q', label: t('filters.chipSearch', { query: q.trim() }), clear: { q: '' } });
  if (assignee && assigneeMember) {
    chips.push({
      key: 'assignee',
      label: t('filters.chipAssignee', { name: assignee === currentUserId ? t('filters.you') : assigneeMember.displayName }),
      clear: { assignee: null },
    });
  }
  if (team) chips.push({ key: 'team', label: t('filters.chipTeam', { name: teamLabel }), clear: { team: '' } });
  const projectName = project ? projects.find((p) => p.id === project)?.name : undefined;
  if (project && projectName) chips.push({ key: 'project', label: t('filters.chipProject', { name: projectName }), clear: { project: null } });
  if (status !== defaultStatus) chips.push({ key: 'status', label: statusLabel[status], clear: { status: defaultStatus } });

  // Efface aussi les filtres d'attributs (priorité, échéance, catégorie)
  // : « Tout effacer » ne doit rien laisser filtrer en silence.
  // Le texte cherché est déjà DANS le champ : pas de pastille pour lui.
  const pills = chips.filter((chip) => chip.key !== 'q');
  const clearAll = () => setFilters({ team: '', assignee: null, project: null, status: defaultStatus, q: '', ...CLEARED_ATTRIBUTE_FILTERS });

  return (
    <div className="space-y-2" role="group" aria-label={t('filters.barAria')}>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Recherche, avec les filtres actifs en pastilles DANS le champ
            (2026-09-28) : la ligne « Filtres actifs » en dessous coûtait une
            rangée entière pour une ou deux étiquettes. Retour arrière dans un
            champ vide retire la dernière pastille, comme un champ d'étiquettes. */}
        <div
          className="relative flex-1 min-w-[180px] max-w-md flex items-center flex-wrap gap-1 min-h-9 pl-8 pr-1 py-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] focus-within:border-[rgb(var(--color-accent-solid))] cursor-text"
          onClick={(e) => e.currentTarget.querySelector('input')?.focus()}
        >
          <Search size={14} className="absolute left-3 top-[1.125rem] -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          {pills.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1 h-7 rounded-full bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 text-xs font-medium whitespace-nowrap">
              {chip.label}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFilters(chip.clear); }}
                aria-label={t('filters.removeFilter', { name: chip.label })}
                className="w-4 h-4 rounded-full inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-indigo-500/20 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            type="search"
            value={q}
            onChange={(e) => setFilters({ q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && q === '' && pills.length > 0) setFilters(pills[pills.length - 1].clear);
            }}
            placeholder={pills.length > 0 ? undefined : searchPlaceholder}
            aria-label={searchAria}
            className="flex-1 min-w-[6rem] h-7 px-1 no-input-chrome bg-transparent text-sm text-[rgb(var(--color-text-primary))] focus:outline-none"
          />
          {chips.length > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              aria-label={t('filters.clearAll')}
              title={t('filters.clearAll')}
              className="shrink-0 w-7 h-7 rounded-md inline-flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] hover:text-[rgb(var(--color-text-secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Périmètre : tout / moi / une personne / une équipe */}
        <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setFilters({ assignee: null, team: '' })}
            aria-pressed={scopeIsAll}
            className={`${segBase} ${scopeIsAll ? segOn : segOff}`}
          >
            {t('filters.scopeAll')}
          </button>
          {currentUserId && (
            <button
              type="button"
              onClick={() => setFilters({ assignee: currentUserId, team: '' })}
              aria-pressed={scopeIsMine}
              className={`${segBase} ${scopeIsMine ? segOn : segOff}`}
            >
              {t('filters.scopeMine')}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('filters.filterAssignee')}
              aria-pressed={scopeIsMember}
              className={`${segBase} inline-flex items-center gap-1.5 ${scopeIsMember ? segOn : segOff}`}
            >
              {scopeIsMember && assigneeMember ? (
                <>
                  <MemberAvatar avatar={assigneeMember.avatar} name={assigneeMember.displayName} size={18} />
                  <span className="max-w-[100px] truncate">{assigneeMember.displayName}</span>
                </>
              ) : (
                <>
                  <UserRound size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">{t('filters.scopeMember')}</span>
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
              <DropdownMenuLabel>{entity === 'projects' ? t('filters.seeProjectsOf') : t('filters.seeTasksOf')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setFilters({ assignee: null })}>
                <span className="text-[rgb(var(--color-text-muted))]">{t('filters.everyone')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {members.map((m) => (
                <DropdownMenuItem key={m.userId} onClick={() => setFilters({ assignee: m.userId })}>
                  <MemberAvatar avatar={m.avatar} name={m.displayName} size={22} />
                  <span className="truncate">{m.userId === currentUserId ? t('filters.you') : m.displayName}</span>
                  {m.userId === assignee && (
                    <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {(teams.length > 0 || onCreateTeam) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t('filters.filterTeam')}
                aria-pressed={team !== ''}
                className={`${segBase} inline-flex items-center gap-1.5 ${team !== '' ? segOn : segOff}`}
              >
                {selectedTeam ? <TeamColorDot color={selectedTeam.color} /> : <Users size={14} aria-hidden="true" />}
                <span className="hidden sm:inline max-w-[100px] truncate">{team === '' ? t('filters.teamLabel') : teamLabel}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                <DropdownMenuItem onClick={() => setFilters({ team: '' })}>
                  <span>{t('filters.allTeams')}</span>
                  {team === '' && <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilters({ team: 'org' })}>
                  <span>{t('filters.orgNoTeam')}</span>
                  {team === 'org' && <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">✓</span>}
                </DropdownMenuItem>
                {teams.length > 0 && <DropdownMenuSeparator />}
                {teams.map((tm) => (
                  <DropdownMenuItem key={tm.id} onClick={() => setFilters({ team: tm.id })}>
                    <TeamColorDot color={tm.color} />
                    <span className="truncate">{tm.name}</span>
                    {tm.id === team && <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">✓</span>}
                  </DropdownMenuItem>
                ))}
                {onCreateTeam && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onCreateTeam}>
                      <span className="text-indigo-600 dark:text-indigo-400">{t('filters.createTeamOption')}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Plus de pastilles d'état ici (2026-09-28) : « Terminées cette
            semaine » est un préréglage (`FilterPresets`), « Tout » est retiré. */}
      </div>

    </div>
  );
};

export default OrgTaskFilterBar;
