// Modal « Événements récurrents » de l'agenda — extrait verbatim, prop-driven.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as CloseIcon, Pencil, Trash2 } from 'lucide-react';
import { useUpdateEvent, type CalendarEvent } from '@/modules/events';

interface RecurringEventsManagerProps {
  isOpen: boolean;
  setShowRecurringManager: React.Dispatch<React.SetStateAction<boolean>>;
  events: CalendarEvent[];
  updateEventMutation: ReturnType<typeof useUpdateEvent>;
  setSelectedEvent: React.Dispatch<React.SetStateAction<CalendarEvent | null>>;
  setSelectedInstanceDate: React.Dispatch<React.SetStateAction<string | null>>;
  setShowEditEventModal: React.Dispatch<React.SetStateAction<boolean>>;
}

const RecurringEventsManager: React.FC<RecurringEventsManagerProps> = ({
  isOpen, setShowRecurringManager, events, updateEventMutation,
  setSelectedEvent, setSelectedInstanceDate, setShowEditEventModal,
}) => (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowRecurringManager(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl shadow-2xl w-full overflow-hidden border"
              style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', maxWidth: 'calc(32rem * 1.08)' }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
                <h3 className="text-base font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>Événements récurrents</h3>
                <button onClick={() => setShowRecurringManager(false)}
                  className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  <CloseIcon size={18} />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {(() => {
                  const recurring = events.filter(e => (e.recurrence ?? 'none') !== 'none');
                  if (recurring.length === 0) {
                    return (
                      <div className="px-6 py-10 text-center">
                        <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>Aucun événement récurrent pour le moment.</p>
                      </div>
                    );
                  }
                  return (
                    <ul className="divide-y" style={{ borderColor: 'rgb(var(--color-border))' }}>
                      {recurring.map(ev => {
                        const startDate = new Date(ev.start);
                        const label = ev.recurrence === 'daily' ? 'Quotidien' : ev.recurrence === 'weekly' ? 'Hebdomadaire' : 'Récurrent';
                        return (
                          <li key={ev.id} className="px-6 py-3 flex items-center gap-3" style={{ borderColor: 'rgb(var(--color-border))' }}>
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.color || 'rgb(var(--color-accent))' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{ev.title}</p>
                              <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                                {label} · démarre le {startDate.toLocaleDateString('fr-FR')} à {startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  // Ouvre le modal d'édition de l'événement (sélecteur de
                                  // récurrence inclus, dont « Personnaliser »).
                                  setSelectedEvent(ev);
                                  setSelectedInstanceDate(null);
                                  setShowEditEventModal(true);
                                  setShowRecurringManager(false);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 dark:border-blue-800/40 transition-colors"
                                aria-label="Modifier la récurrence"
                              >
                                <Pencil size={13} />
                                <span>Modifier</span>
                              </button>
                              <button
                                onClick={() => updateEventMutation.mutate({ id: ev.id, updates: { recurrence: 'none' } })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-200 dark:border-red-800/40 transition-colors"
                                aria-label="Supprimer la récurrence"
                              >
                                <Trash2 size={13} />
                                <span>Récurrence</span>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
);

export default RecurringEventsManager;
