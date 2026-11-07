// Le module affiché par la tuile du hero, partagé avec les puces SANS passer
// par l'état de `PersoTrack`.
//
// Pourquoi un magasin et pas un `useState` dans le parcours : la tuile change de
// module toutes les 2,6 s, et remonté dans `PersoTrack` ce changement re-rendait le
// parcours ENTIER à chaque rotation (une tâche longue toutes les 2,6 s, comptée
// dans le TBT mobile). Ici, seules les puces s'abonnent : la rotation ne re-rend
// qu'elles et la tuile.
import { useSyncExternalStore } from 'react';
import { MODULES_HERO, type ModuleHero } from './hero-modules';

type Cle = ModuleHero['cle'];

let actif: Cle = MODULES_HERO[0].cle;
const abonnes = new Set<() => void>();

export function setModuleActif(cle: string): void {
  if (cle === actif) return;
  actif = cle as Cle;
  abonnes.forEach((f) => f());
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

const lire = (): Cle => actif;

export function useModuleActif(): Cle {
  return useSyncExternalStore(abonner, lire, lire);
}
