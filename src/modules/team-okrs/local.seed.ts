// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul (V12.3) : aucune lecture ni écriture de stockage ici. Le
// dépôt de démo voisin l'ensemence au premier accès.

import { TeamOKR } from './types';
import { isEnglishSeed } from '@/lib/seed-i18n';

const DEMO_ORG_ID = 'org-demo-1';
export const DEMO_USER_ID = 'demo-user';

export const DEMO_OKRS: TeamOKR[] = [
  {
    id: 'tokr-1',
    orgId: DEMO_ORG_ID,
    title: 'Réussir le lancement produit',
    description: 'Faire du lancement un succès mesurable sur le trimestre.',
    categoryId: 'teamcat-croissance',
    startDate: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10),
    createdBy: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    teamIds: [],
    keyResults: [
      { id: 'tkr-1', okrId: 'tokr-1', orgId: DEMO_ORG_ID, title: 'Atteindre 1000 inscrits', currentValue: 640, targetValue: 1000, unit: 'inscrits', assigneeId: 'friend-1', completed: false, estimatedTime: 5 },
      { id: 'tkr-2', okrId: 'tokr-1', orgId: DEMO_ORG_ID, title: 'Obtenir 15 retombées presse', currentValue: 15, targetValue: 15, unit: 'articles', assigneeId: 'user-camille', completed: true, completedAt: new Date(Date.now() - 3 * 86400000).toISOString(), estimatedTime: 120 },
      { id: 'tkr-3', okrId: 'tokr-1', orgId: DEMO_ORG_ID, title: 'Taux de conversion 5 %', currentValue: 3.2, targetValue: 5, unit: '%', assigneeId: 'friend-2', completed: false, estimatedTime: 60 },
    ],
  },
  {
    id: 'tokr-2',
    orgId: DEMO_ORG_ID,
    title: 'Livrer la refonte du site',
    description: 'Mettre en ligne le nouveau site, rapide et accessible.',
    categoryId: 'teamcat-produit',
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
    createdBy: 'friend-1',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    teamIds: ['team-dev'],
    keyResults: [
      { id: 'tkr-4', okrId: 'tokr-2', orgId: DEMO_ORG_ID, title: 'Score Lighthouse ≥ 95', currentValue: 88, targetValue: 95, unit: 'pts', assigneeId: 'friend-2', completed: false, estimatedTime: 90 },
      { id: 'tkr-5', okrId: 'tokr-2', orgId: DEMO_ORG_ID, title: '100 % des pages migrées', currentValue: 70, targetValue: 100, unit: '%', assigneeId: 'friend-3', completed: false, estimatedTime: 45 },
    ],
  },
  {
    id: 'tokr-3',
    orgId: DEMO_ORG_ID,
    title: 'Renforcer la culture d\'équipe',
    description: 'Améliorer l\'engagement et l\'onboarding interne.',
    categoryId: 'teamcat-interne',
    startDate: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 50 * 86400000).toISOString().slice(0, 10),
    createdBy: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    teamIds: ['team-design'],
    keyResults: [
      { id: 'tkr-6', okrId: 'tokr-3', orgId: DEMO_ORG_ID, title: 'Onboarder 3 recrues', currentValue: 2, targetValue: 3, unit: 'personnes', assigneeId: 'demo-user', completed: false, estimatedTime: 240 },
      { id: 'tkr-7', okrId: 'tokr-3', orgId: DEMO_ORG_ID, title: 'Score eNPS ≥ 40', currentValue: 34, targetValue: 40, unit: 'pts', assigneeId: 'user-lucas', completed: false, estimatedTime: 30 },
    ],
  },
  {
    id: 'tokr-4',
    orgId: DEMO_ORG_ID,
    title: 'Doubler le trafic qualifié',
    description: 'Faire croître l\'acquisition sans faire exploser le coût par lead.',
    categoryId: 'teamcat-croissance',
    startDate: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    createdBy: 'user-manon',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    teamIds: ['team-marketing'],
    keyResults: [
      { id: 'tkr-8', okrId: 'tokr-4', orgId: DEMO_ORG_ID, title: '20 000 visites organiques par mois', currentValue: 12400, targetValue: 20000, unit: 'visites', assigneeId: 'user-paul', completed: false, estimatedTime: 60 },
      { id: 'tkr-9', okrId: 'tokr-4', orgId: DEMO_ORG_ID, title: '300 leads qualifiés', currentValue: 185, targetValue: 300, unit: 'leads', assigneeId: 'user-karim', completed: false, estimatedTime: 45 },
      { id: 'tkr-10', okrId: 'tokr-4', orgId: DEMO_ORG_ID, title: '2 000 abonnés à la newsletter', currentValue: 2000, targetValue: 2000, unit: 'abonnés', assigneeId: 'user-lea', completed: true, completedAt: new Date(Date.now() - 2 * 86400000).toISOString(), estimatedTime: 30 },
    ],
  },
  {
    id: 'tokr-5',
    orgId: DEMO_ORG_ID,
    title: 'Sortir la bêta de l\'app mobile',
    description: 'Une première version stable entre les mains de vrais utilisateurs.',
    categoryId: 'teamcat-produit',
    startDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 75 * 86400000).toISOString().slice(0, 10),
    createdBy: 'user-lucas',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    teamIds: ['team-dev'],
    keyResults: [
      { id: 'tkr-11', okrId: 'tokr-5', orgId: DEMO_ORG_ID, title: '50 bêta-testeurs actifs', currentValue: 18, targetValue: 50, unit: 'testeurs', assigneeId: 'user-ines', completed: false, estimatedTime: 90 },
      { id: 'tkr-12', okrId: 'tokr-5', orgId: DEMO_ORG_ID, title: '12 écrans maquettés', currentValue: 7, targetValue: 12, unit: 'écrans', assigneeId: 'user-chloe', completed: false, estimatedTime: 60 },
      { id: 'tkr-13', okrId: 'tokr-5', orgId: DEMO_ORG_ID, title: '100 tests automatisés', currentValue: 42, targetValue: 100, unit: 'tests', assigneeId: 'user-antoine', completed: false, estimatedTime: 120 },
    ],
  },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. `TeamOKR` imbrique `keyResults`
// (chacun avec son propre `id`), ce que `localizeSeed` ne parcourt pas : patch
// ad hoc à deux niveaux plutôt que forcer le helper générique.
// `categoryId` n'a pas d'overlay ici : c'est un identifiant, pas du texte —
// sa traduction vit dans l'overlay de `team-categories/local.seed.ts`
// (DEMO_CATEGORIES_EN), une seule fois pour tous les modules qui le portent.
const DEMO_OKRS_EN: Record<string, {
  title?: string; description?: string;
  keyResults?: Record<string, { title?: string; unit?: string }>;
}> = {
  'tokr-1': {
    title: 'Make the product launch a success',
    description: 'Turn the launch into a measurable success this quarter.',
    keyResults: {
      'tkr-1': { title: 'Reach 1,000 sign-ups', unit: 'sign-ups' },
      'tkr-2': { title: 'Get 15 press mentions', unit: 'articles' },
      'tkr-3': { title: '5% conversion rate', unit: '%' },
    },
  },
  'tokr-2': {
    title: 'Ship the website redesign',
    description: 'Launch the new site, fast and accessible.',
    keyResults: {
      'tkr-4': { title: 'Lighthouse score ≥ 95', unit: 'pts' },
      'tkr-5': { title: '100% of pages migrated', unit: '%' },
    },
  },
  'tokr-3': {
    title: 'Strengthen team culture',
    description: 'Improve engagement and internal onboarding.',
    keyResults: {
      'tkr-6': { title: 'Onboard 3 new hires', unit: 'people' },
      'tkr-7': { title: 'eNPS score ≥ 40', unit: 'pts' },
    },
  },
  'tokr-4': {
    title: 'Double qualified traffic',
    description: 'Grow acquisition without blowing up the cost per lead.',
    keyResults: {
      'tkr-8': { title: '20,000 organic visits per month', unit: 'visits' },
      'tkr-9': { title: '300 qualified leads', unit: 'leads' },
      'tkr-10': { title: '2,000 newsletter subscribers', unit: 'subscribers' },
    },
  },
  'tokr-5': {
    title: 'Ship the mobile app beta',
    description: 'A first stable release in the hands of real users.',
    keyResults: {
      'tkr-11': { title: '50 active beta testers', unit: 'testers' },
      'tkr-12': { title: '12 screens designed', unit: 'screens' },
      'tkr-13': { title: '100 automated tests', unit: 'tests' },
    },
  },
};

export function localizeOkrs(okrs: TeamOKR[]): TeamOKR[] {
  if (!isEnglishSeed()) return okrs;
  return okrs.map((okr) => {
    const patch = DEMO_OKRS_EN[okr.id];
    if (!patch) return okr;
    return {
      ...okr,
      title: patch.title ?? okr.title,
      description: patch.description ?? okr.description,
      keyResults: okr.keyResults.map((kr) => {
        const krPatch = patch.keyResults?.[kr.id];
        return krPatch ? { ...kr, ...krPatch } : kr;
      }),
    };
  });
}
