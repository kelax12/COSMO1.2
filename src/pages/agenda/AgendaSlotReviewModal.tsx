import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, CalendarClock, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatTimeInTz, toDisplayISO, type TimezonePref } from '@/lib/timezone';
import type { OverdueTaskSlot } from './overdue-slots';

interface AgendaSlotReviewModalProps {
  slot: OverdueTaskSlot | null;
  /** Nombre de créneaux restant à traiter (pour le compteur). */
  remaining: number;
  tzPref: TimezonePref;
  /** La tâche a été réalisée : valide la tâche côté tâche. */
  onValidate: (slot: OverdueTaskSlot) => void;
  /** Reporter le créneau à plus tard. */
  onPostpone: (slot: OverdueTaskSlot) => void;
  /** Abandonner la tâche : supprime la tâche et son créneau. */
  onDelete: (slot: OverdueTaskSlot) => void;
  /** Fermer sans décider (réapparaîtra à la prochaine visite). */
  onSnooze: () => void;
}

/**
 * Modal proposé au retour sur l'agenda quand le créneau d'une tâche planifiée est
 * terminé : la tâche a-t-elle été réalisée ? Valider / Reporter / Supprimer.
 */
const AgendaSlotReviewModal: React.FC<AgendaSlotReviewModalProps> = ({
  slot, remaining, tzPref, onValidate, onPostpone, onDelete, onSnooze,
}) => {
  return (
    <AnimatePresence>
      {slot && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={onSnooze}
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
            aria-labelledby="slot-review-title"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div>
                  <h3 id="slot-review-title" className="text-base font-bold text-[rgb(var(--color-text-primary))] leading-tight">
                    Créneau terminé
                  </h3>
                  <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                    Cette tâche a-t-elle été réalisée&nbsp;?
                  </p>
                </div>
              </div>
              <button
                onClick={onSnooze}
                aria-label="Plus tard"
                className="shrink-0 p-1.5 rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Récap de la tâche + créneau */}
            <div className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] px-4 py-3 mb-5">
              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
                {slot.task.name}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-1">
                {(() => {
                  const dayLabel = format(new Date(toDisplayISO(slot.event.start, tzPref)), 'EEEE d MMMM', { locale: fr });
                  const cap = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
                  return `${cap} · ${formatTimeInTz(slot.event.start, tzPref)} – ${formatTimeInTz(slot.event.end, tzPref)}`;
                })()}
              </p>
            </div>

            {remaining > 1 && (
              <p className="text-[11px] text-[rgb(var(--color-text-muted))] mb-3 text-center">
                {remaining} créneaux à passer en revue
              </p>
            )}

            <div className="flex flex-col gap-2.5">
              {/* Valider : réalisée → complète la tâche côté tâche */}
              <button
                onClick={() => onValidate(slot)}
                style={{ minHeight: '48px' }}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold active:scale-[0.98] transition-all duration-150"
              >
                <CheckCircle2 size={17} /> Oui, valider la tâche
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Reporter : décale le créneau */}
                <button
                  onClick={() => onPostpone(slot)}
                  style={{ minHeight: '48px' }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] text-sm font-semibold hover:bg-[rgb(var(--color-hover))] active:scale-[0.98] transition-all duration-150"
                >
                  <CalendarClock size={16} /> Reporter
                </button>

                {/* Supprimer : abandonne la tâche + son créneau */}
                <button
                  onClick={() => onDelete(slot)}
                  style={{ minHeight: '48px' }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 dark:border-red-500/30 text-red-500 text-sm font-semibold hover:bg-red-500 hover:text-white hover:border-red-500 active:scale-[0.98] transition-all duration-150"
                >
                  <Trash2 size={16} /> Supprimer
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AgendaSlotReviewModal;
