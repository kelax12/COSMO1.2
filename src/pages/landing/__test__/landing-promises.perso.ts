// Promesses de la landing, part perso (manifeste : landing-promises.manifest.ts).
import type { LandingPromise } from './landing-promises.types';


export const PROMISES_PERSO: LandingPromise[] = [
  // ─── Parcours perso : gratuité, démo, partage ───────────────────────
  {
    id: 'perso-gratuit',
    kind: 'limite',
    claim: 'Le parcours perso est gratuit, sans carte bancaire ni essai limité.',
    anchors: [
      { key: 'faq.a1', includes: 'Oui pour un usage personnel' },
      { key: 'about.principle1Bold', includes: "Gratuit d'abord" },
      { key: 'usecase.students.description', includes: '100 % gratuit, sans carte bancaire' },
    ],
    proofs: [{ file: 'src/modules/billing/premium-config.ts', has: 'export const PREMIUM_ENFORCED = false;' }],
    figures: { '100': ['usecase.students.description'] },
  },
  {
    id: 'partage-gratuit',
    kind: 'produit',
    claim: 'Le partage de tâches est gratuit, en rôle Lecteur ou Éditeur.',
    anchors: [
      { key: 'faq.a1', includes: 'Le partage restera gratuit' },
      { key: 'faq.a7', includes: 'rôle Lecteur ou Éditeur' },
    ],
    proofs: [
      { file: 'src/modules/friends/types.ts', has: "role: 'viewer' | 'editor';" },
      { file: 'src/modules/friends/hooks.ts', lacks: 'isPremium' },
      { file: 'src/modules/tasks/hooks.ts', lacks: 'isPremium' },
    ],
  },
  {
    id: 'demo-sans-inscription',
    kind: 'produit',
    claim: 'La démo ouvre l’application complète sans compte ni e-mail.',
    anchors: [
      { key: 'hero.demoAria', includes: 'sans inscription' },
      { key: 'faq.a4', includes: 'Aucun compte, aucun email demandé' },
    ],
    proofs: [{ file: 'src/lib/app-mode.store.ts', has: 'loginDemo' }],
  },
  {
    id: 'demo-volume',
    kind: 'limite',
    claim: 'La démo est pré-remplie de 100 tâches, 100 habitudes, 150 événements et 8 OKR.',
    verdict: 'fausse',
    constat:
      'Le jeu de démo a été réduit à 10 tâches de base (commit 944015ba4) : il ouvre avec 12 tâches, 10 habitudes, 123 événements et 4 OKR (mesuré le 2026-10-24).',
    anchors: [
      { key: 'hero.reassurance', includes: 'Démo pré-remplie de 100 tâches' },
      { key: 'cta.statsAria', includes: '100 tâches, 100 habitudes, 150 événements' },
      { key: 'why.demoVolume', includes: '100 tâches · 100 habitudes · 150 events' },
      { key: 'faq.a4', includes: '100 tâches, 100 habitudes, 150 événements agenda et 8 OKRs' },
    ],
    proofs: [{ file: 'src/modules/tasks/local.repository.ts', has: '// 10 tâches' }],
    figures: {
      '100': ['hero.reassurance', 'cta.statsAria', 'why.demoVolume', 'faq.a4'],
      '150': ['cta.statsAria', 'why.demoVolume', 'faq.a4'],
      '8': ['faq.a4'],
    },
  },
  {
    id: 'demo-douze-mois',
    kind: 'indicatif',
    claim: 'La démo contient 12 mois de données réalistes.',
    reason:
      'Durée couverte par des dates relatives au jour d’ouverture, non mesurée : les tâches de base remontent à 28 jours.',
    anchors: [
      { key: 'why.desc5', includes: '12 mois de données réalistes' },
      { key: 'faq.a4', includes: '12 mois de données réalistes' },
      { key: 'about.principle2', includes: '12 mois de données réalistes' },
      { key: 'seo.root.description', includes: '12 mois de données pré-remplies' },
    ],
    proofs: [],
    figures: {
      '12': [
        'why.desc5',
        'faq.a4',
        'about.principle2',
        'seo.root.description',
        'usecase.freelancers.html',
        'prerender:/guide',
        'prerender:/a-propos',
      ],
    },
  },
  {
    id: 'compte-trente-secondes',
    kind: 'indicatif',
    claim: 'Le compte se crée en 30 secondes.',
    reason: 'Durée d’effort annoncée, non mesurable par le code.',
    anchors: [
      { key: 'faq.a4', includes: 'créez votre vrai compte en 30 secondes' },
      { key: 'prerender:/guide', includes: 'se crée en trente secondes' },
    ],
    proofs: [],
    figures: { '30': ['faq.a4', 'prerender:/guide'] },
  },
  {
    id: 'un-clic',
    kind: 'indicatif',
    claim: 'Démo prête en 1 clic ; réorganisation d’un rattachement en 1 clic.',
    reason: 'Nombre de gestes, non mesurable par le code.',
    anchors: [
      { key: 'hero.reassurance', includes: 'prêt en 1 clic' },
      { key: 'enterprise.pyramid.b4t', includes: 'Une réorganisation en 1 clic' },
    ],
    proofs: [],
    figures: { '1': ['hero.reassurance', 'enterprise.pyramid.b4t'] },
  },
  {
    id: 'google-oauth',
    kind: 'produit',
    claim: 'On peut s’inscrire et se connecter avec Google.',
    anchors: [
      { key: 'seo.signup.description', includes: 'Connexion possible via Google' },
      { key: 'prerender:/guide', includes: 'via Google' },
    ],
    proofs: [{ file: 'src/modules/auth/AuthContext.tsx', has: 'signInWithOAuth' }],
  },

  // ─── Perso : modules ────────────────────────────────────────────────
  {
    id: 'quatre-modules',
    kind: 'produit',
    claim: 'Quatre modules réunis : tâches, habitudes, agenda, OKR.',
    anchors: [
      { key: 'hero.modulesLabel', includes: 'Les quatre modules' },
      { key: 'about.p2bold', includes: 'quatre piliers' },
    ],
    proofs: [{ file: 'src/pages/landing/hero-modules.ts', re: "tasks[\\s\\S]*habits[\\s\\S]*agenda[\\s\\S]*okr" }],
    figures: { '4': ['hero.modulesLabel', 'faq.a3', 'about.p2bold'] },
  },
  {
    id: 'agenda-time-blocking',
    kind: 'produit',
    claim: 'Glisser une tâche dans l’agenda crée un événement lié à la tâche.',
    anchors: [
      { key: 'features.agenda.b1', includes: 'Glissez une tâche depuis la sidebar' },
      { key: 'faq.a6', includes: 'glissez simplement une tâche' },
    ],
    proofs: [
      { file: 'src/pages/agenda/AgendaCalendarSection.tsx', has: 'droppable' },
      { file: 'src/modules/events/repository.ts', has: 'getByTaskId' },
    ],
  },
  {
    id: 'agenda-vues',
    kind: 'produit',
    claim: 'L’agenda a des vues jour, semaine et mois.',
    anchors: [{ key: 'features.agenda.b4', includes: 'Vues jour / semaine / mois' }],
    proofs: [{ file: 'src/pages/agenda/AgendaDesktopHeader.tsx', has: "'timeGridDay', 'timeGridWeek', 'dayGridMonth'" }],
  },
  {
    id: 'tache-priorite-1-5',
    kind: 'limite',
    claim: 'Une tâche porte une priorité de 1 à 5.',
    anchors: [
      { key: 'prerender:/guide', includes: 'priorité de 1 à 5' },
      { key: 'usecase.freelancers.html', includes: 'priorité de 1 à 5' },
      { key: 'usecase.students.html', includes: 'priorisées de 1 à 5' },
    ],
    proofs: [{ file: 'src/modules/tasks/task.schema.ts', has: ".max(5, 'validation.task.priorityRange')" }],
    figures: {
      '1': ['prerender:/guide', 'usecase.freelancers.html', 'usecase.students.html'],
      '5': ['prerender:/guide', 'usecase.freelancers.html', 'usecase.students.html'],
    },
  },
  {
    id: 'tache-recurrence',
    kind: 'produit',
    claim: 'Une tâche récurrente se régénère quand on la coche.',
    anchors: [{ key: 'prerender:/guide', includes: 'Une tâche récurrente se régénère automatiquement' }],
    proofs: [{ file: 'src/modules/tasks/recurrence.ts', re: 'export function' }],
  },
  {
    id: 'habitudes-heatmap-26',
    kind: 'limite',
    claim: 'La heatmap des habitudes couvre 26 semaines.',
    anchors: [
      { key: 'features.habits.description', includes: 'heatmap 26 semaines' },
      { key: 'why.habitsLine2', includes: 'sur 26 semaines' },
      { key: 'faq.a8', includes: 'heatmap 26 semaines' },
      { key: 'prerender:/guide', includes: 'heatmap 26 semaines' },
    ],
    proofs: [{ file: 'src/pages/statistics/HabitHeatmap.tsx', re: '\\b26\\b' }],
    figures: {
      '26': [
        'features.habits.description',
        'why.habitsLine2',
        'faq.a8',
        'prerender:/guide',
        'usecase.students.html',
      ],
    },
  },
  {
    id: 'habitudes-streak',
    kind: 'produit',
    claim: 'Les habitudes ont une série de jours consécutifs (streak) et un taux de complétion.',
    anchors: [
      { key: 'features.habits.b2', includes: 'streak' },
      { key: 'faq.a8', includes: 'calcule votre streak' },
    ],
    proofs: [{ file: 'src/components/HabitCard.tsx', re: 'streak' }],
  },
  {
    id: 'habitudes-frequence',
    kind: 'produit',
    claim: 'On définit la fréquence d’une habitude (quotidienne, hebdomadaire, jours spécifiques).',
    verdict: 'fausse',
    constat:
      'Le formulaire d’habitude ne propose aucun choix de fréquence : il écrit toujours `frequency: \'daily\'`. Le type admet weekly et monthly, aucun écran ne les pose, et « jours spécifiques » n’existe nulle part.',
    anchors: [{ key: 'faq.a8', includes: 'définissez sa fréquence (quotidienne, hebdomadaire, jours spécifiques)' }],
    proofs: [{ file: 'src/components/HabitModal.tsx', has: "frequency: 'daily'" }],
  },
  {
    id: 'okr-progression-automatique',
    kind: 'produit',
    claim: 'La progression d’un objectif OKR se calcule automatiquement.',
    anchors: [{ key: 'features.okr.b2', includes: 'Votre progression est calculée automatiquement' }],
    proofs: [{ file: 'src/modules/okrs/progress.ts', re: 'export' }],
  },
  {
    id: 'okr-deux-a-cinq-kr',
    kind: 'editorial',
    claim: 'Un OKR = un objectif + 2 à 5 résultats clés.',
    reason:
      'Définition de la méthode, pas une limite du produit : il exige au moins un résultat clé et n’en plafonne aucun.',
    anchors: [
      { key: 'faq.a2', includes: '2 à 5 résultats clés mesurables' },
      { key: 'prerender:/guide', includes: '2 à 5 résultats clés' },
    ],
    proofs: [],
    figures: { '2': ['faq.a2', 'prerender:/guide'], '5': ['faq.a2', 'prerender:/guide'] },
  },
  {
    id: 'statistiques-vues',
    kind: 'produit',
    claim: 'Les statistiques se lisent au jour, à la semaine, au mois et à l’année.',
    anchors: [{ key: 'features.stats.b2', includes: 'Vues jour, semaine, mois, année' }],
    proofs: [{ file: 'src/pages/statistics/types.ts', has: "export type TimePeriod = 'day' | 'week' | 'month' | 'year';" }],
  },
  {
    id: 'mobile-natif-web',
    kind: 'produit',
    claim: 'Interface mobile avec barre de navigation basse, glissé sur les tâches, bottom-sheets et safe area iOS.',
    anchors: [{ key: 'faq.a5', includes: 'bottom navigation bar, gestes swipe sur les tâches, bottom-sheets fluides et support du safe area iOS' }],
    proofs: [
      { file: 'src/components/layout/MobileTabBar.tsx', re: 'export' },
      { file: 'src/components/task-table/SwipeHintBanner.tsx', re: 'export' },
      { file: 'src/components/mobile/BottomSheet.tsx', has: 'export default function BottomSheet' },
      { file: 'src/index.css', has: 'safe-area-inset' },
    ],
  },
  {
    id: 'sans-installation',
    kind: 'produit',
    claim: 'Cosmo est une application web, sans téléchargement.',
    anchors: [
      { key: 'faq.a5', includes: 'sans téléchargement requis' },
      { key: 'about.namesAfter', includes: 'sans téléchargement' },
    ],
    proofs: [{ file: 'index.html', has: 'id="root"' }],
  },
  {
    id: 'cache-24-heures',
    kind: 'limite',
    claim: 'Un cache localStorage de 24 heures garde les tâches et habitudes récentes.',
    anchors: [{ key: 'faq.a10', includes: 'un cache localStorage 24 heures' }],
    proofs: [{ file: 'src/modules/auth/session-cache.ts', has: 'CACHE_MAX_AGE = 24 * 60 * 60 * 1000' }],
    figures: { '24': ['faq.a10'] },
  },
  {
    id: 'demo-locale',
    kind: 'produit',
    claim: 'En mode démo, les données restent dans le navigateur.',
    anchors: [
      { key: 'faq.a10', includes: 'En mode démo, toutes les données sont stockées localement' },
      { key: 'faq.a9', includes: 'les données restent dans votre navigateur (localStorage)' },
    ],
    proofs: [{ file: 'src/lib/repository.factory.ts', has: 'localStorage' }],
  },

  // ─── Données, sécurité, vie privée ──────────────────────────────────
  {
    id: 'donnees-irlande-rls',
    kind: 'produit',
    claim: 'Données hébergées en Irlande (Supabase) avec Row Level Security.',
    anchors: [
      { key: 'faq.a9', includes: 'stockées en Irlande sur Supabase, avec Row Level Security' },
      { key: 'about.principle4', includes: 'Row Level Security' },
    ],
    proofs: [
      { file: 'docs/LEGAL.md', has: 'région `eu-west-1` (Irlande)' },
      { file: 'supabase/migration/001_tasks.sql', re: 'ENABLE ROW LEVEL SECURITY' },
    ],
  },
  {
    id: 'robots-bloque-app',
    kind: 'produit',
    claim: 'Les pages de l’application sont bloquées pour les robots dans robots.txt.',
    anchors: [{ key: 'faq.a9', includes: 'bloquées pour les robots de recherche dans robots.txt' }],
    proofs: [{ file: 'public/robots.txt', has: 'Disallow: /dashboard' }],
  },
  {
    id: 'sauvegardes-chiffrees',
    kind: 'produit',
    claim: 'Les sauvegardes sont chiffrées.',
    anchors: [{ key: 'faq.a9', includes: 'les sauvegardes sont chiffrées' }],
    proofs: [{ file: 'docs/RGPD.md', re: 'chiffr' }],
  },
  {
    id: 'suppression-compte-reelle',
    kind: 'produit',
    claim: 'La suppression d’un compte est réellement exécutée côté serveur.',
    anchors: [
      { key: 'enterprise.security.s3d', includes: "La suppression d'un compte est réelle" },
      { key: 'prerender:/a-propos', includes: 'Suppression de compte définitive et complète' },
    ],
    proofs: [{ file: 'supabase/functions/delete-account/index.ts', re: 'deleteUser' }],
  },
  {
    id: 'aucune-revente',
    kind: 'produit',
    claim: 'Aucune donnée n’est revendue.',
    anchors: [{ key: 'enterprise.security.s3d', includes: "Aucune donnée n'est revendue" }],
    proofs: [{ file: 'docs/RGPD-REGISTRE.md', re: 'Destinataires' }],
  },

];
