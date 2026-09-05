import { useLayoutEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface Props {
  pullY: number;
  isRefreshing: boolean;
  threshold: number;
}

/**
 * Indicateur visuel de pull-to-refresh (maquette 22).
 *
 * À placer au plus haut niveau d'une page mobile. Position `fixed top`, ne
 * pousse pas le contenu.
 *
 * 🔴 La position vient d'un `transform` écrit EN DUR, jamais d'une animation.
 * La version précédente la confiait à un `animate={{ y }}` de framer-motion :
 * `App.tsx` monte `<MotionConfig reducedMotion="user">`, donc chez quelqu'un
 * qui a réduit les animations — le réglage est actif sur la machine d'Axel —
 * les animations de transform ne jouent pas et la pastille restait collée à
 * `top: 0`, sous la bannière démo, immobile pendant tout le geste. Le seul
 * mouvement animé ici est le retour à zéro (`transition-transform`), et il ne
 * décide d'aucune position finale.
 *
 * Le libellé n'est pas décoratif : c'est la seule commande de rafraîchissement
 * manuel du produit (tout le reste arrive par Realtime), et une pastille sans
 * mot n'apprend rien à qui n'a pas déjà le geste.
 *
 * La pastille descend SOUS l'en-tête collant, mesuré et non deviné : à un
 * décalage fixe de 56 px elle se posait en travers du mot « Tâches », vu dans
 * le navigateur en 375 px. La hauteur de cet en-tête varie (39 px compacté,
 * 59 px au repos, +27 px si la bannière démo est là) — aucune constante ne
 * pouvait être juste dans les trois cas.
 */
export function PullToRefreshIndicator({ pullY, isRefreshing, threshold }: Props) {
  const { t } = useT('common');
  const [headerBottom, setHeaderBottom] = useState(0);
  const active = pullY > 0 || isRefreshing;

  // Mesuré à l'ouverture du geste, pas à chaque frame : l'en-tête ne change
  // pas de hauteur pendant qu'on tire (la liste est en haut, donc l'en-tête
  // est dans son état déployé et y reste).
  useLayoutEffect(() => {
    if (!active) return;
    const header = document.querySelector('main header');
    setHeaderBottom(header ? Math.max(0, header.getBoundingClientRect().bottom) : 0);
  }, [active]);

  if (!active) return null;

  const progress = Math.min(pullY / threshold, 1);
  const ready = progress >= 1;
  const offset = headerBottom + 8 + (isRefreshing ? 8 : Math.min(pullY - 32, 40));
  const label = isRefreshing
    ? t('pullToRefresh.refreshing')
    : ready
      ? t('pullToRefresh.release')
      : t('pullToRefresh.pull');

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 pointer-events-none flex justify-center px-gutter"
      style={{ transform: `translateY(${offset}px)` }}
    >
      <div
        // `role="status"` et non `aria-hidden` : un rafraîchissement en cours
        // est une information d'état, pas une décoration.
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] py-1.5 pl-2 pr-3.5 shadow-lg"
      >
        <RefreshCw
          size={16}
          className={`shrink-0 text-[rgb(var(--color-accent))] ${isRefreshing ? 'animate-spin' : 'transition-transform'}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
            opacity: ready || isRefreshing ? 1 : 0.5 + progress * 0.5,
          }}
          aria-hidden="true"
        />
        <span className="text-caption font-medium text-[rgb(var(--color-text-secondary))] whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}

export default PullToRefreshIndicator;
