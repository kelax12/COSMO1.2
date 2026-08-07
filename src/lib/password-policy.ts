// ═══════════════════════════════════════════════════════════════════
// Politique de mot de passe — source unique (AUD-10)
//
// Avant : la constante était dupliquée dans AuthForm (8), ResetPasswordPage
// (8) et en dur dans SettingsPage (8) — trois valeurs à maintenir, donc trois
// occasions de diverger.
//
// ⚠️ Ce module est une garde UX, PAS la frontière de sécurité. Un appel direct
// à `POST /auth/v1/signup` ne passe pas par ici. Le minimum réellement opposable
// est celui configuré dans Supabase → Authentication → Policies :
//   - Minimum password length      = 12
//   - Password requirements        = lower + upper + digits + symbols
//   - Prevent use of leaked passwords (HaveIBeenPwned) = activé
// Tant que ce réglage serveur n'est pas posé, le minimum effectif reste le
// défaut Supabase (6 caractères).
// ═══════════════════════════════════════════════════════════════════

/** Longueur minimale exigée à l'inscription et au changement de mot de passe. */
export const MIN_PASSWORD_LENGTH = 12;

/** Force du mot de passe : 0–3 (longueur + variété de caractères). */
export const passwordStrength = (pwd: string): number => {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (pwd.length >= 16) score += 1;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd) && /\d/.test(pwd)) score += 1;
  return score;
};
