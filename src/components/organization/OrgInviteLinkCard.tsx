import { useState } from 'react';
import { Link2, Copy, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateInviteLink } from '@/modules/organizations';

interface OrgInviteLinkCardProps {
  orgId: string;
  /**
   * auth.users.id sous lequel la nouvelle personne sera rattachée (l'utilisateur
   * courant). La policy INSERT org_invite_links autorise « sous soi ».
   */
  managerId?: string;
}

/**
 * Carte « Lien d'invitation » — pendant du code d'invitation (OrgJoinCodeCard),
 * affichée à côté dans la section Membres. Génère un lien à usage unique (7 j)
 * qui fait entrer un NOUVEAU directement dans l'entreprise, rattaché à
 * l'utilisateur courant (le lien vaut approbation — pas de validation admin).
 */
const OrgInviteLinkCard = ({ orgId, managerId }: OrgInviteLinkCardProps) => {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createLink = useCreateInviteLink();

  const generateLink = () => {
    createLink.mutate(
      { orgId, managerId: managerId ?? null },
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

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={16} className="text-indigo-500" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">Lien d'invitation</h3>
      </div>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
        Lien à usage unique, valable 7 jours. La personne crée son compte et rejoint
        directement l'entreprise, rattachée à vous — sans validation à faire.
      </p>
      {inviteUrl ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 text-[11px] px-3 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] truncate">
            {inviteUrl}
          </code>
          <button
            type="button"
            onClick={copy}
            className="w-11 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] transition-colors shrink-0"
            aria-label="Copier le lien d'invitation"
          >
            {copied ? <Check size={18} className="text-green-500" aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={generateLink}
            disabled={createLink.isPending}
            className="w-11 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] hover:text-indigo-500 flex items-center justify-center text-[rgb(var(--color-text-secondary))] transition-colors disabled:opacity-50 shrink-0"
            aria-label="Générer un nouveau lien"
            title="Générer un nouveau lien"
          >
            <RotateCcw size={17} className={createLink.isPending ? 'animate-spin' : ''} aria-hidden="true" />
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
    </div>
  );
};

export default OrgInviteLinkCard;
