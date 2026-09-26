// Journal d'audit de l'organisation (mig. 162, étendu par 190 et 193) —
// fonctions pures : actions connues, familles, cible lisible, export CSV.
//
// Le journal est écrit par des TRIGGERS : une action que ce client ne
// connaît pas (base plus récente) s'affiche sous un libellé générique, jamais
// en code brut à la place d'une phrase.
//
// ⚠️ L'export contient des données personnelles de tiers (qui a fait quoi, à
// qui). Il est réservé aux admins, comme la lecture (RLS `org_audit_log`), et
// sert la gouvernance et la diligence : c'est la pièce qu'on produit.

import type { AuditEntry } from '@/modules/organizations/governance.types';

export const AUDIT_ACTIONS = [
  'member.joined', 'member.left', 'member.removed', 'member.role_changed', 'member.moved',
  'member.access_changed', 'member.permissions_changed',
  'team.created', 'team.deleted', 'team.renamed', 'team.member_added', 'team.member_removed',
  'team.lead_granted', 'team.lead_revoked',
  'project.created', 'project.deleted', 'project.archived', 'project.restored', 'project.visibility_changed',
  'project.owner_changed', 'project.status_changed', 'project.health_changed',
  'project.member_added', 'project.member_removed', 'project.member_role_changed',
  'task.trashed', 'task.restored', 'task.deleted',
  'okr.trashed', 'okr.restored', 'okr.deleted',
  'org.renamed', 'org.owner_transferred',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const isKnownAuditAction = (action: string): action is AuditAction =>
  (AUDIT_ACTIONS as readonly string[]).includes(action);

/** Familles filtrables : le préfixe d'action, tel que le serveur le filtre. */
export const AUDIT_FAMILIES = ['member.', 'team.', 'project.', 'task.', 'okr.', 'org.'] as const;
export type AuditFamily = (typeof AUDIT_FAMILIES)[number];

type DotToUnderscore<S extends string> = S extends `${infer A}.${infer B}` ? `${A}_${B}` : S;
export type AuditActionKey = DotToUnderscore<AuditAction>;

/** Clé i18n d'une action : `member.role_changed` → `member_role_changed`. */
export const auditActionKey = (action: AuditAction): AuditActionKey =>
  action.replace('.', '_') as AuditActionKey;

/** Clé i18n d'une famille : `member.` → `member`. */
export type AuditFamilyKey = AuditFamily extends `${infer F}.` ? F : never;
export const auditFamilyKey = (family: AuditFamily): AuditFamilyKey => family.slice(0, -1) as AuditFamilyKey;

export interface AuditLookups {
  memberName: (userId: string) => string | undefined;
  teamName: (teamId: string) => string | undefined;
  projectName: (projectId: string) => string | undefined;
}

const metaString = (entry: AuditEntry, key: string): string | undefined => {
  const v = entry.meta?.[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
};

/**
 * Ce sur quoi porte l'entrée, en toutes lettres. Le nom figé dans `meta` au
 * moment du geste passe AVANT le nom courant : un projet renommé depuis doit
 * se lire sous le nom qu'il avait quand on l'a archivé.
 */
export function auditObjectName(entry: AuditEntry, lookups: AuditLookups): string {
  const fromMeta = metaString(entry, 'name') ?? metaString(entry, 'to');
  if (entry.targetType === 'team' && entry.targetId) return fromMeta ?? lookups.teamName(entry.targetId) ?? '';
  if (entry.targetType === 'project' && entry.targetId) return fromMeta ?? lookups.projectName(entry.targetId) ?? '';
  return fromMeta ?? '';
}

/** La personne visée, si l'entrée en vise une. */
export function auditPersonName(entry: AuditEntry, lookups: AuditLookups, fallback: string): string {
  if (!entry.targetUserId) return '';
  return lookups.memberName(entry.targetUserId) ?? fallback;
}

/** Lignes CSV : date ISO, auteur, action (code stable), personne visée, objet. */
export function buildAuditCsv(
  entries: AuditEntry[],
  lookups: AuditLookups,
  labels: { headers: [string, string, string, string, string]; someone: string },
): { headers: string[]; rows: string[][] } {
  return {
    headers: [...labels.headers],
    rows: entries.map((e) => [
      e.createdAt,
      e.actorId ? lookups.memberName(e.actorId) ?? labels.someone : labels.someone,
      e.action,
      auditPersonName(e, lookups, labels.someone),
      auditObjectName(e, lookups),
    ]),
  };
}
