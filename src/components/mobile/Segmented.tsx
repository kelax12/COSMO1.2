import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CONTROL_TRANSITION, haptic } from './mobile-motion';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Libellé accessible si `label` est une abréviation (« Sem. »). */
  ariaLabel?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Libellé du groupe, requis pour les lecteurs d'écran. */
  ariaLabel: string;
  className?: string;
}

/**
 * Contrôle segmenté — un choix parmi 2 à 4 options exclusives.
 *
 * Remplace les toggles bricolés au cas par cas (vues Semaine/Mois, périodes des
 * statistiques, filtres d'habitudes) : chacun avait ses propres hauteurs,
 * rayons et états actifs, alors qu'ils font tous exactement la même chose.
 *
 * La pastille active est un `layoutId` Framer Motion : elle glisse d'une option
 * à l'autre au lieu de clignoter — c'est ce glissement qui donne le rendu natif.
 */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  // `layoutId` est global au document : sans identifiant unique, deux contrôles
  // segmentés montés en même temps s'échangeraient leur pastille.
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 p-0.5 rounded-card',
        'bg-[rgb(var(--color-chip-bg))] border border-[rgb(var(--color-chip-border))]',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel ?? option.label}
            onClick={() => {
              if (active) return;
              haptic(10);
              onChange(option.value);
            }}
            className={cn(
              // `min-h-touch` sur chaque segment : un contrôle segmenté reste
              // une cible tactile à part entière, pas un mini-onglet.
              'relative px-3 min-h-touch rounded-row text-label font-medium',
              'transition-colors focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-[rgb(var(--color-accent))]/50',
              active
                ? 'text-[rgb(var(--color-text-primary))]'
                : 'text-[rgb(var(--color-text-muted))]',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={CONTROL_TRANSITION}
                className="absolute inset-0 rounded-row bg-[rgb(var(--color-surface))] shadow-sm"
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
