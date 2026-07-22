import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CalendarEvent } from '@/modules/events';

interface AgendaEventToTaskConfirmProps {
  event: CalendarEvent | null;
  /** Ferme sans rien faire : l'événement reste inchangé dans l'agenda. */
  onCancel: () => void;
  /** Supprime définitivement l'événement. */
  onDelete: () => void;
  /** Ouvre la modale de création de tâche pré-remplie avec l'événement. */
  onConvertToTask: () => void;
}

/**
 * Popup proposée quand un événement SANS tâche liée est déposé sur la
 * sidebar des tâches : demande à l'utilisateur s'il veut supprimer
 * l'événement ou le transformer en tâche (ouvre alors TaskModal pré-rempli).
 */
const AgendaEventToTaskConfirm: React.FC<AgendaEventToTaskConfirmProps> = ({
  event, onCancel, onDelete, onConvertToTask,
}) => {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-2xl sm:rounded-2xl shadow-2xl p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-to-task-title"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 id="event-to-task-title" className="text-base font-bold text-[rgb(var(--color-text-primary))] leading-tight">
                  Que faire de cet événement ?
                </h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                  Il n'est rattaché à aucune tâche
                </p>
              </div>
              <button
                onClick={onCancel}
                aria-label="Fermer"
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] hover:text-[rgb(var(--color-text-primary))] transition-colors text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] px-4 py-3 mb-5">
              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
                {event.title}
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={onDelete}
                style={{ minHeight: '48px' }}
                className="flex-1 inline-flex items-center justify-center px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold active:scale-[0.98] transition-all duration-150"
              >
                Supprimer
              </button>

              <button
                onClick={onConvertToTask}
                style={{ minHeight: '48px' }}
                className="flex-1 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold active:scale-[0.98] transition-all duration-150"
              >
                Transformer en tâche
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AgendaEventToTaskConfirm;
