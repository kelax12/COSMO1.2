import type { Theme } from '@/lib/theme';

/** Couleur d'identité de chaque module (une page = une couleur). */
export interface ModuleColors {
  tasks: string;
  events: string;
  okrs: string;
  habits: string;
}

/** Teintes de référence, celles du thème clair et du Sombre. */
export const MODULE_COLORS: ModuleColors = {
  tasks: '#3b82f6',
  events: '#ef4444',
  okrs: '#22c55e',
  habits: '#eab308',
};

/**
 * Charte dark V4 (thème Gris) : mêmes teintes, saturation baissée pour ne pas
 * vibrer sur l'anthracite #161719. La logique « une page = une couleur » reste.
 */
export const MODULE_COLORS_GRIS: ModuleColors = {
  tasks: '#5b93f0',
  events: '#e8615f',
  okrs: '#3fbf75',
  habits: '#e3b33d',
};

export function moduleColorsFor(theme: Theme): ModuleColors {
  return theme === 'gris' ? MODULE_COLORS_GRIS : MODULE_COLORS;
}

/**
 * Recolore les tuiles du tableau de bord, dont l'ordre est fixé par
 * `useStatCards` : tâches, agenda, KR, habitudes.
 */
export function withModuleColors<T extends { color: string }>(cards: T[], colors: ModuleColors): T[] {
  const order = [colors.tasks, colors.events, colors.okrs, colors.habits];
  return cards.map((card, i) => ({ ...card, color: order[i] ?? card.color }));
}
