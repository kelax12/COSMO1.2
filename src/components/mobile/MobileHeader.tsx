import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  /** `ReactNode` et non `string` : le Dashboard y met une salutation animée. */
  title: React.ReactNode;
  /**
   * Titre affiché une fois compacté, à la place de `title` (redesign
   * 2026-09-19, OKR). Absent = `title` reste affiché tel quel dans les deux
   * états (comportement d'origine, inchangé pour tous les autres appelants).
   * Utile quand `title` est trop long pour le `text-display` du grand
   * titre — un texte qui tient en `text-headline` (compact) ne tient pas
   * forcément en `text-display` (repos), et inversement un texte raccourci
   * pour le repos perdrait de l'information une fois compacté, où la police
   * plus petite laisse la place de le dire en entier.
   */
  compactTitle?: React.ReactNode;
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
  compactTitle,
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

  // ── La place de l'en-tête dans le flux ne bouge JAMAIS (2026-10-11) ──────
  // Compacter change sa hauteur (59 → 43 px sur /habits, 39 → 49 sur le
  // Dashboard). Or il est `sticky`, donc DANS le flux : tout le contenu se
  // décalait d'autant, et l'ancrage de scroll du navigateur corrigeait
  // `scrollTop` du même écart. MESURÉ (Pixel 7, mode démo) : sur /habits et
  // /okr, `scrollTop` oscillait SANS FIN entre 34 et 18, l'en-tête se
  // compactant et se dépliant à chaque frame ; ailleurs le scroll dérivait de
  // 10 px sous le doigt. C'était « le scroll vertical bugue sur toutes les
  // pages ».
  // Une marge basse compense l'écart avec la hauteur dépliée : l'empreinte
  // reste celle du repos, rien ne bouge sous l'en-tête, et l'ancrage n'a plus
  // rien à corriger. Négative quand la forme compacte est la plus haute.
  // ❌ Ne pas « corriger » par un seuil avec hystérésis : la boucle disparaît,
  // le saut de contenu reste.
  const compactRef = useRef(compact);
  compactRef.current = compact;
  const restHeight = useRef(0);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const sync = () => {
      el.style.marginBottom = '';
      const height = el.offsetHeight;
      if (!compactRef.current) {
        restHeight.current = height;
      } else if (restHeight.current) {
        el.style.marginBottom = `${restHeight.current - height}px`;
      }
    };
    sync();
    // Police chargée, rotation, sous-titre qui change : la hauteur bouge
    // sans changement d'état. La marge ne change pas la taille observée,
    // donc pas de boucle. (Absent de jsdom.)
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact]);

  return (
    <header
      ref={headerRef}
      className={cn(
        'sticky top-0 z-30 -mx-gutter px-gutter md:hidden',
        // Seules les COULEURS s'animent. Une hauteur qui s'anime ne peut pas
        // être compensée dans la même frame (la marge ci-dessus arrive une
        // frame après l'ancrage de scroll) : mesuré, 10 px de dérive.
        'transition-[background-color,border-color] duration-200',
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
              compact ? 'text-headline' : 'text-display',
            )}
          >
            {compact && compactTitle !== undefined ? compactTitle : title}
          </h1>
          {/* ── Maquette 110 : un sous-titre coupé en plein mot ──────────
              `truncate` le bornait à UNE ligne : « Définissez et suivez vos
              objectifs avec des rés… » sur /okr, et la même coupure sur
              /statistics et /settings, qui partagent cet en-tête. La partie
              tronquée était justement celle qui portait l'information.
              Deux lignes au plus, et plus de mot coupé.
              ❌ Ne pas revenir à `truncate` : un en-tête n'a pas de contrainte
              de hauteur, il est au sommet d'une page qui défile. */}
          {subtitle && !compact && (
            <p className="mt-0.5 text-label text-[rgb(var(--color-text-muted))] line-clamp-2">
              {subtitle}
            </p>
          )}
        </div>
        {/* `flex-wrap` et non `shrink-0` : à 200 % de police (WCAG 1.4.4) une
            cible de 44 px en mesure 88, et quatre actions dépassaient l'écran
            de 20 px sur /tasks (2026-10-09, icône Tableau ajoutée). Elles
            passent à la ligne au lieu de sortir ; à taille normale elles
            tiennent sur une rangée, comme avant. */}
        {actions && <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">{actions}</div>}
      </div>
    </header>
  );
};

export default MobileHeader;
