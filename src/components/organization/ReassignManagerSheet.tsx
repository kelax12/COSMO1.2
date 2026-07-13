import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpFromLine, AlertTriangle } from 'lucide-react';
import {
  buildOrgTree,
  isManagerOf,
  subtreeOf,
  type OrgMember,
  type OrgTreeNode,
} from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

interface ReassignManagerSheetProps {
  /** Le membre qu'on retire (avec subordonnés). */
  member: OrgMember;
  members: OrgMember[];
  ownerId: string;
  currentUserId?: string;
  /**
   * Rattache les subordonnés directs de `member` à `newManagerId`
   * (null = détacher), puis retire `member`. Rejette en cas d'échec.
   */
  onConfirm: (newManagerId: string | null) => Promise<void>;
  onCancel: () => void;
}

/**
 * Choisir, DEPUIS LA PYRAMIDE, le nouveau responsable des subordonnés directs
 * d'un membre qu'on retire. La hiérarchie interne sous ces subordonnés est
 * conservée (seul leur rattachement de premier niveau change). Les nœuds du
 * sous-arbre du membre retiré (et lui-même) ne sont pas sélectionnables.
 */
const ReassignManagerSheet = ({ member, members, ownerId, currentUserId, onConfirm, onCancel }: ReassignManagerSheetProps) => {
  const [pending, setPending] = useState(false);

  const directReports = useMemo(
    () => members.filter((m) => m.managerId === member.userId),
    [members, member.userId],
  );
  // Exclus (cycle) : le membre retiré + tout son sous-arbre.
  const excluded = useMemo(() => {
    const s = subtreeOf(members, member.userId);
    s.add(member.userId);
    return s;
  }, [members, member.userId]);

  const { roots, unplaced } = useMemo(() => buildOrgTree(members, ownerId), [members, ownerId]);

  const pick = async (newManagerId: string | null) => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm(newManagerId);
      // Succès : le parent démonte ce sheet.
    } catch {
      setPending(false); // l'erreur est déjà notifiée par le hook
    }
  };

  const renderNode = (node: OrgTreeNode, depth: number): React.ReactNode => {
    const m = node.member;
    const disabled = excluded.has(m.userId);
    const isMe = m.userId === currentUserId;
    return (
      <div key={m.userId}>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => pick(m.userId)}
          style={{ paddingLeft: 8 + depth * 18 }}
          className={`w-full flex items-center gap-2.5 py-2 pr-3 rounded-xl transition-colors text-left ${
            disabled
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-[rgb(var(--color-hover))] border border-transparent hover:border-indigo-400'
          }`}
        >
          <MemberAvatar avatar={m.avatar} name={m.displayName} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
              {isMe ? 'Vous' : m.displayName}
              {m.userId === member.userId ? ' · à retirer' : ''}
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
              {m.role === 'admin' ? 'Admin' : isManagerOf(members, m.userId) ? 'Manager' : 'Membre'}
            </span>
          </span>
        </button>
        {node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onCancel}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Réassigner l'équipe de ${member.displayName}`}
      >
        <div className="flex items-start justify-between gap-2 p-5 pb-3 border-b border-[rgb(var(--color-border))]">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
              Retirer {member.displayName}
            </h2>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
              {directReports.length} subordonné{directReports.length > 1 ? 's' : ''} direct{directReports.length > 1 ? 's' : ''} —
              choisissez leur nouveau responsable dans la pyramide. Leur équipe reste rattachée à eux.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            aria-label="Annuler"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-3">
          {/* Détacher : les subordonnés directs deviennent autonomes (non placés). */}
          <button
            type="button"
            disabled={pending}
            onClick={() => pick(null)}
            className="w-full flex items-center gap-2.5 p-2.5 mb-1 rounded-xl border border-dashed border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left disabled:opacity-50"
          >
            <span className="w-7 h-7 rounded-full border border-dashed border-[rgb(var(--color-border))] flex items-center justify-center shrink-0">
              <ArrowUpFromLine size={14} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
            </span>
            <span className="text-sm text-[rgb(var(--color-text-secondary))]">
              Les détacher (non placés)
            </span>
          </button>

          {roots.map((r) => renderNode(r, 0))}
          {unplaced.map((m) => renderNode({ member: m, children: [] }, 0))}
        </div>

        {pending && (
          <div className="px-5 py-3 border-t border-[rgb(var(--color-border))] text-xs text-[rgb(var(--color-text-muted))] inline-flex items-center gap-2">
            <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-indigo-500" />
            Réassignation en cours…
          </div>
        )}
        {!pending && (
          <div className="px-5 py-2.5 border-t border-[rgb(var(--color-border))] text-[11px] text-[rgb(var(--color-text-muted))] inline-flex items-center gap-1.5">
            <AlertTriangle size={12} aria-hidden="true" /> {member.displayName} sera définitivement retiré de l'entreprise.
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ReassignManagerSheet;
