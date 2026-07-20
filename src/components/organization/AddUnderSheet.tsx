import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  useActiveOrganization,
  useCreateInviteLink,
  type OrgMember,
} from '@/modules/organizations';

interface AddUnderSheetProps {
  orgId: string;
  /** Le futur responsable direct (l'échelon où on ajoute). */
  under: OrgMember;
  currentUserId?: string;
  onClose: () => void;
}

/**
 * « Ajouter quelqu'un sous X » (bouton de la pyramide) : deux moyens d'inviter.
 *   1. Lien d'invitation placé — URL single-use (7 j) qui fait entrer un
 *      NOUVEAU directement à cette place (le lien est l'approbation).
 *   2. Code d'invitation permanent de l'entreprise (validation admin, arrivée
 *      non placée).
 */
const AddUnderSheet = ({ orgId, under, currentUserId, onClose }: AddUnderSheetProps) => {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const createLink = useCreateInviteLink();
  const { activeOrg } = useActiveOrganization();
  // Code d'invitation permanent de l'entreprise (flux avec validation admin).
  const joinCode = activeOrg?.id === orgId ? activeOrg.joinCode : null;

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

  const copyCode = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      setCodeCopied(true);
      toast.success('Code copié');
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      toast.error('Impossible de copier le code');
    }
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
          Invitez une nouvelle personne à rejoindre l'entreprise à cette place.
        </p>

        {/* ── Lien d'invitation placé ── */}
        <section className="rounded-2xl border border-[rgb(var(--color-border))] p-4 mb-4">
          <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-1">
            Lien d'invitation personnalisé
          </h3>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
            Usage unique, valable 7 jours. Après création de son compte, la personne rejoint
            directement l'entreprise, rattachée à {under.userId === currentUserId ? 'vous' : under.displayName}.
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

        {/* ── Code d'invitation de l'entreprise ── */}
        {joinCode && (
          <section className="rounded-2xl border border-[rgb(var(--color-border))] p-4">
            <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-1">
              Code d'invitation de l'entreprise
            </h3>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
              Code permanent, à partager largement. La personne demande à rejoindre l'entreprise et un
              administrateur valide sa demande (elle arrive non placée dans la pyramide).
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-base font-bold tracking-widest px-3 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] text-center">
                {joinCode}
              </code>
              <button
                type="button"
                onClick={copyCode}
                className="w-10 h-10 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] shrink-0"
                aria-label="Copier le code d'invitation"
              >
                {codeCopied ? <Check size={16} className="text-green-500" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default AddUnderSheet;
