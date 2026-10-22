// Le module affiché par la tuile du hero, partagé avec les puces SANS passer
// par l'état de `PersoTrack`.
//
// 🔴 POURQUOI UN MAGASIN ET PAS UN `useState` DANS LE PARCOURS (2026-10-15).
// La tuile change de module toutes les 2,6 s. Remonté dans `PersoTrack`, ce
// changement re-rendait le parcours ENTIER à chaque rotation : vitrines de
// `FeaturesSection`, solutions, FAQ, CTA, rien n'étant mémoïsé. Une tâche longue
// toutes les 2,6 s pendant toute la trace Lighthouse, que le bridage mobile (×4)
// fait compter dans le TBT de `/` et de `/en/` (878 et 949 ms en CI le
// 2026-10-13). Ici, seules les puces s'abonnent : la rotation ne re-rend
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
