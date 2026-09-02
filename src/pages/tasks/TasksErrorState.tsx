import React from 'react';
import { useT } from '@/i18n/useT';

interface TasksErrorStateProps {
  error: Error | null;
  onRetry: () => void;
}

// Error state — shows up if useTasks fails (network, RLS denial, etc.)
// Without this, an error was silently swallowed and the page sat on the
// loading skeleton, looking blank to the user.
const TasksErrorState: React.FC<TasksErrorStateProps> = ({ error, onRetry }) => {
  const { t } = useT('tasks');
  // Règle « faille V7 » : le message brut du backend est journalisé, pas rendu.
  React.useEffect(() => {
    if (error) console.error('[TasksErrorState]', error);
  }, [error]);
  return (
    <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="text-5xl">⚠️</div>
      <h2 className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">
        {t('error.title')}
      </h2>
      <p className="text-sm text-[rgb(var(--color-text-secondary))] max-w-md">
        {t('error.fallback')}
      </p>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 rounded-xl bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-semibold text-sm"
      >
        {t('error.retry')}
      </button>
    </div>
  );
};

export default TasksErrorState;
