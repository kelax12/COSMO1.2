// Les cinq tuiles de modules de la landing perso (hero et CTA finale).
import { BarChart2, Calendar, CheckSquare, Repeat, Target, type LucideIcon } from 'lucide-react';

export interface Tuile {
  cle: string;
  Icone: LucideIcon;
  degrade: string;
  /** Ecart horizontal au centre, en % de la largeur du hero (paires opposees). */
  x: number;
  /** Position verticale du centre de la tuile, en px depuis le haut du hero. */
  y: number;
  /** Inclinaison en degres : chaque tuile penche vers le point entre les deux CTA. */
  r: number;
}

// Ordre du tableau = ordre d'arrivee. Emplacements : 1 = gauche basse,
// 2 = gauche haute, 3 = centre, 4 = droite haute, 5 = droite basse.
// Couleurs et icones = celles des pages de l'app (barre laterale, `Layout.tsx` :
// taches #3b82f6, agenda #ef4444, OKR #22c55e, habitudes #eab308, stats #8b5cf6).
export const TUILES: Tuile[] = [
  { cle: 'tasks', Icone: CheckSquare, degrade: 'bg-blue-500', x: -35, y: 250, r: -38 },
  { cle: 'agenda', Icone: Calendar, degrade: 'bg-red-500', x: -18, y: 110, r: -20 },
  { cle: 'okr', Icone: Target, degrade: 'bg-green-500', x: 0, y: 90, r: 0 },
  { cle: 'habits', Icone: Repeat, degrade: 'bg-yellow-500', x: 18, y: 110, r: 20 },
  { cle: 'stats', Icone: BarChart2, degrade: 'bg-violet-500', x: 35, y: 250, r: 38 },
];
