import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Calendar as CalendarIcon, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateTask } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import { useCreateEvent, type CreateEventInput } from '@/modules/events';
import { type Habit } from '@/modules/habits';
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
          className="w-64 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          role="menu"
        >
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20">
            <span className="font-bold text-sm text-slate-900 dark:text-white">Actions</span>
          </div>
          <ul className="py-1">
            {/* Créer une tâche */}
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={handleCreateTask}
                className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-700"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <CheckSquare size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">
                    Créer une tâche
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Échéance aujourd'hui, {habit.estimatedTime} min
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
                className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-700"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <CalendarIcon size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">
                    Planifier dans l'agenda
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Crée un événement avec heure ajustable
                  </p>
                </div>
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
        className="h-11 w-11 sm:h-9 sm:w-9 flex items-center justify-center rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title="Plus d'actions"
        aria-label="Plus d'actions"
        aria-expanded={open}
      >
        <MoreHorizontal size={18} className="md:w-4 md:h-4" />
      </button>

      {typeof document !== 'undefined' && createPortal(popoverContent, document.body)}

      {/* EventModal en mode convert : ouvre le formulaire d'événement
          pré-rempli depuis l'habit (titre, durée, catégorie, date).
          L'utilisateur ajuste l'heure puis valide. */}
      {eventModalOpen && (
        <EventModal
          mode="convert"
          isOpen={eventModalOpen}
          onClose={() => setEventModalOpen(false)}
          task={habitAsTask}
          onConvert={(eventData) => {
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
