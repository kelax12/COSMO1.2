// ═══════════════════════════════════════════════════════════════════
// task-table/TaskCard — carte tâche mobile (mémoïsée), extraite de list.tsx.
// Identité stable au niveau module (évite la recréation de useMotionValue à
// chaque render parent). Pilotée par props, aucune logique métier.
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Bookmark, Calendar, MoreHorizontal, UserPlus, Copy, Trash2, CheckCircle2, X, Users, AlertTriangle } from "lucide-react";
import CollaboratorAvatars from "../CollaboratorAvatars";
import { useCategoryLookup } from "@/modules/categories";
import { Task } from "@/modules/tasks";
import { Friend } from "@/modules/friends";
import { formatDate, formatDuration } from "./helpers";

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
  onDuplicate: (id: string) => void;
  collaboratorsByTask: Map<string, string[]>;
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
  onDuplicate,
  collaboratorsByTask,
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

  const [actionsVisible, setActionsVisible] = useState(false);
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

  const isOverdue = !task.completed && new Date(task.deadline) < new Date();

  return (
    <motion.div
      ref={ref}
      className="relative mb-2"
      layout
      animate={isExiting ? { x: '100%', opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
    >
    {/* Swipe wrapper — isolates card + reveal layers from the action row below */}
    <div className="relative overflow-hidden rounded-xl">
    {/* Reveal layers BEHIND the card — full size, full color */}
    {!addToListMode && (
      <>
        {/* Right swipe → green bg behind */}
        <motion.div
          style={{ opacity: greenOpacity }}
          animate={isValidating ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="absolute inset-0 bg-green-500 pointer-events-none flex items-center justify-start pl-5 rounded-xl"
        >
          <motion.div
            style={{ opacity: greenIconOpacity }}
            className="flex items-center gap-2 text-white whitespace-nowrap"
          >
            <CheckCircle2 size={22} strokeWidth={2.5} />
            <span className="text-sm font-bold">{task.completed ? 'Annuler' : 'Valider'}</span>
          </motion.div>
        </motion.div>
        {/* Left swipe → gray bg behind */}
        <motion.div
          style={{ opacity: grayOpacity }}
          className="absolute inset-0 bg-slate-500 dark:bg-slate-600 pointer-events-none flex items-center justify-end pr-5 rounded-xl"
        >
          <motion.div
            style={{ opacity: grayIconOpacity }}
            className="flex items-center gap-2 text-white whitespace-nowrap"
          >
            <MoreHorizontal size={22} strokeWidth={2.5} />
            <span className="text-sm font-bold">Options</span>
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
      className={`relative flex items-stretch gap-3 p-3 rounded-xl border transition-colors ${addToListMode ? 'cursor-default' : 'cursor-pointer'} ${task.completed && !addToListMode ? 'opacity-60' : ''}`}
      onClick={handleCardClick}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={(e) => { e.preventDefault(); }}
      style={{
        x,
        backgroundColor: addToListMode
          ? (selectedForListIds.includes(task.id) ? 'rgba(59, 130, 246, 0.1)' : 'rgb(var(--color-surface))')
          : 'rgb(var(--color-surface))',
        borderColor: addToListMode && selectedForListIds.includes(task.id)
          ? '#3B82F6'
          : 'rgb(var(--color-border))',
        minHeight: '60px',
        touchAction: 'pan-y',
      }}
    >
      {/* Color bar (left) — toujours la couleur de catégorie pour que
          la TaskCard mobile soit visuellement cohérente avec la catégorie.
          L'état overdue/bookmark est signalé par l'icône bookmark + la date. */}
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: categoryColor }}
      />

      {/* Checkbox */}
      {addToListMode ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleTaskForList?.(task.id); }}
          className="min-w-11 min-h-11 -my-1 -ml-1 p-2 flex items-center justify-center shrink-0"
          aria-label={selectedForListIds.includes(task.id) ? 'Retirer de la liste' : 'Ajouter à la liste'}
          aria-pressed={selectedForListIds.includes(task.id)}
        >
          <span
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              selectedForListIds.includes(task.id)
                ? 'bg-blue-500 border-blue-500'
                : 'border-slate-400 dark:border-slate-500'
            }`}
          >
            {selectedForListIds.includes(task.id) && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
          aria-label={task.completed ? 'Marquer comme non complétée' : 'Marquer comme complétée'}
          aria-pressed={task.completed}
        >
          <span
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              task.completed
                ? 'bg-blue-500 border-blue-500'
                : 'border-gray-400'
            }`}
          >
            {task.completed && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        </button>
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        {/* Titre */}
        <p className={`font-semibold text-sm leading-tight truncate ${task.completed ? 'line-through' : ''}`} style={{ color: 'rgb(var(--color-text-primary))' }}>
          {task.name}
        </p>

        {/* Collaborateur — ligne dédiée sous le titre, ne concurrence plus la méta */}
        {task.sharedBy && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--color-accent))] truncate">
            <Users size={10} aria-hidden="true" />
            Reçu de {task.sharedBy}
          </span>
        )}
        {!task.sharedBy && task.isCollaborative && (collaboratorsByTask.get(task.id)?.length ?? 0) > 0 && (
          <CollaboratorAvatars
            collaboratorIds={collaboratorsByTask.get(task.id)}
            friends={friends}
            size="sm"
            maxVisible={3}
          />
        )}

        {/* Méta : date · durée — toujours sur une ligne propre */}
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgb(var(--color-text-muted))' }}>
          <span className={isOverdue ? 'text-red-500 font-semibold inline-flex items-center gap-0.5' : ''}>
            {isOverdue && <AlertTriangle size={10} aria-hidden="true" />}
            {task.deadline ? formatDate(task.deadline) : "Pas d'échéance"}
            {isOverdue && <span className="sr-only"> (en retard)</span>}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDuration(task.estimatedTime)}</span>
        </div>
      </div>

      {/* Priority badge — échelle d'URGENCE (task-priority-1..5 : rouge→orange→
          jaune→bleu→gris), distincte de la couleur de catégorie (la barre gauche).
          Réutilise les classes du tableau desktop pour une sémantique cohérente
          mobile/desktop + dark mode. Masqué si priorité facultative (0). */}
      {task.priority > 0 && (
        <div
          className={`self-center shrink-0 px-2 py-0.5 rounded font-bold text-[11px] task-priority-${task.priority}`}
        >
          P{task.priority}
        </div>
      )}

      {task.bookmarked && (
        <Bookmark size={14} className="self-center shrink-0 text-amber-500" fill="currentColor" />
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

    {/* Actions row — revealed on long press or left swipe */}
    <AnimatePresence>
      {actionsVisible && !addToListMode && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mt-1 flex items-center justify-around gap-1 p-2 rounded-xl border" style={{
            borderColor: 'rgb(var(--color-border))',
            backgroundColor: 'rgb(var(--color-hover))'
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(task.id); setActionsVisible(false); }}
              className={`min-w-11 min-h-11 p-2 rounded-lg flex items-center justify-center transition-colors ${task.bookmarked ? 'text-amber-500 bg-amber-500/10' : 'text-slate-500'}`}
              aria-label={task.bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Bookmark size={18} fill={task.bookmarked ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenCollaborator(task.id); setActionsVisible(false); }}
              className="min-w-11 min-h-11 p-2 rounded-lg text-slate-500 flex items-center justify-center"
              aria-label="Ajouter un collaborateur"
            >
              <UserPlus size={18} />
            </button>
            {!task.completed && (
              <button
                onClick={(e) => { e.stopPropagation(); onScheduleTask(task); setActionsVisible(false); }}
                className="min-w-11 min-h-11 p-2 rounded-lg text-slate-500 flex items-center justify-center"
                aria-label="Planifier dans l'agenda"
              >
                <Calendar size={18} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAddToList(task.id); setActionsVisible(false); }}
              className="min-w-11 min-h-11 p-2 rounded-lg text-slate-500 flex items-center justify-center"
              aria-label="Ajouter à une liste"
            >
              <MoreHorizontal size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(task.id); setActionsVisible(false); }}
              className="min-w-11 min-h-11 p-2 rounded-lg text-slate-500 flex items-center justify-center"
              aria-label="Dupliquer la tâche"
            >
              <Copy size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); setActionsVisible(false); }}
              className="min-w-11 min-h-11 p-2 rounded-lg text-red-500 flex items-center justify-center"
              aria-label="Supprimer la tâche"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActionsVisible(false); }}
              className="min-w-11 min-h-11 p-2 rounded-lg text-slate-400 dark:text-slate-500 flex items-center justify-center"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
    prevProps.selectedForListIds === nextProps.selectedForListIds
  );
});

export type { TaskCardProps };
