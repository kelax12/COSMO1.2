// Vocabulaire « État » partagé par les KR, les projets et les tâches d'équipe
// (mig. 160, 190, 204) : une couleur par état, un seul endroit.
import type { TeamProjectHealth } from '@/modules/team-projects';

export const HEALTH_DOT: Record<TeamProjectHealth, string> = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  off_track: 'bg-red-500',
};

export const HEALTHS = Object.keys(HEALTH_DOT) as TeamProjectHealth[];
