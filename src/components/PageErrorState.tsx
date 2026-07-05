import React from 'react';

interface PageErrorStateProps {
  /** Ce qui n'a pas pu charger : « les tâches », « l'agenda », « les OKR »… */
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
  return (
    <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="text-5xl" aria-hidden="true">⚠️</div>
      <h2 className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">
        Impossible de charger {subject}
      </h2>
      <p className="text-sm text-[rgb(var(--color-text-secondary))] max-w-md">
        {error?.message || 'Vérifie ta connexion internet, puis réessaie.'}
      </p>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
      >
        Réessayer
      </button>
    </div>
  );
};

export default PageErrorState;
