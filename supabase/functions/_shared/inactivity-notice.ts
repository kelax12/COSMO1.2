// ═══════════════════════════════════════════════════════════════════
// Avertissement de suppression pour inactivité (C-121) · module PUR
// ═══════════════════════════════════════════════════════════════════
//
// Zéro API Deno, zéro import : `src/inactive-accounts.guard.test.ts` le teste
// directement, comme `refund-replay.ts`. ❌ Ne pas y mêler d'appel réseau.
//
// Ce que la politique de confidentialité promet (s6.li1) : un compte sans
// activité pendant 3 ans est supprimé, après un e-mail envoyé 30 jours avant.
// L'e-mail doit donc dire QUAND, et COMMENT l'éviter : se connecter suffit.

/** Délai entre l'avertissement et l'effacement, en jours. Celui de la politique. */
export const INACTIVITY_GRACE_DAYS = 30

/** Plafonds par exécution quotidienne (« jamais un e-mail sans plafond de débit »). */
export const MAX_NOTICES_PER_RUN = 50
export const MAX_DELETIONS_PER_RUN = 20

/** Date d'effacement annoncée : avertissement + 30 jours, au format JJ/MM/AAAA (UTC). */
export function deletionDate(warnedAt: Date): string {
  const d = new Date(warnedAt.getTime() + INACTIVITY_GRACE_DAYS * 24 * 60 * 60 * 1000)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

export interface InactivityMail {
  subject: string
  text: string
  html: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Corps de l'avertissement. `appUrl` sans barre finale. */
export function inactivityMail(appUrl: string, warnedAt: Date): InactivityMail {
  const date = deletionDate(warnedAt)
  const login = `${appUrl}/login`
  const lines = [
    'Bonjour,',
    '',
    "Votre compte Cosmo n'a pas ete utilise depuis plus de trois ans.",
    '',
    `Comme l'annonce notre politique de confidentialite, il sera supprime le ${date}, avec toutes ses donnees (taches, habitudes, objectifs, agenda).`,
    '',
    `Pour le garder, il suffit de vous connecter une fois avant cette date : ${login}`,
    '',
    "Si vous ne souhaitez plus utiliser Cosmo, vous n'avez rien a faire.",
    '',
    "L'equipe Cosmo",
    '',
    '---',
    '',
    `Your Cosmo account has not been used for more than three years. It will be deleted on ${date}, with all its data. To keep it, just sign in once before that date: ${login}`,
  ]
  return {
    subject: `Votre compte Cosmo sera supprime le ${date}`,
    text: lines.join('\n'),
    html: lines
      .map((l) => (l === '' ? '<br>' : `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`))
      .join(''),
  }
}
