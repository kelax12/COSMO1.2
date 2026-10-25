// Promesses de la landing, part entreprise (manifeste : landing-promises.manifest.ts).
import type { LandingPromise } from './landing-promises.types';

const ENT = 'prerender:/entreprise-presentation';
const MORE = 'enterprise.more';

export const PROMISES_ENTREPRISE: LandingPromise[] = [
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

];
