// ═══════════════════════════════════════════════════════════════════
// Accueil entreprise : règles pures, sans React.
// ═══════════════════════════════════════════════════════════════════
import type React from 'react';

/**
 * Variables de thème redéclarées sur le conteneur de l'accueil entreprise :
 * la DA est celle, FIXE, de la landing entreprise (nuit, lune, brume,
 * faisceau), quel que soit le thème de l'application. Sans elles, les styles
 * globaux des champs (`index.css`) et `OrgConsentNotice` peindraient des
 * bordures et des fonds clairs en thème Clair, sur la nuit.
 */
export const ENT_SCOPE = {
  colorScheme: 'dark',
  '--color-border': '45 53 66',
  '--color-border-strong': '86 98 116',
  '--color-accent': '34 211 238',
  '--color-accent-solid': '34 211 238',
  '--color-accent-solid-hover': '103 232 249',
  '--color-accent-solid-foreground': '8 9 12',
  '--color-surface': '26 31 39',
  '--color-background': '8 9 12',
  '--color-hover': '20 24 31',
  '--color-text-primary': '237 242 247',
  '--color-text-secondary': '139 150 168',
  '--color-text-muted': '139 150 168',
} as React.CSSProperties;

// ─── Accueil d'un membre, au premier passage dans l'espace entreprise ───

const welcomeKey = (orgId: string, userId: string) => `cosmo_org_welcome_seen_${orgId}_${userId}`;

/**
 * Déjà accueilli dans CETTE entreprise, sur cet appareil ? Par entreprise :
 * rejoindre une seconde organisation mérite son propre accueil. Stockage
 * illisible = déjà vu : se tromper dans ce sens ne coûte qu'un écran manqué,
 * l'inverse le ferait revenir à chaque visite (même règle que `first-run.ts`).
 */
export const readMemberWelcomeSeen = (orgId: string, userId: string): boolean => {
  try {
    return localStorage.getItem(welcomeKey(orgId, userId)) === '1';
  } catch {
    return true;
  }
};

/**
 * L'accueil membre est sorti le 2026-10-03. Une personne déjà membre AVANT
 * n'en a pas besoin et le recevait pourtant, par surprise, à sa visite
 * suivante (Axel compris). Seuls les arrivés depuis sont accueillis. Tant que
 * l'annuaire n'est pas chargé, on ne sait pas : on n'ouvre rien.
 */
export const MEMBER_WELCOME_SINCE = '2026-10-03T00:00:00Z';

export const joinedSinceWelcome = (
  members: readonly { userId: string; joinedAt: string }[],
  userId: string,
): boolean => {
  const me = members.find((m) => m.userId === userId);
  return Boolean(me && Date.parse(me.joinedAt) >= Date.parse(MEMBER_WELCOME_SINCE));
};

export const markMemberWelcomeSeen = (orgId: string, userId: string): void => {
  try {
    localStorage.setItem(welcomeKey(orgId, userId), '1');
  } catch {
    // Sans persistance l'accueil reviendra ; il se ferme en un geste.
  }
};
