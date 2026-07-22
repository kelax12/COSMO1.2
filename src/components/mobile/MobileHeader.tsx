import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  title: string;
  /** Ligne de contexte sous le titre — un compte, une date. Courte. */
  subtitle?: React.ReactNode;
  /** Actions à droite. Chaque enfant doit faire ≥ 44×44px (cf. TouchTarget). */
  actions?: React.ReactNode;
  /** Seuil de scroll (px) déclenchant la compaction. */
  compactAt?: number;
  className?: string;
}

/**
 * En-tête canonique des pages mobile.
 *
 * Remplace les 3 familles de H1 concurrentes que documentait docs/MOBILE.md
 * (`text-2xl sm:text-4xl lg:text-5xl`, `text-2xl sm:text-3xl`,
 * `text-lg sm:text-3xl`) : trois échelles pour la même fonction, sur des pages
 * qu'on enchaîne en trois taps.
 *
 * Le titre est grand au repos puis se compacte au scroll dans une barre
 * collante — le motif « large title » d'iOS, celui qui rend la hiérarchie
 * lisible sans voler d'espace une fois qu'on lit la liste.
 */
const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  actions,
  compactAt = 32,
  className,
}) => {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    // `passive` : ce listener ne doit jamais retarder le scroll.
    const onScroll = () => setCompact(window.scrollY > compactAt);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [compactAt]);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 -mx-gutter px-gutter md:hidden',
        'transition-[padding,background-color,border-color] duration-200',
        compact
          ? 'py-2 bg-[rgb(var(--color-background))]/85 backdrop-blur-xl border-b border-[rgb(var(--color-border))]'
          : 'pt-0.5 pb-1 bg-transparent border-b border-transparent',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              'font-bold text-[rgb(var(--color-text-primary))] truncate',
              'transition-[font-size] duration-200',
              compact ? 'text-headline' : 'text-display',
            )}
          >
            {title}
          </h1>
          {subtitle && !compact && (
            <p className="mt-0.5 text-label text-[rgb(var(--color-text-muted))] truncate">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
    </header>
  );
};

export default MobileHeader;
