// Promesses de la landing, part suite (manifeste : landing-promises.manifest.ts).
import type { LandingPromise } from './landing-promises.types';

const ENT = 'prerender:/entreprise-presentation';
const MORE = 'enterprise.more';

export const PROMISES_SUITE: LandingPromise[] = [
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
    id: 'entreprise-duplication-projet',
    kind: 'produit',
    // Modèles retirés de la création le 2026-10-30 (décision d'Axel) : la promesse aussi.
    claim: 'Duplication d’un projet avec ses tâches.',
    anchors: [{ key: `${MORE}.f6d`, includes: 'Dupliquez un projet existant avec ses tâches' }],
    proofs: [{ file: 'src/components/organization/use-team-projects-actions.ts', has: 'duplicateProject' }],
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
