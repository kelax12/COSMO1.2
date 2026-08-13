import { useState } from 'react';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateInviteLink } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

interface OrgInviteLinkCardProps {
  orgId: string;
  /**
   * Quota de sièges atteint ET facturation appliquée : générer un lien serait
   * un piège — le serveur refuserait l'entrée AU MOMENT DU CLIC de l'invité
   * (`seat_limit_reached`), c'est-à-dire chez quelqu'un qui n'a aucun moyen
   * de comprendre pourquoi ni d'y remédier.
   */
  seatsFull?: boolean;
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
const OrgInviteLinkCard = ({ orgId, managerId, seatsFull = false }: OrgInviteLinkCardProps) => {
  const { t } = useT('org');
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
      toast.success(t('invite.linkCopied'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('invite.linkCopyFailed'));
    }
  };

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">{t('invite.linkTitle')}</h3>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
        {t('invite.linkHint')}
      </p>
      {seatsFull && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3" role="status">
          {t('invite.seatsFullLink')}
        </p>
      )}
      {inviteUrl ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 text-[11px] px-3 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] truncate">
            {inviteUrl}
          </code>
          <button
            type="button"
            onClick={copy}
            className="w-11 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] transition-colors shrink-0"
            aria-label={t('invite.copyLinkAria')}
          >
            {copied ? <Check size={18} className="text-green-500" aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={generateLink}
            disabled={createLink.isPending || seatsFull}
            className="w-11 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] hover:text-indigo-500 flex items-center justify-center text-[rgb(var(--color-text-secondary))] transition-colors disabled:opacity-50 shrink-0"
            aria-label={t('invite.generateNewLink')}
            title={t('invite.generateNewLink')}
          >
            <RotateCcw size={17} className={createLink.isPending ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={generateLink}
          disabled={createLink.isPending || seatsFull}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {createLink.isPending ? t('invite.generating') : t('invite.generateLink')}
        </button>
      )}
    </div>
  );
};

export default OrgInviteLinkCard;
