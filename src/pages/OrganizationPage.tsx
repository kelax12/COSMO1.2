import { Suspense, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { markOrgSeen, useOrgBadges } from '@/lib/hooks/use-org-notifications';
import { BookOpen, Building2, Pencil, X } from 'lucide-react';
import { useManagerSectionsToast, useOrgShortcuts } from '@/components/organization/org-page.hooks';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useActiveOrganization,
  useOrgMembers,
  useMyOrgPermissions,
  useOrgNotifications,
  isManagerOf,
} from '@/modules/organizations';
import { ENTERPRISE_BILLING_ENFORCED } from '@/modules/billing/premium-config';
import { useOrgSubscription } from '@/modules/billing/org-billing.hooks';
import { isQuotaReached, effectiveQuota } from '@/modules/billing/org-billing.logic';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader } from '@/components/mobile';
import OrgNotificationsBell from '@/components/organization/OrgNotificationsBell';
import OrgTabBadge from '@/components/organization/OrgTabBadge';
import OrgSideNav from '@/components/organization/OrgSideNav';
import { useOrgNavMode } from '@/components/organization/use-org-nav-mode';
import OrgSectionSwitcher from '@/components/organization/OrgSectionSwitcher';
import { ORG_SECTIONS, type OrgSection, type OrgNavItem } from '@/components/organization/org-sections';
import { sectionNotificationBadges, type BadgeSection } from '@/components/organization/org-section-badges';
import {
  isOrgSectionSegment,
  legacyOrgTabRedirect,
  orgSectionPath,
  readTeamIdSegment,
} from '@/components/organization/deep-link.helpers';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { canSeeStats } from '@/components/organization/stats-scope.helpers';
import { canSeeReports, reportAccess } from '@/components/organization/report-access.helpers';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import MyWorkTab from '@/components/organization/MyWorkTab';
import { MyWorkSkeleton, TeamTasksSkeleton, TeamOverviewSkeleton, OrgTabSkeleton } from '@/components/organization/OrgLoadingSkeletons';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';
import { useIsDemo } from '@/lib/app-mode.store';
import { markMemberWelcomeSeen, readMemberWelcomeSeen } from '@/components/onboarding/enterprise/ent-onboarding';
import type { KeyOf } from '@/i18n/catalog';

// ── Onglets chargés à la demande ──────────────────────────────────
//
// Tout /entreprise tenait dans UN chunk de 280 ko bruts (64 ko gzip), le 4e du
// build, plus lourd que `vendor-react`. Ouvrir l'Aperçu téléchargeait donc
// aussi la pyramide, le kanban, la frise et les graphiques des statistiques,
// que la plupart des visites n'ouvrent jamais.
//
// `MyWorkTab` reste EAGER : c'est l'onglet par défaut, le rendre paresseux
// remplacerait l'écran d'arrivée par un squelette à chaque ouverture, pour
// n'économiser que ce qu'on va charger dans la seconde. Ses blocs peints, eux,
// sont chargés à part et préchargés (`MyWorkSections`, 2026-09-24).
//
// ⚠️ Second argument à `lazyWithRetry` VIDE par défaut : les catalogues de cette
// page sont déclarés par sa ROUTE (`App.tsx`, ligne `OrganizationPage`).
// Une exception, vérifiée : un onglet qui DÉCLARE sa liste devient une frontière
// que `lazy-namespaces.guard.test.ts` contrôle comme une route (`TAB_GATE_HOSTS`
// dans `scripts/i18n-shell-namespaces.mjs`). La liste doit alors couvrir TOUT
// son sous-arbre, `org` compris.
const PyramidTab = lazyWithRetry(() => import('@/components/organization/PyramidTab'), ['eventModal', 'org', 'orgAdmin', 'overlays', 'tasks']);
// `portfolio` (M2) n'est payé que par qui ouvre Projets : dans `org`, il pesait
// 4,7 ko gzip sur chaque visite de /entreprise.
const TeamProjectsTab = lazyWithRetry(() => import('@/components/organization/TeamProjectsTab'), ['org', 'orgAdmin', 'overlays', 'portfolio']);
const TeamTasksTab = lazyWithRetry(() => import('@/components/organization/TeamTasksTab'), ['csv', 'eventModal', 'org', 'orgAdmin', 'overlays', 'portfolio', 'tasks']);
const TeamOKRTab = lazyWithRetry(() => import('@/components/organization/TeamOKRTab'), ['okr', 'org', 'orgAdmin', 'overlays', 'portfolio']);
const TeamOverviewTab = lazyWithRetry(() => import('@/components/organization/TeamOverviewTab'));
const OrgBillingTab = lazyWithRetry(() => import('@/components/organization/OrgBillingTab'), ['org', 'orgAccount', 'orgAdmin', 'overlays']);
// Section Membres : sortie de la page le 2026-09-24, et LAZY pour la même
// raison que les onglets ci-dessus. Importée en dur, elle restait dans ce
// chunk, qui dépassait son cliquet (18,3 ko pour 18,0) : seul qui ouvre
// `/entreprise/members` doit la payer.
const OrgMembersSection = lazyWithRetry(() => import('@/components/organization/OrgMembersSection'));
// Audit Membres du 2026-09-24 : la section Membres tenait quatre pages en une.
// Équipes (et la page de chaque équipe) et Paramètres ont leur adresse, et
// leur chunk.
const TeamsSection = lazyWithRetry(() => import('@/components/organization/TeamsSection'));
const TeamPage = lazyWithRetry(() => import('@/components/organization/TeamPage'));
// Rapports d'activité (mig. 202) : un chunk à part, payé par qui l'ouvre.
const OrgSettingsSection = lazyWithRetry(() => import('@/components/organization/OrgSettingsSection'), ['csv', 'okr', 'org', 'orgAccount', 'orgAdmin', 'overlays', 'portfolio', 'tasks']);

// Feuilles et dialogues : montés derrière un `&&`, donc déjà conditionnels au
// rendu. Ils ne l'étaient pas au TÉLÉCHARGEMENT.
// Glossaire et liens profonds (`?task=`…) : UNE entrée paresseuse pour les deux,
// chargée seulement quand l'un sert (cf. `OrgPageOverlays`).
// Accueil d'un membre au premier passage (2026-10-03) : son catalogue
// `onboarding` ne part qu'avec lui, soit une fois par entreprise et par appareil.
const MemberWelcome = lazyWithRetry(() => import('@/components/onboarding/enterprise/MemberWelcome'), ['onboarding']);
const OrgPageOverlays = lazyWithRetry(() => import('@/components/organization/OrgPageOverlays'), ['eventModal', 'org', 'orgAccount', 'orgAdmin', 'overlays', 'tasks']);

type OrgTab = OrgSection;

/**
 * Espace entreprise. Chaque section est une ROUTE depuis le 2026-09-23
 * (`/entreprise/projects`) : le bouton précédent passe d'une section à
 * l'autre et l'onglet du navigateur porte son nom. La navigation vit à
 * droite (`OrgSideNav`) sur desktop, dans un sélecteur (`OrgSectionSwitcher`)
 * sur mobile. Réservé aux membres d'une organisation : un non-membre est
 * redirigé vers le dashboard.
 */
/**
 * Squelette d'attente d'un onglet dont le chunk est encore en vol.
 *
 * Trois onglets ont déjà un squelette dédié pour leur chargement de DONNÉES :
 * on réutilise le même ici, pour que l'attente du CODE et celle de la donnée
 * se ressemblent au lieu de s'enchaîner en deux formes différentes.
 */
const tabFallback = (tab: OrgTab, tOrgAdmin: (key: KeyOf<'orgAdmin'>) => string) => {
  if (tab === 'overview') return <MyWorkSkeleton label={tOrgAdmin('myWork.loading')} />;
  if (tab === 'tasks') return <TeamTasksSkeleton label={tOrgAdmin('page.tasksTabLoading')} />;
  if (tab === 'stats') return <TeamOverviewSkeleton label={tOrgAdmin('overview.loading')} />;
  return <OrgTabSkeleton label={tOrgAdmin('page.tabLoading')} />;
};

/** Bannière sièges : dismiss persistant par org (informative, freemium dormant). */
const seatsBannerKey = (orgId: string) => `cosmo_org_seats_banner_dismissed_${orgId}`;

// 🗑️ Bannière « gratuit jusqu'au 1er août » retirée le 2026-09-24 : elle ne
// s'affichait plus depuis le 2026-08-01, son code et ses libellés restaient.

/** Ouvre la palette Ctrl+K (écoutée dans `CommandPalette.tsx`). */
const openSearch = () => window.dispatchEvent(new CustomEvent('open-command-palette'));

const OrganizationPage = () => {
  const { t } = useT('org');
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  const { user } = useAuth();
  // Section active = segment de chemin. `billing` en fait partie : c'est une
  // route sans entrée de navigation, où Stripe renvoie après un paiement.
  // `entityId` : second segment, qui n'existe que pour la page d'une équipe
  // (`/entreprise/teams/<id>`).
  const { section, entityId } = useParams<{ section?: string; entityId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTab: OrgTab = isOrgSectionSegment(section) ? section : 'overview';
  // Sans `replace` : chaque section est une page, le bouton précédent y revient.
  const setTab = (id: OrgTab) => navigate(orgSectionPath(id));
  // Glossaire (cohérence globale) : ouvert par le bouton d'en-tête. Les
  // info-bulles de rôle l'ouvrent elles-mêmes, sur leur terme (`RoleTerm`).
  const [glossary, setGlossary] = useState(false);
  const [seatsBannerDismissed, setSeatsBannerDismissed] = useState(false);
  const isDemo = useIsDemo();
  // Fermé pendant cette visite ; le drapeau, lui, est posé par entreprise.
  const [welcomeClosed, setWelcomeClosed] = useState(false);
  const { activeOrg: myOrg, isLoading } = useActiveOrganization();
  const badges = useOrgBadges();
  const { data: orgNotifications = [] } = useOrgNotifications(myOrg?.id);
  // Navigation de droite (ouverte à l'arrivée, repliée, ou ressortie au
  // survol). Porté ici : la page réserve la place de la carte ouverte à
  // l'arrivée, sinon elle recouvrirait la colonne de droite du contenu.
  const [navMode, setNavMode] = useOrgNavMode();

  // Badge nav (reco #7) : on marque « vu » en QUITTANT la page, pas en y
  // arrivant. Marquer au montage remettait `lastSeen` à `now` avant le premier
  // rendu, donc les badges d'onglet (Projets / Membres) naissaient toujours à
  // zéro et la fonctionnalité était morte sans jamais échouer.
  useEffect(() => {
    const orgId = myOrg?.id;
    if (!orgId) return;
    return () => markOrgSeen(orgId);
  }, [myOrg?.id]);
  // `live` : c'est LA page où l'on attend de voir un membre arriver.
  const { data: members = [], isLoading: membersLoading } = useOrgMembers(myOrg?.id, { live: true });
  // Appelés avant les early returns, comme tous les hooks de la page.
  useManagerSectionsToast(myOrg?.id, user?.id, members, !membersLoading && members.length > 0, myOrg?.myRole === 'admin');
  const { shortcuts, togglePin } = useOrgShortcuts(myOrg?.id, user?.id, urlTab, searchParams);
  // Droits explicites de l'utilisateur courant (mig. 115). Monté ici parce que
  // plusieurs onglets s'en servent — le hook ne déclenche qu'une requête,
  // partagée par React Query avec celles des composants enfants.
  const myPermissions = useMyOrgPermissions(myOrg?.id);
  // Appelé ICI, avant les early returns `isLoading` / `!myOrg` : un hook placé
  // plus bas ne serait pas monté sur tous les rendus.
  const { data: orgSubscription } = useOrgSubscription(myOrg?.id);
  // Statistiques (M3) : ouvertes aussi aux responsables d'équipe, qui n'ont
  // pas forcément de subordonné dans la pyramide.
  const { data: teams = [], isLoading: teamsLoading } = useOrgTeams(myOrg?.id);
  const { data: teamMembers = [] } = useOrgTeamMembers(myOrg?.id);

  // Ancienne forme `/entreprise?tab=X` → `/entreprise/X`, les autres
  // paramètres conservés. ⚠️ À GARDER POUR TOUJOURS : Stripe renvoie sur
  // `/entreprise?tab=billing&checkout=success`, et les e-mails de
  // `renewal-notice` déjà envoyés portent `?tab=billing`. Placé avant l'attente
  // de l'organisation : rien à charger pour réécrire une URL.
  // Passe par `safeRedirectPath` comme toute destination lue dans l'URL,
  // même si le chemin vient ici d'une liste fermée (cf. no-open-redirect.test.ts).
  const legacyTarget = safeRedirectPath(legacyOrgTabRedirect(searchParams));
  if (legacyTarget) return <Navigate to={legacyTarget} replace />;
  // Segment inconnu (`/entreprise/xyz`, `/entreprise/overview`) : l'aperçu,
  // à sa vraie adresse plutôt qu'un contenu d'aperçu sous une URL fausse.
  if (section !== undefined && !isOrgSectionSegment(section)) {
    return <Navigate to="/entreprise" replace />;
  }
  // Un second segment n'a de sens que sous `teams`, et seulement s'il a la
  // forme d'un id : sinon, la section elle-même.
  const teamId = section === 'teams' ? readTeamIdSegment(entityId) : null;
  if (entityId !== undefined && !teamId) {
    return <Navigate to={orgSectionPath(section)} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[rgb(var(--color-accent))]" />
      </div>
    );
  }

  // Non-membre : pas d'espace entreprise → dashboard.
  if (!myOrg) return <Navigate to="/dashboard" replace />;

  const isOwner = user?.id === myOrg.ownerId;
  const isAdmin = myOrg.myRole === 'admin';
  // « Manager » est dérivé de la pyramide : a ≥ 1 subordonné direct (v2).
  const isManager = isAdmin || (user?.id ? isManagerOf(members, user.id) : false);
  // Droits explicites (mig. 115). `isManager` reste la clé des surfaces
  // HIÉRARCHIQUES (onglets Pyramide et Statistiques) : voir l'équipe qu'on
  // encadre n'est pas une permission réglable, c'est une position.
  const canInvite = myPermissions.can['member.invite'];
  // La pyramide dit qui encadre qui, l'équipe qui travaille ensemble (M3) :
  // un responsable d'équipe regarde les statistiques de SON équipe.
  // Tant que les équipes chargent, un lien vers `stats` n'est pas renvoyé
  // à l'aperçu (le droit n'est pas encore connu).
  // Rapports : droit `report.org` / `report.allTeams`, ou responsable d'une équipe.
  const canReports = teamsLoading || myPermissions.isLoading
    || canSeeReports(reportAccess(myPermissions.can, teams, teamMembers, user?.id));
  const canStats = teamsLoading || canSeeStats(teams, { members, teamMembers, currentUserId: user?.id, isAdmin });
  // Un membre qui arrive sur `/entreprise/billing` (lien partagé, ancien
  // favori) ou sur `pyramid` / `stats` (favori d'un ancien manager, lien
  // copié) sans en avoir le droit ne voit pas un écran vide : il retombe sur
  // l'aperçu.
  const tab: OrgTab =
    (urlTab === 'billing' && !isOwner) || (urlTab === 'pyramid' && !isManager) || (urlTab === 'stats' && !canStats)
      ? 'overview'
      : urlTab === 'reports' ? 'settings' : urlTab;

  // Entrées de navigation, partagées par le panneau desktop et le sélecteur
  // mobile. Projets (tâches nouvellement assignées) et Membres (demandes
  // d'adhésion) ont leur compteur dérivé ; depuis l'audit du 2026-09-24, les
  // autres sections comptent leurs notifications non lues (aucune requête de
  // plus : la boîte de réception les porte déjà).
  const sectionBadges = sectionNotificationBadges(orgNotifications);
  const badgeOf = (id: OrgSection): { count: number; items: string[] } => {
    const extra = (id in sectionBadges) ? sectionBadges[id as BadgeSection] : null;
    const extraItems = extra ? extra.kinds.map((k) => tOrgAdmin(`notifSettings.kind.${k}` as KeyOf<'orgAdmin'>)) : [];
    if (id === 'projects') return { count: badges.projects + (extra?.count ?? 0), items: [...badges.projectItems, ...extraItems] };
    if (id === 'members') return { count: badges.members, items: badges.memberItems };
    return { count: extra?.count ?? 0, items: extraItems };
  };
  const navItems: OrgNavItem[] = ORG_SECTIONS.filter((item) => !item.hidden).filter((item) => (item.id === 'stats' ? canStats : !item.managerOnly || isManager)).map(
    ({ id, labelKey, Icon, group }) => {
      const { count: badgeCount, items } = badgeOf(id);
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
            title={tOrgAdmin(id === 'members' ? 'page.badgePreviewMembers' : id === 'projects' ? 'page.badgePreviewProjects' : 'page.badgePreviewSection')}
            ariaLabel={badgeAriaLabel ?? ''}
            side="left"
            onAccent={tab === id}
          />
        ) : undefined,
      };
    },
  );

  // Quota de sièges RÉELLEMENT bloquant : le gate serveur (`org_seats_allowed`,
  // mig. 067) ne refuse que si le drapeau `enterprise_seat_limit` est activé en
  // base. Tant que la facturation est dormante, les portes d'entrée restent
  // ouvertes — mais le jour où le drapeau passe à true, un clic sur « inviter »
  // partirait vers un `seat_limit_reached` sans que rien ne l'ait annoncé.
  //
  // ⚠️ Le seuil est celui de l'ABONNEMENT, jamais `ORG_FREE_SEATS` en dur : une
  // organisation qui a payé le palier « Département » a 20 sièges, et un gate
  // client resté bloqué à 5 rendrait le paiement sans effet visible — on
  // encaisserait sans rien débloquer. `isQuotaReached` porte exactement la même
  // règle que `org_seats_allowed()` (dont le repli sans abonnement actif EST
  // `ORG_FREE_SEATS`), pour que le client annonce ce que le serveur appliquera.
  const seatsQuota = effectiveQuota(orgSubscription ?? null);
  const seatsFull = ENTERPRISE_BILLING_ENFORCED && isQuotaReached(members.length, orgSubscription ?? null);

  let bannerDismissed = seatsBannerDismissed;
  try {
    bannerDismissed = bannerDismissed || !!localStorage.getItem(seatsBannerKey(myOrg.id));
  } catch { /* localStorage indisponible : bannière visible */ }

  const dismissSeatsBanner = () => {
    setSeatsBannerDismissed(true);
    try { localStorage.setItem(seatsBannerKey(myOrg.id), '1'); } catch { /* no-op */ }
  };

  const hasEntityParam = ['task', 'member', 'project', 'okr', 'team'].some((k) => searchParams.has(k));
  const glossaryButton = (
    <button
      type="button"
      onClick={() => setGlossary(true)}
      aria-label={t('glossary.open')}
      className="min-w-11 min-h-11 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
    >
      <BookOpen size={18} />
    </button>
  );

  return (
    // `md:pr-[232px]` = carte (208) + ses deux marges (12 + 12). La transition
    // suit la même courbe que la carte, pour que les deux bougent ensemble.
    <div
      className={`max-w-[1600px] mx-auto px-4 sm:px-6 py-6 md:transition-[padding] md:duration-300 motion-reduce:transition-none ${
        navMode === 'open' ? 'md:pr-[232px]' : ''
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
        actions={
          <>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setTab('settings')}
                aria-label={tOrgAdmin('page.editProfile')}
                className="min-w-11 min-h-11 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
            )}
            {glossaryButton}
            <OrgNotificationsBell orgId={myOrg.id} members={members} />
          </>
        }
      />

      {/* En-tête desktop (rendu historique, inchangé) */}
      <header className="hidden md:flex flex-wrap items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-primary))] shrink-0 overflow-hidden">
          {myOrg.avatarUrl ? (
            <img src={myOrg.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Building2 size={24} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PageHeading variant="compact" className="truncate">{myOrg.name}</PageHeading>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setTab('settings')}
                aria-label={tOrgAdmin('page.editProfile')}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
            {tpOrgAdmin('page.memberCount', members.length)}
            {myOrg.industry ? ` · ${myOrg.industry}` : ''}
          </p>
          {myOrg.description && (
            <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5 line-clamp-1">{myOrg.description}</p>
          )}
        </div>
        {/* La pastille « Forfait » est retirée de l'en-tête (maquette du
            2026-09-27) : le forfait reste atteignable, pour le seul
            propriétaire, depuis Paramètres (`OrgSettingsSection`, section
            « Forfait et facturation »), qui est une section de navigation
            ordinaire, donc accessible en desktop comme en mobile. */}
        {/* Les triggers de la mig. 095 et le job pg_cron de la 096 ecrivaient
            dans `org_notifications` sans qu'aucun ecran ne les lise. */}
        {/* Glossaire (cohérence globale) : les mots du mode entreprise, définis. */}
        {glossaryButton}
        <OrgNotificationsBell orgId={myOrg.id} members={members} />
      </header>

      {/* Bannière freemium — informative tant que ENTERPRISE_BILLING_ENFORCED
          est false (gate dormant ; le vrai blocage sera côté serveur).
          #5 : dismissible (persistant par org) tant qu'elle est informative. */}
      {members.length >= (seatsQuota ?? Infinity) && (ENTERPRISE_BILLING_ENFORCED || !bannerDismissed) && (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">
            <span className="font-semibold text-[rgb(var(--color-text-primary))]">{tpOrgAdmin('page.memberCountDot', members.length)}</span>{' '}
            {ENTERPRISE_BILLING_ENFORCED
              ? tOrgAdmin('page.freemiumOver')
              : tOrgAdmin('page.freemiumInfo')}
          </p>
          {!ENTERPRISE_BILLING_ENFORCED && (
            <button
              type="button"
              onClick={dismissSeatsBanner}
              aria-label={tOrgAdmin('page.hideInfo')}
              className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface))] transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Mobile : la section courante devient un sélecteur (maquette M1).
          Desktop : la navigation vit à droite, dans `OrgSideNav`. */}
      <OrgSectionSwitcher items={navItems} activeId={tab} shortcuts={shortcuts} onSearch={openSearch} />

      {/* Contenu */}
      {/* Une seule frontière Suspense pour tout le contenu : les onglets sont
          exclusifs, et le fallback est choisi d'après l'onglet demandé — celui
          de l'onglet Tâches ressemble à sa table, celui des Statistiques à ses
          tuiles. Un fallback générique pour tous aurait fait clignoter une
          forme qui n'est pas celle qui arrive. */}
      <Suspense fallback={tabFallback(tab, tOrgAdmin)}>
      {tab === 'overview' && (
        <MyWorkTab orgId={myOrg.id} members={members} currentUserId={user?.id} isManager={isManager} />
      )}
      {tab === 'stats' && canStats && (
        <TeamOverviewTab orgId={myOrg.id} members={members} isAdmin={isAdmin} currentUserId={user?.id} />
      )}
      {tab === 'pyramid' && isManager && (
        <PyramidTab
          orgId={myOrg.id}
          ownerId={myOrg.ownerId}
          members={members}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          loading={membersLoading}
        />
      )}
      {tab === 'tasks' && (
        <TeamTasksTab orgId={myOrg.id} members={members} currentUserId={user?.id} isManager={isManager} isAdmin={isAdmin} />
      )}
      {tab === 'projects' && (
        <TeamProjectsTab orgId={myOrg.id} members={members} currentUserId={user?.id} isManager={isManager} isAdmin={isAdmin} />
      )}
      {tab === 'okr' && <TeamOKRTab orgId={myOrg.id} />}
      {tab === 'billing' && (
        <OrgBillingTab
          orgId={myOrg.id}
          isOwner={isOwner}
          onBack={() => setTab('overview')}
        />
      )}

      {tab === 'members' && (
        <OrgMembersSection
          org={myOrg}
          members={members}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          isManager={isManager}
          canInvite={canInvite}
          seatsFull={seatsFull}
        />
      )}
      {tab === 'teams' && (teamId ? (
        <TeamPage orgId={myOrg.id} teamId={teamId} members={members} currentUserId={user?.id} isAdmin={isAdmin} />
      ) : (
        <TeamsSection
          orgId={myOrg.id}
          members={members}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          canCreateTeam={myPermissions.can['team.create']}
        />
      ))}
      {tab === 'settings' && (
        <OrgSettingsSection
          org={myOrg}
          members={members}
          currentUserId={user?.id}
          isOwner={isOwner}
          isAdmin={isAdmin}
          isManager={isManager}
          canInvite={canInvite}
          seatsFull={seatsFull}
          seatsQuota={seatsQuota}
          canReports={canReports && !teamsLoading && !myPermissions.isLoading}
          initialPanel={urlTab === 'reports' ? 'reports' : undefined}
        />
      )}
      </Suspense>

      {/* Feuilles et dialogues : leur propre frontière, avec un fallback nul.
          Ils s'ouvrent par-dessus l'écran ; y poser un squelette ferait
          clignoter une carte fantôme au milieu de la page pendant que le
          chunk arrive. */}
      <Suspense fallback={null}>
      </Suspense>

      {/* Desktop : la navigation vit à DROITE, hors de la zone qui défile.
          Rendue par portail dans l'emplacement de `Layout`, donc sa place
          dans cet arbre ne dit rien de sa place à l'écran. */}
      <OrgSideNav
        items={navItems}
        activeId={tab}
        mode={navMode}
        onModeChange={setNavMode}
        shortcuts={shortcuts}
        onTogglePin={togglePin}
        onSearch={openSearch}
      />

      {/* Premier passage dans CETTE entreprise : les lieux à connaître.
          Jamais en démo, jamais par-dessus un lien profond (on vient alors
          pour la fiche, pas pour une visite). */}
      {!welcomeClosed && !isDemo && !hasEntityParam && user?.id && !readMemberWelcomeSeen(myOrg.id, user.id) && (
        <Suspense fallback={null}>
          <MemberWelcome
            orgName={myOrg.name}
            isAdmin={isAdmin}
            onClose={() => {
              markMemberWelcomeSeen(myOrg.id, user.id);
              setWelcomeClosed(true);
            }}
          />
        </Suspense>
      )}

      {/* Liens profonds : `?task=`, `?member=`, `?project=`, `?okr=`, `?team=`
          ouvrent leur fiche quelle que soit la section affichée. */}
      {(glossary || hasEntityParam) && (
        <Suspense fallback={null}>
          <OrgPageOverlays
            glossaryOpen={glossary}
            onCloseGlossary={() => setGlossary(false)}
            deepLink={hasEntityParam
              ? { orgId: myOrg.id, section: teamId ? 'teams' : tab, members, currentUserId: user?.id, isAdmin, isManager }
              : null}
          />
        </Suspense>
      )}
    </div>
  );
};

export default OrganizationPage;
