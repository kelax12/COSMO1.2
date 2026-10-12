import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Clock, X } from 'lucide-react';
import {
  ROLE_DURATIONS,
  activeAssignmentsOf,
  computeEndsAt,
  useAssignOrgRole,
  useOrgRoleAssignments,
  useOrgRoles,
  useRevokeOrgRole,
  type OrgMember,
  type RoleDuration,
} from '@/modules/organizations';
import { DatePicker } from '@/components/ui/date-picker';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import MemberAvatar from './MemberAvatar';

interface AssignRoleDialogProps {
  orgId: string;
  member: OrgMember;
  onClose: () => void;
}

const DATE_FORMAT = 'd MMM yyyy';

/**
 * Attribuer un rôle à un membre (mig. 219, maquette 3 validée le 2026-10-12).
 *
 * Porte aussi ses rôles ACTUELS (retirer), et la prolongation : réattribuer un
 * rôle déjà détenu remplace sa date de fin (une ligne par rôle et par membre).
 * Jamais ouvert sur un admin : le menu ne le propose pas, la base le refuse.
 */
const AssignRoleDialog = ({ orgId, member, onClose }: AssignRoleDialogProps) => {
  const { t } = useT('org');
  const { t: ta } = useT('orgAdmin');
  const { data: roles = [] } = useOrgRoles(orgId);
  const { data: assignments = [] } = useOrgRoleAssignments(orgId);
  const assign = useAssignOrgRole();
  const revoke = useRevokeOrgRole();

  const now = new Date();
  const current = activeAssignmentsOf(assignments, member.userId, now);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const [roleId, setRoleId] = useState<string>(() => roles[0]?.id ?? '');
  const selectedRoleId = roleId || roles[0]?.id || '';
  const [duration, setDuration] = useState<RoleDuration>('month');
  const [until, setUntil] = useState('');
  const [dateError, setDateError] = useState(false);

  const endsAt = computeEndsAt(duration, now, until);
  const extending = current.some((a) => a.roleId === selectedRoleId);
  const pending = assign.isPending || revoke.isPending;
  const fmt = (iso: string) => format(new Date(iso), DATE_FORMAT, { locale: getDateLocale() });

  const submit = () => {
    if (pending || !selectedRoleId) return;
    if (endsAt === undefined) {
      setDateError(true);
      return;
    }
    assign.mutate({ orgId, roleId: selectedRoleId, userId: member.userId, endsAt }, { onSuccess: onClose });
  };

  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!pending) onClose(); },
    label: ta('customRoles.assign.title', { name: member.displayName }),
  });

  const chip = (active: boolean) =>
    `px-3 min-h-9 rounded-lg text-sm border transition-colors disabled:opacity-50 ${
      active
        ? 'bg-[rgb(var(--color-accent))]/10 border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))] font-semibold'
        : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
    }`;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={() => { if (!pending) onClose(); }}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] w-full sm:max-w-md max-h-[90vh] shadow-2xl flex flex-col rounded-t-[24px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        {...dialogProps}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <MemberAvatar avatar={member.avatar} name={member.displayName} size={36} />
            <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] min-w-0">
              {ta('customRoles.assign.title', { name: member.displayName })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-4">
          <section>
            <h3 className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">{ta('customRoles.assign.current')}</h3>
            {current.length === 0 ? (
              <p className="text-xs text-[rgb(var(--color-text-muted))]">{ta('customRoles.assign.none')}</p>
            ) : (
              <ul className="divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
                {current.map((a) => {
                  const role = roleById.get(a.roleId);
                  if (!role) return null;
                  return (
                    <li key={a.id} className="flex items-center gap-2.5 px-3 py-2">
                      <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">{role.name}</span>
                        <span className="block text-xs text-[rgb(var(--color-text-muted))]">
                          {a.endsAt ? ta('customRoles.assign.endsOn', { date: fmt(a.endsAt) }) : ta('customRoles.assign.unlimited')}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => revoke.mutate(a.id)}
                        disabled={pending}
                        aria-label={ta('customRoles.assign.revoke', { name: role.name })}
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {roles.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">{ta('customRoles.assign.noRoles')}</p>
          ) : (
            <>
              <div>
                <label htmlFor="assign-role-select" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">
                  {ta('customRoles.assign.roleLabel')}
                </label>
                <select
                  id="assign-role-select"
                  value={selectedRoleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  disabled={pending}
                  className="w-full h-10 px-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))]"
                >
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div role="radiogroup" aria-labelledby="assign-role-duration">
                <p id="assign-role-duration" className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">
                  {ta('customRoles.assign.durationLabel')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ROLE_DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={duration === d}
                      disabled={pending}
                      onClick={() => { setDuration(d); setDateError(false); }}
                      className={chip(duration === d)}
                    >
                      {ta(`customRoles.assign.duration.${d}`)}
                    </button>
                  ))}
                </div>
                {duration === 'until' && (
                  <div className="mt-2">
                    <DatePicker
                      value={until}
                      onChange={(v) => { setUntil(v); setDateError(false); }}
                      allowClear={false}
                      minDate={format(now, 'yyyy-MM-dd')}
                      placeholder={ta('customRoles.assign.pickDate')}
                      popoverClassName="z-[10001]"
                    />
                  </div>
                )}
                {dateError && (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{ta('customRoles.assign.dateRequired')}</p>
                )}
              </div>

              <p className="flex items-start gap-2 rounded-xl bg-[rgb(var(--color-hover))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]" role="status">
                <Clock size={15} aria-hidden="true" className="shrink-0 mt-0.5 text-[rgb(var(--color-text-muted))]" />
                <span>
                  {endsAt === null
                    ? ta('customRoles.assign.summaryUnlimited', { from: fmt(now.toISOString()) })
                    : endsAt
                      ? ta('customRoles.assign.summary', { from: fmt(now.toISOString()), to: fmt(endsAt), name: member.displayName })
                      : ta('customRoles.assign.dateRequired')}
                  {extending && <span className="block mt-1 text-xs text-[rgb(var(--color-text-muted))]">{ta('customRoles.assign.extendNote', { name: member.displayName })}</span>}
                </span>
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[rgb(var(--color-border))] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 text-sm font-semibold rounded-xl text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
          >
            {ta('customRoles.assign.close')}
          </button>
          {roles.length > 0 && (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-[rgb(var(--color-accent-solid))] text-white hover:opacity-90 disabled:opacity-50"
            >
              {extending ? ta('customRoles.assign.submitExtend') : ta('customRoles.assign.submit')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AssignRoleDialog;
