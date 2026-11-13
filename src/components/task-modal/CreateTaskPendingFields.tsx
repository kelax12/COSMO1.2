// Statut, État et Dépendances d'une tâche EN CRÉATION.
//
// La tâche n'existe pas encore : les choix restent dans le formulaire et
// partent avec elle (`buildCreateTaskInput` pour le statut et l'état,
// `createTaskWithShares` pour les arêtes, posées juste après l'insertion).
// En édition, `TaskStateFields` et `TaskDependenciesSection` prennent le
// relais et enregistrent à chaque choix.
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Search, X } from 'lucide-react';
import { useTasks, type TaskHealth, type TaskStatus } from '@/modules/tasks';
import { HEALTH_DOT, HEALTHS } from '@/components/organization/health-state.helpers';
import { BOARD_COLUMNS } from '@/components/task-board/board.helpers';
import { STATUS_DOT } from '@/components/task-board/status-style';
import { useT } from '@/i18n/useT';

const chip = (active: boolean) =>
  `min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-2.5 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 ${
    active
      ? 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent-solid))]/10 text-[rgb(var(--color-text-primary))]'
      : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
  }`;

/** Champs de création que ces composants lisent et écrivent dans le formulaire. */
export interface PendingTaskFields {
  status?: TaskStatus;
  health?: TaskHealth | null;
  blockedByIds?: string[];
}

interface PendingFieldsProps<T extends PendingTaskFields> {
  form: T;
  setForm: Dispatch<SetStateAction<T>>;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
}

// Un choix met à jour le formulaire ET le marque modifié, comme les autres champs.
const patchForm = <T extends PendingTaskFields>({ setForm, setHasChanges }: PendingFieldsProps<T>) =>
  (next: PendingTaskFields) => { setForm((prev) => ({ ...prev, ...next })); setHasChanges(true); };

const labelClass = 'block text-xs font-semibold uppercase tracking-wider mb-2';
const labelStyle = { color: 'rgb(var(--color-text-secondary))' };

export const CreateStateFields = <T extends PendingTaskFields>(props: PendingFieldsProps<T>) => {
  const { t } = useT('tasks');
  const status = props.form.status ?? 'todo';
  const health = props.form.health ?? null;
  const onChange = patchForm(props);
  return (
    <div className="space-y-3">
      <div>
        <p id="create-status" className={labelClass} style={labelStyle}>{t('board.statusLabel')}</p>
        <div role="radiogroup" aria-labelledby="create-status" className="flex flex-wrap gap-1.5">
          {BOARD_COLUMNS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => onChange({ status: s })} className={chip(status === s)}>
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden="true" />
              {t(`board.columns.${s}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p id="create-health" className={labelClass} style={labelStyle}>{t('board.health.label')}</p>
        <div role="radiogroup" aria-labelledby="create-health" className="flex flex-wrap gap-1.5">
          {HEALTHS.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={health === h} onClick={() => onChange({ health: h })} className={chip(health === h)}>
              <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[h]}`} aria-hidden="true" />
              {t(`board.health.${h}`)}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={health === null} onClick={() => onChange({ health: null })} className={chip(health === null)}>
            {t('board.health.none')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const CreateDependenciesField = <T extends PendingTaskFields>(props: PendingFieldsProps<T>) => {
  const { t } = useT('tasks');
  const value = props.form.blockedByIds ?? [];
  const patch = patchForm(props);
  const onChange = (blockedByIds: string[]) => patch({ blockedByIds });
  const { data: allTasks = [] } = useTasks();
  const [query, setQuery] = useState('');
  // Mes tâches seulement : une arête entre deux comptes est refusée
  // (`dependency_cross_account`, mig. 137).
  const own = useMemo(() => allTasks.filter((x) => !x.sharedBy), [allTasks]);
  const selected = own.filter((x) => value.includes(x.id));
  const q = query.trim().toLowerCase();
  const candidates = own
    .filter((x) => !value.includes(x.id) && !x.completed)
    .filter((x) => !q || x.name.toLowerCase().includes(q))
    .slice(0, 8);

  return (
    <div className="space-y-3">
      <div>
        <p className={labelClass} style={labelStyle}>{t('dependencies.blockedBy')}</p>
        {selected.length === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('dependencies.none')}</p>
        ) : (
          <ul>
            {selected.map((x) => (
              <li key={x.id} className="flex items-center gap-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                <span className="text-xs flex-1 truncate text-[rgb(var(--color-text-primary))]">{x.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((id) => id !== x.id))}
                  aria-label={t('dependencies.remove')}
                  className="shrink-0 text-[rgb(var(--color-text-muted))] hover:text-red-500 transition-colors"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs mb-2 text-[rgb(var(--color-text-muted))]">{t('dependencies.helpBlockedBy')}</p>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dependencies.searchPlaceholder')}
            aria-label={t('dependencies.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 min-h-11 rounded-lg border text-sm bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]/60"
          />
        </div>
        {candidates.length === 0 ? (
          <p className="mt-2 text-xs text-[rgb(var(--color-text-muted))]">
            {own.length === 0 ? t('dependencies.noCandidate') : t('dependencies.noMatch')}
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {candidates.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => { onChange([...value, x.id]); setQuery(''); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm truncate text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
                >
                  {x.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
