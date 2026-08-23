import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import {
  useTeamSubtasks, useCreateTeamSubtask, useUpdateTeamSubtask, useDeleteTeamSubtask,
} from '@/modules/team-projects';
import { subtaskProgress } from './team-projects.helpers';
import { useT } from '@/i18n/useT';

interface TeamSubtasksSectionProps {
  taskId: string;
}

/**
 * Checklist d'une tâche d'équipe (mig. 092).
 *
 * Existe pour que « Refondre la page tarifs » puisse porter ses cinq étapes
 * sans créer cinq tâches parasites — celles-ci polluaient toutes les mesures :
 * la vélocité comptait cinq complétions pour un livrable, et la charge
 * d'équipe voyait cinq lignes là où il y a un seul travail.
 */
const TeamSubtasksSection = ({ taskId }: TeamSubtasksSectionProps) => {
  const { t } = useT('org');
  const [draft, setDraft] = useState('');

  const { data: subtasks = [] } = useTeamSubtasks(taskId);
  const createSubtask = useCreateTeamSubtask(taskId);
  const updateSubtask = useUpdateTeamSubtask(taskId);
  const deleteSubtask = useDeleteTeamSubtask(taskId);

  const progress = subtaskProgress(subtasks);
  const doneCount = subtasks.filter((s) => s.completed).length;

  const submitDraft = () => {
    const title = draft.trim();
    if (!title) return;
    createSubtask.mutate({ title, position: subtasks.length });
    // Vidé tout de suite : on enchaîne généralement plusieurs étapes d'affilée,
    // attendre la réponse serveur casserait ce rythme de saisie.
    setDraft('');
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-secondary))]">
          {t('taskModal.subtasksTitle')}
        </span>
        {progress !== null && (
          <span className="text-xs text-[rgb(var(--color-text-muted))] tabular-nums">
            {t('taskModal.subtasksProgress', { done: doneCount, total: subtasks.length })}
          </span>
        )}
      </div>

      {progress !== null && (
        <div
          className="h-1 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden mb-2"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {subtasks.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-1">
          {t('taskModal.subtasksEmpty')}
        </p>
      ) : (
        <ul className="space-y-0.5 mb-2">
          {subtasks.map((subtask) => (
            <li
              key={subtask.id}
              className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors group"
            >
              <button
                type="button"
                onClick={() =>
                  updateSubtask.mutate({
                    subtaskId: subtask.id,
                    input: { completed: !subtask.completed },
                  })
                }
                aria-label={t('taskModal.subtasksToggle', { title: subtask.title })}
                aria-pressed={subtask.completed}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  subtask.completed
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))]'
                }`}
              >
                {subtask.completed && <Check size={11} aria-hidden="true" />}
              </button>
              <span
                className={`flex-1 min-w-0 text-sm truncate ${
                  subtask.completed
                    ? 'line-through text-[rgb(var(--color-text-muted))]'
                    : 'text-[rgb(var(--color-text-primary))]'
                }`}
              >
                {subtask.title}
              </span>
              <button
                type="button"
                onClick={() => deleteSubtask.mutate(subtask.id)}
                aria-label={t('taskModal.subtasksDelete', { title: subtask.title })}
                // Toujours dans le DOM (pas de `hidden`) pour rester atteignable
                // au clavier et au doigt, où il n'y a pas de survol.
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 transition-opacity"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Même traitement que les autres champs du modal (bordé, rounded-xl) —
          l'ancienne version était un texte nu sans bordure, visuellement
          incohérente avec le reste de la tâche. */}
      <div className="flex items-center gap-2 px-3 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] focus-within:border-[rgb(var(--color-accent-solid))] transition-colors">
        <Plus size={14} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Le modal parent valide sur Entrée : sans stopPropagation, ajouter
              // une sous-tâche enregistrerait et fermerait la tâche entière.
              e.preventDefault();
              e.stopPropagation();
              submitDraft();
            }
          }}
          onBlur={submitDraft}
          placeholder={t('taskModal.subtasksPlaceholder')}
          aria-label={t('taskModal.subtasksAdd')}
          maxLength={200}
          // no-input-chrome : le style global `input { border !important }`
          // (index.css) ajoute sa propre bordure par-dessus celle du
          // conteneur ci-dessus — deux bordures pour un seul champ. Cette
          // classe neutralise celle de l'input, le conteneur reste seul à en
          // porter une (focus-within la colore déjà à l'activation).
          className="no-input-chrome flex-1 min-w-0 bg-transparent text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none"
        />
      </div>
    </div>
  );
};

export default TeamSubtasksSection;
