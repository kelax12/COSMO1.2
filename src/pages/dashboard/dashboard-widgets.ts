import { safeGetItem, safeParse, safeSetItem } from '@/lib/safe-json';
import { sanitizeLayoutIn, type CatalogDef, type PlacedOf, type WidgetSize } from '@/components/organization/apercu-widgets';

/**
 * Tableau de bord perso en widgets (2026-10-21) : même système que l'Aperçu
 * entreprise (`ApercuWidgetGrid`), avec le catalogue du mode perso.
 * Desktop seulement : le fil mobile reste celui de la maquette 28.
 *
 * ⚠️ Disposition en `localStorage`, une par personne : une préférence, jamais
 * une donnée. La perdre rend la disposition par défaut.
 */

export type BaseDashboardWidgetId =
  | 'stats' | 'today' | 'priorityTasks' | 'collaborativeTasks' | 'okrs' | 'habits'
  // 2026-10-21 : agenda, liste au choix, et deux widgets d'entreprise.
  | 'agenda' | 'taskList' | 'teamTasks' | 'review';

export type DashboardWidgetId =
  | BaseDashboardWidgetId
  // Le widget OKR se pose plusieurs fois (un objectif par exemplaire).
  | `okrs~${string}`
  | `taskList~${string}`;

export const DASHBOARD_WIDGET_DEFS: readonly CatalogDef<DashboardWidgetId>[] = [
  { id: 'stats', sizes: ['medium', 'large'] },
  { id: 'today', sizes: ['small', 'medium', 'large'] },
  { id: 'priorityTasks', sizes: ['small', 'medium', 'large'] },
  { id: 'collaborativeTasks', sizes: ['small', 'medium', 'large'] },
  { id: 'okrs', sizes: ['small', 'medium', 'large'], multi: true },
  { id: 'habits', sizes: ['small', 'medium', 'large'] },
  { id: 'agenda', sizes: ['small', 'medium', 'large'] },
  { id: 'taskList', sizes: ['small', 'medium', 'large'], multi: true },
  // Membres d'une organisation seulement (filtrés dans le catalogue de la page).
  { id: 'teamTasks', sizes: ['small', 'medium', 'large'] },
  { id: 'review', sizes: ['small', 'medium', 'large'] },
];

/** Widgets qui n'ont de sens que pour un membre d'une organisation. */
export const ORG_ONLY_WIDGETS: ReadonlySet<BaseDashboardWidgetId> = new Set(['today', 'teamTasks', 'review']);

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

/**
 * Élément affiché par chaque exemplaire d'un widget multiple (OKR, liste de
 * tâches) : `{ idExemplaire: idElement }`. Les ids d'exemplaire ne se
 * recouvrent pas d'un widget à l'autre.
 * Même statut que la disposition : une préférence locale.
 */
const okrChoiceKey = (userId: string) => `cosmo_dashboard_okr_choice_v1:${userId}`;

export function loadOkrChoices(userId: string): Record<string, string> {
  const raw = safeGetItem(okrChoiceKey(userId));
  const parsed = raw ? safeParse<unknown>(raw) : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
}

export function saveOkrChoices(userId: string, choices: Record<string, string>): void {
  safeSetItem(okrChoiceKey(userId), JSON.stringify(choices));
}

/**
 * Vue du widget Habitudes (liste ou semaine), UNE pour tous les formats :
 * redimensionner garde la vue en cours (2026-10-21). Tant que la personne
 * n'a rien choisi, le format décide (liste en petit, semaine sinon).
 */
export type HabitsViewChoice = 'list' | 'week';
const habitsViewKey = (userId: string) => `cosmo_dashboard_habits_view_v2:${userId}`;

export const defaultHabitsView = (size: WidgetSize): HabitsViewChoice => (size === 'small' ? 'list' : 'week');

export function loadHabitsView(userId: string): HabitsViewChoice | null {
  const raw = safeGetItem(habitsViewKey(userId));
  return raw === 'list' || raw === 'week' ? raw : null;
}

export function saveHabitsView(userId: string, view: HabitsViewChoice): void {
  safeSetItem(habitsViewKey(userId), view);
}
