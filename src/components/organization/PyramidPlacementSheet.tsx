import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpFromLine, ArrowUp, ArrowDown, Copy, Check, Search, CheckCircle2 } from 'lucide-react';
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
 * « Placer dans l'organigramme », dans les DEUX sens.
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
  const [searchOpen, setSearchOpen] = useState(false);
  const shown = searchOpen ? filterMembersByQuery(list, query) : list;
  const shownManagers = shown.filter((m) => isManagerOf(members, m.userId));
  const shownMembers = shown.filter((m) => !isManagerOf(members, m.userId));

  // Design C (2026-09-28) : on SÉLECTIONNE puis on confirme, le pied de page
  // dit l'effet avant qu'il n'ait lieu. `'detach'` = retirer son responsable.
  const [selected, setSelected] = useState<OrgMember | 'detach' | null>(null);
  const switchDirection = (d: PlacementDirection) => { setDirection(d); setQuery(''); setSelected(null); };

  const confirm = () => {
    if (!selected) return;
    if (selected === 'detach') {
      setManager.mutate({ orgId, userId: target.userId, managerId: null }, { onSuccess: onClose });
    } else if (direction === 'up') {
      setManager.mutate({ orgId, userId: target.userId, managerId: selected.userId }, { onSuccess: onClose });
    } else {
      setManager.mutate({ orgId, userId: selected.userId, managerId: target.userId }, { onSuccess: onClose });
    }
  };

  const summary = !selected
    ? t('popups.placement.summaryEmpty')
    : selected === 'detach'
      ? t('popups.placement.summaryDetach', { person: target.displayName })
      : direction === 'up'
        ? t('popups.placement.summary', { person: isMe ? t('common.youBadge') : target.displayName, manager: selected.displayName })
        : t('popups.placement.summary', { person: selected.displayName, manager: name });

  const renderRow = (m: OrgMember) => {
    const on = selected !== null && selected !== 'detach' && selected.userId === m.userId;
    return (
      <li key={m.userId}>
        <button
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => setSelected(m)}
          className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-left transition-colors ${
            on ? 'bg-indigo-50 dark:bg-indigo-500/15' : 'hover:bg-[rgb(var(--color-hover))]'
          }`}
        >
          <MemberAvatar avatar={m.avatar} name={m.displayName} size={40} />
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-[rgb(var(--color-text-primary))] truncate">
              {/* Pas de « Vous (vous) » : en démo le nom affiché est déjà « Vous ». */}
              {m.displayName}{m.userId === currentUserId && m.displayName !== t('common.youBadge') ? t('member.youSuffix') : ''}
            </span>
            <span className="block text-xs text-[rgb(var(--color-text-muted))] truncate">
              {/* Un sommet sans responsable qui encadre des gens n'est pas « non placé ». */}
              {isManagerOf(members, m.userId)
                ? t('member.manager')
                : m.managerId === null
                  ? t('popups.placement.unplaced')
                  : t('popups.placement.under', { name: members.find((x) => x.userId === m.managerId)?.displayName ?? '' })}
            </span>
          </span>
          {on ? (
            <CheckCircle2 size={20} className="text-indigo-500 shrink-0" aria-hidden="true" />
          ) : (
            <span className="w-[18px] h-[18px] rounded-full border-[1.5px] border-[rgb(var(--color-border))] shrink-0" aria-hidden="true" />
          )}
        </button>
      </li>
    );
  };

  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose,
    label: title,
  });

  const tabClass = (on: boolean) =>
    `inline-flex items-center gap-1.5 pb-2.5 -mb-px border-b-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      on ? 'border-[rgb(var(--color-text-primary))] text-[rgb(var(--color-text-primary))]' : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
    }`;
  const groupLabel = 'text-xs font-semibold text-[rgb(var(--color-text-muted))] px-3 mb-1';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-xl max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        ref={modalA11yRef}
        {...modalA11yProps}
      >
        <div className="px-6 pt-6 shrink-0 border-b border-[rgb(var(--color-border))]">
          <div className="flex items-center gap-3.5">
            <MemberAvatar avatar={target.avatar} name={target.displayName} size={40} />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[rgb(var(--color-text-primary))] truncate">{title}</h2>
              <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
                {direction === 'up' ? t('popups.placement.upHint', { name }) : t('popups.placement.downHint', { name })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0 self-start"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-end gap-5 mt-5" role="tablist" aria-label={t('popups.placement.directionAria')}>
            <button type="button" role="tab" aria-selected={direction === 'up'} disabled={!canMoveTarget} onClick={() => switchDirection('up')} className={tabClass(direction === 'up')}>
              <ArrowUp size={14} aria-hidden="true" /> {t('popups.placement.up')}
            </button>
            <button type="button" role="tab" aria-selected={direction === 'down'} disabled={!canPlaceUnder} onClick={() => switchDirection('down')} className={tabClass(direction === 'down')}>
              <ArrowDown size={14} aria-hidden="true" /> {t('popups.placement.down')}
            </button>
            {searchable && (
              <button
                type="button"
                onClick={() => { setSearchOpen((v) => !v); setQuery(''); }}
                aria-pressed={searchOpen}
                aria-label={t('popups.placement.searchToggle')}
                className={`ml-auto mb-2 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--color-hover))] ${searchOpen ? 'text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'}`}
              >
                <Search size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div role="tabpanel" className="overflow-y-auto px-6 py-4 flex-1 min-h-0">
          {searchOpen && (
            <label className="relative block mb-3">
              <span className="sr-only">{t('assign.memberSearch')}</span>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('assign.memberSearch')}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))]"
              />
            </label>
          )}

          <div role="radiogroup" aria-label={title} className="space-y-4">
            {direction === 'up' && isAdmin && target.managerId !== null && !query.trim() && (
              <button
                type="button"
                role="radio"
                aria-checked={selected === 'detach'}
                onClick={() => setSelected('detach')}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl border border-dashed text-left transition-colors ${
                  selected === 'detach' ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15' : 'border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))]'
                }`}
              >
                <span className="w-10 h-10 rounded-full border border-dashed border-[rgb(var(--color-border))] flex items-center justify-center shrink-0">
                  <ArrowUpFromLine size={16} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                </span>
                <span className="flex-1 text-sm text-[rgb(var(--color-text-secondary))]">{t('member.detach')}</span>
              </button>
            )}
            {shownManagers.length > 0 && (
              <section>
                <h3 className={groupLabel}>{t('popups.placement.groupManagers')}</h3>
                <ul className="space-y-0.5">{shownManagers.map(renderRow)}</ul>
              </section>
            )}
            {shownMembers.length > 0 && (
              <section>
                <h3 className={groupLabel}>{t('popups.placement.groupMembers')}</h3>
                <ul className="space-y-0.5">{shownMembers.map(renderRow)}</ul>
              </section>
            )}
            {shown.length === 0 && (
              <p className="text-center text-sm text-[rgb(var(--color-text-muted))] py-8">
                {direction === 'up' ? t('member.placementEmpty') : t('popups.placement.nobodyToPlace')}
              </p>
            )}
          </div>

          {direction === 'down' && <InviteUnder orgId={orgId} under={target} name={name} />}
        </div>

        <div className="px-6 py-4 shrink-0 border-t border-[rgb(var(--color-border))] flex items-center gap-2.5">
          <p className="flex-1 min-w-0 text-sm text-[rgb(var(--color-text-muted))] truncate" aria-live="polite">{summary}</p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 px-4 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!selected || setManager.isPending}
            className="min-h-10 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('popups.placement.confirm')}
          </button>
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
