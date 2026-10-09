// ═══════════════════════════════════════════════════════════════════
// Import : dates, récurrences et priorités venues d'une autre application
//
// Tout ce module rend des JOURS (`YYYY-MM-DD`), jamais des instants : une
// échéance de tâche est un jour vécu, et c'est `deadlineFromDayKey` qui la
// convertit à l'écriture (R-01, `src/lib/CLAUDE.md`). ❌ Jamais
// `new Date('YYYY-MM-DD')` ici : ça parse en UTC.
//
// Les formats lus sont ceux que produisent réellement les exports :
// ISO (TickTick, Notion), « Oct 9 2026 » / « 9 octobre 2026 » (Todoist,
// Notion selon la langue), jour/mois/année (Excel en français).
// Logique pure, testée dans dates.test.ts.
// ═══════════════════════════════════════════════════════════════════
import type { TaskRecurrence } from '@/modules/tasks';
import type { ImportSource } from './types';

const COMBINING = /[̀-ͯ]/g;
const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(COMBINING, '');
const pad = (n: number): string => String(n).padStart(2, '0');

function validDay(y: number, m: number, d: number): string | undefined {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return undefined;
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const localDay = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Instant (avec fuseau) → jour vécu dans `timeZone` (le fuseau de l'appareil par défaut). */
export function instantToDay(iso: string, timeZone?: string): string | undefined {
  // `+0000` (TickTick) → `+00:00`, seule forme que tous les moteurs lisent.
  const normalized = iso.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return localDay(date); // fuseau inconnu : celui de l'appareil
  }
}

const MONTHS: readonly [string, number][] = [
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
  ['july', 7], ['august', 8], ['september', 9], ['sept', 9], ['october', 10], ['november', 11], ['december', 12],
  ['janvier', 1], ['fevrier', 2], ['mars', 3], ['avril', 4], ['mai', 5], ['juin', 6],
  ['juillet', 7], ['aout', 8], ['septembre', 9], ['octobre', 10], ['novembre', 11], ['decembre', 12],
];

function monthOf(token: string): number | undefined {
  const hits = new Set<number>();
  for (const [name, month] of MONTHS) {
    if (name === token || (token.length >= 3 && name.startsWith(token))) hits.add(month);
  }
  return hits.size === 1 ? [...hits][0] : undefined;
}

const RELATIVE: Record<string, number> = {
  today: 0, tomorrow: 1, yesterday: -1, "aujourd'hui": 0, aujourdhui: 0, demain: 1, hier: -1,
};

/** Un jour lisible dans `raw`, sinon `undefined`. */
export function parseDay(raw: string, now: Date = new Date()): string | undefined {
  const text = raw.trim();
  if (!text) return undefined;

  // Instant avec fuseau : le jour vécu ici.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/i.test(text)) return instantToDay(text);

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/.exec(text);
  if (iso) return validDay(+iso[1], +iso[2], +iso[3]);

  const european = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(text);
  if (european) return validDay(+european[3], +european[2], +european[1]);

  const folded = fold(text).replace(/[’`]/g, "'");
  if (folded in RELATIVE) {
    const d = new Date(now);
    d.setDate(d.getDate() + RELATIVE[folded]);
    return localDay(d);
  }

  // Forme écrite : un mois en toutes lettres, un jour, une année facultative.
  const tokens = folded.replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean);
  let month: number | undefined;
  let day: number | undefined;
  let year: number | undefined;
  for (const token of tokens) {
    if (/\d[:h]\d|^(am|pm)$/.test(token)) continue; // heure
    if (/^\d{4}$/.test(token)) { year = +token; continue; }
    if (/^\d{1,2}$/.test(token)) { if (day === undefined) day = +token; continue; }
    if (/^[a-z]+$/.test(token)) {
      const m = monthOf(token);
      if (m !== undefined) month = m; // le dernier l'emporte (« mar. 9 oct. »)
    }
  }
  if (month === undefined || day === undefined) return undefined;
  return validDay(year ?? now.getFullYear(), month, day);
}

const WEEKDAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|lundis?|mardis?|mercredis?|jeudis?|vendredis?|samedis?|dimanches?)\b/;

/** Récurrence que COSMO sait reproduire (intervalle 1), sinon `none`. */
export function parseRecurrence(raw: string): TaskRecurrence {
  const text = fold(raw).replace(/!/g, '').trim();
  if (!text) return 'none';

  const rrule = /freq=(daily|weekly|monthly|yearly)/.exec(text);
  if (rrule) {
    const interval = /interval=(\d+)/.exec(text);
    if (interval && interval[1] !== '1') return 'none';
    return rrule[1] === 'daily' ? 'daily' : rrule[1] === 'weekly' ? 'weekly' : rrule[1] === 'monthly' ? 'monthly' : 'none';
  }

  const repeats = /\b(every|everyday|chaque|tous|toutes|daily|weekly|monthly)\b/.test(text);
  if (!repeats || /\d/.test(text) || /\b(other|autre)\b/.test(text)) return 'none';
  if (/\b(month|months|mois|monthly)\b/.test(text)) return 'monthly';
  if (/\b(week|weeks|semaine|semaines|weekly)\b/.test(text) || WEEKDAY.test(text)) return 'weekly';
  if (/\b(day|days|jour|jours|daily|everyday)\b/.test(text)) return 'daily';
  return 'none';
}

/** Priorité de la source → priorité COSMO (1 la plus haute … 5, 0 = non définie). */
export function mapPriority(source: ImportSource, raw: string): number {
  const value = fold(raw).trim();
  const n = Number(value.replace(/^p/, ''));
  if (source === 'todoist') return n >= 1 && n <= 3 ? n : 0; // p4 = « sans priorité »
  if (source === 'ticktick') return ({ 5: 1, 3: 2, 1: 4 } as Record<number, number>)[n] ?? 0;
  if (value !== '' && Number.isInteger(n)) return n >= 1 && n <= 5 ? n : 0;
  if (/^(high|haute|urgent|urgente|elevee|critical|critique)$/.test(value)) return 1;
  if (/^(medium|moyenne|normal|normale)$/.test(value)) return 3;
  if (/^(low|basse|faible)$/.test(value)) return 5;
  return 0;
}
