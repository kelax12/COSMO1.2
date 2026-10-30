import { useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import {
  ORG_PERMISSION_KEYS,
  useMyOrgPermissions,
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
 * La règle : l'admin court-circuite, puis un rôle actif, puis la fiche, sinon
 * le défaut de membre. Elle était INVISIBLE pour la personne : elle découvrait
 * un droit en voyant un bouton manquer. Chaque ligne dit ici le droit effectif
 * ET d'où il vient.
 *
 * Même calcul que partout ailleurs (`useMyOrgPermissions`, miroir du SQL) :
 * cette carte n'invente aucune règle.
 */
const MyPermissionsCard = ({ orgId, members, currentUserId }: MyPermissionsCardProps) => {
  const { t: ta } = useT('orgAdmin');
  const { data: overrides = [] } = useOrgMemberPermissions(orgId);
  // Droits résolus AVEC les rôles personnalisés : un rôle actif écrase la fiche
  // et le défaut (mig. 219), la carte le calculait sans eux.
  const { can, assignTargets: targets, activeRoles } = useMyOrgPermissions(orgId);
  const me = members.find((m) => m.userId === currentUserId);

  const rows = useMemo(() => {
    if (!me) return [];
    const mine = overrides.find((o) => o.userId === me.userId) ?? null;
    return ORG_PERMISSION_KEYS.map((key: OrgPermissionKey) => {
      const decided = mine?.overrides?.[key];
      const source: KeyOf<'orgAdmin'> = me.role === 'admin'
        ? 'myRights.sourceAdmin'
        : activeRoles.length > 0
          ? 'myRights.sourceRole'
          : decided === true || decided === false ? 'myRights.sourceOverride' : 'myRights.sourceMember';
      return { key, allowed: can[key], source };
    });
  }, [me, overrides, can, activeRoles]);

  if (!me) return null;

  return (
    <div>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
        {ta(me.role === 'admin' ? 'myRights.adminHint' : 'myRights.hint')}
      </p>
      <ul data-guide-id="my-permissions-card" className="divide-y divide-[rgb(var(--color-border))]">
        {rows.map(({ key, allowed, source }, i) => (
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
            <span data-guide-id={i === 0 ? 'my-permissions-source' : undefined} className="text-caption text-[rgb(var(--color-text-muted))] shrink-0">{ta(source)}</span>
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
