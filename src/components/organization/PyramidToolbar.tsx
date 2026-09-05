// ═══════════════════════════════════════════════════════════════════
// Barre d'outils de la pyramide
//
// FRONTIÈRE : ce composant ne connaît ni l'arbre, ni les membres, ni les
// fiches, ni le glisser-déposer. Il reçoit des valeurs d'affichage (une
// requête de recherche, un nombre de résultats, la liste des équipes, deux
// drapeaux d'état) et rappelle. Il ne décide rien : `PyramidTab` reste seul
// à savoir ce qu'un déplacement, une vue par équipe ou un calque de charge
// veulent dire.
//
// Extrait le 2026-09-05 (C-09). Les 160 lignes de contrôles qu'il porte
// vivaient au milieu de l'orchestration de l'arbre, ce qui obligeait à les
// traverser pour lire la mise en page de la pyramide elle-même.
// ═══════════════════════════════════════════════════════════════════
import {
  UserPlus,
  ChevronDown,
  Users,
  Search,
  X,
  Pencil,
  Check,
  TrendingUp,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { OrgTeam } from '@/modules/org-teams';
import { useT } from '@/i18n/useT';

interface PyramidToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  /** Nombre de membres correspondant à la recherche (affiché à côté du champ). */
  matchCount: number;
  teams: OrgTeam[];
  activeTeam: OrgTeam | null;
  viewTeamId: string | null;
  onViewTeamChange: (teamId: string | null) => void;
  isAdmin: boolean;
  onCreateTeam: () => void;
  /** Le compte peut réorganiser (admin, ou manager d'au moins une personne). */
  canEdit: boolean;
  editMode: boolean;
  moveCount: number;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onFinishEdit: () => void;
  /** `null` quand le compte n'est pas lui-même membre de l'organisation. */
  canAddUnderSelf: boolean;
  onAddUnderSelf: () => void;
  showWorkload: boolean;
  onToggleWorkload: () => void;
}

const PyramidToolbar = ({
  query,
  onQueryChange,
  matchCount,
  teams,
  activeTeam,
  viewTeamId,
  onViewTeamChange,
  isAdmin,
  onCreateTeam,
  canEdit,
  editMode,
  moveCount,
  onStartEdit,
  onCancelEdit,
  onFinishEdit,
  canAddUnderSelf,
  onAddUnderSelf,
  showWorkload,
  onToggleWorkload,
}: PyramidToolbarProps) => {
  const { t, tp } = useT('org');

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('pyramid.searchPlaceholder')}
          aria-label={t('pyramid.searchAria')}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-indigo-400 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label={t('pyramid.clearSearch')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>
      {query.trim() && (
        <span className="text-xs text-[rgb(var(--color-text-muted))]" aria-live="polite">
          {tp('pyramid.results', matchCount)}
        </span>
      )}
      {teams.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('pyramid.chooseView')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              activeTeam
                ? 'border-transparent text-white'
                : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
            }`}
            style={activeTeam ? { backgroundColor: activeTeam.color } : undefined}
          >
            {activeTeam ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white/80 shrink-0" aria-hidden="true" />
                {activeTeam.name}
              </>
            ) : (
              <>
                <Users size={14} aria-hidden="true" /> {t('pyramid.wholeOrg')}
              </>
            )}
            <ChevronDown size={13} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
            <DropdownMenuLabel>{t('pyramid.display')}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onViewTeamChange(null)}>
              <Users size={14} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
              {t('pyramid.wholeOrg')}
              {!viewTeamId && <Check size={14} className="ml-auto text-indigo-500" aria-hidden="true" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('pyramid.byTeam')}</DropdownMenuLabel>
            {teams.map((team) => (
              <DropdownMenuItem key={team.id} onClick={() => onViewTeamChange(team.id)}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} aria-hidden="true" />
                <span className="truncate">{team.name}</span>
                {viewTeamId === team.id && <Check size={14} className="ml-auto text-indigo-500 shrink-0" aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                {/* Même endroit d'où l'on regarde « par équipe » que
                    celui où on en crée une — évite l'aller-retour vers
                    l'onglet Membres pour la première équipe. */}
                <DropdownMenuItem onClick={onCreateTeam} className="text-blue-600 dark:text-blue-400">
                  <Plus size={14} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  {t('team.add')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canEdit && (
        <div className="ml-auto flex items-center gap-2">
          {editMode && moveCount > 0 && (
            <span className="text-xs font-semibold text-indigo-500 tabular-nums">
              {tp('pyramid.moveCount', moveCount)}
            </span>
          )}
          {!editMode && canAddUnderSelf && (
            <button
              type="button"
              onClick={onAddUnderSelf}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <UserPlus size={14} aria-hidden="true" /> {t('pyramid.add')}
            </button>
          )}
          {editMode && (
            <button
              type="button"
              onClick={onFinishEdit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
            >
              <Check size={15} aria-hidden="true" /> {t('pyramid.done')}
            </button>
          )}
          {/* Calque de charge — masqué en mode réorganisation : deux
              lectures simultanées de la même carte se gêneraient. */}
          {!editMode && (
            <button
              type="button"
              onClick={onToggleWorkload}
              aria-pressed={showWorkload}
              title={t('pyramid.overlayHint')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                showWorkload
                  ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-text-primary))] bg-[rgb(var(--color-hover))]'
                  : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]'
              }`}
            >
              <TrendingUp size={14} aria-hidden="true" /> {t('pyramid.overlayToggle')}
            </button>
          )}
          <button
            type="button"
            onClick={editMode ? onCancelEdit : onStartEdit}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              editMode
                ? 'border border-red-400/60 text-red-500 hover:bg-red-500/10'
                : 'text-white bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {editMode ? (
              <>
                <X size={15} aria-hidden="true" /> {t('common.cancel')}
              </>
            ) : (
              <>
                <Pencil size={14} aria-hidden="true" /> {t('pyramid.edit')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PyramidToolbar;
