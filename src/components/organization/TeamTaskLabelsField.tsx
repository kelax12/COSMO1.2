import { useState } from 'react';
import { Check, Plus, Tag, X } from 'lucide-react';
import { useCreateTeamLabel, useTeamLabels } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

/** Couleurs proposées à la création d'une étiquette (hex, validé par CHECK en base). */
const LABEL_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface TeamTaskLabelsFieldProps {
  orgId: string;
  /** Étiquettes choisies DANS LA FICHE : écrites à l'enregistrement, pas au clic. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Créer une étiquette est réservé aux managers (policy `team_labels_insert`). */
  canCreate: boolean;
}

/**
 * Étiquettes transverses d'une tâche d'équipe (mig. 093). Le vocabulaire est
 * celui de l'organisation ; la tâche en coche une partie.
 *
 * La sélection est un état de la fiche, comme les autres champs : elle
 * compte dans « modifications non enregistrées » et s'annule avec la fiche.
 */
const TeamTaskLabelsField = ({ orgId, value, onChange, canCreate }: TeamTaskLabelsFieldProps) => {
  const { t } = useT('org');
  const { data: labels = [], isLoading } = useTeamLabels(orgId);
  const createLabel = useCreateTeamLabel(orgId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(LABEL_COLORS[0]);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    createLabel.mutate(
      { name: n, color },
      {
        onSuccess: (label) => {
          onChange([...value, label.id]);
          setName('');
          setAdding(false);
        },
      },
    );
  };

  // Pendant le chargement, rien : « aucune étiquette » serait affirmé sans savoir (C-40).
  if (isLoading || (labels.length === 0 && !canCreate)) return null;

  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[rgb(var(--color-text-secondary))]">
        <Tag size={12} className="inline-block mr-1 align-[-1px]" aria-hidden="true" />
        {t('popups.labels.title')}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('popups.labels.title')}>
        {labels.map((label) => {
          const on = value.includes(label.id);
          return (
            <button
              key={label.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(label.id)}
              className={`inline-flex items-center gap-1.5 min-h-9 px-2.5 rounded-full border text-xs font-semibold transition-colors ${
                on ? 'border-transparent' : 'border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))]'
              }`}
              style={on ? { backgroundColor: `${label.color}22`, color: 'rgb(var(--color-text-primary))', boxShadow: `inset 0 0 0 1.5px ${label.color}` } : { color: 'rgb(var(--color-text-secondary))' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} aria-hidden="true" />
              {label.name}
              {on && <Check size={12} aria-hidden="true" />}
            </button>
          );
        })}
        {canCreate && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full border border-dashed border-[rgb(var(--color-border))] text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))]"
          >
            <Plus size={12} aria-hidden="true" /> {t('popups.labels.add')}
          </button>
        )}
      </div>
      {!isLoading && labels.length === 0 && !adding && (
        <p className="mt-1.5 text-xs text-[rgb(var(--color-text-muted))]">{t('popups.labels.empty')}</p>
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
            placeholder={t('popups.labels.namePlaceholder')}
            aria-label={t('popups.labels.namePlaceholder')}
            autoFocus
            maxLength={40}
            className="flex-1 min-w-[8rem] h-9 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
          />
          <div className="flex items-center gap-1" role="radiogroup" aria-label={t('popups.labels.color')}>
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full ${color === c ? 'ring-2 ring-offset-1 ring-offset-[rgb(var(--color-surface))] ring-[rgb(var(--color-accent))]' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || createLabel.isPending}
            className="h-9 px-3 rounded-lg text-xs font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-40"
          >
            {t('popups.labels.create')}
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

export default TeamTaskLabelsField;
