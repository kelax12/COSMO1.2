// Partage en un clic (#42) — bouton « Copier le lien » directement dans
// l'étape 1 du TaskModal (plus besoin d'aller à l'étape Collaborateurs).
// Le token est get-or-create UNIQUEMENT au premier clic (pas de lien créé
// pour chaque tâche ouverte). Masqué en démo et pour les non-propriétaires.
import React, { useState, useEffect } from 'react';
import { Link2, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIsDemo } from '@/lib/app-mode.store';
import { useShareLink, buildInviteUrl } from '@/modules/friends';

interface CopyShareLinkButtonProps {
  taskId: string;
  ownerCanShare: boolean;
}

const CopyShareLinkButton: React.FC<CopyShareLinkButtonProps> = ({ taskId, ownerCanShare }) => {
  const isDemo = useIsDemo();
  const [requested, setRequested] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: token, isLoading } = useShareLink(taskId, requested && ownerCanShare && !isDemo);

  useEffect(() => {
    if (!requested || !token) return;
    setRequested(false);
    navigator.clipboard
      .writeText(buildInviteUrl(token))
      .then(() => {
        setCopied(true);
        toast.success("Lien d'invitation copié !");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error('Impossible de copier le lien.'));
  }, [requested, token]);

  if (isDemo || !ownerCanShare) return null;

  return (
    <button
      type="button"
      onClick={() => setRequested(true)}
      disabled={isLoading && requested}
      title="Copier le lien d'invitation (valable 7 jours)"
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
        copied
          ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-slate-200 dark:border-slate-700 hover:border-blue-400/50 hover:bg-blue-500/10'
      }`}
      style={!copied ? { backgroundColor: 'rgb(var(--color-hover))', color: 'rgb(var(--color-text-primary))' } : {}}
    >
      {isLoading && requested ? (
        <Loader2 size={16} className="animate-spin text-blue-500" />
      ) : copied ? (
        <Check size={16} />
      ) : (
        <Link2 size={16} className="text-blue-500" />
      )}
      {copied ? 'Copié !' : 'Copier le lien'}
    </button>
  );
};

export default CopyShareLinkButton;
