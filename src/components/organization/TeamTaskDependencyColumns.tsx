import { ArrowRight, Lock, Plus, X } from 'lucide-react';
import type { TeamTask } from '@/modules/team-projects';
import type { DependencyDirection } from '@/lib/dependency-graph';
import { STATUS_META } from './team-projects.helpers';
import { useT } from '@/i18n/useT';

interface TeamTaskDependencyColumnsProps {
  blockedBy: TeamTask[];
  blocks: TeamTask[];
  /** Seul un gestionnaire modifie le graphe : sans lui, ni « + » ni croix. */
  canEdit: boolean;
  onAdd: (direction: DependencyDirection) => void;
  onRemove: (item: TeamTask, direction: DependencyDirection) => void;
}

/**
 * Dépendances en deux colonnes (maquette 1 du 2026-10-30) : à gauche ce qui
 * bloque la tâche (« puis-je commencer ? »), à droite ce qu'elle bloque
 * (« qui je retarde si je glisse ? »). Chaque colonne a son propre « + »,
 * qui ouvre le sélecteur déjà orienté dans le bon sens.
 *
 * Composant PRÉSENTATIONNEL : la fiche enregistrée (`TeamTaskDependenciesSection`)
 * et le brouillon de création (`DraftDependenciesEditor`) le partagent.
 */
const TeamTaskDependencyColumns = ({ blockedBy, blocks, canEdit, onAdd, onRemove }: TeamTaskDependencyColumnsProps) => {
  const { t } = useT('org');

  const column = (direction: DependencyDirection, items: TeamTask[]) => {
    const blocking = direction === 'blockedBy';
    const Icon = blocking ? Lock : ArrowRight;
    return (
      <section aria-label={blocking ? t('projects.blockedBy') : t('projects.blocks')} className="min-w-0">
        <h4 className="flex items-center gap-1.5 mb-2 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          <Icon size={12} aria-hidden="true" />
          {blocking ? t('projects.blockedBy') : t('projects.blocks')}
          <span className="tabular-nums">· {items.length}</span>
        </h4>
        {items.length === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))] py-2">{blocking ? t('projects.noBlockers') : t('projects.noBlocked')}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => {
              const meta = STATUS_META[item.status];
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2 min-h-11 pl-3 pr-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} aria-hidden="true" />
                  <span className={`flex-1 min-w-0 truncate text-sm ${item.completed ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
                    {item.name}
                  </span>
                  <span className="shrink-0 text-caption px-2 py-0.5 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]">
                    {t(meta.labelKey as Parameters<typeof t>[0])}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onRemove(item, direction)}
                      aria-label={t('projects.removeDependency')}
                      className="shrink-0 w-9 h-9 rounded-md inline-flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-[rgb(var(--color-hover))] transition-colors"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => onAdd(direction)}
            className="mt-2 inline-flex items-center gap-1 min-h-9 px-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Plus size={13} aria-hidden="true" /> {blocking ? t('projects.addBlocker') : t('projects.addBlocked')}
          </button>
        )}
      </section>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {column('blockedBy', blockedBy)}
      {column('blocks', blocks)}
    </div>
  );
};

export default TeamTaskDependencyColumns;
