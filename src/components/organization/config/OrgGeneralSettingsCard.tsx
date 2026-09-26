import { useOrgSettings, useSaveOrgSettings, type OrgSettingsPatch } from '@/modules/org-config';
import { priorityLabelOf } from '../team-projects.helpers';
import { useT } from '@/i18n/useT';
import { toast } from '@/lib/toast';
import { CARD, TITLE, HINT, FIELD, LABEL } from './config-ui';

/** Fuseaux proposés : ceux des clients probables, puis celui du navigateur s'il manque. */
const TIMEZONES = [
  'Europe/Paris', 'Europe/Brussels', 'Europe/Zurich', 'Europe/Luxembourg', 'Europe/London', 'Europe/Madrid',
  'Europe/Berlin', 'America/Montreal', 'America/New_York', 'America/Los_Angeles', 'Africa/Casablanca',
  'Africa/Abidjan', 'Africa/Dakar', 'Indian/Reunion', 'America/Martinique', 'Pacific/Noumea', 'UTC',
];
const DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const GUEST_DAYS = [7, 14, 30, 60, 90, 180, 365];

interface Props {
  orgId: string;
  isAdmin: boolean;
}

/**
 * Réglages PROPRES à l'organisation (audit du 2026-09-24, « aucun réglage
 * propre à l'organisation ») : langue et fuseau des e-mails, semaine de
 * travail, valeurs proposées par défaut. Chaque changement s'enregistre seul :
 * un formulaire de six réglages indépendants n'a pas besoin d'un bouton.
 */
const OrgGeneralSettingsCard = ({ orgId, isAdmin }: Props) => {
  const { t, tp } = useT('orgConfig');
  const { data: settings } = useOrgSettings(orgId);
  const save = useSaveOrgSettings(orgId);
  if (!settings) return null;
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = [...new Set([settings.timezone, browserTz, ...TIMEZONES])];
  const disabled = !isAdmin || save.isPending;
  const set = (patch: OrgSettingsPatch) =>
    save.mutate(patch, { onSuccess: () => toast.success(t('general.saved')) });
  const dayLabel = (d: number) => t(`days.d${d}` as 'days.d0');
  const toggleDay = (d: number) => {
    const next = settings.workDays.includes(d) ? settings.workDays.filter((x) => x !== d) : [...settings.workDays, d];
    if (next.length > 0) set({ workDays: next });
  };

  return (
    <section className={CARD} aria-labelledby="org-general-title">
      <h2 id="org-general-title" className={TITLE}>{t('general.title')}</h2>
      <p className={HINT}>{isAdmin ? t('general.hint') : t('general.readOnly')}</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <label className={LABEL}>
          {t('general.locale')}
          <select className={FIELD} disabled={disabled} value={settings.locale}
            onChange={(e) => set({ locale: e.target.value as 'fr' | 'en' })}>
            <option value="fr">{t('general.localeFr')}</option>
            <option value="en">{t('general.localeEn')}</option>
          </select>
        </label>
        <label className={LABEL}>
          {t('general.timezone')}
          <select className={FIELD} disabled={disabled} value={settings.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        <label className={LABEL}>
          {t('general.weekStart')}
          <select className={FIELD} disabled={disabled} value={settings.weekStart} onChange={(e) => set({ weekStart: Number(e.target.value) })}>
            {DAYS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
          </select>
        </label>
        <fieldset className={LABEL}>
          <legend>{t('general.workDays')}</legend>
          <div className="flex flex-wrap gap-1 mt-1">
            {DAYS.map((d) => {
              const on = settings.workDays.includes(d);
              return (
                <button key={d} type="button" disabled={disabled} aria-pressed={on} onClick={() => toggleDay(d)}
                  className={`h-8 px-2 rounded-md text-xs font-semibold border transition-colors disabled:opacity-60 ${on
                    ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
                    : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))]'}`}>
                  {dayLabel(d)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className={LABEL}>
          {t('general.defaultPriority')}
          <select className={FIELD} disabled={disabled} value={settings.defaultTaskPriority}
            onChange={(e) => set({ defaultTaskPriority: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>{priorityLabelOf(p)}</option>)}
          </select>
        </label>
        <label className={LABEL}>
          {t('general.defaultAudience')}
          <select className={FIELD} disabled={disabled} value={settings.defaultProjectAudience}
            onChange={(e) => set({ defaultProjectAudience: e.target.value as 'org' | 'team' })}>
            <option value="team">{t('general.audienceTeam')}</option>
            <option value="org">{t('general.audienceOrg')}</option>
          </select>
        </label>
        <label className={LABEL}>
          {t('general.defaultGuestDays')}
          <select className={FIELD} disabled={disabled} value={settings.defaultGuestDays ?? ''}
            onChange={(e) => set({ defaultGuestDays: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{t('general.guestNoLimit')}</option>
            {GUEST_DAYS.map((d) => <option key={d} value={d}>{tp('general.guestDays', d)}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
};

export default OrgGeneralSettingsCard;
