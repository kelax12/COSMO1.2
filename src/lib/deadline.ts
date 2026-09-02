// ═══════════════════════════════════════════════════════════════════
// ÉCHÉANCES — un seul chemin entre le jour saisi et la valeur stockée
// ═══════════════════════════════════════════════════════════════════
//
// Le produit manipule DEUX représentations d'échéance, et c'est assumé :
//
//   - tâche PERSONNELLE : `tasks.deadline` est un `timestamptz`. On y stocke
//     l'instant vrai de MINUIT, dans le fuseau de la personne.
//   - tâche d'ÉQUIPE : `team_tasks.deadline` est une `date` ('YYYY-MM-DD'),
//     donc déjà un jour calendaire, sans fuseau.
//
// Ce module est la frontière entre les deux et le reste de l'application. Tout
// ce qui est en aval raisonne sur des CLÉS DE JOUR ('YYYY-MM-DD'), jamais sur
// des instants, parce qu'une échéance est un jour et pas une heure.
//
// 🔴 POURQUOI (revue du 2026-09-02, risque R-01). Trois écritures différentes
// produisaient trois valeurs différentes pour le même jour choisi :
//   `new Date('2026-09-02').toISOString()`  → minuit UTC       (save-task)
//   `'2026-09-02'` envoyé tel quel          → minuit UTC après cast (snooze)
//   minuit local converti en ISO            → correct          (TasksPage)
// et la relecture se faisait tantôt par `.slice(0, 10)` (jour UTC), tantôt par
// comparaison d'instants en heure locale. Résultat mesuré : pour tout fuseau à
// décalage négatif, une tâche datée du jour même était classée « En retard » et
// absente de « Aujourd'hui ». Invisible depuis la métropole, systématique aux
// Antilles et sur tout le continent américain.
//
// ❌ Ne JAMAIS écrire `new Date(jour).toISOString()` pour une échéance.
// ❌ Ne JAMAIS relire un jour d'échéance par `deadline.slice(0, 10)`.
//    Les deux décalent la date d'un jour dès qu'on quitte UTC.

import {
  dayKeyInTz,
  dayStartISOInTz,
  todayKeyInTz,
  daysBetweenKeys,
  type TimezonePref,
  getTimezonePref,
} from './timezone';

/** Une échéance déjà au format jour n'a pas de fuseau : on la prend telle quelle. */
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Échéance stockée → clé de jour vécue par la personne ('' si absente/invalide).
 *
 * Accepte les deux représentations : un `timestamptz` de tâche personnelle est
 * ramené dans le fuseau retenu ; une `date` de tâche d'équipe est rendue telle
 * quelle, sans conversion, parce qu'elle ne porte aucun instant.
 */
export function deadlineDayKey(
  deadline: string | undefined | null,
  pref: TimezonePref = getTimezonePref(),
): string {
  if (!deadline) return '';
  if (DAY_KEY_RE.test(deadline)) return deadline;
  return dayKeyInTz(deadline, pref);
}

/**
 * Jour choisi dans un `<input type="date">` → valeur à stocker pour une tâche
 * PERSONNELLE : l'instant vrai de minuit ce jour-là, dans le fuseau retenu.
 *
 * Chaîne vide en entrée → chaîne vide en sortie (« pas d'échéance »), qui est
 * la valeur que le modèle utilise déjà pour l'absence.
 */
export function deadlineFromDayKey(
  dayKey: string | undefined | null,
  pref: TimezonePref = getTimezonePref(),
): string {
  if (!dayKey) return '';
  return dayStartISOInTz(dayKey, pref);
}

/** Nombre de jours calendaires d'ici l'échéance : 0 aujourd'hui, -1 hier. */
export function daysUntilDeadline(
  deadline: string | undefined | null,
  pref: TimezonePref = getTimezonePref(),
  now: Date = new Date(),
): number {
  const key = deadlineDayKey(deadline, pref);
  if (!key) return NaN;
  return daysBetweenKeys(todayKeyInTz(pref, now), key);
}

/** L'échéance tombe-t-elle aujourd'hui, dans le fuseau retenu ? */
export function isDueToday(
  deadline: string | undefined | null,
  pref: TimezonePref = getTimezonePref(),
  now: Date = new Date(),
): boolean {
  return daysUntilDeadline(deadline, pref, now) === 0;
}

/**
 * En retard = échéance d'un jour RÉVOLU, pas d'un instant passé.
 *
 * Une tâche due aujourd'hui n'est pas en retard à 00 h 01, ce que faisait
 * l'ancienne comparaison `new Date(deadline) < new Date()` : elle basculait la
 * ligne en rouge dès la première seconde de la journée.
 */
export function isOverdue(
  deadline: string | undefined | null,
  completed: boolean,
  pref: TimezonePref = getTimezonePref(),
  now: Date = new Date(),
): boolean {
  if (completed) return false;
  const days = daysUntilDeadline(deadline, pref, now);
  return Number.isFinite(days) && days < 0;
}
