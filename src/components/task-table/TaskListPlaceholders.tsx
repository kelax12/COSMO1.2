// ═══════════════════════════════════════════════════════════════════
// Ce que la liste montre quand elle n'a rien à montrer
//
// FRONTIÈRE : squelette de chargement et état vide. Ce composant ne connaît
// aucune tâche — il reçoit « combien de lignes » et « est-ce que ça charge »,
// et rend l'un ou l'autre, ou rien.
//
// Les deux sont ici ensemble parce qu'ils sont EXCLUSIFS et se lisent
// ensemble : un état vide affiché pendant un chargement est indistinguable
// d'une liste réellement vide, et c'est le défaut que la distinction évite.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useT } from '@/i18n/useT';

interface TaskListPlaceholdersProps {
  rowCount: number;
  isLoading: boolean;
  showCompleted: boolean;
  /** En mode « ajout à une liste », créer une tâche n'a pas de sens ici. */
  addToListMode: boolean;
  onCreateTask: () => void;
}

const TaskListPlaceholders = ({
  rowCount,
  isLoading,
  showCompleted,
  addToListMode,
  onCreateTask,
}: TaskListPlaceholdersProps) => {
  const { t } = useT('tasks');
  if (rowCount > 0) return null;

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-[rgb(var(--color-hover))] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="text-center py-12" style={{ color: 'rgb(var(--color-text-muted))' }}>
      <h3 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
        {showCompleted ? t('table.emptyCompleted') : t('table.empty')}
      </h3>
      <p className="text-sm">
        {showCompleted ? t('table.emptyCompletedHint') : t('table.emptyHint')}
      </p>
      {!showCompleted && !addToListMode && (
        <button
          type="button"
          onClick={onCreateTask}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] text-sm font-semibold transition-colors shadow-sm"
        >
          {t('table.createTask')}
        </button>
      )}
    </div>
  );
};

export default TaskListPlaceholders;
