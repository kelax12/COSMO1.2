import React from 'react';
import { useNavigate } from 'react-router';
import { Briefcase, ArrowUpRight } from 'lucide-react';
import type { TeamOKR } from '@/modules/team-okrs';
import { okrProgress, krProgress } from '@/components/organization/team-stats.helpers';
import { buildOrgLink } from '@/components/organization/deep-link.helpers';
import { useT } from '@/i18n/useT';
import { isMyTeamKR } from './pro-okrs';

interface ProOKRSectionProps {
  okrs: TeamOKR[];
  /** Nom de chaque organisation, par id. */
  orgNames: Record<string, string>;
  userId: string;
  /** Rend active l organisation de l OKR avant d ouvrir l espace entreprise. */
  onSelectOrg: (orgId: string) => void;
}

/**
 * OKR d'entreprise sur lesquels je contribue, montrés dans le mode perso.
 * Lecture seule : ils se pilotent dans l'espace entreprise, où vivent leurs
 * droits. Le trait indigo, l'icône mallette et le badge « Pro » les
 * distinguent des OKR perso au premier coup d'oeil.
 */
const ProOKRSection: React.FC<ProOKRSectionProps> = ({ okrs, orgNames, userId, onSelectOrg }) => {
  const { t } = useT('okr');
  const navigate = useNavigate();
  if (okrs.length === 0) return null;
  const orgList = [...new Set(okrs.map((o) => orgNames[o.orgId]).filter(Boolean))].join(', ');

  return (
    <section aria-labelledby="pro-okr-heading" className="mb-10">
      <div className="flex items-center gap-2 mb-1">
        <Briefcase size={18} className="text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        <h2 id="pro-okr-heading" className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
          {t('pro.sectionTitle')}
        </h2>
        <span className="text-caption font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          {okrs.length}
        </span>
      </div>
      <p className="text-sm mb-4 text-[rgb(var(--color-text-secondary))]">
        {t('pro.sectionSubtitle', { org: orgList })}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {okrs.map((okr) => {
          const pct = Math.round(okrProgress(okr) * 100);
          return (
            <button
              key={okr.id}
              type="button"
              onClick={() => { onSelectOrg(okr.orgId); navigate(buildOrgLink('okr', { okr: okr.id })); }}
              aria-label={`${okr.title}, ${t('pro.openInOrg')}`}
              className="group text-left rounded-xl border border-indigo-200 dark:border-indigo-500/30 border-l-4 border-l-indigo-500 bg-indigo-50/40 dark:bg-indigo-500/5 p-4 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 text-caption font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-600 text-white mb-1.5">
                    <Briefcase size={11} aria-hidden="true" />
                    {t('pro.badge')} · {orgNames[okr.orgId]}
                  </span>
                  <h3 className="font-semibold text-[rgb(var(--color-text-primary))] truncate">{okr.title}</h3>
                </div>
                <ArrowUpRight size={18} className="shrink-0 text-indigo-500 opacity-60 group-hover:opacity-100" aria-hidden="true" />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">{pct}%</span>
              </div>

              <ul className="space-y-1.5">
                {okr.keyResults.map((kr) => {
                  const mine = isMyTeamKR(kr, userId);
                  return (
                    <li key={kr.id} className={`flex items-center gap-2 text-sm ${mine ? '' : 'opacity-60'}`}>
                      <span className="flex-1 min-w-0 truncate text-[rgb(var(--color-text-primary))]">{kr.title}</span>
                      {mine && (
                        <span className="text-caption font-semibold px-1.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {t('pro.you')}
                        </span>
                      )}
                      <span className="tabular-nums text-[rgb(var(--color-text-secondary))]">
                        {Math.round(krProgress(kr) * 100)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ProOKRSection;
