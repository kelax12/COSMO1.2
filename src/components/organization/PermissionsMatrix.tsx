import { Check, Minus } from 'lucide-react';
import { ORG_PERMISSION_KEYS, effectivePermissions, type OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

type Position = 'admin' | 'manager' | 'member';
const POSITIONS: Position[] = ['admin', 'manager', 'member'];

// Défauts par POSITION, lus par `effectivePermissions` elle-même sur trois
// membres fictifs sans surcharge : la règle reste écrite à un seul endroit
// (`permissions.ts`), la matrice ne peut pas diverger du serveur.
const fake = (userId: string, role: OrgMember['role'], managerId: string | null = null): OrgMember =>
  ({ orgId: '', userId, role, joinedAt: '', displayName: '', managerId });
const SAMPLE: OrgMember[] = [fake('admin', 'admin'), fake('manager', 'member'), fake('report', 'member', 'manager'), fake('member', 'member')];
const DEFAULTS = Object.fromEntries(
  POSITIONS.map((p) => [p, effectivePermissions({ member: SAMPLE.find((m) => m.userId === p)!, members: SAMPLE })]),
) as Record<Position, ReturnType<typeof effectivePermissions>>;

/**
 * Matrice des droits PAR DÉFAUT, rôle par rôle (reco UI n° 42).
 *
 * Lecture seule, et c'est voulu : un droit ne se règle jamais pour un rôle
 * entier, seulement par personne (mig. 115, surcharge jamais remplacement).
 * La matrice dit d'où l'on part ; la liste en dessous dit qui s'en écarte.
 */
const PermissionsMatrix = () => {
  const { t } = useT('org');
  const { t: ta } = useT('orgAdmin');
  return (
    <details className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
      <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
        {ta('ui.matrix.title')}
      </summary>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full text-sm">
          <caption className="sr-only">{ta('ui.matrix.title')}</caption>
          <thead>
            <tr className="text-xs text-[rgb(var(--color-text-muted))]">
              <th scope="col" className="text-left font-semibold py-2 pr-3">{ta('ui.matrix.right')}</th>
              {POSITIONS.map((p) => (
                <th key={p} scope="col" className="font-semibold py-2 px-2 w-24 text-center">{t(`roles.${p}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--color-border))]">
            {ORG_PERMISSION_KEYS.map((key) => (
              <tr key={key}>
                <th scope="row" className="text-left font-normal py-2 pr-3 text-[rgb(var(--color-text-secondary))]">
                  {t(`permissions.key.${key}`)}
                </th>
                {POSITIONS.map((p) => {
                  const on = DEFAULTS[p][key];
                  return (
                    <td key={p} className="py-2 px-2 text-center">
                      {on
                        ? <Check size={16} className="inline text-emerald-600 dark:text-emerald-400" aria-label={ta('ui.matrix.yes')} />
                        : <Minus size={16} className="inline text-[rgb(var(--color-text-muted))]" aria-label={ta('ui.matrix.no')} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[rgb(var(--color-text-muted))]">{ta('ui.matrix.help')}</p>
      </div>
    </details>
  );
};

export default PermissionsMatrix;
