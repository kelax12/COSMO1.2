import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Trash2, Loader2, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTask, CreateTeamTaskInput, UpdateTeamTaskInput } from '@/modules/team-projects';
import { PRIORITY_META, projectColor } from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';
import TaskCommentsSection from './TaskCommentsSection';
import { useAuth } from '@/modules/auth/AuthContext';

interface TeamTaskModalProps {
  /** Tâche à éditer — absente en création. */
  task?: TeamTask;
  isCreating?: boolean;
  projects: TeamProject[];
  members: OrgMember[];
  /** Projet présélectionné en création. */
  defaultProjectId?: string;
  /** Assignés présélectionnés en création (ex. colonne kanban). */
  defaultAssigneeIds?: string[];
  onCreate?: (input: CreateTeamTaskInput) => Promise<unknown>;
  onUpdate?: (taskId: string, input: UpdateTeamTaskInput) => Promise<unknown>;
  onDelete?: (task: TeamTask) => void;
  onClose: () => void;
}

const labelClass = 'block text-xs font-semibold uppercase tracking-wider mb-2';
const labelStyle = { color: 'rgb(var(--color-text-secondary))' };
// Tailles/traitement alignés sur le TaskModal personnel (DesktopDetailsStep) :
// px-4 h-12, text-base, bordure hover/focus au lieu d'un ring.
const inputClass =
  'w-full px-4 h-12 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none hover:border-[rgb(var(--color-accent-solid-hover))] focus:border-[rgb(var(--color-accent-solid))] focus:border-2 transition-all text-base';
const inputStyle = { backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' };

/**
 * Modal de tâche d'équipe — même langage visuel que le TaskModal personnel
 * (header sticky, fond background, labels uppercase, footer boutons), branché
 * sur le module team-projects : projet, priorité P1..P5, multi-assignation.
 */
const TeamTaskModal = ({
  task, isCreating = false, projects, members,
  defaultProjectId, defaultAssigneeIds,
  onCreate, onUpdate, onDelete, onClose,
}: TeamTaskModalProps) => {
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  // Pas de présélection en création : tant que l'utilisateur n'a pas cliqué
  // une priorité, aucune n'apparaît « choisie ». Le fallback à 3 (défaut DB,
  // mig. 062) n'intervient qu'au save, si le champ reste vraiment vide.
  const [priority, setPriority] = useState<number | null>(task?.priority ?? null);
  const [deadline, setDeadline] = useState(task?.deadline ?? '');
  const [estimatedTime, setEstimatedTime] = useState(task?.estimatedTime?.toString() ?? '');
  const [projectId, setProjectId] = useState(task?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? defaultAssigneeIds ?? []);
  const [showAssignees, setShowAssignees] = useState(isCreating ? (defaultAssigneeIds?.length ?? 0) > 0 : (task?.assigneeIds.length ?? 0) > 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { user } = useAuth();

  const hasChanges = useMemo(() => {
    if (isCreating) return true;
    if (!task) return false;
    const minutes = estimatedTime.trim() === '' ? undefined : Number(estimatedTime);
    return (
      name !== task.name ||
      description !== (task.description ?? '') ||
      priority !== task.priority ||
      deadline !== (task.deadline ?? '') ||
      (minutes ?? 0) !== (task.estimatedTime ?? 0) ||
      projectId !== task.projectId ||
      JSON.stringify([...assigneeIds].sort()) !== JSON.stringify([...task.assigneeIds].sort())
    );
  }, [isCreating, task, name, description, priority, deadline, estimatedTime, projectId, assigneeIds]);

  const toggleAssignee = (userId: string) =>
    setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

  const handleSave = async () => {
    if (pending) return;
    if (!name.trim()) { setError('Le nom de la tâche est requis'); return; }
    if (!projectId) { setError('Choisissez un projet'); return; }
    setPending(true);
    setError(null);
    const minutes = estimatedTime.trim() === '' ? undefined : Number(estimatedTime);
    const common = {
      name: name.trim(),
      description: description.trim(),
      ...(priority !== null ? { priority } : {}),
      deadline,
      ...(minutes !== undefined && !Number.isNaN(minutes) ? { estimatedTime: minutes } : {}),
      assigneeIds,
    };
    try {
      if (isCreating) await onCreate?.({ projectId, ...common });
      else if (task) await onUpdate?.(task.id, { projectId, ...common });
      onClose();
    } catch {
      setPending(false); // l'erreur est déjà notifiée par le hook (toast)
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      <div
        className="flex flex-col w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={isCreating ? 'Nouvelle tâche d\'équipe' : `Modifier la tâche ${task?.name ?? ''}`}
      >
        {/* Poignée mobile */}
        <div className="sm:hidden flex justify-center pt-4 pb-2 shrink-0">
          <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
        </div>

        {/* Header — sticky */}
        <div
          className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b gap-2 shrink-0"
          style={{ borderColor: 'rgb(var(--color-border))' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {isCreating ? 'Nouvelle tâche d\'équipe' : 'Modifier la tâche'}
            </h2>
            {hasChanges && !isCreating && (
              <div className="hidden xs:flex items-center gap-1 text-orange-500 text-xs font-medium bg-orange-500/10 px-2 py-1 rounded-md shrink-0">
                <AlertCircle size={12} aria-hidden="true" />
                <span className="hidden sm:inline">Non sauvegardé</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            aria-label="Fermer le formulaire"
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 disabled:opacity-50"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
                <AlertCircle size={16} aria-hidden="true" />
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-5">
            <div>
              <label htmlFor="team-task-name" className={labelClass} style={labelStyle}>Nom de la tâche *</label>
              <input
                id="team-task-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                placeholder="Que faut-il faire ?"
                autoFocus
                maxLength={500}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="team-task-desc" className={labelClass} style={labelStyle}>Description</label>
              <textarea
                id="team-task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={3}
                placeholder="Contexte, liens, critères d'acceptation…"
                className={`${inputClass} h-auto py-3 resize-y min-h-[76px]`}
                style={inputStyle}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="team-task-project" className={labelClass} style={labelStyle}>Projet *</label>
                <select
                  id="team-task-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {projectId && (
                  <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                    <span className={`w-2 h-2 rounded-full ${projectColor(projects.find((p) => p.id === projectId)?.color ?? 'blue').dot}`} aria-hidden="true" />
                    Projet d'équipe
                  </span>
                )}
              </div>

              <div>
                <span className={labelClass} style={labelStyle}>Priorité</span>
                <div className="flex gap-1.5 h-12 items-stretch" role="radiogroup" aria-label="Priorité">
                  {[1, 2, 3, 4, 5].map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={priority === p}
                      aria-label={PRIORITY_META[p].label}
                      title={PRIORITY_META[p].label}
                      onClick={() => setPriority(p)}
                      className={`flex-1 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                        priority === p
                          ? 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent-solid))]/10'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-[rgb(var(--color-hover))]'
                      }`}
                      style={{ color: priority === p ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))' }}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_META[p].dot}`} aria-hidden="true" />
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="team-task-deadline" className={labelClass} style={labelStyle}>Échéance</label>
                <input
                  id="team-task-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="team-task-time" className={labelClass} style={labelStyle}>Temps estimé (min)</label>
                <input
                  id="team-task-time"
                  type="number"
                  min={0}
                  max={100000}
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  placeholder="Ex : 45"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Assignés — disclosure, même pattern que « Partager la tâche » */}
            <div className="border-t pt-4" style={{ borderColor: 'rgb(var(--color-border))' }}>
              <button
                type="button"
                onClick={() => setShowAssignees((v) => !v)}
                aria-expanded={showAssignees}
                className="flex items-center gap-2 text-sm font-semibold hover:text-blue-500 transition-colors"
                style={{ color: 'rgb(var(--color-text-secondary))' }}
              >
                <ChevronRight size={16} aria-hidden="true" className={`transition-transform ${showAssignees ? 'rotate-90' : ''}`} />
                Assigner la tâche
                {assigneeIds.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-[rgb(var(--color-accent-solid))]/10 text-blue-500">
                    {assigneeIds.length}
                  </span>
                )}
              </button>
              {showAssignees && (
                <div className="mt-3 rounded-xl border overflow-hidden max-h-56 overflow-y-auto" style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}>
                  {members.map((m) => {
                    const checked = assigneeIds.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => toggleAssignee(m.userId)}
                        aria-pressed={checked}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
                      >
                        <MemberAvatar avatar={m.avatar} name={m.displayName} size={26} />
                        <span className="text-sm truncate flex-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {m.displayName}
                        </span>
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            checked ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]' : 'border-[rgb(var(--color-border))]'
                          }`}
                          aria-hidden="true"
                        >
                          {checked && <Check size={13} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </form>

          {/* Commentaires (reco #9) — édition uniquement (la tâche existe). */}
          {!isCreating && task && (
            <TaskCommentsSection taskId={task.id} members={members} currentUserId={user?.id} />
          )}
        </div>

        {/* Footer — mêmes boutons que TaskModal */}
        <div
          className="px-4 sm:px-6 pt-3 pb-3 sm:pb-4 border-t flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 sm:gap-3 shrink-0"
          style={{
            borderColor: 'rgb(var(--color-border))',
            backgroundColor: 'rgb(var(--color-surface))',
            paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
          }}
        >
          {!isCreating && task && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => { onDelete(task); onClose(); }}
              disabled={pending}
              className="min-h-11 w-full sm:w-auto text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              <Trash2 size={16} data-icon="inline-start" /> Supprimer
            </Button>
          ) : <span className="hidden sm:block" />}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={pending} className="min-h-11 w-full sm:w-auto">
              Annuler
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleSave}
              disabled={pending || !name.trim() || (!hasChanges && !isCreating)}
              className={`min-h-11 w-full sm:w-auto ${
                pending || !name.trim() || (!hasChanges && !isCreating)
                  ? '!bg-blue-300 dark:!bg-blue-900/60 !text-white !border-0 !opacity-100'
                  : 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-white !border-0'
              }`}
            >
              {pending ? (
                <>
                  <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
                  <span>{isCreating ? 'Création...' : 'Sauvegarde...'}</span>
                </>
              ) : (
                isCreating ? 'Créer la tâche' : 'Sauvegarder'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TeamTaskModal;
