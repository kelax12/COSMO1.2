// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — DONNÉES DE DÉMONSTRATION
//
// FRONTIÈRE : un jeu de données n'est pas un repository. Ce fichier ne lit
// ni n'écrit rien : il DÉCRIT trois projets, une vingtaine de tâches, leurs
// commentaires, sous-tâches, étiquettes, dépendances et journal d'activité,
// répartis sur les six membres de « Nova Studio ».
//
// 🔴 Seeds DÉTERMINISTES : aucun `Math.random()`. Deux ouvertures de la démo
// doivent montrer exactement la même chose — c'est ce qui rend une capture
// d'écran ou un test reproductibles. Les dates sont RELATIVES à maintenant
// (`dateStr`, `iso`), donc la démo ne vieillit jamais.
//
// ⚠️ Le français est la forme de RÉFÉRENCE ; l'anglais est un recouvrement
// par identifiant (`*_EN` + `localizeSeed`), jamais une seconde liste. Une
// entrée ajoutée sans sa traduction reste lisible, en français.
//
// Rechargées à chaque `loginDemo()` (sweep `cosmo_*` de `clearDemoStorage`).
//
// Extrait de `local.repository.ts` le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import type {
  TeamProject,
  TeamTask,
  TeamTaskStatus,
  TeamTaskComment,
  TeamSubtask,
  TeamTaskActivity,
  TeamTaskDependency,
  TeamActivityField,
  TeamProjectDependency,
} from './types';

export const DEMO_ORG_ID = 'org-demo-1';
export const DEMO_USER_ID = 'demo-user';

const DAY = 24 * 60 * 60 * 1000;
// Date locale 'YYYY-MM-DD' décalée de `offset` jours (déterministe).
const dateStr = (offset: number): string =>
  new Date(Date.now() + offset * DAY).toLocaleDateString('en-CA');
const iso = (offset: number): string => new Date(Date.now() + offset * DAY).toISOString();

const MEMBERS = [
  'demo-user', 'friend-1', 'friend-2', 'friend-3', 'user-lucas', 'user-camille',
  // 6..14 : élargissement à 15 personnes (2026-10-05).
  'user-manon', 'user-chloe', 'user-emma', 'user-ines', 'user-antoine',
  'user-paul', 'user-lea', 'user-karim', 'user-yanis',
];

// Cloisonnement (v2, 1d) : Refonte → équipe Dev, Lancement → équipe Design,
// Interne → projet d'ORG (team_id null, visible par toute l'entreprise).
// Projet riche (mig. 153) : responsable, statut, début et fin, description.
export const DEMO_PROJECTS: TeamProject[] = [
  {
    id: 'tproj-1', orgId: DEMO_ORG_ID, name: 'Refonte du site', color: 'blue', createdBy: DEMO_USER_ID, archivedAt: null, createdAt: iso(-40), teamId: 'team-dev',
    description: 'Nouveau site vitrine : maquettes, intégration, performances et suivi d’audience.',
    ownerId: DEMO_USER_ID, status: 'active', startDate: dateStr(-30), dueDate: dateStr(21),
  },
  {
    id: 'tproj-2', orgId: DEMO_ORG_ID, name: 'Lancement produit', color: 'purple', createdBy: DEMO_USER_ID, archivedAt: null, createdAt: iso(-25), teamId: 'team-design',
    description: 'Mise sur le marché de la nouvelle offre : communication, presse et démonstrations.',
    ownerId: 'friend-2', status: 'planned', startDate: dateStr(-5), dueDate: dateStr(45),
  },
  {
    id: 'tproj-3', orgId: DEMO_ORG_ID, name: 'Interne', color: 'green', createdBy: 'friend-1', archivedAt: null, createdAt: iso(-15), teamId: null,
    ownerId: 'friend-1', status: 'active',
  },
  {
    id: 'tproj-4', orgId: DEMO_ORG_ID, name: 'Campagne d’acquisition', color: 'amber', createdBy: 'user-manon', archivedAt: null, createdAt: iso(-20), teamId: 'team-marketing',
    description: 'Acquisition payante et organique : SEO, publicités, partenariats et newsletter.',
    ownerId: 'user-manon', status: 'active', startDate: dateStr(-15), dueDate: dateStr(30),
  },
  {
    id: 'tproj-5', orgId: DEMO_ORG_ID, name: 'Application mobile', color: 'teal', createdBy: 'user-lucas', archivedAt: null, createdAt: iso(-10), teamId: 'team-dev',
    description: 'Première version de l’app iOS et Android : connexion, synchronisation, notifications.',
    ownerId: 'user-lucas', status: 'planned', startDate: dateStr(5), dueDate: dateStr(75),
  },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts.
export const DEMO_PROJECTS_EN: Record<string, Partial<TeamProject>> = {
  'tproj-1': { name: 'Website redesign', description: 'New showcase site: mockups, integration, performance and audience tracking.' },
  'tproj-2': { name: 'Product launch', description: 'Bringing the new offer to market: communication, press and demos.' },
  'tproj-3': { name: 'Internal' },
  'tproj-4': { name: 'Acquisition campaign', description: 'Paid and organic acquisition: SEO, ads, partnerships and newsletter.' },
  'tproj-5': { name: 'Mobile app', description: 'First release of the iOS and Android app: sign-in, sync, notifications.' },
};

// Le lancement attend le nouveau site : `tproj-2` est BLOQUÉ par `tproj-1`.
export const DEMO_PROJECT_DEPENDENCIES: TeamProjectDependency[] = [
  { projectId: 'tproj-2', dependsOnId: 'tproj-1' },
];

// Fabrique une tâche seed déterministe. Une tâche sur quatre reçoit un
// second assigné (démonstration de la multi-assignation).
let seq = 0;
const t = (
  projectId: string,
  name: string,
  assigneeIdx: number,
  priority: number,
  deadlineOffset: number | null,
  completed: boolean,
  /**
   * Statut de flux (mig. 091). Les seeds ne produisaient que `todo` et `done`,
   * si bien que le kanban par statut — l'item #9 — n'avait qu'une seule
   * colonne remplie et paraissait cassé. `done` reste lié a `completed` : le
   * serveur garde les deux synchronises, la demo doit en faire autant.
   */
  status: Exclude<TeamTaskStatus, 'done'> = 'todo',
): TeamTask => {
  seq += 1;
  const assigneeIds = [MEMBERS[assigneeIdx % MEMBERS.length]];
  if (seq % 4 === 0) {
    const second = MEMBERS[(assigneeIdx + 1) % MEMBERS.length];
    if (!assigneeIds.includes(second)) assigneeIds.push(second);
  }
  return {
    id: `ttask-${seq}`,
    status: completed ? 'done' : status,
    orgId: DEMO_ORG_ID,
    projectId,
    name,
    priority,
    deadline: deadlineOffset === null ? '' : dateStr(deadlineOffset),
    // Début planifié (mig. 153) : deux à quatre jours avant l'échéance, pour
    // que la frise montre de vraies barres et non plus des points seuls.
    startDate: deadlineOffset === null ? '' : dateStr(deadlineOffset - 2 - (seq % 3)),
    estimatedTime: 30 + (seq % 4) * 15,
    assigneeIds,
    createdBy: DEMO_USER_ID,
    completed,
    completedAt: completed ? iso(-2) : null,
    createdAt: iso(-30 + seq),
    updatedAt: iso(-1),
  };
};

export const DEMO_TASKS: TeamTask[] = [
  // Refonte du site
  t('tproj-1', 'Maquettes de la page d\'accueil', 1, 4, 3, false),
  t('tproj-1', 'Intégration du header responsive', 2, 3, 5, false, 'in_progress'),
  t('tproj-1', 'Audit accessibilité WCAG', 3, 4, -1, false, 'blocked'),
  t('tproj-1', 'Optimisation des images', 4, 2, 8, false, 'review'),
  t('tproj-1', 'Rédaction des contenus SEO', 5, 3, 2, false, 'in_progress'),
  t('tproj-1', 'Charte graphique validée', 1, 3, -5, true),
  t('tproj-1', 'Setup analytics', 2, 2, 10, false),
  // Lancement produit
  t('tproj-2', 'Plan de communication', 0, 5, 0, false),
  t('tproj-2', 'Kit presse', 5, 3, 4, false, 'in_progress'),
  t('tproj-2', 'Préparer la démo investisseurs', 1, 5, -2, false),
  t('tproj-2', 'Landing page de teasing', 2, 4, 6, false, 'review'),
  t('tproj-2', 'Campagne réseaux sociaux', 3, 3, 7, false),
  t('tproj-2', 'Brief agence vidéo', 4, 2, -3, true),
  t('tproj-2', 'Liste des early adopters', 5, 3, 9, false),
  // Interne
  t('tproj-3', 'Onboarding nouveaux arrivants', 1, 3, 5, false, 'in_progress'),
  t('tproj-3', 'Mise à jour du wiki', 4, 1, 12, false),
  t('tproj-3', 'Rétrospective sprint', 0, 2, -2, false),
  t('tproj-3', 'Budget prévisionnel Q3', 3, 4, -1, false, 'blocked'),
  t('tproj-3', 'Commande matériel', 2, 2, 3, true),
  t('tproj-3', 'Planifier le séminaire', 5, 3, 14, false),
  // Ajouts 15 personnes (ttask-21..39), appendus EN FIN : les ids 1-20 restent stables.
  t('tproj-1', 'Animations de la page produit', 7, 3, 6, false, 'in_progress'),
  t('tproj-1', 'Tests de charge', 10, 3, 11, false),
  t('tproj-1', 'Recette multi-navigateurs', 9, 4, 4, false, 'review'),
  t('tproj-2', 'Vidéo de présentation', 8, 4, 8, false, 'in_progress'),
  t('tproj-2', 'Webinaire de lancement', 6, 4, 15, false),
  t('tproj-3', 'Process de notes de frais', 14, 2, 9, false),
  t('tproj-3', 'Entretiens annuels', 0, 3, 20, false),
  t('tproj-4', 'Audit SEO concurrentiel', 11, 4, 2, false, 'in_progress'),
  t('tproj-4', 'Campagne LinkedIn Ads', 12, 3, 7, false),
  t('tproj-4', 'Newsletter mensuelle', 13, 2, 5, false, 'review'),
  t('tproj-4', 'Programme de parrainage', 6, 4, 18, false),
  t('tproj-4', 'Partenariats influenceurs', 12, 3, -2, false, 'blocked'),
  t('tproj-4', 'Persona cibles', 11, 3, -8, true),
  t('tproj-4', 'Tableau de bord acquisition', 14, 3, 10, false),
  t('tproj-5', 'Choix de la stack mobile', 4, 5, -1, true),
  t('tproj-5', 'Maquettes de l’app', 7, 4, 12, false, 'in_progress'),
  t('tproj-5', 'Connexion mobile', 9, 4, 20, false),
  t('tproj-5', 'Notifications push', 10, 3, 28, false),
  t('tproj-5', 'Parcours d’accueil mobile', 8, 3, 25, false),
];

/**
 * Dépendances de démonstration (mig. 108). Aucune traduction : une arête ne
 * porte pas de texte.
 *
 * Contrainte respectée ici comme en base : une dépendance ne relie que des
 * tâches du MÊME projet. La chaîne du projet « Refonte du site » est
 * volontairement non triviale — deux branches partent de l'intégration du
 * header, et la plus longue n'est pas celle qui compte le plus de tâches,
 * sinon le chemin critique serait devinable sans le calculer.
 */
export const DEMO_TASK_DEPENDENCIES: TeamTaskDependency[] = [
  // Refonte du site : maquettes → intégration → { images → analytics, audit }
  { taskId: 'ttask-2', dependsOnId: 'ttask-1' },
  { taskId: 'ttask-4', dependsOnId: 'ttask-2' },
  { taskId: 'ttask-3', dependsOnId: 'ttask-2' },
  { taskId: 'ttask-7', dependsOnId: 'ttask-4' },
  // Lancement produit : le kit presse attend le plan de communication.
  { taskId: 'ttask-9', dependsOnId: 'ttask-8' },
  // Campagne d'acquisition : le tableau de bord attend l'audit SEO.
  { taskId: 'ttask-34', dependsOnId: 'ttask-28' },
  // Application mobile : maquettes → connexion.
  { taskId: 'ttask-37', dependsOnId: 'ttask-36' },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. Les ids `ttask-N` reprennent
// l'ordre de déclaration ci-dessus (compteur `seq` incrémenté par `t()`).
export const DEMO_TASKS_EN: Record<string, Partial<TeamTask>> = {
  'ttask-1': { name: 'Homepage mockups' },
  'ttask-2': { name: 'Responsive header integration' },
  'ttask-3': { name: 'WCAG accessibility audit' },
  'ttask-4': { name: 'Image optimization' },
  'ttask-5': { name: 'SEO content writing' },
  'ttask-6': { name: 'Brand guidelines approved' },
  'ttask-7': { name: 'Analytics setup' },
  'ttask-8': { name: 'Communication plan' },
  'ttask-9': { name: 'Press kit' },
  'ttask-10': { name: 'Prepare investor demo' },
  'ttask-11': { name: 'Teaser landing page' },
  'ttask-12': { name: 'Social media campaign' },
  'ttask-13': { name: 'Video agency brief' },
  'ttask-14': { name: 'Early adopters list' },
  'ttask-15': { name: 'New hire onboarding' },
  'ttask-16': { name: 'Wiki update' },
  'ttask-17': { name: 'Sprint retrospective' },
  'ttask-18': { name: 'Q3 budget forecast' },
  'ttask-19': { name: 'Equipment order' },
  'ttask-20': { name: 'Plan the offsite' },
  'ttask-21': { name: 'Product page animations' },
  'ttask-22': { name: 'Load testing' },
  'ttask-23': { name: 'Cross-browser QA' },
  'ttask-24': { name: 'Presentation video' },
  'ttask-25': { name: 'Launch webinar' },
  'ttask-26': { name: 'Expense report process' },
  'ttask-27': { name: 'Annual reviews' },
  'ttask-28': { name: 'Competitive SEO audit' },
  'ttask-29': { name: 'LinkedIn Ads campaign' },
  'ttask-30': { name: 'Monthly newsletter' },
  'ttask-31': { name: 'Referral program' },
  'ttask-32': { name: 'Influencer partnerships' },
  'ttask-33': { name: 'Target personas' },
  'ttask-34': { name: 'Acquisition dashboard' },
  'ttask-35': { name: 'Mobile stack choice' },
  'ttask-36': { name: 'App mockups' },
  'ttask-37': { name: 'Mobile sign-in' },
  'ttask-38': { name: 'Push notifications' },
  'ttask-39': { name: 'Mobile onboarding flow' },
};

// Commentaires seed (mig. 082) — fil de discussion réaliste sur 2 tâches.
export const DEMO_COMMENTS: TeamTaskComment[] = [
  { id: 'comment-seed-1', taskId: 'ttask-1', authorId: 'friend-1', body: 'Premier jet des maquettes déposé sur Figma, retours bienvenus !', mentions: [], createdAt: iso(-4) },
  { id: 'comment-seed-2', taskId: 'ttask-1', authorId: DEMO_USER_ID, body: '@Marie Dupont super base, je préfère la variante B pour le hero.', mentions: ['friend-1'], createdAt: iso(-3) },
  { id: 'comment-seed-3', taskId: 'ttask-8', authorId: 'friend-2', body: 'Le planning presse est calé, reste à valider le budget.', mentions: [], createdAt: iso(-2) },
  // Adossé à la notification « mention » seedée dans le module organizations :
  // une notification qui pointe vers un commentaire inexistant serait un leurre.
  { id: 'comment-seed-4', taskId: 'ttask-8', authorId: 'friend-1', body: 'Il me faut ton avis sur le calendrier avant vendredi, tu peux jeter un œil ?', mentions: [DEMO_USER_ID], createdAt: iso(-1) },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. Le nom mentionné (@Marie Dupont)
// n'est pas traduit, comme `sharedBy` dans le module tasks.
export const DEMO_COMMENTS_EN: Record<string, Partial<TeamTaskComment>> = {
  'comment-seed-1': { body: 'First draft of the mockups is up on Figma, feedback welcome!' },
  'comment-seed-2': { body: '@Marie Dupont great base, I prefer variant B for the hero.' },
  'comment-seed-3': { body: 'The press schedule is locked in, budget still needs approval.' },
  'comment-seed-4': { body: 'I need your input on the schedule before Friday, can you take a look?' },
};

/**
 * Sous-tâches de démo (mig. 092).
 *
 * Trois tâches couvrant les trois états que la barre de progression sait
 * rendre — aucune cochée, partiellement cochée, entièrement cochée. Une seule
 * tâche seedée ne montrerait qu'un tiers du composant.
 */
const st = (id: string, taskId: string, title: string, completed: boolean, position: number): TeamSubtask => ({
  id, taskId, title, completed, position, createdBy: DEMO_USER_ID, createdAt: iso(-6 + position),
});

export const DEMO_SUBTASKS: TeamSubtask[] = [
  // ttask-1 « Maquettes de la page d'accueil » — 2/4, progression partielle.
  st('sub-seed-1', 'ttask-1', 'Moodboard et références', true, 0),
  st('sub-seed-2', 'ttask-1', 'Wireframes basse fidélité', true, 1),
  st('sub-seed-3', 'ttask-1', 'Variante A du hero', false, 2),
  st('sub-seed-4', 'ttask-1', 'Variante B du hero', false, 3),
  // ttask-2 « Intégration du header responsive » — 1/3.
  st('sub-seed-5', 'ttask-2', 'Breakpoints mobile', true, 0),
  st('sub-seed-6', 'ttask-2', 'Menu burger accessible', false, 1),
  st('sub-seed-7', 'ttask-2', 'Tests sur Safari iOS', false, 2),
  // ttask-10 « Préparer la démo investisseurs » — 3/3, checklist terminée.
  st('sub-seed-8', 'ttask-10', 'Script de la démo', true, 0),
  st('sub-seed-9', 'ttask-10', 'Jeu de données de démonstration', true, 1),
  st('sub-seed-10', 'ttask-10', 'Répétition chronométrée', true, 2),
];

// Overlay anglais — cf. src/lib/seed-i18n.ts.
export const DEMO_SUBTASKS_EN: Record<string, Partial<TeamSubtask>> = {
  'sub-seed-1': { title: 'Moodboard and references' },
  'sub-seed-2': { title: 'Low-fidelity wireframes' },
  'sub-seed-3': { title: 'Hero variant A' },
  'sub-seed-4': { title: 'Hero variant B' },
  'sub-seed-5': { title: 'Mobile breakpoints' },
  'sub-seed-6': { title: 'Accessible burger menu' },
  'sub-seed-7': { title: 'Safari iOS testing' },
  'sub-seed-8': { title: 'Demo script' },
  'sub-seed-9': { title: 'Demo dataset' },
  'sub-seed-10': { title: 'Timed rehearsal' },
};

/**
 * Journal d'activité de démo (mig. 094).
 *
 * Les valeurs reprennent EXACTEMENT le format écrit par le trigger
 * `log_team_task_activity` : statut brut, priorité en texte, date en texte,
 * assignés joints par des virgules, et `name` sans valeurs. Reformater ici
 * ferait diverger la démo de la production sur le seul écran censé prouver
 * que le journal est fidèle.
 *
 * La fenêtre est volontairement récente : `getOrgActivity` alimente aussi la
 * revue hebdomadaire, qui ne regarde que les sept derniers jours.
 */
const act = (
  id: string,
  taskId: string,
  actorId: string | null,
  field: TeamActivityField,
  oldValue: string | null,
  newValue: string | null,
  dayOffset: number,
): TeamTaskActivity => ({
  id, taskId, orgId: DEMO_ORG_ID, actorId, field, oldValue, newValue, createdAt: iso(dayOffset),
});

export const DEMO_ACTIVITY: TeamTaskActivity[] = [
  act('act-seed-1', 'ttask-1', 'friend-1', 'status', 'todo', 'in_progress', -6),
  act('act-seed-2', 'ttask-1', DEMO_USER_ID, 'priority', '3', '4', -5),
  act('act-seed-3', 'ttask-2', 'friend-2', 'status', 'todo', 'in_progress', -5),
  act('act-seed-4', 'ttask-3', 'friend-3', 'status', 'in_progress', 'blocked', -4),
  // Échéance REPOUSSÉE (ancienne < nouvelle) : c'est le sens que
  // `isPostponement` reconnaît, et la seule forme qui alimente l'étape « ce qui
  // a dérapé » de la revue hebdomadaire. Les valeurs encadrent la deadline
  // réelle de la tâche — un journal qui finirait sur une autre date que celle
  // affichée serait incohérent.
  act('act-seed-5', 'ttask-4', 'user-lucas', 'deadline', dateStr(3), dateStr(8), -4),
  act('act-seed-6', 'ttask-4', DEMO_USER_ID, 'assignees', 'user-lucas', 'user-lucas,user-camille', -3),
  act('act-seed-7', 'ttask-10', DEMO_USER_ID, 'name', null, null, -2),
  act('act-seed-8', 'ttask-18', 'friend-3', 'status', 'todo', 'blocked', -2),
  act('act-seed-9', 'ttask-6', 'friend-1', 'status', 'review', 'done', -1),
  act('act-seed-10', 'ttask-28', 'user-paul', 'status', 'todo', 'in_progress', -3),
  act('act-seed-11', 'ttask-32', 'user-lea', 'status', 'in_progress', 'blocked', -2),
  act('act-seed-12', 'ttask-35', 'user-lucas', 'status', 'in_progress', 'done', -1),
  act('act-seed-13', 'ttask-21', 'user-chloe', 'status', 'todo', 'in_progress', -1),
];
