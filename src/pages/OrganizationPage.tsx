import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, Target, LogOut, Building2 } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useMyOrganization,
  useOrgMembers,
  useLeaveOrganization,
} from '@/modules/organizations';
import MemberDirectory from '@/components/organization/MemberDirectory';
import OrgJoinCodeCard from '@/components/organization/OrgJoinCodeCard';
import TeamProjectsTab from '@/components/organization/TeamProjectsTab';

type OrgTab = 'overview' | 'projects' | 'okr' | 'members';

const TABS: { id: OrgTab; label: string; Icon: typeof Users }[] = [
  { id: 'overview', label: 'Aperçu', Icon: LayoutDashboard },
  { id: 'projects', label: 'Projets', Icon: FolderKanban },
  { id: 'okr', label: 'OKR', Icon: Target },
  { id: 'members', label: 'Membres', Icon: Users },
];

const Placeholder = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
      <Building2 size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
    </div>
    <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{label}</p>
    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">Bientôt disponible.</p>
  </div>
);

/**
 * Espace entreprise — onglets Aperçu / Projets / OKR / Membres (state local,
 * routing plat cohérent avec l'app). Réservé aux membres d'une organisation :
 * un non-membre est redirigé vers le dashboard.
 */
const OrganizationPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<OrgTab>('overview');
  const { data: myOrg, isLoading } = useMyOrganization();
  const { data: members = [] } = useOrgMembers(myOrg?.id);
  const leaveMutation = useLeaveOrganization();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
      </div>
    );
  }

  // Non-membre : pas d'espace entreprise → dashboard.
  if (!myOrg) return <Navigate to="/dashboard" replace />;

  const isAdmin = myOrg.myRole === 'admin';
  const isManager = myOrg.myRole === 'admin' || myOrg.myRole === 'manager';

  const handleLeave = () => {
    if (!window.confirm(`Quitter ${myOrg.name} ? Vous perdrez l'accès aux projets et OKR de l'équipe.`)) return;
    leaveMutation.mutate(myOrg.id);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* En-tête */}
      <header className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
          <Building2 size={24} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[rgb(var(--color-text-primary))] truncate">{myOrg.name}</h1>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            {members.length} membre{members.length > 1 ? 's' : ''}
          </p>
        </div>
      </header>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-[rgb(var(--color-border))] mb-6 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-indigo-500 text-[rgb(var(--color-text-primary))]'
                : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
            }`}
          >
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === 'overview' && <Placeholder label="Tableau de bord de l'équipe" />}
      {tab === 'projects' && (
        <TeamProjectsTab orgId={myOrg.id} members={members} currentUserId={user?.id} isManager={isManager} />
      )}
      {tab === 'okr' && <Placeholder label="OKR d'équipe" />}

      {tab === 'members' && (
        <div className="space-y-6">
          <OrgJoinCodeCard code={myOrg.joinCode ?? ''} />

          <div>
            <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
              Annuaire ({members.length})
            </h2>
            <MemberDirectory
              orgId={myOrg.id}
              members={members}
              currentUserId={user?.id}
              isAdmin={isAdmin}
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleLeave}
              disabled={leaveMutation.isPending}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
            >
              <LogOut size={15} aria-hidden="true" /> Quitter l'entreprise
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationPage;
