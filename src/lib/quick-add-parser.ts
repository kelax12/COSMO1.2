// Parseur « quick-add » en langage naturel (FR) — #1.
//
// Transforme une phrase libre en champs de tâche pré-remplis :
//   « Appeler le dentiste jeudi 10h #santé !! ~30m »
//   → { name: 'Appeler le dentiste', deadline: <jeudi prochain>,
//       categoryToken: 'santé', priority: 2, estimatedTime: 30 }
//
// Tokens reconnus (retirés du nom) :
//   #xxx            → categoryToken (résolu contre les catégories par l'appelant)
//   !1..!5          → priorité explicite ; !!! = 1, !! = 2, ! = 3
//   ~30m / ~1h30    → durée estimée en minutes
//   aujourd'hui / demain / après-demain / lundi..dimanche / 15/07[/2026]
//                   → deadline (date locale YYYY-MM-DD, convention en-CA)
//   14h / 14h30     → heure : les tâches n'ont pas d'heure, le token est
//                     consommé et, à défaut d'autre date, la deadline = aujourd'hui.
//
// Logique pure, sans dépendance UI — testée dans quick-add-parser.test.ts.

export interface QuickAddParseResult {
  name: string;
  deadline?: string;
  categoryToken?: string;
  priority?: number;
  estimatedTime?: number;
  /** Récurrence (#26) : « tous les jours », « chaque semaine », « tous les lundis »… */
  recurrence?: 'daily' | 'weekly' | 'monthly';
}

const WEEKDAYS: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

/** Minuscule + suppression des diacritiques (é → e) pour comparer les mots-clés. */
const COMBINING_MARKS = /[̀-ͯ]/g;
const normalize = (word: string): string =>
  word.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');

/** Date locale au format YYYY-MM-DD (convention en-CA du projet). */
const toLocalDateString = (d: Date): string => d.toLocaleDateString('en-CA');

const addDays = (base: Date, days: number): Date => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

/** Prochaine occurrence du jour de semaine demandé (si aujourd'hui → +7). */
const nextWeekday = (base: Date, weekday: number): Date => {
  const delta = (weekday - base.getDay() + 7) % 7 || 7;
  return addDays(base, delta);
};

export function parseQuickAdd(input: string, now: Date = new Date()): QuickAddParseResult {
  const result: QuickAddParseResult = { name: '' };
  const nameParts: string[] = [];
  let sawTimeToken = false;

  // ── Récurrence (#26) — expressions multi-mots, consommées avant la
  // tokenisation. « tous les lundis » = hebdo + prochaine occurrence du lundi.
  let working = input;
  const weekdayRecurrence = /\b(?:tous les|chaque)\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?\b/i.exec(working);
  if (weekdayRecurrence) {
    result.recurrence = 'weekly';
    result.deadline = toLocalDateString(nextWeekday(now, WEEKDAYS[normalize(weekdayRecurrence[1])]));
    working = working.replace(weekdayRecurrence[0], ' ');
  } else if (/\b(?:tous les jours|chaque jour)\b/i.test(working)) {
    result.recurrence = 'daily';
    result.deadline = toLocalDateString(now);
    working = working.replace(/\b(?:tous les jours|chaque jour)\b/i, ' ');
  } else if (/\b(?:toutes les semaines|chaque semaine)\b/i.test(working)) {
    result.recurrence = 'weekly';
    result.deadline = toLocalDateString(addDays(now, 7));
    working = working.replace(/\b(?:toutes les semaines|chaque semaine)\b/i, ' ');
  } else if (/\b(?:tous les mois|chaque mois)\b/i.test(working)) {
    result.recurrence = 'monthly';
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    result.deadline = toLocalDateString(nextMonth);
    working = working.replace(/\b(?:tous les mois|chaque mois)\b/i, ' ');
  }

  for (const rawToken of working.trim().split(/\s+/)) {
    if (rawToken === '') continue;
    const token = normalize(rawToken);

    // #catégorie
    if (rawToken.startsWith('#') && rawToken.length > 1 && result.categoryToken === undefined) {
      result.categoryToken = rawToken.slice(1);
      continue;
    }

    // Priorité explicite !1..!5
    const explicitPriority = /^!([1-5])$/.exec(rawToken);
    if (explicitPriority && result.priority === undefined) {
      result.priority = Number(explicitPriority[1]);
      continue;
    }

    // Priorité par points d'exclamation : !!! = 1, !! = 2, ! = 3
    if (/^!{1,3}$/.test(rawToken) && result.priority === undefined) {
      result.priority = 4 - rawToken.length;
      continue;
    }

    // Durée ~1h30 / ~45m / ~45min
    const duration = /^~(?:(\d+)h(\d{1,2})?|(\d+)(?:m|min))$/.exec(token);
    if (duration && result.estimatedTime === undefined) {
      result.estimatedTime = duration[1] !== undefined
        ? Number(duration[1]) * 60 + Number(duration[2] ?? 0)
        : Number(duration[3]);
      continue;
    }

    // Dates relatives
    if (result.deadline === undefined) {
      if (token === "aujourd'hui" || token === 'aujourdhui') {
        result.deadline = toLocalDateString(now);
        continue;
      }
      if (token === 'demain') {
        result.deadline = toLocalDateString(addDays(now, 1));
        continue;
      }
      if (token === 'apres-demain') {
        result.deadline = toLocalDateString(addDays(now, 2));
        continue;
      }
      if (token in WEEKDAYS) {
        result.deadline = toLocalDateString(nextWeekday(now, WEEKDAYS[token]));
        continue;
      }
      // Date numérique 15/07 ou 15/07/2026
      const numericDate = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(token);
      if (numericDate) {
        const day = Number(numericDate[1]);
        const month = Number(numericDate[2]);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          let year = numericDate[3] !== undefined ? Number(numericDate[3]) : now.getFullYear();
          if (year < 100) year += 2000;
          let candidate = new Date(year, month - 1, day);
          // Sans année explicite, une date déjà passée bascule sur l'année suivante.
          if (numericDate[3] === undefined && candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
            candidate = new Date(year + 1, month - 1, day);
          }
          result.deadline = toLocalDateString(candidate);
          continue;
        }
      }
    }

    // Heure 14h / 14h30 — consommée (les tâches n'ont pas d'heure)
    const timeToken = /^(\d{1,2})h(\d{2})?$/.exec(token);
    if (timeToken && Number(timeToken[1]) <= 23) {
      sawTimeToken = true;
      continue;
    }

    nameParts.push(rawToken);
  }

  // Une heure seule (« 14h ») sans date implique « aujourd'hui ».
  if (sawTimeToken && result.deadline === undefined) {
    result.deadline = toLocalDateString(now);
  }

  result.name = nameParts.join(' ').trim();
  return result;
}
