import { safeGetItem, safeParse, safeSetItem } from '@/lib/safe-json';
import { sanitizeLayoutIn, type CatalogDef, type PlacedOf } from '@/components/organization/apercu-widgets';

/**
 * Tableau de bord perso en widgets (2026-10-21) : même système que l'Aperçu
 * entreprise (`ApercuWidgetGrid`), avec le catalogue du mode perso.
 * Desktop seulement : le fil mobile reste celui de la maquette 28.
 *
 * ⚠️ Disposition en `localStorage`, une par personne : une préférence, jamais
 * une donnée. La perdre rend la disposition par défaut.
 */

export type DashboardWidgetId = 'stats' | 'today' | 'priorityTasks' | 'collaborativeTasks' | 'okrs' | 'habits';

export const DASHBOARD_WIDGET_DEFS: readonly CatalogDef<DashboardWidgetId>[] = [
  { id: 'stats', sizes: ['medium', 'large'] },
  { id: 'today', sizes: ['small', 'medium', 'large'] },
  { id: 'priorityTasks', sizes: ['small', 'medium', 'large'] },
  { id: 'collaborativeTasks', sizes: ['small', 'medium', 'large'] },
  { id: 'okrs', sizes: ['small', 'medium', 'large'] },
  { id: 'habits', sizes: ['small', 'medium', 'large'] },
];

export type DashboardPlaced = PlacedOf<DashboardWidgetId>;

/** Reprend le tableau de bord d'avant les widgets, dans le même ordre de lecture. */
export const DEFAULT_DASHBOARD_LAYOUT: readonly DashboardPlaced[] = [
  { id: 'stats', size: 'large' },
  { id: 'today', size: 'large' },
  { id: 'priorityTasks', size: 'medium' },
  { id: 'habits', size: 'medium' },
  { id: 'collaborativeTasks', size: 'medium' },
  { id: 'okrs', size: 'medium' },
];

const storageKey = (userId: string) => `cosmo_dashboard_layout_v1:${userId}`;

export function loadDashboardLayout(userId: string): DashboardPlaced[] {
  const raw = safeGetItem(storageKey(userId));
  const parsed = raw ? sanitizeLayoutIn(DASHBOARD_WIDGET_DEFS, safeParse<unknown>(raw)) : null;
  return parsed ?? [...DEFAULT_DASHBOARD_LAYOUT];
}

export function saveDashboardLayout(userId: string, layout: readonly DashboardPlaced[]): void {
  safeSetItem(storageKey(userId), JSON.stringify(layout));
}
