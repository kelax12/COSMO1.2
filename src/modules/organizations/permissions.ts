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
// Modèle de surcharge : une valeur `null` signifie « suit le défaut dérivé »
// (admin / manager / membre), `true`/`false` une décision explicite. Une
// organisation sans aucune surcharge se comporte comme avant la mig. 115.

import { isManagerOf, type OrgMember } from './types';

/** Les dix droits réglables. La clé est identique côté SQL (`my_org_perm`). */
export const ORG_PERMISSION_KEYS = [
  'task.create',
  'task.editAny',
  'task.deleteAny',
  'project.create',
  'project.delete',
  'okr.create',
  'okr.delete',
  'category.manage',
  'team.create',
  'member.invite',
] as const;

export type OrgPermissionKey = (typeof ORG_PERMISSION_KEYS)[number];

/**
 * Droits dont le défaut est « tout membre ». Tous les autres ont pour défaut
 * « manager » (admin, ou au moins un subordonné direct).
 */
const MEMBER_DEFAULT_KEYS: ReadonlySet<string> = new Set<OrgPermissionKey>([
  'task.create',
  'task.editAny',
  'task.deleteAny',
]);

/** Cibles d'assignation cumulables. Tableau vide = « personne ». */
export const ORG_ASSIGN_TARGETS = ['self', 'peers', 'manager', 'subordinates', 'everyone'] as const;

export type OrgAssignTarget = (typeof ORG_ASSIGN_TARGETS)[number];

/** Défaut historique : tout le monde peut assigner à tout le monde. */
export const DEFAULT_ASSIGN_TARGETS: OrgAssignTarget[] = ['everyone'];

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

/** Droits effectifs d'un membre : les dix clés, résolues. */
export type EffectiveOrgPermissions = Record<OrgPermissionKey, boolean>;

interface EffectiveInput {
  /** Le membre dont on calcule les droits. */
  member: OrgMember;
  /** L'annuaire complet — sert à dériver « est-il manager ? ». */
  members: OrgMember[];
  /** Sa surcharge, si elle existe. */
  overrides?: OrgMemberPermissions | null;
}

/**
 * Droits effectifs = COALESCE(surcharge, défaut dérivé).
 *
 * Un admin est TOUJOURS à `true` partout : le serveur court-circuite dessus
 * (mig. 115), et c'est ce qui empêche une organisation de se bloquer
 * elle-même. Toute divergence ici afficherait un bouton grisé alors que le
 * serveur l'accepte.
 */
export const effectivePermissions = ({
  member,
  members,
  overrides,
}: EffectiveInput): EffectiveOrgPermissions => {
  const isAdmin = member.role === 'admin';
  const isManager = isAdmin || isManagerOf(members, member.userId);

  const out = {} as EffectiveOrgPermissions;
  for (const key of ORG_PERMISSION_KEYS) {
    if (isAdmin) {
      out[key] = true;
      continue;
    }
    const override = overrides?.overrides?.[key];
    out[key] = override ?? (MEMBER_DEFAULT_KEYS.has(key) ? true : isManager);
  }
  return out;
};

/** Cibles d'assignation effectives d'un membre (miroir de `my_assign_targets`). */
export const effectiveAssignTargets = ({
  member,
  overrides,
}: {
  member: OrgMember;
  overrides?: OrgMemberPermissions | null;
}): OrgAssignTarget[] => {
  if (member.role === 'admin') return DEFAULT_ASSIGN_TARGETS;
  return overrides?.assignTargets ?? DEFAULT_ASSIGN_TARGETS;
};

interface AssignInput {
  /** Celui qui assigne. */
  actor: OrgMember;
  /** Celui à qui on voudrait assigner. */
  target: OrgMember;
  members: OrgMember[];
  /** Cibles effectives de l'acteur (cf. {@link effectiveAssignTargets}). */
  targets: OrgAssignTarget[];
}

/**
 * « L'acteur peut-il assigner une tâche à la cible ? » — miroir de
 * `can_assign_to` (mig. 115).
 *
 * « Même niveau » = MÊME SUPÉRIEUR DIRECT. Deux membres non placés
 * (`managerId` nul) ne sont pas des pairs : l'état par défaut à l'arrivée
 * dans une organisation étant « non placé », les traiter comme des pairs
 * ouvrirait toute l'entreprise d'un coup.
 */
export const canAssignTo = ({ actor, target, members, targets }: AssignInput): boolean => {
  if (targets.includes('everyone')) return true;
  if (targets.includes('self') && target.userId === actor.userId) return true;

  const myManager = actor.managerId ?? null;
  if (targets.includes('manager') && myManager !== null && target.userId === myManager) return true;
  if (
    targets.includes('peers')
    && myManager !== null
    && target.managerId === myManager
    && target.userId !== actor.userId
  ) {
    return true;
  }
  if (targets.includes('subordinates') && isBelow(members, actor.userId, target.userId)) return true;

  return false;
};

/** `target` est-il dans le sous-arbre de `root` ? Miroir de `is_above` (cap 50). */
const isBelow = (members: OrgMember[], root: string, target: string): boolean => {
  let current = members.find((m) => m.userId === target);
  for (let depth = 0; depth < 50 && current?.managerId; depth++) {
    if (current.managerId === root) return true;
    const next: string | null | undefined = current.managerId;
    current = members.find((m) => m.userId === next);
  }
  return false;
};

/**
 * Le plafond du délégant : un manager non-admin ne peut jamais accorder un
 * droit qu'il n'a pas lui-même (garde serveur `enforce_org_permission_ceiling`).
 * Un admin n'est plafonné par rien.
 */
export const canGrant = (
  actorPermissions: EffectiveOrgPermissions,
  actorIsAdmin: boolean,
  key: OrgPermissionKey,
): boolean => actorIsAdmin || actorPermissions[key];

/**
 * Qui peut ouvrir la fiche de permissions d'un membre : l'admin partout, le
 * manager sur son sous-arbre. Jamais sur un admin (il détient tout par
 * construction — le serveur refuse la ligne) ni sur soi-même.
 */
export const canEditPermissionsOf = ({
  actorId,
  actorIsAdmin,
  target,
  members,
}: {
  actorId: string | undefined;
  actorIsAdmin: boolean;
  target: OrgMember;
  members: OrgMember[];
}): boolean => {
  if (!actorId || target.userId === actorId) return false;
  if (target.role === 'admin') return false;
  return actorIsAdmin || isBelow(members, actorId, target.userId);
};
