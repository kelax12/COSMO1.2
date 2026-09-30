// ═══════════════════════════════════════════════════════════════════
// Texte libre d'un utilisateur, placé dans un e-mail envoyé par COSMO
// (audit de sécurité du 2026-09-30)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. `send-org-invite` écrit le NOM de l'organisation et celui de
// l'invitant dans un e-mail signé par notre domaine. Ces deux noms sont choisis
// librement par l'expéditeur. Sans filtre, « Votre compte est suspendu,
// reconnectez-vous sur https://… » devient un e-mail d'hameçonnage
// parfaitement authentifié (SPF, DKIM) par COSMO. `escapeHtml` empêche
// l'injection de balises, pas celle d'un lien : les clients de messagerie
// transforment d'eux-mêmes une URL écrite en clair en lien cliquable.
//
// ⚠️ Ce qui reste : un nom de domaine SANS schéma ni `www.` (« acme.com »)
//    peut encore être rendu cliquable par certains clients. On ne le retire
//    pas : « Acme.io » est un nom d'entreprise légitime. Le plafond de débit
//    de `send-org-invite` borne l'ampleur d'un abus.
//
// ✅ Module PUR, testé par `src/org-invite-mail.guard.test.ts`.

/**
 * Caractères de contrôle et de mise en forme bidirectionnelle, qui permettent
 * de maquiller un texte (RLO, zero-width…). Testés par code et non par regex :
 * ESLint refuse, à raison, les caractères de contrôle dans un littéral.
 */
function isInvisible(code: number): boolean {
  return code <= 0x1f
    || (code >= 0x7f && code <= 0x9f)
    || (code >= 0x200b && code <= 0x200f)
    || (code >= 0x202a && code <= 0x202e)
    || (code >= 0x2060 && code <= 0x2069)
    || code === 0xfeff
}

/** Retire les URL explicites, les caractères de contrôle, et borne la longueur. */
export function mailSafeText(raw: string, max: number): string {
  const cleaned = [...raw]
    // Un saut de ligne ou une tabulation sépare deux mots : ils deviennent une
    // espace, pas un collage.
    .map((ch) => (ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v' ? ' ' : ch))
    .filter((ch) => !isInvisible(ch.codePointAt(0) ?? 0))
    .join('')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S*/gi, '')
    .replace(/\bwww\.\S*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  const bounded = cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned
  return bounded
}
