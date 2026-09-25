import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpFromLine, ArrowUp, ArrowDown, Copy, Check, Search } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  useActiveOrganization,
  useCreateInviteLink,
  useSetMemberManager,
  isManagerOf,
  subtreeOf,
  type OrgMember,
} from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import InviteFriendsToOrg from './InviteFriendsToOrg';
import { MEMBER_SEARCH_THRESHOLD, filterMembersByQuery } from './member-search.helpers';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

export type PlacementDirection = 'up' | 'down';

interface PyramidPlacementSheetProps {
  orgId: string;
  /** La personne qu'on place (sens « au-dessus ») ou sous qui on place (sens « en dessous »). */
  target: OrgMember;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  initialDirection: PlacementDirection;
  /** Peut-on changer le responsable de `target` ? (admin, ou `target` dans mon sous-arbre) */
  canMoveTarget: boolean;
  /** Peut-on rattacher des personnes sous `target` ? (admin, soi, ou `target` dans mon sous-arbre) */
  canPlaceUnder: boolean;
  onClose: () => void;
}

/**
 * « Placer dans la pyramide », dans les DEUX sens.
 *
 * Audit des popups du 2026-09-25 : trois feuilles pour un seul geste.
 * `MemberPlacementSheet` choisissait le responsable d'une personne,
 * `AddUnderSheet` n'invitait que des NOUVEAUX sous elle, et
 * `ReassignManagerSheet` a été remplacée par l'assistant de départ (M10).
 * Rattacher sous quelqu'un une personne DÉJÀ dans l'entreprise n'existait
 * qu'au glisser-déposer, inaccessible au clavier.
 *
 * Règles serveur rejouées ici (la RLS et le trigger restent la frontière) :
 * jamais soi-même, jamais sous l'un de ses propres subordonnés (cycle), et
 * un non-admin ne déplace que dans son sous-arbre.
 */
const PyramidPlacementSheet = ({
  orgId, target, members, currentUserId, isAdmin, initialDirection, canMoveTarget, canPlaceUnder, onClose,
}: PyramidPlacementSheetProps) => {
  const { t } = useT('org');
  const setManager = useSetMemberManager();
  const [direction, setDirection] = useState<PlacementDirection>(
    initialDirection === 'up' && !canMoveTarget ? 'down' : initialDirection === 'down' && !canPlaceUnder ? 'up' : initialDirection,
  );
  const [query, setQuery] = useState('');
  const isMe = target.userId === currentUserId;
  const name = isMe ? t('invite.you') : target.displayName;
  const title = isMe ? t('popups.placement.titleSelf') : t('popups.placement.title', { name });

  const mySubtree = useMemo(
    () => (currentUserId ? subtreeOf(members, currentUserId) : new Set<string>()),
    [members, currentUserId],
  );
  // Sens « au-dessus » : qui peut devenir le responsable de `target`.
  const managers = useMemo(() => {
    const below = subtreeOf(members, target.userId);
    // Un non-admin ne rattache que sous lui-même ou son sous-arbre.
    return members.filter((m) =>
      m.userId !== target.userId && !below.has(m.userId) && m.userId !== target.managerId
      && (isAdmin || m.userId === currentUserId || mySubtree.has(m.userId)));
  }, [members, target, isAdmin, currentUserId, mySubtree]);

  // Sens « en dessous » : qui peut passer sous `target`. Pas ses ancêtres
  // (cycle), pas ceux déjà sous lui, et seulement ceux qu'on a le droit de
  // déplacer : jamais soi-même, sinon admin ou sous-arbre.
  const reports = useMemo(() => {
    const ancestors = new Set<string>();
    let cursor = target.managerId;
    for (let depth = 0; cursor && depth < 50; depth++) {
      ancestors.add(cursor);
      cursor = members.find((m) => m.userId === cursor)?.managerId ?? null;
    }
    return members.filter((m) =>
      m.userId !== target.userId && !ancestors.has(m.userId) && m.managerId !== target.userId
      && m.userId !== currentUserId && (isAdmin || mySubtree.has(m.userId)));
  }, [members, target, currentUserId, isAdmin, mySubtree]);

  const list = direction === 'up' ? managers : reports;
  const searchable = list.length > MEMBER_SEARCH_THRESHOLD;
  const shown = searchable ? filterMembersByQuery(list, query) : list;

  const placeTargetUnder = (managerId: string | null) =>
    setManager.mutate({ orgId, userId: target.userId, managerId }, { onSuccess: onClose });
  const placeUnderTarget = (m: OrgMember) =>
    setManager.mutate({ orgId, userId: m.userId, managerId: target.userId }, { onSuccess: onClose });

  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose,
    label: title,
  });

  const tabClass = (on: boolean) =>
    `flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      on ? 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] shadow-sm' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
    }`;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        ref={modalA11yRef}
        {...modalA11yProps}
      >
        <div className="p-5 pb-3 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <MemberAvatar avatar={target.avatar} name={target.displayName} size={36} />
              <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-[rgb(var(--color-hover))]" role="tablist" aria-label={t('popups.placement.directionAria')}>
            <button type="button" role="tab" aria-selected={direction === 'up'} disabled={!canMoveTarget} onClick={() => { setDirection('up'); setQuery(''); }} className={tabClass(direction === 'up')}>
              <ArrowUp size={14} aria-hidden="true" /> {t('popups.placement.up')}
            </button>
            <button type="button" role="tab" aria-selected={direction === 'down'} disabled={!canPlaceUnder} onClick={() => { setDirection('down'); setQuery(''); }} className={tabClass(direction === 'down')}>
              <ArrowDown size={14} aria-hidden="true" /> {t('popups.placement.down')}
            </button>
          </div>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-2">
            {direction === 'up' ? t('popups.placement.upHint', { name }) : t('popups.placement.downHint', { name })}
          </p>
        </div>

        <div role="tabpanel" className="overflow-y-auto px-5 pb-5 flex-1 min-h-0">
          {searchable && (
            <label className="relative block mb-2">
              <span className="sr-only">{t('assign.memberSearch')}</span>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('assign.memberSearch')}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))]"
              />
            </label>
          )}

          <ul className="space-y-1.5">
            {direction === 'up' && isAdmin && target.managerId !== null && !query.trim() && (
              <li>
                <button
                  type="button"
                  onClick={() => placeTargetUnder(null)}
                  disabled={setManager.isPending}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] text-left disabled:opacity-50"
                >
                  <span className="w-9 h-9 rounded-full border border-dashed border-[rgb(var(--color-border))] flex items-center justify-center">
                    <ArrowUpFromLine size={15} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                  </span>
                  <span className="text-sm text-[rgb(var(--color-text-secondary))]">{t('member.detach')}</span>
                </button>
              </li>
            )}
            {shown.map((m) => (
              <li key={m.userId}>
                <button
                  type="button"
                  onClick={() => (direction === 'up' ? placeTargetUnder(m.userId) : placeUnderTarget(m))}
                  disabled={setManager.isPending}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] text-left disabled:opacity-50"
                >
                  <MemberAvatar avatar={m.avatar} name={m.displayName} size={36} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
                      {/* Pas de « Vous (vous) » : en démo le nom affiché est déjà « Vous ». */}
                      {m.displayName}{m.userId === currentUserId && m.displayName !== t('common.youBadge') ? t('member.youSuffix') : ''}
                    </span>
                    <span className="block text-[11px] text-[rgb(var(--color-text-muted))] truncate">
                      {/* Un sommet sans responsable qui encadre des gens n'est pas « non placé ». */}
                      {isManagerOf(members, m.userId)
                        ? t('member.manager')
                        : m.managerId === null
                          ? t('popups.placement.unplaced')
                          : t('popups.placement.under', { name: members.find((x) => x.userId === m.managerId)?.displayName ?? '' })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="text-center text-xs text-[rgb(var(--color-text-muted))] py-6">
                {direction === 'up' ? t('member.placementEmpty') : t('popups.placement.nobodyToPlace')}
              </li>
            )}
          </ul>

          {direction === 'down' && <InviteUnder orgId={orgId} under={target} name={name} />}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Ex-`AddUnderSheet` : inviter une personne qui n'est PAS encore dans l'entreprise. */
const InviteUnder = ({ orgId, under, name }: { orgId: string; under: OrgMember; name: string }) => {
  const { t } = useT('org');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const createLink = useCreateInviteLink();
  const { activeOrg } = useActiveOrganization();
  const joinCode = activeOrg?.id === orgId ? activeOrg.joinCode : null;

  const copy = async (value: string, what: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      toast.success(what === 'link' ? t('invite.linkCopied') : t('createJoin.codeCopied'));
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(what === 'link' ? t('invite.linkCopyFailed') : t('createJoin.copyFailed'));
    }
  };

  return (
    <section className="mt-5 pt-4 border-t border-[rgb(var(--color-border))] space-y-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('popups.placement.inviteTitle')}</h3>
      <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4">
        <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] mb-1">{t('invite.personalLink')}</p>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">{t('invite.personalLinkHint', { name })}</p>
        {inviteUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] px-3 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] truncate">{inviteUrl}</code>
            <button type="button" onClick={() => copy(inviteUrl, 'link')} aria-label={t('invite.copyLinkAria')} className="w-10 h-10 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] shrink-0">
              {copied === 'link' ? <Check size={16} className="text-green-500" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => createLink.mutate({ orgId, managerId: under.userId }, { onSuccess: (link) => setInviteUrl(`${window.location.origin}/org-invite/${link.id}`) })}
            disabled={createLink.isPending}
            className="w-full min-h-11 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {createLink.isPending ? t('invite.generating') : t('invite.generateLink')}
          </button>
        )}
      </div>
      {joinCode && (
        <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4">
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] mb-1">{t('invite.orgCodeTitle')}</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">{t('invite.permanentCodeHint')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-base font-bold tracking-widest px-3 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] text-center">{joinCode}</code>
            <button type="button" onClick={() => copy(joinCode, 'code')} aria-label={t('invite.copyCodeAria')} className="w-10 h-10 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] shrink-0">
              {copied === 'code' ? <Check size={16} className="text-green-500" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4">
        <InviteFriendsToOrg orgId={orgId} variant="inline" />
      </div>
    </section>
  );
};

export default PyramidPlacementSheet;
