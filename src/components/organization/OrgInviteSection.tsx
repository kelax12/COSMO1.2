import { Suspense, useState } from 'react';
import { Contact, Mail } from 'lucide-react';
import type { MyOrganization } from '@/modules/organizations';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';

// Même règle que dans `OrgSettingsSection` : pas de catalogue demandé ici,
// ceux de l'espace entreprise sont déclarés par la ROUTE.
const InviteFriendsToOrg = lazyWithRetry(() => import('@/components/organization/InviteFriendsToOrg'));
const OrgJoinCodeCard = lazyWithRetry(() => import('@/components/organization/OrgJoinCodeCard'));
const OrgInviteLinkCard = lazyWithRetry(() => import('@/components/organization/OrgInviteLinkCard'));
const OrgJoinRequestsList = lazyWithRetry(() => import('@/components/organization/OrgJoinRequestsList'));
const EmailInvitationsList = lazyWithRetry(() => import('@/components/organization/EmailInvitationsList'));

interface OrgInviteSectionProps {
  org: MyOrganization;
  currentUserId?: string;
  isAdmin: boolean;
  canInvite: boolean;
  /** Miroir de `create_org_email_invitations` (mig. 161). */
  canInviteByEmail: boolean;
  seatsFull: boolean;
  /** Places du forfait en vigueur (`effectiveQuota`), `null` = illimité. */
  seatsQuota: number | null;
  memberCount: number;
  /** Ouvre la fenêtre d'invitation par e-mail, adresses déjà saisies. */
  onInviteByEmail: (emails: string) => void;
}

const CARD = 'rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4';
const TITLE = 'text-sm font-bold text-[rgb(var(--color-text-primary))]';
const HINT = 'text-xs text-[rgb(var(--color-text-muted))] mt-0.5';

/**
 * Rubrique Inviter de Paramètres (maquette du 2026-09-28) : l'e-mail en tête,
 * les trois autres canaux en lignes comparables, puis ce qui attend une
 * réponse. Personnes et Équipes restent atteignables par la barre latérale.
 */
const OrgInviteSection = ({
  org, currentUserId, isAdmin, canInvite, canInviteByEmail, seatsFull, seatsQuota, memberCount, onInviteByEmail,
}: OrgInviteSectionProps) => {
  const { t, tp } = useT('org');
  const [quickEmails, setQuickEmails] = useState('');
  const [showContacts, setShowContacts] = useState(false);

  return (
        <section aria-labelledby="org-invite-title" className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 id="org-invite-title" className={TITLE}>{t('settings.inviteTitle')}</h2>
              <p className={HINT}>{t('settings.inviteHint')}</p>
            </div>
            {/* Places du forfait : la même règle que `org_seats_allowed()`.
                Tant que la facturation dort, un dépassement s'annonce sans
                rien bloquer, comme la bannière de l'en-tête. */}
            <div className="lg:text-right shrink-0 lg:w-52 max-w-xs">
              {seatsQuota == null ? (
                <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                  {tp('invite.seatsUnlimited', memberCount)}
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                    {t('invite.seatsUsed', { used: memberCount, max: seatsQuota })}
                  </p>
                  <div
                    role="meter"
                    aria-label={t('invite.seatsUsed', { used: memberCount, max: seatsQuota })}
                    aria-valuemin={0}
                    aria-valuemax={seatsQuota}
                    aria-valuenow={Math.min(memberCount, seatsQuota)}
                    className="mt-1.5 h-1.5 rounded-full bg-[rgb(var(--color-border))] overflow-hidden"
                  >
                    <div
                      className={`h-full rounded-full ${memberCount >= seatsQuota ? 'bg-amber-500' : 'bg-[rgb(var(--color-accent))]'}`}
                      style={{ width: `${Math.min(100, (memberCount / Math.max(seatsQuota, 1)) * 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${memberCount >= seatsQuota ? 'text-amber-600 dark:text-amber-400' : 'text-[rgb(var(--color-text-muted))]'}`}>
                    {seatsFull
                      ? t('invite.seatsFullNow')
                      : memberCount >= seatsQuota
                        ? t('invite.seatsOver')
                        : tp('invite.seatsLeft', seatsQuota - memberCount)}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* M11 : l'invitation par e-mail est le canal par défaut d'une
              entreprise. Le lien est NOMINATIF, déjà placé dans la pyramide et
              dans des équipes : le champ rapide ouvre la fenêtre de placement
              déjà remplie, il n'envoie rien seul. */}
          {canInviteByEmail && (
            <form
              className={`${CARD} space-y-2`}
              onSubmit={(e) => { e.preventDefault(); onInviteByEmail(quickEmails); setQuickEmails(''); }}
            >
              <h3 className="flex items-center gap-2 text-sm font-bold text-[rgb(var(--color-text-primary))]">
                <Mail size={15} aria-hidden="true" /> {t('invites.emailTitle')}
                <span className="text-caption font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  {t('invite.recommended')}
                </span>
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <label htmlFor="invite-quick-emails" className="sr-only">{t('invites.emailTitle')}</label>
                <input
                  id="invite-quick-emails"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  value={quickEmails}
                  onChange={(e) => setQuickEmails(e.target.value)}
                  placeholder={t('invite.emailPlaceholder')}
                  className="flex-1 min-w-0 min-h-10 px-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))]"
                />
                <button
                  type="submit"
                  disabled={seatsFull}
                  className="min-h-10 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-60 shrink-0"
                >
                  {t('invite.emailSubmit')}
                </button>
              </div>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {t('invites.emailIntro')}{' '}
                <button type="button" onClick={() => { onInviteByEmail(quickEmails); setQuickEmails(''); }} className="text-[rgb(var(--color-accent))] hover:underline">
                  {t('invite.moreOptions')}
                </button>
              </p>
            </form>
          )}

          {/* Par code (validation admin), par lien direct, ou en faisant venir
              ses contacts COSMO.

              AUD-02 — le lien direct fait entrer quelqu'un SANS validation
              admin. Il n'est donc proposé qu'à qui a le droit `member.invite`,
              exactement comme la policy `org_invite_links_insert` (mig. 084).

              Faire venir ses contacts reste réservé aux admins : c'est eux qui
              décident qui entre. */}
          <div>
            <h3 className="text-caption font-semibold text-[rgb(var(--color-text-muted))] mb-1.5">{t('invite.otherWays')}</h3>
            <Suspense fallback={null}>
              <div className="divide-y divide-[rgb(var(--color-border))] rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
                <OrgJoinCodeCard code={org.joinCode ?? ''} orgId={org.id} isAdmin={isAdmin} seatsFull={seatsFull} />
                {canInvite && <OrgInviteLinkCard orgId={org.id} managerId={currentUserId} seatsFull={seatsFull} />}
                {isAdmin && (
                  <div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Contact size={18} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('invite.contactsTitle')}</p>
                        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t('invite.contactsRowHint')}</p>
                      </div>
                      <button
                        type="button"
                        aria-expanded={showContacts}
                        onClick={() => setShowContacts((v) => !v)}
                        className="shrink-0 min-h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] text-sm font-semibold text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
                      >
                        {showContacts ? t('invite.hideContacts') : t('invite.choose')}
                      </button>
                    </div>
                    {showContacts && (
                      <div className="px-4 pb-4">
                        <InviteFriendsToOrg orgId={org.id} variant="inline" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Suspense>
          </div>

          {/* Ce qui attend une réponse : invitations nominatives (relance,
              retrait) et, pour un admin, les demandes arrivées par le code. */}
          <Suspense fallback={null}>
            {isAdmin && <OrgJoinRequestsList orgId={org.id} />}
            {canInviteByEmail && (
              <div>
                <h3 className="text-caption font-semibold text-[rgb(var(--color-text-muted))] mb-1.5">{t('invite.pendingTitle')}</h3>
                <EmailInvitationsList orgId={org.id} />
              </div>
            )}
          </Suspense>
        </section>
  );
};

export default OrgInviteSection;
