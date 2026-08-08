import { useT } from '@/i18n/useT';

interface OrgConsentNoticeProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Consentement RGPD à l'adhésion à une entreprise — affiché dans TOUS les
 * flux d'entrée (code, lien d'invitation). Résume ce que l'organisation
 * verra ; la case doit être cochée pour continuer.
 */
const OrgConsentNotice = ({ checked, onChange }: OrgConsentNoticeProps) => {
  const { t } = useT('org');
  return (
  <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] p-4 space-y-2.5">
    <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))]">
      {t('common.consentIntro')}
    </p>
    <ul className="text-xs text-[rgb(var(--color-text-secondary))] space-y-1.5 list-disc pl-4">
      <li>{t('consent.visibility')}</li>
      <li>{t('consent.agendaBefore')}<strong>{t('consent.agendaBold')}</strong>{t('consent.agendaMiddle')}<strong>{t('consent.agendaPrivate')}</strong>{t('consent.agendaAfter')}</li>
      <li>{t('consent.personalSafe')}</li>
    </ul>
    <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--color-border))] accent-[rgb(var(--color-accent))]"
      />
      <span className="text-xs text-[rgb(var(--color-text-primary))]">
        {t('common.consentAccept')}
      </span>
    </label>
  </div>
  );
};

export default OrgConsentNotice;
