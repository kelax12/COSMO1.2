import { Shield, UserCog, UserRound, MoreVertical, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useSetMemberRole, useRemoveMember, type OrgMember, type OrgRole } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

interface MemberDirectoryProps {
  orgId: string;
  members: OrgMember[];
  /** auth.users.id de l'utilisateur courant (pour marquer « Vous » et masquer son propre menu admin). */
  currentUserId?: string;
  /** L'utilisateur courant est-il admin ? (affiche les contrôles). */
  isAdmin: boolean;
}

const ROLE_META: Record<OrgRole, { label: string; Icon: typeof Shield; className: string }> = {
  admin: { label: 'Admin', Icon: Shield, className: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
  manager: { label: 'Manager', Icon: UserCog, className: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  member: { label: 'Membre', Icon: UserRound, className: 'text-slate-600 dark:text-slate-400 bg-slate-500/10' },
};

const RoleBadge = ({ role }: { role: OrgRole }) => {
  const { label, Icon, className } = ROLE_META[role];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${className}`}>
      <Icon size={11} aria-hidden="true" /> {label}
    </span>
  );
};

/**
 * Annuaire des membres de l'entreprise. Un admin peut changer le rôle d'un
 * membre ou le retirer (garde « dernier admin » appliquée côté serveur/RPC —
 * l'erreur remonte en toast si violée). Chaque membre se voit marqué « Vous ».
 */
const MemberDirectory = ({ orgId, members, currentUserId, isAdmin }: MemberDirectoryProps) => {
  const setRoleMutation = useSetMemberRole();
  const removeMutation = useRemoveMember();

  const roles: OrgRole[] = ['admin', 'manager', 'member'];

  return (
    <ul className="space-y-2">
      {members.map((m) => {
        const isSelf = m.userId === currentUserId;
        // On ne montre le menu admin que pour les AUTRES membres.
        const showAdminMenu = isAdmin && !isSelf;
        return (
          <li
            key={m.userId}
            className="flex items-center gap-3 p-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
          >
            <MemberAvatar avatar={m.avatar} size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">
                  {m.displayName}
                </p>
                {isSelf && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))]">
                    Vous
                  </span>
                )}
              </div>
              {m.email && (
                <p className="text-xs text-[rgb(var(--color-text-muted))] truncate">{m.email}</p>
              )}
            </div>

            <RoleBadge role={m.role} />

            {showAdminMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label={`Gérer ${m.displayName}`}
                >
                  <MoreVertical size={16} aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Rôle</DropdownMenuLabel>
                  {roles.map((role) => (
                    <DropdownMenuItem
                      key={role}
                      disabled={role === m.role || setRoleMutation.isPending}
                      onClick={() => setRoleMutation.mutate({ orgId, userId: m.userId, role })}
                    >
                      {ROLE_META[role].label}
                      {role === m.role && <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]">actuel</span>}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate({ orgId, userId: m.userId })}
                  >
                    <LogOut size={14} aria-hidden="true" /> Retirer de l'entreprise
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default MemberDirectory;
