import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, Target, LogOut, Building2, Pencil, Network } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useActiveOrganization,
  useOrgMembers,
  useLeaveOrganization,
  isManagerOf,
} from '@/modules/organizations';
import { ENTERPRISE_BILLING_ENFORCED, ORG_FREE_SEATS } from '@/modules/billing/premium-config';
import MemberDirectory from '@/components/organization/MemberDirectory';
import OrgJoinCodeCard from '@/components/organization/OrgJoinCodeCard';
import OrgProfileSheet from '@/components/organization/OrgProfileSheet';
import PyramidTab from '@/components/organization/PyramidTab';
import TeamProjectsTab from '@/components/organization/TeamProjectsTab';
import TeamsSection from '@/components/organization/TeamsSection';
import TeamOKRTab from '@/components/organization/TeamOKRTab';
import TeamOverviewTab from '@/components/organization/TeamOverviewTab';

type OrgTab = 'overview' | 'pyramid' | 'projects' | 'okr' | 'members';

const TABS: { id: OrgTab; label: string; Icon: typeof Users }[] = [
  { id: 'overview', label: 'Aperçu', Icon: LayoutDashboard },
  { id: 'pyramid', label: 'Pyramide', Icon: Network },
  { id: 'projects', label: 'Projets', Icon: FolderKanban },
  { id: 'okr', label: 'OKR', Icon: Target },
  { id: 'members', label: 'Membres', Icon: Users },
];

/**
 * Espace entreprise — onglets Aperçu / Projets / OKR / Membres (state local,
 * routing plat cohérent avec l'app). Réservé aux membres d'une organisation :
 * un non-membre est redirigé vers le dashboard.
 */
const OrganizationPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<OrgTab>('overview');
  const [editProfile, setEditProfile] = useState(false);
  const { activeOrg: myOrg, isLoading } = useActiveOrganization();
  const { data: members = [], isLoading: membersLoading } = useOrgMembers(myOrg?.id);
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
  // « Manager » est dérivé de la pyramide : a ≥ 1 subordonné direct (v2).
  const isManager = isAdmin || (user?.id ? isManagerOf(members, user.id) : false);

  const handleLeave = () => {
    if (!window.confirm(`Quitter ${myOrg.name} ? Vous perdrez l'accès aux projets et OKR de l'équipe.`)) return;
    leaveMutation.mutate(myOrg.id);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
      {/* En-tête */}
      <header className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
          <Building2 size={24} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[rgb(var(--color-text-primary))] truncate">{myOrg.name}</h1>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditProfile(true)}
                aria-label="Modifier le profil de l'entreprise"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
            {members.length} membre{members.length > 1 ? 's' : ''}
            {myOrg.industry ? ` · ${myOrg.industry}` : ''}
          </p>
          {myOrg.description && (
            <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5 line-clamp-1">{myOrg.description}</p>
          )}
        </div>
      </header>

      {editProfile && <OrgProfileSheet org={myOrg} onClose={() => setEditProfile(false)} />}

      {/* Bannière freemium — informative tant que ENTERPRISE_BILLING_ENFORCED
          est false (gate dormant ; le vrai blocage sera côté serveur). */}
      {members.length >= ORG_FREE_SEATS && (
        <div className="mb-5 rounded-2xl border border-indigo-300/60 dark:border-indigo-700/40 bg-indigo-50/60 dark:bg-indigo-900/15 px-4 py-3">
          <p className="text-xs text-indigo-700 dark:text-indigo-300">
            <span className="font-semibold">{members.length} membres.</span>{' '}
            {ENTERPRISE_BILLING_ENFORCED
              ? 'Au-delà de 5 collaborateurs, un abonnement entreprise est requis pour accepter de nouveaux membres.'
              : 'COSMO Entreprise restera gratuit jusqu\'à 5 collaborateurs — une offre payante arrivera au-delà (20 €/mois jusqu\'à 50, 100 €/mois ensuite). Rien ne change pour vous aujourd\'hui.'}
          </p>
        </div>
      )}

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
      {tab === 'overview' && <TeamOverviewTab orgId={myOrg.id} members={members} />}
      {tab === 'pyramid' && (
        <PyramidTab
          orgId={myOrg.id}
          ownerId={myOrg.ownerId}
          members={members}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          loading={membersLoading}
        />
      )}
      {tab === 'projects' && (
        <TeamProjectsTab orgId={myOrg.id} members={members} currentUserId={user?.id} isManager={isManager} />
      )}
      {tab === 'okr' && <TeamOKRTab orgId={myOrg.id} members={members} isManager={isManager} />}

      {tab === 'members' && (
        <div className="space-y-6">
          <OrgJoinCodeCard code={myOrg.joinCode ?? ''} orgId={myOrg.id} isAdmin={isAdmin} />

          <TeamsSection
            orgId={myOrg.id}
            members={members}
            currentUserId={user?.id}
            isAdmin={isAdmin}
            isManager={isManager}
          />

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
