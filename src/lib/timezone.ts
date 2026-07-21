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
 * Formate l'heure d'un instant dans le fuseau choisi (fr-FR, HH:mm par défaut).
 * En mode défaut c'est l'heure locale, comme avant.
 */
export function formatTimeInTz(
  iso: string | Date,
  pref: TimezonePref,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  const src = typeof iso === 'string' ? iso : iso.toISOString();
  const shifted = new Date(toDisplayISO(src, pref));
  return shifted.toLocaleTimeString('fr-FR', options);
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
