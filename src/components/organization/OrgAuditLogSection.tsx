// Journal d'audit de l'organisation (mig. 162) — lisible par les admins
// seuls. Qui a rejoint, qui est parti, qui a changé un rôle, une équipe, un
// projet, une permission ; ce qui est passé par la corbeille. C'est la pièce
// qu'on produit après un incident ou en diligence : elle se filtre, se pagine
// et s'exporte.
//
// ⚠️ Rétention : un an (`purge_org_audit_log`). L'écran le dit.

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Download, History } from 'lucide-react';
import { useAuditLogPages } from '@/modules/organizations/governance.hooks';
import type { OrgMember } from '@/modules/organizations';
import { useOrgTeams } from '@/modules/org-teams';
import { useTeamProjects } from '@/modules/team-projects';
import { downloadCSV } from '@/lib/csv-export';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import MemberSelectField from './MemberSelectField';
import {
  AUDIT_FAMILIES, auditActionKey, auditFamilyKey, auditObjectName, auditPersonName, buildAuditCsv, isKnownAuditAction,
  type AuditFamily, type AuditLookups,
} from './audit-log.helpers';

interface OrgAuditLogSectionProps {
  orgId: string;
  members: OrgMember[];
}

const OrgAuditLogSection = ({ orgId, members }: OrgAuditLogSectionProps) => {
  const { t } = useT('orgAccount');
  const [family, setFamily] = useState<AuditFamily | ''>('');
  const [person, setPerson] = useState('');
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useAuditLogPages(orgId, {
    actionPrefix: family || undefined,
    targetUserId: person || undefined,
  });
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const entries = useMemo(() => data?.pages.flat() ?? [], [data]);

  const lookups = useMemo<AuditLookups>(() => {
    const m = new Map(members.map((x) => [x.userId, x.displayName]));
    const tm = new Map(teams.map((x) => [x.id, x.name]));
    const pr = new Map(projects.map((x) => [x.id, x.name]));
    return { memberName: (id) => m.get(id), teamName: (id) => tm.get(id), projectName: (id) => pr.get(id) };
  }, [members, teams, projects]);

  const someone = t('audit.someone');
  const exportCsv = () => {
    const csv = buildAuditCsv(entries, lookups, {
      headers: [t('audit.csv.date'), t('audit.csv.actor'), t('audit.csv.action'), t('audit.csv.person'), t('audit.csv.object')],
      someone,
    });
    downloadCSV('cosmo-journal-audit', csv.headers, csv.rows);
  };

  return (
    <section aria-labelledby="org-audit-title" className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 id="org-audit-title" className="flex items-center gap-1.5 text-sm font-bold text-[rgb(var(--color-text-primary))]">
            <History size={15} aria-hidden="true" /> {t('audit.title')}
          </h2>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t('audit.help')}</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={entries.length === 0}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
        >
          <Download size={14} aria-hidden="true" /> {t('audit.export')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{t('audit.familyLabel')}</span>
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value as AuditFamily | '')}
            className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]"
          >
            <option value="">{t('audit.family.all')}</option>
            {AUDIT_FAMILIES.map((f) => (
              <option key={f} value={f}>{t(`audit.family.${auditFamilyKey(f)}`)}</option>
            ))}
          </select>
        </label>
        <MemberSelectField
          label={t('audit.personLabel')}
          members={members}
          value={person}
          onChange={setPerson}
          emptyLabel={t('audit.anyone')}
        />
      </div>

      {isLoading ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('audit.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('audit.empty')}</p>
      ) : (
        <ol className="divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
          {entries.map((e) => {
            const actor = e.actorId ? lookups.memberName(e.actorId) ?? someone : t('audit.system');
            const vars = {
              actor,
              person: auditPersonName(e, lookups, someone),
              object: auditObjectName(e, lookups),
            };
            return (
              <li key={e.id} className="px-3 py-2 flex items-start gap-3">
                <time dateTime={e.createdAt} className="shrink-0 w-28 text-xs tabular-nums text-[rgb(var(--color-text-muted))]">
                  {format(parseISO(e.createdAt), 'd MMM yyyy HH:mm', { locale: getDateLocale() })}
                </time>
                <p className="text-sm text-[rgb(var(--color-text-primary))] min-w-0 break-words">
                  {isKnownAuditAction(e.action)
                    ? t(`audit.action.${auditActionKey(e.action)}`, vars)
                    : t('audit.action.unknown', vars)}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full h-9 rounded-lg text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-60"
        >
          {isFetchingNextPage ? t('audit.loading') : t('audit.more')}
        </button>
      )}
    </section>
  );
};

export default OrgAuditLogSection;
