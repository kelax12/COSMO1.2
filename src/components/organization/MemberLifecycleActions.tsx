import { useState, type ReactNode } from 'react';
import { LogOut, ShieldOff } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { OrgMember } from '@/modules/organizations';
import MemberAccessDialog from './MemberAccessDialog';
import OffboardMemberDialog from './OffboardMemberDialog';
import { useT } from '@/i18n/useT';

interface UseMemberLifecycleArgs {
  orgId: string;
  members: OrgMember[];
  ownerId: string;
  currentUserId?: string;
  isAdmin: boolean;
}

interface MemberLifecycle {
  /**
   * Entrées à placer dans le menu « … » d'une ligne membre. Rien pour un
   * non-admin, pour soi-même ou pour le propriétaire : le serveur refuserait
   * (`set_member_access`, `offboard_org_member`), l'écran ne le propose pas.
   */
  menuItems: (member: OrgMember) => ReactNode;
  /** Les dialogues, à monter UNE fois hors du menu (un menu se démonte en se fermant). */
  dialogs: ReactNode;
}

/**
 * Gestes du cycle de vie d'un membre (mig. 161, M10) : régler son accès
 * (suspendre, réactiver, borner) et organiser son départ.
 *
 * Livré comme un hook plutôt que dans l'annuaire lui-même : l'annuaire et la
 * fiche membre appartiennent à une autre session de travail (répartition du
 * 2026-09-24). Ils n'ont qu'à appeler `menuItems(member)` dans leur menu et
 * monter `dialogs` une fois.
 *
 * ⚠️ « Organiser le départ » REMPLACE l'ancien « Retirer de l'entreprise » :
 * le retrait nu laissait tâches, subordonnés et rôles orphelins.
 */
export const useMemberLifecycle = ({
  orgId, members, ownerId, currentUserId, isAdmin,
}: UseMemberLifecycleArgs): MemberLifecycle => {
  const { t } = useT('org');
  const [accessFor, setAccessFor] = useState<OrgMember | null>(null);
  const [departureFor, setDepartureFor] = useState<OrgMember | null>(null);

  const menuItems = (member: OrgMember): ReactNode => {
    if (!isAdmin || member.userId === currentUserId || member.userId === ownerId) return null;
    return (
      <>
        <DropdownMenuItem onClick={() => setAccessFor(member)}>
          <ShieldOff size={14} aria-hidden="true" />
          {member.suspendedAt ? t('lifecycle.menuReactivate') : t('lifecycle.menuAccess')}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => setDepartureFor(member)}
          className="!text-red-500 focus:!text-red-500"
        >
          <LogOut size={14} className="!text-red-500" aria-hidden="true" /> {t('lifecycle.menuOffboard')}
        </DropdownMenuItem>
      </>
    );
  };

  const dialogs = (
    <>
      {accessFor && <MemberAccessDialog orgId={orgId} member={accessFor} onClose={() => setAccessFor(null)} />}
      {departureFor && (
        <OffboardMemberDialog
          orgId={orgId}
          member={departureFor}
          members={members}
          onClose={() => setDepartureFor(null)}
        />
      )}
    </>
  );

  return { menuItems, dialogs };
};
