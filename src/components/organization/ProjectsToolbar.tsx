// ═══════════════════════════════════════════════════════════════════
// Onglet Projets — barre d'outils
//
// Une ligne, trois questions, dans cet ordre de lecture :
//   1. « qu'est-ce que je regarde ? »  → périmètre (personne, équipe)
//   2. « comment je le regarde ? »     → vue + réglages rares (menu ⋯)
//   3. « qu'est-ce que je crée ? »     → action primaire, seule pleine
//
// L'ancienne barre alignait 12 contrôles dans quatre grammaires visuelles
// différentes (pastille, segment, select, icône seule) pour exprimer la même
// chose. Chaque regroupement ci-dessous corrige un état illisible précis —
// les commentaires le disent au cas par cas.
// ═══════════════════════════════════════════════════════════════════

import { Plus, LayoutList, SquareKanban, CalendarRange, UserRound, X, ChevronDown } from 'lucide-react';
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
import MemberAvatar from './MemberAvatar';
import type { ProjectsUiPrefs, TaskStatusFilter } from './team-projects.helpers';
import { useT } from '@/i18n/useT';

interface ProjectsToolbarProps {
  members: OrgMember[];
  teams: OrgTeam[];
  currentUserId?: string;
  prefs: ProjectsUiPrefs;
  updatePrefs: (patch: Partial<ProjectsUiPrefs>) => void;
  isManager: boolean;
  onNewProject: () => void;
}

/** Onglet de vue — un mot, pas un carré : trois icônes de vue se ressemblent
 *  toutes, et leur `title` n'apparaît jamais sur écran tactile. */
const ViewTab = ({ active, onClick, label, Icon }: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: typeof LayoutList;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    // Le libellé se replie sous 640 px : sans `aria-label`, le bouton n'aurait
    // plus aucun nom accessible là où il n'est plus qu'une icône.
    aria-label={label}
    className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 ${
      active
        ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]'
        : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
    }`}
  >
    <Icon size={15} aria-hidden="true" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

/** Chip de filtre actif : lecture + retrait, jamais d'activation. */
const FilterChip = ({ label, removeLabel, onRemove }: {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}) => (
  <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 text-xs font-medium">
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={removeLabel}
      className="w-4 h-4 rounded-full inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-indigo-500/20 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <X size={11} aria-hidden="true" />
    </button>
  </span>
);

const ProjectsToolbar = ({
  members, teams, currentUserId, prefs, updatePrefs, isManager, onNewProject,
}: ProjectsToolbarProps) => {
  const { t } = useT('org');
  // La barre ne porte QUE le périmètre, la vue et la création. Les deux réglages
  // rares qui vivaient ici (densité, sélection multiple) n'y sont plus : la
  // sélection est passée dans le menu de chaque projet, là où sont les tâches ;
  // `showArchived` reste sur la bascule contextuelle du bas de liste, qui
  // affiche le compte et n'existe que s'il y a des archives.
  const { assigneeFilter, teamFilter, view, statusFilter, kanbanGroupBy, timelineGroupBy } = prefs;

  // Le périmètre a TROIS branches, pas deux. L'ancienne barre n'en montrait que
  // deux : choisir un collègue laissait « Toutes » et « Mes tâches » également
  // éteints, et plus rien ne disait que la liste était filtrée.
  const scopeIsAll = assigneeFilter === null;
  const scopeIsMine = !!currentUserId && assigneeFilter === currentUserId;
  const scopeIsMember = !!assigneeFilter && assigneeFilter !== currentUserId;
  const filteredMember = members.find((m) => m.userId === assigneeFilter);

  const segBase = 'h-8 px-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';
  const segOn = 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]';
  const segOff = 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]';

  const selectedTeam = teams.find((tm) => tm.id === teamFilter);
  const teamLabel =
    teamFilter === '' ? t('projects.allTeams')
      : teamFilter === 'org' ? t('projects.orgNoTeam')
        : selectedTeam?.name ?? t('projects.allTeams');

  // ─── Chips des filtres actifs ────────────────────────────────────
  // Un seul endroit pour voir CE QUI filtre et tout retirer. Les quatre axes
  // sont persistés par organisation : sans ce récapitulatif, on revient trois
  // jours plus tard sur une liste filtrée sans se rappeler l'avoir filtrée.
  const statusChipLabel: Record<Exclude<TaskStatusFilter, 'all'>, string> = {
    open: t('projects.chipOpen'),
    overdue: t('projects.chipOverdue'),
    doneThisWeek: t('projects.chipDone'),
  };

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (scopeIsMember && filteredMember) {
    chips.push({
      key: 'assignee',
      label: t('projects.chipAssignee', { name: filteredMember.displayName }),
      onRemove: () => updatePrefs({ assigneeFilter: null }),
    });
  }
  if (teamFilter !== '') {
    chips.push({
      key: 'team',
      label: t('projects.chipTeam', { name: teamLabel }),
      onRemove: () => updatePrefs({ teamFilter: '' }),
    });
  }
  if (statusFilter !== 'all') {
    chips.push({
      key: 'status',
      label: statusChipLabel[statusFilter],
      onRemove: () => updatePrefs({ statusFilter: 'all' }),
    });
  }

  const clearAll = () =>
    updatePrefs({ assigneeFilter: null, teamFilter: '', statusFilter: 'all' });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* ── Périmètre : qu'est-ce que je regarde ? ─────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => updatePrefs({ assigneeFilter: null })}
              aria-pressed={scopeIsAll}
              className={`${segBase} ${scopeIsAll ? segOn : segOff}`}
            >
              {t('projects.scopeAll')}
            </button>
            {currentUserId && (
              <button
                type="button"
                onClick={() => updatePrefs({ assigneeFilter: currentUserId })}
                aria-pressed={scopeIsMine}
                className={`${segBase} ${scopeIsMine ? segOn : segOff}`}
              >
                {t('projects.scopeMine')}
              </button>
            )}

            {/* Le 3ᵉ segment EST le menu des membres : il porte l'avatar de la
                personne filtrée, donc l'état ne peut plus être muet. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t('projects.filterAssignee')}
                aria-pressed={scopeIsMember}
                className={`${segBase} inline-flex items-center gap-1.5 ${scopeIsMember ? segOn : segOff}`}
              >
                {scopeIsMember && filteredMember ? (
                  <>
                    <MemberAvatar avatar={filteredMember.avatar} name={filteredMember.displayName} size={18} />
                    <span className="max-w-[100px] truncate">{filteredMember.displayName}</span>
                  </>
                ) : (
                  <>
                    <UserRound size={14} aria-hidden="true" />
                    <span className="hidden sm:inline">{t('projects.scopeMember')}</span>
                  </>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                <DropdownMenuLabel>{t('projects.seeTasksOf')}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => updatePrefs({ assigneeFilter: null })}>
                  <span className="text-[rgb(var(--color-text-muted))]">{t('projects.everyone')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.map((m) => (
                  <DropdownMenuItem key={m.userId} onClick={() => updatePrefs({ assigneeFilter: m.userId })}>
                    <MemberAvatar avatar={m.avatar} name={m.displayName} size={22} />
                    <span className="truncate">{m.userId === currentUserId ? t('projects.you') : m.displayName}</span>
                    {m.userId === assigneeFilter && (
                      <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Le libellé nomme l'axe : « Toutes les équipes » seul ne disait pas
              de quoi il parlait au milieu de trois autres filtres.

              Le <select> N'EST PAS enveloppé dans un conteneur bordé : une
              règle globale (index.css, « Global Input Styles ») pose déjà
              `border` + `rounded-lg` en `!important` sur TOUT <select> de
              l'app — un `border-0` local ne peut pas gagner contre un
              `!important`, d'où le double liséré observé. Le pattern déjà en
              place ailleurs (TaskFilter, TaskSidebar) laisse le <select>
              porter sa propre bordure ; on s'y aligne au lieu de la
              recouvrir d'une seconde. */}
          {teams.length > 0 && (
            <label className="inline-flex items-center gap-1.5 text-sm text-[rgb(var(--color-text-muted))]">
              <span className="hidden sm:inline">{t('projects.teamLabel')}</span>
              <span className="relative inline-flex items-center">
                <select
                  value={teamFilter}
                  onChange={(e) => updatePrefs({ teamFilter: e.target.value })}
                  aria-label={t('projects.filterTeam')}
                  className="appearance-none h-9 pl-2.5 pr-6 bg-[rgb(var(--color-surface))] text-sm font-medium text-[rgb(var(--color-text-primary))] max-w-[9rem] cursor-pointer"
                >
                  <option value="">{t('projects.allTeams')}</option>
                  <option value="org">{t('projects.orgNoTeam')}</option>
                  {teams.map((tm) => (
                    <option key={tm.id} value={tm.id}>{tm.name}</option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 text-[rgb(var(--color-text-muted))]"
                />
              </span>
            </label>
          )}
        </div>

        {/* ── Vue, réglages rares, action primaire ───────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5"
            role="group"
            aria-label={t('projects.viewLabel')}
          >
            <ViewTab active={view === 'list'} onClick={() => updatePrefs({ view: 'list' })} label={t('projects.viewList')} Icon={LayoutList} />
            <ViewTab active={view === 'kanban'} onClick={() => updatePrefs({ view: 'kanban' })} label={t('projects.viewKanban')} Icon={SquareKanban} />
            <ViewTab active={view === 'timeline'} onClick={() => updatePrefs({ view: 'timeline' })} label={t('projects.viewTimeline')} Icon={CalendarRange} />
          </div>

          {/* Axe des colonnes du Tableau — juste à côté de l'onglet qui le
              montre, pas loin en dessous : c'est ce qui le rendait invisible.
              N'existe QUE quand « Tableau » est actif, disparaît sinon. */}
          {view === 'kanban' && (
            <div className="inline-flex items-center gap-1.5">
              <span className="hidden md:inline text-xs text-[rgb(var(--color-text-muted))]">{t('projects.columnsLabel')}</span>
              <div
                className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5"
                role="group"
                aria-label={t('projects.columnsLabel')}
              >
                <button
                  type="button"
                  onClick={() => updatePrefs({ kanbanGroupBy: 'status' })}
                  aria-pressed={kanbanGroupBy === 'status'}
                  className={`${segBase} ${kanbanGroupBy === 'status' ? segOn : segOff}`}
                >
                  {t('projects.groupByStatus')}
                </button>
                <button
                  type="button"
                  onClick={() => updatePrefs({ kanbanGroupBy: 'assignee' })}
                  aria-pressed={kanbanGroupBy === 'assignee'}
                  className={`${segBase} ${kanbanGroupBy === 'assignee' ? segOn : segOff}`}
                >
                  {t('projects.groupByAssignee')}
                </button>
              </div>
            </div>
          )}

          {/* Axe des lignes du Planning — même geste, même vocabulaire que
              « Colonnes » ci-dessus. N'existe QUE quand « Planning » est actif. */}
          {view === 'timeline' && (
            <div className="inline-flex items-center gap-1.5">
              <span className="hidden md:inline text-xs text-[rgb(var(--color-text-muted))]">{t('projects.rowsLabel')}</span>
              <div
                className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5"
                role="group"
                aria-label={t('projects.rowsLabel')}
              >
                <button
                  type="button"
                  onClick={() => updatePrefs({ timelineGroupBy: 'project' })}
                  aria-pressed={timelineGroupBy === 'project'}
                  className={`${segBase} ${timelineGroupBy === 'project' ? segOn : segOff}`}
                >
                  {t('projects.groupByProject')}
                </button>
                <button
                  type="button"
                  onClick={() => updatePrefs({ timelineGroupBy: 'assignee' })}
                  aria-pressed={timelineGroupBy === 'assignee'}
                  className={`${segBase} ${timelineGroupBy === 'assignee' ? segOn : segOff}`}
                >
                  {t('projects.groupByAssignee')}
                </button>
              </div>
            </div>
          )}

          {/* La seule action créative de la page — et donc le seul bouton plein.
              L'état vide proposait déjà cet indigo : la barre s'aligne dessus
              au lieu de peindre « Nouveau projet » comme un réglage. */}
          {isManager && (
            <button
              type="button"
              onClick={onNewProject}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-background))]"
              aria-label={t('projects.newProject')}
            >
              <Plus size={15} aria-hidden="true" />
              <span className="hidden sm:inline">{t('projects.newProject')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Rangée de chips — n'existe que s'il y a quelque chose à dire. */}
      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('projects.activeFilters')}</span>
          {chips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              removeLabel={t('projects.removeFilter', { name: chip.label })}
              onRemove={chip.onRemove}
            />
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-[rgb(var(--color-text-muted))] underline underline-offset-2 hover:text-[rgb(var(--color-text-secondary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            {t('projects.clearAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectsToolbar;
