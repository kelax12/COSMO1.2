import { useEffect, useState } from 'react';

/**
 * Maquette 103 — un squelette ne s'affiche qu'au-delà d'un délai.
 *
 * Sur une liste servie par le cache React Query, ou sur une connexion rapide,
 * les données arrivent en quelques dizaines de millisecondes. Monter un
 * squelette immédiatement produit alors un CLIGNOTEMENT : une forme grise
 * apparaît et disparaît avant d'avoir été lue, ce qui est plus désagréable que
 * l'attente qu'elle prétend habiller.
 *
 * Le seuil de 200 ms est celui en dessous duquel une transition est perçue
 * comme instantanée : au-delà, l'attente se voit et le squelette la rend
 * lisible ; en dessous, il n'y a rien à habiller.
 *
 * ❌ Ne jamais s'en servir pour retarder du CONTENU, seulement un indicateur
 * d'attente. Retarder du contenu ajoute de l'attente au lieu d'en masquer.
 */
export function useDelayed(active: boolean, ms = 200): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) {
      // Remise à zéro immédiate : sans elle, un second chargement dans la même
      // vie du composant afficherait son squelette sans délai.
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(id);
  }, [active, ms]);

  return shown;
}
