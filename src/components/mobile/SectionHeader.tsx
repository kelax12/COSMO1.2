import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  /** Compte ou contexte, affiché en gris juste après le titre. */
  count?: number;
  /** Lien/bouton d'action à droite (« Tout voir », « Modifier »). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Titre de section dans une page mobile.
 *
 * Volontairement discret : dans une liste, la section ne doit pas rivaliser
 * avec le titre de page ni avec les lignes. Le poids de la typo et la couleur
 * secondaire font tout le travail — pas de fond, pas de bordure.
 */
const SectionHeader: React.FC<SectionHeaderProps> = ({ title, count, action, className }) => (
  <div className={cn('flex items-baseline justify-between gap-3 mb-2', className)}>
    <h2 className="text-label font-semibold text-[rgb(var(--color-text-secondary))]">
      {title}
      {count !== undefined && (
        <span className="ml-1.5 font-normal text-[rgb(var(--color-text-muted))]">{count}</span>
      )}
    </h2>
    {action}
  </div>
);

export default SectionHeader;
