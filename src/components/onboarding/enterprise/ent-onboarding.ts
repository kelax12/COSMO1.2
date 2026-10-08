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

// ─── Demande d'adhésion en attente : le nom de l'entreprise visée ───

const JOIN_ORG_KEY = 'cosmo_join_request_org';

/**
 * La demande relue depuis le serveur ne porte que l'identifiant de
 * l'entreprise (illisible tant qu'on n'en est pas membre) : l'écran d'attente
 * ne pouvait pas dire À QUI la demande était partie. On garde le nom renvoyé
 * à l'envoi, sur cet appareil.
 */
export const rememberJoinRequestOrg = (name: string): void => {
  try {
    localStorage.setItem(JOIN_ORG_KEY, name.slice(0, 80));
  } catch {
    /* stockage indisponible : l'attente restera anonyme */
  }
};

export const readJoinRequestOrg = (): string => {
  try {
    return localStorage.getItem(JOIN_ORG_KEY) ?? '';
  } catch {
    return '';
  }
};
