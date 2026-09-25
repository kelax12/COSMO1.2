import { useMemo, useState } from 'react';
import { Check, Plus, Search, Trash2 } from 'lucide-react';
import { useTeamTasks } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

// ═══════════════════════════════════════════════════════════════════
// Sous-tâches et dépendances d'une tâche PAS ENCORE CRÉÉE
//
// Une sous-tâche et une dépendance référencent l'id de leur tâche : elles ne
// s'écrivent qu'une fois la tâche créée. Ces deux éditeurs tiennent donc un
// BROUILLON local, appliqué par `useApplyTeamTaskDraft` juste après la
// création. Audit des popups du 2026-09-25 : ces deux onglets n'existaient
// qu'en édition, il fallait créer, fermer puis rouvrir la fiche.
// ═══════════════════════════════════════════════════════════════════

const inputClass =
  'flex-1 min-w-0 h-10 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:border-[rgb(var(--color-accent-solid))]';

export const DraftSubtasksEditor = ({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) => {
  const { t } = useT('org');
  const [draft, setDraft] = useState('');
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    onChange([...value, title]);
    setDraft('');
  };
  return (
    <div>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">{t('popups.draft.subtasksHint')}</p>
      {value.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {value.map((title, i) => (
            <li key={`${i}-${title}`} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
              <span className="w-4 h-4 rounded border border-[rgb(var(--color-border))] shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{title}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label={t('taskModal.subtasksDelete')}
                className="w-8 h-8 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 shrink-0"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={t('taskModal.subtasksPlaceholder')}
          aria-label={t('taskModal.subtasksPlaceholder')}
          maxLength={300}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label={t('taskModal.subtasksAdd')}
          className="w-10 h-10 rounded-lg flex items-center justify-center bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-40 shrink-0"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

interface DraftDependenciesEditorProps {
  orgId: string;
  /** Projet choisi dans la fiche : les candidates en viennent. */
  projectId: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Le graphe ne se modifie que par un gestionnaire, comme en édition. */
  canEdit: boolean;
}

/**
 * Une tâche neuve n'a aucune arête : elle ne peut être que BLOQUÉE PAR des
 * tâches existantes, jamais former un cycle. Le sens inverse (« elle bloque »)
 * se règle ensuite, depuis la tâche bloquée.
 */
export const DraftDependenciesEditor = ({ orgId, projectId, value, onChange, canEdit }: DraftDependenciesEditorProps) => {
  const { t } = useT('org');
  const [query, setQuery] = useState('');
  // Monté avec l'onglet seulement : la lecture ne part pas à l'ouverture de la fiche.
  const { data: tasks = [] } = useTeamTasks(canEdit && projectId ? orgId : undefined);
  const hasProject = !!projectId;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const open = tasks.filter((c) => c.projectId === projectId && (!c.completed || value.includes(c.id)));
    return (q ? open.filter((c) => c.name.toLowerCase().includes(q)) : open).slice(0, 50);
  }, [tasks, projectId, query, value]);

  if (!canEdit) return <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('popups.draft.depsReadOnly')}</p>;
  if (!hasProject) return <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('popups.draft.depsNeedProject')}</p>;

  return (
    <div>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">{t('popups.draft.depsHint')}</p>
      <label className="relative block mb-2">
        <span className="sr-only">{t('popups.draft.depsSearch')}</span>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          placeholder={t('popups.draft.depsSearch')}
          className={`${inputClass} w-full pl-9`}
        />
      </label>
      {shown.length === 0 ? (
        <p className="text-xs text-center py-4 text-[rgb(var(--color-text-muted))]">{t('popups.draft.depsNone')}</p>
      ) : (
        <ul className="rounded-xl border border-[rgb(var(--color-border))] max-h-64 overflow-y-auto">
          {shown.map((c) => {
            const on = value.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? value.filter((id) => id !== c.id) : [...value, c.id])}
                  className="w-full min-h-11 flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[rgb(var(--color-hover))]"
                >
                  <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{c.name}</span>
                  <span
                    className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${
                      on ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]' : 'border-[rgb(var(--color-border))]'
                    }`}
                    aria-hidden="true"
                  >
                    {on && <Check size={13} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
