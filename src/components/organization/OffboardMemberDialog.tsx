import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import { useDepartureImpact, useOffboardMember } from '@/modules/organizations/governance.hooks';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import MemberSelectField from './MemberSelectField';
import { useT } from '@/i18n/useT';

interface OffboardMemberDialogProps {
  orgId: string;
  member: OrgMember;
  /** Membres de l'organisation, la personne qui part comprise. */
  members: OrgMember[];
  onClose: () => void;
}

type Mode = 'remove' | 'suspend';

/**
 * Assistant de départ (mig. 161, M10).
 *
 * Le retrait était immédiat et ne transférait rien : les tâches gardaient un
 * assigné sans accès, les subordonnés devenaient « non placés », les rôles de
 * responsable et les KR restaient orphelins. Ici, l'écran dit AVANT le geste
 * ce qui sera touché (`member_departure_impact`), fait choisir à qui le
 * transmettre, puis retire ou suspend, en une seule transaction côté serveur.
 */
const OffboardMemberDialog = ({ orgId, member, members, onClose }: OffboardMemberDialogProps) => {
  const { t, tp } = useT('org');
  const { data: impact, isLoading } = useDepartureImpact(orgId, member.userId);
  const offboard = useOffboardMember();
  const [tasksTo, setTasksTo] = useState('');
  const [reportsTo, setReportsTo] = useState('');
  const [leadsTo, setLeadsTo] = useState('');
  const [krsTo, setKrsTo] = useState('');
  const [mode, setMode] = useState<Mode>('remove');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!offboard.isPending) onClose(); },
    label: t('lifecycle.offboardTitle', { name: member.displayName }),
  });

  const others = members.filter((m) => m.userId !== member.userId);
  const manager = members.find((m) => m.userId === member.managerId);
  const nothingToHandOver = !!impact && impact.tasks + impact.reports + impact.leads + impact.krs === 0;

  const submit = () =>
    offboard.mutate(
      {
        orgId,
        userId: member.userId,
        tasksTo: tasksTo || null,
        reportsTo: reportsTo || null,
        leadsTo: leadsTo || null,
        krsTo: krsTo || null,
        mode,
      },
      { onSuccess: onClose },
    );

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={() => { if (!offboard.isPending) onClose(); }}
    >
      <div
        ref={ref}
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
              {t('lifecycle.offboardTitle', { name: member.displayName })}
            </h2>
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">{t('lifecycle.offboardIntro')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={offboard.isPending}
            aria-label={t('common.close')}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <section aria-labelledby="offboard-impact" className="rounded-xl bg-[rgb(var(--color-hover))] p-3">
          <h3 id="offboard-impact" className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
            {t('lifecycle.impactTitle')}
          </h3>
          {isLoading || !impact ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('lifecycle.impactLoading')}</p>
          ) : nothingToHandOver ? (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('lifecycle.impactNone')}</p>
          ) : (
            <ul className="text-sm text-[rgb(var(--color-text-primary))] space-y-0.5">
              {impact.tasks > 0 && <li>{tp('lifecycle.impactTasks', impact.tasks)}</li>}
              {impact.reports > 0 && <li>{tp('lifecycle.impactReports', impact.reports)}</li>}
              {impact.leads > 0 && <li>{tp('lifecycle.impactLeads', impact.leads)}</li>}
              {impact.krs > 0 && <li>{tp('lifecycle.impactKrs', impact.krs)}</li>}
            </ul>
          )}
        </section>

        {impact && impact.tasks > 0 && (
          <MemberSelectField
            label={t('lifecycle.tasksTo')}
            members={others}
            value={tasksTo}
            onChange={setTasksTo}
            emptyLabel={t('lifecycle.nobodyUnassign')}
          />
        )}
        {impact && impact.reports > 0 && (
          <MemberSelectField
            label={t('lifecycle.reportsTo')}
            members={others}
            value={reportsTo}
            onChange={setReportsTo}
            emptyLabel={manager ? t('lifecycle.theirManager', { name: manager.displayName }) : t('lifecycle.unplaced')}
          />
        )}
        {impact && impact.leads > 0 && (
          <MemberSelectField
            label={t('lifecycle.leadsTo')}
            members={others}
            value={leadsTo}
            onChange={setLeadsTo}
            emptyLabel={t('lifecycle.nobody')}
            hint={t('lifecycle.leadsToHint')}
          />
        )}
        {impact && impact.krs > 0 && (
          <MemberSelectField
            label={t('lifecycle.krsTo')}
            members={others}
            value={krsTo}
            onChange={setKrsTo}
            emptyLabel={t('lifecycle.nobody')}
          />
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{t('lifecycle.modeLegend')}</legend>
          {(['remove', 'suspend'] as const).map((value) => (
            <label key={value} className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] cursor-pointer has-[:checked]:border-[rgb(var(--color-accent))]">
              <input type="radio" name="offboard-mode" checked={mode === value} onChange={() => setMode(value)} className="mt-1" />
              <span className="text-sm">
                <span className="block font-semibold text-[rgb(var(--color-text-primary))]">
                  {value === 'remove' ? t('lifecycle.modeRemove') : t('lifecycle.modeSuspend')}
                </span>
                <span className="block text-xs text-[rgb(var(--color-text-muted))]">
                  {value === 'remove' ? t('lifecycle.modeRemoveHint') : t('lifecycle.modeSuspendHint')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={offboard.isPending}
            className="min-h-11 px-4 rounded-xl border border-[rgb(var(--color-border))] text-sm font-semibold text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={offboard.isPending || isLoading}
            className={`min-h-11 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
              mode === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {offboard.isPending
              ? t('lifecycle.offboardPending')
              : mode === 'remove' ? t('lifecycle.offboardRemove') : t('lifecycle.offboardSuspend')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OffboardMemberDialog;
