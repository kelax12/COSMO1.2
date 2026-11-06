// ═══════════════════════════════════════════════════════════════════
// Déclarations de la matrice RLS : UNE entrée par table exposée de `public`.
//
// La liste des tables testées vient du catalogue (`catalogue.ts`), pas d'ici.
// Ce fichier dit seulement, pour chacune, ce qui est VOULU. Le test échoue :
//   · si une table exposée n'a pas d'entrée (une table nouvelle doit être
//     classée par celui qui la crée, pas découverte en production) ;
//   · si une entrée n'a plus de table (déclaration morte) ;
//   · si une permission accordée ici n'est PAS observée (déclaration périmée :
//     le périmètre déclaré doit être exact, ni plus large ni plus étroit).
//
// LES TROIS CLASSES
//   proprietaire  seul le propriétaire lit sa ligne ;
//   partagee      la ligne est visible au-delà du propriétaire (amis, membres
//                 d'organisation, destinataires d'un partage). `perimetre` dit
//                 exactement à qui. Un tiers SANS lien ne voit toujours rien :
//                 c'est ce que la matrice vérifie, la portée elle-même étant
//                 couverte par le fichier de test nommé dans `perimetre` ;
//   serveur       aucune lecture client, propriétaire compris : la table n'est
//                 écrite et lue que par des fonctions `SECURITY DEFINER`, une
//                 Edge Function ou `service_role`.
//
// `tiers` et `anon` listent les opérations qu'un tiers authentifié sans lien
// ou un anonyme a le droit de RÉUSSIR, chacune avec sa raison. Vides par
// défaut. ❌ Ne jamais y ajouter une opération pour faire passer la CI : une
// cellule rouge est une fuite tant qu'on n'a pas lu la policy qui l'ouvre.
// ═══════════════════════════════════════════════════════════════════
import type { Op } from './catalogue';
import type { OptionsGraine, ValeurForcee } from './matrice.graine';

export type Visibilite = 'proprietaire' | 'partagee' | 'serveur';

export interface Declaration {
  visibilite: Visibilite;
  /** Pourquoi la ligne n'est pas strictement privée (obligatoire hors `proprietaire`). */
  motif?: string;
  /** À qui exactement elle est visible (obligatoire pour `partagee`). */
  perimetre?: string;
  /** Opérations qu'un tiers authentifié sans lien a le droit de réussir, avec leur raison. */
  tiers?: Partial<Record<Op, string>>;
  /** Opérations qu'un anonyme a le droit de réussir, avec leur raison. */
  anon?: Partial<Record<Op, string>>;
  /** Ce que le catalogue ne suffit pas à deviner pour semer la ligne. */
  graine?: OptionsGraine;
}

const proprietaire = (graine?: OptionsGraine): Declaration => ({ visibilite: 'proprietaire', graine });
const serveur = (motif: string, graine?: OptionsGraine): Declaration => ({ visibilite: 'serveur', motif, graine });
const partagee = (motif: string, perimetre: string, graine?: OptionsGraine): Declaration => ({
  visibilite: 'partagee',
  motif,
  perimetre,
  graine,
});

/** Périmètre commun du mode entreprise. */
const ORG = 'membres de la même organisation (is_org_member et dérivés) ; aucun accès hors organisation';
const ORG_ADMIN = "administrateurs de l'organisation (is_org_admin) ; aucun accès hors organisation";
const ORG_TESTS = 'portée couverte par e2e/rls/org-surface-entreprise.test.ts et org-permissions.test.ts';

/**
 * Table de dépendances `a -> b` : la graine de `a` et celle de `b` seraient la
 * même ligne, et le trigger `dependency_cycle` refuse `a -> a`. `b` est donc une
 * AUTRE ligne de la table liée, de même parent (même organisation, même projet).
 */
function lienVersUneAutreLigne(table: string): OptionsGraine {
  return { valeurs: { depends_on_id: async (ctx) => String((await ctx.autre(table)).id) } };
}

/**
 * Le propriétaire est ADMIN de l'organisation semée (voir `organization_members`),
 * et les triggers de `org_member_permissions` et `org_member_roles` refusent de
 * donner un droit à un admin (« an admin always holds every permission »). Ces
 * lignes visent donc le figurant, d'abord inscrit comme simple membre (clé
 * étrangère composite vers organization_members).
 */
const figurantInscrit = new Map<string, Promise<unknown>>();
const membreSimple: ValeurForcee = async (ctx) => {
  // Une seule inscription par figurant : (org_id, user_id) est unique.
  if (!figurantInscrit.has(ctx.figurant)) {
    figurantInscrit.set(ctx.figurant, ctx.autre('organization_members', { user_id: ctx.figurant, role: 'member' }));
  }
  await figurantInscrit.get(ctx.figurant);
  return ctx.figurant;
};

export const DECLARATIONS: Record<string, Declaration> = {
  // ── Perso ──────────────────────────────────────────────────────────
  account_inactivity_notices: serveur("preuve des avis d'inactivité (RGPD), écrite par la purge planifiée"),
  billing_acceptances: proprietaire(),
  categories: partagee(
    'une catégorie suit les tâches partagées qui la portent',
    'propriétaire, et destinataires des tâches partagées qui la portent',
  ),
  events: partagee('agenda : un événement peut être lié à une équipe', 'propriétaire ; membres de son équipe pour un événement d’équipe'),
  habits: proprietaire(),
  key_results: proprietaire(),
  kr_completions: proprietaire(),
  lists: partagee('listes partagées entre amis', 'propriétaire et destinataires de shared_lists'),
  okrs: proprietaire(),
  profiles: partagee(
    'nom et avatar visibles des amis et des collègues',
    "propriétaire, amis acceptés, membres d'une même organisation",
  ),
  friends: partagee('relation d’amitié vue des deux côtés', 'les deux comptes de la relation'),
  friend_requests: partagee('demande vue de l’émetteur et du destinataire', 'émetteur et destinataire'),
  shared_tasks: partagee('partage de tâche', 'auteur du partage et destinataire (friend_id)'),
  shared_lists: partagee('partage de liste', 'auteur du partage et destinataire'),
  share_links: partagee('lien de partage par jeton', 'propriétaire ; le jeton se réclame par RPC, jamais par lecture directe'),
  task_dependencies: proprietaire(lienVersUneAutreLigne('tasks')),
  tasks: partagee('tâches partagées entre amis', 'propriétaire et destinataires de shared_tasks (e2e/rls/shared-tasks.test.ts)'),
  subscriptions: proprietaire(),
  renewal_notices: serveur('preuve L215-1, écrite par le serveur'),
  support_reports: serveur('RLS activée sans policy (mig. 150) : écrite et lue par des fonctions SECURITY DEFINER'),
  user_activity_days: serveur("compteur d'activité pour le tableau admin"),
  withdrawal_consents: proprietaire({
    // CHECK withdrawal_consents_complete_ck : seuls des consentements COMPLETS existent.
    valeurs: { immediate_execution: 'true', waives_withdrawal: 'true' },
    // org_id est NULLABLE depuis la mig. 138 (la preuve survit à l'organisation) : sans
    // lui la ligne n'appartient à aucune organisation et son propriétaire ne la lit pas.
    remplir: ['org_id'],
  }),
  billing_flags: {
    visibilite: 'partagee',
    motif: 'drapeaux dormants lus par le client pour afficher les bannières de facturation (mig. 067)',
    perimetre: 'tout compte authentifié, en lecture seule ; aucune écriture client ; anon exclu',
    tiers: { select: 'policy billing_flags_select TO authenticated USING (true), voulue : le client affiche les bannières' },
  },
  payment_records: proprietaire(),
  payment_closures: serveur('clôtures du journal fiscal'),

  // ── Affiliation ────────────────────────────────────────────────────
  affiliates: proprietaire(),
  affiliate_clicks: serveur('clics collectés par le serveur'),
  affiliate_commissions: proprietaire(),
  affiliate_contacts: proprietaire(),
  affiliate_links: proprietaire(),
  affiliate_payouts: proprietaire(),
  affiliate_settings: serveur("réglages globaux de l'affiliation"),

  // ── Serveur, admin, mesure ─────────────────────────────────────────
  admin_users: serveur('allowlist admin, lue par is_admin()'),
  demo_devices: serveur('visites démo, écrites par record_demo_visit()'),
  email_lookup_global: serveur('quota global de recherche par email'),
  email_lookup_quota: serveur('quota de recherche par email, par compte'),
  processed_stripe_events: serveur('idempotence du webhook Stripe'),
  rate_limits: serveur('limitation de débit'),
  traffic_hits: serveur('audience maison, écrite par api/collect.ts'),
  traffic_salts: serveur("sels quotidiens de l'audience"),

  // ── Entreprise ─────────────────────────────────────────────────────
  organizations: partagee("l'organisation est vue de ses membres", `${ORG} ; ${ORG_TESTS}`),
  organization_members: partagee('annuaire des membres', `${ORG} ; ${ORG_TESTS}`, {
    // `role` a un DEFAULT 'member', que la graine laisse tel quel : le propriétaire
    // ne serait alors jamais admin de l'organisation semée, et les cinq tables
    // gardées par is_org_admin() lui paraîtraient fermées. L'admin est le rôle
    // du créateur d'une organisation.
    valeurs: { role: 'admin' },
  }),
  organization_join_requests: partagee("demande d'adhésion", `demandeur et ${ORG_ADMIN}`),
  org_activity_reports: partagee('rapports d’activité', `${ORG} ; ${ORG_TESTS}`),
  org_audit_log: partagee("journal d'audit", `${ORG_ADMIN}`),
  org_billing_contacts: partagee('contacts de facturation', `${ORG_ADMIN}`),
  org_invitations: partagee('invitations', `${ORG_ADMIN} ; e2e/rls/org-invitations.test.ts`, {
    // CHECK org_invitations_not_self : on ne s'invite pas soi-même.
    valeurs: { invitee_id: (ctx) => ctx.figurant },
  }),
  org_invite_links: partagee("liens d'invitation", `${ORG_ADMIN}`),
  org_member_permissions: partagee('permissions par membre', `${ORG} ; ${ORG_TESTS}`, { valeurs: { user_id: membreSimple } }),
  org_member_roles: partagee('rôles des membres', `${ORG} ; ${ORG_TESTS}`, { valeurs: { user_id: membreSimple } }),
  org_notification_settings: partagee('réglages de notification', `${ORG}`),
  org_notifications: partagee('boîte de réception', 'destinataire de la notification'),
  org_roles: partagee('rôles personnalisés', `${ORG} ; ${ORG_TESTS}`),
  org_saved_views: partagee('vues enregistrées', 'auteur de la vue'),
  org_seat_alerts: partagee('alertes de sièges', `${ORG_ADMIN}`),
  org_settings: partagee("réglages d'organisation", `${ORG}`),
  org_subscriptions: partagee('abonnement entreprise', `${ORG_ADMIN} ; e2e/rls/org-subscriptions.test.ts`),
  org_team_members: partagee("membres d'équipe", `${ORG} ; ${ORG_TESTS}`),
  org_teams: partagee('équipes', `${ORG} ; ${ORG_TESTS}`),
  org_verified_domains: partagee('domaines vérifiés', `${ORG_ADMIN}`),
  org_webhook_deliveries: serveur('RLS activée sans policy (mig. 199) : file de livraison, lue par service_role'),
  org_webhooks: partagee('webhooks', `${ORG_ADMIN}`),
  org_weekly_reviews: partagee('revues hebdomadaires', `${ORG}`),
  org_withdrawals: partagee('rétractation entreprise', `${ORG_ADMIN}`),
  team_automations: partagee('automatisations', `${ORG} ; ${ORG_TESTS}`),
  team_categories: partagee("catégories d'entreprise", `${ORG} ; ${ORG_TESTS}`),
  team_key_results: partagee('résultats clés d’équipe', `${ORG} ; ${ORG_TESTS}`),
  team_kr_checkins: partagee('points d’avancement', `${ORG} ; ${ORG_TESTS}`),
  team_kr_projects: partagee('liens KR et projets', `${ORG} ; ${ORG_TESTS}`),
  team_labels: partagee('étiquettes', `${ORG} ; ${ORG_TESTS}`),
  team_list_tasks: partagee('tâches de liste d’équipe', `${ORG} ; ${ORG_TESTS}`),
  team_lists: partagee('listes d’équipe', `${ORG} ; ${ORG_TESTS}`),
  team_okr_members: partagee('audience d’un OKR', `${ORG} ; ${ORG_TESTS}`),
  team_okr_teams: partagee('équipes d’un OKR', `${ORG} ; ${ORG_TESTS}`),
  team_okrs: partagee('OKR d’équipe', `${ORG} ; ${ORG_TESTS}`),
  team_project_dependencies: partagee('dépendances de projets', `${ORG} ; ${ORG_TESTS}`, lienVersUneAutreLigne('team_projects')),
  team_project_followers: partagee('abonnés d’un projet', `${ORG} ; ${ORG_TESTS}`),
  team_project_members: partagee('membres d’un projet', `${ORG} ; ${ORG_TESTS}`),
  team_project_messages: partagee('messages de projet', `${ORG} ; ${ORG_TESTS}`),
  team_project_statuses: partagee('statuts de projet', `${ORG} ; ${ORG_TESTS}`),
  team_project_teams: partagee('équipes d’un projet', `${ORG} ; ${ORG_TESTS}`),
  team_projects: partagee('projets', `${ORG} ; ${ORG_TESTS}`),
  team_task_activity: partagee('activité des tâches', `${ORG} ; ${ORG_TESTS}`),
  team_task_comments: partagee('commentaires', `${ORG} ; ${ORG_TESTS}`),
  team_task_dependencies: partagee('dépendances de tâches', `${ORG} ; ${ORG_TESTS}`, lienVersUneAutreLigne('team_tasks')),
  team_task_followers: partagee('abonnés d’une tâche', `${ORG} ; ${ORG_TESTS}`),
  team_task_labels: partagee('étiquettes de tâche', `${ORG} ; ${ORG_TESTS}`),
  team_task_subtasks: partagee('sous-tâches', `${ORG} ; ${ORG_TESTS}`),
  team_tasks: partagee('tâches d’entreprise', `${ORG} ; ${ORG_TESTS}`),
};
