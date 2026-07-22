import React from 'react';
import { cn } from '@/lib/utils';

interface ListRowProps {
  /** Ligne 1 — le contenu que l'œil cherche en premier. */
  title: React.ReactNode;
  /** Ligne 2 — contexte secondaire (date, durée, catégorie). Une seule ligne. */
  meta?: React.ReactNode;
  /**
   * Filet vertical coloré collé au bord gauche. Sert à coder une catégorie ou
   * un état sans ajouter ni pastille ni badge — c'est la façon la plus économe
   * de mettre de la couleur dans une liste dense.
   */
  railColor?: string;
  /** Vignette / case à cocher / avatar, à gauche du texte. */
  leading?: React.ReactNode;
  /** Badge, chevron, bouton — à droite. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  /** Estompe la ligne (tâche terminée) sans la retirer de la liste. */
  dimmed?: boolean;
  className?: string;
  /** Attributs pass-through pour les gestes (drag Framer Motion, long-press). */
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
}

/**
 * La ligne canonique des listes mobile.
 *
 * Une app mobile qui « se tient » réutilise deux ou trois lignes partout plutôt
 * que d'en dessiner une par écran. COSMO en avait une par liste : hauteurs,
 * tailles de texte et paddings tous différents entre Tâches, Habitudes et OKR.
 *
 * Choix de design :
 * - hauteur minimale = cible tactile (44px), jamais moins
 * - hiérarchie par la TAILLE et l'OPACITÉ du texte, pas par des bordures
 * - pas de fond ni de bordure au repos : la séparation se fait par l'espace,
 *   ce qui laisse respirer les listes denses
 */
const ListRow: React.FC<ListRowProps> = ({
  title,
  meta,
  railColor,
  leading,
  trailing,
  onClick,
  dimmed = false,
  className,
  ...pointerProps
}) => {
  const interactive = Boolean(onClick);

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'relative flex items-center gap-3 min-h-touch py-2.5 pr-1',
        railColor ? 'pl-3' : 'pl-0.5',
        'rounded-row transition-colors',
        interactive &&
          'cursor-pointer active:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/50',
        dimmed && 'opacity-45',
        className,
      )}
      {...pointerProps}
    >
      {railColor && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full"
          style={{ backgroundColor: railColor }}
        />
      )}

      {leading && <div className="shrink-0 flex items-center">{leading}</div>}

      <div className="min-w-0 flex-1">
        <div className="text-body font-medium text-[rgb(var(--color-text-primary))] truncate">
          {title}
        </div>
        {meta && (
          <div className="mt-0.5 text-caption text-[rgb(var(--color-text-muted))] truncate">
            {meta}
          </div>
        )}
      </div>

      {trailing && <div className="shrink-0 flex items-center gap-1">{trailing}</div>}
    </div>
  );
};

export default ListRow;
