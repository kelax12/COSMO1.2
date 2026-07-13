import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import type { TeamTask, UpdateTeamTaskInput } from '@/modules/team-projects';
import { PRIORITY_META } from './team-projects.helpers';
import AssigneePicker from './AssigneePicker';

interface TeamTaskEditSheetProps {
  task: TeamTask;
  members: OrgMember[];
  onSave: (input: UpdateTeamTaskInput) => Promise<void>;
  onDelete: (task: TeamTask) => void;
  onClose: () => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

/**
 * Édition complète d'une tâche d'équipe (bottom-sheet mobile / modal desktop) :
 * nom, description, priorité, deadline, durée estimée, assigné, suppression.
 */
const TeamTaskEditSheet = ({ task, members, onSave, onDelete, onClose }: TeamTaskEditSheetProps) => {
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? '');
  const [priority, setPriority] = useState(task.priority);
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [estimatedTime, setEstimatedTime] = useState(task.estimatedTime?.toString() ?? '');
  const [assigneeId, setAssigneeId] = useState<string | null>(task.assigneeId ?? null);
  const [pending, setPending] = useState(false);

  const handleSave = async () => {
    if (pending || !name.trim()) return;
    setPending(true);
    try {
      const minutes = estimatedTime.trim() === '' ? undefined : Number(estimatedTime);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        priority,
        deadline,
        ...(minutes !== undefined && !Number.isNaN(minutes) ? { estimatedTime: minutes } : {}),
        assigneeId,
      });
      onClose();
    } catch {
      setPending(false); // l'erreur est déjà notifiée par le hook
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Modifier la tâche ${task.name}`}
      >
        <div className="flex items-center justify-between gap-2 p-5 pb-3 border-b border-[rgb(var(--color-border))]">
          <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">Modifier la tâche</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div>
            <label htmlFor="tt-edit-name" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">
              Nom
            </label>
            <input
              id="tt-edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={500}
              autoFocus
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="tt-edit-desc" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">
              Description
            </label>
            <textarea
              id="tt-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={3}
              placeholder="Contexte, liens, critères d'acceptation…"
              className={`${inputClass} resize-y min-h-[72px]`}
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">Priorité</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Priorité">
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  aria-label={PRIORITY_META[p].label}
                  title={PRIORITY_META[p].label}
                  onClick={() => setPriority(p)}
                  className={`flex-1 h-9 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    priority === p
                      ? 'border-indigo-500 bg-indigo-500/10 text-[rgb(var(--color-text-primary))]'
                      : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_META[p].dot}`} aria-hidden="true" />
                  P{p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tt-edit-deadline" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">
                Deadline
              </label>
              <input
                id="tt-edit-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="tt-edit-time" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">
                Durée estimée (min)
              </label>
              <input
                id="tt-edit-time"
                type="number"
                min={0}
                max={100000}
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                placeholder="—"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[rgb(var(--color-text-secondary))]">Assigné</span>
            <AssigneePicker members={members} value={assigneeId} onChange={setAssigneeId} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-[rgb(var(--color-border))]">
          <button
            type="button"
            onClick={() => { onDelete(task); onClose(); }}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            <Trash2 size={15} aria-hidden="true" /> Supprimer
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !name.trim()}
            className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TeamTaskEditSheet;
