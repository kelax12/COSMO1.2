import { createPortal } from 'react-dom';
import { X, ArrowUpFromLine } from 'lucide-react';
import { useSetMemberManager, isManagerOf, type OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

interface MemberPlacementSheetProps {
  orgId: string;
  /** Le membre à placer/déplacer. */
  target: OrgMember;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  onClose: () => void;
}

/** Sous-arbre strict (ids) de `root` — pour filtrer les destinations valides. */
function subtreeOf(members: OrgMember[], root: string): Set<string> {
  const out = new Set<string>();
  let frontier = [root];
  for (let depth = 0; depth < 50 && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const m of members) {
      if (m.managerId && frontier.includes(m.managerId) && !out.has(m.userId)) {
        out.add(m.userId);
        next.push(m.userId);
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * Choisir le nouveau supérieur direct d'un membre. Les destinations
 * proposées respectent les règles serveur : pas soi-même, pas un descendant
 * de la cible (cycle) ; un non-admin ne voit que lui + son sous-arbre.
 */
const MemberPlacementSheet = ({ orgId, target, members, currentUserId, isAdmin, onClose }: MemberPlacementSheetProps) => {
  const setManagerMutation = useSetMemberManager();

  const targetSubtree = subtreeOf(members, target.userId);
  const mySubtree = currentUserId ? subtreeOf(members, currentUserId) : new Set<string>();

  const candidates = members.filter((m) => {
    if (m.userId === target.userId) return false; // pas soi-même
    if (targetSubtree.has(m.userId)) return false; // cycle
    if (m.userId === target.managerId) return false; // déjà sa place
    if (!isAdmin) {
      // Manager : destination = moi ou mon sous-arbre.
      if (m.userId !== currentUserId && !mySubtree.has(m.userId)) return false;
    }
    return true;
  });

  const place = (managerId: string | null) => {
    setManagerMutation.mutate(
      { orgId, userId: target.userId, managerId },
      { onSuccess: () => onClose() },
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Placer ${target.displayName}`}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
            Rattacher {target.displayName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mb-4">
          Choisissez son nouveau responsable direct dans la pyramide.
        </p>

        <ul className="space-y-1.5">
          {isAdmin && target.managerId !== null && (
            <li>
              <button
                type="button"
                onClick={() => place(null)}
                disabled={setManagerMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left disabled:opacity-50"
              >
                <span className="w-9 h-9 rounded-full border border-dashed border-[rgb(var(--color-border))] flex items-center justify-center">
                  <ArrowUpFromLine size={15} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                </span>
                <span className="text-sm text-[rgb(var(--color-text-secondary))]">Détacher (non placé)</span>
              </button>
            </li>
          )}
          {candidates.map((m) => (
            <li key={m.userId}>
              <button
                type="button"
                onClick={() => place(m.userId)}
                disabled={setManagerMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left disabled:opacity-50"
              >
                <MemberAvatar avatar={m.avatar} size={36} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
                    {m.displayName}
                    {m.userId === currentUserId ? ' (vous)' : ''}
                  </span>
                  {isManagerOf(members, m.userId) && (
                    <span className="block text-[11px] text-blue-600 dark:text-blue-400">Manager</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {candidates.length === 0 && (
            <li className="text-center text-xs text-[rgb(var(--color-text-muted))] py-6">
              Aucune destination possible.
            </li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
};

export default MemberPlacementSheet;
