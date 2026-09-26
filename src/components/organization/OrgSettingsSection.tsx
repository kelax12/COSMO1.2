import { Suspense, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Building2, CreditCard, Mail, Pencil } from 'lucide-react';
import { useMyOrgPermissions, isManagerOf, type MyOrganization, type OrgMember } from '@/modules/organizations';
import { useOrgTeams } from '@/modules/org-teams';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import TeamCategoryFilterBar from './TeamCategoryFilterBar';
import NotificationPreferences from './NotificationPreferences';
import OrgSettingsPermissions from './OrgSettingsPermissions';
import AuditLogView from './AuditLogView';
import OrgDangerZone from './OrgDangerZone';
import EmailInvitationsList from './EmailInvitationsList';
import { orgSectionPath } from './deep-link.helpers';
import type { KeyOf } from '@/i18n/catalog';
import { useT } from '@/i18n/useT';

const OrgProfileSheet = lazyWithRetry(() => import('./OrgProfileSheet'));
const InviteByEmailDialog = lazyWithRetry(() => import('./InviteByEmailDialog'));
const OrgJoinCodeCard = lazyWithRetry(() => import('./OrgJoinCodeCard'));
const OrgInviteLinkCard = lazyWithRetry(() => import('./OrgInviteLinkCard'));
const InviteFriendsToOrg = lazyWithRetry(() => import('./InviteFriendsToOrg'));

export const SETTINGS_TABS = [
  'profile', 'invitations', 'categories', 'permissions', 'notifications', 'audit', 'billing', 'danger',
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

interface OrgSettingsSectionProps {
  org: MyOrganization;
  members: OrgMember[];
  currentUserId?: string;
  isOwner: boolean;
  isAdmin: boolean;
  seatsFull: boolean;
}

/**
 * Paramètres de l'organisation (audit 2026-09-23, M13).
 *
 * Les réglages étaient éparpillés : le profil derrière un crayon, la
 * facturation derrière une pastille, les catégories sous « Objectifs », la zone
 * de danger au bas de Membres, les invitations mêlées à l'annuaire. Ils ont
 * désormais une adresse chacun : `/entreprise/settings?tab=…`.
 *
 * Chaque onglet n'apparaît qu'à qui peut s'en servir. « Notifications » et
 * « Zone de danger » (pour quitter) concernent tout le monde.
 */
const OrgSettingsSection = ({ org, members, currentUserId, isOwner, isAdmin, seatsFull }: OrgSettingsSectionProps) => {
  const { t } = useT('org');
  const { can } = useMyOrgPermissions(org.id);
  const { data: teams = [] } = useOrgTeams(org.id);
  const [params, setParams] = useSearchParams();
  const [editingProfile, setEditingProfile] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());
  const isManager = isAdmin || (!!currentUserId && isManagerOf(members, currentUserId));

  const tabs = useMemo<SettingsTab[]>(() => SETTINGS_TABS.filter((tab) => {
    switch (tab) {
      case 'profile': return isAdmin;
      case 'invitations': return can['member.invite'];
      case 'categories': return can['category.manage'];
      case 'permissions': return isManager;
      case 'audit': return isAdmin;
      case 'billing': return isOwner;
      default: return true;
    }
  }), [isAdmin, isOwner, isManager, can]);

  const requested = params.get('tab');
  const tab: SettingsTab = tabs.includes(requested as SettingsTab) ? (requested as SettingsTab) : tabs[0];
  const selectTab = (next: SettingsTab) => {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-1 px-1" role="tablist" aria-label={t('settings.title')}>
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => selectTab(id)}
            className={`shrink-0 min-h-10 px-3.5 rounded-lg text-sm font-medium border transition-colors ${
              tab === id
                ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
                : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
            }`}
          >
            {t(`settings.tab_${id}` as KeyOf<'org'>)}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'profile' && (
          <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center overflow-hidden shrink-0">
              {org.avatarUrl ? <img src={org.avatarUrl} alt="" className="w-full h-full object-cover" /> : <Building2 size={22} aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-[rgb(var(--color-text-primary))]">{org.name}</p>
              {org.industry && <p className="text-sm text-[rgb(var(--color-text-secondary))]">{org.industry}</p>}
              <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1 whitespace-pre-wrap">{org.description || t('settings.noDescription')}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingProfile(true)}
              className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-lg border border-[rgb(var(--color-border))] text-sm font-medium hover:bg-[rgb(var(--color-hover))]"
            >
              <Pencil size={14} aria-hidden="true" /> {t('page.editProfile')}
            </button>
          </div>
        )}

        {tab === 'invitations' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('settings.invitationsIntro')}</p>
              <button
                type="button"
                onClick={() => setInviting(true)}
                disabled={seatsFull}
                className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-lg text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-50"
              >
                <Mail size={15} aria-hidden="true" /> {t('invites.emailTitle')}
              </button>
            </div>
            <EmailInvitationsList orgId={org.id} />
            <Suspense fallback={null}>
              <div className={`grid gap-4 items-start ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                <OrgJoinCodeCard code={org.joinCode ?? ''} orgId={org.id} isAdmin={isAdmin} seatsFull={seatsFull} />
                <OrgInviteLinkCard orgId={org.id} managerId={currentUserId} seatsFull={seatsFull} />
                {isAdmin && <InviteFriendsToOrg orgId={org.id} variant="card" />}
              </div>
            </Suspense>
          </div>
        )}

        {tab === 'categories' && (
          <div className="space-y-2">
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('settings.categoriesIntro')}</p>
            <TeamCategoryFilterBar
              orgId={org.id}
              activeCategoryIds={activeCategoryIds}
              setActiveCategoryIds={setActiveCategoryIds}
              canManage
            />
          </div>
        )}

        {tab === 'permissions' && (
          <OrgSettingsPermissions orgId={org.id} members={members} currentUserId={currentUserId} isAdmin={isAdmin} />
        )}
        {tab === 'notifications' && <NotificationPreferences orgId={org.id} />}
        {tab === 'audit' && <AuditLogView orgId={org.id} members={members} teams={teams} />}

        {tab === 'billing' && (
          <Link
            to={orgSectionPath('billing')}
            className="flex items-center gap-3 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 hover:bg-[rgb(var(--color-hover))]"
          >
            <CreditCard size={20} aria-hidden="true" />
            <span className="text-sm">
              <span className="block font-semibold text-[rgb(var(--color-text-primary))]">{t('settings.billingTitle')}</span>
              <span className="block text-[rgb(var(--color-text-muted))]">{t('settings.billingHint')}</span>
            </span>
          </Link>
        )}

        {tab === 'danger' && <OrgDangerZone org={org} members={members} isOwner={isOwner} />}
      </div>

      <Suspense fallback={null}>
        {editingProfile && <OrgProfileSheet org={org} onClose={() => setEditingProfile(false)} />}
        {inviting && (
          <InviteByEmailDialog
            orgId={org.id}
            members={members}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onClose={() => setInviting(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default OrgSettingsSection;
