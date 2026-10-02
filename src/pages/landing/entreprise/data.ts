// Données statiques du track entreprise de la landing.
//
// Même règle que `src/pages/landing/data.ts` : ce module est évalué au premier
// import, donc il ne contient AUCUN texte traduisible — uniquement des clés de
// catalogue, de la géométrie et des chemins d'images.
//
// ⚠️ Les captures décrivent la MÊME organisation de démonstration (« Nova
// Studio », seed de `src/modules/organizations/local.repository.ts`) que celle
// ouverte par le bouton « Ouvrir la démo entreprise ». C'est volontaire : le
// visiteur retrouve exactement les écrans et les noms qu'il vient de voir. Si
// le seed démo change, les captures doivent suivre.

import type { KeyOf } from '@/i18n/catalog';
import { ENTERPRISE_FREE_OFFER } from './free-offer';

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
  projectsPlanning: { id: 'projectsPlanning', labelKey: 'enterprise.shot.projectsPlanning', image: shot('projets-planning'), altKey: 'enterprise.shot.projectsPlanningAlt' },
  projectsPortfolio: { id: 'projectsPortfolio', labelKey: 'enterprise.shot.projectsPortfolio', image: shot('projets-portefeuille'), altKey: 'enterprise.shot.projectsPortfolioAlt' },
  okr: { id: 'okr', labelKey: 'enterprise.shot.okr', image: shot('okr'), altKey: 'enterprise.shot.okrAlt' },
  // L'onglet Statistiques est masqué de la navigation depuis le 2026-09-30 :
  // l'étape « Suivi » montre les rapports d'activité, qu'on atteint vraiment.
  reports: { id: 'reports', labelKey: 'enterprise.shot.reports', image: shot('rapports'), altKey: 'enterprise.shot.reportsAlt' },
  tasks: { id: 'tasks', labelKey: 'enterprise.shot.tasks', image: shot('taches'), altKey: 'enterprise.shot.tasksAlt' },
  // Étape 3 : le Tableau par statut, et la fiche d'une tâche bloquée (onglet
  // Dépendances), affichée en surimpression par `ExecutionSection`.
  tasksBoard: { id: 'tasksBoard', labelKey: 'enterprise.shot.tasksBoard', image: shot('taches-tableau'), altKey: 'enterprise.shot.tasksBoardAlt' },
  tasksDeps: { id: 'tasksDeps', labelKey: 'enterprise.shot.tasksDeps', image: shot('taches-dependances'), altKey: 'enterprise.shot.tasksDepsAlt' },
};

/** Les trois écrans qui défilent dans le hero. */
export const HERO_SHOTS = [SHOTS.overview, SHOTS.projects, SHOTS.okr];

/**
 * Les vingt fonctionnalités de la section « Plus », en quatre familles de cinq.
 *
 * Uniquement ce que les cinq étapes ne montrent PAS, et uniquement ce qui est
 * atteignable dans le produit aujourd'hui (relu dans le code le 2026-10-02).
 * Une fonctionnalité qu'on retire du produit sort d'ici le même jour. L'icône
 * est un NOM, résolu par le composant : ce module n'importe rien de lourd.
 */
export type MoreFeatureIcon =
  | 'KeyRound' | 'UserCog' | 'UsersRound' | 'CalendarPlus' | 'Rocket'
  | 'Copy' | 'Link2' | 'ListChecks' | 'Filter' | 'Search'
  | 'Zap' | 'Webhook' | 'Download' | 'BellRing' | 'Target'
  | 'ScrollText' | 'BadgeCheck' | 'Timer' | 'UserMinus' | 'ArchiveRestore';

export interface MoreFeature {
  /** Rang 1 à 20 : les clés sont `enterprise.more.f{n}t` / `f{n}d`. */
  n: number;
  icon: MoreFeatureIcon;
}

export interface MoreFeatureGroup {
  titleKey: KeyOf<'landing'>;
  features: MoreFeature[];
}

export const MORE_FEATURE_GROUPS: MoreFeatureGroup[] = [
  {
    titleKey: 'enterprise.more.g1',
    features: [
      { n: 1, icon: 'KeyRound' },
      { n: 2, icon: 'UserCog' },
      { n: 3, icon: 'UsersRound' },
      { n: 4, icon: 'CalendarPlus' },
      { n: 5, icon: 'Rocket' },
    ],
  },
  {
    titleKey: 'enterprise.more.g2',
    features: [
      { n: 6, icon: 'Copy' },
      { n: 7, icon: 'Link2' },
      { n: 8, icon: 'ListChecks' },
      { n: 9, icon: 'Filter' },
      { n: 10, icon: 'Search' },
    ],
  },
  {
    titleKey: 'enterprise.more.g3',
    features: [
      { n: 11, icon: 'Zap' },
      { n: 12, icon: 'Webhook' },
      { n: 13, icon: 'Download' },
      { n: 14, icon: 'BellRing' },
      { n: 15, icon: 'Target' },
    ],
  },
  {
    titleKey: 'enterprise.more.g4',
    features: [
      { n: 16, icon: 'ScrollText' },
      { n: 17, icon: 'BadgeCheck' },
      { n: 18, icon: 'Timer' },
      { n: 19, icon: 'UserMinus' },
      { n: 20, icon: 'ArchiveRestore' },
    ],
  },
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
