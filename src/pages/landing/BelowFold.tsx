// Le bas de chaque parcours (perso, entreprise), monté au premier geste du visiteur.
//
// 🔴 POURQUOI (2026-10-16, TBT mobile). Monter tout le parcours d'un coup
// coûtait UNE tâche de ~1 s à CPU ×4 : React rendait les cinq vitrines, les
// solutions, la FAQ et la CTA, puis les `useGSAP` forçaient la mise en page de
// toute la page (Layout 480 ms, style 283 ms dans la même tâche). Sous le
// bridage mobile de Lighthouse, c'était l'essentiel des 878 à 1 507 ms de TBT de
// `/`, `/en/` et `/entreprise-presentation/`. Le premier écran n'a besoin que du
// hero et du bandeau.
//
// Ce qui déclenche le montage, et pourquoi chacun :
//   · le premier GESTE (défilement, molette, toucher, pointeur, clavier) : un
//     visiteur qui fait défiler trouve la suite déjà là ;
//   · `pointerdown` et `keydown` montent en SYNCHRONE (événements discrets,
//     React vide la mise à jour avant le `click`) : un clic sur une ancre du
//     sommaire trouve sa cible ;
//   · le premier mouvement de souris : sur grand écran, la suite arrive avant
//     qu'on ait pensé à défiler ;
//   · l'emplacement réservé qui atteint la MOITIÉ du viewport (robot qui rend
//     avec une fenêtre haute) ;
//   · une ancre dans l'URL (`/#faq`) : tout est monté d'emblée.
// 🔴 La moitié, et pas « visible » : sur téléphone (412 × 823), l'emplacement
// commence à 882 px sur `/` mais à 792 px sur `/en/`, le titre anglais tenant
// sur moins de lignes. Avec un simple « visible », `/en/` montait tout au
// chargement et gardait 717 à 802 ms de TBT en CI (2026-10-16), pendant que `/`
// tombait à 166. ❌ Ne jamais élargir cette marge vers le bas.
// Les robots sans JS lisent le prérendu (`#seo-fallback`), qui porte tout.
import React, { startTransition, useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger } from '@/lib/gsap';

const GESTES_CONTINUS = ['scroll', 'wheel', 'touchstart', 'pointermove'] as const;
const GESTES_DISCRETS = ['pointerdown', 'keydown'] as const;

export const BelowFold: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [monte, setMonte] = useState(() => typeof window !== 'undefined' && window.location.hash.length > 1);
  const emplacementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (monte) return;
    const enTransition = () => startTransition(() => setMonte(true));
    const toutDeSuite = () => setMonte(true);
    const opts = { capture: true, passive: true } as const;
    GESTES_CONTINUS.forEach((e) => window.addEventListener(e, enTransition, opts));
    GESTES_DISCRETS.forEach((e) => window.addEventListener(e, toutDeSuite, opts));
    const io = new IntersectionObserver(
      ([entree]) => {
        if (entree?.isIntersecting) enTransition();
      },
      { rootMargin: '0px 0px -50% 0px' },
    );
    if (emplacementRef.current) io.observe(emplacementRef.current);
    return () => {
      GESTES_CONTINUS.forEach((e) => window.removeEventListener(e, enTransition, opts));
      GESTES_DISCRETS.forEach((e) => window.removeEventListener(e, toutDeSuite, opts));
      io.disconnect();
    };
  }, [monte]);

  // Les ScrollTrigger créés AVANT (hero, barre de progression, pied de page)
  // ont mesuré une page plus courte : on les recale une fois la suite posée.
  useEffect(() => {
    if (!monte) return;
    const appel = gsap.delayedCall(0.15, () => ScrollTrigger.refresh());
    return () => {
      appel.kill();
    };
  }, [monte]);

  if (!monte) {
    // Réserve la hauteur : le pied de page ne remonte pas sous le premier écran.
    return <div ref={emplacementRef} className="min-h-[200vh]" aria-hidden="true" />;
  }
  return <>{children}</>;
};

export default BelowFold;
