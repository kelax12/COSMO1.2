import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Check, ChevronDown, Clock, Plus, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ROLE_DURATIONS,
  activeAssignmentsOf,
  computeEndsAt,
  useAssignOrgRole,
  useOrgRoleAssignments,
  useOrgRoles,
  useRevokeOrgRole,
  useSaveOrgRole,
  type OrgMember,
  type RoleDuration,
  type SaveCustomRoleInput,
} from '@/modules/organizations';
import { DatePicker } from '@/components/ui/date-picker';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import MemberAvatar from './MemberAvatar';
import RoleEditorSheet from './RoleEditorSheet';

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
  const { data: roles = [], isLoading: loadingRoles } = useOrgRoles(orgId);
  const { data: assignments = [], isLoading: loadingAssignments } = useOrgRoleAssignments(orgId);
  // Ni « aucun rôle actuel » ni « aucun rôle créé » avant la réponse (C-40) :
  // un squelette tant que l'une des deux lectures n'est pas revenue.
  const loading = loadingRoles || loadingAssignments;
  const assign = useAssignOrgRole();
  const revoke = useRevokeOrgRole();

  const now = new Date();
  const current = activeAssignmentsOf(assignments, member.userId, now);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const saveRole = useSaveOrgRole();
  const [creating, setCreating] = useState(false);
  // Le dépôt ne rend pas l'id créé : le rôle neuf se retrouve par son nom au
  // retour de la liste, puis devient le rôle choisi.
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string>(() => roles[0]?.id ?? '');
  const createdId = createdName ? roles.find((r) => r.name === createdName)?.id : undefined;
  const selectedRoleId = createdId || roleId || roles[0]?.id || '';
  const selectedRole = roleById.get(selectedRoleId);
  const pickRole = (id: string) => { setRoleId(id); setCreatedName(null); };
  const createRole = (input: SaveCustomRoleInput) => {
    saveRole.mutate({ orgId, input }, {
      onSuccess: () => { setCreatedName(input.name); setCreating(false); },
    });
  };
  const [duration, setDuration] = useState<RoleDuration>('month');
  const [until, setUntil] = useState('');
  const [dateError, setDateError] = useState(false);

  const endsAt = computeEndsAt(duration, now, until);
  const extending = current.some((a) => a.roleId === selectedRoleId);
  const pending = assign.isPending || revoke.isPending || saveRole.isPending;
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
      // L'éditeur de rôle est un enfant React : son voile remonte jusqu'ici.
      onClick={() => { if (!pending && !creating) onClose(); }}
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

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-4" aria-busy={loading}>
          {loading ? (
            <div className="space-y-3" aria-hidden="true">
              <div className="h-3 w-1/3 rounded bg-[rgb(var(--color-hover))] motion-safe:animate-pulse" />
              <div className="h-12 rounded-xl bg-[rgb(var(--color-hover))] motion-safe:animate-pulse" />
              <div className="h-10 rounded-xl bg-[rgb(var(--color-hover))] motion-safe:animate-pulse" />
            </div>
          ) : (
            <>
              <section data-guide-id="assign-role-stack">
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
                <div className="rounded-xl border border-dashed border-[rgb(var(--color-border))] px-4 py-4 text-center">
                  <p className="text-sm text-[rgb(var(--color-text-secondary))]">{ta('customRoles.assign.noRoles')}</p>
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    disabled={pending}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 min-h-9 rounded-lg text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Plus size={15} aria-hidden="true" /> {ta('customRoles.assign.createRole')}
                  </button>
                </div>
              ) : (
                <>
                  <div data-guide-id="assign-role-select">
                    <p id="assign-role-select-label" className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">
                      {ta('customRoles.assign.roleLabel')}
                    </p>
                    {/* Le menu COSMO des autres listes entreprise (MenuSelect), avec
                        la pastille du rôle et une sortie « Créer un rôle ». */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild disabled={pending}>
                        <button
                          type="button"
                          id="assign-role-select"
                          aria-labelledby="assign-role-select-label assign-role-select"
                          className="w-full h-11 px-3 inline-flex items-center gap-2.5 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-left text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60 data-[state=open]:border-[rgb(var(--color-accent))]"
                        >
                          {selectedRole && (
                            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedRole.color }} />
                          )}
                          <span className="flex-1 min-w-0 truncate font-medium">{selectedRole?.name}</span>
                          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      {/* z-[10000] : au-dessus de la modale (z-[9999]), comme MenuSelect. */}
                      <DropdownMenuContent
                        align="start"
                        className="z-[10000] min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 rounded-xl p-1.5 shadow-lg"
                      >
                        {roles.map((r) => {
                          const on = r.id === selectedRoleId;
                          const held = current.some((a) => a.roleId === r.id);
                          return (
                            <DropdownMenuItem
                              key={r.id}
                              onSelect={() => pickRole(r.id)}
                              className={`rounded-lg px-2.5 py-2 text-sm cursor-pointer gap-2.5 ${on ? 'font-semibold' : ''}`}
                            >
                              <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                              <span className="flex-1 truncate">{r.name}</span>
                              {held && <span className="text-xs font-normal text-[rgb(var(--color-text-muted))]">{ta('customRoles.assign.held')}</span>}
                              {on && <Check className="size-4 text-[rgb(var(--color-accent))]" aria-hidden="true" />}
                            </DropdownMenuItem>
                          );
                        })}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setCreating(true)}
                          className="rounded-lg px-2.5 py-2 text-sm cursor-pointer gap-2.5 font-semibold text-[rgb(var(--color-accent))]"
                        >
                          <Plus className="size-4 shrink-0" aria-hidden="true" />
                          {ta('customRoles.assign.createRole')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div role="radiogroup" aria-labelledby="assign-role-duration" data-guide-id="assign-role-until">
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

                  <p data-guide-id="assign-role-until-hint" className="flex items-start gap-2 rounded-xl bg-[rgb(var(--color-hover))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]" role="status">
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
          {!loading && roles.length > 0 && (
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
      {creating && (
        <RoleEditorSheet
          initial={null}
          editing={false}
          pending={saveRole.isPending}
          onSave={createRole}
          onClose={() => setCreating(false)}
        />
      )}
    </div>,
    document.body,
  );
};

export default AssignRoleDialog;
