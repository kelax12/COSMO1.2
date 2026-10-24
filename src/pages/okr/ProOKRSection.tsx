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
 * droits. Maquette 185 (2026-10-10) : plus d'indigo, un seul accent dans l'app ;
 * l'icône mallette et le nom de l'organisation les
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
        <Briefcase size={18} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
        <h2 id="pro-okr-heading" className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
          {t('pro.sectionTitle')}
        </h2>
        <span className="text-label text-[rgb(var(--color-text-muted))]">
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
              className="group text-left rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 text-label mb-1 text-[rgb(var(--color-text-muted))]">
                    <Briefcase size={11} aria-hidden="true" />
                    {orgNames[okr.orgId]}
                  </span>
                  <h3 className="font-semibold text-[rgb(var(--color-text-primary))] truncate">{okr.title}</h3>
                </div>
                <ArrowUpRight size={18} className="shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                {/* Nom tiré du contenu, complété ici : un aria-label qui omettait le
                    texte visible (organisation, progression) échouait axe-core 4.14. */}
                <span className="sr-only">{t('pro.openInOrg')}</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-1.5 rounded-full bg-[rgb(var(--color-border-muted))] overflow-hidden">
                  <div className="h-full bg-[rgb(var(--color-accent-solid))]" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] tabular-nums">{pct} %</span>
              </div>

              <ul className="space-y-1.5">
                {okr.keyResults.map((kr) => {
                  const mine = isMyTeamKR(kr, userId);
                  return (
                    <li key={kr.id} className="flex items-center gap-2 text-sm">
                      {/* AM-5 : un `opacity-60` effaçait la ligne d'un autre membre à 2,87:1.
                          L'écart se dit par la teinte du titre, jamais par l'opacité. */}
                      <span className={`flex-1 min-w-0 truncate ${mine ? 'text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'}`}>{kr.title}</span>
                      {mine && (
                        <span className="text-label text-[rgb(var(--color-text-muted))]">
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
