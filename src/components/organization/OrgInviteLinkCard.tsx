import { useState } from 'react';
import { Copy, Check, Link2, RotateCcw } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useCreateInviteLink } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import { INVITE_GHOST_BTN, INVITE_ICON_BTN, INVITE_ROW } from './invite-ui';

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
 * Ligne « Lien d'invitation » de la rubrique Inviter, pendant du code
 * (OrgJoinCodeCard). Génère un lien à usage unique (7 j) qui fait entrer un
 * NOUVEAU directement dans l'entreprise, rattaché à l'utilisateur courant (le
 * lien vaut approbation — pas de validation admin).
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
    <div className={INVITE_ROW}>
      <Link2 size={18} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('invite.linkTitle')}</p>
        {inviteUrl ? (
          <code className="block mt-1 text-[11px] px-2 py-1 rounded-md bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] truncate">
            {inviteUrl}
          </code>
        ) : (
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t('invite.linkRowHint')}</p>
        )}
        {seatsFull && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1" role="status">{t('invite.seatsFullLink')}</p>
        )}
      </div>
      {inviteUrl ? (
        <>
          <button type="button" onClick={copy} className={INVITE_ICON_BTN} aria-label={t('invite.copyLinkAria')}>
            {copied ? <Check size={16} className="text-green-500" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={generateLink}
            disabled={createLink.isPending || seatsFull}
            className={INVITE_ICON_BTN}
            aria-label={t('invite.generateNewLink')}
            title={t('invite.generateNewLink')}
          >
            <RotateCcw size={16} className={createLink.isPending ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </>
      ) : (
        <button type="button" onClick={generateLink} disabled={createLink.isPending || seatsFull} className={INVITE_GHOST_BTN}>
          {createLink.isPending ? t('invite.generating') : t('invite.generateLink')}
        </button>
      )}
    </div>
  );
};

export default OrgInviteLinkCard;
