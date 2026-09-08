// ═══════════════════════════════════════════════════════════════════
// Exemples de syntaxe quick-add — QUICK_ADD_FR_ONLY_SYNTAX
//
// `parseQuickAdd` (src/lib/quick-add-parser.ts) ne reconnaît que des
// mots-clés FRANÇAIS (jeudi, demain, samedi…). Ces exemples ne sont donc pas
// du texte d'interface à traduire : ils sont de la SYNTAXE — cliquer dessus
// insère le mot-clé dans le champ, et un mot-clé anglais n'y serait jamais
// reconnu. Traduire l'affichage casserait la démonstration qu'il donne.
//
// Volontairement hors des catalogues i18n :
//   - `npm run i18n:scan` les ignore via le marqueur `QUICK_ADD_FR_ONLY_SYNTAX`
//     ci-dessus (même mécanisme que `localizeSeed` pour les seeds de démo,
//     cf. scripts/i18n-scan.mjs § isSeedFile).
//   - `npm run i18n:identical` ne les voit jamais : ils ne vivent dans aucun
//     `src/locales/*.json`, donc il n'y a pas d'identité fr/en à déclarer.
// ═══════════════════════════════════════════════════════════════════

/** Placeholders-exemples rotatifs (#21), variante desktop. */
export const QUICK_ADD_EXAMPLES = [
  'Appeler le dentiste jeudi 10h #santé !! ~30m',
  'Préparer la réunion demain 9h ~1h',
  'Faire les courses samedi #maison',
  'Relire le rapport !! ~45m',
] as const;

/** Variante courte mobile : le champ fait ~180px à côté du bouton « Créer ». */
export const QUICK_ADD_EXAMPLES_MOBILE = [
  'Dentiste jeudi 10h',
  'Réunion demain 9h',
  'Courses samedi',
  'Rapport !! ~45m',
] as const;

/** Token de date cliquable dans la ligne d'aide. */
export const QUICK_ADD_DATE_TOKEN = 'demain 10h';
