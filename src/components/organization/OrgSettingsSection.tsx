import { Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  AlertTriangle, ArrowRightLeft, ArrowUpRight, Bell, Building2, Check, ChevronRight, Download, History, KeyRound, ListPlus,
  Lock, LogOut, Plug, Plus, Receipt, Repeat, ShieldCheck, SlidersHorizontal, Tags, Trash2, UserPlus, Users, Zap,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import {
  useActiveOrganization,
  useMyOrgPermissions,
  useLeaveOrganization,
  useTransferOwnership,
  type MyOrganization,
  type OrgMember,
} from '@/modules/organizations';
import { useDeleteOrgFlow } from '@/pages/organization/useDeleteOrgFlow';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { OrgConfigSettings } from '@/components/organization/org-config.lazy';
import { buildOrgLink } from './deep-link.helpers';
import OrgPlanChip from './OrgPlanChip';
import OrgProfileForm from './OrgProfileForm';
import MyPermissionsCard from './MyPermissionsCard';
import { useT } from '@/i18n/useT';

// Section Paramètres, `/entreprise/settings` (audit Membres du 2026-09-24 :
// « quatre pages en une »). Elle reprend à `/entreprise/members` les
// invitations et la zone de danger, qui n'avaient rien à faire au-dessus d'un
// annuaire de cent personnes.
//
// ⚠️ Pas de catalogue demandé à `lazyWithRetry` : ceux de l'espace entreprise
// sont déclarés par la ROUTE (`App.tsx`), la seule que lit
// `lazy-namespaces.guard.test.ts`.
const InviteByEmailDialog = lazyWithRetry(() => import('@/components/organization/InviteByEmailDialog'));
const DeleteOrganizationDialog = lazyWithRetry(() => import('@/components/organization/DeleteOrganizationDialog'));
const ConfirmLeaveOrgDialog = lazyWithRetry(() => import('@/components/organization/ConfirmLeaveOrgDialog'));
const TransferOwnershipDialog = lazyWithRetry(() => import('@/components/organization/TransferOwnershipDialog'));
const OrgInviteSection = lazyWithRetry(() => import('@/components/organization/OrgInviteSection'));
const OrgNotificationSettingsDialog = lazyWithRetry(() => import('@/components/organization/OrgNotificationSettingsDialog'));
const OffboardMemberDialog = lazyWithRetry(() => import('@/components/organization/OffboardMemberDialog'));
// M13 : catégories et droits quittent l'onglet OKR et l'annuaire pour Paramètres.
const TeamCategoryTreeManager = lazyWithRetry(() => import('@/components/organization/TeamCategoryTreeManager'));
const OrgSettingsPermissions = lazyWithRetry(() => import('@/components/organization/OrgSettingsPermissions'));
// Journal d'audit (mig. 162) : admins seuls, chargé à l'ouverture de Paramètres.
// Ses textes vivent dans `orgAccount` (surfaces rares) : `org` est payé par
// toute visite de /entreprise, pas le journal. Le catalogue est déclaré sur la
// section, dans `OrganizationPage` (seul hôte que la garde des namespaces lit).
const OrgReportsSection = lazyWithRetry(() => import('@/components/organization/OrgReportsSection'));
const OrgAuditLogSection = lazyWithRetry(() => import('@/components/organization/OrgAuditLogSection'));
// Export CSV des tâches : quitte la barre de l'onglet Tâches (2026-09-28).
const OrgTasksExportSection = lazyWithRetry(() => import('@/components/organization/OrgTasksExportSection'));
// Réglages, Sécurité, champs, automatisations, intégrations (mig. 195-199) :
// leur catalogue `orgConfig` voyage avec eux (`org-config.lazy.ts`).

interface OrgSettingsSectionProps {
  org: MyOrganization;
  members: OrgMember[];
  currentUserId?: string;
  isOwner: boolean;
  isAdmin: boolean;
  /** A au moins un subordonné (ou admin) : condition d'une invitation placée. */
  isManager: boolean;
  canInvite: boolean;
  seatsFull: boolean;
  /** Places du forfait en vigueur (`effectiveQuota`), `null` = illimité. */
  seatsQuota: number | null;
  /** Droit de lire au moins un rapport d'activité (entreprise ou équipe). */
  canReports?: boolean;
  /** Panneau ouvert à l'arrivée (ancienne adresse `/entreprise/reports`). */
  initialPanel?: 'reports';
}

type ConfigPart = 'general' | 'security' | 'fields' | 'automations' | 'integrations';
type PanelId =
  | ConfigPart
  | 'profile' | 'orgs' | 'invite' | 'myRights' | 'permissions' | 'categories'
  | 'notifications' | 'export' | 'reports' | 'audit' | 'plan' | 'danger';
interface NavGroup {
  label: string;
  items: { id: PanelId; icon: LucideIcon; label: string }[];
}
const CONFIG_PARTS: readonly string[] = ['general', 'security', 'fields', 'automations', 'integrations'];
const isConfigPart = (id: PanelId): id is ConfigPart => CONFIG_PARTS.includes(id);

const CARD = 'rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4';
const TITLE = 'text-sm font-bold text-[rgb(var(--color-text-primary))]';
const HINT = 'text-xs text-[rgb(var(--color-text-muted))] mt-0.5';

/**
 * Paramètres de l'organisation, `/entreprise/settings`. Réunit deux audits du
 * 2026-09-24 menés en parallèle : M13 (profil, organisations, forfait et zone
 * de danger au même endroit) et l'audit Membres (« quatre pages en une » :
 * les invitations quittent le haut de l'annuaire).
 *
 * ⚠️ Chaque bloc garde la garde d'affichage qu'il avait à son ancienne place
 * (C-39 : la zone dangereuse est au seul propriétaire). Ce n'est que
 * l'affichage : les règles vivent côté serveur (`delete_organization`, mig. 138).
 */
const OrgSettingsSection = ({
  org,
  members,
  currentUserId,
  isOwner,
  isAdmin,
  isManager,
  canInvite,
  seatsFull,
  seatsQuota,
  canReports = false,
  initialPanel,
}: OrgSettingsSectionProps) => {
  const { t } = useT('org');
  const { t: ta } = useT('orgAdmin');
  const [notifOpen, setNotifOpen] = useState(false);
  // Quitter en ayant d'abord tout transmis (audit du 2026-09-24, étape 3) :
  // l'assistant de départ en mode `transfer` SEUL, jamais suspendre ou
  // retirer soi-même.
  const [organizingLeave, setOrganizingLeave] = useState(false);
  const me = members.find((m) => m.userId === currentUserId);
  const { can } = useMyOrgPermissions(org.id);
  const canManageCategories = isAdmin || can['category.manage'];
  // Ici la barre ne filtre rien : son état de sélection reste local.
  const navigate = useNavigate();
  const { organizations, setActiveOrgId } = useActiveOrganization();
  const [invitingByEmail, setInvitingByEmail] = useState(false);
  const [quickEmails, setQuickEmails] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const leaveMutation = useLeaveOrganization();
  const transferMutation = useTransferOwnership();
  // C-39 — « la suppression resilie ET REMBOURSE » (arbitrage du 2026-09-03) :
  // un seul geste, aucun debit orphelin. L'enchainement et son ordre vivent
  // dans `useDeleteOrgFlow`, avec la raison de cet ordre.
  const deleteFlow = useDeleteOrgFlow(() => setConfirmingDelete(false));

  // Miroir de `create_org_email_invitations` (mig. 161) : un admin, ou un
  // manager qui a le droit `member.invite` (il place alors sous lui-même).
  const canInviteByEmail = isAdmin || (canInvite && isManager);

  // Barre latérale (maquette du 2026-09-27) : une rubrique à la fois. Chaque
  // entrée porte la MÊME garde que le bloc qu'elle ouvre : une rubrique
  // invisible n'apparaît pas non plus dans le menu.
  const allGroups: NavGroup[] = [
    { label: t('orgSettings.groupCompany'), items: [
      { id: 'profile', icon: Building2, label: t('orgSettings.navProfile') },
      { id: 'general', icon: SlidersHorizontal, label: t('orgSettings.navGeneral') },
      { id: 'orgs', icon: Repeat, label: t('orgSettings.navOrgs') },
    ] },
    { label: t('orgSettings.groupAccess'), items: [
      { id: 'invite', icon: UserPlus, label: t('orgSettings.navInvite') },
      { id: 'myRights', icon: ShieldCheck, label: t('orgSettings.navMyRights') },
      ...(isAdmin ? [{ id: 'permissions' as const, icon: KeyRound, label: t('orgSettings.navPermissions') }] : []),
      ...(isAdmin ? [{ id: 'security' as const, icon: Lock, label: t('orgSettings.navSecurity') }] : []),
    ] },
    { label: t('orgSettings.groupWork'), items: [
      ...(canManageCategories ? [{ id: 'categories' as const, icon: Tags, label: t('orgSettings.navCategories') }] : []),
      ...(isAdmin ? [{ id: 'fields' as const, icon: ListPlus, label: t('orgSettings.navFields') }] : []),
      ...(isAdmin ? [{ id: 'automations' as const, icon: Zap, label: t('orgSettings.navAutomations') }] : []),
    ] },
    { label: t('orgSettings.groupTracking'), items: [
      { id: 'integrations', icon: Plug, label: t('orgSettings.navIntegrations') },
      { id: 'notifications', icon: Bell, label: t('orgSettings.navNotifications') },
      ...(canReports ? [{ id: 'reports' as const, icon: FileText, label: t('orgSettings.navReports') }] : []),
      { id: 'export', icon: Download, label: t('orgSettings.navExport') },
      ...(isAdmin ? [{ id: 'audit' as const, icon: History, label: t('orgSettings.navAudit') }] : []),
      ...(isOwner ? [{ id: 'plan' as const, icon: Receipt, label: t('orgSettings.navPlan') }] : []),
    ] },
  ];
  const groups = allGroups.filter((g) => g.items.length > 0);
  const visibleIds = new Set<PanelId>(['danger', ...groups.flatMap((g) => g.items.map((i) => i.id))]);
  const [requested, setActive] = useState<PanelId>(initialPanel ?? 'profile');
  // Un droit retiré en cours de visite referme la rubrique, il ne l'affiche pas vide.
  const active: PanelId = visibleIds.has(requested) ? requested : 'profile';

  const navButton = (id: PanelId, Icon: LucideIcon, label: string, danger = false) => (
    <button
      key={id}
      type="button"
      onClick={() => setActive(id)}
      aria-current={active === id ? 'page' : undefined}
      className={`shrink-0 md:w-full min-h-9 flex items-center gap-2 px-2.5 rounded-lg text-sm text-left whitespace-nowrap transition-colors ${
        active === id
          ? 'bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] font-semibold'
          : danger
            ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
            : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
      }`}
    >
      <Icon size={15} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="max-w-5xl md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:items-start">
      <nav
        aria-label={t('orgSettings.navLabel')}
        className="mb-4 md:mb-0 md:sticky md:top-4 flex md:block gap-1 overflow-x-auto [scrollbar-width:none] md:overflow-visible -mx-1 px-1 pb-1 md:p-3 md:mx-0 md:rounded-2xl md:border md:border-[rgb(var(--color-border))] md:bg-[rgb(var(--color-surface))]"
      >
        {groups.map((g) => (
          <div key={g.label} className="contents md:block md:mb-3">
            <p className="hidden md:block px-2.5 mb-1 text-caption font-semibold text-[rgb(var(--color-text-muted))]">{g.label}</p>
            {g.items.map((i) => navButton(i.id, i.icon, i.label))}
            {g.label === t('orgSettings.groupAccess') && (
              <Link
                to={buildOrgLink('members')}
                className="shrink-0 md:w-full min-h-9 flex items-center gap-2 px-2.5 rounded-lg text-sm whitespace-nowrap text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
              >
                <Users size={15} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{t('orgSettings.navPeople')}</span>
                <ArrowUpRight size={13} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
              </Link>
            )}
          </div>
        ))}
        <div className="contents md:block md:pt-2 md:border-t md:border-[rgb(var(--color-border))]">
          {navButton('danger', isOwner ? AlertTriangle : LogOut, isOwner ? t('orgSettings.navDanger') : t('orgSettings.navLeave'), true)}
        </div>
      </nav>

      <div className="space-y-5 min-w-0">
      {/* Profil : ÉDITÉ ici depuis l'audit du 2026-09-24 (il vivait dans une
          feuille ouverte par un crayon de l'en-tête, qui mène désormais ici). */}
      {active === 'profile' && (
      <section className={CARD} id="org-profile">
        <h2 className={TITLE}>{t('orgSettings.profileTitle')}</h2>
        {isAdmin ? (
          <div className="mt-3"><OrgProfileForm org={org} /></div>
        ) : (
          <div className="flex items-start gap-3 mt-2">
            <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] flex items-center justify-center shrink-0 overflow-hidden">
              {org.avatarUrl ? (
                <img src={org.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={22} aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[rgb(var(--color-text-primary))] truncate">
                {org.name}
                {org.industry ? <span className="text-[rgb(var(--color-text-muted))]"> · {org.industry}</span> : null}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5">
                {org.description || t('orgSettings.noDescription')}
              </p>
              <p className={HINT}>{t('orgSettings.profileReadOnly')}</p>
            </div>
          </div>
        )}
      </section>
      )}

      {/* Mes droits (audit du 2026-09-24) : la règle surcharge > défaut >
          admin était juste mais invisible pour la personne concernée. */}
      {active === 'myRights' && (
      <section className={CARD}>
        <h2 className={TITLE}>{ta('myRights.title')}</h2>
        <div className="mt-2">
          <MyPermissionsCard orgId={org.id} members={members} currentUserId={currentUserId} />
        </div>
      </section>
      )}

      {/* Catégories (M13) : elles classent projets, tâches ET objectifs de
          toute l'organisation ; leur gestion vivait sous l'onglet OKR. */}
      {active === 'categories' && canManageCategories && (
        <section className={CARD}>
          <h2 className={TITLE}>{t('settings.tab_categories')}</h2>
          <p className={`${HINT} mb-3`}>{t('settings.categoriesIntro')}</p>
          <Suspense fallback={null}>
            <TeamCategoryTreeManager orgId={org.id} />
          </Suspense>
        </section>
      )}

      {/* Rôles et permissions (M13) : qui a des droits différents de son rôle,
          en un tableau, au lieu d'ouvrir chaque fiche de l'annuaire. */}
      {active === 'permissions' && isAdmin && (
        <section className={CARD}>
          <h2 className={TITLE}>{t('settings.tab_permissions')}</h2>
          <div className="mt-2">
            <Suspense fallback={null}>
              <OrgSettingsPermissions orgId={org.id} members={members} currentUserId={currentUserId} isAdmin={isAdmin} />
            </Suspense>
          </div>
        </section>
      )}

      {/* Configuration d'entreprise (audit du 2026-09-24) : réglages propres,
          rubrique Sécurité (M13), champs, automatisations, intégrations. */}
      {isConfigPart(active) && (
        <Suspense fallback={null}>
          <OrgConfigSettings orgId={org.id} members={members} currentUserId={currentUserId} isAdmin={isAdmin} part={active} />
        </Suspense>
      )}

      {/* Notifications (M14) : la cloche disparaît quand elle est vide, ses
          préférences doivent rester atteignables. */}
      {active === 'notifications' && (
      <section className={CARD}>
        <button
          type="button"
          onClick={() => setNotifOpen(true)}
          className="w-full flex items-center gap-3 -m-1 p-1 rounded-xl text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
        >
          <Bell size={18} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
          <span className="flex-1 min-w-0">
            <span className={`block ${TITLE}`}>{t('notifSettings.title')}</span>
            <span className={`block ${HINT}`}>{t('orgSettings.notificationsHint')}</span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
        </button>
      </section>
      )}

      {/* Mes organisations : le changement vivait dans la barre latérale de
          l'application, et seulement quand on en avait plusieurs. */}
      {active === 'orgs' && (
      <section className={CARD}>
        <h2 className={TITLE}>{t('orgSettings.orgsTitle')}</h2>
        <p className={HINT}>{t('orgSettings.orgsHint')}</p>
        <ul className="mt-3 space-y-1">
          {organizations.map((o) => {
            const current = o.id === org.id;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={current}
                  onClick={() => { setActiveOrgId(o.id); navigate('/entreprise'); }}
                  className="w-full min-h-11 flex items-center gap-2.5 px-2 rounded-xl text-left hover:bg-[rgb(var(--color-hover))] disabled:hover:bg-transparent transition-colors"
                >
                  <Building2 size={15} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{o.name}</span>
                  {o.myRole === 'admin' && (
                    <span className="text-caption font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      {t('common.adminBadge')}
                    </span>
                  )}
                  {current ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check size={13} aria-hidden="true" /> {t('orgSettings.current')}
                    </span>
                  ) : (
                    <span className="text-xs text-[rgb(var(--color-accent))]">{t('orgSettings.open')}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <Link
          to="/entreprise/onboarding"
          className="mt-2 inline-flex items-center gap-1.5 px-2 min-h-11 text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          <Plus size={14} aria-hidden="true" /> {t('switcher.createOrJoin')}
        </Link>
      </section>
      )}

      {/* Forfait : au seul propriétaire, comme la pastille de l'en-tête. */}
      {active === 'plan' && isOwner && (
        <section className={CARD}>
          <h2 className={TITLE}>{t('orgSettings.planTitle')}</h2>
          <p className={`${HINT} mb-3`}>{t('orgSettings.planHint')}</p>
          <OrgPlanChip orgId={org.id} active={false} onOpen={() => navigate(buildOrgLink('billing'))} />
        </section>
      )}

      {active === 'invite' && (
        <Suspense fallback={null}>
          <OrgInviteSection
            org={org}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            canInvite={canInvite}
            canInviteByEmail={canInviteByEmail}
            seatsFull={seatsFull}
            seatsQuota={seatsQuota}
            memberCount={members.length}
            isOwner={isOwner}
            onInviteByEmail={(emails) => { setQuickEmails(emails); setInvitingByEmail(true); }}
          />
        </Suspense>
      )}

      {active === 'export' && (
        <Suspense fallback={null}>
          <OrgTasksExportSection orgId={org.id} members={members} />
        </Suspense>
      )}

      {/* Rapports d'activité (bêta) : l'utilisateur choisit le périmètre dans le panneau. */}
      {active === 'reports' && canReports && (
        <section className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 md:p-5 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[rgb(var(--color-text-primary))]">
              {t('reports.title')}
              <span className="px-1.5 py-0.5 rounded-md text-caption font-bold uppercase tracking-wide bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]">
                {t('reports.beta')}
              </span>
            </h2>
            <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('reports.betaHint')}</p>
          </div>
          <Suspense fallback={null}>
            <OrgReportsSection orgId={org.id} members={members} currentUserId={currentUserId} />
          </Suspense>
        </section>
      )}

      {/* Journal d'audit : lisible par les admins seuls (RLS `org_audit_log`). */}
      {active === 'audit' && isAdmin && (
        <Suspense fallback={null}>
          <OrgAuditLogSection orgId={org.id} members={members} />
        </Suspense>
      )}

      {/* #5 : le PROPRIETAIRE ne « quitte » pas — il peut supprimer
          l'entreprise (confirmation extrême, façon GitHub). Tous les
          autres, admins compris, quittent.

          🔴 C-39 — cette zone etait montee sur `isAdmin`, alors que le
          bouton « Transferer la propriete » juste a cote etait deja
          reserve au proprietaire : la restriction existait, elle n'avait
          pas ete portee sur le geste DESTRUCTEUR. Une entreprise a deux
          admins ; le second, qui ne paie rien, supprimait l'organisation,
          et le proprietaire continuait d'etre debite d'un abonnement
          Stripe qui, lui, court toujours.

          ⚠️ Ce n'est que l'affichage. La regle vit dans
          `delete_organization` (mig. 138), seule porte vers un DELETE sur
          `organizations`. */}
      {active === 'danger' && (
      <section aria-labelledby="org-danger-title">
        {isOwner ? (
          <div className="rounded-2xl border border-red-300/60 dark:border-red-700/40 bg-red-50/40 dark:bg-red-900/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="org-danger-title" className="text-sm font-bold text-red-600 dark:text-red-400">{t('page.dangerZone')}</h2>
              <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                {t('page.dangerHint')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTransferring(true)}
                  disabled={transferMutation.isPending}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-60 transition-colors"
                >
                  <ArrowRightLeft size={15} aria-hidden="true" /> {t('page.transferOwnership')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={deleteFlow.isPending}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                <Trash2 size={15} aria-hidden="true" /> {t('page.deleteOrg')}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 id="org-danger-title" className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('settings.leaveTitle')}</h2>
            <button
              type="button"
              onClick={() => setConfirmingLeave(true)}
              disabled={leaveMutation.isPending}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
            >
              <LogOut size={15} aria-hidden="true" /> {t('page.leaveOrg')}
            </button>
          </div>
        )}
      </section>
      )}
      </div>

      {/* Dialogues : leur propre frontière, fallback nul (ils s'ouvrent par-dessus). */}
      <Suspense fallback={null}>
        {invitingByEmail && (
          <InviteByEmailDialog
            orgId={org.id}
            members={members}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            initialEmails={quickEmails}
            onClose={() => setInvitingByEmail(false)}
          />
        )}

        {transferring && (
          <TransferOwnershipDialog
            orgName={org.name}
            candidates={members.filter((m) => m.userId !== org.ownerId)}
            pending={transferMutation.isPending}
            onConfirm={(newOwnerId) =>
              transferMutation.mutate(
                { orgId: org.id, newOwnerId },
                { onSuccess: () => setTransferring(false) },
              )
            }
            onCancel={() => setTransferring(false)}
          />
        )}

        {confirmingLeave && (
          <ConfirmLeaveOrgDialog
            orgId={org.id}
            orgName={org.name}
            currentUserId={currentUserId}
            members={members}
            canOrganize={isAdmin}
            onOrganize={() => { setConfirmingLeave(false); setOrganizingLeave(true); }}
            pending={leaveMutation.isPending}
            onConfirm={() =>
              leaveMutation.mutate(org.id, { onSettled: () => setConfirmingLeave(false) })
            }
            onCancel={() => setConfirmingLeave(false)}
          />
        )}

        {organizingLeave && me && (
          <OffboardMemberDialog
            orgId={org.id}
            member={me}
            members={members}
            initialMode="transfer"
            modes={['transfer']}
            onClose={() => setOrganizingLeave(false)}
          />
        )}

        {notifOpen && (
          <OrgNotificationSettingsDialog orgId={org.id} open={notifOpen} onOpenChange={setNotifOpen} />
        )}

        {confirmingDelete && (
          <DeleteOrganizationDialog
            org={org}
            memberCount={members.length}
            pending={deleteFlow.isPending}
            onConfirm={() => deleteFlow.run(org.id)}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default OrgSettingsSection;
