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
import { ENTERPRISE_FREE_OFFER } from './free-offer';

/** Un nœud de l'organigramme — calqué sur un membre réel du seed démo. */
export interface PyramidNode {
  id: string;
  /**
   * `userId` du membre correspondant dans le seed démo
   * (`src/modules/organizations/local.repository.ts`) — c'est ce qui permet à
   * un clic ici d'ouvrir la VRAIE fiche du VRAI membre une fois en démo,
   * via le même deep-link `?member=&memberTab=` que la pyramide réelle.
   */
  demoUserId: string;
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
    demoUserId: 'demo-user',
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
    demoUserId: 'friend-1',
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
    demoUserId: 'user-lucas',
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
    demoUserId: 'friend-2',
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
    demoUserId: 'friend-3',
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

/** Une capture réelle d'un onglet de l'espace entreprise. */
export interface AppShotRef {
  id: string;
  labelKey: KeyOf<'landing'>;
  /** Capture réelle de l'onglet (mode démo, thème noir). */
  image: string;
  altKey: KeyOf<'landing'>;
}

const shot = (name: string) => `/screenshots/entreprise/${name}.webp`;

/**
 * Les captures, adressées par onglet.
 *
 * Elles ne vivent plus dans une section « visite guidée » séparée : chaque
 * étape du parcours montre l'écran sur lequel elle se joue, au moment où on en
 * parle. Une capture sans l'étape qui l'explique ne prouve rien.
 */
export const SHOTS: Record<string, AppShotRef> = {
  overview: { id: 'overview', labelKey: 'enterprise.shot.overview', image: shot('apercu'), altKey: 'enterprise.shot.overviewAlt' },
  pyramid: { id: 'pyramid', labelKey: 'enterprise.shot.pyramid', image: shot('pyramide'), altKey: 'enterprise.shot.pyramidAlt' },
  members: { id: 'members', labelKey: 'enterprise.shot.members', image: shot('membres'), altKey: 'enterprise.shot.membersAlt' },
  projects: { id: 'projects', labelKey: 'enterprise.shot.projects', image: shot('projets'), altKey: 'enterprise.shot.projectsAlt' },
  projectsKanban: { id: 'projectsKanban', labelKey: 'enterprise.shot.projectsKanban', image: shot('projets-kanban'), altKey: 'enterprise.shot.projectsKanbanAlt' },
  projectsPlanning: { id: 'projectsPlanning', labelKey: 'enterprise.shot.projectsPlanning', image: shot('projets-planning'), altKey: 'enterprise.shot.projectsPlanningAlt' },
  okr: { id: 'okr', labelKey: 'enterprise.shot.okr', image: shot('okr'), altKey: 'enterprise.shot.okrAlt' },
  stats: { id: 'stats', labelKey: 'enterprise.shot.stats', image: shot('statistiques'), altKey: 'enterprise.shot.statsAlt' },
};

/** Les trois écrans qui défilent dans le hero. */
export const HERO_SHOTS = [SHOTS.projects, SHOTS.okr, SHOTS.stats];

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

/**
 * Réponses qui décrivent une limite de sièges — donc fausses pendant l'offre de
 * lancement, où le drapeau serveur `enterprise_seat_limit` est éteint et où
 * rien ne plafonne l'effectif.
 *
 * `a4` (« que se passe-t-il si nous dépassons un palier ? ») annonce un blocage
 * qu'on n'applique pas, et `a5` promet « jusqu'à cinq membres » là où il n'y a
 * aucun plafond. Les variantes `*Free` disent les deux états dans l'ordre : ce
 * qui vaut aujourd'hui, puis ce qui vaudra à la fin de l'offre. Les réponses
 * d'origine restent dans les catalogues, intactes, pour le jour du retour.
 */
const FREE_OFFER_ANSWERS = new Set([4, 5]);

/** Les cinq questions de la FAQ entreprise. */
export const ENTERPRISE_FAQ = Array.from({ length: 5 }, (_, i) => {
  const n = i + 1;
  const free = ENTERPRISE_FREE_OFFER && FREE_OFFER_ANSWERS.has(n);
  return {
    questionKey: `enterprise.faq.q${n}` as KeyOf<'landing'>,
    answerKey: `enterprise.faq.a${n}${free ? 'Free' : ''}` as KeyOf<'landing'>,
  };
});
