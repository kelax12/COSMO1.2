import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Link2, Copy, Check, UserRoundPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  subtreeOf,
  useCreateInviteLink,
  useSetMemberManager,
  type OrgMember,
} from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

interface AddUnderSheetProps {
  orgId: string;
  /** Le futur responsable direct (l'échelon où on ajoute). */
  under: OrgMember;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  onClose: () => void;
}

/**
 * « Ajouter quelqu'un sous X » (bouton + de la pyramide) :
 *   1. Lien d'invitation placé — URL single-use (7 j) qui fait entrer un
 *      NOUVEAU directement à cette place (le lien est l'approbation).
 *   2. Déplacer un membre EXISTANT de l'entreprise vers cette place.
 */
const AddUnderSheet = ({ orgId, under, members, currentUserId, isAdmin, onClose }: AddUnderSheetProps) => {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createLink = useCreateInviteLink();
  const setManager = useSetMemberManager();

  // Membres déplaçables ici : pas X lui-même, pas déjà sous X, pas un
  // ancêtre de X (cycle) ; un non-admin ne déplace que son sous-arbre.
  const underAncestors = new Set<string>();
  {
    let cur = under.managerId ?? null;
    for (let i = 0; i < 50 && cur; i++) {
      underAncestors.add(cur);
      cur = members.find((m) => m.userId === cur)?.managerId ?? null;
    }
  }
  const mySubtree = currentUserId ? subtreeOf(members, currentUserId) : new Set<string>();
  const candidates = members.filter((m) => {
    if (m.userId === under.userId) return false;
    if (m.managerId === under.userId) return false;
    if (underAncestors.has(m.userId)) return false;
    if (subtreeOf(members, m.userId).has(under.userId)) return false; // cycle
    if (!isAdmin && !mySubtree.has(m.userId)) return false;
    return true;
  });

  const generateLink = () => {
    createLink.mutate(
      { orgId, managerId: under.userId },
      {
        onSuccess: (link) => {
          setInviteUrl(`${window.location.origin}/org-invite/${link.id}`);
        },
      },
    );
  };

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Lien copié');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Impossible de copier le lien');
    }
  };

  const moveHere = (userId: string) => {
    setManager.mutate(
      { orgId, userId, managerId: under.userId },
      { onSuccess: () => onClose() },
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Ajouter sous ${under.displayName}`}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
            Ajouter sous {under.userId === currentUserId ? 'vous' : under.displayName}
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
          Invitez une nouvelle personne à cette place, ou déplacez-y un membre existant.
        </p>

        {/* ── Lien d'invitation placé ── */}
        <section className="rounded-2xl border border-[rgb(var(--color-border))] p-4 mb-4">
          <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] inline-flex items-center gap-1.5 mb-1">
            <Link2 size={14} className="text-indigo-500" aria-hidden="true" /> Lien d'invitation
          </h3>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
            Usage unique, valable 7 jours. La personne rejoint directement l'entreprise à cette place.
          </p>
          {inviteUrl ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] px-3 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] truncate">
                {inviteUrl}
              </code>
              <button
                type="button"
                onClick={copy}
                className="w-10 h-10 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] shrink-0"
                aria-label="Copier le lien d'invitation"
              >
                {copied ? <Check size={16} className="text-green-500" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={generateLink}
              disabled={createLink.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {createLink.isPending ? 'Génération…' : 'Générer un lien'}
            </button>
          )}
        </section>

        {/* ── Déplacer un membre existant ── */}
        <section>
          <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] inline-flex items-center gap-1.5 mb-2">
            <UserRoundPlus size={14} className="text-blue-500" aria-hidden="true" /> Déplacer un membre ici
          </h3>
          {candidates.length === 0 ? (
            <p className="text-xs text-[rgb(var(--color-text-muted))] py-3">Aucun membre déplaçable à cette place.</p>
          ) : (
            <ul className="space-y-1.5">
              {candidates.map((m) => (
                <li key={m.userId}>
                  <button
                    type="button"
                    onClick={() => moveHere(m.userId)}
                    disabled={setManager.isPending}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left disabled:opacity-50"
                  >
                    <MemberAvatar avatar={m.avatar} size={32} />
                    <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
                      {m.userId === currentUserId ? 'Vous' : m.displayName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
};

export default AddUnderSheet;
