// ═══════════════════════════════════════════════════════════════════
// ÉCHÉANCES DU CLI — miroir Node de src/lib/deadline.ts
// ═══════════════════════════════════════════════════════════════════
//
// `tasks.deadline` est un `timestamptz`, mais ce que l'on saisit est un JOUR.
// Envoyer `'2026-09-02'` nu laisse Postgres le caster en MINUIT UTC, donc en
// « 2026-09-01 21 h » pour qui vit à l'ouest de Greenwich : la tâche du jour
// est classée en retard. C'est exactement le risque R-01 corrigé côté
// application ; ce fichier est le quatrième chemin d'écriture, qui affirmait la
// parité sans l'avoir.
//
// Le CLI n'a pas accès à la préférence de fuseau (elle vit dans le
// localStorage du navigateur) : il se cale sur le fuseau de la MACHINE, ce qui
// correspond au mode `default` de `src/lib/timezone.ts`.
//
// ❌ Ne jamais envoyer une clé de jour nue dans `tasks.deadline`.
// ❌ Ne jamais relire un jour d'échéance par `.slice(0, 10)` (jour UTC).

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Jour saisi ('YYYY-MM-DD') → instant vrai de minuit, fuseau de la machine. */
export function deadlineToTimestamp(dayKey) {
  if (!dayKey) return null;
  const m = DAY_KEY_RE.exec(String(dayKey));
  // Déjà un instant complet (ou une valeur qu'on ne sait pas interpréter) :
  // on la laisse passer telle quelle plutôt que d'inventer une conversion.
  if (!m) return dayKey;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).toISOString();
}

/** Dernier instant du jour saisi, fuseau de la machine (borne haute incluse). */
export function deadlineEndOfDay(dayKey) {
  if (!dayKey) return null;
  const m = DAY_KEY_RE.exec(String(dayKey));
  if (!m) return dayKey;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999).toISOString();
}

/** Échéance stockée → clé de jour VÉCUE ('' si absente). */
export function deadlineDayKey(value) {
  if (!value) return '';
  const s = String(value);
  if (DAY_KEY_RE.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA');
}
