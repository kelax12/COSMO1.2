// Planifier une tâche dans l'agenda — design repris de la version test (shadcn
// Dialog épuré). Composant production autonome : crée un événement lié (taskId)
// à partir d'une tâche via useCreateEvent. Remplace l'ancien EventModal mode
// « convert » lancé depuis le bouton « Planifier » de la TaskTable.
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCreateEvent, type CreateEventInput } from '@/modules/events';
import { useCategoryColor } from '@/modules/categories';
import type { Task } from '@/modules/tasks';

interface ScheduleEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
}

/** ISO → valeur <input type="datetime-local"> (locale). */
export function isoToLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valeur <input datetime-local> → ISO string. */
export function localInputToIso(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

/** Échéance de la tâche (ou aujourd'hui) à 12:00, + fin selon durée estimée. */
export function defaultSlot(task: Task | null): { start: string; end: string } {
  const base = task?.deadline ? new Date(task.deadline) : new Date();
  if (Number.isNaN(base.getTime())) base.setTime(Date.now());
  base.setHours(12, 0, 0, 0);
  const end = new Date(base);
  end.setMinutes(end.getMinutes() + (task?.estimatedTime || 60));
  return { start: isoToLocalInput(base.toISOString()), end: isoToLocalInput(end.toISOString()) };
}

export default function ScheduleEventModal({ open, onOpenChange, task }: ScheduleEventModalProps) {
  const createEvent = useCreateEvent();
  const categoryColor = useCategoryColor(task?.category ?? '');

  const [title, setTitle] = useState('');
  // Date unique + heures de début/fin séparées (au lieu de 2 datetime-local) —
  // un événement planifié depuis une tâche tient toujours sur un seul jour.
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    // Les champs date/heure restent vides à l'ouverture : l'utilisateur choisit
    // explicitement le créneau (pas de pré-remplissage via defaultSlot).
    setTitle(task?.name ?? '');
    setDate('');
    setStartTime('');
    setEndTime('');
    setNotes('');
  }, [open, task]);

  const canSave = title.trim().length > 0 && !!date && !!startTime && !!endTime;

  const handleSave = () => {
    if (!canSave || !task) return;
    const payload: CreateEventInput = {
      title: title.trim(),
      start: localInputToIso(`${date}T${startTime}`),
      end: localInputToIso(`${date}T${endTime}`),
      notes: notes.trim() || undefined,
      taskId: task.id,
      color: categoryColor,
      isPrivate: true,
    };
    createEvent.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        // Empêche le focus auto (et la sélection bleue du titre) à l'ouverture.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Planifier dans l'agenda</DialogTitle>
          <DialogDescription>Crée un événement lié à cette tâche.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="schedule-event-title">Titre</Label>
            <Input
              id="schedule-event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              // Évite la sélection automatique (surbrillance bleue) du titre à
              // l'ouverture : place le curseur en fin de texte au focus.
              onFocus={(e) => {
                const len = e.currentTarget.value.length;
                e.currentTarget.setSelectionRange(len, len);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-event-date">Date</Label>
            <Input
              id="schedule-event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="schedule-event-start-time">Heure de début</Label>
              <Input
                id="schedule-event-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schedule-event-end-time">Heure de fin</Label>
              <Input
                id="schedule-event-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-event-notes">Notes</Label>
            <Textarea
              id="schedule-event-notes"
              rows={2}
              value={notes}
              placeholder="Facultatif…"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={!canSave || createEvent.isPending}
            onClick={handleSave}
            className={`!text-white !border-0 ${
              !canSave || createEvent.isPending
                ? '!bg-blue-300 dark:!bg-blue-900/60 !opacity-100'
                : '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))]'
            }`}
          >
            Planifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
