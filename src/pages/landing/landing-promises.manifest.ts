// ═══════════════════════════════════════════════════════════════════
// Manifeste des promesses de la landing (docs/UI-PATTERNS.md, AM-4).
//
// La landing promet : des fonctionnalités, des limites chiffrées (sièges,
// gratuit/payant, durées de rétention), des garanties (résiliable, isolation,
// export). Chaque promesse listée ici porte :
//
//   - `anchors`  : où elle est écrite (clé du catalogue ou du prérendu + un
//                  extrait EXACT en français). Si le texte change ou disparaît,
//                  la garde casse : la promesse doit alors être revue ici.
//   - `proofs`   : où elle est tenue dans le code (fichier + motif).
//   - `figures`  : les chiffres que ce texte est autorisé à porter, par clé.
//
// Un chiffre écrit sur la landing qui n'est dans aucun `figures` fait échouer
// `landing-promises.guard.test.ts`, de même qu'une preuve qui disparaît.
//
// `kind` :
//   produit      fonctionnalité ou garantie, prouvée dans le code ;
//   limite       plafond ou durée chiffrés, prouvés et, quand c'est possible,
//                mesurés par la garde ;
//   indicatif    durée ou effort annoncés, non mesurables (dit pourquoi) ;
//   editorial    chiffre de méthode, d'exemple ou de récit, pas une promesse
//                sur le produit ;
//   illustration donnée fictive d'une maquette (jamais une mesure).
//
// `verdict: 'fausse'` : la promesse ne tient plus. Le texte n'est PAS corrigé
// ici (la copie marketing est une décision d'Axel) : `constat` dit ce que le
// code fait réellement, et `proofs` y pointe. La garde vérifie que la
// promesse est TOUJOURS fausse ; dès qu'elle devient vraie ou que le texte
// change, elle casse et demande de rebasculer l'entrée.
//
// ⚠️ Les chiffres sont comparés écrits en chiffres OU en lettres (« cinq » vaut
// « 5 »), en français comme en anglais. Les années (20xx) et les numéros de
// section (« // 01 · ») sont ignorés.
// ⚠️ Hors périmètre : les articles de blog (`src/content/blog/`), éditoriaux.
// ═══════════════════════════════════════════════════════════════════

export interface PromiseProof {
  /** Chemin relatif à la racine du dépôt. */
  file: string;
  /** Sous-chaîne qui doit s'y trouver. */
  has?: string;
  /** Expression régulière (source, drapeau `m`) qui doit s'y trouver. */
  re?: string;
  /** Sous-chaîne qui ne doit PAS s'y trouver. */
  lacks?: string;
}

export interface PromiseAnchor {
  /** Clé du catalogue (`faq.a1`), `seo.<page>.<champ>`, `usecase.<id>.<champ>` ou `prerender:<chemin>`. */
  key: string;
  /** Extrait exact (français) qui porte la promesse. */
  includes: string;
}

export interface LandingPromise {
  id: string;
  kind: 'produit' | 'limite' | 'indicatif' | 'editorial' | 'illustration';
  claim: string;
  anchors: PromiseAnchor[];
  proofs: PromiseProof[];
  /** Chiffre normalisé (« 5 ») → clés où il est autorisé. `*` final = préfixe. */
  figures?: Record<string, string[]>;
  /** Pourquoi la promesse n'est pas prouvée par le code (indicatif, editorial, illustration). */
  reason?: string;
  verdict?: 'fausse';
  /** Pour `fausse` : ce que le produit fait réellement. */
  constat?: string;
}

const ENT = 'prerender:/entreprise-presentation';
const MORE = 'enterprise.more';

export const LANDING_PROMISES: LandingPromise[] = [
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

  // ─── Entreprise : limites chiffrées et facturation ──────────────────
  {
    id: 'entreprise-palier-gratuit',
    kind: 'limite',
    claim: 'Une organisation est gratuite jusqu’à 5 membres, sans carte bancaire.',
    anchors: [
      { key: 'faq.a1', includes: "ne commence qu'au-delà de cinq membres" },
      { key: 'faq.a7', includes: 'gratuit jusqu’à cinq membres'.replace('’', "'") },
      { key: 'enterprise.hero.reassurance', includes: "Jusqu'à 5 membres gratuitement · sans carte bancaire" },
      { key: 'enterprise.pricing.ctaNote', includes: 'Gratuit jusqu\'à 5 membres' },
      { key: 'enterprise.cta.note', includes: "Gratuit jusqu'à 5 membres · sans carte bancaire" },
      { key: 'enterprise.faq.a5', includes: "jusqu'à cinq membres, gratuitement et sans carte bancaire" },
      { key: 'seo.enterprisePresentation.description', includes: "Gratuit jusqu'à 5 membres" },
      { key: 'usecase.teams.description', includes: "Gratuit jusqu'à 5 personnes" },
      { key: 'usecase.teams.html', includes: "Gratuit jusqu'à cinq personnes" },
    ],
    proofs: [
      { file: 'src/modules/billing/premium-config.ts', has: "{ key: 'free', minMembers: 0, maxMembers: 5, priceEurPerMonth: 0 }" },
      { file: 'src/modules/billing/premium-config.ts', has: 'export const ORG_FREE_SEATS = 5;' },
      { file: 'supabase/functions/_shared/org-tiers.ts', has: 'FREE_TIER_MAX_MEMBERS' },
    ],
    figures: {
      '5': [
        'faq.a1',
        'faq.a7',
        'enterprise.hero.reassurance',
        'enterprise.pricing.ctaNote',
        'enterprise.cta.note',
        'enterprise.faq.a5',
        'seo.enterprisePresentation.description',
        'usecase.teams.description',
        'usecase.teams.html',
        ENT,
      ],
    },
  },
  {
    id: 'entreprise-grille-tarifaire',
    kind: 'limite',
    claim: '20 € / mois de 5 à 10 membres, 50 € de 10 à 20, 100 € de 20 à 50, 200 € au-delà.',
    anchors: [
      { key: 'enterprise.pricing.title', includes: '20 € par mois pour dix personnes' },
      {
        key: ENT,
        includes: '20 € par mois de 5 à 10 membres, 50 € de 10 à 20, 100 € de 20 à 50, et 200 € au-delà de 50',
      },
    ],
    proofs: [
      { file: 'src/modules/billing/premium-config.ts', has: "{ key: 't10', minMembers: 5, maxMembers: 10, priceEurPerMonth: 20 }" },
      { file: 'src/modules/billing/premium-config.ts', has: "{ key: 'tmax', minMembers: 50, maxMembers: null, priceEurPerMonth: 200 }" },
      { file: 'src/modules/billing/org-tiers.parity.test.ts', has: 'priceEurPerMonth' },
    ],
    figures: {
      '20': ['enterprise.pricing.title', ENT],
      '10': ['enterprise.pricing.title', ENT],
      '50': [ENT],
      '100': [ENT],
      '200': [ENT],
    },
  },
  {
    id: 'entreprise-remise-annuelle',
    kind: 'limite',
    claim: 'L’abonnement annuel coûte 30 % de moins que le mensuel.',
    anchors: [
      { key: 'enterprise.pricing.intervalSave', includes: '30 %' },
      { key: 'enterprise.pricing.intervalYearlyNote', includes: '30 % de moins que le mensuel' },
    ],
    proofs: [{ file: 'src/modules/billing/premium-config.ts', has: 'export const ENTERPRISE_YEARLY_DISCOUNT = 0.3;' }],
    figures: { '30': ['enterprise.pricing.intervalSave', 'enterprise.pricing.intervalYearlyNote'] },
  },
  {
    id: 'entreprise-ttc',
    kind: 'produit',
    claim: 'Tous les prix sont affichés TTC.',
    anchors: [{ key: 'enterprise.pricing.vatIncluded', includes: 'Tous les prix sont affichés TTC' }],
    proofs: [{ file: 'docs/STRIPE-LIVE.md', has: 'inclusive' }],
  },
  {
    id: 'entreprise-sans-engagement',
    kind: 'produit',
    claim: 'Sans engagement, résiliable à tout moment.',
    anchors: [
      { key: 'enterprise.pricing.i5', includes: 'Sans engagement, résiliable à tout moment' },
      { key: ENT, includes: 'résiliable à tout moment' },
      { key: 'enterprise.hero.reassurance', includes: 'réversible à tout moment' },
    ],
    proofs: [
      { file: 'supabase/functions/stripe-org-portal/index.ts', re: 'billingPortal' },
      { file: 'src/locales/fr/legalTerms.json', re: 'résili' },
    ],
  },
  {
    id: 'entreprise-palier-depasse',
    kind: 'produit',
    claim: 'Au-delà du palier, on ne peut plus inviter, mais aucun membre n’est jamais retiré.',
    anchors: [
      { key: 'enterprise.faq.a4', includes: "aucun membre n'est jamais retiré" },
      { key: 'enterprise.pricing.autoAdjust', includes: "personne n'est jamais retiré" },
    ],
    proofs: [{ file: 'supabase/migration/067_org_invite_links.sql', has: "RAISE EXCEPTION 'seat_limit_reached'" }],
  },
  {
    id: 'entreprise-offre-lancement',
    kind: 'produit',
    claim: 'L’offre de lancement (tout gratuit) se dérive du drapeau de facturation.',
    anchors: [{ key: 'enterprise.hero.reassuranceFree', includes: "Gratuit pendant l'offre de lancement" }],
    proofs: [{ file: 'src/pages/landing/entreprise/free-offer.ts', has: 'export const ENTERPRISE_FREE_OFFER = !ENTERPRISE_BILLING_ENFORCED;' }],
  },

  // ─── Entreprise : organigramme, périmètres, vie privée ──────────────
  {
    id: 'entreprise-organigramme',
    kind: 'produit',
    claim: 'Chaque membre a un seul responsable ; une personne peut être dans plusieurs équipes.',
    anchors: [
      { key: 'enterprise.pyramid.g2d', includes: 'Chaque membre a un seul responsable' },
      { key: 'enterprise.pyramid.g3d', includes: 'Une personne peut appartenir à plusieurs équipes' },
    ],
    proofs: [
      { file: 'supabase/migration/066_org_hierarchy.sql', re: 'manager_id' },
      { file: 'supabase/migration/068_org_teams.sql', re: 'org_team_members' },
    ],
  },
  {
    id: 'entreprise-invitation-quatre-voies',
    kind: 'produit',
    claim: 'Invitation par e-mail, par code, par lien ou parmi les contacts.',
    anchors: [{ key: 'enterprise.pyramid.g1d', includes: 'Par e-mail, par code, par lien ou parmi vos contacts Cosmo' }],
    proofs: [
      { file: 'supabase/functions/send-org-invite/index.ts', re: 'Deno.serve' },
      { file: 'supabase/migration/067_org_invite_links.sql', re: 'invite' },
      { file: 'src/components/organization/CreateOrJoinOrganization.tsx', re: 'code' },
    ],
  },
  {
    id: 'entreprise-cloisonnement-base',
    kind: 'produit',
    claim: 'Le cloisonnement entre équipes est appliqué en base de données, pas seulement à l’affichage.',
    anchors: [
      { key: 'enterprise.security.s1d', includes: 'vivent dans la base de données' },
      { key: 'enterprise.faq.a3', includes: 'appliquée en base de données' },
      { key: 'faq.a12', includes: 'appliqué au niveau de la base de données' },
    ],
    proofs: [
      { file: 'supabase/migration/066_org_hierarchy.sql', re: 'CREATE (OR REPLACE )?FUNCTION public\\.is_above' },
      { file: 'docs/SECURITY.md', re: 'RLS' },
    ],
  },
  {
    id: 'entreprise-vie-privee-perso',
    kind: 'produit',
    claim: 'La hiérarchie ne voit jamais les tâches, habitudes et agenda personnels.',
    anchors: [
      { key: 'enterprise.faq.a2', includes: 'ne sont jamais exposés à sa hiérarchie' },
      { key: 'faq.a11', includes: 'ni vos tâches et habitudes personnelles' },
    ],
    proofs: [
      { file: 'supabase/migration/081_event_privacy_owner_transfer.sql', re: 'private' },
      { file: 'CLAUDE.md', has: '**jamais** les modules perso réutilisés' },
    ],
  },
  {
    id: 'entreprise-agenda-des-reports',
    kind: 'produit',
    claim: 'Un responsable crée et modifie les événements de ses reports ; le personnel reste privé.',
    anchors: [{ key: 'enterprise.pyramid.b3d', includes: 'Un responsable crée, déplace et modifie les événements' }],
    proofs: [{ file: 'src/modules/events/repository.ts', has: 'createForUser' }],
  },
  {
    id: 'entreprise-droits-reglables',
    kind: 'limite',
    claim: 'Treize droits réglables membre par membre.',
    verdict: 'fausse',
    constat:
      'ORG_PERMISSION_KEYS compte 14 droits depuis la mig. 219 (`role.manage` s’est ajouté aux 13 précédents).',
    anchors: [{ key: `${MORE}.f1d`, includes: 'Treize droits réglables membre par membre' }],
    proofs: [{ file: 'src/modules/organizations/permissions.ts', has: "'role.manage'," }],
    figures: { '13': [`${MORE}.f1d`] },
  },
  {
    id: 'entreprise-transfert-depart',
    kind: 'produit',
    claim: 'Transfert de propriété, départ avec transmission du travail et suppression de l’organisation sans support.',
    anchors: [{ key: 'enterprise.security.s4d', includes: 'Transfert de propriété, départ d\'un membre avec transmission de son travail' }],
    proofs: [
      { file: 'src/modules/organizations/supabase.repository.ts', re: 'ransfer' },
      { file: 'src/components/organization/MemberLifecycleActions.tsx', re: 'export' },
    ],
  },
  {
    id: 'entreprise-un-cosmo-perso',
    kind: 'produit',
    claim: 'Chaque membre garde son Cosmo personnel, séparé de l’organisation.',
    anchors: [
      { key: 'enterprise.pricing.i4', includes: 'Un Cosmo personnel pour chaque membre' },
      { key: 'enterprise.faq.a1', includes: 'Son espace personnel reste séparé' },
    ],
    proofs: [{ file: 'CLAUDE.md', has: '**jamais** les modules perso réutilisés' }],
  },
  {
    id: 'entreprise-demo',
    kind: 'produit',
    claim: 'La démo entreprise s’ouvre sans inscription.',
    anchors: [{ key: 'enterprise.hero.ctaAria', includes: 'sans inscription' }],
    proofs: [{ file: 'src/modules/organizations/local.repository.ts', has: "export const DEMO_ORG_ID = 'org-demo-1';" }],
  },
  {
    id: 'entreprise-demo-effectif',
    kind: 'limite',
    claim: 'La démo entreprise est une organisation fictive de six personnes.',
    verdict: 'fausse',
    constat: 'L’organisation de démo compte 15 membres depuis le 2026-10-05 (commentaire de `local.repository.ts`).',
    anchors: [{ key: 'usecase.teams.html', includes: 'organisation fictive de six personnes' }],
    proofs: [{ file: 'src/modules/organizations/local.repository.ts', has: '15 membres au total' }],
    figures: { '6': ['usecase.teams.html'] },
  },

  // ─── Entreprise : exécution, objectifs, rapports ────────────────────
  {
    id: 'entreprise-cinq-etapes',
    kind: 'produit',
    claim: 'La mise en place tient en cinq étapes (équipe, exécution, projets, objectifs, suivi).',
    anchors: [
      { key: 'enterprise.hero.subtitle', includes: 'cinq étapes' },
      { key: ENT, includes: 'Étape 5 : suivez la progression de chacun' },
    ],
    proofs: [{ file: 'src/pages/landing/entreprise/EnterpriseTrack.tsx', re: 'ProgressSection' }],
    figures: {
      '5': ['enterprise.hero.subtitle', 'enterprise.more.subtitle'],
      '1': [ENT],
      '2': [ENT],
      '3': [ENT],
      '4': [ENT],
    },
  },
  {
    id: 'entreprise-cinq-statuts',
    kind: 'limite',
    claim: 'Une tâche d’équipe a cinq statuts : à faire, en cours, en relecture, bloquée, terminée.',
    anchors: [{ key: 'enterprise.execution.p2t', includes: 'Cinq statuts' }],
    proofs: [
      {
        file: 'src/modules/team-projects/types.ts',
        has: "export type TeamTaskStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';",
      },
    ],
    figures: { '5': ['enterprise.execution.p2t'], '2': ['enterprise.execution.p2t'] },
  },
  {
    id: 'entreprise-chemin-critique',
    kind: 'produit',
    claim: 'Le planning calcule le chemin critique.',
    anchors: [{ key: 'enterprise.execution.p3d', includes: 'chemin critique' }],
    proofs: [{ file: 'src/components/organization/critical-path.helpers.ts', re: 'export' }],
  },
  {
    id: 'entreprise-vues-projets',
    kind: 'produit',
    claim: 'Les projets se voient en liste, planning ou portefeuille ; les tâches en liste ou kanban.',
    anchors: [
      { key: 'enterprise.projects.p2d', includes: 'La liste pour le détail des tâches' },
      { key: 'enterprise.execution.p1d', includes: 'en liste ou en kanban' },
    ],
    proofs: [
      { file: 'src/modules/team-projects/portfolio.hooks.ts', re: 'export' },
      { file: 'src/components/organization/TeamProjectsKanban.tsx', re: 'export' },
    ],
  },
  {
    id: 'entreprise-sous-taches-mentions',
    kind: 'produit',
    claim: 'Sous-tâches, commentaires et mentions dans chaque tâche.',
    anchors: [
      { key: 'enterprise.projects.p1d', includes: 'sous-tâches' },
      { key: 'enterprise.projects.p3d', includes: 'mentionnez' },
    ],
    proofs: [
      { file: 'src/modules/team-projects/local.subtasks.ts', re: 'export' },
      { file: 'src/modules/team-projects/local.repository.ts', re: 'mentions' },
    ],
  },
  {
    id: 'entreprise-okr-cascade',
    kind: 'produit',
    claim: 'Un objectif d’organisation se décline en OKR d’équipe, visibles selon un périmètre choisi.',
    anchors: [
      { key: 'enterprise.okr.subtitle', includes: "Un objectif d'organisation se décline en OKR d'équipe" },
      { key: 'enterprise.okr.b3', includes: "visible par toute l'entreprise" },
    ],
    proofs: [{ file: 'src/modules/team-okrs/types.ts', re: 'cloisonnement de visibilité' }],
  },
  {
    id: 'entreprise-okr-exemple',
    kind: 'illustration',
    claim: 'Les résultats clés de l’exemple « Nova Studio » (8 identités, 12 prospects, 90 jalons…).',
    reason: 'Organisation fictive de la maquette : ces chiffres illustrent le format, ils ne mesurent rien.',
    anchors: [
      { key: 'enterprise.okr.team1Kr1', includes: '8 identités de marque' },
      { key: 'enterprise.okr.team3Kr1', includes: '90 jalons' },
    ],
    proofs: [],
    figures: {
      '8': ['enterprise.okr.team1Kr1'],
      '10': ['enterprise.okr.team1Kr2'],
      '9': ['enterprise.okr.team1Kr2'],
      '12': ['enterprise.okr.team2Kr1'],
      '5': ['enterprise.okr.team2Kr2'],
      '90': ['enterprise.okr.team3Kr1'],
      '40': ['enterprise.okr.team3Kr2'],
    },
  },
  {
    id: 'habitudes-retention-maquette',
    kind: 'illustration',
    claim: 'La pastille « Rétention 71% » de la maquette des habitudes.',
    reason: 'Valeur de décor d’une maquette d’interface, pas une statistique de produit.',
    anchors: [{ key: 'why.retention', includes: 'Rétention 71%' }],
    proofs: [],
    figures: { '71': ['why.retention'] },
  },
  {
    id: 'entreprise-rapports-quotidiens',
    kind: 'produit',
    claim: 'Chaque nuit, Cosmo fige l’activité de l’entreprise et de chaque équipe (rapports jour, semaine, mois).',
    anchors: [
      { key: 'enterprise.progress.p1d', includes: 'Chaque nuit, Cosmo fige' },
      { key: ENT, includes: 'Chaque nuit, Cosmo fige' },
    ],
    proofs: [{ file: 'supabase/migration/202_org_activity_reports.sql', re: 'cron\\.schedule' }],
  },

  // ─── Entreprise : « 20 fonctionnalités en plus » ────────────────────
  {
    id: 'entreprise-vingt-fonctionnalites',
    kind: 'limite',
    claim: 'Vingt fonctionnalités en plus, incluses dans tous les paliers.',
    anchors: [
      { key: `${MORE}.eyebrow`, includes: '20 fonctionnalités en plus' },
      { key: ENT, includes: 'Vingt fonctionnalités en plus' },
    ],
    proofs: [{ file: 'src/pages/landing/entreprise/MoreFeaturesSection.tsx', re: 'export' }],
    figures: { '20': [`${MORE}.eyebrow`, ENT] },
  },
  {
    id: 'entreprise-roles-projet',
    kind: 'produit',
    claim: 'Rôles par projet : responsable, contributeur, lecteur.',
    anchors: [{ key: `${MORE}.f2d`, includes: 'Responsable, contributeur ou lecteur' }],
    proofs: [{ file: 'supabase/migration/190_project_members_health.sql', re: 'project_members' }],
  },
  {
    id: 'entreprise-page-equipe',
    kind: 'produit',
    claim: 'Une page par équipe avec responsable, projets, résultats clés et charge.',
    anchors: [{ key: `${MORE}.f3d`, includes: 'Son responsable, sa couleur, ses projets' }],
    proofs: [{ file: 'src/components/organization/TeamPage.tsx', re: 'export' }],
  },
  {
    id: 'entreprise-evenements-equipe',
    kind: 'produit',
    claim: 'Un événement d’équipe se planifie en trois étapes et arrive dans l’agenda de chacun.',
    anchors: [{ key: `${MORE}.f4d`, includes: 'en trois étapes : qui, quand, détails' }],
    proofs: [{ file: 'src/components/organization/TeamEventDialog.tsx', re: 'export' }],
    figures: { '3': [`${MORE}.f4d`] },
  },
  {
    id: 'entreprise-assistant-demarrage',
    kind: 'produit',
    claim: 'Un assistant de démarrage guide la création de l’entreprise.',
    anchors: [{ key: `${MORE}.f5d`, includes: 'premières invitations, première équipe, premier projet' }],
    proofs: [{ file: 'src/components/onboarding/enterprise/OrgChoice.tsx', re: 'export' }],
  },
  {
    id: 'entreprise-modeles-projet',
    kind: 'produit',
    claim: 'Modèles de projet (onboarding client, lancement produit, sprint) et duplication.',
    anchors: [{ key: `${MORE}.f6d`, includes: 'onboarding client, lancement produit, sprint' }],
    proofs: [{ file: 'src/components/organization/NewTeamProjectModal.tsx', has: 'BUILT_IN_TEMPLATES' }],
  },
  {
    id: 'entreprise-projets-dependances',
    kind: 'produit',
    claim: 'Un projet peut dépendre d’un autre, le portefeuille affiche « bloqué par ».',
    anchors: [{ key: `${MORE}.f7d`, includes: 'Un projet peut dépendre d\'un autre' }],
    proofs: [{ file: 'src/modules/team-projects/local.portfolio.ts', re: 'ependenc' }],
  },
  {
    id: 'entreprise-actions-groupees',
    kind: 'produit',
    claim: 'Actions groupées sur les tâches et sur les membres.',
    anchors: [{ key: `${MORE}.f8d`, includes: 'Sélectionnez plusieurs tâches' }],
    proofs: [
      { file: 'src/components/organization/BulkActionsBar.tsx', re: 'export' },
      { file: 'src/components/organization/MemberBulkBar.tsx', re: 'export' },
    ],
  },
  {
    id: 'entreprise-listes-prereglages',
    kind: 'produit',
    claim: 'Préréglages de filtres, listes d’équipe partagées, filtre envoyé par lien.',
    anchors: [{ key: `${MORE}.f9d`, includes: 'un filtre s\'envoie par simple lien' }],
    proofs: [
      { file: 'src/components/organization/FilterPresets.tsx', re: 'export' },
      { file: 'src/components/organization/OrgDeepLinkHost.tsx', re: 'export' },
    ],
  },
  {
    id: 'entreprise-recherche-ctrl-k',
    kind: 'produit',
    claim: 'Ctrl K cherche dans toute l’entreprise.',
    anchors: [{ key: `${MORE}.f10d`, includes: 'Ctrl K cherche dans toute l\'entreprise' }],
    proofs: [{ file: 'src/components/CommandPalette.tsx', re: 'export' }],
  },
  {
    id: 'entreprise-automatisations',
    kind: 'produit',
    claim: 'Des automatisations réagissent à la création ou au changement de statut d’une tâche.',
    anchors: [{ key: `${MORE}.f11d`, includes: 'Quand une tâche est créée ou change de statut' }],
    proofs: [{ file: 'src/components/organization/config/AutomationsEditor.tsx', re: 'export' }],
  },
  {
    id: 'entreprise-slack-webhooks',
    kind: 'produit',
    claim: 'Les événements partent vers Slack ou vers un webhook en JSON signé.',
    anchors: [{ key: `${MORE}.f12d`, includes: 'vers Slack, ou vers votre propre service en JSON signé' }],
    proofs: [
      { file: 'supabase/functions/org-webhook-dispatch/index.ts', re: 'hmac|HMAC' },
      { file: 'src/modules/org-config/types.ts', re: 'slack' },
    ],
  },
  {
    id: 'entreprise-export-csv',
    kind: 'produit',
    claim: 'Export CSV complet des projets, tâches, objectifs, équipes et membres.',
    anchors: [{ key: `${MORE}.f13d`, includes: 'exportés en CSV' }],
    proofs: [{ file: 'src/components/organization/config/OrgIntegrationsCard.tsx', re: 'csv|Csv|CSV' }],
  },
  {
    id: 'entreprise-alertes-resume',
    kind: 'produit',
    claim: 'Alertes réglables par type et résumé quotidien.',
    anchors: [{ key: `${MORE}.f14d`, includes: 'avec un résumé quotidien' }],
    proofs: [{ file: 'supabase/functions/org-digest/index.ts', re: 'Deno.serve' }],
  },
  {
    id: 'entreprise-kr-dans-perso',
    kind: 'produit',
    claim: 'Un résultat clé d’entreprise porté apparaît aussi dans les OKR personnels.',
    anchors: [{ key: `${MORE}.f15d`, includes: 'apparaît aussi dans vos OKR personnels' }],
    proofs: [{ file: 'src/modules/team-okrs/supabase.repository.ts', re: 'owner|assignee' }],
  },
  {
    id: 'entreprise-journal-audit',
    kind: 'limite',
    claim: 'Le journal d’audit est conservé un an, consultable et exportable par les admins.',
    anchors: [{ key: `${MORE}.f16d`, includes: 'conservé un an' }],
    proofs: [{ file: 'supabase/migration/162_org_notifications_audit.sql', has: "INTERVAL '365 days'" }],
    figures: { '1an': [`${MORE}.f16d`, ENT] },
  },
  {
    id: 'entreprise-domaines-verifies',
    kind: 'produit',
    claim: 'Vérification du domaine par DNS, puis invitations limitées à ce domaine.',
    anchors: [{ key: `${MORE}.f17d`, includes: 'Vérifiez le domaine de votre entreprise par DNS' }],
    proofs: [{ file: 'supabase/functions/verify-org-domain/index.ts', re: 'Deno.serve' }],
  },
  {
    id: 'entreprise-acces-limite',
    kind: 'produit',
    claim: 'Un accès à durée limitée s’arrête tout seul (exemple : trente jours).',
    anchors: [{ key: `${MORE}.f18d`, includes: 'Invitez un prestataire pour trente jours' }],
    proofs: [{ file: 'supabase/migration/161_member_lifecycle.sql', has: 'access_expires_at' }],
    figures: { '30': [`${MORE}.f18d`] },
  },
  {
    id: 'entreprise-depart-suspension',
    kind: 'produit',
    claim: 'Un assistant de départ transmet le travail ; la suspension coupe seulement l’accès.',
    anchors: [{ key: `${MORE}.f19d`, includes: 'un assistant transmet ses tâches' }],
    proofs: [{ file: 'supabase/migration/161_member_lifecycle.sql', has: 'suspended_at' }],
  },
  {
    id: 'entreprise-corbeille-trente-jours',
    kind: 'limite',
    claim: 'Une tâche ou un objectif supprimé reste trente jours dans la corbeille.',
    anchors: [
      { key: `${MORE}.f20t`, includes: 'Corbeille de 30 jours' },
      { key: `${MORE}.f20d`, includes: 'reste trente jours dans la corbeille' },
      { key: ENT, includes: 'corbeille de trente jours' },
    ],
    proofs: [
      { file: 'supabase/migration/152_team_tasks_soft_delete.sql', has: "INTERVAL '30 days'" },
      { file: 'supabase/migration/193_team_okrs_trash.sql', re: '30' },
    ],
    figures: { '30': [`${MORE}.f20t`, `${MORE}.f20d`, ENT] },
  },

  // ─── Récits, méthode et structure du texte ──────────────────────────
  {
    id: 'comparaison-concurrents',
    kind: 'editorial',
    claim: 'Comparaison avec Notion et Todoist ; références aux méthodes de Google, Intel, Netflix.',
    reason: 'Opinion éditoriale sur des tiers, sans engagement sur le produit.',
    anchors: [{ key: 'faq.a3', includes: "Todoist est un excellent gestionnaire de tâches mais n'intègre pas les habitudes" }],
    proofs: [],
  },
  {
    id: 'structure-du-texte',
    kind: 'editorial',
    claim: 'Énumérations écrites dans la phrase (trois raisons, deux terrains, deux minutes, deux ou trois habitudes…).',
    reason: 'Chiffres de rédaction : l’énumération qu’ils annoncent est lisible dans la phrase elle-même.',
    anchors: [
      { key: 'enterprise.problem.title', includes: 'Trois raisons' },
      { key: 'enterprise.gateway.eyebrow', includes: 'deux terrains' },
      { key: 'faq.a8', includes: '2 à 3 habitudes maximum' },
    ],
    proofs: [],
    figures: {
      '2': [
        'enterprise.gateway.eyebrow',
        'enterprise.faq.q3',
        'enterprise.faq.a3',
        'about.ctaTitle',
        'useCasePage.ctaTitle',
        'faq.a8',
        'prerender:/guide',
        'prerender:/a-propos',
      ],
      '3': [
        'enterprise.hero.stackLabel',
        'enterprise.problem.title',
        'about.namesP',
        'faq.a8',
        'prerender:/guide',
        'prerender:/a-propos',
      ],
      '4': ['prerender:/a-propos'],
    },
  },
  {
    id: 'prose-cas-usage',
    kind: 'editorial',
    claim: 'Chiffres de récit des pages cas d’usage et du guide (semestre de quatre mois, quinze minutes, trois prises de contact…).',
    reason: 'Exemples narratifs : aucun n’engage le produit. Les chiffres de démo (100, 150, 8) restent interdits dans ces pages.',
    anchors: [{ key: 'usecase.freelancers.html', includes: 'quinze minutes suffisent' }],
    proofs: [],
    figures: {
      ...Object.fromEntries(
        ['1', '2', '3', '4', '5', '6', '10', '11', '14', '15', '20', '30'].map((t) => [t, ['usecase.*']]),
      ),
      '6': ['usecase.*', 'prerender:/guide'],
      '15': ['usecase.*', 'prerender:/guide'],
      '1': ['usecase.*', 'prerender:/guide'],
      '3': ['usecase.*', 'prerender:/guide'],
    },
  },
];
