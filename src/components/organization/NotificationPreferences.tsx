import { useEffect, useState } from 'react';
import { ORG_NOTIFICATION_KINDS, type OrgNotificationKind } from '@/modules/organizations/notifications';
import { useNotificationSettings, useSaveNotificationSettings } from '@/modules/organizations/governance.hooks';
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from '@/modules/organizations/governance.types';
import type { KeyOf } from '@/i18n/catalog';
import { useT } from '@/i18n/useT';

interface NotificationPreferencesProps {
  orgId: string;
}

type Channel = 'off' | 'app' | 'email';

const KIND_LABEL: Record<OrgNotificationKind, KeyOf<'org'>> = {
  task_assigned: 'notifications.kindAssigned',
  mention: 'notifications.kindMention',
  task_overdue: 'notifications.kindOverdue',
  comment: 'notifications.kindComment',
  status_changed: 'notifications.kindStatusChanged',
  unblocked: 'notifications.kindUnblocked',
  project_at_risk: 'notifications.kindProjectAtRisk',
  kr_due: 'notifications.kindKrDue',
  event_scheduled: 'notifications.kindEventScheduled',
};

const channelOf = (s: NotificationSettings, kind: OrgNotificationKind): Channel =>
  s.mutedKinds.includes(kind) ? 'off' : s.emailKinds.includes(kind) ? 'email' : 'app';

const withChannel = (s: NotificationSettings, kind: OrgNotificationKind, channel: Channel): NotificationSettings => ({
  ...s,
  mutedKinds: channel === 'off' ? [...new Set([...s.mutedKinds, kind])] : s.mutedKinds.filter((k) => k !== kind),
  emailKinds: channel === 'email' ? [...new Set([...s.emailKinds, kind])] : s.emailKinds.filter((k) => k !== kind),
});

/**
 * Préférences de notification d'UN membre pour CETTE organisation (mig. 162,
 * M14) : par type, coupé, dans l'application, ou aussi par e-mail ; et un
 * résumé quotidien de ce qui reste non lu.
 *
 * Un type coupé n'est plus créé du tout (trigger `drop_muted_org_notification`),
 * sauf l'avis de retrait d'une organisation, qui ne se coupe jamais.
 */
const NotificationPreferences = ({ orgId }: NotificationPreferencesProps) => {
  const { t } = useT('org');
  const { data: saved, isLoading } = useNotificationSettings(orgId);
  const save = useSaveNotificationSettings(orgId);
  const [draft, setDraft] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  useEffect(() => { if (saved) setDraft(saved); }, [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? DEFAULT_NOTIFICATION_SETTINGS);

  if (isLoading) return <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('settings.loading')}</p>;

  const channels: Channel[] = ['off', 'app', 'email'];
  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('notifPrefs.intro')}</p>
      <div className="overflow-x-auto rounded-2xl border border-[rgb(var(--color-border))]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[rgb(var(--color-text-muted))]">
              <th className="px-3 py-2 font-semibold">{t('notifPrefs.kind')}</th>
              {channels.map((c) => <th key={c} className="px-2 py-2 font-semibold text-center">{t(`notifPrefs.channel_${c}` as KeyOf<'org'>)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--color-border))]">
            {ORG_NOTIFICATION_KINDS.map((kind) => {
              const current = channelOf(draft, kind);
              return (
                <tr key={kind}>
                  <th scope="row" className="px-3 py-2 font-normal text-left text-[rgb(var(--color-text-primary))]">{t(KIND_LABEL[kind])}</th>
                  {channels.map((c) => (
                    <td key={c} className="px-2 py-2 text-center">
                      <input
                        type="radio"
                        name={`notif-${kind}`}
                        checked={current === c}
                        onChange={() => setDraft((d) => withChannel(d, kind, c))}
                        aria-label={t('notifPrefs.cellAria', { kind: t(KIND_LABEL[kind]), channel: t(`notifPrefs.channel_${c}` as KeyOf<'org'>) })}
                        className="w-4 h-4"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[rgb(var(--color-border))] cursor-pointer">
        <input
          type="checkbox"
          checked={draft.digest === 'daily'}
          onChange={(e) => setDraft((d) => ({ ...d, digest: e.target.checked ? 'daily' : 'off' }))}
          className="mt-1"
        />
        <span className="text-sm">
          <span className="block font-semibold text-[rgb(var(--color-text-primary))]">{t('notifPrefs.digest')}</span>
          <span className="block text-xs text-[rgb(var(--color-text-muted))]">{t('notifPrefs.digestHint')}</span>
        </span>
      </label>

      <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('notifPrefs.emailNote')}</p>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(draft)}
          className="min-h-11 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-50"
        >
          {t('notifPrefs.save')}
        </button>
      </div>
    </div>
  );
};

export default NotificationPreferences;
