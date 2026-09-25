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

import { Search, UserRound, Users, X, AlarmClock, CircleDashed, CheckCircle2 } from 'lucide-react';
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
import { TASK_STATUS_FILTERS, type OrgTaskFilters } from './task-filters';

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
  /** Compteurs affichés dans les pastilles d'état (optionnels). */
  counts?: Partial<Record<TaskStatusFilter, number>>;
  /** « + Créer une équipe » au bas du menu d'équipe, si le droit existe. */
  onCreateTeam?: () => void;
}

const segBase = 'h-8 px-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';
const segOn = 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]';
const segOff = 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]';

const STATUS_ICON: Record<Exclude<TaskStatusFilter, 'all'>, typeof CircleDashed> = {
  open: CircleDashed,
  overdue: AlarmClock,
  doneThisWeek: CheckCircle2,
};

const OrgTaskFilterBar = ({
  filters, setFilters, defaultStatus, members, teams, projects = [], currentUserId,
  searchPlaceholder, searchAria, counts, onCreateTeam,
}: OrgTaskFilterBarProps) => {
  const { t } = useT('org');
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

  const clearAll = () => setFilters({ team: '', assignee: null, project: null, status: defaultStatus, q: '' });

  return (
    <div className="space-y-2" role="group" aria-label={t('filters.barAria')}>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Recherche */}
        <label className="relative flex-1 min-w-[180px] max-w-md">
          <span className="sr-only">{searchAria}</span>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:border-[rgb(var(--color-accent-solid))]"
          />
        </label>

        {/* Périmètre : tout / moi / une personne / une équipe */}
        <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5">
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
              <DropdownMenuLabel>{t('filters.seeTasksOf')}</DropdownMenuLabel>
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

        {/* État : même geste dans les deux onglets */}
        <div className="inline-flex items-center gap-1.5 flex-wrap" role="group" aria-label={t('filters.statusAria')}>
          {TASK_STATUS_FILTERS.map((f) => {
            const Icon = f === 'all' ? null : STATUS_ICON[f];
            const count = counts?.[f];
            const active = status === f;
            return (
              <button
                key={f}
                type="button"
                // Re-cliquer la pastille active revient à « Tout » (grammaire du
                // 2026-08-28) ; « Tout » reste une sortie explicite.
                onClick={() => setFilters({ status: active ? 'all' : f })}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
                    : f === 'overdue' && (count ?? 0) > 0
                      ? 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                      : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))]'
                }`}
              >
                {Icon && <Icon size={12} aria-hidden="true" />}
                {statusLabel[f]}
                {count !== undefined && <span className="tabular-nums opacity-80">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('filters.activeFilters')}</span>
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 text-xs font-medium">
              {chip.label}
              <button
                type="button"
                onClick={() => setFilters(chip.clear)}
                aria-label={t('filters.removeFilter', { name: chip.label })}
                className="w-4 h-4 rounded-full inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-indigo-500/20 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-[rgb(var(--color-text-muted))] underline underline-offset-2 hover:text-[rgb(var(--color-text-secondary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            {t('filters.clearAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default OrgTaskFilterBar;
