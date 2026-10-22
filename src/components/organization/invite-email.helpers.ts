/** Coupe une saisie collée (virgules, points-virgules, espaces, retours), sans doublon. */
export const splitEmails = (raw: string): string[] =>
  [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
