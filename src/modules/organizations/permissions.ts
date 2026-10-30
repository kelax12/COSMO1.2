// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Permissions explicites par membre (mig. 115)
// ═══════════════════════════════════════════════════════════════════
//
// Source de vérité CLIENT des droits du mode entreprise. Aucun composant ne
// recalcule un droit dans son coin : il appelle `effectivePermissions` ou
// `canAssignTo`. Ces deux fonctions sont le MIROIR EXACT des helpers SQL
// `my_org_perm` / `can_assign_to` de la migration 115 — c'est le serveur qui
// décide, ce fichier ne fait qu'éviter d'afficher un bouton qui échouerait.
//
// Modèle de surcharge : une valeur `null` signifie « suit le défaut »
// (admin : tout ; membre : les droits de base), `true`/`false` une décision
// explicite. Depuis la mig. 229 il n'y a plus de défaut « manager » : la
// hiérarchie n'ouvre plus aucun droit, seuls les rôles personnalisés le font.

import type { OrgMember } from './types';

/**
 * Les onze droits réglables. La clé est identique côté SQL (`my_org_perm`).
 * `project.edit` (mig. 153) : MODIFIER un projet exigeait jusque-là
 * `project.create`, dont le nom ne disait pas l'action.
 */
export const ORG_PERMISSION_KEYS = [
  'task.create',
  'task.editAny',
  'task.deleteAny',
  'project.create',
  'project.edit',
  'project.delete',
  'okr.create',
  'okr.delete',
  'category.manage',
  'team.create',
  'member.invite',
  // Rapports d'activité (mig. 202) : défaut ADMIN SEULEMENT, jamais « manager ».
  'report.org',
  'report.allTeams',
  // Rôles personnalisés (mig. 219) : défaut ADMIN SEULEMENT. Droit de confiance.
  'role.manage',
] as const;

export type OrgPermissionKey = (typeof ORG_PERMISSION_KEYS)[number];

/**
 * Droits dont le défaut est « tout membre ». Tous les autres sont refusés à un
 * non-admin tant qu'un rôle ou sa fiche ne les donne pas (mig. 229 : encadrer
 * quelqu'un ne donne plus rien). Miroir exact de `my_org_perm`.
 *
 * ❌ `task.deleteAny` n'y est PLUS (mig. 152, M4) : par défaut un membre ne
 * supprime que les tâches qu'il a créées.
 */
const MEMBER_DEFAULT_KEYS: ReadonlySet<string> = new Set<OrgPermissionKey>([
  'task.create',
  'task.editAny',
]);

/**
 * Cibles d'assignation cumulables. Tableau vide = « personne ».
 * `peers` / `manager` / `subordinates` ont disparu avec la hiérarchie
 * (mig. 229, contrainte CHECK côté base).
 */
export const ORG_ASSIGN_TARGETS = ['self', 'everyone'] as const;

export type OrgAssignTarget = (typeof ORG_ASSIGN_TARGETS)[number];

/** Défaut historique : tout le monde peut assigner à tout le monde. */
/**
 * 🔴 GELÉE, et rendue par COPIE partout. Le tableau était rendu tel quel par
 * `effectiveAssignTargets`, donc partagé par tous les membres : un appelant qui
 * l'aurait trié ou complété aurait modifié le défaut de l'organisation entière.
 * C'est la classe de la faille B12 (seeds de démo mutés en place).
 */
export const DEFAULT_ASSIGN_TARGETS: readonly OrgAssignTarget[] = Object.freeze<OrgAssignTarget[]>(['everyone']);

/**
 * Une ligne de `org_member_permissions` : uniquement des SURCHARGES.
 * `null` = pas de décision, on retombe sur le défaut dérivé.
 */
export interface OrgMemberPermissions {
  orgId: string;
  userId: string;
  overrides: Partial<Record<OrgPermissionKey, boolean | null>>;
  /** `null` = pas de décision (→ {@link DEFAULT_ASSIGN_TARGETS}). `[]` = personne. */
  assignTargets: OrgAssignTarget[] | null;
}

/**
 * L'état complet de la fiche de permissions, tel qu'on l'enregistre.
 *
 * Remplacement TOTAL de la ligne, jamais un patch partiel : la fiche présente
 * les dix droits d'un seul tenant, et un enregistrement partiel laisserait
 * l'écran et la base en désaccord sur ce qui a été décidé.
 */
export interface SetOrgPermissionsInput {
  overrides: Partial<Record<OrgPermissionKey, boolean | null>>;
  /** `null` = aucune décision de portée. `[]` = « personne ». */
  assignTargets: OrgAssignTarget[] | null;
}

/**
 * Ce qu'un rôle personnalisé ACTIF apporte (mig. 219). Un rôle définit tout :
 * une clé absente est REFUSÉE, même un droit qu'un membre a par défaut.
 */
export interface ActiveRoleGrant {
  grantedKeys: readonly OrgPermissionKey[];
  assignTargets: readonly OrgAssignTarget[];
}

/** Droits effectifs d'un membre : les dix clés, résolues. */
export type EffectiveOrgPermissions = Record<OrgPermissionKey, boolean>;

interface EffectiveInput {
  /** Le membre dont on calcule les droits. */
  member: OrgMember;
  /** Sa surcharge, si elle existe. */
  overrides?: OrgMemberPermissions | null;
  /** Ses rôles personnalisés ACTIFS (mig. 219). Vide = aucun. */
  roles?: readonly ActiveRoleGrant[];
}

/**
 * Droits effectifs = rôles actifs, sinon COALESCE(surcharge, défaut dérivé).
 *
 * Miroir de `my_org_perm` (mig. 219) : au moins un rôle actif → OU logique des
 * rôles, et rien d'autre n'est lu (le rôle écrase la fiche et le défaut).
 *
 * Un admin est TOUJOURS à `true` partout : le serveur court-circuite dessus
 * (mig. 115), et c'est ce qui empêche une organisation de se bloquer
 * elle-même. Toute divergence ici afficherait un bouton grisé alors que le
 * serveur l'accepte.
 */
export const effectivePermissions = ({
  member,
  overrides,
  roles = [],
}: EffectiveInput): EffectiveOrgPermissions => {
  const isAdmin = member.role === 'admin';

  const out = {} as EffectiveOrgPermissions;
  for (const key of ORG_PERMISSION_KEYS) {
    if (isAdmin) {
      out[key] = true;
      continue;
    }
    if (roles.length > 0) {
      out[key] = roles.some((r) => r.grantedKeys.includes(key));
      continue;
    }
    const override = overrides?.overrides?.[key];
    out[key] = override ?? MEMBER_DEFAULT_KEYS.has(key);
  }
  return out;
};

/**
 * Cibles d'assignation effectives d'un membre (miroir de `my_assign_targets`).
 * Avec au moins un rôle actif : UNION des portées des rôles (mig. 219).
 */
export const effectiveAssignTargets = ({
  member,
  overrides,
  roles = [],
}: {
  member: OrgMember;
  overrides?: OrgMemberPermissions | null;
  roles?: readonly ActiveRoleGrant[];
}): OrgAssignTarget[] => {
  if (member.role === 'admin') return [...DEFAULT_ASSIGN_TARGETS];
  if (roles.length > 0) return ORG_ASSIGN_TARGETS.filter((t) => roles.some((r) => r.assignTargets.includes(t)));
  return overrides?.assignTargets ?? [...DEFAULT_ASSIGN_TARGETS];
};

interface AssignInput {
  /** Celui qui assigne. */
  actor: OrgMember;
  /** Celui à qui on voudrait assigner. */
  target: OrgMember;
  /** Cibles effectives de l'acteur (cf. {@link effectiveAssignTargets}). */
  targets: OrgAssignTarget[];
}

/** « L'acteur peut-il assigner une tâche à la cible ? » — miroir de `can_assign_to`. */
export const canAssignTo = ({ actor, target, targets }: AssignInput): boolean =>
  targets.includes('everyone') || (targets.includes('self') && target.userId === actor.userId);

/**
 * Le plafond du délégant : un non-admin ne peut jamais accorder un droit qu'il
 * n'a pas lui-même (garde serveur `enforce_org_permission_ceiling`). Un admin
 * n'est plafonné par rien.
 */
export const canGrant = (
  actorPermissions: EffectiveOrgPermissions,
  actorIsAdmin: boolean,
  key: OrgPermissionKey,
): boolean => actorIsAdmin || actorPermissions[key];

/**
 * Qui peut ouvrir la fiche de permissions d'un membre : l'admin seul (mig. 229,
 * le supérieur hiérarchique ne l'écrit plus). Jamais sur un admin (il détient
 * tout par construction, le serveur refuse la ligne) ni sur soi-même.
 */
export const canEditPermissionsOf = ({
  actorId,
  actorIsAdmin,
  target,
}: {
  actorId: string | undefined;
  actorIsAdmin: boolean;
  target: OrgMember;
}): boolean => {
  if (!actorId || target.userId === actorId) return false;
  if (target.role === 'admin') return false;
  return actorIsAdmin;
};

/** Ce qu'une règle de tâche a besoin de savoir d'une tâche d'équipe. */
export interface TaskOwnership {
  createdBy?: string | null;
  assigneeIds: readonly string[];
}

/**
 * « Puis-je MODIFIER cette tâche ? » — miroir exact de la policy
 * `team_tasks_update` (mig. 115) : `task.editAny`, ou créateur, ou assigné.
 *
 * Sans lui, l'interface proposait de cocher, de changer le statut ou de
 * glisser n'importe quelle tâche, et le serveur refusait après coup
 * (cohérence globale, 2026-09-25 : « tantôt masqué, tantôt affiché puis refusé »).
 */
export const canEditTeamTask = (can: EffectiveOrgPermissions, userId: string | undefined, task: TaskOwnership): boolean =>
  can['task.editAny'] || (!!userId && (task.createdBy === userId || task.assigneeIds.includes(userId)));

/** « Puis-je supprimer cette tâche ? » — miroir de `team_tasks_delete` / `delete_team_task` (mig. 152). */
export const canDeleteTeamTask = (can: EffectiveOrgPermissions, userId: string | undefined, task: TaskOwnership): boolean =>
  can['task.deleteAny'] || (!!userId && task.createdBy === userId);
