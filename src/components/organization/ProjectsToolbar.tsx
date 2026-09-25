// ═══════════════════════════════════════════════════════════════════
// Onglet Projets — barre d'outils
//
// « Comment je le regarde ? » (vue, colonnes, lignes, sélection) et « qu'est-ce
// que je crée ? ». « Qu'est-ce que je regarde ? » (personne, équipe, état,
// recherche) est passé le 2026-09-25 dans `OrgTaskFilterBar`, la barre de
// filtres partagée avec l'onglet Tâches, et dans l'URL.
// ═══════════════════════════════════════════════════════════════════

import { Plus, LayoutList, SquareKanban, CalendarRange, Table2, ListChecks } from 'lucide-react';
import type { ProjectsUiPrefs } from './team-projects.helpers';
import { useT } from '@/i18n/useT';
import { PermissionGate } from './permission-hints';

interface ProjectsToolbarProps {
  prefs: ProjectsUiPrefs;
  updatePrefs: (patch: Partial<ProjectsUiPrefs>) => void;
  /** Droit `project.create` — affiche « Nouveau projet ». */
  canCreateProject: boolean;
  /** Pourquoi « Nouveau projet » est grisé, quand il l'est. */
  createDeniedReason?: string;
  onNewProject: () => void;
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

const ProjectsToolbar = ({
  prefs, updatePrefs, canCreateProject, createDeniedReason, onNewProject, effectiveView, onStartSelect,
}: ProjectsToolbarProps) => {
  const { t } = useT('org');
  const { t: pf } = useT('portfolio');
  // La barre ne porte QUE le périmètre, la vue et la création. Les deux réglages
  // rares qui vivaient ici (densité, sélection multiple) n'y sont plus : la
  // sélection est passée dans le menu de chaque projet, là où sont les tâches ;
  // `showArchived` reste sur la bascule contextuelle du bas de liste, qui
  // affiche le compte et n'existe que s'il y a des archives.
  const { kanbanGroupBy, timelineGroupBy } = prefs;
  const view = effectiveView;
  const chooseView = (next: ProjectsUiPrefs['view']) => updatePrefs({ view: next, viewChosen: true });

  const segBase = 'h-8 px-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';
  const segOn = 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]';
  const segOff = 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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

          {/* La seule action créative de la page — et donc le seul bouton plein.
              L'état vide proposait déjà cet indigo : la barre s'aligne dessus
              au lieu de peindre « Nouveau projet » comme un réglage. */}
          <PermissionGate reason={canCreateProject ? undefined : createDeniedReason}>
            <button
              type="button"
              onClick={onNewProject}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-background))]"
              aria-label={t('projects.newProject')}
            >
              <Plus size={15} aria-hidden="true" />
              <span className="hidden sm:inline">{t('projects.newProject')}</span>
            </button>
          </PermissionGate>
        </div>
      </div>

    </div>
  );
};

export default ProjectsToolbar;
