// Données statiques du track entreprise de la landing.
//
// Même règle que `src/pages/landing/data.ts` : ce module est évalué au premier
// import, donc il ne contient AUCUN texte traduisible — uniquement des clés de
// catalogue, de la géométrie et des chemins d'images.
//
// ⚠️ Les membres et les captures décrivent la MÊME organisation de démonstration
// (« Nova Studio », seed de `src/modules/organizations/local.repository.ts`) que
// celle ouverte par le bouton « Ouvrir la démo entreprise ». C'est volontaire :
// le visiteur retrouve exactement les écrans et les noms qu'il vient de voir.
// Si le seed démo change, cette liste et les captures doivent suivre.

import type { KeyOf } from '@/i18n/catalog';

/** Un nœud de l'organigramme — calqué sur un membre réel du seed démo. */
export interface PyramidNode {
  id: string;
  /** Nom affiché, identique au seed démo. */
  name: string;
  /** Initiales de l'avatar, comme dans l'application. */
  initials: string;
  /** Classes Tailwind de l'avatar, reprises des couleurs de l'app. */
  avatarClass: string;
  /** Clé du rôle (`admin` / `manager` / `membre`). */
  roleKey: KeyOf<'landing'>;
  /** Équipe d'appartenance — la pastille de couleur à droite du rôle. */
  teamClass: string;
  /** `null` pour la racine. */
  parent: string | null;
  /** Position dans le cadre, en pourcentage (x = centre de la carte). */
  x: number;
  y: number;
}

/**
 * Pyramide « Nova Studio » telle qu'elle est livrée en démo :
 *   Vous (admin)
 *   ├── Marie Dupont (manager)
 *   │   ├── Jean Martin
 *   │   └── Sophie Bernard
 *   └── Lucas Moreau
 *
 * Camille Richard, non placée dans le seed, est volontairement absente : la
 * landing montre la règle de périmètre, pas le flux de placement.
 */
export const PYRAMID_NODES: PyramidNode[] = [
  {
    id: 'vous',
    name: 'Vous',
    initials: 'V',
    avatarClass: 'bg-emerald-500',
    roleKey: 'enterprise.pyramid.roleAdmin',
    teamClass: 'bg-transparent',
    parent: null,
    x: 50,
    y: 8,
  },
  {
    id: 'marie',
    name: 'Marie Dupont',
    initials: 'MD',
    avatarClass: 'bg-emerald-500',
    roleKey: 'enterprise.pyramid.roleLead',
    teamClass: 'bg-fuchsia-500',
    parent: 'vous',
    x: 30,
    y: 45,
  },
  {
    id: 'lucas',
    name: 'Lucas Moreau',
    initials: 'LM',
    avatarClass: 'bg-pink-600',
    roleKey: 'enterprise.pyramid.roleMember',
    teamClass: 'bg-blue-500',
    parent: 'vous',
    x: 74,
    y: 45,
  },
  {
    id: 'jean',
    name: 'Jean Martin',
    initials: 'JM',
    avatarClass: 'bg-blue-600',
    roleKey: 'enterprise.pyramid.roleMember',
    teamClass: 'bg-blue-500',
    parent: 'marie',
    x: 15,
    y: 82,
  },
  {
    id: 'sophie',
    name: 'Sophie Bernard',
    initials: 'SB',
    avatarClass: 'bg-emerald-500',
    roleKey: 'enterprise.pyramid.roleMember',
    teamClass: 'bg-fuchsia-500',
    parent: 'marie',
    x: 45,
    y: 82,
  },
];

/**
 * Nœuds en parcours préfixe, avec leur profondeur.
 *
 * Sert au rendu mobile de l'organigramme : sous 768 px, les cartes positionnées
 * en pourcentage se chevauchent (mesuré à 390 px), donc la pyramide s'y déplie
 * en arbre indenté. Même information, même règle de périmètre.
 */
export function pyramidTree(): { node: PyramidNode; depth: number }[] {
  const out: { node: PyramidNode; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const node of PYRAMID_NODES) {
      if (node.parent !== parentId) continue;
      out.push({ node, depth });
      visit(node.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

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
  /** Capture réelle de l'onglet (mode démo, thème noir). */
  image: string;
  altKey: KeyOf<'landing'>;
}

const shot = (name: string) => `/screenshots/entreprise/${name}.webp`;

export const COCKPIT_TABS: CockpitTab[] = [
  {
    id: 'overview',
    labelKey: 'enterprise.cockpit.t1',
    descriptionKey: 'enterprise.cockpit.d1',
    image: shot('apercu'),
    altKey: 'enterprise.cockpit.a1',
  },
  {
    id: 'pyramid',
    labelKey: 'enterprise.cockpit.t2',
    descriptionKey: 'enterprise.cockpit.d2',
    image: shot('pyramide'),
    altKey: 'enterprise.cockpit.a2',
  },
  {
    id: 'projects',
    labelKey: 'enterprise.cockpit.t3',
    descriptionKey: 'enterprise.cockpit.d3',
    image: shot('projets'),
    altKey: 'enterprise.cockpit.a3',
  },
  {
    id: 'okr',
    labelKey: 'enterprise.cockpit.t4',
    descriptionKey: 'enterprise.cockpit.d4',
    image: shot('okr'),
    altKey: 'enterprise.cockpit.a4',
  },
  {
    id: 'stats',
    labelKey: 'enterprise.cockpit.t5',
    descriptionKey: 'enterprise.cockpit.d5',
    image: shot('statistiques'),
    altKey: 'enterprise.cockpit.a5',
  },
  {
    id: 'members',
    labelKey: 'enterprise.cockpit.t6',
    descriptionKey: 'enterprise.cockpit.d6',
    image: shot('membres'),
    altKey: 'enterprise.cockpit.a6',
  },
];

/** Les trois écrans qui défilent dans le hero — les mêmes captures réelles. */
export const HERO_SHOTS = ['projects', 'okr', 'stats'].map(
  (id) => COCKPIT_TABS.find((tab) => tab.id === id)!,
);

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
