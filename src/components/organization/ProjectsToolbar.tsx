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

import { Plus, LayoutList, SquareKanban, CalendarRange, UserRound, Users, X, Table2, ListChecks } from 'lucide-react';
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
import { projectPrefsToViewParams, viewParamsToProjectPrefs, type ProjectsUiPrefs, type TaskStatusFilter } from './team-projects.helpers';
import SavedViewsMenu from './SavedViewsMenu';
import { useT } from '@/i18n/useT';

interface ProjectsToolbarProps {
  /** Vues enregistrées (mig. 192) — absent : pas de menu « Vues ». */
  orgId?: string;
  members: OrgMember[];
  teams: OrgTeam[];
  currentUserId?: string;
  prefs: ProjectsUiPrefs;
  updatePrefs: (patch: Partial<ProjectsUiPrefs>) => void;
  /** Droit `project.create` — affiche « Nouveau projet ». */
  canCreateProject: boolean;
  /** Droit `team.create` — affiche « Créer une équipe » dans le sélecteur. */
  canCreateTeam: boolean;
  onNewProject: () => void;
  /** Ouvre la création d'équipe — n'existe que si le sélecteur d'équipe est
   *  affiché (au moins une équipe déjà créée). */
  onCreateTeam: () => void;
  /** Vue réellement affichée (le portefeuille peut s'imposer sans choix, M2). */
  effectiveView: ProjectsUiPrefs['view'];
  /**
   * Entre en sélection multiple — dans TOUTES les vues de tâches depuis le
   * 2026-09-24. Absent en vue portefeuille, qui n'affiche aucune tâche.
   */
  onStartSelect?: () => void;
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
  orgId, members, teams, currentUserId, prefs, updatePrefs, canCreateProject, canCreateTeam, onNewProject, onCreateTeam,
  effectiveView, onStartSelect,
}: ProjectsToolbarProps) => {
  const { t } = useT('org');
  const { t: pf } = useT('portfolio');
  // La barre ne porte QUE le périmètre, la vue et la création. Les deux réglages
  // rares qui vivaient ici (densité, sélection multiple) n'y sont plus : la
  // sélection est passée dans le menu de chaque projet, là où sont les tâches ;
  // `showArchived` reste sur la bascule contextuelle du bas de liste, qui
  // affiche le compte et n'existe que s'il y a des archives.
  const { assigneeFilter, teamFilter, statusFilter, kanbanGroupBy, timelineGroupBy } = prefs;
  const view = effectiveView;
  const chooseView = (next: ProjectsUiPrefs['view']) => updatePrefs({ view: next, viewChosen: true });

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
    teamFilter === '' ? pf('toolbar.allTeams')
      : teamFilter === 'org' ? pf('toolbar.orgNoTeam')
        : selectedTeam?.name ?? pf('toolbar.allTeams');

  // ─── Chips des filtres actifs ────────────────────────────────────
  // Un seul endroit pour voir CE QUI filtre et tout retirer. Les quatre axes
  // sont persistés par organisation : sans ce récapitulatif, on revient trois
  // jours plus tard sur une liste filtrée sans se rappeler l'avoir filtrée.
  const statusChipLabel: Record<Exclude<TaskStatusFilter, 'all'>, string> = {
    open: pf('toolbar.chipOpen'),
    overdue: pf('toolbar.chipOverdue'),
    doneThisWeek: pf('toolbar.chipDone'),
  };

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (scopeIsMember && filteredMember) {
    chips.push({
      key: 'assignee',
      label: pf('toolbar.chipAssignee', { name: filteredMember.displayName }),
      onRemove: () => updatePrefs({ assigneeFilter: null }),
    });
  }
  if (teamFilter !== '') {
    chips.push({
      key: 'team',
      label: pf('toolbar.chipTeam', { name: teamLabel }),
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
              onClick={() => updatePrefs({ assigneeFilter: null, teamFilter: '' })}
              aria-pressed={scopeIsAll && teamFilter === ''}
              className={`${segBase} ${scopeIsAll && teamFilter === '' ? segOn : segOff}`}
            >
              {pf('toolbar.scopeAll')}
            </button>
            {currentUserId && (
              <button
                type="button"
                onClick={() => updatePrefs({ assigneeFilter: currentUserId, teamFilter: '' })}
                aria-pressed={scopeIsMine && teamFilter === ''}
                className={`${segBase} ${scopeIsMine && teamFilter === '' ? segOn : segOff}`}
              >
                {pf('toolbar.scopeMine')}
              </button>
            )}

            {/* Le 3ᵉ segment EST le menu des membres : il porte l'avatar de la
                personne filtrée, donc l'état ne peut plus être muet. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={pf('toolbar.filterAssignee')}
                aria-pressed={scopeIsMember && teamFilter === ''}
                className={`${segBase} inline-flex items-center gap-1.5 ${scopeIsMember && teamFilter === '' ? segOn : segOff}`}
              >
                {scopeIsMember && teamFilter === '' && filteredMember ? (
                  <>
                    <MemberAvatar avatar={filteredMember.avatar} name={filteredMember.displayName} size={18} />
                    <span className="max-w-[100px] truncate">{filteredMember.displayName}</span>
                  </>
                ) : (
                  <>
                    <UserRound size={14} aria-hidden="true" />
                    <span className="hidden sm:inline">{pf('toolbar.scopeMember')}</span>
                  </>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                <DropdownMenuLabel>{pf('toolbar.seeTasksOf')}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => updatePrefs({ assigneeFilter: null, teamFilter: '' })}>
                  <span className="text-[rgb(var(--color-text-muted))]">{pf('toolbar.everyone')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.map((m) => (
                  <DropdownMenuItem key={m.userId} onClick={() => updatePrefs({ assigneeFilter: m.userId, teamFilter: '' })}>
                    <MemberAvatar avatar={m.avatar} name={m.displayName} size={22} />
                    <span className="truncate">{m.userId === currentUserId ? pf('toolbar.you') : m.displayName}</span>
                    {m.userId === assigneeFilter && (
                      <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 4ᵉ segment : équipe, même grammaire que « Une personne » — un
                menu dont le déclencheur porte l'état sélectionné. Avant, ce
                filtre vivait dans un `<select>` séparé hors du groupe : rien
                ne disait qu'il appartenait au même axe « qu'est-ce que je
                regarde ? » que Tout / Moi / Une personne. */}
            {teams.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={pf('toolbar.filterTeam')}
                  aria-pressed={teamFilter !== ''}
                  className={`${segBase} inline-flex items-center gap-1.5 ${teamFilter !== '' ? segOn : segOff}`}
                >
                  <Users size={14} aria-hidden="true" />
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {teamFilter === '' ? pf('toolbar.teamLabel') : teamLabel}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>{pf('toolbar.filterTeam')}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => updatePrefs({ teamFilter: '' })}>
                    <span className="text-[rgb(var(--color-text-muted))]">{pf('toolbar.allTeams')}</span>
                    {teamFilter === '' && (
                      <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updatePrefs({ teamFilter: 'org', assigneeFilter: null })}>
                    <span>{pf('toolbar.orgNoTeam')}</span>
                    {teamFilter === 'org' && (
                      <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {teams.map((tm) => (
                    <DropdownMenuItem key={tm.id} onClick={() => updatePrefs({ teamFilter: tm.id, assigneeFilter: null })}>
                      <span className="truncate">{tm.name}</span>
                      {tm.id === teamFilter && (
                        <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]" aria-hidden="true">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  {canCreateTeam && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onCreateTeam}>
                        <span className="text-indigo-600 dark:text-indigo-400">{pf('toolbar.createTeamOption')}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ── Vue, réglages rares, action primaire ───────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5"
            role="group"
            aria-label={pf('toolbar.viewLabel')}
          >
            <ViewTab active={view === 'portfolio'} onClick={() => chooseView('portfolio')} label={pf('viewPortfolio')} Icon={Table2} />
            <ViewTab active={view === 'list'} onClick={() => chooseView('list')} label={pf('toolbar.viewList')} Icon={LayoutList} />
            <ViewTab active={view === 'kanban'} onClick={() => chooseView('kanban')} label={pf('toolbar.viewKanban')} Icon={SquareKanban} />
            <ViewTab active={view === 'timeline'} onClick={() => chooseView('timeline')} label={pf('toolbar.viewTimeline')} Icon={CalendarRange} />
          </div>

          {/* Sélection multiple, à côté des vues : elle vaut pour les trois vues
              de tâches (audit 2026-09-24), plus seulement pour la liste. */}
          {onStartSelect && view !== 'portfolio' && (
            <button
              type="button"
              onClick={onStartSelect}
              aria-label={pf('bulk.selectToggleAria')}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-[rgb(var(--color-border))] text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60"
            >
              <ListChecks size={15} aria-hidden="true" />
              <span className="hidden sm:inline">{pf('bulk.selectToggle')}</span>
            </button>
          )}

          {/* Axe des colonnes du Tableau — juste à côté de l'onglet qui le
              montre, pas loin en dessous : c'est ce qui le rendait invisible.
              N'existe QUE quand « Tableau » est actif, disparaît sinon. */}
          {view === 'kanban' && (
            <div className="inline-flex items-center gap-1.5">
              <span className="hidden md:inline text-xs text-[rgb(var(--color-text-muted))]">{pf('toolbar.columnsLabel')}</span>
              <div
                className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5"
                role="group"
                aria-label={pf('toolbar.columnsLabel')}
              >
                <button
                  type="button"
                  onClick={() => updatePrefs({ kanbanGroupBy: 'status' })}
                  aria-pressed={kanbanGroupBy === 'status'}
                  className={`${segBase} ${kanbanGroupBy === 'status' ? segOn : segOff}`}
                >
                  {pf('toolbar.groupByStatus')}
                </button>
                <button
                  type="button"
                  onClick={() => updatePrefs({ kanbanGroupBy: 'assignee' })}
                  aria-pressed={kanbanGroupBy === 'assignee'}
                  className={`${segBase} ${kanbanGroupBy === 'assignee' ? segOn : segOff}`}
                >
                  {pf('toolbar.groupByAssignee')}
                </button>
              </div>
            </div>
          )}

          {/* Axe des lignes du Planning — même geste, même vocabulaire que
              « Colonnes » ci-dessus. N'existe QUE quand « Planning » est actif. */}
          {view === 'timeline' && (
            <div className="inline-flex items-center gap-1.5">
              <span className="hidden md:inline text-xs text-[rgb(var(--color-text-muted))]">{pf('toolbar.rowsLabel')}</span>
              <div
                className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5"
                role="group"
                aria-label={pf('toolbar.rowsLabel')}
              >
                <button
                  type="button"
                  onClick={() => updatePrefs({ timelineGroupBy: 'project' })}
                  aria-pressed={timelineGroupBy === 'project'}
                  className={`${segBase} ${timelineGroupBy === 'project' ? segOn : segOff}`}
                >
                  {pf('toolbar.groupByProject')}
                </button>
                <button
                  type="button"
                  onClick={() => updatePrefs({ timelineGroupBy: 'assignee' })}
                  aria-pressed={timelineGroupBy === 'assignee'}
                  className={`${segBase} ${timelineGroupBy === 'assignee' ? segOn : segOff}`}
                >
                  {pf('toolbar.groupByAssignee')}
                </button>
              </div>
            </div>
          )}

          {orgId && (
            <SavedViewsMenu
              orgId={orgId}
              scope="projects"
              current={projectPrefsToViewParams(prefs)}
              onApply={(params) => updatePrefs(viewParamsToProjectPrefs(params))}
            />
          )}

          {/* La seule action créative de la page — et donc le seul bouton plein.
              L'état vide proposait déjà cet indigo : la barre s'aligne dessus
              au lieu de peindre « Nouveau projet » comme un réglage. */}
          {canCreateProject && (
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
          <span className="text-xs text-[rgb(var(--color-text-muted))]">{pf('toolbar.activeFilters')}</span>
          {chips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              removeLabel={pf('toolbar.removeFilter', { name: chip.label })}
              onRemove={chip.onRemove}
            />
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-[rgb(var(--color-text-muted))] underline underline-offset-2 hover:text-[rgb(var(--color-text-secondary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            {pf('toolbar.clearAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectsToolbar;
