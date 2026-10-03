// ═══════════════════════════════════════════════════════════════════
// La constellation de l'accueil entreprise : géométrie pure, sans React.
//
// L'entreprise se dessine comme une carte du ciel : vous au centre, les
// personnes invitées en étoiles reliées à vous (l'organigramme), l'équipe en
// amas, le projet en dessous, et l'objectif d'entreprise en ÉTOILE POLAIRE,
// tout en haut, dorée : c'est elle qui donne le cap à tout le reste. Chaque
// étape de la mise en place allume sa partie du ciel.
//
// Palette héritée du parcours entreprise de la landing (`tailwind.config.js`,
// `ent.*`) : la nuit, la lune, la brume, le faisceau cyan. L'or n'a qu'UN
// rôle, l'étoile polaire, comme le cyan n'en a que deux (la lumière, l'action).
// ═══════════════════════════════════════════════════════════════════

export const ENT = {
  nuit: '#08090C',
  acier: '#1A1F27',
  lune: '#EDF2F7',
  brume: '#8B96A8',
  faisceau: '#22D3EE',
  or: '#F5B942',
} as const;

export const SKY = { width: 560, height: 560 } as const;
export const NORTH = { x: 280, y: 74 } as const;
export const YOU = { x: 280, y: 206 } as const;
export const TEAM_HULL = { cx: 280, cy: 338, rx: 200, ry: 66 } as const;
export const PROJECT = { x: 280, y: 458, w: 212, h: 52 } as const;
/** Hors de l'entreprise, en attente d'acceptation (rejoindre par code). */
export const OUTSIDER = { x: 470, y: 120 } as const;

/** Cinq places pour les personnes invitées ; au-delà, un « +N ». */
export const PEOPLE_SLOTS = [
  { x: 124, y: 320 },
  { x: 198, y: 356 },
  { x: 280, y: 368 },
  { x: 362, y: 356 },
  { x: 436, y: 320 },
] as const;

/** Places montrées en pointillé tant que personne n'est invité. */
export const GHOST_SLOTS = [0, 2, 4] as const;

/** Initiale d'une personne invitée : la première lettre de son adresse. */
export const personInitial = (emailOrName: string): string =>
  (emailOrName.trim()[0] ?? '?').toUpperCase();

/** Initiales d'un nom complet (deux lettres au plus). */
export const initials = (fullName: string | null | undefined): string => {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
};

/** Coupe une étiquette du ciel à `max` caractères, avec une ellipse. */
export const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/**
 * Champ d'étoiles de fond, déterministe : le même ciel à chaque rendu et
 * pour tout le monde (un `Math.random()` le ferait scintiller à chaque
 * rendu React, et différer entre le rendu et sa capture d'écran de test).
 */
export const starField = (count = 46, seed = 7): { x: number; y: number; r: number; o: number; d: number }[] => {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: count }, () => ({
    x: Math.round(rand() * SKY.width),
    y: Math.round(rand() * SKY.height),
    r: Math.round((0.5 + rand() * 1.1) * 10) / 10,
    o: Math.round((0.14 + rand() * 0.4) * 100) / 100,
    d: Math.round((2.5 + rand() * 4) * 10) / 10,
  }));
};

/** Étoile à quatre branches, centrée en (x, y). */
export const fourPointStar = (x: number, y: number, outer: number, inner: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    pts.push(`${Math.round((x + r * Math.cos(a)) * 10) / 10},${Math.round((y + r * Math.sin(a)) * 10) / 10}`);
  }
  return `M ${pts.join(' L ')} Z`;
};
