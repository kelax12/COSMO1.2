// ═══════════════════════════════════════════════════════════════════
// InviteFriendsToOrg — faire venir ses contacts COSMO dans une entreprise
// ═══════════════════════════════════════════════════════════════════
//
// Deux points de montage, un seul composant :
//
//   • juste après la CRÉATION d'une entreprise (InviteOrJoinModal) — c'est le
//     moment où l'on a une organisation vide et personne dedans ;
//   • onglet « Membres » de l'espace entreprise — pour l'inviter plus tard.
//
// Pourquoi ce n'est PAS dans le « + » de la barre de navigation : inviter
// quelqu'un dans une entreprise suppose d'en avoir une. Le proposer à un
// utilisateur qui n'appartient à aucune organisation n'a pas de sens, et le
// proposer à côté de « rejoindre » mélangeait deux gestes opposés.
//
// On n'invite que des amis CONFIRMÉS — c'est la règle du serveur
// (`invite_friend_to_org`, mig. 105), reprise ici pour l'expliquer plutôt que
// de laisser l'utilisateur se heurter à un refus.

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useFriends } from '@/modules/friends';
import { useInviteFriendToOrg, useOrgMembers, usePendingSentInvitations } from '@/modules/organizations';
import { useIsDemo } from '@/lib/app-mode.store';
import { useT } from '@/i18n/useT';

interface InviteFriendsToOrgProps {
  orgId: string;
  /** Rendu compact (dans un modal) vs carte autonome (page Membres). */
  variant?: 'inline' | 'card';
}

const InviteFriendsToOrg: React.FC<InviteFriendsToOrgProps> = ({ orgId, variant = 'inline' }) => {
  const { t } = useT('org');
  const isDemo = useIsDemo();
  // C-40 — sans `isLoading`, l'ecran AFFIRME une absence qu'il ne connait pas
  // encore : le premier rendu arrive avant la reponse, et la valeur par defaut
  // `[]` est indistinguable d'un compte reellement vide.
  const { data: friends = [], isLoading: loadingFriends } = useFriends();
  const { data: members = [] } = useOrgMembers(orgId);
  const { data: pendingIds = [] } = usePendingSentInvitations(orgId);
  const pendingSet = new Set(pendingIds);
  const inviteMutation = useInviteFriendToOrg();

  // Contacts invitables : ceux dont on connaît l'auth.uid (la RPC en a besoin)
  // et qui ne sont pas DÉJÀ dans l'organisation. Filtrer les membres ici évite
  // de proposer un bouton dont la seule issue possible est « already_a_member ».
  const memberIds = new Set(members.map((m) => m.userId));
  const invitable = friends.filter((f) => !!f.userId && !memberIds.has(f.userId as string));

  const body = (
    <>
      {isDemo ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">
          {t('inviteJoin.demoNotice')}
        </p>
      ) : loadingFriends ? null : friends.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">
          {t('inviteJoin.noFriendYet')}
        </p>
      ) : invitable.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">
          {t('inviteJoin.allFriendsIn')}
        </p>
      ) : (
        <>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            {t('inviteJoin.inviteHint')}
          </p>
          <ul className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
            {invitable.map((friend) => {
              // Invitation déjà envoyée, ni acceptée ni refusée : le bouton
              // « Inviter » identique à un ami jamais sollicité laissait
              // croire qu'on pouvait relancer indéfiniment sans effet visible.
              const isPending = !!friend.userId && pendingSet.has(friend.userId);
              return (
                <li key={friend.id}>
                  <div className="flex items-center gap-2.5 rounded-xl border border-[rgb(var(--color-border))] px-3 py-2">
                    <span className="w-7 h-7 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center text-xs font-semibold text-[rgb(var(--color-text-secondary))] shrink-0 overflow-hidden">
                      {friend.avatar
                        ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                        : (friend.name || friend.email || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0 text-xs text-[rgb(var(--color-text-primary))] truncate">
                      {friend.name || friend.email}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        inviteMutation.mutate({ orgId, friendUserId: friend.userId as string })
                      }
                      disabled={inviteMutation.isPending || isPending}
                      aria-label={isPending ? t('inviteJoin.inviteCtaPendingAria', { name: friend.name || friend.email || '' }) : undefined}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${
                        isPending
                          ? 'bg-[rgb(var(--color-accent-solid))]/20 text-[rgb(var(--color-text-muted))] cursor-default'
                          : 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40'
                      }`}
                    >
                      {inviteMutation.isPending && (
                        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      )}
                      {isPending ? t('inviteJoin.inviteCtaPending') : t('inviteJoin.inviteCta')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );

  const header = (
    <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
      {t('inviteJoin.inviteToOrg')}
    </h3>
  );

  if (variant === 'card') {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5">
        {header}
        {body}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {header}
      {body}
    </div>
  );
};

export default InviteFriendsToOrg;
