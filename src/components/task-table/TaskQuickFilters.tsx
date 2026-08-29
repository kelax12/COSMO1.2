import React from 'react';
import { Bookmark, BookmarkCheck, CheckCircle2, CheckSquare, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';

export type QuickFilter = 'none' | 'bookmarked' | 'completed' | 'overdue' | 'collaboration';
export type ScopeFilter = 'all' | 'perso' | 'entreprise';

interface Props {
  /** Barre visible sur mobile ? Sur `md` et au-delà elle l'est toujours. */
  visible: boolean;
  active: QuickFilter;
  onToggle: (filter: Exclude<QuickFilter, 'none'>) => void;
  /** Le mode « ajout à une liste » masque l'entrée du mode sélection. */
  addToListMode: boolean;
  selectMode: boolean;
  onToggleSelectMode: () => void;
  /** Sans organisation active, aucune tâche d'équipe ne peut apparaître ici. */
  orgId?: string;
  scope: ScopeFilter;
  onScope: (scope: ScopeFilter) => void;
}

/** Classe des pastilles actives, identique pour les cinq boutons. */
const ACTIF =
  '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-[rgb(var(--color-accent-solid))]';

/**
 * Filtres rapides de la page Tâches : signets, terminées, en retard,
 * collaboration, mode sélection, et la portée perso / entreprise.
 *
 * Extrait de `TaskTable` le 2026-08-29 (T-45). Purement présentationnel :
 * aucun état de filtre ne vit ici. Il reste dans `TaskTable`, qui est le seul
 * à savoir ce qu'il filtre — même règle que `TeamTasksToolbar` côté entreprise,
 * dont la barre d'outils a été extraite sans emporter l'état.
 */
const TaskQuickFilters: React.FC<Props> = ({
  visible,
  active,
  onToggle,
  addToListMode,
  selectMode,
  onToggleSelectMode,
  orgId,
  scope,
  onScope,
}) => {
  const { t } = useT('tasks');
  const { t: tCommon } = useT('common');

  return (
    <div className={`${visible ? 'flex' : 'hidden'} md:flex flex-col gap-4 mb-6`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => onToggle('bookmarked')}
          className={`flex items-center gap-2 ${active === 'bookmarked' ? ACTIF : ''}`}
        >
          {active === 'bookmarked' ? <BookmarkCheck size={20} data-icon="inline-start" /> : <Bookmark size={20} data-icon="inline-start" />}
          <span className="hidden sm:inline">{active === 'bookmarked' ? tCommon('actions.all') : t('table.quickFilter.bookmarked')}</span>
          <span className="sm:hidden">{t('table.quickFilter.bookmarked')}</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => onToggle('completed')}
          className={`flex items-center gap-2 ${active === 'completed' ? ACTIF : ''}`}
        >
          <CheckCircle2 size={20} data-icon="inline-start" />
          <span className="hidden sm:inline">{t('table.quickFilter.completed')}</span>
          <span className="sm:hidden">{t('table.quickFilter.completedShort')}</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => onToggle('overdue')}
          className={`flex items-center gap-2 ${active === 'overdue' ? ACTIF : ''}`}
        >
          <AlertTriangle size={20} data-icon="inline-start" />
          <span className="hidden sm:inline">{t('table.quickFilter.overdue')}</span>
          <span className="sm:hidden">{t('table.quickFilter.overdue')}</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => onToggle('collaboration')}
          className={`flex items-center gap-2 ${active === 'collaboration' ? ACTIF : ''}`}
        >
          <Users size={20} data-icon="inline-start" />
          <span className="hidden sm:inline">{t('table.quickFilter.collaboration')}</span>
          <span className="sm:hidden">{t('table.quickFilter.collaborationShort')}</span>
        </Button>

        {!addToListMode && (
          <Button
            variant="outline"
            onClick={onToggleSelectMode}
            className={`flex items-center gap-2 ${selectMode ? ACTIF : ''}`}
          >
            <CheckSquare size={20} data-icon="inline-start" />
            <span>{selectMode ? t('table.cancelSelect') : t('table.select')}</span>
          </Button>
        )}

        {/* Tout / Perso / Entreprise — visible seulement avec une org active,
            sinon aucune tâche d'équipe ne peut jamais apparaître ici. */}
        {orgId && (
          <div
            role="group"
            aria-label={t('table.quickFilter.scopeAria')}
            className="inline-flex items-center rounded-lg border border-[rgb(var(--color-border))] p-0.5"
          >
            {(['all', 'perso', 'entreprise'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onScope(value)}
                aria-pressed={scope === value}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  scope === value
                    ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))]'
                    : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                }`}
              >
                {t(`table.quickFilter.scope${value === 'all' ? 'All' : value === 'perso' ? 'Perso' : 'Entreprise'}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskQuickFilters;
