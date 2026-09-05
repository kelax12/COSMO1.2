import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  /** `ReactNode` et non `string` : le Dashboard y met une salutation animée. */
  title: React.ReactNode;
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
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // ⚠️ NE PAS revenir à `window.scrollY`. Ce composant a passé des semaines à
    // ne jamais se compacter, sur la seule page qui l'utilisait.
    //
    // MESURÉ le 2026-08-24 (viewport 375×812, mode démo) : sur `/tasks`, après
    // 500 px de scroll, le `h1` restait à 28 px, le fond du header restait
    // transparent, et `window.scrollY` valait **0**. La fenêtre ne scrolle pas :
    // `Layout.tsx` met tout le contenu dans un `<main class="flex-1
    // overflow-auto">`, et c'est LUI qui scrolle. L'événement `scroll` d'un
    // conteneur ne remonte pas jusqu'à `window`.
    //
    // On remonte donc les ancêtres jusqu'au premier conteneur réellement
    // scrollable, avec repli sur `window` (pages hors Layout : onboarding,
    // landing) pour que le composant reste utilisable partout.
    const findScroller = (): HTMLElement | Window => {
      let node = headerRef.current?.parentElement ?? null;
      while (node) {
        const overflowY = getComputedStyle(node).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') return node;
        node = node.parentElement;
      }
      return window;
    };

    const scroller = findScroller();
    const readTop = () =>
      scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop;

    // `passive` : ce listener ne doit jamais retarder le scroll.
    const onScroll = () => setCompact(readTop() > compactAt);
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [compactAt]);

  return (
    <header
      ref={headerRef}
      className={cn(
        'sticky top-0 z-30 -mx-gutter px-gutter md:hidden',
        'transition-[padding,background-color,border-color] duration-200',
        compact
          ? 'py-2 bg-[rgb(var(--color-background))]/85 backdrop-blur-xl border-b border-[rgb(var(--color-border))]'
          : 'pt-0.5 pb-1 bg-transparent border-b border-transparent',
        className,
      )}
    >
      {/* `items-start` au repos : le sous-titre (2 lignes) doit aligner le
          titre et les actions sur le HAUT du bloc, pas sur son centre.
          `items-center` une fois compact : il n'y a plus qu'une ligne de
          texte (le sous-titre disparaît juste au-dessus), centrer évite que
          le titre paraisse décroché par rapport à des actions plus hautes
          que lui (le bouton fait 44px, le texte compact ~24px). Valable sur
          TOUTES les pages qui utilisent `MobileHeader`, pas seulement le
          Dashboard. */}
      <div className={cn('flex justify-between gap-3', compact ? 'items-center' : 'items-start')}>
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
