// Données statiques de la LandingPage — extraites pour alléger le composant.
// Contenu déplacé verbatim depuis LandingPage.tsx.

export interface UseCase {
  profile: string;
  accent: string;
  title: string;
  description: string;
  features: string[];
  path: string;
}

export const USE_CASES: UseCase[] = [
  {
    profile: 'Étudiants',
    accent: '#A78BFA',
    title: 'Excellence académique',
    description: "Gérez vos cours, devoirs et révisions avec une planification optimisée qui s'adapte à votre rythme d'apprentissage.",
    features: ['Planning de révisions optimisé', 'Suivi des notes et objectifs', 'Vision globale + réduction du stress'],
    path: '/tasks'
  },
  {
    profile: 'Professionnels',
    accent: '#60A5FA',
    title: 'Performance maximale',
    description: "Boostez votre carrière avec des outils de productivité qui transforment votre façon de travailler et d'atteindre vos objectifs.",
    features: ['Gestion de projets avancée', 'OKR et développement personnel', 'Système de priorisation efficace'],
    path: '/dashboard'
  },
  {
    profile: 'Équipes',
    accent: '#34D399',
    title: 'Collaboration fluide',
    description: "Synchronisez votre équipe avec des outils collaboratifs qui alignent tous les membres sur les mêmes objectifs stratégiques.",
    features: ['Partage de tâches simplifié', 'Suivi partagé des objectifs', 'Tableaux de bord équipe'],
    path: '/okr'
  },
  {
    profile: 'Entrepreneurs',
    accent: '#FB923C',
    title: 'Croissance accélérée',
    description: "Pilotez votre startup avec des métriques précises et des automatisations qui vous font gagner un temps précieux.",
    features: ['Organisation multi-projets avancée', 'Délégation et suivi des tâches', 'Planification stratégique intégrée'],
    path: '/okr'
  }
];

export const ENTRY_OFFSETS = [
  { x: -400, y: -300, rotate: -15 },
  { x:  400, y: -300, rotate:  15 },
  { x: -400, y:  300, rotate: -15 },
  { x:  400, y:  300, rotate:  15 },
];

export interface FaqItemData {
  question: string;
  answer: string;
}

// ── FAQ data ──────────────────────────────────────────────────────────────
export const FAQ_ITEMS: FaqItemData[] = [
  {
    question: 'Cosmo est-il vraiment gratuit ?',
    answer: 'Oui. Toutes les fonctionnalités principales — tâches, habitudes, agenda, OKR et statistiques — sont entièrement gratuites. L\'accès Premium (collaboration en équipe, partage de tâches) s\'obtient en regardant une courte publicité, sans jamais sortir votre carte bancaire.',
  },
  {
    question: 'Qu\'est-ce que la méthode OKR et pourquoi l\'utiliser ?',
    answer: 'La méthode OKR (Objectives & Key Results) est le système de définition d\'objectifs utilisé par Google, Intel et Netflix. Un OKR = un objectif qualitatif ambitieux + 2 à 5 résultats clés mesurables. Cosmo automatise le calcul de progression et visualise votre avancement en temps réel, sans tableur.',
  },
  {
    question: 'Quelle est la différence avec Notion ou Todoist ?',
    answer: 'Notion est un espace de notes très flexible mais sans structure de productivité native. Todoist est un excellent gestionnaire de tâches mais n\'intègre pas les habitudes, les OKR ni le time-blocking. Cosmo est la seule application qui connecte les quatre pilliers — tâches, habitudes, agenda et objectifs — dans un seul écosystème cohérent.',
  },
  {
    question: 'Comment fonctionne le mode démo ?',
    answer: 'Cliquez sur "Essayer la démo" : vous accédez immédiatement à l\'application complète, pré-remplie avec 100 tâches, 100 habitudes, 150 événements agenda et 8 OKRs sur 12 mois de données réalistes. Aucun compte, aucun email demandé. Quand vous êtes convaincu(e), créez votre vrai compte en 30 secondes.',
  },
  {
    question: 'Cosmo fonctionne-t-il sur mobile ?',
    answer: 'Oui. Cosmo est conçu mobile-first : interface responsive, bottom navigation bar, gestes swipe sur les tâches, bottom-sheets fluides et support du safe area iOS. L\'application fonctionne dans n\'importe quel navigateur mobile — Safari iOS, Chrome Android — sans téléchargement requis.',
  },
  {
    question: 'Qu\'est-ce que le time-blocking ?',
    answer: 'Le time-blocking consiste à réserver des créneaux horaires dans votre agenda pour travailler sur des tâches précises, plutôt que de réagir au fil de l\'eau. Dans Cosmo, glissez simplement une tâche depuis le panneau latéral vers un créneau de votre calendrier : l\'événement est créé automatiquement et lié à la tâche. C\'est la méthode plébiscitée par Elon Musk, Bill Gates et Cal Newport.',
  },
  {
    question: 'Puis-je collaborer avec mon équipe ?',
    answer: 'Oui. Avec l\'accès Premium (gratuit via publicité), envoyez des demandes d\'amis par email, partagez des tâches avec un rôle Lecteur ou Éditeur, et suivez la progression de vos collaborateurs depuis votre dashboard. La messagerie contextuelle permet de discuter directement dans le contexte d\'une tâche.',
  },
  {
    question: 'Comment suivre mes habitudes efficacement ?',
    answer: 'Créez une habitude, définissez sa fréquence (quotidienne, hebdomadaire, jours spécifiques), puis cochez chaque jour. Cosmo affiche une heatmap 26 semaines style GitHub, calcule votre streak (série de jours consécutifs) et votre taux de complétion sur la période choisie. La règle d\'or : commencez par 2 à 3 habitudes maximum.',
  },
  {
    question: 'Mes données sont-elles sécurisées ?',
    answer: 'Vos données sont stockées sur Supabase avec Row Level Security : personne d\'autre ne peut accéder à vos tâches ou habitudes. Les pages de l\'application (dashboard, tâches, etc.) sont bloquées pour les robots de recherche dans robots.txt. En mode démo, les données restent dans votre navigateur (localStorage) et ne transitent pas par nos serveurs.',
  },
  {
    question: 'Peut-on utiliser Cosmo sans connexion internet ?',
    answer: 'En mode démo, toutes les données sont stockées localement dans votre navigateur — aucune connexion requise après le chargement initial. En mode compte, un cache localStorage 24 heures permet de consulter vos tâches et habitudes récentes même avec une connexion instable.',
  },
];
