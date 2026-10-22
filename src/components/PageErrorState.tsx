import React from 'react';
import { useT } from '@/i18n/useT';

interface PageErrorStateProps {
  /** Ce qui n'a pas pu charger, DÉJÀ TRADUIT : « l'agenda », « les OKR »… */
  subject: string;
  error?: Error | null;
  onRetry: () => void;
}

/**
 * État d'erreur de page partagé (#39) — généralisation de TasksErrorState.
 * Sans lui, une requête en échec laisse un écran vide ou un skeleton infini :
 * l'utilisateur croit avoir perdu ses données, ce qui est pire qu'une erreur.
 */
const PageErrorState: React.FC<PageErrorStateProps> = ({ subject, error, onRetry }) => {
  const { t } = useT('common');
  // ❌ Le message brut du backend ne s'affiche JAMAIS (règle « faille V7 »,
  // déjà appliquée dans SettingsPage) : il nomme des tables, des contraintes
  // ou des policies, et il est en anglais quelle que soit la langue de l'app.
  // On le journalise pour le diagnostic, on montre une phrase traduite.
  React.useEffect(() => {
    if (error) console.error('[PageErrorState]', subject, error);
  }, [error, subject]);
  return (
    <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="text-5xl" aria-hidden="true">⚠️</div>
      <h2 className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">
        {t('pageError.title', { subject })}
      </h2>
      <p className="text-sm text-[rgb(var(--color-text-secondary))] max-w-md">
        {t('pageError.hint')}
      </p>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 rounded-xl bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-semibold text-sm"
      >
        {t('pageError.retry')}
      </button>
    </div>
  );
};

export default PageErrorState;
