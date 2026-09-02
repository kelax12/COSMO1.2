// ═══════════════════════════════════════════════════════════════════
// FUSEAU HORAIRE D'AFFICHAGE — préférence utilisateur (agenda + heures)
// ═══════════════════════════════════════════════════════════════════
//
// Deux modes :
//   - 'default' : heure locale du navigateur (comportement historique).
//   - 'manual'  : l'utilisateur fige un décalage « UTC+N » ; toutes les heures
//                 affichées (grille agenda, popups, modales) sont rendues dans
//                 ce fuseau au lieu de l'heure locale.
//
// Principe : les instants restent stockés en ISO (UTC) — on ne touche JAMAIS aux
// données. On applique un DÉCALAGE d'affichage au moment du rendu, et on le
// retire dès qu'une valeur revient du calendrier (drag, resize, sélection).
// Toute la logique de décalage est concentrée ici, en fonctions pures testées,
// pour ne pas ré-introduire la classe de bugs de fuseau déjà éradiquée.

import { useCallback, useSyncExternalStore } from 'react';
import { getIntlTag } from '@/i18n/format';

export type TimezoneMode = 'default' | 'manual';

export interface TimezonePref {
  mode: TimezoneMode;
  /**
   * Décalage signé en heures par rapport à UTC (ex. -5 = UTC-5, 9 = UTC+9).
   * Entier borné [-12, 14] — plage réelle des fuseaux UTC (UTC-12 à UTC+14).
   */
  offsetHours: number;
}

export const TIMEZONE_PREF_KEY = 'cosmo_timezone_pref';

export const DEFAULT_TIMEZONE_PREF: TimezonePref = { mode: 'default', offsetHours: 0 };

export const MIN_OFFSET_HOURS = -12;
export const MAX_OFFSET_HOURS = 14;

/** Borne le décalage saisi par l'utilisateur dans la plage réelle des fuseaux UTC. */
export function clampOffsetHours(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(MIN_OFFSET_HOURS, Math.min(MAX_OFFSET_HOURS, Math.trunc(value)));
}

// ── Fonctions pures de décalage ────────────────────────────────────────
//
// Pour afficher un instant `t` avec l'heure-murale du fuseau UTC+offset dans un
// calendrier rendu en heure LOCALE, on décale l'instant de :
//   deltaMin(t) = offsetHours*60 + t.getTimezoneOffset()
// (getTimezoneOffset() = minutes à ajouter à l'heure locale pour obtenir UTC,
//  négatif à l'est de Greenwich). Rendu local de (t + deltaMin) == heure-murale
//  de t dans UTC+offset. La réciproque retire ce même décalage.

/** Décalage d'affichage en millisecondes pour un instant donné (0 en mode défaut). */
export function displayShiftMs(pref: TimezonePref, at: Date = new Date()): number {
  if (pref.mode !== 'manual') return 0;
  return (pref.offsetHours * 60 + at.getTimezoneOffset()) * 60_000;
}

/** ISO d'un instant « vrai » → ISO décalé pour l'affichage (rendu en heure locale). */
export function toDisplayISO(iso: string, pref: TimezonePref): string {
  if (pref.mode !== 'manual') return iso;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return new Date(t.getTime() + displayShiftMs(pref, t)).toISOString();
}

/** ISO décalé (issu du calendrier) → ISO de l'instant « vrai » à stocker. */
export function fromDisplayISO(iso: string, pref: TimezonePref): string {
  if (pref.mode !== 'manual') return iso;
  const s = new Date(iso);
  if (Number.isNaN(s.getTime())) return iso;
  // `toDisplayISO` évalue le décalage à l'instant VRAI. Pour rester exactement
  // réciproque même aux transitions heure d'été/hiver (où l'offset local diffère
  // entre l'instant décalé et l'instant vrai), on estime l'instant vrai puis on
  // raffine une fois en réévaluant le décalage à cet instant. No-op dans un
  // fuseau à offset constant (l'immense majorité des cas).
  const estimate = new Date(s.getTime() - displayShiftMs(pref, s));
  return new Date(s.getTime() - displayShiftMs(pref, estimate)).toISOString();
}

/** « Maintenant » décalé pour l'indicateur d'heure courante du calendrier. */
export function displayNow(pref: TimezonePref, now: Date = new Date()): Date {
  return new Date(now.getTime() + displayShiftMs(pref, now));
}

/**
 * Formate l'heure d'un instant dans le fuseau choisi (HH:mm par défaut).
 * En mode défaut c'est l'heure locale, comme avant.
 *
 * i18n — l'étiquette suit la locale de l'utilisateur : le français affiche
 * « 14:30 », l'anglais « 2:30 PM ». Seule la PRÉSENTATION change ; le fuseau
 * appliqué reste celui choisi dans les réglages.
 */
export function formatTimeInTz(
  iso: string | Date,
  pref: TimezonePref,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  const src = typeof iso === 'string' ? iso : iso.toISOString();
  const shifted = new Date(toDisplayISO(src, pref));
  return shifted.toLocaleTimeString(getIntlTag(), options);
}

// ── Jours calendaires dans le fuseau retenu ───────────────────────────
//
// `tasks.deadline` est un `timestamptz`, mais ce que la personne saisit est un
// JOUR, pas un instant. Les deux représentations ne se convertissent pas avec
// `new Date('YYYY-MM-DD')` (qui parse en UTC) ni avec `.slice(0, 10)` (qui rend
// le jour UTC de l'instant) : ces deux raccourcis décalent la date d'un jour
// partout où le fuseau n'est pas UTC ou juste à l'est.
//
// Un seul couple de fonctions fait donc foi, et TOUTE écriture comme toute
// lecture d'une échéance passe par lui :
//   dayKeyInTz(instant)  → 'YYYY-MM-DD'  (le jour vécu par la personne)
//   dayStartInTz(jour)   → instant vrai de minuit ce jour-là, dans SON fuseau
//
// « Son fuseau » = le fuseau de la machine en mode 'default', le décalage figé
// en mode 'manual'. C'est ce qui permet à quelqu'un en Guadeloupe de se
// détacher de l'heure de métropole : il règle UTC-4 et ses journées ne sont
// plus découpées par le fuseau de Paris.
//
// ❌ Ne JAMAIS écrire `new Date(champDate).toISOString()` pour une échéance, et
//    ne jamais relire un jour par `deadline.slice(0, 10)`.

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/**
 * Décalage effectif en minutes À L'EST de UTC (UTC+2 → +120).
 *
 * Attention au signe : `Date.prototype.getTimezoneOffset()` compte à l'inverse
 * (minutes à AJOUTER à l'heure locale pour obtenir UTC), d'où la négation.
 */
export function tzOffsetMinutes(pref: TimezonePref, at: Date = new Date()): number {
  return pref.mode === 'manual' ? pref.offsetHours * 60 : -at.getTimezoneOffset();
}

/** Instant (ISO ou Date) → clé de jour 'YYYY-MM-DD' vécue dans le fuseau retenu. */
export function dayKeyInTz(
  instant: string | Date,
  pref: TimezonePref = getTimezonePref(),
): string {
  const t = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(t.getTime())) return '';
  return new Date(t.getTime() + tzOffsetMinutes(pref, t) * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Clé de jour d'aujourd'hui dans le fuseau retenu. */
export function todayKeyInTz(
  pref: TimezonePref = getTimezonePref(),
  now: Date = new Date(),
): string {
  return dayKeyInTz(now, pref);
}

/**
 * Clé de jour → instant vrai de MINUIT ce jour-là dans le fuseau retenu.
 *
 * Le décalage dépend de l'instant lui-même (heure d'été) : on estime une
 * première fois, puis on réévalue le décalage à l'instant estimé. No-op dans un
 * fuseau à décalage constant, exact aux deux transitions annuelles. Même
 * technique que `fromDisplayISO`, pour la même raison.
 */
export function dayStartInTz(
  dayKey: string,
  pref: TimezonePref = getTimezonePref(),
): Date {
  const m = DAY_KEY_RE.exec(dayKey);
  if (!m) return new Date(NaN);
  const asUTC = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const estimate = new Date(asUTC - tzOffsetMinutes(pref, new Date(asUTC)) * 60_000);
  return new Date(asUTC - tzOffsetMinutes(pref, estimate) * 60_000);
}

/** Idem, en ISO. Chaîne vide si la clé n'est pas un jour valide. */
export function dayStartISOInTz(
  dayKey: string,
  pref: TimezonePref = getTimezonePref(),
): string {
  const d = dayStartInTz(dayKey, pref);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Dernier instant du jour (minuit du lendemain moins 1 ms). */
export function dayEndInTz(
  dayKey: string,
  pref: TimezonePref = getTimezonePref(),
): Date {
  const start = dayStartInTz(dayKey, pref);
  if (Number.isNaN(start.getTime())) return start;
  return new Date(dayStartInTz(addDaysToKey(dayKey, 1), pref).getTime() - 1);
}

/**
 * Arithmétique de calendrier sur une clé de jour, sans fuseau ni heure d'été :
 * on travaille sur le calendrier UTC, où un jour fait toujours 24 h.
 */
export function addDaysToKey(dayKey: string, days: number): string {
  const m = DAY_KEY_RE.exec(dayKey);
  if (!m) return dayKey;
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

/** Jour de la semaine d'une clé de jour (0 = dimanche), sans effet de fuseau. */
export function weekdayOfKey(dayKey: string): number {
  const m = DAY_KEY_RE.exec(dayKey);
  if (!m) return NaN;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

/** Nombre de jours calendaires de `from` à `to` (négatif si `to` est avant). */
export function daysBetweenKeys(from: string, to: string): number {
  const a = DAY_KEY_RE.exec(from);
  const b = DAY_KEY_RE.exec(to);
  if (!a || !b) return NaN;
  const ta = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const tb = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((tb - ta) / DAY_MS);
}

/** Libellé court du fuseau actif (ex. « UTC+2 », « UTC-5 » ou « Heure locale »). */
export function timezoneLabel(pref: TimezonePref): string {
  if (pref.mode !== 'manual') return 'Heure locale';
  const sign = pref.offsetHours < 0 ? '-' : '+';
  return `UTC${sign}${Math.abs(pref.offsetHours)}`;
}

// ── Store (useSyncExternalStore, backed by localStorage, cross-tab) ────

function readPref(): TimezonePref {
  try {
    const raw = localStorage.getItem(TIMEZONE_PREF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.mode === 'default' || parsed.mode === 'manual')) {
        return { mode: parsed.mode, offsetHours: clampOffsetHours(Number(parsed.offsetHours)) };
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_TIMEZONE_PREF;
}

let prefState: TimezonePref = readPref();
const listeners = new Set<() => void>();

function writePref(next: TimezonePref) {
  prefState = next;
  try { localStorage.setItem(TIMEZONE_PREF_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/** Lecture directe hors React (utilisée par les helpers de l'agenda). */
export function getTimezonePref(): TimezonePref {
  return prefState;
}

export function useTimezonePref() {
  const pref = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => prefState,
    () => prefState,
  );

  const setMode = useCallback((mode: TimezoneMode) => {
    writePref({ ...prefState, mode });
  }, []);

  const setOffsetHours = useCallback((offsetHours: number) => {
    writePref({ ...prefState, offsetHours: clampOffsetHours(offsetHours) });
  }, []);

  return { pref, setMode, setOffsetHours };
}

// Synchronisation inter-onglets.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === TIMEZONE_PREF_KEY) {
      prefState = readPref();
      listeners.forEach((l) => l());
    }
  });
}
