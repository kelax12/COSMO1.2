// ═══════════════════════════════════════════════════════════════════
// task-table/TaskCard — carte tâche mobile (mémoïsée), extraite de list.tsx.
// Identité stable au niveau module (évite la recréation de useMotionValue à
// chaque render parent). Pilotée par props, aucune logique métier.
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Bookmark, MoreHorizontal, AlertTriangle, Hourglass, CheckCircle2 } from "lucide-react";
import { OverdueQuickActions } from "./OverdueQuickActions";
import TaskActionsSheet from "./TaskActionsSheet";
import { deadlineFromDayKey } from "@/lib/deadline";
import { getTimezonePref } from "@/lib/timezone";
import CollaboratorAvatars from "@/components/CollaboratorAvatars";
import { useCategoryLookup } from "@/modules/categories";
import { Task } from "@/modules/tasks";
import { Friend } from "@/modules/friends";
import { formatDate, formatDuration } from "./helpers";
import { useT } from '@/i18n/useT';
import { isTaskOverdue } from './helpers';

interface TaskCardProps {
  task: Task;
  addToListMode: boolean;
  selectedForListIds: string[];
  onToggleTaskForList?: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onOpenCollaborator: (id: string) => void;
  onSelectTask: (id: string) => void;
  onAddToList: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onScheduleTask: (task: Task) => void;
  onSnooze: (id: string, deadline: string) => void;
  collaboratorsByTask: Map<string, string[]>;
  pendingCollaboratorTaskIds: Set<string>;
  friends: Friend[];
  /** true pour la 1ʳᵉ carte de la liste — déclenche le hint de swipe animé (1× / device). */
  isFirst?: boolean;
}

const TaskCardInner = React.forwardRef<HTMLDivElement, TaskCardProps>(({
  task,
  addToListMode,
  selectedForListIds,
  onToggleTaskForList,
  onToggleComplete,
  onToggleBookmark,
  onOpenCollaborator,
  onSelectTask,
  onAddToList,
  onDeleteTask,
  onScheduleTask,
  onSnooze,
  collaboratorsByTask,
  pendingCollaboratorTaskIds,
  friends,
  isFirst = false,
}: TaskCardProps, ref) => {
  // Lookup catégorie via hook React Query — re-render automatique quand
  // les catégories Supabase finissent de charger (asynchrone en prod).
  const getCategoryById = useCategoryLookup();
  const category = getCategoryById(task.category);
  // Fallback gris neutre (pas bleu = couleur Travail par défaut) pour
  // signaler une catégorie manquante au lieu de la masquer.
  const categoryColor = category?.color || '#94a3b8';
  const { t } = useT('tasks');

  const [actionsVisible, setActionsVisible] = useState(false);
  // Maquette 16 — « Choisir » : le calendrier COSMO, jamais celui du
  // navigateur (cf. CLAUDE.md, § Saisie de date).
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const isDragging = useRef(false);

  // Swipe gestures — x must be in the SAME style object as other style props
  const x = useMotionValue(0);
  const greenOpacity = useTransform(x, [0, 8, 80], [0, 1, 1]);
  const grayOpacity = useTransform(x, [-80, -8, 0], [1, 1, 0]);
  const greenIconOpacity = useTransform(x, [0, 24, 80], [0, 0.6, 1]);
  const grayIconOpacity = useTransform(x, [-80, -24, 0], [1, 0.6, 0]);

  // Hint de geste animé — joue UNE seule fois (par device) sur la 1ʳᵉ carte :
  // un léger nudge à gauche (révèle « Options ») puis à droite (révèle « Valider »),
  // façon Things/Todoist. Enseigne le swipe sans bloquer l'interaction (le drag
  // utilisateur reprend la main à tout moment). Respecte prefers-reduced-motion.
  useEffect(() => {
    if (!isFirst || addToListMode) return;
    let alreadyPlayed = false;
    try { alreadyPlayed = localStorage.getItem('cosmo_swipe_hint_anim_seen') === '1'; } catch { /* ignore */ }
    if (alreadyPlayed) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // On marque comme vu dans tous les cas pour ne jamais rejouer.
    try { localStorage.setItem('cosmo_swipe_hint_anim_seen', '1'); } catch { /* ignore */ }
    if (prefersReduced) return;
    let controls: ReturnType<typeof animate> | undefined;
    const startTimer = setTimeout(() => {
      controls = animate(x, [0, -52, 0, 44, 0], {
        duration: 1.7,
        times: [0, 0.28, 0.5, 0.78, 1],
        ease: 'easeInOut',
      });
    }, 650);
    return () => {
      clearTimeout(startTimer);
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirst, addToListMode]);

  const startLongPress = (e: React.PointerEvent) => {
    if (addToListMode) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setActionsVisible(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleCardClick = () => {
    if (isDragging.current) {
      isDragging.current = false;
      return;
    }
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    if (addToListMode) return;
    onSelectTask(task.id);
  };

  const isOverdue = isTaskOverdue(task.deadline, task.completed);

  // Maquette 16 — « Le retard porte sa solution ». `OverdueQuickActions` rend
  // une clé de jour ; la conversion en instant reste ici, sur le chemin
  // d'écriture, et passe par `@/lib/deadline` comme les trois autres (R-01).
  const rescheduleTo = (dayKey: string) => {
    setRescheduleOpen(false);
    onSnooze(task.id, deadlineFromDayKey(dayKey, getTimezonePref()));
  };

  // Deux initiales pour le rond de la maquette 15. `sharedBy` est un nom
  // affichable, pas un UUID — il vient déjà résolu du repository.
  const sharedByInitials = task.sharedBy
    ? task.sharedBy.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
    : '';

  return (
    <motion.div
      ref={ref}
      // Point d'ancrage stable pour les E2E (e2e/demo-collaboration.spec.ts) :
      // la <table> desktop reste dans le DOM en `hidden md:block`, donc un
      // sélecteur `table tbody tr` résout une ligne INVISIBLE sur mobile.
      data-testid="task-card"
      // ── Fin des cartes (arbitrage d'Axel, 2026-09-05) ──
      // La disposition de chaque tâche est INCHANGÉE ; ce qui disparaît, c'est
      // la carte qui l'entourait. Vingt cartes empilées, c'est vingt bords à
      // lire avant d'atteindre vingt titres. Un filet d'un pixel sépare aussi
      // bien et ne dessine rien.
      className="relative border-b border-[rgb(var(--color-border))]"
      layout
      animate={isExiting ? { x: '100%', opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
    >
    {/* Swipe wrapper — isolates card + reveal layers from the action row below */}
    <div className="relative overflow-hidden">
    {/* Reveal layers BEHIND the card — full size, full color */}
    {!addToListMode && (
      <>
        {/* Right swipe → green bg behind */}
        <motion.div
          style={{ opacity: greenOpacity }}
          animate={isValidating ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="absolute inset-0 bg-green-500 pointer-events-none flex items-center justify-start pl-5"
        >
          <motion.div
            style={{ opacity: greenIconOpacity }}
            className="flex items-center gap-2 text-white whitespace-nowrap"
          >
            <CheckCircle2 size={22} />
            <span className="text-label font-bold">{task.completed ? 'Annuler' : 'Valider'}</span>
          </motion.div>
        </motion.div>
        {/* Left swipe → gray bg behind */}
        <motion.div
          style={{ opacity: grayOpacity }}
          className="absolute inset-0 bg-slate-500 dark:bg-slate-600 pointer-events-none flex items-center justify-end pr-5"
        >
          <motion.div
            style={{ opacity: grayIconOpacity }}
            className="flex items-center gap-2 text-white whitespace-nowrap"
          >
            <MoreHorizontal size={22} />
            <span className="text-label font-bold">{t('card.options')}</span>
          </motion.div>
        </motion.div>
      </>
    )}
    {/* Draggable card — x MotionValue merged into the single style object */}
    <motion.div
      drag={addToListMode ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      dragDirectionLock
      onDragStart={() => {
        isDragging.current = true;
        cancelLongPress();
      }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 80) {
          setIsValidating(true);
          setIsExiting(true);
          setTimeout(() => onToggleComplete(task.id), 300);
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        } else if (info.offset.x < -80) {
          setActionsVisible(true);
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        }
        setTimeout(() => { isDragging.current = false; }, 50);
      }}
      whileTap={addToListMode ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.1 }}
      // Ni bordure ni arrondi : la séparation est le filet du parent.
      // ⚠️ Le fond reste OPAQUE malgré la disparition de la carte — les calques
      // vert et gris du swipe sont dessinés DERRIÈRE cette ligne. Un fond
      // transparent les laisserait voir en permanence.
      className={`relative flex items-stretch gap-3 px-3 py-2.5 transition-colors ${addToListMode ? 'cursor-default' : 'cursor-pointer'} ${task.completed && !addToListMode ? 'opacity-50' : ''}`}
      onClick={handleCardClick}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={(e) => { e.preventDefault(); }}
      style={{
        x,
        backgroundColor: addToListMode && selectedForListIds.includes(task.id)
          ? 'rgba(59, 130, 246, 0.1)'
          : 'rgb(var(--color-background))',
        minHeight: '60px',
        touchAction: 'pan-y',
      }}
    >
      {/* Checkbox */}
      {addToListMode ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleTaskForList?.(task.id); }}
          className="min-w-11 min-h-11 -my-1 -ml-1 p-2 flex items-center justify-center shrink-0"
          aria-label={selectedForListIds.includes(task.id) ? t('card.removeFromList') : t('card.addToListShort')}
          aria-pressed={selectedForListIds.includes(task.id)}
        >
          <span
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              selectedForListIds.includes(task.id)
                ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]'
                : 'border-slate-400 dark:border-slate-500'
            }`}
          >
            {selectedForListIds.includes(task.id) && (
              <svg className="w-4 h-4 text-[rgb(var(--color-accent-solid-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            cancelLongPress();
            onToggleComplete(task.id);
          }}
          onPointerDown={(e) => { e.stopPropagation(); }}
          className="min-w-11 min-h-11 -my-1 -ml-1 p-2 flex items-center justify-center shrink-0"
          aria-label={task.completed ? t('card.markUndone') : t('card.markDone')}
          aria-pressed={task.completed}
        >
          <span
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              task.completed
                ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]'
                : 'border-[rgb(var(--color-text-muted))]'
            }`}
          >
            {task.completed && (
              <svg className="w-4 h-4 text-[rgb(var(--color-accent-solid-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        </button>
      )}

      {/* Pin de couleur — catégorie, entre la case à cocher et le titre
          (remplace l'ancienne bande colorée pleine hauteur, cf. demande
          redesign mobile 2026-09-07). */}
      {!addToListMode && (
        <span
          className="self-center shrink-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: categoryColor }}
          aria-hidden="true"
        />
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        {/* Titre */}
        {/* `line-clamp-2` et non `truncate` (audit UI 2026-08-14, §2).
            Mesuré sur /tasks en 375 px : 12 titres tronqués, le pire à 124 px
            pour 220 nécessaires, soit 44 % coupés. La carte n'accordait que
            ~40 % de la largeur d'écran au titre — sur l'écran principal du
            produit, où l'on distingue deux tâches par leur libellé.
            Deux lignes suffisent : la liste virtualisée MESURE chaque carte
            (`virtualizer.measureElement` dans `list.tsx`), la hauteur variable
            est donc supportée. Ne pas revenir à `truncate` « pour la densité ». */}
        {/* Maquette 16 — « Le retard porte sa solution » : la tâche en retard
            est la SEULE à s'agrandir. Un cran d'échelle suffit à la faire
            sortir de la liste sans la déguiser en bloc à part. */}
        <div className="flex items-start gap-1.5">
          <p
            className={`flex-1 min-w-0 font-medium leading-tight line-clamp-2 ${
              isOverdue ? 'text-body' : 'text-label'
            } ${task.completed ? 'line-through' : ''}`}
            style={{ color: 'rgb(var(--color-text-primary))' }}
          >
            {task.name}
          </p>

          {/* Maquette 15 — « Le collaborateur en avatar, pas en texte ».
              « Reçu de Jean Martin » prenait une ligne entière sous le titre,
              sur toutes les tâches partagées. Le rond porte les initiales ; la
              phrase complète reste le nom accessible, elle n'est pas perdue —
              elle cesse juste d'occuper une ligne de liste. */}
          {task.sharedBy && (
            <span
              className="mt-0.5 shrink-0 inline-flex size-4 items-center justify-center rounded-full bg-[rgb(var(--color-accent))]/15 text-caption font-bold leading-none text-[rgb(var(--color-accent))]"
              title={t('card.receivedFrom', { name: task.sharedBy })}
              aria-hidden="true"
            >
              {sharedByInitials}
            </span>
          )}
          {task.sharedBy && (
            <span className="sr-only">{t('card.receivedFrom', { name: task.sharedBy })}</span>
          )}
        </div>
        {!task.sharedBy && task.isCollaborative && (collaboratorsByTask.get(task.id)?.length ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <CollaboratorAvatars
              collaboratorIds={collaboratorsByTask.get(task.id)}
              friends={friends}
              size="md"
              maxVisible={3}
            />
            {pendingCollaboratorTaskIds.has(task.id) && (
              <span title="En attente d'acceptation" className="inline-flex shrink-0">
                <Hourglass
                  size={13}
                  className="text-amber-500"
                  aria-label={t('card.pendingInvite')}
                />
              </span>
            )}
          </span>
        )}

        {/* Méta : date · durée — toujours sur une ligne propre */}
        <div className="flex items-center gap-1.5 text-caption" style={{ color: 'rgb(var(--color-text-muted))' }}>
          <span className={isOverdue ? 'text-red-500 font-semibold inline-flex items-center gap-0.5' : ''}>
            {isOverdue && <AlertTriangle size={12} aria-hidden="true" />}
            {task.deadline ? formatDate(task.deadline) : "Pas d'échéance"}
            {isOverdue && <span className="sr-only"> {t('card.overdue')}</span>}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDuration(task.estimatedTime)}</span>
          {/* Compteur sous-tâches (#12) */}
          {(task.subtasks?.length ?? 0) > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span title={t('card.subtasksDone')}>
                ☑ {task.subtasks!.filter(s => s.completed).length}/{task.subtasks!.length}
              </span>
            </>
          )}
        </div>

        {isOverdue && !addToListMode && (
          <OverdueQuickActions
            deadline={task.deadline}
            onReschedule={rescheduleTo}
            open={rescheduleOpen}
            onOpenChange={setRescheduleOpen}
          />
        )}
      </div>

      {/* Priority badge — échelle d'URGENCE (task-priority-1..5 : rouge→orange→
          jaune→bleu→gris), distincte de la couleur de catégorie (la barre gauche).
          Réutilise les classes du tableau desktop pour une sémantique cohérente
          mobile/desktop + dark mode. Masqué si priorité facultative (0). */}
      {task.priority > 0 && (
        <div
          className={`self-center shrink-0 px-1.5 py-0.5 rounded-md font-bold text-caption task-priority-${task.priority}`}
        >
          P{task.priority}
        </div>
      )}

      {task.bookmarked && (
        <Bookmark size={16} className="self-center shrink-0 text-amber-500" fill="currentColor" />
      )}

      {/* Affordance permanente — bouton "…" pour révéler les actions sans devoir swipe/long-press.
          Améliore la découvrabilité tout en gardant l'épuration : icône discrète, taille 44×44. */}
      {!addToListMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            cancelLongPress();
            setActionsVisible(v => !v);
          }}
          onPointerDown={(e) => { e.stopPropagation(); }}
          className="self-center shrink-0 min-w-11 min-h-11 -my-1 -mr-1 p-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={actionsVisible ? 'Masquer les actions' : 'Afficher les actions'}
          aria-expanded={actionsVisible}
        >
          <MoreHorizontal size={18} />
        </button>
      )}
    </motion.div>
    </div>

    {/* Feuille d'actions — design Spotify (en-tête + liste verticale icône +
        libellé), déclenchée par long-press, swipe gauche ou le bouton « ⋯ ». */}
    <TaskActionsSheet
      open={actionsVisible && !addToListMode}
      task={task}
      categoryName={category?.name}
      categoryColor={categoryColor}
      onClose={() => setActionsVisible(false)}
      onEdit={onSelectTask}
      onToggleBookmark={onToggleBookmark}
      onOpenCollaborator={onOpenCollaborator}
      onScheduleTask={() => onScheduleTask(task)}
      onAddToList={onAddToList}
      onDeleteTask={onDeleteTask}
    />
  </motion.div>
  );
});
TaskCardInner.displayName = 'TaskCard';

export const TaskCard = React.memo(TaskCardInner, (prevProps, nextProps) => {
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.name === nextProps.task.name &&
    prevProps.task.completed === nextProps.task.completed &&
    prevProps.task.bookmarked === nextProps.task.bookmarked &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.deadline === nextProps.task.deadline &&
    prevProps.task.estimatedTime === nextProps.task.estimatedTime &&
    prevProps.task.category === nextProps.task.category &&
    prevProps.addToListMode === nextProps.addToListMode &&
    prevProps.selectedForListIds === nextProps.selectedForListIds &&
    prevProps.pendingCollaboratorTaskIds.has(prevProps.task.id) === nextProps.pendingCollaboratorTaskIds.has(nextProps.task.id)
  );
});

export type { TaskCardProps };
