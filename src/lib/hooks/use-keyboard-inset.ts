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
 * 🔴 **La valeur au REPOS n'est pas 0**, et c'est le piège qui a coûté une
 * livraison : la barre d'outils de Safari (et la pastille d'URL d'iOS 26)
 * réduit déjà le viewport visuel, clavier fermé. Comparer cette mesure à un
 * nombre écrit en dur (« > 60, donc clavier ouvert ») marche sur l'émulateur,
 * qui repose à 0, et sur aucun téléphone. Tout jugement « ouvert / fermé » se
 * prend contre une ligne de base MESURÉE sur l'appareil, jamais contre une
 * constante — cf. `MobileTaskSearch`.
 *
 * Retourne 0 quand `visualViewport` n'existe pas (aucun décalage, aucun
 * dégât) et pendant le prérendu.
 */
/**
 * Mesure SYNCHRONE du même écart.
 *
 * Le hook ne publie sa première valeur qu'après son effet : qui a besoin de la
 * hauteur au repos à l'instant d'une ouverture doit la lire ici, pas dans
 * l'état du hook, qui vaut encore 0 à ce moment-là.
 */
export function measureKeyboardInset(): number {
  const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
  if (!vv) return 0;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
    if (!active || !vv) {
      setInset(0);
      return;
    }
    // `offsetTop` : le viewport visuel peut aussi être décalé vers le haut
    // (zoom, scroll du champ focalisé) — sans lui, la mesure surestime.
    const measure = () => setInset(measureKeyboardInset());
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
