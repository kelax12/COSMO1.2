import { safeGetItem, safeParse, safeSetItem } from '@/lib/safe-json';

/**
 * Aperçu en widgets (2026-10-19) : chaque bloc de l'Aperçu devient un widget
 * que la personne retire, ajoute, redimensionne et déplace.
 *
 * Trois formats, posés sur une grille de 6 colonnes (desktop) :
 * petit = 1/3 de largeur, moyen = 1/2, grand = toute la largeur. La hauteur
 * suit le contenu. Sur mobile, tout passe en pleine largeur.
 *
 * ⚠️ La disposition vit dans le navigateur (une par entreprise et par
 * personne) : c'est une préférence d'affichage, pas une donnée. La perdre
 * rend la disposition par défaut, jamais un écran vide.
 */

export type WidgetSize = 'small' | 'medium' | 'large';

export const WIDGET_SIZES: readonly WidgetSize[] = ['small', 'medium', 'large'];

export type WidgetId =
  | 'kpi'
  | 'waiting'
  | 'tasks'
  | 'load'
  | 'agenda'
  | 'krs'
  | 'projects'
  | 'waitingOn'
  | 'activity'
  | 'orgEvents'
  | 'deadlines'
  | 'mentions'
  | 'blockedByMe'
  | 'note'
  | 'teamLoad'
  | 'teamOverdue'
  | 'teamOkrs'
  | 'orgHealth'
  | 'riskProjects'
  | 'companyOkrs'
  | 'unassigned'
  | 'invitations';

export interface WidgetDef {
  id: WidgetId;
  /** Formats proposés, dans l'ordre petit → grand. */
  sizes: readonly WidgetSize[];
}

/** Le catalogue. L'ordre est celui de la page « Ajouter un widget ». */
export const WIDGET_DEFS: readonly WidgetDef[] = [
  { id: 'kpi', sizes: ['small', 'medium', 'large'] },
  { id: 'waiting', sizes: ['small', 'medium', 'large'] },
  { id: 'tasks', sizes: ['small', 'medium', 'large'] },
  { id: 'load', sizes: ['small', 'medium'] },
  { id: 'agenda', sizes: ['small', 'medium', 'large'] },
  { id: 'krs', sizes: ['small', 'medium', 'large'] },
  { id: 'projects', sizes: ['small', 'medium', 'large'] },
  { id: 'waitingOn', sizes: ['small', 'medium', 'large'] },
  { id: 'activity', sizes: ['small', 'medium', 'large'] },
  { id: 'orgEvents', sizes: ['small', 'medium', 'large'] },
  // Nouveaux (2026-10-19) : hors disposition par défaut, à ajouter depuis la page.
  { id: 'deadlines', sizes: ['small', 'medium', 'large'] },
  { id: 'mentions', sizes: ['small', 'medium', 'large'] },
  { id: 'blockedByMe', sizes: ['small', 'medium', 'large'] },
  { id: 'note', sizes: ['small', 'medium', 'large'] },
  // Chef d'équipe et administrateur (2026-10-19), posés par les modèles.
  { id: 'teamLoad', sizes: ['small', 'medium', 'large'] },
  { id: 'teamOverdue', sizes: ['small', 'medium', 'large'] },
  { id: 'teamOkrs', sizes: ['small', 'medium', 'large'] },
  { id: 'orgHealth', sizes: ['small', 'medium', 'large'] },
  { id: 'riskProjects', sizes: ['small', 'medium', 'large'] },
  { id: 'companyOkrs', sizes: ['small', 'medium', 'large'] },
  { id: 'unassigned', sizes: ['small', 'medium', 'large'] },
  { id: 'invitations', sizes: ['small', 'medium', 'large'] },
];

const DEF_BY_ID = new Map(WIDGET_DEFS.map((d) => [d.id, d]));

export interface PlacedWidget {
  id: WidgetId;
  size: WidgetSize;
}

/** Reprend l'Aperçu d'avant les widgets, dans le même ordre de lecture. */
export const DEFAULT_LAYOUT: readonly PlacedWidget[] = [
  { id: 'kpi', size: 'large' },
  { id: 'waiting', size: 'medium' },
  { id: 'load', size: 'medium' },
  { id: 'tasks', size: 'medium' },
  { id: 'agenda', size: 'medium' },
  { id: 'krs', size: 'medium' },
  { id: 'projects', size: 'medium' },
  { id: 'waitingOn', size: 'small' },
  { id: 'activity', size: 'small' },
  { id: 'orgEvents', size: 'small' },
];

export const widgetDef = (id: WidgetId): WidgetDef | undefined => DEF_BY_ID.get(id);

export const allowsSize = (id: WidgetId, size: WidgetSize): boolean =>
  !!DEF_BY_ID.get(id)?.sizes.includes(size);

/**
 * Relit une disposition venue du stockage : tout ce qui n'est pas reconnu
 * (widget retiré du catalogue, format qu'il n'accepte plus, doublon) tombe
 * sans bruit. `null` = rien d'exploitable, on prendra le défaut.
 */
export function sanitizeLayout(raw: unknown): PlacedWidget[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<WidgetId>();
  const out: PlacedWidget[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, size } = item as { id?: unknown; size?: unknown };
    if (typeof id !== 'string' || typeof size !== 'string') continue;
    const def = DEF_BY_ID.get(id as WidgetId);
    if (!def || seen.has(def.id) || !def.sizes.includes(size as WidgetSize)) continue;
    seen.add(def.id);
    out.push({ id: def.id, size: size as WidgetSize });
  }
  return out;
}

export const removeWidget = (layout: readonly PlacedWidget[], id: WidgetId): PlacedWidget[] =>
  layout.filter((w) => w.id !== id);

/** Ajoute en fin d'aperçu ; si le widget y est déjà, change seulement son format. */
export function addWidget(layout: readonly PlacedWidget[], id: WidgetId, size: WidgetSize): PlacedWidget[] {
  if (!allowsSize(id, size)) return [...layout];
  if (layout.some((w) => w.id === id)) return resizeWidget(layout, id, size);
  return [...layout, { id, size }];
}

export function resizeWidget(layout: readonly PlacedWidget[], id: WidgetId, size: WidgetSize): PlacedWidget[] {
  if (!allowsSize(id, size)) return [...layout];
  return layout.map((w) => (w.id === id ? { ...w, size } : w));
}

/** Déplace `id` à l'index `to` (borné). */
export function moveWidget(layout: readonly PlacedWidget[], id: WidgetId, to: number): PlacedWidget[] {
  const from = layout.findIndex((w) => w.id === id);
  if (from < 0) return [...layout];
  const next = [...layout];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

const storageKey = (orgId: string, userId: string) => `cosmo_apercu_layout_v1:${orgId}:${userId}`;

/** `fallback` : la disposition d'arrivée (le modèle du rôle) quand rien n'est enregistré. */
export function loadLayout(orgId: string, userId: string, fallback: readonly PlacedWidget[] = DEFAULT_LAYOUT): PlacedWidget[] {
  const raw = safeGetItem(storageKey(orgId, userId));
  const parsed = raw ? sanitizeLayout(safeParse<unknown>(raw)) : null;
  return parsed ?? [...fallback];
}

export function saveLayout(orgId: string, userId: string, layout: readonly PlacedWidget[]): void {
  safeSetItem(storageKey(orgId, userId), JSON.stringify(layout));
}

/** Largeur dans la grille de 6 colonnes (mobile : pleine largeur). */
export const SIZE_SPAN_CLASS: Record<WidgetSize, string> = {
  small: 'md:col-span-3 lg:col-span-2',
  medium: 'md:col-span-3 lg:col-span-3',
  large: 'md:col-span-6 lg:col-span-6',
};
