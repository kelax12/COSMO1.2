import { useEffect, useState } from 'react';

/**
 * Hauteur du clavier virtuel, en pixels, pour un élément ancré en bas.
 *
 * 🔴 Sur iOS Safari, ouvrir le clavier NE redimensionne PAS le viewport de
 * mise en page : un `position: fixed; bottom: 0` se retrouve DERRIÈRE le
 * clavier, invisible pendant qu'on tape dedans. Seul `window.visualViewport`
 * voit la zone réellement visible ; l'écart entre les deux est la hauteur à
 * remonter. Android Chrome redimensionne, lui, et renvoie donc 0 — le même
 * code marche des deux côtés.
 *
 * Retourne 0 quand `visualViewport` n'existe pas (aucun décalage, aucun
 * dégât) et pendant le prérendu.
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
    if (!active || !vv) {
      setInset(0);
      return;
    }
    const measure = () => {
      // `offsetTop` : le viewport visuel peut aussi être décalé vers le haut
      // (zoom, scroll du champ focalisé) — sans lui, la mesure surestime.
      const next = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(next);
    };
    measure();
    vv.addEventListener('resize', measure);
    vv.addEventListener('scroll', measure);
    return () => {
      vv.removeEventListener('resize', measure);
      vv.removeEventListener('scroll', measure);
    };
  }, [active]);

  return inset;
}
