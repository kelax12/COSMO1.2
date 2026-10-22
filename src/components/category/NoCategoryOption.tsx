// Option « Sans catégorie » en tête de chaque sélecteur de catégorie
// (demande 2026-10-11). Valeur portée : chaîne vide côté perso, `null` côté
// entreprise — c'est l'appelant qui choisit, ce composant ne fait que l'afficher.
import React from 'react';
import { Ban, Check } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface NoCategoryOptionProps {
  selected: boolean;
  onSelect: () => void;
  /** `sheet` : ligne de feuille mobile (coche à droite) ; `row` : ligne de popover. */
  variant?: 'row' | 'sheet';
}

const NoCategoryOption: React.FC<NoCategoryOptionProps> = ({ selected, onSelect, variant = 'row' }) => {
  const { t } = useT('common');
  const label = t('noCategory');
  if (variant === 'sheet') {
    return (
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className="w-full flex items-center justify-between gap-2 px-4 pl-[2.5rem] min-h-11 active:bg-[rgb(var(--color-hover))]"
      >
        <span className="flex items-center gap-2.5">
          <Ban size={12} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
          <span className="text-[15px] text-[rgb(var(--color-text-secondary))]">{label}</span>
        </span>
        {selected && <Check size={16} className="text-blue-500 shrink-0" aria-hidden="true" />}
      </button>
    );
  }
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className="flex w-full items-center gap-2 min-h-11 ps-[2.25rem] text-left text-sm text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
    >
      <Ban size={12} className="shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
};

export default NoCategoryOption;
