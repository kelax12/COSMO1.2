import { useMemo, useState } from 'react';
import { MoreHorizontal, Plus, ShieldCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  expiringSoonCount,
  holdersCount,
  isAssignmentActive,
  useDeleteOrgRole,
  useOrgRoleAssignments,
  useOrgRoles,
  useSaveOrgRole,
  type OrgCustomRole,
  type OrgMember,
  type SaveCustomRoleInput,
} from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import OrgConfirmDialog from './OrgConfirmDialog';
import RoleEditorSheet from './RoleEditorSheet';

interface OrgRolesSettingsProps {
  orgId: string;
  members: OrgMember[];
}

type EditorState = { roleId?: string; initial: SaveCustomRoleInput | null } | null;

const toInput = (role: OrgCustomRole): SaveCustomRoleInput => ({
  name: role.name,
  color: role.color,
  grantedKeys: [...role.grantedKeys],
  assignTargets: [...role.assignTargets],
});

/**
 * Paramètres › Rôles (mig. 219, maquette 1 validée le 2026-10-12).
 *
 * Liste des rôles de l'organisation : pastille, résumé, nombre de détenteurs
 * actifs, alerte si une attribution finit dans les 7 jours. Créer, modifier,
 * dupliquer, supprimer. La garde d'affichage (`isAdmin || can['role.manage']`)
 * est posée par `OrgSettingsSection` ; la vraie garde est la RLS.
 */
const OrgRolesSettings = ({ orgId, members }: OrgRolesSettingsProps) => {
  const { t: ta, tp } = useT('orgAdmin');
  const { data: roles = [], isLoading } = useOrgRoles(orgId);
  const { data: assignments = [] } = useOrgRoleAssignments(orgId);
  const saveRole = useSaveOrgRole();
  const deleteRole = useDeleteOrgRole();
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleting, setDeleting] = useState<OrgCustomRole | null>(null);

  // Jugé au rendu, comme côté serveur à chaque lecture.
  const now = new Date();
  const nameOf = useMemo(() => new Map(members.map((m) => [m.userId, m.displayName])), [members]);

  const summary = (role: OrgCustomRole) => {
    const count = tp('customRoles.permissionCount', role.grantedKeys.length);
    const scope = role.assignTargets.length === 0
      ? ta('customRoles.assignsNobody')
      : ta('customRoles.assignsTo', {
          targets: role.assignTargets.map((target) => ta(`permissions.target.${target}`)).join(', '),
        });
    return `${count} · ${scope}`;
  };

  const holdersOf = (roleId: string) =>
    assignments
      .filter((a) => a.roleId === roleId && isAssignmentActive(a, now))
      .map((a) => nameOf.get(a.userId) ?? '')
      .filter(Boolean);

  const submit = (input: SaveCustomRoleInput) => {
    if (!editor) return;
    saveRole.mutate({ orgId, roleId: editor.roleId, input }, { onSuccess: () => setEditor(null) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-[rgb(var(--color-text-secondary))] max-w-prose">{ta('customRoles.intro')}</p>
        <button
          type="button"
          onClick={() => setEditor({ initial: null })}
          className="inline-flex items-center gap-1.5 px-3 min-h-9 rounded-lg text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
        >
          <Plus size={15} aria-hidden="true" /> {ta('customRoles.create')}
        </button>
      </div>

      {!isLoading && roles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[rgb(var(--color-border))] p-5 text-center">
          <ShieldCheck size={22} aria-hidden="true" className="mx-auto text-[rgb(var(--color-text-muted))]" />
          <p className="mt-2 text-sm font-semibold text-[rgb(var(--color-text-primary))]">{ta('customRoles.emptyTitle')}</p>
          <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{ta('customRoles.emptyBody')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
          {roles.map((role) => {
            const holders = holdersCount(role.id, assignments, now);
            const soon = expiringSoonCount(role.id, assignments, now) > 0;
            return (
              <li key={role.id} className="flex items-center gap-3 px-3 py-3">
                <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                <button
                  type="button"
                  onClick={() => setEditor({ roleId: role.id, initial: toInput(role) })}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">{role.name}</span>
                  <span className="block text-xs text-[rgb(var(--color-text-muted))] truncate">{summary(role)}</span>
                </button>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-md ${
                    soon
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]'
                  }`}
                >
                  {tp('customRoles.holders', holders)}{soon ? ` · ${ta('customRoles.expiringSoon')}` : ''}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={ta('customRoles.actionsFor', { name: role.name })}
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
                    >
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditor({ roleId: role.id, initial: toInput(role) })}>
                      {ta('customRoles.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setEditor({
                        initial: { ...toInput(role), name: ta('customRoles.copyName', { name: role.name }).slice(0, 40) },
                      })}
                    >
                      {ta('customRoles.duplicate')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDeleting(role)} className="text-red-600 dark:text-red-400">
                      {ta('customRoles.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      {editor && (
        <RoleEditorSheet
          initial={editor.initial}
          editing={!!editor.roleId}
          pending={saveRole.isPending}
          onSave={submit}
          onClose={() => setEditor(null)}
        />
      )}

      {deleting && (
        <OrgConfirmDialog
          title={ta('customRoles.deleteTitle', { name: deleting.name })}
          description={holdersOf(deleting.id).length === 0 ? ta('customRoles.deleteNobody') : ta('customRoles.deleteHolders')}
          impact={holdersOf(deleting.id)}
          confirmLabel={ta('customRoles.deleteConfirm')}
          pendingLabel={ta('customRoles.deleting')}
          pending={deleteRole.isPending}
          tone="danger"
          onConfirm={() => deleteRole.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
};

export default OrgRolesSettings;
