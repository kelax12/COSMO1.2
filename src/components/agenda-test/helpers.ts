// Helpers purs pour la refonte « test » de l'Agenda (grille semaine custom).
// Présentation/temps uniquement — aucune logique métier.

export const HOUR_HEIGHT = 48; // px par heure
export const DAY_START_HOUR = 0;
export const DAY_END_HOUR = 24;

/** Lundi 00:00 de la semaine contenant `ref`. */
export function startOfWeek(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  return d;
}

/** Les 7 jours (lundi → dimanche) de la semaine de `ref`. */
export function weekDays(ref: Date): Date[] {
  const start = startOfWeek(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Minutes écoulées depuis minuit (local). */
export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Label « 8 – 14 juin » de la semaine. */
export function weekLabel(ref: Date): string {
  const days = weekDays(ref);
  const first = days[0];
  const last = days[6];
  const sameMonth = first.getMonth() === last.getMonth();
  const f = first.toLocaleDateString('fr-FR', { day: 'numeric', month: sameMonth ? undefined : 'short' });
  const l = last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${f} – ${l}`;
}

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Durées rapides proposées à la création (minutes). */
export const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

export function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const fmt = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(s)} – ${fmt(e)}`;
}

/** ISO d'un jour + heure/minute (local). */
export function isoAt(day: Date, hour: number, minute = 0): string {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Couleur lisible par défaut si l'event n'a pas de couleur. */
export const DEFAULT_EVENT_COLOR = '#6366f1';
