import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  /** Icône lucide-react principale (ex. Inbox, Calendar, Target) */
  icon: LucideIcon;
  /** Titre court — formule positive (ex. "Aucune tâche pour aujourd'hui") */
  title: string;
  /** Description pédagogique — explique le prochain pas */
  description?: string;
  /** Action CTA (optionnelle) — bouton principal */
  actionLabel?: string;
  onAction?: () => void;
  /** Accent couleur — défaut bleu */
  accentColor?: string;
  /** Variante compact pour les sections du dashboard */
  compact?: boolean;
}

/**
 * EmptyState — affichage uniforme pour toutes les sections vides.
 *
 * Principe UX : un écran vide doit raconter une histoire, pas juste afficher
 * "Aucun résultat". On combine :
 *   1. Une icône pour ancrer visuellement
 *   2. Un titre positif (pas "vide", plutôt "prêt à commencer")
 *   3. Une description courte
 *   4. Une action concrète (le 1er pas)
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  accentColor = '#3B82F6',
  compact = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8 px-4' : 'py-16 px-6'
      }`}
      role="status"
    >
      <div
        className={`${
          compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'
        } rounded-2xl flex items-center justify-center`}
        style={{ backgroundColor: `${accentColor}15` }}
        aria-hidden="true"
      >
        <Icon
          size={compact ? 24 : 32}
          style={{ color: accentColor }}
        />
      </div>
      <h3
        className={`font-semibold mb-1 ${compact ? 'text-sm' : 'text-base'}`}
        style={{ color: 'rgb(var(--color-text-primary))' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className={`max-w-sm leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}
          style={{ color: 'rgb(var(--color-text-muted))' }}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ backgroundColor: accentColor }}
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
};

export default EmptyState;
