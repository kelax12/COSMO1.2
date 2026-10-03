// ═══════════════════════════════════════════════════════════════════
// Accueil entreprise : règles pures, sans React.
// ═══════════════════════════════════════════════════════════════════
import type React from 'react';
import type { CreateTeamOKRInput } from '@/modules/team-okrs/types';

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

/** Trois mois, comme l'objectif du premier compte perso. */
const QUARTER_DAYS = 90;

const isoDay = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Le premier objectif d'entreprise (« l'étoile polaire »).
 *
 * · `audience: 'org'` et aucune équipe : visible de toute l'entreprise, c'est
 *   le sens même de l'étape.
 * · Le schéma exige au moins UN résultat clé (`createTeamOKRSchema`). Sa cible
 *   n'est jamais inventée : sans nombre saisi, il est binaire (cible 1),
 *   exactement comme l'objectif du premier compte perso. Un nombre non
 *   strictement positif est traité comme absent (garde B17 : on divise par
 *   la cible).
 * · Dates en jours locaux (`AAAA-MM-JJ`), comme `TeamOKRModal`.
 */
export const buildCompanyOkrInput = (
  objective: string,
  keyResult: string,
  target: string,
  now: Date = new Date(),
): CreateTeamOKRInput => {
  const end = new Date(now);
  end.setDate(end.getDate() + QUARTER_DAYS);
  const parsed = Number(target.replace(',', '.').trim());
  const targetValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  return {
    title: objective.trim(),
    teamIds: [],
    audience: 'org',
    startDate: isoDay(now),
    endDate: isoDay(end),
    keyResults: [{ title: keyResult.trim(), targetValue, currentValue: 0 }],
  };
};

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

export const markMemberWelcomeSeen = (orgId: string, userId: string): void => {
  try {
    localStorage.setItem(welcomeKey(orgId, userId), '1');
  } catch {
    // Sans persistance l'accueil reviendra ; il se ferme en un geste.
  }
};
