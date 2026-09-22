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
import { formatDeadlineSmart, formatDuration, formatOverdueSince } from "./helpers";
import { useT } from '@/i18n/useT';
import { isTaskOverdue } from './helpers';

interface TaskCardProps {
  task: Task;
  addToListMode: boolean;
  /** Cf. `list.tsx` : même rendu pour deux modes, pas le même nom (C-55). */
  selectionKind?: 'list' | 'select';
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
  selectionKind = 'list',
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
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    `x` est une MotionValue, stable pour la vie du composant. Seul le passage
       en mode « ajouter a une liste » sur la PREMIERE carte doit rejouer
       l indice gestuel ; dependre de `x` le relancerait a chaque frame. */
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
            <span className="text-label font-bold">{task.completed ? t('card.cancel') : t('card.validate')}</span>
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
      // ═══ C-111 · LE SEUL CHEMIN CLAVIER VERS LES ACTIONS ═══
      //
      // 🔴 CE QUI ÉTAIT FAUX, mesuré dans le navigateur le 2026-09-22
      // (viewport 375, mode démo) : les trois chemins vers `TaskActionsSheet`
      // que la maquette 86 a laissés — appui long, glissement à gauche, menu
      // de la ligne DESKTOP — sont tous des gestes de POINTEUR, et le
      // quatrième vit dans `div.hidden md:block`, donc à `0 x 0 px` sur
      // téléphone. Modifier, supprimer, partager ou planifier une tâche était
      // donc **inatteignable au clavier** sur mobile : WCAG 2.1.1 (A), le
      // critère le plus élémentaire du référentiel.
      //
      // Cette ligne ne faisait qu'un `preventDefault()` : elle SUPPRIMAIT le
      // menu du navigateur sans rien offrir à la place. Elle ouvre désormais
      // la feuille, ce qui donne d'un coup le clic droit ET le clavier — la
      // touche « menu contextuel » et `Shift+F10` émettent toutes deux un
      // évènement `contextmenu` sur l'élément focalisé, et la carte porte déjà
      // `tabIndex={0}`.
      //
      // ✅ Elle ne reprend RIEN à la colonne du pouce : aucun pixel n'est
      // ajouté, donc l'arbitrage de la maquette 86 (« plus de ⋯ au repos »)
      // tient entier. C'est précisément pour ça que l'interdit écrit plus bas
      // — ne pas réintroduire le « ⋯ » sans retirer autre chose — n'est pas
      // enfreint ici.
      onContextMenu={(e) => {
        e.preventDefault();
        if (addToListMode) return;
        cancelLongPress();
        setActionsVisible(true);
      }}
      // Annonce le raccourci aux technologies d'assistance : sans lui, le
      // chemin existe mais rien ne le dit.
      aria-keyshortcuts="Shift+F10"
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
          aria-label={
            selectionKind === 'select'
              ? t(
                  selectedForListIds.includes(task.id)
                    ? 'table.deselectTaskAria'
                    : 'table.selectTaskAria',
                  { name: task.name },
                )
              : t(selectedForListIds.includes(task.id) ? 'card.removeFromList' : 'card.addToListShort')
          }
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
        {/* ── Maquette 85 (mix arbitré par Axel le 2026-09-19) ─────────────
            Le titre reprend la LARGEUR ENTIÈRE de la ligne. Mesuré la veille
            en 390 px : la pilule de catégorie prenait ~80 px, celle de
            priorité ~48, le « ⋯ » ~56 — il restait 150 px sur 390 pour le
            seul élément qui permet de reconnaître sa tâche, d'où « Préparer
            la réunion de… » coupé.

            La catégorie descend dans la ligne méta, en point + nom (elle ne
            vole plus de largeur au titre) et l'avatar passe à droite de la
            ligne, dans la colonne libérée par le « ⋯ » (maquette 86).

            ❌ PAS de liseré de priorité à gauche : arbitrage explicite
            d'Axel, « garder l'absence de barre colorée ». La priorité reste
            dite par sa pilule `P{n}`, plus bas. */}
        <p
          className={`min-w-0 font-medium leading-tight line-clamp-2 ${
            isOverdue ? 'text-body' : 'text-label'
          } ${task.completed ? 'line-through' : ''}`}
          style={{ color: 'rgb(var(--color-text-primary))' }}
        >
          {task.name}
        </p>

        {/* Méta : catégorie · échéance · durée — toujours sur une ligne propre */}
        <div className="flex items-center gap-1.5 text-caption" style={{ color: 'rgb(var(--color-text-muted))' }}>
          {!addToListMode && category && (
            <>
              <span className="inline-flex min-w-0 items-center gap-1">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                  aria-hidden="true"
                />
                <span className="truncate">{category.name}</span>
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          {/* Maquette 87 — l'échéance en français, pas en chiffres.
              `formatDate` rendait « 26/09/2026 » : dix caractères pour dire
              « vendredi », dont quatre d'année que TOUTES les tâches
              partagent. `formatDeadlineSmart` existait déjà et servait
              partout ailleurs (ligne desktop, onglet équipe) — cette carte
              était la seule à ne pas l'utiliser.
              En retard, le calcul est fait pour le lecteur : « en retard de
              2 j » au lieu d'une date rouge à soustraire soi-même. */}
          <span className={isOverdue ? 'text-red-500 font-semibold inline-flex items-center gap-0.5' : ''}>
            {isOverdue && <AlertTriangle size={12} aria-hidden="true" />}
            {task.deadline
              ? (isOverdue ? formatOverdueSince(task.deadline) : formatDeadlineSmart(task.deadline))
              : t('card.noDeadline')}
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

      {/* ── Maquette 85 : le partage se dit à DROITE, par un seul signe ────
          L'avatar vivait sous le titre, dans la colonne du texte, où il
          poussait la ligne méta vers le bas et rognait le titre. Il occupe
          maintenant la colonne libérée par le « ⋯ » : même information,
          zéro largeur prise au libellé. */}
      {task.sharedBy && (
        <span
          className="self-center shrink-0 inline-flex size-7 items-center justify-center rounded-full bg-[rgb(var(--color-accent))]/15 text-xs font-bold leading-none text-[rgb(var(--color-accent))]"
          title={t('card.receivedFrom', { name: task.sharedBy })}
          aria-hidden="true"
        >
          {sharedByInitials}
        </span>
      )}
      {task.sharedBy && (
        <span className="sr-only">{t('card.receivedFrom', { name: task.sharedBy })}</span>
      )}
      {!task.sharedBy && task.isCollaborative && (collaboratorsByTask.get(task.id)?.length ?? 0) > 0 && (
        <span className="self-center shrink-0 inline-flex items-center gap-1.5">
          <CollaboratorAvatars
            collaboratorIds={collaboratorsByTask.get(task.id)}
            friends={friends}
            size="lg"
            maxVisible={3}
          />
          {pendingCollaboratorTaskIds.has(task.id) && (
            <span title={t('card.pendingInvite')} className="inline-flex shrink-0">
              <Hourglass
                size={13}
                className="text-amber-500"
                aria-label={t('card.pendingInvite')}
              />
            </span>
          )}
        </span>
      )}

      {/* ── Maquette 86 : plus de « ⋯ » au repos ──────────────────────────
          Il était présent sur CHAQUE ligne — onze cibles permanentes pour
          une action rare — et occupait la colonne la plus précieuse, celle
          du pouce droit, en doublant un geste que l'app enseigne elle-même
          dans son bandeau d'astuce.
          Les trois chemins vers `TaskActionsSheet` subsistent : appui long,
          glissement vers la gauche, et le menu de la ligne desktop
          (`TaskTableDesktop`), où la souris n'a pas d'appui long.
          ❌ Ne pas le réintroduire « pour la découvrabilité » sans retirer
          d'abord quelque chose d'autre de cette colonne. */}
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
