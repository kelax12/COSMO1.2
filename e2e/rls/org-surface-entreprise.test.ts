// ═══════════════════════════════════════════════════════════════════
// RLS · la surface entreprise (mig. 160 à 220), rejouée acteur par acteur.
//
// POURQUOI CE FICHIER EXISTE (angle mort AM-6 de `faille.md`)
//
// Le 2026-10-01, l'audit A-1 a relu ces tables en production, acteur par
// acteur (`supabase/proofs/a1-tables-160-207.proof.sql`), et n'y a rien trouvé
// en lecture. Mais c'était un geste fait UNE FOIS, à la main. Rien ne
// l'aurait rejoué le jour où une migration relâche une policy : une policy
// réécrite avec un `OR` de trop ne change aucun écran, et la fuite
// inter-organisations de `get_subtree` (mig. 100) en est l'exemple déjà payé.
//
// CE QU'IL REJOUE : pour chacune des 24 tables créées par ces migrations et
// encore présentes, ce que six acteurs peuvent LIRE, INSÉRER, MODIFIER et
// SUPPRIMER. Chaque cellule est mesurée côté serveur : l'écriture passe par le
// client de l'acteur (JWT + clé anon, donc la RLS), puis la ligne est relue
// sous `service_role`, qui ne sert JAMAIS qu'à poser le décor et à constater.
// « Pas d'erreur » n'est pas « écrit », et « une erreur » n'est pas « refusé
// par la RLS » : seule la base relue fait foi.
//
// LES ACTEURS
//   anon  client sans session
//   N     utilisateur authentifié, membre d'AUCUNE organisation
//   C     membre simple de O (rattaché à M)
//   M     encadrant de O : il a un subordonné, C. Depuis la mig. 229 cela ne lui
//         donne AUCUN droit d'écriture : la colonne M prouve qu'il n'en a plus.
//   A     admin de O, et son propriétaire
//   X     admin d'une AUTRE organisation, O2 (fuite inter-organisations)
//   E     membre simple de O, ACTEUR DE RIEN : il sert de cible aux insertions
//         (ajouter quelqu'un à un projet, à une audience, lui donner un rôle)
//
// LA LECTURE D'UN ÉCHEC : chaque table imprime sa matrice observée et la
// matrice attendue (ligne `RLS-MATRIX`), cellule par cellule. Un écart dit
// quelle opération, sur quelle table, a changé pour quel acteur.
//
// ⚠️ Chaque cellule a été vue ROUGE sur un sabotage avant d'être crue :
//   · policies RELÂCHÉES (`USING (true) WITH CHECK (true)` pour `anon` et
//     `authenticated`, tables parentes comprises, `GRANT ALL`) : toutes les
//     cellules « refusé » sont devenues « accepté » ;
//   · policies RETIRÉES sur les 24 tables : toutes les cellules « accepté »
//     sont devenues « refusé ».
// Les deux sabotages ont été joués en CI, sur une migration de test d'une PR
// brouillon, jamais en production. Détail daté : `faille.md` § « Surface
// entreprise ».
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { admin, anonClient, createTestUser, deleteTestUsers, TestUser } from './helpers';

type Who = 'anon' | 'N' | 'C' | 'M' | 'A' | 'X';
type Row = Record<string, unknown>;
type Op = 'select' | 'insert' | 'update' | 'delete';

const ACTEURS: Who[] = ['anon', 'N', 'C', 'M', 'A', 'X'];
const OPS: Op[] = ['select', 'insert', 'update', 'delete'];

interface Decor {
  O: string;
  O2: string;
  users: Record<'N' | 'C' | 'M' | 'A' | 'X' | 'E', TestUser>;
  P: string;
  P2: string;
  TK: string;
  TK2: string;
  TM: string;
  TM2: string;
  OK: string;
  KR: string;
  LS: string;
  WH: string;
  ROLE: string;
  /** Ids stables des lignes canoniques des tables à clé `id`. */
  ids: Record<string, string>;
}

interface Acteur {
  who: Who;
  client: SupabaseClient;
  /** L'anonyme n'a pas d'identité : il FORGE celle de l'admin. */
  id: string;
}

interface Spec {
  /** Libellé : la table, plus une précision quand une table a deux formes. */
  label: string;
  table: string;
  /** Colonnes qui identifient une ligne (clé primaire). */
  keys: string[];
  /** La ligne posée par le décor, que la lecture cherche. */
  canonical: (d: Decor) => Row;
  /** Une ligne neuve, cible d'une modification ou d'une suppression. */
  fresh?: (d: Decor, n: number) => Row;
  /** La ligne qu'un acteur tente d'insérer. */
  insertRow: (d: Decor, a: Acteur, n: number) => Row;
  /** Une colonne modifiable, et la valeur qu'on tente d'y écrire. */
  patch: Row;
  allowed: Record<Op, Who[]>;
}

const UN_JOUR = 86_400_000;
const jour = (n: number) => new Date(Date.UTC(2001, 0, 1) + n * UN_JOUR).toISOString().slice(0, 10);
const uuid = () => crypto.randomUUID();
const PASSE = '2000-01-01T00:00:00+00:00';

// ─── Les attentes, table par table ─────────────────────────────────
//
// Elles sont DÉRIVÉES des policies en vigueur (dernière définition dans
// `supabase/migration/`), pas de ce que la base répond : c'est ce qui permet
// à ce fichier de dire non. Le motif de chaque ligne est la policy elle-même.
const SPECS: Spec[] = [
  {
    // SELECT is_org_member · INSERT/UPDATE is_org_admin · pas de DELETE (195)
    label: 'org_settings',
    table: 'org_settings',
    keys: ['org_id'],
    canonical: (d) => ({ org_id: d.O, locale: 'fr' }),
    insertRow: (d) => ({ org_id: d.O, locale: 'fr' }),
    patch: { locale: 'en' },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: ['A'], delete: [] },
  },
  {
    // SELECT is_org_member · INSERT/DELETE is_org_admin · pas d'UPDATE (195)
    label: 'org_verified_domains',
    table: 'org_verified_domains',
    keys: ['id'],
    canonical: (d) => ({ id: d.ids.org_verified_domains, org_id: d.O, domain: 'rls-canonique.fr' }),
    fresh: (d, n) => ({ id: uuid(), org_id: d.O, domain: `rls-cible-${n}.fr` }),
    insertRow: (d, _a, n) => ({ id: uuid(), org_id: d.O, domain: `rls-insert-${n}.fr` }),
    patch: { last_checked_at: PASSE },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: [], delete: ['A'] },
  },
  {
    // Tout is_org_admin (199) : l'URL et le secret ne sortent pas de l'admin.
    label: 'org_webhooks',
    table: 'org_webhooks',
    keys: ['id'],
    canonical: (d) => ({ id: d.WH, org_id: d.O, name: 'Canonique', url: 'https://hooks.slack.com/rls' }),
    fresh: (d) => ({ id: uuid(), org_id: d.O, name: 'Cible', url: 'https://hooks.slack.com/rls-cible' }),
    insertRow: (d) => ({ id: uuid(), org_id: d.O, name: 'Forgé', url: 'https://hooks.slack.com/rls-forge' }),
    patch: { name: 'Renommé' },
    allowed: { select: ['A'], insert: ['A'], update: ['A'], delete: ['A'] },
  },
  {
    // RLS sans aucune policy (199) : la file n'appartient qu'au dispatcher.
    label: 'org_webhook_deliveries',
    table: 'org_webhook_deliveries',
    keys: ['id'],
    canonical: (d) => ({
      id: d.ids.org_webhook_deliveries, webhook_id: d.WH, org_id: d.O, event: 'task.created', payload: {},
    }),
    fresh: (d) => ({ id: uuid(), webhook_id: d.WH, org_id: d.O, event: 'task.created', payload: {} }),
    insertRow: (d) => ({ id: uuid(), webhook_id: d.WH, org_id: d.O, event: 'task.completed', payload: {} }),
    patch: { attempts: 4 },
    allowed: { select: [], insert: [], update: [], delete: [] },
  },
  {
    // Tout « propriétaire de l'organisation » (180), anon révoqué.
    label: 'org_billing_contacts',
    table: 'org_billing_contacts',
    keys: ['org_id'],
    canonical: (d) => ({ org_id: d.O, email: 'compta@rls-test.fr' }),
    insertRow: (d) => ({ org_id: d.O, email: 'forge@rls-test.fr' }),
    patch: { name: 'Service comptable' },
    allowed: { select: ['A'], insert: ['A'], update: ['A'], delete: ['A'] },
  },
  {
    // Réglages PERSONNELS (162) : SELECT/UPDATE user_id = uid, INSERT
    // soi-même ET membre, pas de DELETE. La ligne canonique est celle de C.
    label: 'org_notification_settings',
    table: 'org_notification_settings',
    keys: ['org_id', 'user_id'],
    canonical: (d) => ({ org_id: d.O, user_id: d.users.C.id, digest: 'off' }),
    insertRow: (d, a) => ({ org_id: d.O, user_id: a.id, digest: 'off' }),
    patch: { digest: 'daily' },
    allowed: { select: ['C'], insert: ['C', 'M', 'A'], update: ['C'], delete: [] },
  },
  {
    // Vues PERSONNELLES (192) : tout user_id = uid, INSERT soi-même ET membre.
    label: 'org_saved_views',
    table: 'org_saved_views',
    keys: ['id'],
    canonical: (d) => ({
      id: d.ids.org_saved_views, org_id: d.O, user_id: d.users.C.id, scope: 'tasks', name: 'Vue de C',
    }),
    fresh: (d, n) => ({ id: uuid(), org_id: d.O, user_id: d.users.C.id, scope: 'tasks', name: `Cible ${n}` }),
    insertRow: (d, a, n) => ({ id: uuid(), org_id: d.O, user_id: a.id, scope: 'tasks', name: `Vue ${n}` }),
    patch: { name: 'Renommée' },
    allowed: { select: ['C'], insert: ['C', 'M', 'A'], update: ['C'], delete: ['C'] },
  },
  {
    // SELECT is_org_admin, aucune écriture client (162) : le journal s'écrit
    // par triggers DEFINER seulement.
    label: 'org_audit_log',
    table: 'org_audit_log',
    keys: ['id'],
    canonical: (d) => ({ id: d.ids.org_audit_log, org_id: d.O, action: 'rls-proof', target_type: 'proof' }),
    fresh: (d) => ({ id: uuid(), org_id: d.O, action: 'rls-cible', target_type: 'proof' }),
    insertRow: (d) => ({ id: uuid(), org_id: d.O, action: 'rls-forge', target_type: 'proof' }),
    patch: { action: 'rls-reecrit' },
    allowed: { select: ['A'], insert: [], update: [], delete: [] },
  },
  {
    // SELECT créateur OU admin (164) · INSERT soi-même ET membre · DELETE
    // créateur SEUL (l'admin ne supprime pas la revue d'un autre) · pas d'UPDATE.
    label: 'org_weekly_reviews',
    table: 'org_weekly_reviews',
    keys: ['id'],
    canonical: (d) => ({
      id: d.ids.org_weekly_reviews, org_id: d.O, scope_type: 'org', summary: {}, created_by: d.users.C.id,
    }),
    fresh: (d) => ({ id: uuid(), org_id: d.O, scope_type: 'org', summary: {}, created_by: d.users.C.id }),
    insertRow: (d, a) => ({ id: uuid(), org_id: d.O, scope_type: 'org', summary: {}, created_by: a.id }),
    patch: { note: 'réécrite' },
    allowed: { select: ['C', 'A'], insert: ['C', 'M', 'A'], update: [], delete: ['C'] },
  },
  {
    // Rapport d'ORGANISATION (202) : report.org, que seul l'admin détient par
    // défaut. Écriture révoquée à anon et authenticated.
    label: 'org_activity_reports (organisation)',
    table: 'org_activity_reports',
    keys: ['id'],
    canonical: (d) => ({ id: d.ids.org_activity_reports_org, org_id: d.O, scope: 'org', day: jour(0), payload: {} }),
    fresh: (d, n) => ({ id: uuid(), org_id: d.O, scope: 'org', day: jour(100 + n), payload: {} }),
    insertRow: (d, _a, n) => ({ id: uuid(), org_id: d.O, scope: 'org', day: jour(400 + n), payload: {} }),
    patch: { payload: { reecrit: true } },
    allowed: { select: ['A'], insert: [], update: [], delete: [] },
  },
  {
    // Rapport d'ÉQUIPE (202) : report.allTeams (admin), OU chef de l'équipe
    // (M), OU créateur de l'équipe. C est dans l'équipe sans la diriger.
    label: 'org_activity_reports (équipe)',
    table: 'org_activity_reports',
    keys: ['id'],
    canonical: (d) => ({
      id: d.ids.org_activity_reports_team, org_id: d.O, scope: 'team', team_id: d.TM, day: jour(0), payload: {},
    }),
    fresh: (d, n) => ({ id: uuid(), org_id: d.O, scope: 'team', team_id: d.TM, day: jour(700 + n), payload: {} }),
    insertRow: (d, _a, n) => ({
      id: uuid(), org_id: d.O, scope: 'team', team_id: d.TM, day: jour(1000 + n), payload: {},
    }),
    patch: { payload: { reecrit: true } },
    allowed: { select: ['M', 'A'], insert: [], update: [], delete: [] },
  },
  {
    // Tout is_org_member (203), INSERT soi-même comme créateur.
    label: 'team_lists',
    table: 'team_lists',
    keys: ['id'],
    canonical: (d) => ({ id: d.LS, org_id: d.O, name: 'Liste canonique', created_by: d.users.A.id }),
    fresh: (d) => ({ id: uuid(), org_id: d.O, name: 'Liste cible', created_by: d.users.A.id }),
    insertRow: (d, a) => ({ id: uuid(), org_id: d.O, name: 'Liste forgée', created_by: a.id }),
    patch: { name: 'Liste renommée' },
    allowed: { select: ['C', 'M', 'A'], insert: ['C', 'M', 'A'], update: ['C', 'M', 'A'], delete: ['C', 'M', 'A'] },
  },
  {
    // SELECT/DELETE membre de l'org de la liste · INSERT tâche visible de la
    // même org (203) · pas d'UPDATE.
    label: 'team_list_tasks',
    table: 'team_list_tasks',
    keys: ['list_id', 'task_id'],
    canonical: (d) => ({ list_id: d.LS, task_id: d.TK }),
    insertRow: (d) => ({ list_id: d.LS, task_id: d.TK2 }),
    patch: { created_at: PASSE },
    allowed: { select: ['C', 'M', 'A'], insert: ['C', 'M', 'A'], update: [], delete: ['C', 'M', 'A'] },
  },
  {
    // SELECT KR visible ET projet visible · INSERT/DELETE okr.create (admin ;
    // plus de défaut manager depuis la 229) ET KR visible (160) · pas d'UPDATE.
    label: 'team_kr_projects',
    table: 'team_kr_projects',
    keys: ['kr_id', 'project_id'],
    canonical: (d) => ({ kr_id: d.KR, project_id: d.P, org_id: d.O }),
    insertRow: (d) => ({ kr_id: d.KR, project_id: d.P2, org_id: d.O }),
    patch: { added_at: PASSE },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: [], delete: ['A'] },
  },
  {
    // SELECT KR visible (160) · écriture par RPC seulement (`post_kr_checkin`).
    label: 'team_kr_checkins',
    table: 'team_kr_checkins',
    keys: ['id'],
    canonical: (d) => ({
      id: d.ids.team_kr_checkins, kr_id: d.KR, org_id: d.O, value: 1, status: 'on_track', author_id: d.users.A.id,
    }),
    fresh: (d) => ({ id: uuid(), kr_id: d.KR, org_id: d.O, value: 2, status: 'on_track', author_id: d.users.A.id }),
    insertRow: (d, a) => ({ id: uuid(), kr_id: d.KR, org_id: d.O, value: 99, status: 'on_track', author_id: a.id }),
    patch: { note: 'réécrit' },
    allowed: { select: ['C', 'M', 'A'], insert: [], update: [], delete: [] },
  },
  {
    // Abonnement PERSONNEL (162) : SELECT/DELETE user_id = uid · INSERT
    // soi-même sur une tâche qu'on voit · pas d'UPDATE.
    label: 'team_task_followers',
    table: 'team_task_followers',
    keys: ['task_id', 'user_id'],
    canonical: (d) => ({ task_id: d.TK, user_id: d.users.C.id, org_id: d.O }),
    insertRow: (d, a) => ({ task_id: d.TK, user_id: a.id, org_id: d.O }),
    patch: { created_at: PASSE },
    allowed: { select: ['C'], insert: ['C', 'M', 'A'], update: [], delete: ['C'] },
  },
  {
    // Même règle pour les projets (162).
    label: 'team_project_followers',
    table: 'team_project_followers',
    keys: ['project_id', 'user_id'],
    canonical: (d) => ({ project_id: d.P, user_id: d.users.C.id, org_id: d.O }),
    insertRow: (d, a) => ({ project_id: d.P, user_id: a.id, org_id: d.O }),
    patch: { created_at: PASSE },
    allowed: { select: ['C'], insert: ['C', 'M', 'A'], update: [], delete: ['C'] },
  },
  {
    // SELECT projet visible · INSERT/UPDATE can_edit_team_project (admin ; plus
    // de défaut manager, 229) · DELETE soi-même OU can_edit (190). La ligne est celle de C.
    label: 'team_project_members',
    table: 'team_project_members',
    keys: ['project_id', 'user_id'],
    canonical: (d) => ({ project_id: d.P, user_id: d.users.C.id, org_id: d.O, role: 'contributor' }),
    insertRow: (d) => ({ project_id: d.P, user_id: d.users.E.id, org_id: d.O, role: 'contributor' }),
    patch: { role: 'viewer' },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: ['A'], delete: ['C', 'A'] },
  },
  {
    // SELECT projet visible · INSERT/DELETE my_project_edit_perm (164 ; admin
    // seul par défaut depuis la 229) · pas d'UPDATE, anon révoqué.
    label: 'team_project_teams',
    table: 'team_project_teams',
    keys: ['project_id', 'team_id'],
    canonical: (d) => ({ project_id: d.P, team_id: d.TM, org_id: d.O, added_by: d.users.A.id }),
    insertRow: (d, a) => ({ project_id: d.P, team_id: d.TM2, org_id: d.O, added_by: a.id }),
    patch: { added_at: PASSE },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: [], delete: ['A'] },
  },
  {
    // SELECT projet visible · écriture can_edit_team_project (197 ; admin seul
    // par défaut depuis la 229).
    label: 'team_project_statuses',
    table: 'team_project_statuses',
    keys: ['id'],
    canonical: (d) => ({
      id: d.ids.team_project_statuses, org_id: d.O, project_id: d.P, name: 'Statut', maps_to: 'todo', color: '#123456',
    }),
    fresh: (d) => ({ id: uuid(), org_id: d.O, project_id: d.P, name: 'Cible', maps_to: 'todo' }),
    insertRow: (d) => ({ id: uuid(), org_id: d.O, project_id: d.P, name: 'Forgé', maps_to: 'review' }),
    patch: { name: 'Renommé' },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: ['A'], delete: ['A'] },
  },
  {
    // Automatisation d'ORGANISATION (198) : SELECT is_org_member, écriture
    // is_org_admin quand project_id est NULL.
    label: 'team_automations (organisation)',
    table: 'team_automations',
    keys: ['id'],
    canonical: (d) => ({
      id: d.ids.team_automations_org, org_id: d.O, name: 'Auto org', trigger_kind: 'task_created',
      action_kind: 'set_priority', action_value: '3',
    }),
    fresh: (d) => ({
      id: uuid(), org_id: d.O, name: 'Cible', trigger_kind: 'task_created', action_kind: 'set_priority', action_value: '2',
    }),
    insertRow: (d) => ({
      id: uuid(), org_id: d.O, name: 'Forgée', trigger_kind: 'task_created', action_kind: 'set_priority', action_value: '1',
    }),
    patch: { name: 'Renommée' },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: ['A'], delete: ['A'] },
  },
  {
    // Automatisation de PROJET (198) : écriture can_edit_team_project (admin
    // seul par défaut depuis la 229).
    label: 'team_automations (projet)',
    table: 'team_automations',
    keys: ['id'],
    canonical: (d) => ({
      id: d.ids.team_automations_projet, org_id: d.O, project_id: d.P, name: 'Auto projet',
      trigger_kind: 'task_created', action_kind: 'set_priority', action_value: '3',
    }),
    fresh: (d) => ({
      id: uuid(), org_id: d.O, project_id: d.P, name: 'Cible', trigger_kind: 'task_created',
      action_kind: 'set_priority', action_value: '2',
    }),
    insertRow: (d) => ({
      id: uuid(), org_id: d.O, project_id: d.P, name: 'Forgée', trigger_kind: 'task_created',
      action_kind: 'set_priority', action_value: '1',
    }),
    patch: { name: 'Renommée' },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: ['A'], delete: ['A'] },
  },
  {
    // Audience d'un OKR confidentiel (205, 212 · E-3) : SELECT OKR visible,
    // INSERT/DELETE can_manage_team_okr_audience (admin, ou okr.create et voit
    // l'OKR depuis la 229 ; M ne l'a plus par défaut). Pas de GRANT UPDATE.
    label: 'team_okr_members',
    table: 'team_okr_members',
    keys: ['okr_id', 'user_id'],
    canonical: (d) => ({ okr_id: d.OK, org_id: d.O, user_id: d.users.C.id, added_by: d.users.A.id }),
    insertRow: (d) => ({ okr_id: d.OK, org_id: d.O, user_id: d.users.E.id }),
    patch: { added_at: PASSE },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: [], delete: ['A'] },
  },
  {
    // SELECT is_org_member · écriture admin OU role.manage (219).
    label: 'org_roles',
    table: 'org_roles',
    keys: ['id'],
    canonical: (d) => ({ id: d.ROLE, org_id: d.O, name: 'Rôle canonique', color: '#123456', granted_keys: [] }),
    fresh: (d, n) => ({ id: uuid(), org_id: d.O, name: `Rôle cible ${n}`, color: '#123456', granted_keys: [] }),
    insertRow: (d, _a, n) => ({ id: uuid(), org_id: d.O, name: `Rôle forgé ${n}`, color: '#654321', granted_keys: [] }),
    patch: { name: 'Rôle renommé' },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: ['A'], delete: ['A'] },
  },
  {
    // SELECT is_org_member · écriture admin OU role.manage (219). La cible
    // est E : un rôle sans droit posé sur C changerait les droits de C, donc
    // le reste de ce fichier.
    label: 'org_member_roles',
    table: 'org_member_roles',
    // `(role_id, user_id)` est unique : c'est elle qui identifie l'attribution.
    keys: ['role_id', 'user_id'],
    canonical: (d) => ({ id: d.ids.org_member_roles, org_id: d.O, role_id: d.ROLE, user_id: d.users.E.id }),
    insertRow: (d) => ({ id: uuid(), org_id: d.O, role_id: d.ROLE, user_id: d.users.E.id }),
    patch: { ends_at: '2099-01-01T00:00:00+00:00' },
    allowed: { select: ['C', 'M', 'A'], insert: ['A'], update: ['A'], delete: ['A'] },
  },
  {
    // SELECT projet visible · INSERT auteur = soi ET projet visible · DELETE
    // auteur seul · pas d'UPDATE (220).
    label: 'team_project_messages',
    table: 'team_project_messages',
    keys: ['id'],
    canonical: (d) => ({
      id: d.ids.team_project_messages, project_id: d.P, org_id: d.O, author_id: d.users.C.id, body: 'Message de C',
    }),
    fresh: (d) => ({ id: uuid(), project_id: d.P, org_id: d.O, author_id: d.users.C.id, body: 'Cible' }),
    insertRow: (d, a) => ({ id: uuid(), project_id: d.P, org_id: d.O, author_id: a.id, body: 'Forgé' }),
    patch: { body: 'Réécrit' },
    allowed: { select: ['C', 'M', 'A'], insert: ['C', 'M', 'A'], update: [], delete: ['C'] },
  },
];

// ─── Outils ────────────────────────────────────────────────────────

function pick(row: Row, keys: string[]): Row {
  return Object.fromEntries(keys.map((k) => [k, row[k]]));
}

/** Compare une valeur relue à la valeur écrite (les horodatages se relisent normalisés). */
function same(lu: unknown, ecrit: unknown): boolean {
  if (typeof ecrit === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(ecrit) && typeof lu === 'string') {
    return new Date(lu).getTime() === new Date(ecrit).getTime();
  }
  return JSON.stringify(lu) === JSON.stringify(ecrit);
}

async function adminLit(table: string, match: Row): Promise<Row | null> {
  const { data, error } = await admin.from(table).select('*').match(match).maybeSingle();
  if (error) throw new Error(`relecture admin de ${table} : ${error.message}`);
  return (data as Row | null) ?? null;
}

async function adminEfface(table: string, match: Row): Promise<void> {
  const { error } = await admin.from(table).delete().match(match);
  if (error) throw new Error(`effacement admin de ${table} : ${error.message}`);
}

/**
 * Pose (ou remet) une ligne du décor.
 *
 * ⚠️ En `upsert`, jamais en « effacer puis réinsérer » : effacer une liste, un
 * rôle ou un webhook emporte EN CASCADE ses lignes filles (`team_list_tasks`,
 * `org_member_roles`, `org_webhook_deliveries`). La première version le
 * faisait, et la lecture de ces trois tables mesurait une ligne absente : 0
 * pour tout le monde, donc un « refusé » qui n'aurait rien prouvé.
 */
async function adminPose(table: string, row: Row, keys: string[]): Promise<void> {
  const { error } = await admin.from(table).upsert(row, { onConflict: keys.join(',') });
  if (error) throw new Error(`décor ${table} : ${error.message}`);
}

const cell = (ok: boolean) => (ok ? 1 : 0);
const ligne = (m: Record<Who, number>) => ACTEURS.map((w) => `${w}=${m[w]}`).join(' ');

// ─── Le fichier ────────────────────────────────────────────────────

describe('RLS · surface entreprise, 24 tables × 6 acteurs (mig. 160 à 220, AM-6)', () => {
  let d: Decor;
  let acteurs: Acteur[];
  let compteur = 0;

  beforeAll(async () => {
    const [N, C, M, A, X, E] = [
      await createTestUser(), await createTestUser(), await createTestUser(),
      await createTestUser(), await createTestUser(), await createTestUser(),
    ];
    const stamp = Date.now();
    d = {
      O: uuid(), O2: uuid(), users: { N, C, M, A, X, E },
      P: uuid(), P2: uuid(), TK: uuid(), TK2: uuid(), TM: uuid(), TM2: uuid(),
      OK: uuid(), KR: uuid(), LS: uuid(), WH: uuid(), ROLE: uuid(),
      ids: Object.fromEntries([
        'org_verified_domains', 'org_webhook_deliveries', 'org_saved_views', 'org_audit_log', 'org_weekly_reviews',
        'org_activity_reports_org', 'org_activity_reports_team', 'team_kr_checkins', 'team_project_statuses',
        'team_automations_org', 'team_automations_projet', 'org_member_roles', 'team_project_messages',
      ].map((k) => [k, uuid()])),
    };

    const pose = async (table: string, rows: Row | Row[]) => {
      const { error } = await admin.from(table).insert(rows);
      if (error) throw new Error(`décor ${table} : ${error.message}`);
    };
    await pose('organizations', [
      { id: d.O, name: 'Org RLS surface', owner_id: A.id, join_code: `rls-surf-${stamp}` },
      { id: d.O2, name: 'Org RLS autre', owner_id: X.id, join_code: `rls-surf2-${stamp}` },
    ]);
    await pose('organization_members', [
      { org_id: d.O, user_id: A.id, role: 'admin' },
      { org_id: d.O, user_id: M.id, role: 'member', manager_id: A.id },
      { org_id: d.O, user_id: C.id, role: 'member', manager_id: M.id },
      { org_id: d.O, user_id: E.id, role: 'member', manager_id: A.id },
      { org_id: d.O2, user_id: X.id, role: 'admin' },
    ]);
    await pose('org_teams', [
      { id: d.TM, org_id: d.O, name: 'Équipe RLS', created_by: A.id },
      { id: d.TM2, org_id: d.O, name: 'Équipe RLS 2', created_by: A.id },
    ]);
    await pose('org_team_members', [
      { team_id: d.TM, org_id: d.O, user_id: M.id, is_lead: true },
      { team_id: d.TM, org_id: d.O, user_id: C.id, is_lead: false },
    ]);
    await pose('team_projects', [
      { id: d.P, org_id: d.O, name: 'Projet RLS', created_by: A.id },
      { id: d.P2, org_id: d.O, name: 'Projet RLS 2', created_by: A.id },
    ]);
    await pose('team_tasks', [
      { id: d.TK, org_id: d.O, project_id: d.P, name: 'Tâche RLS', created_by: A.id },
      { id: d.TK2, org_id: d.O, project_id: d.P, name: 'Tâche RLS 2', created_by: A.id },
    ]);
    // OKR CONFIDENTIEL : son audience est C, donc M (C est sous lui) et
    // l'admin le voient aussi ; personne d'autre.
    await pose('team_okrs', { id: d.OK, org_id: d.O, title: 'OKR RLS', audience: 'custom', created_by: A.id });
    await pose('team_key_results', { id: d.KR, okr_id: d.OK, org_id: d.O, title: 'KR RLS' });

    for (const spec of SPECS) await adminPose(spec.table, spec.canonical(d), spec.keys);

    acteurs = [
      { who: 'anon', client: anonClient, id: A.id },
      { who: 'N', client: N.client, id: N.id },
      { who: 'C', client: C.client, id: C.id },
      { who: 'M', client: M.client, id: M.id },
      { who: 'A', client: A.client, id: A.id },
      { who: 'X', client: X.client, id: X.id },
    ];

    // ── Le décor est-il celui qu'on croit ? ────────────────────────
    // Ces vérifications ne testent rien du produit : elles empêchent un
    // décor faux (rôle perdu, hiérarchie absente) de se déguiser en
    // régression ou, pire, en succès.
    const rpc = async (u: TestUser, fn: string, args: Row) => {
      const { data, error } = await u.client.rpc(fn, args);
      if (error) throw new Error(`${fn} : ${error.message}`);
      return data as boolean;
    };
    expect(await rpc(A, 'is_org_admin', { p_org: d.O }), 'A doit être admin de O').toBe(true);
    expect(await rpc(M, 'is_org_manager', { p_org: d.O }), 'M doit être manager (C est sous lui)').toBe(true);
    expect(await rpc(C, 'is_org_manager', { p_org: d.O }), 'C ne doit pas être manager').toBe(false);
    expect(await rpc(C, 'is_org_member', { p_org: d.O }), 'C doit être membre de O').toBe(true);
    expect(await rpc(N, 'is_org_member', { p_org: d.O }), 'N ne doit être membre de rien').toBe(false);
    expect(await rpc(X, 'is_org_admin', { p_org: d.O2 }), 'X doit être admin de O2').toBe(true);
    expect(await rpc(X, 'is_org_member', { p_org: d.O }), 'X ne doit pas être membre de O').toBe(false);
  });

  afterAll(async () => {
    if (!d) return;
    await admin.from('organizations').delete().in('id', [d.O, d.O2]);
    await deleteTestUsers(...Object.values(d.users));
  });

  /** Remet la ligne canonique d'une spec, quoi qu'une tentative en ait fait. */
  async function restaure(spec: Spec) {
    await adminPose(spec.table, spec.canonical(d), spec.keys);
  }

  /** 1 = l'opération a pris effet en base, 0 = non, 9 = incohérence. */
  async function mesure(spec: Spec, op: Op, a: Acteur): Promise<number> {
    const n = compteur++;
    if (op === 'select') {
      const cle = pick(spec.canonical(d), spec.keys);
      // Un « 0 » ne vaut refus que si la ligne EXISTE : sinon c'est le décor
      // qui manque, et la cellule le dit.
      if ((await adminLit(spec.table, cle)) === null) {
        console.log(`RLS-INCOHERENT|${spec.label}|select|${a.who}|ligne canonique absente du décor`);
        return 9;
      }
      const { data } = await a.client.from(spec.table).select('*').match(cle);
      return cell((data ?? []).length > 0);
    }

    if (op === 'insert') {
      const row = spec.insertRow(d, a, n);
      const cle = pick(row, spec.keys);
      await adminEfface(spec.table, cle);
      const { error } = await a.client.from(spec.table).insert(row);
      const ecrit = (await adminLit(spec.table, cle)) !== null;
      await adminEfface(spec.table, cle);
      await restaure(spec);
      // Une insertion sans erreur mais absente en base, ou présente malgré une
      // erreur, est une incohérence à voir, pas à lisser : elle s'inscrit dans
      // la matrice (9), qui ne peut alors plus être égale à l'attendu.
      if (ecrit === (error !== null)) {
        console.log(`RLS-INCOHERENT|${spec.label}|insert|${a.who}|erreur=${error?.message ?? 'aucune'}|écrite=${ecrit}`);
        return 9;
      }
      if (!ecrit) console.log(`RLS-REFUS|${spec.label}|insert|${a.who}|${error?.code ?? ''} ${error?.message ?? ''}`);
      return cell(ecrit);
    }

    // UPDATE et DELETE visent une ligne NEUVE, posée par le décor : la ligne
    // canonique reste intacte pour les autres acteurs.
    const cible = spec.fresh ? spec.fresh(d, n) : spec.canonical(d);
    const cle = pick(cible, spec.keys);
    await adminPose(spec.table, cible, spec.keys);

    let effet: boolean;
    if (op === 'update') {
      await a.client.from(spec.table).update(spec.patch).match(cle);
      const relu = await adminLit(spec.table, cle);
      effet = relu !== null && Object.entries(spec.patch).every(([k, v]) => same(relu[k], v));
    } else {
      await a.client.from(spec.table).delete().match(cle);
      effet = (await adminLit(spec.table, cle)) === null;
    }
    await adminEfface(spec.table, cle);
    await restaure(spec);
    return cell(effet);
  }

  for (const spec of SPECS) {
    for (const op of OPS) {
      it(`${spec.label} · ${op}`, async () => {
        const observe = {} as Record<Who, number>;
        const attendu = {} as Record<Who, number>;
        for (const a of acteurs) {
          observe[a.who] = await mesure(spec, op, a);
          attendu[a.who] = cell(spec.allowed[op].includes(a.who));
        }
        // Lu par le relevé des sabotages : une ligne par table et par opération.
        console.log(`RLS-MATRIX|${spec.label}|${op}|observé ${ligne(observe)}|attendu ${ligne(attendu)}`);
        expect(observe, `${spec.label} · ${op}`).toEqual(attendu);
      });
    }
  }
});
