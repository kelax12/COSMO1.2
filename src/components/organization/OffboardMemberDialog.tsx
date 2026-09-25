import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import { useDepartureImpact, useOffboardMember } from '@/modules/organizations/governance.hooks';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import MemberSelectField from './MemberSelectField';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface OffboardMemberDialogProps {
  orgId: string;
  member: OrgMember;
  /** Membres de l'organisation, la personne qui part comprise. */
  members: OrgMember[];
  /**
   * `transfer` (mig. 164) : « Transmettre ses responsabilités » sans faire
   * partir la personne — changement de poste, reprise d'un projet, congé.
   */
  initialMode?: Mode;
  /**
   * Modes proposés. Sur SOI-MÊME, seulement `transfer` : `offboard_org_member`
   * ne refuse pas l'auto-suspension, et un admin qui se suspend se verrouille
   * dehors sans chemin de retour.
   */
  modes?: readonly Mode[];
  onClose: () => void;
}

type Mode = 'remove' | 'suspend' | 'transfer';

const ALL_MODES: readonly Mode[] = ['transfer', 'suspend', 'remove'];

const MODE_LABEL: Record<Mode, KeyOf<'orgAdmin'>> = {
  transfer: 'lifecycle.modeTransfer', suspend: 'lifecycle.modeSuspend', remove: 'lifecycle.modeRemove',
};
const MODE_HINT: Record<Mode, KeyOf<'orgAdmin'>> = {
  transfer: 'lifecycle.modeTransferHint', suspend: 'lifecycle.modeSuspendHint', remove: 'lifecycle.modeRemoveHint',
};
const MODE_SUBMIT: Record<Mode, KeyOf<'orgAdmin'>> = {
  transfer: 'lifecycle.offboardTransfer', suspend: 'lifecycle.offboardSuspend', remove: 'lifecycle.offboardRemove',
};

/**
 * Assistant de départ (mig. 161, M10).
 *
 * Le retrait était immédiat et ne transférait rien : les tâches gardaient un
 * assigné sans accès, les subordonnés devenaient « non placés », les rôles de
 * responsable et les KR restaient orphelins. Ici, l'écran dit AVANT le geste
 * ce qui sera touché (`member_departure_impact`), fait choisir à qui le
 * transmettre, puis retire ou suspend, en une seule transaction côté serveur.
 */
const OffboardMemberDialog = ({ orgId, member, members, initialMode = 'remove', modes = ALL_MODES, onClose }: OffboardMemberDialogProps) => {
  const { t } = useT('org');
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const { data: impact, isLoading } = useDepartureImpact(orgId, member.userId);
  const offboard = useOffboardMember();
  const [tasksTo, setTasksTo] = useState('');
  const [reportsTo, setReportsTo] = useState('');
  const [leadsTo, setLeadsTo] = useState('');
  const [krsTo, setKrsTo] = useState('');
  const [projectsTo, setProjectsTo] = useState('');
  const [mode, setMode] = useState<Mode>(initialMode);
  const transfer = mode === 'transfer';
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!offboard.isPending) onClose(); },
    label: ta(initialMode === 'transfer' ? 'lifecycle.transferTitle' : 'lifecycle.offboardTitle', { name: member.displayName }),
  });

  const others = members.filter((m) => m.userId !== member.userId);
  const manager = members.find((m) => m.userId === member.managerId);
  const nothingToHandOver = !!impact && impact.tasks + impact.reports + impact.leads + impact.projects + impact.krs === 0;

  const submit = () =>
    offboard.mutate(
      {
        orgId,
        userId: member.userId,
        tasksTo: tasksTo || null,
        reportsTo: reportsTo || null,
        leadsTo: leadsTo || null,
        krsTo: krsTo || null,
        projectsTo: projectsTo || null,
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
              {ta(initialMode === 'transfer' ? 'lifecycle.transferTitle' : 'lifecycle.offboardTitle', { name: member.displayName })}
            </h2>
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
              {ta(initialMode === 'transfer' ? 'lifecycle.transferIntro' : 'lifecycle.offboardIntro')}
            </p>
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
            {ta('lifecycle.impactTitle')}
          </h3>
          {isLoading || !impact ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">{ta('lifecycle.impactLoading')}</p>
          ) : nothingToHandOver ? (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">{ta('lifecycle.impactNone')}</p>
          ) : (
            <ul className="text-sm text-[rgb(var(--color-text-primary))] space-y-0.5">
              {impact.tasks > 0 && <li>{tpa('lifecycle.impactTasks', impact.tasks)}</li>}
              {impact.reports > 0 && <li>{tpa('lifecycle.impactReports', impact.reports)}</li>}
              {impact.leads > 0 && <li>{tpa('lifecycle.impactLeads', impact.leads)}</li>}
              {impact.projects > 0 && <li>{tpa('lifecycle.impactProjects', impact.projects)}</li>}
              {impact.krs > 0 && <li>{tpa('lifecycle.impactKrs', impact.krs)}</li>}
            </ul>
          )}
        </section>

        {impact && impact.tasks > 0 && (
          <MemberSelectField
            label={ta('lifecycle.tasksTo')}
            members={others}
            value={tasksTo}
            onChange={setTasksTo}
            emptyLabel={ta(transfer ? 'lifecycle.keepAsIs' : 'lifecycle.nobodyUnassign')}
          />
        )}
        {impact && impact.reports > 0 && (
          <MemberSelectField
            label={ta('lifecycle.reportsTo')}
            members={others}
            value={reportsTo}
            onChange={setReportsTo}
            emptyLabel={transfer
              ? ta('lifecycle.keepAsIs')
              : manager ? ta('lifecycle.theirManager', { name: manager.displayName }) : ta('lifecycle.unplaced')}
          />
        )}
        {impact && impact.leads > 0 && (
          <MemberSelectField
            label={ta('lifecycle.leadsTo')}
            members={others}
            value={leadsTo}
            onChange={setLeadsTo}
            emptyLabel={ta(transfer ? 'lifecycle.keepAsIs' : 'lifecycle.nobody')}
            hint={ta('lifecycle.leadsToHint')}
          />
        )}
        {impact && impact.projects > 0 && (
          <MemberSelectField
            label={ta('lifecycle.projectsTo')}
            members={others}
            value={projectsTo}
            onChange={setProjectsTo}
            emptyLabel={ta(transfer ? 'lifecycle.keepAsIs' : 'lifecycle.nobody')}
          />
        )}
        {impact && impact.krs > 0 && (
          <MemberSelectField
            label={ta('lifecycle.krsTo')}
            members={others}
            value={krsTo}
            onChange={setKrsTo}
            emptyLabel={ta(transfer ? 'lifecycle.keepAsIs' : 'lifecycle.nobody')}
          />
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{ta('lifecycle.modeLegend')}</legend>
          {modes.map((value) => (
            <label key={value} className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] cursor-pointer has-[:checked]:border-[rgb(var(--color-accent))]">
              <input type="radio" name="offboard-mode" checked={mode === value} onChange={() => setMode(value)} className="mt-1" />
              <span className="text-sm">
                <span className="block font-semibold text-[rgb(var(--color-text-primary))]">
                  {ta(MODE_LABEL[value])}
                </span>
                <span className="block text-xs text-[rgb(var(--color-text-muted))]">
                  {ta(MODE_HINT[value])}
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
              mode === 'remove' ? 'bg-red-600 hover:bg-red-700' : mode === 'suspend' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {offboard.isPending ? ta('lifecycle.offboardPending') : ta(MODE_SUBMIT[mode])}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OffboardMemberDialog;
