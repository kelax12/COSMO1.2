import React, { useState } from 'react';
import { Link2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useIsDemo } from '@/lib/app-mode.store';
import { useShareLink, buildInviteUrl } from '@/modules/friends';

interface ShareLinkFieldProps {
  /** Tâche existante (absent en création → pas de lien : FK share_links.task_id). */
  taskId?: string;
  /** L'utilisateur courant est-il propriétaire (= peut générer un lien) ? */
  ownerCanShare: boolean;
  /** Classes additionnelles sur la `<section>` (ex. séparateur desktop). */
  className?: string;
}

/**
 * Champ « Lien d'invitation » auto-contenu : get-or-create du token de partage
 * (`useShareLink`) + bouton Copier. Masqué en démo (pas de cross-user en
 * LocalStorage) et en création de tâche (pas encore de `taskId`). Composant
 * autonome — ne lit que ses props + ses propres hooks — pour pouvoir être
 * déposé dans les bodies « pilotés par props » du TaskModal sans casser le
 * contrat (cf. CLAUDE.md). Le get-or-create n'est déclenché que quand le
 * composant est monté ET `enabled` (donc quand la vue Collaborateurs est
 * réellement ouverte côté propriétaire).
 */
const ShareLinkField: React.FC<ShareLinkFieldProps> = ({ taskId, ownerCanShare, className = '' }) => {
  const isDemo = useIsDemo();
  const enabled = ownerCanShare && !isDemo && !!taskId;
  const { data: inviteToken, isLoading } = useShareLink(taskId ?? '', enabled);
  const [linkCopied, setLinkCopied] = useState(false);

  if (!enabled) return null;

  const inviteUrl = inviteToken ? buildInviteUrl(inviteToken) : '';

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      toast.success('Lien d\'invitation copié !');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier — sélectionnez le lien manuellement.');
    }
  };

  return (
    <section className={`space-y-3 ${className}`}>
      <h3 className="text-sm font-semibold inline-flex items-center gap-1.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
        <Link2 size={14} aria-hidden="true" /> Lien d'invitation
      </h3>
      <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
        Toute personne avec ce lien pourra rejoindre la tâche, même sans compte (valable 7 jours).
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          readOnly
          value={isLoading ? 'Génération du lien…' : inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Lien d'invitation à copier"
          className="flex-1 px-4 py-3 min-h-11 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          style={{
            backgroundColor: 'rgb(var(--color-hover))',
            borderColor: 'rgb(var(--color-border))',
            color: 'rgb(var(--color-text-secondary))',
          }}
        />
        <Button
          variant="default"
          onClick={handleCopy}
          disabled={!inviteUrl}
          className={`inline-flex items-center justify-center gap-2 min-h-11 ${linkCopied ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
        >
          {linkCopied ? <Check size={16} data-icon="inline-start" /> : <Copy size={16} data-icon="inline-start" />}
          {linkCopied ? 'Copié !' : 'Copier'}
        </Button>
      </div>
    </section>
  );
};

export default ShareLinkField;
