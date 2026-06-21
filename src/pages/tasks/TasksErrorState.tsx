import React from 'react';

interface TasksErrorStateProps {
  error: Error | null;
  onRetry: () => void;
}

// Error state — shows up if useTasks fails (network, RLS denial, etc.)
// Without this, an error was silently swallowed and the page sat on the
// loading skeleton, looking blank to the user.
const TasksErrorState: React.FC<TasksErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="text-5xl">⚠️</div>
      <h2 className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">
        Impossible de charger les tâches
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

export default TasksErrorState;
