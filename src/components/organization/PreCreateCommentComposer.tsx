import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface PreCreateCommentComposerProps {
  /** Crée la tâche PUIS publie `body` : l'appelant le dit dans son bouton. */
  onSubmit: (body: string) => void;
  pending: boolean;
  /** Nom et projet renseignés : sans eux, la création échouerait. */
  canSubmit: boolean;
}

/**
 * Composeur affiché tant que la tâche n'existe pas : un commentaire référence
 * `taskId` (mig. 082), il ne peut pas précéder la tâche.
 *
 * 🔴 Il créait la tâche EN SILENCE au premier envoi (item #3) : un « Annuler »
 * ensuite laissait quand même la tâche en base (audit des popups du
 * 2026-09-25). Le bouton dit désormais ce qu'il fait, « Créer et commenter »,
 * avec la conséquence écrite juste au-dessus.
 */
const PreCreateCommentComposer = ({ onSubmit, pending, canSubmit }: PreCreateCommentComposerProps) => {
  const { t } = useT('org');
  const [body, setBody] = useState('');

  const submit = () => {
    const text = body.trim();
    if (!text || pending || !canSubmit) return;
    onSubmit(text);
    setBody('');
  };

  return (
    <div className="flex flex-col h-full min-h-0 mt-5">
      <h3 className="text-sm font-semibold mb-3 shrink-0" style={{ color: 'rgb(var(--color-text-secondary))' }}>
        {t('popups.task.commentsTitle')}
      </h3>
      <div className="flex flex-col min-h-[8rem] border-t pt-4 gap-2" style={{ borderColor: 'rgb(var(--color-border))' }}>
        <div className="flex-1" />
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('popups.task.createAndCommentHint')}</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={t('comments.placeholder')}
          aria-label={t('comments.placeholder')}
          className="w-full px-3 py-2 text-sm rounded-xl border resize-none focus:outline-none focus:border-[rgb(var(--color-accent))]"
          style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
        />
        {/* Pas d'envoi à Entrée : ce clavier-là crée une tâche, il doit le faire exprès. */}
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim() || pending || !canSubmit}
          className="self-end inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90"
        >
          <MessageSquarePlus size={16} aria-hidden="true" /> {t('popups.task.createAndComment')}
        </button>
      </div>
    </div>
  );
};

export default PreCreateCommentComposer;
