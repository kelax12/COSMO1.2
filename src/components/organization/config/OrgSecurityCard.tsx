import { useState } from 'react';
import { CheckCircle2, Clock, Copy, ShieldCheck, Trash2 } from 'lucide-react';
import {
  useOrgDomains, useAddOrgDomain, useRemoveOrgDomain, useVerifyOrgDomain, useOrgSettings, useSaveOrgSettings,
} from '@/modules/org-config';
import { useT } from '@/i18n/useT';
import { toast } from '@/lib/toast';
import { CARD, TITLE, HINT, FIELD, BUTTON, GHOST, ICON_BTN } from './config-ui';

interface Props {
  orgId: string;
}

/**
 * Rubrique Sécurité de Paramètres (audit du 2026-09-24, M13) : domaines de
 * l'entreprise, vérifiés par un enregistrement DNS TXT, et invitations
 * limitées à ces domaines (mig. 195, trigger sur `org_invite_links`).
 * Admins seulement : la RLS le garantit, l'écran n'est monté que pour eux.
 */
const OrgSecurityCard = ({ orgId }: Props) => {
  const { t } = useT('orgConfig');
  const { data: domains = [], isSuccess: domainsLoaded } = useOrgDomains(orgId);
  const { data: settings } = useOrgSettings(orgId);
  const add = useAddOrgDomain(orgId);
  const remove = useRemoveOrgDomain(orgId);
  const verify = useVerifyOrgDomain(orgId);
  const saveSettings = useSaveOrgSettings(orgId);
  const [draft, setDraft] = useState('');
  const [missing, setMissing] = useState<string | null>(null);
  const anyVerified = domains.some((d) => d.verifiedAt);

  const submit = () => {
    const domain = draft.trim().toLowerCase();
    if (!domain) return;
    add.mutate(domain, { onSuccess: () => setDraft('') });
  };
  const runVerify = (id: string) =>
    verify.mutate(id, { onSuccess: ({ verified }) => setMissing(verified ? null : id) });
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => toast.success(text), () => undefined);
  };

  return (
    <section className={CARD} aria-labelledby="org-security-title">
      <h2 id="org-security-title" className={`${TITLE} inline-flex items-center gap-1.5`}>
        <ShieldCheck size={15} aria-hidden="true" /> {t('security.title')}
      </h2>
      <p className={HINT}>{t('security.hint')}</p>

      <h3 className="mt-4 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">{t('security.domains')}</h3>
      <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input
          className={`${FIELD} flex-1 min-w-0`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('security.domainPlaceholder')}
          aria-label={t('security.domains')}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className={BUTTON} disabled={!draft.trim() || add.isPending}>{t('security.addDomain')}</button>
      </form>

      {!domainsLoaded ? null : domains.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-3">{t('security.noDomain')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {domains.map((d) => {
            const txtName = `_cosmo-verify.${d.domain}`;
            const txtValue = `cosmo-verify=${d.verificationToken}`;
            return (
              <li key={d.id} className="rounded-xl border border-[rgb(var(--color-border))] p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-[rgb(var(--color-text-primary))] flex-1 min-w-0 truncate">{d.domain}</span>
                  {d.verifiedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={13} aria-hidden="true" /> {t('security.verified')}
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <Clock size={13} aria-hidden="true" /> {t('security.pending')}
                      </span>
                      <button type="button" className={GHOST} disabled={verify.isPending} onClick={() => runVerify(d.id)}>
                        {verify.isPending && verify.variables === d.id ? t('security.verifying') : t('security.verify')}
                      </button>
                    </>
                  )}
                  <button type="button" className={ICON_BTN} aria-label={t('security.remove', { domain: d.domain })}
                    onClick={() => remove.mutate(d.id)} disabled={remove.isPending}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                {!d.verifiedAt && (
                  <div className="mt-2 text-xs text-[rgb(var(--color-text-secondary))] space-y-1">
                    <p>{t('security.dnsHelp')}</p>
                    {[[t('security.dnsName'), txtName], [t('security.dnsValue'), txtValue]].map(([label, value]) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-[rgb(var(--color-text-muted))]">{label}</span>
                        <code className="flex-1 min-w-0 truncate rounded bg-[rgb(var(--color-hover))] px-1.5 py-0.5">{value}</code>
                        <button type="button" className={ICON_BTN} aria-label={`${label} : ${value}`} onClick={() => copy(value)}>
                          <Copy size={13} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    {missing === d.id && <p className="text-amber-600 dark:text-amber-400" role="status">{t('security.notFoundYet')}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <label className="mt-4 flex items-start gap-2 text-sm text-[rgb(var(--color-text-primary))]">
        <input
          type="checkbox"
          className="mt-0.5 w-4 h-4 accent-[rgb(var(--color-accent))]"
          checked={!!settings?.inviteDomainOnly}
          // Activer sans domaine vérifié fermerait TOUTE invitation par e-mail.
          disabled={saveSettings.isPending || (!anyVerified && !settings?.inviteDomainOnly)}
          onChange={(e) => saveSettings.mutate({ inviteDomainOnly: e.target.checked })}
        />
        <span>
          {t('security.inviteDomainOnly')}
          <span className={`block ${HINT}`}>{anyVerified ? t('security.inviteDomainOnlyHint') : t('security.needVerified')}</span>
        </span>
      </label>
      <p className={`${HINT} mt-3`}>{t('security.sessions')}</p>
    </section>
  );
};

export default OrgSecurityCard;
