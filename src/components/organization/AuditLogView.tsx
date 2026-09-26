import { useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useAuditLog } from '@/modules/organizations/governance.hooks';
import type { AuditEntry } from '@/modules/organizations/governance.types';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import { getDateLocale } from '@/i18n/format';
import type { KeyOf } from '@/i18n/catalog';
import { useT } from '@/i18n/useT';

interface AuditLogViewProps {
  orgId: string;
  members: OrgMember[];
  teams: OrgTeam[];
  /** Restreint le journal à ce qui concerne une personne (fiche membre). */
  targetUserId?: string;
}

/** Familles d'actions, pour le filtre. */
const FAMILIES = ['member', 'team', 'project', 'org'] as const;
type Family = (typeof FAMILIES)[number];

/** `member.role_changed` → `audit.member_role_changed`. Une action inconnue a un libellé générique. */
const KNOWN = new Set([
  'member.joined', 'member.left', 'member.removed', 'member.role_changed', 'member.moved',
  'member.access_changed', 'member.permissions_changed',
  'team.created', 'team.deleted', 'team.renamed', 'team.member_added', 'team.member_removed',
  'team.lead_granted', 'team.lead_revoked',
  'project.created', 'project.deleted', 'project.archived', 'project.restored', 'project.visibility_changed',
  'org.renamed', 'org.owner_transferred',
]);
const labelKey = (action: string): KeyOf<'org'> =>
  (KNOWN.has(action) ? `audit.${action.replace('.', '_')}` : 'audit.unknown') as KeyOf<'org'>;

/**
 * Journal d'audit de l'organisation (mig. 162, M13) : qui a fait quoi sur les
 * membres, rôles, équipes, projets, droits et la propriété, depuis un an.
 * Lisible par les admins seuls (policy `org_audit_log_select`).
 */
const AuditLogView = ({ orgId, members, teams, targetUserId }: AuditLogViewProps) => {
  const { t } = useT('org');
  const { data: entries = [], isLoading } = useAuditLog(orgId, { targetUserId });
  const [family, setFamily] = useState<Family | null>(null);

  const nameOf = useMemo(() => {
    const byId = new Map(members.map((m) => [m.userId, m.displayName]));
    return (id: string | null) => (id ? byId.get(id) ?? t('audit.formerMember') : t('audit.system'));
  }, [members, t]);
  const teamName = useMemo(() => {
    const byId = new Map(teams.map((x) => [x.id, x.name]));
    return (id: string | null) => (id ? byId.get(id) ?? t('audit.deletedTeam') : '');
  }, [teams, t]);

  const visible = family ? entries.filter((e) => e.action.startsWith(`${family}.`)) : entries;

  const describe = (e: AuditEntry): string => {
    const meta = e.meta ?? {};
    return t(labelKey(e.action), {
      actor: nameOf(e.actorId),
      target: nameOf(e.targetUserId),
      team: e.targetType === 'team' ? teamName(e.targetId) || String(meta.name ?? '') : '',
      name: String(meta.name ?? ''),
      from: String(meta.from ?? ''),
      to: String(meta.to ?? ''),
    });
  };

  if (isLoading) return <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('settings.loading')}</p>;

  return (
    <div className="space-y-3">
      {!targetUserId && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('audit.filter')}>
          {[null, ...FAMILIES].map((f) => (
            <button
              key={f ?? 'all'}
              type="button"
              aria-pressed={family === f}
              onClick={() => setFamily(f)}
              className={`min-h-9 px-3 rounded-full text-xs font-semibold border ${
                family === f
                  ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
                  : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
              }`}
            >
              {t(`audit.family_${f ?? 'all'}` as KeyOf<'org'>)}
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('audit.empty')}</p>
      ) : (
        <ol className="divide-y divide-[rgb(var(--color-border))] rounded-2xl border border-[rgb(var(--color-border))]">
          {visible.map((e) => (
            <li key={e.id} className="px-3 py-2.5">
              <p className="text-sm text-[rgb(var(--color-text-primary))]">{describe(e)}</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {formatDistanceToNow(parseISO(e.createdAt), { addSuffix: true, locale: getDateLocale() })}
              </p>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('audit.retention')}</p>
    </div>
  );
};

export default AuditLogView;
