import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useActiveOrganization } from '@/modules/organizations';

interface OrgSwitcherProps {
  /** Mode sidebar repliée (icône seule). */
  collapsed?: boolean;
}

/**
 * Sélecteur d'organisation active (multi-org v2). Affiché dans la sidebar
 * desktop (sous l'entrée Entreprise) et dans le sheet mobile. La préférence
 * est persistée par utilisateur (ActiveOrgContext).
 */
const OrgSwitcher = ({ collapsed = false }: OrgSwitcherProps) => {
  const { organizations, activeOrg, setActiveOrgId } = useActiveOrganization();
  const navigate = useNavigate();

  if (organizations.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`w-full flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] transition-colors px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${collapsed ? 'justify-center px-0' : ''}`}
        aria-label={`Organisation active : ${activeOrg?.name ?? 'aucune'}. Changer d'organisation`}
      >
        <span className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Building2 size={13} className="text-indigo-500" aria-hidden="true" />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate">
              {activeOrg?.name}
            </span>
            <ChevronsUpDown size={13} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Mes entreprises</DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} onClick={() => setActiveOrgId(org.id)}>
            <span className="truncate">{org.name}</span>
            <span className="ml-auto flex items-center gap-1.5">
              {org.myRole === 'admin' && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  Admin
                </span>
              )}
              {org.id === activeOrg?.id && <Check size={14} aria-hidden="true" />}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/entreprise/onboarding')}>
          <Plus size={14} aria-hidden="true" /> Créer ou rejoindre
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default OrgSwitcher;
