// Promesses de la landing, part suite (manifeste : landing-promises.manifest.ts).
import type { LandingPromise } from './landing-promises.types';

const ENT = 'prerender:/entreprise-presentation';
const MORE = 'enterprise.more';

export const PROMISES_SUITE: LandingPromise[] = [
  // ─── Entreprise : « Quelques fonctionnalités en plus » ─────────────
  {
    id: 'entreprise-reunion-creneau-commun',
    kind: 'produit',
    claim: 'Une réunion d’équipe se pose sur les créneaux où tout le monde est libre.',
    anchors: [{ key: `${MORE}.f1d`, includes: 'les créneaux où tout le monde est libre' }],
    proofs: [{ file: 'src/components/organization/common-slots.helpers.ts', has: 'export function findCommonSlots' }],
  },
  {
    id: 'entreprise-alertes-resume',
    kind: 'produit',
    claim: 'Résumé quotidien par e-mail, alertes réglables par type.',
    anchors: [{ key: `${MORE}.f2d`, includes: 'Un e-mail par jour' }],
    proofs: [{ file: 'supabase/functions/org-digest/index.ts', re: 'Deno.serve' }],
  },
  {
    id: 'entreprise-recherche-ctrl-k',
    kind: 'produit',
    claim: 'Ctrl K cherche dans toute l’entreprise, dans le périmètre de chacun.',
    anchors: [{ key: `${MORE}.f3d`, includes: 'Ctrl K cherche' }],
    proofs: [{ file: 'src/components/CommandPalette.tsx', re: 'export' }],
  },
  {
    id: 'entreprise-automatisations',
    kind: 'produit',
    claim: 'Des automatisations préviennent quand une tâche est en retard ou change de statut.',
    anchors: [{ key: `${MORE}.f4d`, includes: 'Cosmo prévient la bonne personne' }],
    proofs: [
      { file: 'src/components/organization/config/AutomationsEditor.tsx', re: 'export' },
      { file: 'supabase/migration/096_automation_overdue_reminder.sql', re: 'overdue' },
    ],
  },
  {
    id: 'entreprise-actions-groupees',
    kind: 'produit',
    claim: 'Actions groupées sur les tâches.',
    anchors: [{ key: `${MORE}.f5d`, includes: 'Sélectionnez, assignez, terminez' }],
    proofs: [{ file: 'src/components/organization/BulkActionsBar.tsx', re: 'export' }],
  },
  {
    id: 'entreprise-slack-webhooks',
    kind: 'produit',
    claim: 'Les changements de tâches partent vers Slack.',
    anchors: [{ key: `${MORE}.f6d`, includes: 'arrive dans votre canal' }],
    proofs: [{ file: 'src/modules/org-config/types.ts', re: 'slack' }],
  },
  {
    id: 'entreprise-depart-suspension',
    kind: 'produit',
    claim: 'Un assistant de départ transmet tâches et objectifs avant le retrait.',
    anchors: [{ key: `${MORE}.f7d`, includes: 'un assistant transmet ses tâches' }],
    proofs: [{ file: 'supabase/migration/161_member_lifecycle.sql', has: 'suspended_at' }],
  },
  {
    id: 'entreprise-acces-limite',
    kind: 'produit',
    claim: 'Un rôle peut s’arrêter seul à une date.',
    anchors: [{ key: `${MORE}.f8d`, includes: "Son rôle s'arrête seul" }],
    proofs: [{ file: 'src/modules/organizations/roles.types.ts', has: 'endsAt: string | null;' }],
  },
  {
    id: 'entreprise-domaines-verifies',
    kind: 'produit',
    claim: 'Domaine vérifié, puis seules ses adresses peuvent rejoindre.',
    anchors: [{ key: `${MORE}.f9d`, includes: 'Vérifiez votre domaine' }],
    proofs: [{ file: 'supabase/functions/verify-org-domain/index.ts', re: 'Deno.serve' }],
  },
  {
    id: 'entreprise-discussion-projet',
    kind: 'produit',
    claim: 'Un fil de discussion par projet.',
    anchors: [{ key: `${MORE}.f10d`, includes: 'Un fil par projet' }],
    proofs: [{ file: 'supabase/migration/220_team_project_messages.sql', re: 'team_project_messages' }],
  },
  {
    id: 'entreprise-corbeille-trente-jours',
    kind: 'limite',
    claim: 'Une tâche ou un objectif supprimé reste trente jours dans la corbeille.',
    anchors: [
      { key: `${MORE}.f11d`, includes: '30 jours de corbeille' },
      { key: ENT, includes: 'corbeille de trente jours' },
    ],
    proofs: [
      { file: 'supabase/migration/152_team_tasks_soft_delete.sql', has: "INTERVAL '30 days'" },
      { file: 'supabase/migration/193_team_okrs_trash.sql', re: '30' },
    ],
    figures: { '30': [`${MORE}.f11d`, ENT] },
  },
  {
    id: 'entreprise-journal-audit',
    kind: 'limite',
    claim: 'Le journal d’audit est conservé un an.',
    anchors: [{ key: `${MORE}.f12d`, includes: 'tracé pendant un an' }],
    proofs: [{ file: 'supabase/migration/162_org_notifications_audit.sql', has: "INTERVAL '365 days'" }],
    figures: { '1an': [`${MORE}.f12d`, ENT] },
  },
  {
    id: 'entreprise-export-csv',
    kind: 'produit',
    claim: 'Export CSV complet.',
    anchors: [{ key: `${MORE}.f13d`, includes: 'Exportez tout en CSV' }],
    proofs: [{ file: 'src/components/organization/config/OrgIntegrationsCard.tsx', re: 'csv|Csv|CSV' }],
  },

  // ─── Récits, méthode et structure du texte ──────────────────────────
  {
    id: 'comparaison-concurrents',
    kind: 'editorial',
    claim: 'Comparaison avec Notion et Todoist ; références aux méthodes de Google, Intel, Netflix.',
    reason: 'Opinion éditoriale sur des tiers, sans engagement sur le produit.',
    anchors: [{ key: 'faq.a3', includes: "Todoist est un gestionnaire de tâches mais n'intègre pas les habitudes" }],
    proofs: [],
  },
  {
    id: 'structure-du-texte',
    kind: 'editorial',
    claim: 'Énumérations écrites dans la phrase (trois raisons, deux terrains, deux touches, dix tâches, deux ou trois habitudes…).',
    reason: 'Chiffres de rédaction : l’énumération qu’ils annoncent est lisible dans la phrase elle-même.',
    anchors: [
      { key: 'enterprise.problem.title', includes: 'Trois raisons' },
      { key: 'enterprise.gateway.eyebrow', includes: 'deux terrains' },
      { key: 'faq.a8', includes: '2 à 3 habitudes maximum' },
    ],
    proofs: [],
    figures: {
      '2': [
        `${MORE}.f3t`,
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
      '10': [`${MORE}.f5t`],
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
