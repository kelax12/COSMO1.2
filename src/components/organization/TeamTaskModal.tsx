import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Trash2, Loader2, ChevronRight, Check, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMarkTaskNotificationsRead, type OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTask, CreateTeamTaskInput, UpdateTeamTaskInput } from '@/modules/team-projects';
import { useCreateTeamProject } from '@/modules/team-projects';
import { PRIORITY_META, projectColor } from './team-projects.helpers';
import AddCategoryButton from '@/components/AddCategoryButton';
import DescriptionField from '@/components/DescriptionField';
import MemberAvatar from './MemberAvatar';
import TaskCommentsSection from './TaskCommentsSection';
import TeamAssigneeGroups from './TeamAssigneeGroups';
import TeamCategoryPicker from './TeamCategoryPicker';
import TeamSubtasksSection from './TeamSubtasksSection';
import TeamTaskDependenciesSection from './TeamTaskDependenciesSection';
import { useAuth } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';

/**
 * Composeur affiché à la place de `TaskCommentsSection` tant que la tâche
 * n'existe pas encore (item #3) — un commentaire référence `taskId` (mig.
 * 082), impossible avant le premier enregistrement. Poster ici crée la
 * tâche EN SILENCE (`onSubmit`, côté TeamTaskModal) puis poste le
 * commentaire dans la foulée : du point de vue de l'utilisateur, ça
 * fonctionne « même si la tâche n'est pas encore créée ».
 */
const PreCreateCommentComposer = ({ onSubmit, pending }: { onSubmit: (body: string) => void; pending: boolean }) => {
  const { t } = useT('org');
  const [body, setBody] = useState('');

  const submit = () => {
    const text = body.trim();
    if (!text || pending) return;
    onSubmit(text);
    setBody('');
  };

  return (
    <div className="flex flex-col h-full min-h-0 border-t pt-4 mt-5" style={{ borderColor: 'rgb(var(--color-border))' }}>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3 shrink-0" style={{ color: 'rgb(var(--color-text-secondary))' }}>
        <MessageSquare size={15} aria-hidden="true" />
        Commentaires
      </h3>
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          rows={2}
          maxLength={2000}
          placeholder={t('comments.placeholder')}
          className="flex-1 px-3 py-2 text-sm rounded-xl border resize-none focus:outline-none focus:border-[rgb(var(--color-accent))]"
          style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim() || pending}
          aria-label={t('comments.sendAria')}
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90"
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

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
  onCreate?: (input: CreateTeamTaskInput) => Promise<TeamTask>;
  onUpdate?: (taskId: string, input: UpdateTeamTaskInput) => Promise<unknown>;
  onDelete?: (task: TeamTask) => void;
  onClose: () => void;
  /**
   * Manager/admin — conditionne la CRÉATION de labels (policy
   * `team_labels_insert`, mig. 093). Poser un label existant reste ouvert à
   * quiconque peut éditer la tâche. Défaut `false` : un appelant qui l'oublie
   * masque un bouton plutôt que d'exposer une action qui renverrait 403.
   */
  isManager?: boolean;
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
  onCreate, onUpdate, onDelete, onClose, isManager = false,
}: TeamTaskModalProps) => {
  const { t } = useT('org');
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  // Pas de présélection en création : tant que l'utilisateur n'a pas cliqué
  // une priorité, aucune n'apparaît « choisie ». Le fallback à 3 (défaut DB,
  // mig. 062) n'intervient qu'au save, si le champ reste vraiment vide.
  const [priority, setPriority] = useState<number | null>(task?.priority ?? null);
  const [deadline, setDeadline] = useState(task?.deadline ?? '');
  const [estimatedTime, setEstimatedTime] = useState(task?.estimatedTime?.toString() ?? '');
  const [projectId, setProjectId] = useState(task?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '');
  // Catégorie (mig. 111) — indépendante du projet : la tâche ne l'hérite
  // jamais automatiquement, même en changeant de projet.
  const [categoryId, setCategoryId] = useState<string | null>(task?.categoryId ?? null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? defaultAssigneeIds ?? []);
  const [showAssignees, setShowAssignees] = useState(isCreating ? (defaultAssigneeIds?.length ?? 0) > 0 : (task?.assigneeIds.length ?? 0) > 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { user } = useAuth();

  // Tâche créée EN SILENCE dès le premier commentaire tapé en création (item
  // #3) : un commentaire référence `taskId` (mig. 082), impossible avant le
  // premier enregistrement. Une fois posée, la tâche existe déjà en base —
  // le bouton « Créer la tâche » du footer bascule alors sur une mise à jour
  // de CETTE tâche plutôt que d'en créer une seconde. `task` (prop) reste
  // intact : le reste du modal (sous-tâches, historique) continue de suivre
  // la sémantique « pas encore créée » pour ne pas changer de comportement
  // au-delà du strict nécessaire.
  const [draftTask, setDraftTask] = useState<TeamTask | null>(null);
  const commentsTask = task ?? draftTask;
  // Texte tapé dans le composeur « pré-création » — posté par
  // `TaskCommentsSection` dès qu'elle monte avec le vrai id (cf. son
  // `autoSubmitDraft`), une fois `draftTask` posé plus bas.
  const [pendingCommentDraft, setPendingCommentDraft] = useState<string | null>(null);

  // Bascule assignés/commentaires : panneaux latéraux dès `lg` (1024px), sinon
  // repliés dans le modal. Un SEUL point de montage — pas un rendu CSS dupliqué
  // caché/affiché par breakpoint : un brouillon de commentaire tapé côté panneau
  // se serait perdu en repassant sous `lg` (la version mobile eût démarré vide),
  // et un `getByPlaceholder` de test aurait résolu deux éléments.
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsWide(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Créer un projet sans quitter la tâche — même pattern que « + Ajouter »
  // pour une catégorie (DesktopDetailsStep). L'orgId ne vient jamais d'un
  // prop dédié : tous les projets listés ici partagent déjà celui de la
  // tâche (édition) ou de la liste passée par l'appelant (création).
  const orgId = task?.orgId ?? projects[0]?.orgId ?? '';
  const createProject = useCreateTeamProject(orgId);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Ouvrir une tâche EXISTANTE fait disparaître son badge « commentaires non
  // lus » (mig. 109) — pas la tâche en cours de création, qui n'a encore
  // aucune notification à marquer.
  const markTaskNotificationsRead = useMarkTaskNotificationsRead(orgId);
  useEffect(() => {
    if (task) markTaskNotificationsRead.mutate(task.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const submitNewProject = () => {
    const projectName = newProjectName.trim();
    if (projectName.length < 2) {
      toast.error(t('taskModal.projectNameTooShort'));
      return;
    }
    createProject.mutate(
      { name: projectName },
      {
        onSuccess: (created) => {
          setProjectId(created.id);
          setShowNewProjectInput(false);
          setNewProjectName('');
        },
      },
    );
  };

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
      categoryId !== (task.categoryId ?? null) ||
      JSON.stringify([...assigneeIds].sort()) !== JSON.stringify([...task.assigneeIds].sort())
    );
  }, [isCreating, task, name, description, priority, deadline, estimatedTime, projectId, categoryId, assigneeIds]);

  const toggleAssignee = (userId: string) =>
    setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

  // Une seule ligne pour les deux rendus (disclosure mobile ET panneau
  // desktop) : même état (`assigneeIds`), même comportement, pas de logique
  // dupliquée qui pourrait diverger.
  const renderAssigneeRow = (m: OrgMember) => {
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
  };

  // Champs communs create/update — factorisé pour être rejoué tel quel par
  // la création silencieuse déclenchée depuis le premier commentaire.
  const buildCommon = () => {
    const minutes = estimatedTime.trim() === '' ? undefined : Number(estimatedTime);
    return {
      name: name.trim(),
      description: description.trim(),
      ...(priority !== null ? { priority } : {}),
      deadline,
      ...(minutes !== undefined && !Number.isNaN(minutes) ? { estimatedTime: minutes } : {}),
      assigneeIds,
      categoryId,
    };
  };

  const handleSave = async () => {
    if (pending) return;
    if (!name.trim()) { setError(t('taskModal.nameRequired')); return; }
    if (!projectId) { setError(t('taskModal.projectRequired')); return; }
    setPending(true);
    setError(null);
    const common = buildCommon();
    try {
      if (draftTask) await onUpdate?.(draftTask.id, { projectId, ...common });
      else if (isCreating) await onCreate?.({ projectId, ...common });
      else if (task) await onUpdate?.(task.id, { projectId, ...common });
      onClose();
    } catch {
      setPending(false); // l'erreur est déjà notifiée par le hook (toast)
    }
  };

  // Premier commentaire tapé alors que la tâche n'existe pas encore : la crée
  // silencieusement (mêmes champs que le formulaire à cet instant) puis
  // renvoie son id pour que l'appelant poste le commentaire dans la foulée.
  const ensureTaskForComment = async (): Promise<string | null> => {
    if (commentsTask) return commentsTask.id;
    if (!name.trim()) { setError(t('taskModal.nameRequired')); return null; }
    if (!projectId) { setError(t('taskModal.projectRequired')); return null; }
    setError(null);
    setPending(true);
    try {
      const created = await onCreate?.({ projectId, ...buildCommon() });
      if (!created) return null;
      setDraftTask(created);
      return created.id;
    } catch {
      return null; // l'erreur est déjà notifiée par le hook (toast)
    } finally {
      setPending(false);
    }
  };

  // Envoi depuis le composeur « pré-création » : met le texte en file puis
  // déclenche la création silencieuse. `TaskCommentsSection` postera
  // réellement le commentaire une fois montée avec le vrai `taskId` (son
  // `autoSubmitDraft`) — voir le rendu des panneaux Commentaires plus bas.
  const submitFirstComment = (body: string) => {
    setPendingCommentDraft(body);
    void ensureTaskForComment().then((id) => {
      if (!id) setPendingCommentDraft(null); // création échouée, ne pas garder la file
    });
  };

  // Panneaux latéraux (`lg` et plus) : même chrome que le modal (rounded-2xl,
  // bordure, shadow-2xl, fond surface), mais jamais collés à lui — un `gap-4`
  // sur la ligne qui les contient les sépare visuellement, sinon un panneau
  // externe se lit comme un onglet du modal plutôt que comme un groupe à part.
  const sidePanelClass =
    'flex flex-col w-72 max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden shrink-0';
  const sidePanelStyle = { backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      {/* items-start (pas items-stretch) : chaque panneau garde sa hauteur de
          contenu au lieu d'être étiré à celle du modal central — sinon un
          panneau avec peu d'éléments (2-3 membres, aucun commentaire) traîne
          un grand vide sous sa liste. */}
      <div className="flex items-start justify-center gap-4 w-full sm:w-auto">
        {/* Panneau gauche : assignés, en permanence visible dès `lg` — la
            tâche EN COURS DE CRÉATION en a besoin aussi (photo7), pas
            seulement l'édition. */}
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
            <div className="overflow-y-auto flex-1 min-h-0 py-1">
              <TeamAssigneeGroups orgId={orgId} value={assigneeIds} onChange={setAssigneeIds} />
              {members.map(renderAssigneeRow)}
            </div>
          </div>
        )}

      <div
        className="flex flex-col w-full sm:max-w-xl sm:w-full shrink-0 max-h-[92vh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={isCreating ? t('taskModal.newAria') : t('taskModal.editAria', { name: task?.name ?? '' })}
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
              {isCreating ? t('taskModal.new') : t('taskModal.edit')}
            </h2>
            {hasChanges && !isCreating && (
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
              <label htmlFor="team-task-name" className={labelClass} style={labelStyle}>{t('taskModal.name')}</label>
              <input
                id="team-task-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                placeholder={t('taskModal.namePlaceholder')}
                autoFocus
                maxLength={500}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="team-task-desc" className={labelClass} style={labelStyle}>{t('taskModal.description')}</label>
              <DescriptionField
                id="team-task-desc"
                value={description}
                onChange={setDescription}
                rows={3}
                placeholder={t('taskModal.descriptionPlaceholder')}
                expandedTitle={t('taskModal.description')}
                className={`${inputClass} h-auto py-3 resize-y min-h-[76px]`}
                style={inputStyle}
              />
            </div>

            {/* Catégorie (mig. 111) — distincte du projet, jamais héritée de
                lui : une tâche porte sa propre catégorie. */}
            <div>
              <span className={labelClass} style={labelStyle}>{t('project.category')}</span>
              <TeamCategoryPicker orgId={orgId} value={categoryId} onChange={setCategoryId} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="team-task-project" className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>{t('taskModal.project')}</label>
                  {/* Créer un projet sans quitter la tâche — même pattern que
                      « + Ajouter » pour une catégorie côté tâche personnelle. */}
                  <AddCategoryButton
                    onClick={() => { setShowNewProjectInput(true); setNewProjectName(''); }}
                    ariaLabel={t('taskModal.createProjectAria')}
                  />
                </div>
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
                {showNewProjectInput && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      autoFocus
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submitNewProject(); }
                        else if (e.key === 'Escape') { setShowNewProjectInput(false); setNewProjectName(''); }
                      }}
                      placeholder={t('taskModal.projectNamePlaceholder')}
                      className="flex-1 min-w-0 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] border-[rgb(var(--color-border))]"
                      style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
                    />
                    <button
                      type="button"
                      disabled={newProjectName.trim().length < 2 || createProject.isPending}
                      onClick={submitNewProject}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 transition-colors"
                    >
                      {t('taskModal.createProjectCta')}
                    </button>
                  </div>
                )}
                {projectId && (
                  <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                    <span className={`w-2 h-2 rounded-full ${projectColor(projects.find((p) => p.id === projectId)?.color ?? 'blue').dot}`} aria-hidden="true" />
                    {t('taskModal.teamProject')}
                  </span>
                )}
              </div>

              <div>
                <span className={labelClass} style={labelStyle}>{t('taskModal.priority')}</span>
                <div className="flex gap-1.5 h-12 items-stretch" role="radiogroup" aria-label={t('taskModal.priority')}>
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
                <label htmlFor="team-task-deadline" className={labelClass} style={labelStyle}>{t('taskModal.deadline')}</label>
                <input
                  id="team-task-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={`${inputClass} appearance-none`}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="team-task-time" className={labelClass} style={labelStyle}>{t('taskModal.estimatedTime')}</label>
                <input
                  id="team-task-time"
                  type="number"
                  min={0}
                  max={100000}
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  placeholder={t('taskModal.timePlaceholder')}
                  className={`${inputClass} appearance-none`}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Assignés — disclosure mobile/tablette uniquement : à partir de
                `lg`, un panneau dédié à gauche du modal reprend ce rôle en
                permanence (pas besoin de replier ce qu'il y a la place de
                montrer). Même état, même `renderAssigneeRow`. */}
            {!isWide && (
              <div className="border-t pt-4" style={{ borderColor: 'rgb(var(--color-border))' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignees((v) => !v)}
                  aria-expanded={showAssignees}
                  className="flex items-center gap-2 text-sm font-semibold hover:text-blue-500 transition-colors"
                  style={{ color: 'rgb(var(--color-text-secondary))' }}
                >
                  <ChevronRight size={16} aria-hidden="true" className={`transition-transform ${showAssignees ? 'rotate-90' : ''}`} />
                  {t('taskModal.assignTask')}
                  {assigneeIds.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-[rgb(var(--color-accent-solid))]/10 text-blue-500">
                      {assigneeIds.length}
                    </span>
                  )}
                </button>
                {showAssignees && (
                  <div className="mt-3 rounded-xl border overflow-hidden max-h-56 overflow-y-auto" style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}>
                    <TeamAssigneeGroups orgId={orgId} value={assigneeIds} onChange={setAssigneeIds} />
                    {members.map(renderAssigneeRow)}
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Sous-tâches (mig. 092) — édition uniquement : une sous-tâche a
              besoin de l'id de sa tâche parente, qui n'existe pas encore en
              création. */}
          {!isCreating && task && (
            <div className="px-5 pb-4 border-t border-[rgb(var(--color-border))] pt-4 space-y-4">
              <TeamSubtasksSection taskId={task.id} />
              <TeamTaskDependenciesSection task={task} isManager={isManager} />
            </div>
          )}

          {/* Commentaires (reco #9) — visible dès la CRÉATION (placeholder tant
              que la tâche n'existe pas), pas seulement en édition : le panneau
              assignés (à gauche) est déjà présent en création, cacher celui-ci
              rendait la mise en page asymétrique et laissait croire que les
              commentaires n'existaient qu'en modification. Seulement en
              dessous de `lg` : au-delà, le panneau de droite les affiche déjà
              en permanence. */}
          {!isWide && (
            commentsTask ? (
              <TaskCommentsSection
                taskId={commentsTask.id}
                members={members}
                currentUserId={user?.id}
                autoSubmitDraft={pendingCommentDraft}
                onAutoSubmitted={() => setPendingCommentDraft(null)}
              />
            ) : (
              <PreCreateCommentComposer onSubmit={submitFirstComment} pending={pending} />
            )
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
              <Trash2 size={16} data-icon="inline-start" /> {t('common.deleteAction')}
            </Button>
          ) : <span className="hidden sm:block" />}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={pending} className="min-h-11 w-full sm:w-auto">
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleSave}
              disabled={pending || !name.trim() || (!hasChanges && !isCreating)}
              className={`min-h-11 w-full sm:w-auto ${
                pending || !name.trim() || (!hasChanges && !isCreating)
                  ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))] !opacity-40 !border-0'
                  : 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-0'
              }`}
            >
              {pending ? (
                <>
                  <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
                  <span>{isCreating ? t('taskModal.creating') : t('taskModal.saving')}</span>
                </>
              ) : (
                isCreating ? t('taskModal.create') : t('taskModal.save')
              )}
            </Button>
          </div>
        </div>
      </div>

        {/* Panneau droit : commentaires — visible dès la CRÉATION (placeholder
            tant que la tâche n'existe pas) pour rester symétrique avec le
            panneau assignés à gauche, déjà présent en création. */}
        {isWide && (
          <div className={sidePanelClass} style={sidePanelStyle} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex flex-col flex-1 min-h-0">
              {commentsTask ? (
                <TaskCommentsSection
                  taskId={commentsTask.id}
                  members={members}
                  currentUserId={user?.id}
                  autoSubmitDraft={pendingCommentDraft}
                  onAutoSubmitted={() => setPendingCommentDraft(null)}
                />
              ) : (
                <PreCreateCommentComposer onSubmit={submitFirstComment} pending={pending} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default TeamTaskModal;
