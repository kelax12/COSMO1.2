import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMarkTaskNotificationsRead, type OrgMember } from '@/modules/organizations';
import {
  useApplyTeamTaskDraft,
  type TeamProject,
  type TeamTask,
  type TeamTaskStatus,
  type CreateTeamTaskInput,
  type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { priorityLabelOf } from './team-projects.helpers';
import {
  buildTeamTaskCommon,
  initialTeamTaskForm,
  sameSet,
  teamTaskHasChanges,
  type TeamTaskFormValues,
} from './team-task-form.helpers';
import MemberPickList from './MemberPickList';
import TeamTaskFields from './TeamTaskFields';
import TeamTaskBlockedNote from './TeamTaskBlockedNote';
import TeamTaskValidationField from './TeamTaskValidationField';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import PreCreateCommentComposer from './PreCreateCommentComposer';
import { OrgCreateBoundary } from './org-create.context';
import { usePermissionHints } from './permission-hints';
import { useTeamLists, useSetTaskTeamLists } from '@/modules/team-lists';
import { useAuth } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { toast } from '@/lib/toast';
import type { Translator } from '@/i18n/useT';

const TeamTaskTabPanels = lazyWithRetry(() => import('./TeamTaskTabPanels'));
// Listes et « Suivre » : même raison, hors du premier affichage de la fiche.
const TeamTaskListsField = lazyWithRetry(() => import('./TeamTaskListsField'));
// Suivre (mig. 162) : chargé à part, catalogue compris (`TAB_GATE_HOSTS` : cette fiche déclare sa liste).
const TaskDetailsExtras = lazyWithRetry(() => import('./TaskDetailsExtras'), ['org', 'overlays']);
// Commentaires : panneau latéral, sous le premier affichage. Sortis
// du chunk pour le ramener sous son plafond (16,0 ko pour 14,5). Le brouillon
// « Créer et commenter » part toujours au MONTAGE de la section, qui attend
// simplement son module.
const TaskCommentsSection = lazyWithRetry(() => import('./TaskCommentsSection'));


type TaskTab = 'details' | 'advanced' | 'subtasks' | 'dependencies' | 'history';

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
  /** Listes présélectionnées en création (la liste qui filtre l'onglet, mig. 203). */
  defaultListIds?: string[];
  /**
   * N'ouvre PAS sur le premier projet : le « + » d'une colonne de kanban
   * n'a aucun projet en contexte, et y déposer la tâche en silence la
   * rangeait au mauvais endroit (audit Projets).
   */
  requireProjectChoice?: boolean;
  onCreate?: (input: CreateTeamTaskInput) => Promise<TeamTask>;
  onUpdate?: (taskId: string, input: UpdateTeamTaskInput) => Promise<unknown>;
  onDelete?: (task: TeamTask) => void;
  onClose: () => void;
  /**
   * Droit `task.editAny` (mig. 229) : conditionne l'édition du graphe de dépendances.
   * Défaut `false` : un appelant qui l'oublie masque un bouton plutôt que
   * d'exposer une action qui renverrait 403.
   */
  canEditDependencies?: boolean;
}

/**
 * Bascule assignés/commentaires : panneaux latéraux dès `lg` (1024px), sinon
 * repliés dans le modal. Un SEUL point de montage, jamais un rendu CSS
 * dupliqué : un brouillon de commentaire se perdrait en changeant de largeur.
 */
function useIsWide() {
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsWide(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isWide;
}

/**
 * Listes de la tâche (mig. 203) : lues une fois les listes chargées, puis
 * n'écrire que la différence avec ce que la tâche porte déjà.
 */
function useTaskTeamListsDraft(orgId: string, task: TeamTask | undefined, defaultListIds: string[] | undefined) {
  const { data: teamLists } = useTeamLists(orgId);
  const setTaskLists = useSetTaskTeamLists(orgId);
  const [listIds, setListIds] = useState<string[]>(() => (task ? [] : defaultListIds ?? []));
  const [baseListIds, setBaseListIds] = useState<string[] | null>(task ? null : []);
  useEffect(() => {
    if (baseListIds === null && task && teamLists) {
      const ids = teamLists.filter((l) => l.taskIds.includes(task.id)).map((l) => l.id);
      setBaseListIds(ids);
      setListIds(ids);
    }
  }, [teamLists, baseListIds, task]);
  const syncLists = (taskId: string) =>
    sameSet(listIds, baseListIds ?? []) ? Promise.resolve()
      : setTaskLists.mutateAsync({ taskId, before: baseListIds ?? [], after: listIds }).catch(() => undefined);
  return { listIds, setListIds, baseListIds, setBaseListIds, syncLists };
}

const sidePanelClass =
  'flex flex-col w-72 max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden shrink-0';
const sidePanelStyle = { backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' };

/** Panneau latéral des assignés (dès `lg`). */
function TeamTaskAssigneesPanel({ assignableMembers, assigneeIds, onChange, orgId }: {
  assignableMembers: OrgMember[];
  assigneeIds: string[];
  onChange: (ids: string[]) => void;
  orgId: string;
}) {
  const { t } = useT('org');
  return (
    <div data-guide-id="task-form-assignees" className={sidePanelClass} style={sidePanelStyle} onClick={(e) => e.stopPropagation()}>
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgb(var(--color-border))' }}>
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
          {t('taskModal.assignTask')}
          {assigneeIds.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-caption bg-[rgb(var(--color-accent-solid))]/10 text-blue-500">
              {assigneeIds.length}
            </span>
          )}
        </h3>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        <MemberPickList
          members={assignableMembers}
          value={assigneeIds}
          onChange={onChange}
          teamGroupsOrgId={orgId}
          label={t('taskModal.assignTask')}
        />
      </div>
    </div>
  );
}

/**
 * Droits sur la fiche. L'orgId ne vient jamais d'un prop dédié : tous les
 * projets listés ici partagent déjà celui de la tâche (édition) ou de la liste
 * de l'appelant. Une tâche existante qu'on ne peut pas modifier s'ouvre en
 * LECTURE : le bouton d'enregistrement est grisé et dit pourquoi, au lieu d'un
 * refus serveur.
 */
function useTeamTaskAccess(task: TeamTask | undefined, isCreating: boolean, projects: TeamProject[]) {
  const orgId = task?.orgId ?? projects[0]?.orgId ?? '';
  const { can, canAssign, taskEditReason, taskDeleteReason } = usePermissionHints(orgId);
  // La tâche ouverte en édition (absente en création).
  const existingTask = !isCreating && task ? task : undefined;
  const editReason = existingTask ? taskEditReason(existingTask) : undefined;
  const deleteReason = existingTask ? taskDeleteReason(existingTask) : undefined;
  return { orgId, can, canAssign, existingTask, editReason, deleteReason };
}

/** État du formulaire : un champ, un setter. */
function useTeamTaskFormState(initial: TeamTaskFormValues) {
  const [status, setStatus] = useState<TeamTaskStatus>(initial.status);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [priority, setPriority] = useState<number | null>(initial.priority);
  const [deadline, setDeadline] = useState(initial.deadline);
  // Le champ « Début » n'est plus saisi dans la modale : on conserve la valeur
  // existante, ramenée à l'échéance si celle-ci passe avant (CHECK mig. 153).
  const { startDate } = initial;
  const [estimatedTime, setEstimatedTime] = useState(initial.estimatedTime);
  const [projectId, setProjectId] = useState(initial.projectId);
  // Catégorie (mig. 111) : pré-remplie par celle du projet quand on en choisit
  // un, toujours modifiable ensuite.
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initial.assigneeIds);
  const [validatorId, setValidatorId] = useState<string | null>(initial.validatorId);
  const form: TeamTaskFormValues = { status, name, description, priority, deadline, startDate, estimatedTime, projectId, categoryId, assigneeIds, validatorId };
  const set = {
    status: setStatus, name: setName, description: setDescription, priority: setPriority,
    deadline: setDeadline, estimatedTime: setEstimatedTime, projectId: setProjectId,
    categoryId: setCategoryId, assigneeIds: setAssigneeIds, validatorId: setValidatorId,
  };
  return { form, set };
}

type TeamTaskFormSetters = ReturnType<typeof useTeamTaskFormState>['set'];

/** Onglets Détails et Avancé : les champs, la validation, les commentaires repliés sous `lg`. */
function TeamTaskFieldsPanel({
  section, orgId, projects, members, liveTask, me, form, set, onStatusChange, onNameChange, onProjectChange,
  listIds, onListIdsChange, requireProjectChoice, canCreateProject, assignableMembers, showAssignees,
  onToggleAssignees, isWide, onSubmit, onOpenDependencies, comments,
}: {
  section: 'details' | 'advanced';
  orgId: string;
  projects: TeamProject[];
  members: OrgMember[];
  liveTask: TeamTask | null;
  me: string | undefined;
  form: TeamTaskFormValues;
  set: TeamTaskFormSetters;
  onStatusChange: (v: TeamTaskStatus) => void;
  onNameChange: (v: string) => void;
  onProjectChange: (v: string) => void;
  listIds: string[];
  onListIdsChange: (ids: string[]) => void;
  requireProjectChoice: boolean;
  canCreateProject: boolean;
  assignableMembers: OrgMember[];
  showAssignees: boolean;
  onToggleAssignees: () => void;
  isWide: boolean;
  onSubmit: () => void;
  onOpenDependencies: () => void;
  comments: ReactNode;
}) {
  const details = section === 'details';
  return (
    <>
      {details && liveTask && <TeamTaskBlockedNote task={liveTask} onOpen={onOpenDependencies} />}
      <TeamTaskFields
        orgId={orgId}
        projects={projects}
        status={form.status}
        onStatusChange={onStatusChange}
        name={form.name}
        onNameChange={onNameChange}
        description={form.description}
        onDescriptionChange={set.description}
        categoryId={form.categoryId}
        onCategoryChange={set.categoryId}
        labelsField={
          <Suspense fallback={null}>
            <TeamTaskListsField orgId={orgId} value={listIds} onChange={onListIdsChange} />
          </Suspense>
        }
        projectId={form.projectId}
        onProjectChange={onProjectChange}
        priority={form.priority}
        onPriorityChange={set.priority}
        deadline={form.deadline}
        onDeadlineChange={set.deadline}
        requireProjectChoice={requireProjectChoice}
        estimatedTime={form.estimatedTime}
        onEstimatedTimeChange={set.estimatedTime}
        onProjectCreated={canCreateProject ? set.projectId : undefined}
        assigneeIds={form.assigneeIds}
        onAssigneeIdsChange={set.assigneeIds}
        assignableMembers={assignableMembers}
        showAssignees={showAssignees}
        onToggleAssignees={onToggleAssignees}
        isWide={isWide}
        priorityLabelOf={priorityLabelOf}
        onSubmit={onSubmit}
        section={section}
      />
      {details && <TeamTaskValidationField members={members} task={liveTask} me={me} value={form.validatorId} onChange={set.validatorId} />}
      {/* Sous `lg`, les commentaires vivent ici ; au-delà, dans le panneau de droite. */}
      {details && !isWide && comments}
      {/* Suivre une tâche (mig. 162, M14) : ses changements de statut
          arrivent dans la cloche même quand on n'y est pas assigné. */}
      {details && liveTask && (
        <Suspense fallback={null}><TaskDetailsExtras orgId={orgId} task={liveTask} /></Suspense>
      )}
    </>
  );
}

/** Onglets de la fiche ; un brouillon (création) se compte dans son libellé. */
function teamTaskTabs(
  t: Translator<'org'>['t'],
  o: { creating: boolean; draftSubtasks: number; draftDependencies: number; hasHistory: boolean },
): { id: TaskTab; label: string }[] {
  const counted = (label: string, n: number) => (o.creating && n > 0 ? `${label} (${n})` : label);
  return [
    { id: 'details', label: t('popups.task.tabDetails') },
    { id: 'advanced', label: t('popups.task.tabAdvanced') },
    { id: 'subtasks', label: counted(t('popups.task.tabSubtasks'), o.draftSubtasks) },
    { id: 'dependencies', label: counted(t('popups.task.tabDependencies'), o.draftDependencies) },
    ...(o.hasHistory ? [{ id: 'history' as const, label: t('popups.task.tabHistory') }] : []),
  ];
}

/** Lecture seule (droit manquant) et erreur de validation, en tête du panneau. */
function TeamTaskNotices({ editReason, error }: { editReason?: string; error: string | null }) {
  return (
    <>
      {editReason && (
        <p className="mb-4 p-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] text-xs text-[rgb(var(--color-text-secondary))]" role="note">
          {editReason}
        </p>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
            <AlertCircle size={16} aria-hidden="true" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Enregistrer et « Créer et commenter ». Une création applique ensuite le
 * brouillon (sous-tâches, dépendances) et les listes ; un échec est déjà
 * notifié par le hook de mutation (toast), la fiche reste ouverte.
 */
function useTeamTaskSubmit(o: {
  form: TeamTaskFormValues;
  creating: boolean;
  liveTask: TeamTask | null;
  onCreate?: (input: CreateTeamTaskInput) => Promise<TeamTask>;
  onUpdate?: (taskId: string, input: UpdateTeamTaskInput) => Promise<unknown>;
  onClose: () => void;
  syncLists: (taskId: string) => Promise<unknown>;
  applyDraft: (taskId: string) => Promise<void>;
  onInvalid: () => void;
  onCreatedForComment: (created: TeamTask) => void;
}) {
  const { t } = useT('org');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingCommentDraft, setPendingCommentDraft] = useState<string | null>(null);
  const { form, creating, liveTask } = o;
  const { projectId } = form;

  const validate = (): boolean => {
    if (!form.name.trim()) { setError(t('taskModal.nameRequired')); o.onInvalid(); return false; }
    if (!projectId) { setError(t('taskModal.projectRequired')); o.onInvalid(); return false; }
    return true;
  };

  /** Crée la tâche puis applique le brouillon. Renvoie la tâche, ou null (erreur déjà dite). */
  const createWithDraft = async (): Promise<TeamTask | null> => {
    const created = await o.onCreate?.({ projectId, ...buildTeamTaskCommon(form) });
    if (!created) return null;
    await o.applyDraft(created.id);
    await o.syncLists(created.id);
    return created;
  };

  const handleSave = async () => {
    if (pending || !validate()) return;
    setPending(true);
    setError(null);
    try {
      if (creating) {
        await createWithDraft();
      } else if (liveTask) {
        await o.onUpdate?.(liveTask.id, { projectId, ...buildTeamTaskCommon(form) });
        await o.syncLists(liveTask.id);
      }
      o.onClose();
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
        o.onCreatedForComment(created);
      })
      .catch(() => setPendingCommentDraft(null))
      .finally(() => setPending(false));
  };

  return { pending, error, setError, pendingCommentDraft, setPendingCommentDraft, handleSave, createAndComment };
}

/** Assignés dépliés à l'ouverture seulement s'il y en a déjà. */
function initialShowAssignees(isCreating: boolean, task: TeamTask | undefined, defaultAssigneeIds: string[] | undefined) {
  return isCreating ? (defaultAssigneeIds?.length ?? 0) > 0 : (task?.assigneeIds.length ?? 0) > 0;
}

/** Nom accessible de la fiche. */
function teamTaskModalLabel(t: Translator<'org'>['t'], isCreating: boolean, task: TeamTask | undefined) {
  return isCreating ? t('taskModal.newAria') : t('taskModal.editAria', { name: task?.name ?? '' });
}

/** Enregistrer : un nom, un changement (ou une création), le droit, et rien en vol. */
function canSaveTeamTask(o: { pending: boolean; name: string; hasChanges: boolean; creating: boolean; editReason?: string }) {
  return !(o.pending || !o.name.trim() || (!o.hasChanges && !o.creating) || !!o.editReason);
}

/**
 * Ouvrir une tâche EXISTANTE fait disparaître son badge « commentaires non
 * lus » (mig. 109), pas une tâche en cours de création.
 */
function useMarkTaskReadOnOpen(orgId: string, task: TeamTask | undefined) {
  const markTaskNotificationsRead = useMarkTaskNotificationsRead(orgId);
  useEffect(() => {
    if (task) markTaskNotificationsRead.mutate(task.id);
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    `markTaskNotificationsRead` est une mutation React Query recreee a
       chaque rendu : la mettre en dependance relancerait l ecriture en boucle.
       Seule l identite de la tache decide qu il faut marquer lu, et elle y est. */
  }, [task?.id]);
}

/**
 * Commentaires : ceux de la tâche dès qu'elle existe ; avant, le compositeur
 * « Créer et commenter » (création EXPLICITE, le bouton le dit).
 */
function TeamTaskComments({ liveTask, members, pendingCommentDraft, onAutoSubmitted, onCreateAndComment, pending, canSubmit }: {
  liveTask: TeamTask | null;
  members: OrgMember[];
  pendingCommentDraft: string | null;
  onAutoSubmitted: () => void;
  onCreateAndComment: (body: string) => void;
  pending: boolean;
  canSubmit: boolean;
}) {
  const { user } = useAuth();
  return liveTask ? (
    <Suspense fallback={null}>
      <TaskCommentsSection
        taskId={liveTask.id}
        members={members}
        currentUserId={user?.id}
        autoSubmitDraft={pendingCommentDraft}
        onAutoSubmitted={onAutoSubmitted}
      />
    </Suspense>
  ) : (
    <PreCreateCommentComposer onSubmit={onCreateAndComment} pending={pending} canSubmit={canSubmit} />
  );
}

/** Panneau latéral des commentaires (dès `lg`). */
function TeamTaskCommentsPanel({ children }: { children: ReactNode }) {
  return (
    <div className={sidePanelClass} style={sidePanelStyle} onClick={(e) => e.stopPropagation()}>
      <div className="px-4 py-3 flex flex-col flex-1 min-h-0">{children}</div>
    </div>
  );
}

/** En-tête : titre, « créée », « non enregistré », fermeture. */
function TeamTaskModalHeader({ creating, created, unsaved, pending, onClose }: {
  creating: boolean;
  created: boolean;
  unsaved: boolean;
  pending: boolean;
  onClose: () => void;
}) {
  const { t } = useT('org');
  return (
    <div
      className="flex justify-between items-center px-4 sm:px-6 py-[0.420204rem] sm:py-[0.560272rem] border-b gap-2 shrink-0"
      style={{ borderColor: 'rgb(var(--color-border))' }}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
          {creating ? t('taskModal.new') : t('taskModal.edit')}
        </h2>
        {created && (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded-md shrink-0" role="status">
            <CheckCircle2 size={12} aria-hidden="true" /> {t('popups.task.created')}
          </span>
        )}
        {unsaved && (
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
  );
}

/** Barre d'onglets de la fiche. */
function TeamTaskTabBar({ tabs, active, onSelect }: {
  tabs: { id: TaskTab; label: string }[];
  active: TaskTab;
  onSelect: (id: TaskTab) => void;
}) {
  const { t } = useT('org');
  return (
    <div role="tablist" aria-label={t('popups.task.tabsAria')} className="flex gap-1 px-3 overflow-x-auto overflow-y-hidden border-b shrink-0" style={{ borderColor: 'rgb(var(--color-border))' }}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`team-task-tab-${id}`}
          data-guide-id={id === 'subtasks' ? 'task-detail-subtasks' : id === 'dependencies' ? 'task-detail-dependencies' : undefined}
          aria-selected={active === id}
          aria-controls="team-task-tabpanel"
          onClick={() => onSelect(id)}
          // 44 px (WCAG 2.5.5). La barre de défilement que 290e2599 a fait
          // disparaître venait du `-mb-px` dans un conteneur overflow-x-auto :
          // `overflow-y-hidden` la règle seul, la hauteur n'y était pour rien.
          className={`min-h-11 px-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
            active === id
              ? 'border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-text-primary))]'
              : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Pied : suppression, annuler / fermer, créer / enregistrer. */
function TeamTaskModalFooter({ onDelete, deleteReason, pending, created, creating, saveDisabled, editReason, onClose, onSave }: {
  onDelete?: () => void;
  deleteReason?: string;
  pending: boolean;
  created: boolean;
  creating: boolean;
  saveDisabled: boolean;
  editReason?: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useT('org');
  return (
    <div
      className="px-4 sm:px-6 pt-[0.6555rem] pb-[0.6555rem] sm:pb-[0.874rem] border-t flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 sm:gap-3 shrink-0"
      style={{
        borderColor: 'rgb(var(--color-border))',
        backgroundColor: 'rgb(var(--color-surface))',
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.6555rem)',
      }}
    >
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={onDelete}
          disabled={pending || !!deleteReason}
          title={deleteReason}
          className="min-h-11 w-full sm:w-auto text-red-500 hover:text-red-600 hover:bg-red-500/10"
        >
          <Trash2 size={16} data-icon="inline-start" /> {t('common.deleteAction')}
        </Button>
      ) : <span className="hidden sm:block" />}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
        {/* La tâche créée par « Créer et commenter » existe : il n'y a plus
            rien à annuler, et le bouton ne doit pas prétendre le contraire. */}
        <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={pending} className="min-h-11 w-full sm:w-auto">
          {created ? t('common.close') : t('common.cancel')}
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={onSave}
          disabled={saveDisabled}
          title={editReason}
          className={`min-h-11 w-full sm:w-auto ${
            saveDisabled
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
  );
}

/**
 * Fiche de tâche d'équipe : même langage visuel que le TaskModal personnel,
 * branchée sur le module team-projects.
 *
 * Audit des popups, tout traité ici :
 *   • le STATUT arrive en tête des champs ;
 *   • plus de création SILENCIEUSE au premier commentaire : le bouton dit
 *     « Créer et commenter », et une fois la tâche créée « Annuler » devient
 *     « Fermer » (plus rien à annuler) ;
 *   • onglets Détails · Sous-tâches · Dépendances · Historique, les deux
 *     premiers disponibles DÈS la création (brouillon appliqué après) ;
 * • historique (mig. 094) rebranché (étiquettes retirées) ;
 *   • plus de création de projet intégrée (troisième chemin, sans équipe) ;
 *   • assignés via `MemberPickList` (recherche, équipes, pagination).
 */
const TeamTaskModal = ({
  task, isCreating = false, projects, members,
  defaultProjectId, defaultAssigneeIds, defaultStatus, defaultListIds, requireProjectChoice = false,
  onCreate, onUpdate, onDelete, onClose, canEditDependencies = false,
}: TeamTaskModalProps) => {
  const { t } = useT('org');
  const [tab, setTab] = useState<TaskTab>('details');
  // Valeurs d'ouverture : cf. `initialTeamTaskForm` (pas de priorité
  // présélectionnée, catégorie du projet d'ouverture en création).
  const [initial] = useState(() => initialTeamTaskForm({ task, projects, defaultProjectId, defaultAssigneeIds, defaultStatus, requireProjectChoice }));
  const { form, set } = useTeamTaskFormState(initial);
  const { name, projectId, assigneeIds } = form;
  const [showAssignees, setShowAssignees] = useState(() => initialShowAssignees(isCreating, task, defaultAssigneeIds));
  const { user } = useAuth();

  // Tâche créée EXPLICITEMENT par « Créer et commenter ». Une fois posée,
  // la fiche bascule en édition de CETTE tâche : « Créer » devient
  // « Enregistrer », et les onglets passent sur les vraies données.
  const [draftTask, setDraftTask] = useState<TeamTask | null>(null);
  const liveTask = task ?? draftTask;
  const creating = isCreating && !liveTask;

  // Brouillon des éléments qui ont besoin de l'id (appliqué après création).
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([]);
  const [draftBlockedBy, setDraftBlockedBy] = useState<string[]>([]);
  const [draftBlocks, setDraftBlocks] = useState<string[]>([]);

  const isWide = useIsWide();

  const { orgId, can, canAssign, existingTask, editReason, deleteReason } = useTeamTaskAccess(task, isCreating, projects);
  const applyDraft = useApplyTeamTaskDraft(orgId);

  const { listIds, setListIds, baseListIds, setBaseListIds, syncLists } = useTaskTeamListsDraft(orgId, task, defaultListIds);

  useMarkTaskReadOnOpen(orgId, task);

  const hasChanges = creating || (!!liveTask && teamTaskHasChanges(form, liveTask, { listIds, baseListIds }));

  // Portée d'assignation (mig. 115) : on ne propose que les membres à portée,
  // en gardant ceux DÉJÀ assignés — le serveur ne contrôle que les ajouts.
  const assignableMembers = members.filter(
    (m) => canAssign(m.userId) || assigneeIds.includes(m.userId),
  );

  const {
    pending, error, setError, pendingCommentDraft, setPendingCommentDraft, handleSave, createAndComment,
  } = useTeamTaskSubmit({
    form, creating, liveTask, onCreate, onUpdate, onClose, syncLists,
    applyDraft: (taskId) => {
      const draft = { subtasks: draftSubtasks, blockedByIds: draftBlockedBy, blocksIds: draftBlocks };
      if (draft.subtasks.length + draft.blockedByIds.length + draft.blocksIds.length === 0) return Promise.resolve();
      // La tâche existe : un échec partiel est dit par le hook, il n'annule rien.
      return applyDraft.mutateAsync({ taskId, draft }).then(() => undefined, () => undefined);
    },
    onInvalid: () => setTab('details'),
    onCreatedForComment: (created) => {
      setDraftTask(created);
      setBaseListIds(listIds);
      setDraftSubtasks([]);
      setDraftBlockedBy([]);
      setDraftBlocks([]);
    },
  });

  const comments = (
    <TeamTaskComments
      liveTask={liveTask}
      members={members}
      pendingCommentDraft={pendingCommentDraft}
      onAutoSubmitted={() => setPendingCommentDraft(null)}
      onCreateAndComment={createAndComment}
      pending={pending}
      canSubmit={!!name.trim() && !!projectId}
    />
  );

  // C-53 — piège de focus, Échap, restitution au déclencheur. Le voile refuse
  // de fermer pendant l'enregistrement : Échap suit la MÊME règle.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!pending) onClose(); },
    label: teamTaskModalLabel(t, isCreating, task),
  });

  const tabs = teamTaskTabs(t, {
    creating,
    draftSubtasks: draftSubtasks.length,
    draftDependencies: draftBlockedBy.length + draftBlocks.length,
    hasHistory: !!liveTask,
  });

  // `OrgCreateBoundary` : le formulaire de projet s'ouvre aussi quand ce modal
  // vient de la page Tâches personnelle, hors de /entreprise.
  return createPortal(
    <OrgCreateBoundary orgId={orgId}>
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      {/* items-start : chaque panneau garde sa hauteur de contenu au lieu
          d'être étiré à celle du modal central. */}
      <div className="flex items-start justify-center gap-4 w-full sm:w-auto">
        {isWide && (
          <TeamTaskAssigneesPanel
            assignableMembers={assignableMembers}
            assigneeIds={assigneeIds}
            onChange={set.assigneeIds}
            orgId={orgId}
          />
        )}

      <div
        className="flex flex-col w-full sm:max-w-xl sm:w-full shrink-0 max-h-[92vh] sm:h-[85vh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        onClick={(e) => e.stopPropagation()}
        ref={modalA11yRef}
        {...modalA11yProps}
      >
        {/* Poignée de glissement RETIRÉE, pas oubliée : elle ne faisait rien, et le geste n'a pas sa place sur un formulaire (docs/MOBILE.md §3). */}
        <div className="sm:hidden pt-3 shrink-0" aria-hidden="true" />

        <TeamTaskModalHeader
          creating={creating}
          created={!!draftTask}
          unsaved={hasChanges && !creating}
          pending={pending}
          onClose={onClose}
        />

        <TeamTaskTabBar tabs={tabs} active={tab} onSelect={setTab} />

        <div
          id="team-task-tabpanel"
          role="tabpanel"
          aria-labelledby={`team-task-tab-${tab}`}
          className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0"
          style={{ backgroundColor: 'rgb(var(--color-background))' }}
        >
          <TeamTaskNotices editReason={editReason} error={error} />

          {(tab === 'details' || tab === 'advanced') && (
            <TeamTaskFieldsPanel
              section={tab}
              orgId={orgId}
              projects={projects}
              members={members}
              liveTask={liveTask}
              me={user?.id}
              form={form}
              set={set}
              onStatusChange={(v) => {
                // Sans le droit, le clic dit pourquoi au lieu de changer un statut
                // que Sauvegarder (grisé) ne pourrait jamais écrire.
                if (editReason) { toast.info(t('popups.task.noRights'), { description: editReason }); return; }
                set.status(v);
              }}
              onNameChange={(v) => { set.name(v); setError(null); }}
              onProjectChange={(v) => {
                set.projectId(v);
                setDraftBlockedBy([]);
                setDraftBlocks([]);
                const projectCategory = projects.find((p) => p.id === v)?.categoryId;
                if (projectCategory) set.categoryId(projectCategory);
              }}
              listIds={listIds}
              onListIdsChange={setListIds}
              requireProjectChoice={requireProjectChoice}
              canCreateProject={can['project.create']}
              assignableMembers={assignableMembers}
              showAssignees={showAssignees}
              onToggleAssignees={() => setShowAssignees((v) => !v)}
              isWide={isWide}
              onSubmit={handleSave}
              onOpenDependencies={() => setTab('dependencies')}
              comments={comments}
            />
          )}


          {/* Sous-tâches, dépendances, historique : chargés à la première
              ouverture de leur onglet (cf. TeamTaskTabPanels). */}
          {tab !== 'details' && tab !== 'advanced' && (
            <Suspense fallback={null}>
              <TeamTaskTabPanels
                tab={tab}
                orgId={orgId}
                liveTask={liveTask}
                canEditDependencies={canEditDependencies}
                projectId={projectId}
                members={members}
                projects={projects}
                draftSubtasks={draftSubtasks}
                onDraftSubtasksChange={setDraftSubtasks}
                draftBlockedBy={draftBlockedBy}
                onDraftBlockedByChange={setDraftBlockedBy}
                draftBlocks={draftBlocks}
                onDraftBlocksChange={setDraftBlocks}
              />
            </Suspense>
          )}
        </div>

        <TeamTaskModalFooter
          onDelete={existingTask && onDelete ? () => { onDelete(existingTask); onClose(); } : undefined}
          deleteReason={deleteReason}
          pending={pending}
          created={!!draftTask}
          creating={creating}
          saveDisabled={!canSaveTeamTask({ pending, name, hasChanges, creating, editReason })}
          editReason={editReason}
          onClose={onClose}
          onSave={handleSave}
        />
      </div>

        {isWide && <TeamTaskCommentsPanel>{comments}</TeamTaskCommentsPanel>}
      </div>
    </div>
    </OrgCreateBoundary>,
    document.body,
  );
};

export default TeamTaskModal;
