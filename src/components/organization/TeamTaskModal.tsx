import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMyOrgPermissions } from '@/modules/organizations';
import { useMarkTaskNotificationsRead, type OrgMember } from '@/modules/organizations';
import {
  useApplyTeamTaskDraft,
  useTaskLabels,
  useToggleTaskLabel,
  type TeamProject,
  type TeamTask,
  type TeamTaskStatus,
  type CreateTeamTaskInput,
  type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { priorityLabelOf } from './team-projects.helpers';
import TaskCommentsSection from './TaskCommentsSection';
import MemberPickList from './MemberPickList';
import TeamTaskFields from './TeamTaskFields';
import TeamTaskLabelsField from './TeamTaskLabelsField';
import TeamTaskHistoryPanel from './TeamTaskHistoryPanel';
import TeamSubtasksSection from './TeamSubtasksSection';
import TeamTaskDependenciesSection from './TeamTaskDependenciesSection';
import { DraftSubtasksEditor, DraftDependenciesEditor } from './TeamTaskDraftSections';
import PreCreateCommentComposer from './PreCreateCommentComposer';
import { useAuth } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

type TaskTab = 'details' | 'subtasks' | 'dependencies' | 'history';

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
  /** Statut présélectionné en création (colonne du kanban par statut). */
  defaultStatus?: TeamTaskStatus;
  /**
   * N'ouvre PAS sur le premier projet : le « + » d'une colonne de kanban
   * n'a aucun projet en contexte, et y déposer la tâche en silence la
   * rangeait au mauvais endroit (audit Projets, 2026-09-24).
   */
  requireProjectChoice?: boolean;
  onCreate?: (input: CreateTeamTaskInput) => Promise<TeamTask>;
  onUpdate?: (taskId: string, input: UpdateTeamTaskInput) => Promise<unknown>;
  onDelete?: (task: TeamTask) => void;
  onClose: () => void;
  /**
   * Manager/admin — conditionne la CRÉATION d'étiquettes (policy
   * `team_labels_insert`, mig. 093) et l'édition du graphe de dépendances.
   * Défaut `false` : un appelant qui l'oublie masque un bouton plutôt que
   * d'exposer une action qui renverrait 403.
   */
  isManager?: boolean;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Fiche de tâche d'équipe : même langage visuel que le TaskModal personnel,
 * branchée sur le module team-projects.
 *
 * Audit des popups du 2026-09-25, tout traité ici :
 *   • le STATUT arrive en tête des champs ;
 *   • plus de création SILENCIEUSE au premier commentaire : le bouton dit
 *     « Créer et commenter », et une fois la tâche créée « Annuler » devient
 *     « Fermer » (plus rien à annuler) ;
 *   • onglets Détails · Sous-tâches · Dépendances · Historique, les deux
 *     premiers disponibles DÈS la création (brouillon appliqué après) ;
 *   • étiquettes (mig. 093) et historique (mig. 094) rebranchés ;
 *   • plus de création de projet intégrée (troisième chemin, sans équipe) ;
 *   • assignés via `MemberPickList` (recherche, équipes, pagination).
 */
const TeamTaskModal = ({
  task, isCreating = false, projects, members,
  defaultProjectId, defaultAssigneeIds, defaultStatus, requireProjectChoice = false,
  onCreate, onUpdate, onDelete, onClose, isManager = false,
}: TeamTaskModalProps) => {
  const { t } = useT('org');
  const [tab, setTab] = useState<TaskTab>('details');
  const [status, setStatus] = useState<TeamTaskStatus>(task?.status ?? defaultStatus ?? 'todo');
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  // Pas de présélection en création : tant que l'utilisateur n'a pas cliqué
  // une priorité, aucune n'apparaît « choisie ». Le fallback à 3 (défaut DB,
  // mig. 062) n'intervient qu'au save, si le champ reste vraiment vide.
  const [priority, setPriority] = useState<number | null>(task?.priority ?? null);
  const [deadline, setDeadline] = useState(task?.deadline ?? '');
  const [startDate, setStartDate] = useState(task?.startDate ?? '');
  const [estimatedTime, setEstimatedTime] = useState(task?.estimatedTime?.toString() ?? '');
  const [projectId, setProjectId] = useState(
    task?.projectId ?? defaultProjectId ?? (requireProjectChoice ? '' : projects[0]?.id ?? ''),
  );
  // Catégorie (mig. 111) — indépendante du projet : la tâche ne l'hérite
  // jamais automatiquement, même en changeant de projet.
  const [categoryId, setCategoryId] = useState<string | null>(task?.categoryId ?? null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? defaultAssigneeIds ?? []);
  const [showAssignees, setShowAssignees] = useState(isCreating ? (defaultAssigneeIds?.length ?? 0) > 0 : (task?.assigneeIds.length ?? 0) > 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { user } = useAuth();

  // Tâche créée EXPLICITEMENT par « Créer et commenter ». Une fois posée,
  // la fiche bascule en édition de CETTE tâche : « Créer » devient
  // « Enregistrer », et les onglets passent sur les vraies données.
  const [draftTask, setDraftTask] = useState<TeamTask | null>(null);
  const liveTask = task ?? draftTask;
  const creating = isCreating && !liveTask;
  const [pendingCommentDraft, setPendingCommentDraft] = useState<string | null>(null);

  // Brouillon des éléments qui ont besoin de l'id (appliqué après création).
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([]);
  const [draftBlockedBy, setDraftBlockedBy] = useState<string[]>([]);

  // Étiquettes : état de la fiche, écrit à l'enregistrement. `baseLabelIds`
  // est ce qui est en base, pour n'écrire que la différence.
  const { data: serverLabels } = useTaskLabels(task?.id);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [baseLabelIds, setBaseLabelIds] = useState<string[] | null>(task ? null : []);
  useEffect(() => {
    if (baseLabelIds === null && serverLabels) {
      const ids = serverLabels.map((l) => l.labelId);
      setBaseLabelIds(ids);
      setLabelIds(ids);
    }
  }, [serverLabels, baseLabelIds]);

  // Bascule assignés/commentaires : panneaux latéraux dès `lg` (1024px), sinon
  // repliés dans le modal. Un SEUL point de montage, jamais un rendu CSS
  // dupliqué : un brouillon de commentaire se perdrait en changeant de largeur.
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsWide(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // L'orgId ne vient jamais d'un prop dédié : tous les projets listés ici
  // partagent déjà celui de la tâche (édition) ou de la liste de l'appelant.
  const orgId = task?.orgId ?? projects[0]?.orgId ?? '';
  const { canAssign } = useMyOrgPermissions(orgId);
  const applyDraft = useApplyTeamTaskDraft(orgId);
  const toggleLabel = useToggleTaskLabel();

  // Ouvrir une tâche EXISTANTE fait disparaître son badge « commentaires non
  // lus » (mig. 109), pas une tâche en cours de création.
  const markTaskNotificationsRead = useMarkTaskNotificationsRead(orgId);
  useEffect(() => {
    if (task) markTaskNotificationsRead.mutate(task.id);
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    `markTaskNotificationsRead` est une mutation React Query recreee a
       chaque rendu : la mettre en dependance relancerait l ecriture en boucle.
       Seule l identite de la tache decide qu il faut marquer lu, et elle y est. */
  }, [task?.id]);

  const hasChanges = useMemo(() => {
    if (creating) return true;
    const ref = liveTask;
    if (!ref) return false;
    const minutes = estimatedTime.trim() === '' ? undefined : Number(estimatedTime);
    return (
      status !== ref.status ||
      name !== ref.name ||
      description !== (ref.description ?? '') ||
      priority !== ref.priority ||
      deadline !== (ref.deadline ?? '') ||
      startDate !== (ref.startDate ?? '') ||
      (minutes ?? 0) !== (ref.estimatedTime ?? 0) ||
      projectId !== ref.projectId ||
      categoryId !== (ref.categoryId ?? null) ||
      !sameSet(assigneeIds, ref.assigneeIds) ||
      (baseLabelIds !== null && !sameSet(labelIds, baseLabelIds))
    );
  }, [creating, liveTask, status, name, description, priority, deadline, startDate, estimatedTime, projectId, categoryId, assigneeIds, labelIds, baseLabelIds]);

  // Portée d'assignation (mig. 115) : on ne propose que les membres à portée,
  // en gardant ceux DÉJÀ assignés — le serveur ne contrôle que les ajouts.
  const assignableMembers = members.filter(
    (m) => canAssign(m.userId) || assigneeIds.includes(m.userId),
  );

  const buildCommon = () => {
    const minutes = estimatedTime.trim() === '' ? undefined : Number(estimatedTime);
    return {
      name: name.trim(),
      description: description.trim(),
      ...(priority !== null ? { priority } : {}),
      deadline,
      startDate,
      status,
      ...(minutes !== undefined && !Number.isNaN(minutes) ? { estimatedTime: minutes } : {}),
      assigneeIds,
      categoryId,
    };
  };

  const validate = (): boolean => {
    if (!name.trim()) { setError(t('taskModal.nameRequired')); setTab('details'); return false; }
    if (!projectId) { setError(t('taskModal.projectRequired')); setTab('details'); return false; }
    // CHECK `team_tasks_dates_order` (mig. 153) : le dire ici plutôt qu'en toast d'erreur SQL.
    if (startDate && deadline && startDate > deadline) { setError(t('taskModal.datesInvalid')); setTab('details'); return false; }
    return true;
  };

  /** Crée la tâche puis applique le brouillon. Renvoie la tâche, ou null (erreur déjà dite). */
  const createWithDraft = async (): Promise<TeamTask | null> => {
    const created = await onCreate?.({ projectId, ...buildCommon() });
    if (!created) return null;
    const draft = { subtasks: draftSubtasks, blockedByIds: draftBlockedBy, labelIds };
    if (draft.subtasks.length + draft.blockedByIds.length + draft.labelIds.length > 0) {
      // La tâche existe : un échec partiel est dit par le hook, il n'annule rien.
      await applyDraft.mutateAsync({ taskId: created.id, draft }).catch(() => undefined);
    }
    return created;
  };

  const syncLabels = async (taskId: string) => {
    const base = baseLabelIds ?? [];
    const changes = [
      ...labelIds.filter((id) => !base.includes(id)).map((labelId) => ({ taskId, labelId, attached: false })),
      ...base.filter((id) => !labelIds.includes(id)).map((labelId) => ({ taskId, labelId, attached: true })),
    ];
    await Promise.all(changes.map((c) => toggleLabel.mutateAsync(c)));
  };

  const handleSave = async () => {
    if (pending || !validate()) return;
    setPending(true);
    setError(null);
    try {
      if (creating) {
        await createWithDraft();
      } else if (liveTask) {
        await onUpdate?.(liveTask.id, { projectId, ...buildCommon() });
        await syncLabels(liveTask.id);
      }
      onClose();
    } catch {
      setPending(false); // l'erreur est déjà notifiée par le hook (toast)
    }
  };

  // « Créer et commenter » : création EXPLICITE (le bouton le dit), puis le
  // commentaire part dès que `TaskCommentsSection` monte avec le vrai id.
  const createAndComment = (body: string) => {
    if (pending || !validate()) return;
    setError(null);
    setPending(true);
    setPendingCommentDraft(body);
    void createWithDraft()
      .then((created) => {
        if (!created) { setPendingCommentDraft(null); return; }
        setDraftTask(created);
        setBaseLabelIds(labelIds);
        setDraftSubtasks([]);
        setDraftBlockedBy([]);
      })
      .catch(() => setPendingCommentDraft(null))
      .finally(() => setPending(false));
  };

  const sidePanelClass =
    'flex flex-col w-72 max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden shrink-0';
  const sidePanelStyle = { backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' };

  const comments = liveTask ? (
    <TaskCommentsSection
      taskId={liveTask.id}
      members={members}
      currentUserId={user?.id}
      autoSubmitDraft={pendingCommentDraft}
      onAutoSubmitted={() => setPendingCommentDraft(null)}
    />
  ) : (
    <PreCreateCommentComposer onSubmit={createAndComment} pending={pending} canSubmit={!!name.trim() && !!projectId} />
  );

  // C-53 — piège de focus, Échap, restitution au déclencheur. Le voile refuse
  // de fermer pendant l'enregistrement : Échap suit la MÊME règle.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!pending) onClose(); },
    label: isCreating ? t('taskModal.newAria') : t('taskModal.editAria', { name: task?.name ?? '' }),
  });

  const tabs: { id: TaskTab; label: string }[] = [
    { id: 'details', label: t('popups.task.tabDetails') },
    { id: 'subtasks', label: creating && draftSubtasks.length > 0 ? `${t('popups.task.tabSubtasks')} (${draftSubtasks.length})` : t('popups.task.tabSubtasks') },
    { id: 'dependencies', label: creating && draftBlockedBy.length > 0 ? `${t('popups.task.tabDependencies')} (${draftBlockedBy.length})` : t('popups.task.tabDependencies') },
    ...(liveTask ? [{ id: 'history' as const, label: t('popups.task.tabHistory') }] : []),
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      {/* items-start : chaque panneau garde sa hauteur de contenu au lieu
          d'être étiré à celle du modal central. */}
      <div className="flex items-start justify-center gap-4 w-full sm:w-auto">
        {isWide && (
          <div className={sidePanelClass} style={sidePanelStyle} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgb(var(--color-border))' }}>
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {t('taskModal.assignTask')}
                {assigneeIds.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-[rgb(var(--color-accent-solid))]/10 text-blue-500">
                    {assigneeIds.length}
                  </span>
                )}
              </h3>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              <MemberPickList
                members={assignableMembers}
                value={assigneeIds}
                onChange={setAssigneeIds}
                teamGroupsOrgId={orgId}
                label={t('taskModal.assignTask')}
              />
            </div>
          </div>
        )}

      <div
        className="flex flex-col w-full sm:max-w-xl sm:w-full shrink-0 max-h-[92vh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        onClick={(e) => e.stopPropagation()}
        ref={modalA11yRef}
        {...modalA11yProps}
      >
        {/* Poignée de glissement RETIRÉE, pas oubliée : elle ne faisait rien, et le geste n'a pas sa place sur un formulaire (docs/MOBILE.md §3). */}
        <div className="sm:hidden pt-3 shrink-0" aria-hidden="true" />

        <div
          className="flex justify-between items-center px-4 sm:px-6 py-[0.420204rem] sm:py-[0.560272rem] border-b gap-2 shrink-0"
          style={{ borderColor: 'rgb(var(--color-border))' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {creating ? t('taskModal.new') : t('taskModal.edit')}
            </h2>
            {draftTask && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded-md shrink-0" role="status">
                <CheckCircle2 size={12} aria-hidden="true" /> {t('popups.task.created')}
              </span>
            )}
            {hasChanges && !creating && (
              <div className="hidden xs:flex items-center gap-1 text-orange-500 text-xs font-medium bg-orange-500/10 px-2 py-1 rounded-md shrink-0">
                <AlertCircle size={12} aria-hidden="true" />
                <span className="hidden sm:inline">{t('taskModal.unsaved')}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            aria-label={t('taskModal.closeForm')}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 disabled:opacity-50"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" aria-label={t('popups.task.tabsAria')} className="flex gap-1 px-3 overflow-x-auto border-b shrink-0" style={{ borderColor: 'rgb(var(--color-border))' }}>
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`team-task-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="team-task-tabpanel"
              onClick={() => setTab(id)}
              className={`min-h-11 px-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === id
                  ? 'border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-text-primary))]'
                  : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          id="team-task-tabpanel"
          role="tabpanel"
          aria-labelledby={`team-task-tab-${tab}`}
          className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0"
          style={{ backgroundColor: 'rgb(var(--color-background))' }}
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
                <AlertCircle size={16} aria-hidden="true" />
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {tab === 'details' && (
            <>
              <TeamTaskFields
                orgId={orgId}
                projects={projects}
                status={status}
                onStatusChange={setStatus}
                name={name}
                onNameChange={(v) => { setName(v); setError(null); }}
                description={description}
                onDescriptionChange={setDescription}
                categoryId={categoryId}
                onCategoryChange={setCategoryId}
                labelsField={<TeamTaskLabelsField orgId={orgId} value={labelIds} onChange={setLabelIds} canCreate={isManager} />}
                projectId={projectId}
                onProjectChange={(v) => { setProjectId(v); setDraftBlockedBy([]); }}
                priority={priority}
                onPriorityChange={setPriority}
                deadline={deadline}
                onDeadlineChange={setDeadline}
                startDate={startDate}
                onStartDateChange={(v) => { setStartDate(v); setError(null); }}
                requireProjectChoice={requireProjectChoice}
                estimatedTime={estimatedTime}
                onEstimatedTimeChange={setEstimatedTime}
                assigneeIds={assigneeIds}
                onAssigneeIdsChange={setAssigneeIds}
                assignableMembers={assignableMembers}
                showAssignees={showAssignees}
                onToggleAssignees={() => setShowAssignees((v) => !v)}
                isWide={isWide}
                priorityLabelOf={priorityLabelOf}
                onSubmit={handleSave}
              />
              {/* Sous `lg`, les commentaires vivent ici ; au-delà, dans le panneau de droite. */}
              {!isWide && comments}
            </>
          )}

          {tab === 'subtasks' && (liveTask
            ? <TeamSubtasksSection taskId={liveTask.id} />
            : <DraftSubtasksEditor value={draftSubtasks} onChange={setDraftSubtasks} />)}

          {tab === 'dependencies' && (liveTask
            ? <TeamTaskDependenciesSection task={liveTask} isManager={isManager} defaultOpen />
            : <DraftDependenciesEditor orgId={orgId} projectId={projectId} value={draftBlockedBy} onChange={setDraftBlockedBy} canEdit={isManager} />)}

          {tab === 'history' && liveTask && (
            <TeamTaskHistoryPanel taskId={liveTask.id} members={members} projects={projects} />
          )}
        </div>

        <div
          className="px-4 sm:px-6 pt-[0.6555rem] pb-[0.6555rem] sm:pb-[0.874rem] border-t flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 sm:gap-3 shrink-0"
          style={{
            borderColor: 'rgb(var(--color-border))',
            backgroundColor: 'rgb(var(--color-surface))',
            paddingBottom: 'max(env(safe-area-inset-bottom), 0.6555rem)',
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
              <Trash2 size={16} data-icon="inline-start" /> {t('common.deleteAction')}
            </Button>
          ) : <span className="hidden sm:block" />}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            {/* La tâche créée par « Créer et commenter » existe : il n'y a plus
                rien à annuler, et le bouton ne doit pas prétendre le contraire. */}
            <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={pending} className="min-h-11 w-full sm:w-auto">
              {draftTask ? t('common.close') : t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleSave}
              disabled={pending || !name.trim() || (!hasChanges && !creating)}
              className={`min-h-11 w-full sm:w-auto ${
                pending || !name.trim() || (!hasChanges && !creating)
                  ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))] !opacity-40 !border-0'
                  : 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-0'
              }`}
            >
              {pending ? (
                <>
                  <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
                  <span>{creating ? t('taskModal.creating') : t('taskModal.saving')}</span>
                </>
              ) : (
                creating ? t('taskModal.create') : t('taskModal.save')
              )}
            </Button>
          </div>
        </div>
      </div>

        {isWide && (
          <div className={sidePanelClass} style={sidePanelStyle} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex flex-col flex-1 min-h-0">{comments}</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default TeamTaskModal;
