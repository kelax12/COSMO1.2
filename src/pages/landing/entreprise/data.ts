// Données statiques du track entreprise de la landing.
//
// Même règle que `src/pages/landing/data.ts` : ce module est évalué au premier
// import, donc il ne contient AUCUN texte traduisible — uniquement des clés de
// catalogue et de la géométrie. Les prénoms de l'organigramme font exception :
// ce sont des noms propres fictifs, identiques dans toutes les langues.

import type { KeyOf } from '@/i18n/catalog';

/** Un nœud de l'organigramme de démonstration. */
export interface PyramidNode {
  id: string;
  /** Prénom fictif affiché sous le nœud. */
  name: string;
  /** `null` pour la racine. */
  parent: string | null;
  /** Niveau hiérarchique — pilote la couleur et le libellé de rôle. */
  level: 0 | 1 | 2;
  /** Coordonnées dans le `viewBox` du SVG (0 0 900 420). */
  x: number;
  y: number;
}

/**
 * Organigramme de démonstration : 1 direction, 3 managers, 7 membres.
 *
 * Trois branches suffisent à montrer ce qui compte — qu'une branche s'illumine
 * entièrement au survol de son manager, et que les deux autres s'éteignent.
 */
export const PYRAMID_NODES: PyramidNode[] = [
  { id: 'dir', name: 'Alix', parent: null, level: 0, x: 450, y: 56 },

  { id: 'm1', name: 'Léa', parent: 'dir', level: 1, x: 150, y: 210 },
  { id: 'm2', name: 'Sam', parent: 'dir', level: 1, x: 450, y: 210 },
  { id: 'm3', name: 'Nour', parent: 'dir', level: 1, x: 750, y: 210 },

  { id: 'c1', name: 'Ilan', parent: 'm1', level: 2, x: 62, y: 364 },
  { id: 'c2', name: 'Maya', parent: 'm1', level: 2, x: 238, y: 364 },
  { id: 'c3', name: 'Théo', parent: 'm2', level: 2, x: 362, y: 364 },
  { id: 'c4', name: 'Zoé', parent: 'm2', level: 2, x: 538, y: 364 },
  { id: 'c5', name: 'Adam', parent: 'm3', level: 2, x: 662, y: 364 },
  { id: 'c6', name: 'Rim', parent: 'm3', level: 2, x: 838, y: 364 },
];

/** Descendants d'un nœud, lui-même inclus — le « périmètre » d'un manager. */
export function subtreeOf(nodeId: string): Set<string> {
  const scope = new Set<string>([nodeId]);
  // L'organigramme est ordonné parent avant enfant : une seule passe suffit.
  for (const node of PYRAMID_NODES) {
    if (node.parent && scope.has(node.parent)) scope.add(node.id);
  }
  return scope;
}

/** Les six onglets de l'espace entreprise, dans l'ordre de l'application. */
export interface CockpitTab {
  id: string;
  labelKey: KeyOf<'landing'>;
  descriptionKey: KeyOf<'landing'>;
}

export const COCKPIT_TABS: CockpitTab[] = [
  { id: 'overview', labelKey: 'enterprise.cockpit.t1', descriptionKey: 'enterprise.cockpit.d1' },
  { id: 'pyramid', labelKey: 'enterprise.cockpit.t2', descriptionKey: 'enterprise.cockpit.d2' },
  { id: 'projects', labelKey: 'enterprise.cockpit.t3', descriptionKey: 'enterprise.cockpit.d3' },
  { id: 'okr', labelKey: 'enterprise.cockpit.t4', descriptionKey: 'enterprise.cockpit.d4' },
  { id: 'stats', labelKey: 'enterprise.cockpit.t5', descriptionKey: 'enterprise.cockpit.d5' },
  { id: 'members', labelKey: 'enterprise.cockpit.t6', descriptionKey: 'enterprise.cockpit.d6' },
];

/** Les quatre chiffres du bandeau de preuve, sous le hero. */
export interface ProofMetric {
  value: number;
  suffix?: string;
  labelKey: KeyOf<'landing'>;
}

export const PROOF_METRICS: ProofMetric[] = [
  { value: 5, labelKey: 'enterprise.proof.m1' },
  { value: 6, labelKey: 'enterprise.proof.m2' },
  { value: 0, labelKey: 'enterprise.proof.m3' },
  { value: 100, suffix: '%', labelKey: 'enterprise.proof.m4' },
];

/** Les quatre garanties de la section sécurité. */
export interface SecurityPoint {
  titleKey: KeyOf<'landing'>;
  bodyKey: KeyOf<'landing'>;
}

export const SECURITY_POINTS: SecurityPoint[] = [
  { titleKey: 'enterprise.security.s1t', bodyKey: 'enterprise.security.s1d' },
  { titleKey: 'enterprise.security.s2t', bodyKey: 'enterprise.security.s2d' },
  { titleKey: 'enterprise.security.s3t', bodyKey: 'enterprise.security.s3d' },
  { titleKey: 'enterprise.security.s4t', bodyKey: 'enterprise.security.s4d' },
];

/** Les cinq questions de la FAQ entreprise. */
export const ENTERPRISE_FAQ = Array.from({ length: 5 }, (_, i) => ({
  questionKey: `enterprise.faq.q${i + 1}` as KeyOf<'landing'>,
  answerKey: `enterprise.faq.a${i + 1}` as KeyOf<'landing'>,
}));
