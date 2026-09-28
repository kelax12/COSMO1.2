import { useState } from 'react';
import { Check, ListChecks, Plus, X } from 'lucide-react';
import { useCreateTeamList, useTeamLists } from '@/modules/team-lists';
import { colorOptions, resolveListColor } from '@/pages/tasks/list-colors';
import { useT } from '@/i18n/useT';

interface TeamTaskListsFieldProps {
  orgId: string;
  /** Listes choisies DANS LA FICHE : écrites à l'enregistrement, pas au clic. */
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * Listes d'une tâche d'équipe (mig. 203), dans la fiche de création et
 * d'édition. Seules les listes MANUELLES se cochent : une liste intelligente
 * est un filtre, on n'y range rien.
 *
 * Même geste que les étiquettes (`TeamTaskLabelsField`) : la sélection est un
 * état de la fiche, elle compte dans « modifications non enregistrées ».
 * Créer une liste ici l'ajoute à l'organisation tout de suite, et la coche.
 */
const TeamTaskListsField = ({ orgId, value, onChange }: TeamTaskListsFieldProps) => {
  const { t } = useT('org');
  const { data: allLists = [], isLoading } = useTeamLists(orgId);
  const lists = allLists.filter((l) => l.type !== 'smart');
  const createList = useCreateTeamList(orgId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    createList.mutate(
      { name: n, color },
      {
        onSuccess: (list) => {
          onChange([...value, list.id]);
          setName('');
          setAdding(false);
        },
      },
    );
  };

  // Pendant le chargement, rien : « aucune liste » serait affirmé sans savoir (C-40).
  if (isLoading) return null;

  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[rgb(var(--color-text-secondary))]">
        <ListChecks size={12} className="inline-block mr-1 align-[-1px]" aria-hidden="true" />
        {t('teamLists.fieldTitle')}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('teamLists.fieldTitle')}>
        {lists.map((list) => {
          const on = value.includes(list.id);
          const hex = resolveListColor(list.color);
          return (
            <button
              key={list.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(list.id)}
              className={`inline-flex items-center gap-1.5 min-h-9 px-2.5 rounded-full border text-xs font-semibold transition-colors ${
                on ? 'border-transparent' : 'border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))]'
              }`}
              style={on ? { backgroundColor: `${hex}22`, color: 'rgb(var(--color-text-primary))', boxShadow: `inset 0 0 0 1.5px ${hex}` } : { color: 'rgb(var(--color-text-secondary))' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} aria-hidden="true" />
              {list.name}
              {on && <Check size={12} aria-hidden="true" />}
            </button>
          );
        })}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full border border-dashed border-[rgb(var(--color-border))] text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]"
          >
            <Plus size={12} aria-hidden="true" /> {t('teamLists.newList')}
          </button>
        )}
      </div>
      {lists.length === 0 && !adding && (
        <p className="mt-1.5 text-xs text-[rgb(var(--color-text-muted))]">{t('teamLists.empty')}</p>
      )}
      {adding && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--color-border))] p-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); }
            }}
            placeholder={t('teamLists.namePlaceholder')}
            aria-label={t('teamLists.namePlaceholder')}
            autoFocus
            maxLength={60}
            className="flex-1 min-w-[8rem] h-9 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
          />
          <div className="flex items-center gap-1" role="radiogroup" aria-label={t('teamLists.color')}>
            {colorOptions.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={color === c.value}
                aria-label={c.name}
                onClick={() => setColor(c.value)}
                className={`w-6 h-6 rounded-full ${color === c.value ? 'ring-2 ring-offset-1 ring-offset-[rgb(var(--color-surface))] ring-[rgb(var(--color-accent))]' : ''}`}
                style={{ backgroundColor: c.color }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || createList.isPending}
            className="h-9 px-3 rounded-lg text-xs font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-40"
          >
            {t('teamLists.create')}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setName(''); }}
            aria-label={t('common.cancel')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TeamTaskListsField;
