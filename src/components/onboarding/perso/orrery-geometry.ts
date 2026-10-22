// ═══════════════════════════════════════════════════════════════════
// Le planétaire de l'accueil perso : géométrie pure, sans React.
//
// COSMO se présente comme un système : vous au centre (la planète du logo),
// et quatre orbites, une par module. Chaque étape de l'accueil allume la
// sienne ; à la fin, le système entier est « en orbite ». Les orbites sont
// des ellipses aplaties (un planétaire vu de trois quarts), ce qui laisse la
// place aux étiquettes sans les empiler.
//
// Tout est en coordonnées du `viewBox` : le composant ne calcule rien d'autre
// que ce qui est ici, donc un test peut vérifier qu'aucune planète ne sort du
// cadre sans monter le moindre SVG.
// ═══════════════════════════════════════════════════════════════════

export const ORRERY_VIEWBOX = { width: 560, height: 400 } as const;
export const ORRERY_CENTER = { x: 280, y: 196 } as const;

export const PLANETS = ['tasks', 'agenda', 'habits', 'okr'] as const;
export type Planet = (typeof PLANETS)[number];

/** `idle` : pas encore abordé · `active` : l'étape en cours · `done` : passée. */
export type PlanetState = 'idle' | 'active' | 'done';

/**
 * Du bleu au fuchsia, comme les accents de la landing perso (bleu → violet →
 * fuchsia) : l'accueil reprend la page d'où vient la personne. Chaque teinte
 * est en `-600`, la seule qui tienne 4,5:1 sur blanc pour un mot en couleur.
 */
export const PLANET_COLOR: Record<Planet, string> = {
  tasks: '#2563EB',
  agenda: '#4F46E5',
  habits: '#7C3AED',
  okr: '#C026D3',
};

interface Orbit {
  rx: number;
  ry: number;
  /** Position de la planète sur son orbite, en degrés (0 = à droite, sens horaire). */
  angle: number;
  /** Durée d'un tour de la comète, en secondes : les orbites lointaines sont lentes. */
  period: number;
}

export const ORBITS: Record<Planet, Orbit> = {
  tasks: { rx: 92, ry: 34, angle: 250, period: 9 },
  agenda: { rx: 148, ry: 55, angle: 338, period: 14 },
  habits: { rx: 204, ry: 76, angle: 158, period: 19 },
  okr: { rx: 258, ry: 96, angle: 62, period: 25 },
};

/** Position de la planète d'un module. */
export const planetPosition = (planet: Planet): { x: number; y: number } => {
  const { rx, ry, angle } = ORBITS[planet];
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.round((ORRERY_CENTER.x + rx * Math.cos(rad)) * 10) / 10,
    y: Math.round((ORRERY_CENTER.y + ry * Math.sin(rad)) * 10) / 10,
  };
};

/**
 * L'ellipse écrite en chemin, pour `<animateMotion>` : deux demi-arcs. Départ
 * à gauche, sens horaire, comme la lecture.
 */
export const orbitPath = (planet: Planet): string => {
  const { rx, ry } = ORBITS[planet];
  const { x, y } = ORRERY_CENTER;
  return `M ${x - rx} ${y} a ${rx} ${ry} 0 1 1 ${2 * rx} 0 a ${rx} ${ry} 0 1 1 ${-2 * rx} 0`;
};

/**
 * Graduations de l'anneau extérieur, à la manière d'un astrolabe. Une
 * graduation sur six est longue. Calculées une fois : elles ne bougent jamais.
 */
export const outerTicks = (count = 72): { x1: number; y1: number; x2: number; y2: number; major: boolean }[] => {
  const rx = 268;
  const ry = 102;
  const { x, y } = ORRERY_CENTER;
  return Array.from({ length: count }, (_, i) => {
    const rad = (i / count) * Math.PI * 2;
    const major = i % 6 === 0;
    const len = major ? 7 : 3.5;
    const cx = x + rx * Math.cos(rad);
    const cy = y + ry * Math.sin(rad);
    // Normale approchée de l'ellipse : suffisante pour un trait de 7 px.
    const nx = Math.cos(rad) / rx;
    const ny = Math.sin(rad) / ry;
    const n = Math.hypot(nx, ny) || 1;
    return {
      x1: Math.round(cx * 10) / 10,
      y1: Math.round(cy * 10) / 10,
      x2: Math.round((cx + (nx / n) * len) * 10) / 10,
      y2: Math.round((cy + (ny / n) * len) * 10) / 10,
      major,
    };
  });
};

/** État de chaque planète pour une étape donnée de l'accueil (0 = intro, 5 = fin). */
export const planetStates = (step: number): Record<Planet, PlanetState> => {
  const out = {} as Record<Planet, PlanetState>;
  PLANETS.forEach((planet, i) => {
    const planetStep = i + 1;
    out[planet] = step > planetStep ? 'done' : step === planetStep ? 'active' : 'idle';
  });
  return out;
};
