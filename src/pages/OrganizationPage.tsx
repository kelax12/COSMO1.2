import { Suspense, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { markOrgSeen, useOrgBadges } from '@/lib/hooks/use-org-notifications';
import { Building2, Pencil } from 'lucide-react';
import { useOrgShortcuts } from '@/components/organization/org-page.hooks';
import { useAuth, type User } from '@/modules/auth/AuthContext';
import {
  useActiveOrganization,
  useOrgMembers,
  useMyOrgPermissions,
  useOrgNotifications,
  useOrgRoles,
  type MyOrganization,
  type OrgMember,
  type OrgNotification,
} from '@/modules/organizations';
import { ENTERPRISE_BILLING_ENFORCED } from '@/modules/billing/premium-config';
import { useOrgSubscription } from '@/modules/billing/org-billing.hooks';
import { isQuotaReached, effectiveQuota, needsPaymentAttention, isOverQuota, membersOverQuota, sectionOpenWhileOverQuota } from '@/modules/billing/org-billing.logic';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader } from '@/components/mobile';
import OrgNotificationsBell from '@/components/organization/OrgNotificationsBell';
import OrgTabBadge from '@/components/organization/OrgTabBadge';
import OrgSideNav from '@/components/organization/OrgSideNav';
import { useOrgGuideDemoPhase } from '@/components/org-guide/guide-demo-signal';
import type { GuideViewer } from '@/components/org-guide/guide-types';
import { useOrgNavMode, type OrgNavMode } from '@/components/organization/use-org-nav-mode';
import OrgSectionSwitcher from '@/components/organization/OrgSectionSwitcher';
import { ORG_SECTIONS, type OrgSection, type OrgNavItem } from '@/components/organization/org-sections';
import { sectionNotificationBadges } from '@/components/organization/org-section-badges';
import { isOrgSectionSegment, legacyOrgTabRedirect, orgSectionPath } from '@/components/organization/deep-link.helpers';
import { safeRedirectPath } from '@/lib/safe-redirect';
import {
  badgePreviewKey,
  orgSectionBadge,
  resolveOrgRoute,
  resolveOrgTab,
  visibleOrgSections,
  type OrgNavBadgeCounts,
} from '@/components/organization/org-page.helpers';
import { canSeeStats } from '@/components/organization/stats-scope.helpers';
import { canSeeReports, reportAccess } from '@/components/organization/report-access.helpers';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import MyWorkTab from '@/components/organization/MyWorkTab';
import { MyWorkSkeleton, TeamTasksSkeleton, TeamOverviewSkeleton, OrgTabSkeleton } from '@/components/organization/OrgLoadingSkeletons';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT, type Translator } from '@/i18n/useT';
import { useIsDemo } from '@/lib/app-mode.store';
import { joinedSinceWelcome, markMemberWelcomeSeen, readMemberWelcomeSeen } from '@/components/onboarding/enterprise/ent-onboarding';
import type { KeyOf } from '@/i18n/catalog';

// ── Onglets chargés à la demande : un chunk par onglet. `MyWorkTab` reste EAGER (onglet par défaut, ses blocs sont préchargés : `MyWorkSections`).
// Second argument de `lazyWithRetry` VIDE : les catalogues sont déclarés par la ROUTE (`App.tsx`). Un onglet qui DÉCLARE sa liste devient une frontière contrôlée par `lazy-namespaces.guard.test.ts` (`TAB_GATE_HOSTS`, `scripts/i18n-shell-namespaces.mjs`) et doit couvrir TOUT son sous-arbre, `org` compris. `portfolio` n'est payé que par Projets.
const TeamProjectsTab = lazyWithRetry(() => import('@/components/organization/TeamProjectsTab'), ['org', 'orgAdmin', 'overlays', 'portfolio', 'tasks']);
const TeamTasksTab = lazyWithRetry(() => import('@/components/organization/TeamTasksTab'), ['csv', 'eventModal', 'org', 'orgAdmin', 'overlays', 'portfolio', 'tasks']);
const TeamOKRTab = lazyWithRetry(() => import('@/components/organization/TeamOKRTab'), ['okr', 'org', 'orgAdmin', 'overlays', 'portfolio']);
const TeamOverviewTab = lazyWithRetry(() => import('@/components/organization/TeamOverviewTab'));
const OrgBillingTab = lazyWithRetry(() => import('@/components/organization/OrgBillingTab'), ['org', 'orgAccount', 'orgAdmin', 'overlays']);
const OrgPastDueBanner = lazyWithRetry(() => import('@/components/organization/OrgPastDueBanner'));
const OrgOverQuotaLock = lazyWithRetry(() => import('@/components/organization/OrgOverQuotaLock'));
// Membres, Équipes (et la page de chaque équipe) et Paramètres ont chacune leur
// adresse et leur chunk : seul qui ouvre `/entreprise/members` paie la section.
const OrgMembersSection = lazyWithRetry(() => import('@/components/organization/OrgMembersSection'));
const TeamsSection = lazyWithRetry(() => import('@/components/organization/TeamsSection'));
const TeamPage = lazyWithRetry(() => import('@/components/organization/TeamPage'));
// Rapports d'activité (mig. 202) : un chunk à part, payé par qui l'ouvre.
const OrgSettingsSection = lazyWithRetry(() => import('@/components/organization/OrgSettingsSection'), ['csv', 'okr', 'org', 'orgAccount', 'orgAdmin', 'overlays', 'portfolio', 'settings', 'tasks']);

// Feuilles et dialogues : conditionnels au rendu ET au téléchargement. Glossaire et liens profonds (`?task=`) : UNE entrée paresseuse (`OrgPageOverlays`). Accueil membre et bouton flottant du guide : leur catalogue part avec eux.
const OrgGuideFab = lazyWithRetry(() => import('@/components/org-guide/OrgGuideFab'), ['org', 'orgGuide', 'overlays']);
const OrgWelcomeVideo = lazyWithRetry(() => import('@/components/onboarding/enterprise/OrgWelcomeVideo'), ['onboarding']);
const OrgPageOverlays = lazyWithRetry(() => import('@/components/organization/OrgPageOverlays'), ['eventModal', 'org', 'orgAccount', 'orgAdmin', 'overlays', 'tasks']);

type OrgTab = OrgSection;

/**
 * Espace entreprise. Chaque section est une ROUTE (`/entreprise/projects`) ; navigation à droite (`OrgSideNav`) sur desktop, sélecteur (`OrgSectionSwitcher`) sur mobile. Réservé aux membres : un non-membre est redirigé vers le dashboard.
 */
/** Squelette d'un onglet dont le chunk est en vol : le même que celui du chargement de DONNÉES des trois onglets qui en ont un. */
const tabFallback = (tab: OrgTab, tOrgAdmin: (key: KeyOf<'orgAdmin'>) => string) => {
  if (tab === 'overview') return <MyWorkSkeleton label={tOrgAdmin('myWork.loading')} />;
  if (tab === 'tasks') return <TeamTasksSkeleton label={tOrgAdmin('page.tasksTabLoading')} />;
  if (tab === 'stats') return <TeamOverviewSkeleton label={tOrgAdmin('overview.loading')} />;
  return <OrgTabSkeleton label={tOrgAdmin('page.tabLoading')} />;
};

/** Ouvre la palette Ctrl+K (écoutée dans `CommandPalette.tsx`). */
const openSearch = () => window.dispatchEvent(new CustomEvent('open-command-palette'));

/**
 * `?guide=1` (fin de la constellation) : ouvre le guide une seule fois, puis
 * le paramètre quitte l'URL pour qu'un rechargement ne le rouvre pas.
 */
function useGuideOpenSignal(searchParams: URLSearchParams, setSearchParams: ReturnType<typeof useSearchParams>[1]) {
  const [guideOpenSignal] = useState(() => (searchParams.get('guide') === '1' ? Date.now() : undefined));
  useEffect(() => {
    if (searchParams.get('guide') !== '1') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('guide');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);
  return guideOpenSignal;
}

/**
 * Navigation de droite (ouverte à l'arrivée, repliée, ou ressortie au
 * survol). Portée par la page : elle réserve la place de la carte ouverte à
 * l'arrivée, sinon elle recouvrirait la colonne de droite du contenu.
 * Démo du guide : visible pendant un changement de page (`peek` si elle était
 * repliée, sans réserver de place), masquée une fois la page atteinte pour que
 * le curseur ne clique jamais derrière elle (cf. guide-demo-signal).
 */
function useSideNavMode(): [OrgNavMode, (mode: OrgNavMode) => void] {
  const [navMode, setNavMode] = useOrgNavMode();
  const guidePhase = useOrgGuideDemoPhase();
  const sideNavMode: OrgNavMode =
    guidePhase === 'hide' ? 'collapsed'
    : guidePhase === 'nav' && navMode === 'collapsed' ? 'peek'
    : navMode;
  return [sideNavMode, setNavMode];
}

/**
 * Entrées de navigation (panneau desktop et sélecteur mobile), libellé traduit
 * et pastille construite. Projets et Membres ont un compteur dérivé ; les
 * autres comptent les notifications non lues de la boîte de réception.
 */
function buildOrgNavItems(
  { t, tOrgAdmin, tpOrgAdmin }: OrgTranslators,
  badges: OrgNavBadgeCounts,
  orgNotifications: OrgNotification[],
  viewer: { canStats: boolean; isAdmin: boolean; isOwner: boolean; overQuota: boolean },
  tab: OrgTab,
): OrgNavItem[] {
  const sectionBadges = sectionNotificationBadges(orgNotifications);
  const kindLabel = (k: string) => tOrgAdmin(`notifSettings.kind.${k}` as KeyOf<'orgAdmin'>);
  return visibleOrgSections(ORG_SECTIONS, viewer).map(({ id, labelKey, Icon, group }) => {
    const { count: badgeCount, items } = orgSectionBadge(id, badges, sectionBadges, kindLabel);
    const badgeAriaLabel = badgeCount > 0 ? tpOrgAdmin('page.badgeCount', badgeCount) : undefined;
    return {
      id,
      label: t(labelKey),
      Icon,
      group,
      badgeCount,
      badgeAriaLabel,
      badge: badgeCount > 0 ? (
        <OrgTabBadge
          count={badgeCount}
          items={items}
          title={tOrgAdmin(badgePreviewKey(id))}
          ariaLabel={badgeAriaLabel ?? ''}
          side="left"
          onAccent={tab === id}
        />
      ) : undefined,
    };
  });
}

interface OrgTranslators {
  t: Translator<'org'>['t'];
  tOrgAdmin: Translator<'orgAdmin'>['t'];
  tpOrgAdmin: Translator<'orgAdmin'>['tp'];
}

/** En-tête desktop (rendu historique, inchangé). */
function OrgDesktopHeader({ org, members, isAdmin, onEdit }: {
  org: MyOrganization;
  members: OrgMember[];
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  return (
    <header className="hidden md:flex flex-wrap items-center gap-3 mb-6">
      <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-primary))] shrink-0 overflow-hidden">
        {org.avatarUrl ? (
          <img src={org.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Building2 size={24} aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PageHeading variant="compact" className="truncate">{org.name}</PageHeading>
          {isAdmin && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={tOrgAdmin('page.editProfile')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
          {tpOrgAdmin('page.memberCount', members.length)}
          {org.industry ? ` · ${org.industry}` : ''}
        </p>
        {org.description && (
          <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5 line-clamp-1">{org.description}</p>
        )}
      </div>
      {/* Le forfait n'est pas dans l'en-tête : le propriétaire le trouve dans
          Paramètres (`OrgSettingsSection`, « Forfait et facturation »). */}
      {/* La cloche lit `org_notifications`, alimentée côté serveur. */}
      <OrgNotificationsBell orgId={org.id} members={members} />
    </header>
  );
}

/** Bannières d'abonnement, au-dessus du contenu. */
function OrgSubscriptionBanners({ orgId, memberCount, showPastDue, showSeatsFull }: {
  orgId: string;
  memberCount: number;
  showPastDue: boolean;
  showSeatsFull: boolean;
}) {
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  return (
    <>
      {/* Impayé : propriétaire seul, au-dessus de tout.
          Chunk chargé seulement quand l'abonnement est `past_due`. */}
      {showPastDue && (
        <Suspense fallback={null}>
          <OrgPastDueBanner orgId={orgId} memberCount={memberCount} />
        </Suspense>
      )}

      {/* Bannière sièges : affichée UNIQUEMENT quand il faut changer de plan
          (facturation active ET quota atteint). Le simple constat « gratuit
          jusqu'à 5, rien ne change » n'appelait aucune action : retiré. */}
      {showSeatsFull && (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] px-4 py-3">
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">
            <span className="font-semibold text-[rgb(var(--color-text-primary))]">{tpOrgAdmin('page.memberCountDot', memberCount)}</span>{' '}
            {tOrgAdmin('page.freemiumOver')}
          </p>
        </div>
      )}
    </>
  );
}

/** Ce que la page sait du visiteur et de l'abonnement, transmis aux sections. */
interface OrgSectionContext {
  tab: OrgTab;
  overQuota: boolean;
  sectionLocked: boolean;
  org: MyOrganization;
  members: OrgMember[];
  currentUserId: string | undefined;
  isOwner: boolean;
  isAdmin: boolean;
  canInvite: boolean;
  canEditDependencies: boolean;
  canCreateTeam: boolean;
  canStats: boolean;
  /** Rapports ouverts, droits connus (jamais pendant le chargement). */
  canReportsSettled: boolean;
  /** Facturation active hors démo : le quota et le changement de forfait s'appliquent. */
  billingLive: boolean;
  subscriptionPending: boolean;
  seatsFull: boolean;
  seatsQuota: number | null;
  pastDue: boolean;
  teamId: string | null;
  urlTab: OrgTab;
}

/** Le contenu de la section servie (les onglets sont exclusifs). */
function OrgSectionContent({ tab, ctx, setTab }: { tab: OrgTab; ctx: OrgSectionContext; setTab: (id: OrgTab) => void }) {
  const { org: myOrg, members, currentUserId, isOwner, isAdmin, canInvite, canEditDependencies, seatsFull, seatsQuota } = ctx;
  switch (tab) {
    case 'overview':
      return <MyWorkTab orgId={myOrg.id} members={members} currentUserId={currentUserId} canEditDependencies={canEditDependencies} />;
    case 'stats':
      return ctx.canStats ? <TeamOverviewTab orgId={myOrg.id} members={members} isAdmin={isAdmin} currentUserId={currentUserId} /> : null;
    case 'tasks':
      return <TeamTasksTab orgId={myOrg.id} members={members} currentUserId={currentUserId} canEditDependencies={canEditDependencies} isAdmin={isAdmin} />;
    case 'projects':
      return <TeamProjectsTab orgId={myOrg.id} members={members} currentUserId={currentUserId} canEditDependencies={canEditDependencies} isAdmin={isAdmin} />;
    case 'okr':
      return <TeamOKRTab orgId={myOrg.id} />;
    case 'billing':
      return (
        <OrgBillingTab
          orgId={myOrg.id}
          isOwner={isOwner}
          onBack={() => setTab('overview')}
        />
      );
    case 'members':
      return (
        <OrgMembersSection
          org={myOrg}
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          canInvite={canInvite}
          seatsFull={seatsFull}
          seatsQuota={ctx.billingLive && !ctx.subscriptionPending ? seatsQuota : undefined}
          onChangePlan={isOwner && ctx.billingLive ? () => setTab('billing') : undefined}
        />
      );
    case 'teams':
      return ctx.teamId ? (
        <TeamPage orgId={myOrg.id} teamId={ctx.teamId} members={members} currentUserId={currentUserId} isAdmin={isAdmin} />
      ) : (
        <TeamsSection
          orgId={myOrg.id}
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          canCreateTeam={ctx.canCreateTeam}
        />
      );
    case 'settings':
      return (
        <OrgSettingsSection
          org={myOrg}
          members={members}
          currentUserId={currentUserId}
          isOwner={isOwner}
          isAdmin={isAdmin}
          canInvite={canInvite}
          seatsFull={seatsFull}
          seatsQuota={seatsQuota}
          pastDue={ctx.pastDue}
          canReports={ctx.canReportsSettled}
          initialPanel={ctx.urlTab === 'reports' ? 'reports' : undefined}
        />
      );
    default:
      return null;
  }
}

/**
 * Premier passage dans CETTE entreprise (créateur comme membre) : la vidéo
 * d'accueil, seulement à une arrivée sans paramètre : qui arrive par un lien
 * (fiche, réglages, retour de paiement) vient pour cet écran, pas pour une
 * visite. En démo aussi : le visiteur démo est un prospect, la vidéo lui fait
 * le tour. La date d'arrivée n'y compte pas (membres seedés), le drapeau « vu »
 * tombe avec le reste des clés `cosmo_*` à chaque nouvelle démo.
 */
function shouldShowWelcome(o: {
  arrivedBare: boolean; welcomeClosed: boolean; hasEntityParam: boolean; isDemo: boolean;
  members: OrgMember[]; orgId: string; userId: string;
}): boolean {
  if (!o.arrivedBare || o.welcomeClosed || o.hasEntityParam) return false;
  return (o.isDemo || joinedSinceWelcome(o.members, o.userId)) && !readMemberWelcomeSeen(o.orgId, o.userId);
}

/**
 * Ce que le visiteur peut voir et faire, et ce que l'abonnement impose : la
 * section servie, le verrou de quota, le contexte passé aux sections.
 */
function useOrgWorkspace(o: {
  org: MyOrganization;
  userId: string | undefined;
  isOwner: boolean;
  urlTab: OrgTab;
  teamId: string | null;
  isDemo: boolean;
}) {
  const { org: myOrg, isOwner, urlTab, teamId, isDemo } = o;
  const orgId = myOrg.id;
  const { data: orgNotifications = [] } = useOrgNotifications(orgId);
  // Badge nav (reco #7) : « vu » est marqué en QUITTANT la page ; au montage, `lastSeen` repasserait à `now` et les badges naîtraient à zéro.
  useEffect(() => {
    if (!orgId) return;
    return () => markOrgSeen(orgId);
  }, [orgId]);
  // `live` : c'est LA page où l'on attend de voir un membre arriver.
  const { data: members = [], isPending: membersPending } = useOrgMembers(orgId, { live: true });
  // Droits explicites de l'utilisateur courant (mig. 115). Monté ici parce que
  // plusieurs onglets s'en servent — le hook ne déclenche qu'une requête,
  // partagée par React Query avec celles des composants enfants.
  const myPermissions = useMyOrgPermissions(orgId);
  // Guide entreprise : les rôles personnalisés (mig. 219) n'existent que si
  // leur lecture réussit. Même requête que `useMyOrgPermissions`, partagée.
  const { isError: rolesUnavailable } = useOrgRoles(orgId);
  const { data: orgSubscription, isPending: subscriptionPending } = useOrgSubscription(orgId);
  // Statistiques (M3) : ouvertes aussi aux responsables d'équipe, qui n'ont
  // pas forcément de subordonné dans la pyramide.
  const { data: teams = [], isLoading: teamsLoading } = useOrgTeams(orgId);
  const { data: teamMembers = [] } = useOrgTeamMembers(orgId);
  const isAdmin = myOrg.myRole === 'admin';
  // La pyramide dit qui encadre qui, l'équipe qui travaille ensemble (M3). Rapports : droit `report.org` / `report.allTeams`, ou responsable d'une équipe ; tant que les équipes chargent, pas de renvoi vers l'aperçu (droit inconnu).
  const canReports = teamsLoading || myPermissions.isLoading
    || canSeeReports(reportAccess(myPermissions.can, teams, teamMembers, o.userId));
  const canStats = teamsLoading || canSeeStats(teams, { members, teamMembers, currentUserId: o.userId, isAdmin });
  const tab = resolveOrgTab(urlTab, { isOwner, canStats });
  // Effectif au-dessus du quota (baisse de palier, abonnement tombé) : l'espace se verrouille, restent les sections qui permettent d'en sortir. Jamais avant d'avoir lu l'abonnement ET les membres (quota par défaut 5, le verrou clignoterait).
  // ⚠️ Verrou d'interface : la base sert toujours les données (pas une frontière).
  const subscription = orgSubscription ?? null;
  const billingLive = !isDemo && ENTERPRISE_BILLING_ENFORCED;
  const overQuota = billingLive && !membersPending && !subscriptionPending
    && isOverQuota(members.length, subscription);
  const sectionLocked = overQuota && !sectionOpenWhileOverQuota(tab, { isAdmin, isOwner });

  // Quota de sièges bloquant : le gate serveur (`org_seats_allowed`, mig. 067) ne refuse que si le drapeau `enterprise_seat_limit` est actif ; le client annonce d'avance ce que le serveur appliquera.
  // ⚠️ Le seuil est celui de l'ABONNEMENT, jamais `ORG_FREE_SEATS` en dur (palier « Département » = 20 sièges). `isQuotaReached` porte la règle de `org_seats_allowed()`.
  const seatsQuota = effectiveQuota(subscription);
  // Démo : pas de facturation réelle, la bannière n'appelle aucune action.
  const seatsFull = billingLive && isQuotaReached(members.length, subscription);
  const pastDue = needsPaymentAttention(subscription);

  return {
    tab,
    overQuota,
    sectionLocked,
    orgNotifications,
    myPermissions,
    rolesUnavailable,
    subscription,
    org: myOrg,
    members,
    currentUserId: o.userId,
    isOwner,
    isAdmin,
    // Un seul grade, administrateur ; tout le reste passe par les rôles
    // personnalisés et la fiche (mig. 229). Encadrer quelqu'un n'ouvre plus rien.
    canInvite: myPermissions.can['member.invite'],
    // Le graphe de dépendances d'une tâche suit le droit de modifier les tâches.
    canEditDependencies: myPermissions.can['task.editAny'],
    canCreateTeam: myPermissions.can['team.create'],
    canStats,
    canReportsSettled: canReports && !teamsLoading && !myPermissions.isLoading,
    billingLive,
    subscriptionPending,
    seatsFull,
    seatsQuota,
    pastDue,
    teamId,
    urlTab,
  };
}

/** Ce que la page a résolu (adresse, arrivée) avant ses early returns, transmis à l'espace. */
interface OrgWorkspaceProps {
  org: MyOrganization;
  user: User | null;
  urlTab: OrgTab;
  teamId: string | null;
  setTab: (id: OrgTab) => void;
  isDemo: boolean;
  /** Décidés à l'arrivée sur la page, une fois. */
  arrival: { arrivedBare: boolean; guideOpenSignal: number | undefined };
  hasEntityParam: boolean;
}

/** L'espace d'un membre : en-têtes, bannières, section servie, navigation, accueil, fiches. */
function OrgWorkspace({ org: myOrg, user, urlTab, teamId, setTab, isDemo, arrival, hasEntityParam }: OrgWorkspaceProps) {
  const { t } = useT('org');
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  const userId = user?.id;
  const [searchParams] = useSearchParams();
  const badges = useOrgBadges();
  const [sideNavMode, setNavMode] = useSideNavMode();
  const { shortcuts, togglePin } = useOrgShortcuts(myOrg.id, userId, urlTab, searchParams);
  const { arrivedBare, guideOpenSignal } = arrival;
  // Fermé pendant cette visite ; le drapeau, lui, est posé par entreprise.
  const [welcomeClosed, setWelcomeClosed] = useState(false);
  const isOwner = user?.id === myOrg.ownerId;
  const w = useOrgWorkspace({ org: myOrg, userId, isOwner, urlTab, teamId, isDemo });
  const { members, isAdmin, canStats, tab, overQuota, sectionLocked, seatsFull, seatsQuota, pastDue, subscription } = w;
  const navItems = buildOrgNavItems({ t, tOrgAdmin, tpOrgAdmin }, badges, w.orgNotifications, { canStats, isAdmin, isOwner, overQuota }, tab);
  const activeSection = ORG_SECTIONS.find((x) => x.id === tab);
  const guideViewer: GuideViewer = {
    can: w.myPermissions.can,
    isAdmin,
    isOwner,
    customRolesAvailable: !w.rolesUnavailable,
  };

  return (
    // `md:pr-[232px]` = carte (208) + ses deux marges (12 + 12). La transition
    // suit la même courbe que la carte, pour que les deux bougent ensemble.
    <div
      className={`max-w-[1600px] mx-auto px-4 sm:px-6 py-6 md:transition-[padding] md:duration-300 motion-reduce:transition-none ${
        sideNavMode === 'open' ? 'md:pr-[232px]' : ''
      }`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
    >
      {/* ── Mobile : en-tête canonique (cf. docs/MOBILE.md) ──
          L'avatar de l'organisation n'y est PAS repris : une vignette de 48 px
          dans une barre qui se compacte à 17 px ne tient pas, et la réduire
          la rendrait illisible. Elle reste dans le bloc desktop. La pastille
          de forfait non plus : elle a déjà sa logique de passage à la ligne
          sur mobile, juste en dessous. */}
      <MobileHeader
        title={myOrg.name}
        subtitle={`${tpOrgAdmin('page.memberCount', members.length)}${myOrg.industry ? ` · ${myOrg.industry}` : ''}`}
        // Maquette 236 : une seule icône, la cloche. Le crayon
        // menait à Paramètres, qui est une section ; le glossaire passe dans
        // la feuille des sections (`OrgSectionSwitcher`).
        actions={<OrgNotificationsBell orgId={myOrg.id} members={members} />}
      />

      <OrgDesktopHeader org={myOrg} members={members} isAdmin={isAdmin} onEdit={() => setTab('settings')} />

      <OrgSubscriptionBanners
        orgId={myOrg.id}
        memberCount={members.length}
        showPastDue={isOwner && !isDemo && pastDue}
        showSeatsFull={seatsFull && !overQuota}
      />

      {/* Mobile : la section courante devient un sélecteur (maquette M1).
          Desktop : la navigation vit à droite, dans `OrgSideNav`. */}
      <OrgSectionSwitcher
        fallbackActive={activeSection ? { label: t(activeSection.labelKey), Icon: activeSection.Icon } : undefined}
        items={navItems} activeId={tab} shortcuts={shortcuts} onSearch={openSearch} />

      {/* Contenu */}
      {/* Une seule frontière Suspense pour tout le contenu : les onglets sont
          exclusifs, et le fallback est choisi d'après l'onglet demandé — celui
          de l'onglet Tâches ressemble à sa table, celui des Statistiques à ses
          tuiles. Un fallback générique pour tous aurait fait clignoter une
          forme qui n'est pas celle qui arrive. */}
      <Suspense fallback={tabFallback(tab, tOrgAdmin)}>
      {sectionLocked ? (
        <OrgOverQuotaLock
          memberCount={members.length}
          quota={seatsQuota ?? members.length}
          excess={membersOverQuota(members.length, subscription)}
          canManageMembers={isAdmin || isOwner}
          canChangePlan={isOwner}
          onManageMembers={() => setTab('members')}
          onChangePlan={() => setTab('billing')}
        />
      ) : (
        <OrgSectionContent tab={tab} ctx={w} setTab={setTab} />
      )}
      </Suspense>

      {/* Desktop : la navigation vit à DROITE, hors de la zone qui défile.
          Rendue par portail dans l'emplacement de `Layout`, donc sa place
          dans cet arbre ne dit rien de sa place à l'écran. */}
      {/* Guide entreprise : bouton flottant desktop, le reste arrive en lazy. */}
      <Suspense fallback={null}>
        <OrgGuideFab viewer={guideViewer} openSignal={guideOpenSignal} />
      </Suspense>

      <OrgSideNav
        items={navItems}
        activeId={tab}
        mode={sideNavMode}
        onModeChange={setNavMode}
        shortcuts={shortcuts}
        onTogglePin={togglePin}
        onSearch={openSearch}
      />

      {/* Accueil membre : cf. `shouldShowWelcome`. */}
      {userId && shouldShowWelcome({ arrivedBare, welcomeClosed, hasEntityParam, isDemo, members, orgId: myOrg.id, userId }) && (
        <Suspense fallback={null}>
          <OrgWelcomeVideo
            orgName={myOrg.name}
            onClose={() => {
              markMemberWelcomeSeen(myOrg.id, userId);
              setWelcomeClosed(true);
            }}
          />
        </Suspense>
      )}

      {/* Liens profonds : `?task=`, `?member=`, `?project=`, `?okr=`, `?team=`
          ouvrent leur fiche quelle que soit la section affichée. */}
      {hasEntityParam && !overQuota && (
        <Suspense fallback={null}>
          <OrgPageOverlays
            deepLink={{ orgId: myOrg.id, section: teamId ? 'teams' : tab, members, currentUserId: userId, isAdmin, canEditDependencies: w.canEditDependencies }}
          />
        </Suspense>
      )}
    </div>
  );
}

const OrganizationPage = () => {
  const { user } = useAuth();
  // Section active = segment de chemin (`billing` : route sans entrée de navigation, retour Stripe). `entityId` : second segment, page d'une équipe (`/entreprise/teams/<id>`).
  const { section, entityId } = useParams<{ section?: string; entityId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTab: OrgTab = isOrgSectionSegment(section) ? section : 'overview';
  const isDemo = useIsDemo();
  // Décidé À L'ARRIVÉE, une fois : l'accueil membre ne s'ouvre que si l'on ARRIVE sans paramètre d'adresse (relue à chaque rendu, elle s'ouvrirait par-dessus l'écran voulu). Même règle que `FirstRunSetup`.
  const [arrivedBare] = useState(() => searchParams.toString() === '');
  const guideOpenSignal = useGuideOpenSignal(searchParams, setSearchParams);
  const { activeOrg: myOrg, isLoading } = useActiveOrganization();

  // `/entreprise?tab=X` → `/entreprise/X`, autres paramètres conservés. ⚠️ À GARDER POUR TOUJOURS : Stripe renvoie sur `?tab=billing&checkout=success`, les e-mails `renewal-notice` portent `?tab=billing`. Avant l'attente de l'organisation. Passe par `safeRedirectPath` (no-open-redirect.test.ts).
  const legacyTarget = safeRedirectPath(legacyOrgTabRedirect(searchParams));
  if (legacyTarget) return <Navigate to={legacyTarget} replace />;
  // Segment inconnu → aperçu ; second segment hors équipe → la section (segments de chemin seulement).
  const route = resolveOrgRoute(section, entityId);
  if (route.redirect !== null) return <Navigate to={route.redirect} replace />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[rgb(var(--color-accent))]" />
      </div>
    );
  }

  // Non-membre : pas d'espace entreprise → dashboard.
  if (!myOrg) return <Navigate to="/dashboard" replace />;

  // Sans `replace` : chaque section est une page, le bouton précédent y revient.
  const setTab = (id: OrgTab) => navigate(orgSectionPath(id));

  return (
    <OrgWorkspace
      org={myOrg}
      user={user}
      urlTab={urlTab}
      teamId={route.teamId}
      setTab={setTab}
      isDemo={isDemo}
      arrival={{ arrivedBare, guideOpenSignal }}
      hasEntityParam={['task', 'member', 'project', 'okr', 'team'].some((k) => searchParams.has(k))}
    />
  );
};

export default OrganizationPage;
