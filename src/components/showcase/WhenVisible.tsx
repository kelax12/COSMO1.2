import React, { useEffect, useRef, useState } from 'react';

interface Props {
  /** Rendu tant que la zone n'a pas approché le viewport. Doit avoir la MÊME hauteur que le contenu. */
  fallback: React.ReactNode;
  /** Marge d'anticipation : le contenu se monte avant d'être réellement visible. */
  rootMargin?: string;
  children: React.ReactNode;
}

/**
 * Ne monte ses enfants qu'une fois la zone approchée du viewport.
 *
 * POURQUOI, alors que `React.lazy` existe déjà : `lazy()` découpe le code, il ne
 * le DIFFÈRE pas. Un composant `lazy` rendu immédiatement déclenche son import
 * immédiatement — le chunk part au chargement de la page, exactement comme s'il
 * était statique, à un aller-retour près.
 *
 * ⚠️ **C'est ce qui se passait sur la landing, et la documentation affirmait le
 * contraire.** Mesuré le 2026-08-29 : `vendor-charts` (413 ko bruts, recharts +
 * d3) était téléchargé au chargement de `/`, alors que `PERFORMANCE.md` et la
 * roadmap le décrivaient comme « réellement lazy ». Le panneau Statistiques est
 * le cinquième d'une section défilante : la plupart des visiteurs ne le voient
 * jamais.
 *
 * ⚠️ **Le repli monte les enfants**, il ne les cache pas. Sans
 * `IntersectionObserver` (prérendu, très vieux navigateur), on rend le contenu
 * plutôt que rien : une optimisation ne doit jamais pouvoir faire disparaître du
 * contenu. C'est le même principe que le repli des agrégats d'habitudes.
 *
 * ⚠️ Le `fallback` doit avoir la hauteur du contenu final, sinon le montage
 * déplace la page — et sur une section pilotée par ScrollTrigger, un décalage de
 * hauteur décale aussi les positions de pin.
 */
const WhenVisible: React.FC<Props> = ({ fallback, rootMargin = '600px', children }) => {
  const ancre = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (visible) return;
    const el = ancre.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  if (visible) return <>{children}</>;
  return <div ref={ancre}>{fallback}</div>;
};

export default WhenVisible;
