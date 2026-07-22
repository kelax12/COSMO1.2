import React from 'react';
import { cn } from '@/lib/utils';

type TouchTargetProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Toujours fournir un libellé accessible : le contenu est une icône. */
  'aria-label': string;
};

/**
 * Bouton-icône dont la zone tactile fait réellement 44×44px (WCAG 2.5.5).
 *
 * L'audit a relevé 176 boutons en `h-7`/`h-8`/`h-9` (28/32/36px) dans le code :
 * visuellement corrects, ratés une fois sur trois au pouce. Le point clé est
 * que l'icône reste petite (18–22px) pendant que la CIBLE grandit — un bouton
 * de 44px de haut avec une icône de 44px serait lourd.
 */
const TouchTarget = React.forwardRef<HTMLButtonElement, TouchTargetProps>(
  ({ className, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center min-h-touch min-w-touch rounded-row',
        'text-[rgb(var(--color-text-secondary))]',
        'transition-colors active:bg-[rgb(var(--color-hover))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/50',
        'disabled:opacity-40 disabled:pointer-events-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

TouchTarget.displayName = 'TouchTarget';

export default TouchTarget;
