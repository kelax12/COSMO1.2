import React, { useState } from 'react';
import { Link2, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useIsDemo } from '@/lib/app-mode.store';
import { useShareLink, buildInviteUrl } from '@/modules/friends';
import { useT } from '@/i18n/useT';

interface ShareLinkFieldProps {
  /** Tâche existante (absent en création → pas de lien : FK share_links.task_id). */
  taskId?: string;
  /** L'utilisateur courant est-il propriétaire (= peut générer un lien) ? */
  ownerCanShare: boolean;
  /**
   * En création (pas encore de `taskId`) : callback qui persiste la tâche et
   * retourne son id, pour générer le lien à la volée. Si fourni, un bouton
   * « Générer le lien » remplace le placeholder désactivé.
   */
  onGenerate?: () => Promise<string | null>;
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
const ShareLinkField: React.FC<ShareLinkFieldProps> = ({ taskId, ownerCanShare, onGenerate, className = '' }) => {
  const ov = useT('overlays');
  const isDemo = useIsDemo();
  // Section visible pour le propriétaire hors démo. En CRÉATION (pas encore de
  // taskId) : si `onGenerate` est fourni → bouton « Générer le lien » (crée la
  // tâche puis affiche le vrai lien) ; sinon placeholder désactivé (le lien a
  // besoin que la tâche existe — FK share_links.task_id).
  const showSection = ownerCanShare && !isDemo;
  const isCreating = !taskId;
  const enabled = showSection && !isCreating;
  const { data: inviteToken, isLoading } = useShareLink(taskId ?? '', enabled);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (!showSection) return null;

  const inviteUrl = inviteToken ? buildInviteUrl(inviteToken) : '';
  const fieldValue = isCreating
    ? ov.t('shareLink.availableAfterCreate')
    : isLoading
      ? ov.t('shareLink.generatingLink')
      : inviteUrl;

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      toast.success(ov.t('shareLink.copied'));
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error(ov.t('shareLink.copyFailed'));
    }
  };

  const handleGenerate = async () => {
    if (!onGenerate) return;
    setGenerating(true);
    try {
      // Au succès, le parent persiste la tâche → ce composant reçoit un taskId
      // (isCreating=false) et bascule sur l'affichage du vrai lien.
      await onGenerate();
    } finally {
      setGenerating(false);
    }
  };

  // En création AVEC onGenerate : bouton « Générer le lien » (crée la tâche).
  const showGenerateButton = isCreating && !!onGenerate;

  return (
    <section className={`space-y-3 ${className}`}>
      <h3 className="text-sm font-semibold inline-flex items-center gap-1.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
        <Link2 size={14} aria-hidden="true" /> Lien d'invitation
      </h3>
      <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
        {ov.t('shareLink.hint')}
      </p>
      {showGenerateButton ? (
        <>
          <Button
            type="button"
            variant="default"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 min-h-11 w-full sm:w-auto bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))]"
          >
            {generating
              ? <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
              : <Link2 size={16} data-icon="inline-start" />}
            {generating ? ov.t('shareLink.creating') : ov.t('shareLink.generate')}
          </Button>
          <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
            {ov.t('shareLink.willSave')}
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              readOnly
              disabled={isCreating}
              value={fieldValue}
              onFocus={(e) => { if (!isCreating) e.currentTarget.select(); }}
              aria-label={ov.t('shareLink.aria')}
              className={`flex-1 px-4 py-3 min-h-11 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${isCreating ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={{
                backgroundColor: 'rgb(var(--color-hover))',
                borderColor: 'rgb(var(--color-border))',
                color: 'rgb(var(--color-text-secondary))',
              }}
            />
            <Button
              type="button"
              variant="default"
              onClick={handleCopy}
              disabled={isCreating || !inviteUrl}
              className={`inline-flex items-center justify-center gap-2 min-h-11 ${linkCopied ? 'bg-emerald-600 hover:bg-emerald-600 text-[rgb(var(--color-accent-solid-foreground))]' : 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))]'}`}
            >
              {linkCopied ? <Check size={16} data-icon="inline-start" /> : <Copy size={16} data-icon="inline-start" />}
              {linkCopied ? ov.t('shareLink.copiedShort') : ov.t('shareLink.copy')}
            </Button>
          </div>
          {isCreating && (
            <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
              {ov.t('shareLink.saveFirst')}
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default ShareLinkField;
