import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

/**
 * Bouton « magnétique » (landing uniquement) : l'élément suit légèrement le
 * pointeur puis revient en place avec un rebond élastique au leave.
 *
 * Basé sur `gsap.quickTo` (un tween réutilisé par axe → aucune allocation
 * par pointermove). No-op automatique sur pointeur non précis (tactile) et
 * en prefers-reduced-motion via `gsap.matchMedia`.
 *
 * Usage : `const ref = useMagnetic<HTMLButtonElement>(); <button ref={ref} …`
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.35) {
  const ref = useRef<T>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add(
        '(prefers-reduced-motion: no-preference) and (pointer: fine)',
        () => {
          const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
          const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });

          const onMove = (e: PointerEvent) => {
            const rect = el.getBoundingClientRect();
            xTo((e.clientX - (rect.left + rect.width / 2)) * strength);
            yTo((e.clientY - (rect.top + rect.height / 2)) * strength);
          };
          const onLeave = () => {
            gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
          };

          el.addEventListener('pointermove', onMove);
          el.addEventListener('pointerleave', onLeave);
          return () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerleave', onLeave);
          };
        },
      );
    },
    { scope: ref },
  );

  return ref;
}
