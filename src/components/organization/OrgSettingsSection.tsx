import { Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRightLeft, Bell, Building2, Check, ChevronRight, LogOut, Plus, Trash2, Users } from 'lucide-react';
import { useActiveOrganization, type Organization, type OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import { buildOrgLink } from './deep-link.helpers';
import OrgPlanChip from './OrgPlanChip';
import OrgProfileForm from './OrgProfileForm';
import MyPermissionsCard from './MyPermissionsCard';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

const OrgNotificationSettingsDialog = lazyWithRetry(() => import('./OrgNotificationSettingsDialog'));

interface OrgSettingsSectionProps {
  org: Organization;
  members: OrgMember[];
  currentUserId?: string;
  isOwner: boolean;
  isAdmin: boolean;
  transferPending: boolean;
  deletePending: boolean;
  leavePending: boolean;
  onTransfer: () => void;
  onDelete: () => void;
  onLeave: () => void;
}

const CARD = 'rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4';
const TITLE = 'text-sm font-bold text-[rgb(var(--color-text-primary))]';
const HINT = 'text-xs text-[rgb(var(--color-text-muted))] mt-0.5';

/**
 * Paramètres de l'organisation (M13, audit du 2026-09-24).
 *
 * Les réglages étaient éparpillés : le profil sous un crayon de l'en-tête, la
 * zone dangereuse au pied de l'annuaire, le changement d'organisation dans la
 * barre latérale de l'APPLICATION, loin de l'espace entreprise. Un admin ne
 * savait pas où chercher. Tout ce qui règle l'organisation elle-même est ici ;
 * ce qui règle une PERSONNE (invitations, équipes, droits) reste dans Membres,
 * vers laquelle cette page renvoie.
 *
 * ⚠️ Chaque bloc garde la garde d'affichage qu'il avait à son ancienne place
 * (C-39 : la zone dangereuse est au seul propriétaire). Ce n'est que
 * l'affichage : les règles vivent côté serveur (`delete_organization`, mig. 138).
 */
const OrgSettingsSection = ({
  org, members, currentUserId, isOwner, isAdmin,
  transferPending, deletePending, leavePending,
  onTransfer, onDelete, onLeave,
}: OrgSettingsSectionProps) => {
  const { t } = useT('org');
  const { t: ta } = useT('orgAdmin');
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const { organizations, setActiveOrgId } = useActiveOrganization();

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Profil : ÉDITÉ ici depuis l'audit du 2026-09-24 (il vivait dans une
          feuille ouverte par un crayon de l'en-tête, qui mène désormais ici). */}
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

      {/* Mes droits (audit du 2026-09-24) : la règle surcharge > défaut >
          admin était juste mais invisible pour la personne concernée. */}
      <section className={CARD}>
        <h2 className={TITLE}>{ta('myRights.title')}</h2>
        <div className="mt-2">
          <MyPermissionsCard orgId={org.id} members={members} currentUserId={currentUserId} />
        </div>
      </section>

      {/* Notifications (M14) : la cloche disparaît quand elle est vide, ses
          préférences doivent rester atteignables. */}
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
        {notifOpen && (
          <Suspense fallback={null}>
            <OrgNotificationSettingsDialog orgId={org.id} open={notifOpen} onOpenChange={setNotifOpen} />
          </Suspense>
        )}
      </section>

      {/* Mes organisations : le changement vivait dans la barre latérale de
          l'application, et seulement quand on en avait plusieurs. */}
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

      {/* Forfait : au seul propriétaire, comme la pastille de l'en-tête. */}
      {isOwner && (
        <section className={CARD}>
          <h2 className={TITLE}>{t('orgSettings.planTitle')}</h2>
          <p className={`${HINT} mb-3`}>{t('orgSettings.planHint')}</p>
          <OrgPlanChip orgId={org.id} active={false} onOpen={() => navigate(buildOrgLink('billing'))} />
        </section>
      )}

      {/* Ce qui règle une personne reste dans Membres : on y renvoie. */}
      <section className={CARD}>
        <Link to={buildOrgLink('members')} className="flex items-center gap-3 -m-1 p-1 rounded-xl hover:bg-[rgb(var(--color-hover))] transition-colors">
          <Users size={18} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
          <span className="flex-1 min-w-0">
            <span className={`block ${TITLE}`}>{t('orgSettings.membersTitle')}</span>
            <span className={`block ${HINT}`}>{t('orgSettings.membersHint')}</span>
          </span>
          <span className="sr-only">{t('orgSettings.membersLink')}</span>
          <ChevronRight size={16} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
        </Link>
      </section>

      {/* #5 : le PROPRIÉTAIRE ne « quitte » pas, il peut supprimer l'entreprise
          (confirmation extrême, façon GitHub). Tous les autres, admins compris,
          quittent.

          🔴 C-39 : cette zone était montée sur `isAdmin`, alors que « Transférer
          la propriété » était déjà réservé au propriétaire. Un second admin, qui
          ne paie rien, supprimait l'organisation, et le propriétaire restait
          débité d'un abonnement Stripe qui, lui, courait toujours. La règle vit
          dans `delete_organization` (mig. 138), seule porte vers un DELETE. */}
      {isOwner ? (
        <section className="rounded-2xl border border-red-300/60 dark:border-red-700/40 bg-red-50/40 dark:bg-red-900/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-red-600 dark:text-red-400">{t('page.dangerZone')}</h2>
            <p className={HINT}>{t('page.dangerHint')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {members.length > 1 && (
              <button
                type="button"
                onClick={onTransfer}
                disabled={transferPending}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-60 transition-colors"
              >
                <ArrowRightLeft size={15} aria-hidden="true" /> {t('page.transferOwnership')}
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={deletePending}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              <Trash2 size={15} aria-hidden="true" /> {t('page.deleteOrg')}
            </button>
          </div>
        </section>
      ) : (
        <div>
          <button
            type="button"
            onClick={onLeave}
            disabled={leavePending}
            className="inline-flex items-center gap-1.5 min-h-11 text-sm font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
          >
            <LogOut size={15} aria-hidden="true" /> {t('page.leaveOrg')}
          </button>
        </div>
      )}
    </div>
  );
};

export default OrgSettingsSection;
