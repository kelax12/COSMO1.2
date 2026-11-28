// task-table/TaskCard : carte tâche mobile mémoïsée. Identité stable au niveau module (pas de `useMotionValue` recréé), pilotée par props, aucune logique métier.
import React, { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate, type MotionValue } from "framer-motion";
import { Bookmark, MoreHorizontal, AlertTriangle, Hourglass, CheckCircle2 } from "lucide-react";
import { OverdueQuickActions } from "./OverdueQuickActions";
import TaskActionsSheet from "./TaskActionsSheet";
import CollaboratorAvatars from "@/components/CollaboratorAvatars";
import { useCategoryLookup } from "@/modules/categories";
import { Task } from "@/modules/tasks";
import { Friend } from "@/modules/friends";
import { formatDeadlineSmart, formatDuration, formatOverdueSince } from "./helpers";
import { useT } from '@/i18n/useT';
import { isTaskOverdue, priorityPillClass } from './helpers';
import TaskStateBadges from './TaskStateBadges';
import { NO_CATEGORY_COLOR } from '@/lib/category-colors';

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
  const categoryColor = category?.color || NO_CATEGORY_COLOR;

  const [actionsVisible, setActionsVisible] = useState(false);
  // Maquette 16 — « Choisir » : le calendrier COSMO, jamais celui du
  // navigateur (cf. CLAUDE.md, § Saisie de date).
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Swipe gestures — x must be in the SAME style object as other style props
  const x = useMotionValue(0);

  useSwipeHint(x, isFirst, addToListMode);

  const gestures = useCardGestures({
    addToListMode,
    onOpen: () => onSelectTask(task.id),
    onOpenActions: () => setActionsVisible(true),
    // Glissé à droite : la carte sort, puis la tâche est validée.
    onSwipeRight: () => {
      setIsValidating(true);
      setIsExiting(true);
      setTimeout(() => onToggleComplete(task.id), 300);
    },
  });
  const { cancelLongPress } = gestures;

  const isOverdue = isTaskOverdue(task.deadline, task.completed);
  const surface = cardSurface(addToListMode, task.completed, selectedForListIds.includes(task.id));

  // Maquette 16 — « Le retard porte sa solution ». `OverdueQuickActions` rend
  // une clé de jour ; la conversion en instant reste ici, sur le chemin
  // d'écriture, et passe par `@/lib/deadline` comme les trois autres (R-01).
  const rescheduleTo = (dayKey: string) => {
    setRescheduleOpen(false);
    onSnooze(task.id, dayKey);
  };

  return (
    <motion.div
      ref={ref}
      // Point d'ancrage stable pour les E2E (e2e/demo-collaboration.spec.ts) :
      // la <table> desktop reste dans le DOM en `hidden md:block`, donc un
      // sélecteur `table tbody tr` résout une ligne INVISIBLE sur mobile.
      data-testid="task-card"
      // Pas de carte autour de la tâche : un filet d'un pixel sépare aussi bien que des bords (arbitrage d'Axel).
      className="relative border-b border-[rgb(var(--color-border))]"
      layout
      animate={isExiting ? { x: '100%', opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
    >
    {/* Swipe wrapper — isolates card + reveal layers from the action row below */}
    <div className="relative overflow-hidden">
    {/* Reveal layers BEHIND the card — full size, full color */}
    {!addToListMode && <SwipeRevealLayers x={x} isValidating={isValidating} completed={task.completed} />}
    {/* Draggable card — x MotionValue merged into the single style object */}
    <motion.div
      drag={addToListMode ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      dragDirectionLock
      onDragStart={gestures.onDragStart}
      onDragEnd={(_, info) => gestures.onDragEnd(info.offset.x)}
      whileTap={addToListMode ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.1 }}
      // Ni bordure ni arrondi : la séparation est le filet du parent.
      // ⚠️ Le fond reste OPAQUE : les calques vert et gris du swipe sont dessinés DERRIÈRE cette ligne.
      className={surface.className}
      onClick={gestures.onClick}
      onPointerDown={gestures.onPointerDown}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      // C-111 et C-118 : le chemin clavier vers les actions (clic droit, `Menu`, `Shift+F10`), cf. `useCardGestures`.
      onContextMenu={gestures.onContextMenu}
      onKeyDown={gestures.onKeyDown}
      // Annonce le raccourci aux technologies d'assistance : sans lui, le
      // chemin existe mais rien ne le dit.
      aria-keyshortcuts="Shift+F10"
      style={{
        x,
        backgroundColor: surface.backgroundColor,
        minHeight: '60px',
        touchAction: 'pan-y',
      }}
    >
      {/* Checkbox */}
      <TaskCardCheckbox
        task={task}
        addToListMode={addToListMode}
        selectionKind={selectionKind}
        selected={selectedForListIds.includes(task.id)}
        onToggleForList={() => onToggleTaskForList?.(task.id)}
        onToggleComplete={() => { cancelLongPress(); onToggleComplete(task.id); }}
      />

      {/* Title + meta */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        {/* Titre */}
        {/* `line-clamp-2` et non `truncate` (audit UI, §2).
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
        {/* ── Maquette 85 (mix arbitré par Axel) ─────────────
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
          // `task-title-boost` (index.css) : +1px sur le titre sous 768 px seulement, sans déplacer l'échelle du reste de l'app.
          className={`task-title-boost min-w-0 font-medium leading-tight line-clamp-2 ${
            isOverdue ? 'text-body' : 'text-label'
          } ${task.completed ? 'line-through' : ''}`}
          style={{ color: 'rgb(var(--color-text-primary))' }}
        >
          {task.name}
        </p>

        {/* Méta : catégorie · échéance · durée, sur une ligne propre à taille normale.
            `flex-wrap` : à 200 % de police (WCAG 1.4.4), la rangée sortait de
            l'écran de 218 px, durée comprise, sans défilement pour l'atteindre. */}
        <TaskCardMeta task={task} category={addToListMode ? undefined : category} categoryColor={categoryColor} isOverdue={isOverdue} />

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
      {/* Maquette 145 : la pilule reste (arbitrage 85), mais
          seules P1 et P2 gardent leur teinte. P3 à P5 passent en gris : quatre
          couleurs pour quatre crans faisaient de chaque ligne un nuancier, et
          la chaleur ne signalait plus rien. */}
      <TaskCardTrailing
        task={task}
        collaboratorIds={collaboratorsByTask.get(task.id)}
        pendingInvite={pendingCollaboratorTaskIds.has(task.id)}
        friends={friends}
      />
      {/* ── Maquette 86 : plus de « ⋯ » au repos ──────────────────────────
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

/**
 * Hint de geste animé : UNE fois par device, sur la 1ʳᵉ carte (nudge gauche
 * « Options » puis droite « Valider »). Le drag reprend la main à tout
 * moment ; respecte prefers-reduced-motion.
 */
function useSwipeHint(x: MotionValue<number>, isFirst: boolean, addToListMode: boolean) {
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
}

/**
 * Gestes de pointeur et de clavier de la carte : appui long (500 ms) et
 * glissement ouvrent les actions sans ouvrir la tâche ; clic droit, `Menu` et
 * `Shift+F10` ouvrent les actions (C-111, C-118). Rien en mode « ajout à une
 * liste ».
 */
function useCardGestures({ addToListMode, onOpen, onOpenActions, onSwipeRight }: {
  addToListMode: boolean;
  onOpen: () => void;
  onOpenActions: () => void;
  onSwipeRight: () => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const isDragging = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (addToListMode) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onOpenActions();
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 500);
  };
  const onClick = () => {
    if (isDragging.current) {
      isDragging.current = false;
      return;
    }
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    if (addToListMode) return;
    onOpen();
  };
  const onDragStart = () => {
    isDragging.current = true;
    cancelLongPress();
  };
  /** Au-delà de 80 px : à droite valide, à gauche ouvre les actions. */
  const onDragEnd = (offsetX: number) => {
    if (offsetX > 80) {
      onSwipeRight();
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    } else if (offsetX < -80) {
      onOpenActions();
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }
    setTimeout(() => { isDragging.current = false; }, 50);
  };
  // ═══ C-111 : LE SEUL CHEMIN CLAVIER VERS LES ACTIONS ═══
  // 🔴 Appui long, glissement et menu desktop (`hidden md:block`) sont des gestes de POINTEUR : sans ce chemin, les actions d'une tâche sont inatteignables au clavier sur mobile (WCAG 2.1.1, A). Il ouvre la feuille (clic droit ET clavier, la carte porte `tabIndex={0}`).
  // ✅ Aucun pixel ajouté : l'arbitrage de la maquette 86 (« plus de ⋯ au repos ») tient.
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (addToListMode) return;
    cancelLongPress();
    onOpenActions();
  };
  // ═══ C-118 : SAFARI N'ÉMET PAS `contextmenu` AU CLAVIER ═══
  // 🔴 `Shift+F10` et `Menu` arrivent en `keydown` sans `contextmenu` : on lit les deux touches en `keydown`, `preventDefault` évite le menu natif là où il est synthétisé quand même.
  // ⚠️ Même garde qu'`onContextMenu` : rien en mode « ajout à une liste ».
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ContextMenu' && !(e.key === 'F10' && e.shiftKey)) return;
    e.preventDefault();
    if (addToListMode) return;
    cancelLongPress();
    onOpenActions();
  };
  return { cancelLongPress, onPointerDown, onClick, onDragStart, onDragEnd, onContextMenu, onKeyDown };
}

/**
 * Classe et fond de la ligne glissable. Le fond reste OPAQUE : les calques
 * vert et gris du swipe sont dessinés DERRIÈRE cette ligne.
 */
function cardSurface(addToListMode: boolean, completed: boolean, selectedForList: boolean) {
  return {
    className: `relative flex items-stretch gap-3 px-3 py-2.5 transition-colors ${addToListMode ? 'cursor-default' : 'cursor-pointer'} ${completed && !addToListMode ? 'opacity-50' : ''}`,
    backgroundColor: addToListMode && selectedForList ? 'rgba(59, 130, 246, 0.1)' : 'rgb(var(--color-background))',
  };
}

/** Calques révélés DERRIÈRE la carte au glissement : vert (valider) à droite, gris (options) à gauche. */
function SwipeRevealLayers({ x, isValidating, completed }: { x: MotionValue<number>; isValidating: boolean; completed: boolean }) {
  const { t } = useT('tasks');
  const greenOpacity = useTransform(x, [0, 8, 80], [0, 1, 1]);
  const grayOpacity = useTransform(x, [-80, -8, 0], [1, 1, 0]);
  const greenIconOpacity = useTransform(x, [0, 24, 80], [0, 0.6, 1]);
  const grayIconOpacity = useTransform(x, [-80, -24, 0], [1, 0.6, 0]);
  return (
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
          <span className="text-label font-bold">{completed ? t('card.cancel') : t('card.validate')}</span>
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
  );
}

/** Case de gauche : cocher pour la liste (ou la sélection), sinon valider la tâche. */
function TaskCardCheckbox({ task, addToListMode, selectionKind, selected, onToggleForList, onToggleComplete }: {
  task: Task;
  addToListMode: boolean;
  selectionKind: 'list' | 'select';
  selected: boolean;
  onToggleForList: () => void;
  onToggleComplete: () => void;
}) {
  const { t } = useT('tasks');
  if (addToListMode) {
    const label = selectionKind === 'select'
      ? t(selected ? 'table.deselectTaskAria' : 'table.selectTaskAria', { name: task.name })
      : t(selected ? 'card.removeFromList' : 'card.addToListShort');
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onToggleForList(); }}
        className="min-w-11 min-h-11 -my-1 -ml-1 p-2 flex items-center justify-center shrink-0"
        aria-label={label}
        aria-pressed={selected}
      >
        <span
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
            selected
              ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]'
              : 'border-slate-400 dark:border-slate-500'
          }`}
        >
          {selected && <CheckMark />}
        </span>
      </button>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggleComplete();
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
        {task.completed && <CheckMark />}
      </span>
    </button>
  );
}

const CheckMark = () => (
  <svg className="w-4 h-4 text-[rgb(var(--color-accent-solid-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

/**
 * Méta : catégorie · échéance · durée, sur une ligne propre à taille normale.
 * `flex-wrap` : à 200 % de police (WCAG 1.4.4), la rangée sortait de l'écran
 * de 218 px, durée comprise, sans défilement pour l'atteindre. La catégorie
 * est absente en mode « ajout à une liste ».
 */
function TaskCardMeta({ task, category, categoryColor, isOverdue }: {
  task: Task;
  category?: { name: string } | null;
  categoryColor: string;
  isOverdue: boolean;
}) {
  const { t } = useT('tasks');
  const subtasks = task.subtasks ?? [];
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption" style={{ color: 'rgb(var(--color-text-muted))' }}>
      {category && (
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
      {/* Maquette 146 : `--color-danger-text`, lisible en 11 px
          (`text-red-500` mesurait 3,9:1 sur le fond Gris). */}
      <span className={isOverdue ? 'text-[rgb(var(--color-danger-text))] font-semibold inline-flex items-center gap-0.5' : ''}>
        {isOverdue && <AlertTriangle size={12} aria-hidden="true" />}
        {task.deadline
          ? (isOverdue ? formatOverdueSince(task.deadline) : formatDeadlineSmart(task.deadline))
          : t('card.noDeadline')}
        {isOverdue && <span className="sr-only"> {t('card.overdue')}</span>}
      </span>
      <span aria-hidden="true">·</span>
      <span>{formatDuration(task.estimatedTime)}</span>
      <TaskStateBadges task={task} />
      {/* Compteur sous-tâches (#12) */}
      {subtasks.length > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span title={t('card.subtasksDone')}>
            ☑ {subtasks.filter(s => s.completed).length}/{subtasks.length}
          </span>
        </>
      )}
    </div>

  );
}

/**
 * Colonne de droite : priorité (P1 et P2 seules teintées, maquette 145),
 * favori, puis le partage dit par un seul signe (maquette 85) : l'avatar de
 * qui l'a envoyée, ou les collaborateurs et une invitation en attente.
 */
function TaskCardTrailing({ task, collaboratorIds, pendingInvite, friends }: {
  task: Task;
  collaboratorIds: string[] | undefined;
  pendingInvite: boolean;
  friends: Friend[];
}) {
  const { t } = useT('tasks');
  // Deux initiales pour le rond de la maquette 15. `sharedBy` est un nom
  // affichable, pas un UUID — il vient déjà résolu du repository.
  const sharedByInitials = task.sharedBy
    ? task.sharedBy.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
    : '';
  return (
    <>
      {task.priority > 0 && (
        <div
          className={`self-center shrink-0 px-1.5 py-0.5 rounded-md font-bold text-caption ${priorityPillClass(task.priority)}`}
        >
          P{task.priority}
        </div>
      )}

      {task.bookmarked && (
        // Maquette 149 : contour gris, plus un marque-page ambre plein (une
        // cinquième couleur sur la ligne). Le nom accessible dit l'état.
        <Bookmark size={16} className="self-center shrink-0 text-[rgb(var(--color-text-muted))]" aria-label={t('card.bookmarked')} />
      )}

      {/* ── Maquette 85 : le partage se dit à DROITE, par un seul signe ────
          L'avatar vivait sous le titre, dans la colonne du texte, où il
          poussait la ligne méta vers le bas et rognait le titre. Il occupe
          maintenant la colonne libérée par le « ⋯ » : même information,
          zéro largeur prise au libellé. */}
      {task.sharedBy && (
        <span
          // Maquette 148 : avatar neutre, la couleur reste aux catégories.
          className="self-center shrink-0 inline-flex size-7 items-center justify-center rounded-full bg-[rgb(var(--color-border))] text-xs font-bold leading-none text-[rgb(var(--color-text-secondary))]"
          title={t('card.receivedFrom', { name: task.sharedBy })}
          aria-hidden="true"
        >
          {sharedByInitials}
        </span>
      )}
      {task.sharedBy && (
        <span className="sr-only">{t('card.receivedFrom', { name: task.sharedBy })}</span>
      )}
      {!task.sharedBy && task.isCollaborative && (collaboratorIds?.length ?? 0) > 0 && (
        <span className="self-center shrink-0 inline-flex items-center gap-1.5">
          <CollaboratorAvatars
            collaboratorIds={collaboratorIds}
            friends={friends}
            size="lg"
            maxVisible={3}
          />
          {pendingInvite && (
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
    </>
  );
}

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
