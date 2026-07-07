import { useState } from 'react';
import { Copy, Check, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

interface OrgJoinCodeCardProps {
  code: string;
}

/**
 * Carte « Code d'invitation » — visible par tous les membres, copiable.
 * Le code circule pour inviter ; l'admin valide chaque demande (pattern inbox).
 */
const OrgJoinCodeCard = ({ code }: OrgJoinCodeCardProps) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Code copié');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Impossible de copier le code');
    }
  };

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound size={16} className="text-indigo-500" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">Code d'invitation</h3>
      </div>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
        Partagez ce code pour que de nouveaux membres demandent à rejoindre l'entreprise.
        Chaque demande doit être validée par un administrateur.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-base font-bold tracking-widest px-3 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] text-center">
          {code}
        </code>
        <button
          type="button"
          onClick={copy}
          className="w-11 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] transition-colors"
          aria-label="Copier le code d'invitation"
        >
          {copied ? <Check size={18} className="text-green-500" aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
};

export default OrgJoinCodeCard;
