import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  isManagerOf,
  useMyOrgPermissions,
  useOrgMemberPermissions,
  useSetMemberPermissions,
  type OrgMember,
} from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import MemberPermissionsSheet from './MemberPermissionsSheet';
import { filterMembersByQuery } from './member-search.helpers';
import { useT } from '@/i18n/useT';

interface OrgSettingsPermissionsProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
}

/** Nombre de droits décidés explicitement sur ce membre (NULL = suit le défaut). */
const countOverrides = (row: { overrides?: Record<string, boolean | null | undefined>; assignTargets?: unknown } | undefined): number => {
  if (!row) return 0;
  const explicit = Object.values(row.overrides ?? {}).filter((v) => v !== null && v !== undefined).length;
  return explicit + (row.assignTargets ? 1 : 0);
};

/**
 * Paramètres → Rôles et permissions (M13).
 *
 * Répond à la question qu'aucun écran ne posait : QUI a des droits différents
 * de son rôle ? L'annuaire ne le montrait qu'en ouvrant une fiche à la fois.
 * Les droits eux-mêmes se règlent dans la même feuille que depuis l'annuaire.
 */
const OrgSettingsPermissions = ({ orgId, members, currentUserId, isAdmin }: OrgSettingsPermissionsProps) => {
  const { t, tp } = useT('org');
  const myPermissions = useMyOrgPermissions(orgId);
  const { data: overrides = [], isLoading } = useOrgMemberPermissions(orgId);
  const setPermissions = useSetMemberPermissions();
  const [query, setQuery] = useState('');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [editing, setEditing] = useState<OrgMember | null>(null);

  const overrideByUser = useMemo(() => new Map(overrides.map((o) => [o.userId, o])), [overrides]);
  const rows = useMemo(() => {
    const found = filterMembersByQuery(members, query);
    return onlyCustom ? found.filter((m) => countOverrides(overrideByUser.get(m.userId)) > 0) : found;
  }, [members, query, onlyCustom, overrideByUser]);

  const roleLabel = (m: OrgMember) =>
    m.role === 'admin' ? t('roles.admin') : isManagerOf(members, m.userId) ? t('roles.manager') : t('roles.member');

  return (
    <div className="space-y-3">
      <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('settings.permissionsIntro')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('lifecycle.searchPerson')}
          aria-label={t('settings.permissionsSearch')}
          className="flex-1 min-w-[180px] h-9 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 text-sm text-[rgb(var(--color-text-primary))]"
        />
        <button
          type="button"
          aria-pressed={onlyCustom}
          onClick={() => setOnlyCustom((v) => !v)}
          className={`h-9 px-3 rounded-lg border text-sm font-medium ${
            onlyCustom
              ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
              : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
          }`}
        >
          {t('settings.permissionsOnlyCustom')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('settings.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('settings.permissionsEmpty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))] rounded-2xl border border-[rgb(var(--color-border))]">
          {rows.map((m) => {
            const custom = countOverrides(overrideByUser.get(m.userId));
            const editable = m.role !== 'admin' && m.userId !== currentUserId;
            return (
              <li key={m.userId}>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setEditing(m)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[rgb(var(--color-hover))] disabled:hover:bg-transparent disabled:cursor-default"
                >
                  <MemberAvatar avatar={m.avatar} name={m.displayName} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">{m.displayName}</span>
                    <span className="block text-xs text-[rgb(var(--color-text-muted))]">
                      {roleLabel(m)}
                      {m.role === 'admin' ? ` · ${t('settings.permissionsAdminAll')}` : custom > 0 ? ` · ${tp('settings.permissionsCustom', custom)}` : ` · ${t('settings.permissionsDefault')}`}
                    </span>
                  </span>
                  {editable && <ChevronRight size={16} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <MemberPermissionsSheet
          member={editing}
          members={members}
          current={overrideByUser.get(editing.userId) ?? null}
          actorPermissions={myPermissions.can}
          actorIsAdmin={isAdmin}
          actorAssignTargets={myPermissions.assignTargets}
          pending={setPermissions.isPending}
          onSave={(input) =>
            setPermissions.mutate({ orgId, userId: editing.userId, input }, { onSuccess: () => setEditing(null) })
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default OrgSettingsPermissions;
