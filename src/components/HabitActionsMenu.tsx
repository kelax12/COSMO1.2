import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, CalendarPlus, ListPlus, CircleSlash, CirclePlay, Copy } from 'lucide-react';
import { useHabitPauses } from '@/lib/hooks/use-habit-pauses';
import { toast } from 'sonner';
import { useCreateTask } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import { useCreateEvent, type CreateEventInput } from '@/modules/events';
import { type Habit, useCreateHabit } from '@/modules/habits';
import EventModal from './EventModal';

interface HabitActionsMenuProps {
  habit: Habit;
}

/**
 * Menu d'actions « ... » sur une carte habitude.
 * Deux actions :
 *   1. Créer une tâche  → useCreateTask avec name=habit.name,
 *      estimatedTime=habit.estimatedTime, deadline=aujourd'hui 23:59:59.
 *      Toast undo (suppression automatique de la tâche si annulé).
 *   2. Planifier dans l'agenda → ouvre EventModal en mode convert,
 *      pré-rempli avec un task-like objet construit depuis l'habitude.
 *
 * Le popover est rendu via createPortal vers <body> pour échapper aux
 * overflows parents et z-index conflicts.
 */
const HabitActionsMenu: React.FC<HabitActionsMenuProps> = ({ habit }) => {
  const [open, setOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const { data: categories = [] } = useCategories();
  const createTaskMutation = useCreateTask();
  const createEventMutation = useCreateEvent();
  const createHabitMutation = useCreateHabit();
  const { isPaused, pauseUntil, resume } = useHabitPauses();
  const paused = isPaused(habit.id);

  // Pause "indéfinie" : on stocke une date très lointaine (année 9999). La pause ne se
  // lèvera que lorsque l'utilisateur clique manuellement sur « Reprendre ».
  const INDEFINITE_PAUSE_DATE = new Date('9999-12-31T23:59:59.999Z');

  // Calcule la position viewport du trigger (idem SmartListMenu)
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const measure = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({
        top: r.bottom + 8,
        right: window.innerWidth - r.right,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  // Click outside + ESC
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popoverRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Construit une deadline = aujourd'hui 23:59:59 local, en ISO
  const todayEod = () => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  };

  const handleCreateTask = () => {
    const defaultCategory = categories[0]?.id || '';
    createTaskMutation.mutate(
      {
        name: habit.name,
        priority: 3,
        category: defaultCategory,
        deadline: todayEod(),
        estimatedTime: habit.estimatedTime,
        bookmarked: false,
        completed: false,
      },
      {
        onSuccess: (newTask) => {
          toast.success(`Tâche « ${habit.name} » créée`, {
            description: `Échéance aujourd'hui · ${habit.estimatedTime} min`,
            duration: 4000,
          });
          // Note : pas d'undo ici — useCreateTask n'expose pas useDeleteTask
          // directement. Si l'utilisateur change d'avis, il peut supprimer
          // la tâche depuis la page Tâches.
          void newTask;
        },
      }
    );
    setOpen(false);
  };

  const handleScheduleEvent = () => {
    setEventModalOpen(true);
    setOpen(false);
  };

  // task-like construit depuis l'habit pour EventModal en mode convert.
  // L'EventModal lit name/estimatedTime/category/deadline pour pré-remplir.
  const habitAsTask = {
    id: habit.id,
    name: habit.name,
    completed: false,
    priority: 3,
    category: categories[0]?.id || '',
    estimatedTime: habit.estimatedTime,
    deadline: todayEod(),
    bookmarked: false,
    createdAt: habit.createdAt || new Date().toISOString(),
  };

  const popoverContent = (
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.12 }}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-64 max-w-[calc(100vw-32px)] bg-[rgb(var(--color-surface))] rounded-xl shadow-xl border border-[rgb(var(--color-border))] overflow-hidden"
          role="menu"
        >
          <div className="px-3 pt-2.5 pb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
              Actions
            </span>
          </div>
          <ul className="pb-1.5">
            {/* Créer une tâche */}
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={handleCreateTask}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[rgb(var(--color-hover))] transition-colors text-left focus-visible:outline-none focus-visible:bg-[rgb(var(--color-hover))]"
              >
                <ListPlus size={17} strokeWidth={1.75} className="shrink-0 text-[rgb(var(--color-text-secondary))]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[rgb(var(--color-text-primary))]">
                    Créer une tâche
                  </div>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">
                    Aujourd'hui · {habit.estimatedTime} min
                  </p>
                </div>
              </button>
            </li>

            {/* Planifier dans l'agenda */}
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={handleScheduleEvent}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[rgb(var(--color-hover))] transition-colors text-left focus-visible:outline-none focus-visible:bg-[rgb(var(--color-hover))]"
              >
                <CalendarPlus size={17} strokeWidth={1.75} className="shrink-0 text-[rgb(var(--color-text-secondary))]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[rgb(var(--color-text-primary))]">
                    Planifier dans l'agenda
                  </div>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">
                    Événement avec heure ajustable
                  </p>
                </div>
              </button>
            </li>

            {/* Dupliquer (#3) : copie de l'habitude, historique remis à zéro */}
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const { id: _id, createdAt: _ca, completions: _c, ...rest } = habit;
                  createHabitMutation.mutate(
                    { ...rest, name: `${habit.name} (copie)`, completions: {} },
                    { onSuccess: () => toast.success(`Habitude « ${habit.name} » dupliquée`) }
                  );
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[rgb(var(--color-hover))] transition-colors text-left focus-visible:outline-none focus-visible:bg-[rgb(var(--color-hover))]"
              >
                <Copy size={17} strokeWidth={1.75} className="shrink-0 text-[rgb(var(--color-text-secondary))]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[rgb(var(--color-text-primary))]">
                    Dupliquer l'habitude
                  </div>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">
                    Copie avec un historique vierge
                  </p>
                </div>
              </button>
            </li>

            <li className="my-1 mx-3 border-t border-[rgb(var(--color-border))]" />

            {/* Pause / Reprendre — toggle direct sans sous-menu */}
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (paused) {
                    resume(habit.id);
                    toast.success(`« ${habit.name} » a repris`);
                  } else {
                    pauseUntil(habit.id, INDEFINITE_PAUSE_DATE);
                    toast.success(`« ${habit.name} » en pause`, {
                      description: 'Le streak reste intact jusqu\'à reprise',
                    });
                  }
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[rgb(var(--color-hover))] transition-colors text-left focus-visible:outline-none focus-visible:bg-[rgb(var(--color-hover))]"
              >
                {paused ? (
                  <CirclePlay size={17} strokeWidth={1.75} className="shrink-0 text-[rgb(var(--color-text-secondary))]" />
                ) : (
                  <CircleSlash size={17} strokeWidth={1.75} className="shrink-0 text-[rgb(var(--color-text-secondary))]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[rgb(var(--color-text-primary))]">
                    {paused ? 'Reprendre l\'habitude' : 'Mettre en pause'}
                  </div>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">
                    {paused ? 'Réactiver le suivi' : 'Vacances, maladie… streak conservé'}
                  </p>
                </div>
                {paused && (
                  <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                )}
              </button>
            </li>
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="h-11 w-11 sm:h-9 sm:w-9 flex items-center justify-center rounded-md text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title="Plus d'actions"
        aria-label="Plus d'actions"
        aria-expanded={open}
      >
        <MoreHorizontal size={18} className="md:w-4 md:h-4" />
      </button>

      {typeof document !== 'undefined' && createPortal(popoverContent, document.body)}

      {/* EventModal en mode 'add' : pré-remplit titre, DATE = aujourd'hui,
          start time = 12:00, end time = start + estimatedTime, couleur.
          lockedFields verrouille titre + startDate → seuls les horaires
          et la couleur (catégorie) restent éditables par l'utilisateur. */}
      {eventModalOpen && (
        <EventModal
          mode="add"
          isOpen={eventModalOpen}
          onClose={() => setEventModalOpen(false)}
          task={habitAsTask}
          lockedFields={['title', 'startDate']}
          onAddEvent={(eventData) => {
            createEventMutation.mutate(eventData as CreateEventInput, {
              onSuccess: () => {
                toast.success(`Habitude « ${habit.name} » planifiée`);
              },
            });
            setEventModalOpen(false);
          }}
        />
      )}
    </>
  );
};

export default HabitActionsMenu;
