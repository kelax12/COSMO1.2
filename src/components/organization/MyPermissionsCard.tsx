import { useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import {
  ORG_PERMISSION_KEYS,
  effectiveAssignTargets,
  effectivePermissions,
  isManagerOf,
  useOrgMemberPermissions,
  type OrgMember,
  type OrgPermissionKey,
} from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface MyPermissionsCardProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
}

/**
 * « Mes droits » (audit du 2026-09-24, cas « permissions contradictoires »).
 *
 * La règle était claire — une surcharge l'emporte, sinon le défaut de la
 * position, et l'admin court-circuite — mais INVISIBLE pour la personne : elle
 * découvrait un droit en voyant un bouton manquer. Chaque ligne dit ici le droit
 * effectif ET d'où il vient.
 *
 * Même calcul que partout ailleurs (`effectivePermissions`, miroir du SQL) :
 * cette carte n'invente aucune règle.
 */
const MyPermissionsCard = ({ orgId, members, currentUserId }: MyPermissionsCardProps) => {
  const { t: ta } = useT('orgAdmin');
  const { data: overrides = [] } = useOrgMemberPermissions(orgId);
  const me = members.find((m) => m.userId === currentUserId);

  const rows = useMemo(() => {
    if (!me) return [];
    const mine = overrides.find((o) => o.userId === me.userId) ?? null;
    const effective = effectivePermissions({ member: me, members, overrides: mine });
    return ORG_PERMISSION_KEYS.map((key: OrgPermissionKey) => {
      const decided = mine?.overrides?.[key];
      const source: KeyOf<'orgAdmin'> = me.role === 'admin'
        ? 'myRights.sourceAdmin'
        : decided === true || decided === false
          ? 'myRights.sourceOverride'
          : isManagerOf(members, me.userId) ? 'myRights.sourceManager' : 'myRights.sourceMember';
      return { key, allowed: effective[key], source };
    });
  }, [me, members, overrides]);

  const targets = useMemo(() => {
    if (!me) return [];
    const mine = overrides.find((o) => o.userId === me.userId) ?? null;
    return effectiveAssignTargets({ member: me, overrides: mine });
  }, [me, overrides]);

  if (!me) return null;

  return (
    <div>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
        {ta(me.role === 'admin' ? 'myRights.adminHint' : 'myRights.hint')}
      </p>
      <ul className="divide-y divide-[rgb(var(--color-border))]">
        {rows.map(({ key, allowed, source }) => (
          <li key={key} className="flex items-center gap-2.5 py-2">
            {allowed ? (
              <Check size={15} className="text-emerald-500 shrink-0" aria-hidden="true" />
            ) : (
              <Minus size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
            )}
            <span className="flex-1 min-w-0 text-sm text-[rgb(var(--color-text-primary))]">
              {ta(`permissions.key.${key}` as KeyOf<'orgAdmin'>)}
              <span className="sr-only"> : {ta(allowed ? 'myRights.allowed' : 'myRights.denied')}</span>
            </span>
            <span className="text-caption text-[rgb(var(--color-text-muted))] shrink-0">{ta(source)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[rgb(var(--color-text-secondary))]">
        <span className="font-semibold">{ta('permissions.sectionAssign')}</span>{' '}
        {targets.length === 0
          ? ta('myRights.assignNobody')
          : targets.map((target) => ta(`permissions.target.${target}` as KeyOf<'orgAdmin'>)).join(' · ')}
      </p>
    </div>
  );
};

export default MyPermissionsCard;
