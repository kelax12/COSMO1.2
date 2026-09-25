import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ORG_NOTIFICATION_KINDS, type OrgNotificationKind } from '@/modules/organizations/notifications';
import {
  useNotificationSettings,
  useSaveNotificationSettings,
} from '@/modules/organizations/governance.hooks';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '@/modules/organizations/governance.types';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface OrgNotificationSettingsDialogProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Libellé court par type, pour la grille des préférences. */
const KIND_LABEL: Record<OrgNotificationKind, KeyOf<'org'>> = {
  task_assigned: 'notifSettings.kind.task_assigned',
  mention: 'notifSettings.kind.mention',
  comment: 'notifSettings.kind.comment',
  status_changed: 'notifSettings.kind.status_changed',
  unblocked: 'notifSettings.kind.unblocked',
  task_overdue: 'notifSettings.kind.task_overdue',
  project_at_risk: 'notifSettings.kind.project_at_risk',
  project_archived: 'notifSettings.kind.project_archived',
  kr_due: 'notifSettings.kind.kr_due',
  event_scheduled: 'notifSettings.kind.event_scheduled',
  role_changed: 'notifSettings.kind.role_changed',
};

const toggle = (list: OrgNotificationKind[], kind: OrgNotificationKind, on: boolean) =>
  on ? [...new Set([...list, kind])] : list.filter((k) => k !== kind);

/**
 * Préférences de notification, PAR ORGANISATION (mig. 162, M14).
 *
 * La table et le déclencheur qui écarte un type coupé existaient en
 * production ; aucun écran ne les réglait. Un type décoché « Dans l'app »
 * n'est plus CRÉÉ pour moi (`drop_muted_org_notification`), il n'est pas
 * simplement masqué. « Retrait de l'entreprise » ne figure pas ici : il ne se
 * coupe jamais, c'est la seule trace qu'un ex-membre reçoit.
 */
const OrgNotificationSettingsDialog = ({ orgId, open, onOpenChange }: OrgNotificationSettingsDialogProps) => {
  const { t } = useT('org');
  const { data } = useNotificationSettings(open ? orgId : undefined);
  const save = useSaveNotificationSettings(orgId);
  const [draft, setDraft] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Le brouillon repart de la valeur serveur à chaque ouverture.
  useEffect(() => {
    if (open) setDraft(data ?? DEFAULT_NOTIFICATION_SETTINGS);
  }, [open, data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('notifSettings.title')}</DialogTitle>
          <DialogDescription>{t('notifSettings.description')}</DialogDescription>
        </DialogHeader>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-caption text-[rgb(var(--color-text-muted))]">
              <th scope="col" className="text-left font-semibold pb-2">{t('notifSettings.colType')}</th>
              <th scope="col" className="font-semibold pb-2 w-20">{t('notifSettings.colApp')}</th>
              <th scope="col" className="font-semibold pb-2 w-20">{t('notifSettings.colEmail')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--color-border))]">
            {ORG_NOTIFICATION_KINDS.map((kind) => {
              const inApp = !draft.mutedKinds.includes(kind);
              const byEmail = draft.emailKinds.includes(kind);
              const label = t(KIND_LABEL[kind]);
              return (
                <tr key={kind}>
                  <th scope="row" className="text-left font-normal py-2 pr-2 text-[rgb(var(--color-text-primary))]">{label}</th>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={inApp}
                      aria-label={t('notifSettings.appFor', { type: label })}
                      onChange={(e) => setDraft((d) => ({
                        ...d,
                        mutedKinds: toggle(d.mutedKinds, kind, !e.target.checked),
                        // Un type coupé ne part pas non plus par e-mail : il n'existe plus.
                        emailKinds: e.target.checked ? d.emailKinds : d.emailKinds.filter((k) => k !== kind),
                      }))}
                      className="w-4 h-4 accent-[rgb(var(--color-accent))]"
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={byEmail}
                      disabled={!inApp}
                      aria-label={t('notifSettings.emailFor', { type: label })}
                      onChange={(e) => setDraft((d) => ({ ...d, emailKinds: toggle(d.emailKinds, kind, e.target.checked) }))}
                      className="w-4 h-4 accent-[rgb(var(--color-accent))] disabled:opacity-40"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-[rgb(var(--color-border))] p-3">
          <span className="text-sm">
            <span className="block font-semibold text-[rgb(var(--color-text-primary))]">{t('notifSettings.digest')}</span>
            <span className="block text-xs text-[rgb(var(--color-text-muted))]">{t('notifSettings.digestHint')}</span>
          </span>
          <input
            type="checkbox"
            checked={draft.digest === 'daily'}
            onChange={(e) => setDraft((d) => ({ ...d, digest: e.target.checked ? 'daily' : 'off' }))}
            className="w-4 h-4 accent-[rgb(var(--color-accent))]"
          />
        </label>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 min-h-11 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(draft, { onSuccess: () => onOpenChange(false) })}
            className="px-4 min-h-11 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrgNotificationSettingsDialog;
