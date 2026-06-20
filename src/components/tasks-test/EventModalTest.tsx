// Planifier une tâche dans l'agenda — refonte « test » shadcn (desktop).
// Réutilise useCreateEvent. Crée un événement lié (taskId) à partir d'une tâche.
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
import { isoToLocalInput, localInputToIso } from './helpers';

interface EventModalTestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
}

/** Échéance de la tâche (ou aujourd'hui) à 12:00, + fin selon durée estimée. */
function defaultSlot(task: Task | null): { start: string; end: string } {
  const base = task?.deadline ? new Date(task.deadline) : new Date();
  if (Number.isNaN(base.getTime())) base.setTime(Date.now());
  base.setHours(12, 0, 0, 0);
  const end = new Date(base);
  end.setMinutes(end.getMinutes() + (task?.estimatedTime || 60));
  return { start: isoToLocalInput(base.toISOString()), end: isoToLocalInput(end.toISOString()) };
}

export default function EventModalTest({ open, onOpenChange, task }: EventModalTestProps) {
  const createEvent = useCreateEvent();
  const categoryColor = useCategoryColor(task?.category ?? '');

  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    const slot = defaultSlot(task);
    setTitle(task?.name ?? '');
    setStart(slot.start);
    setEnd(slot.end);
    setNotes('');
  }, [open, task]);

  const canSave = title.trim().length > 0 && !!start && !!end;

  const handleSave = () => {
    if (!canSave || !task) return;
    const payload: CreateEventInput = {
      title: title.trim(),
      start: localInputToIso(start),
      end: localInputToIso(end),
      notes: notes.trim() || undefined,
      taskId: task.id,
      color: categoryColor,
    };
    createEvent.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Planifier dans l'agenda</DialogTitle>
          <DialogDescription>Crée un événement lié à cette tâche.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="event-title">Titre</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={(e) => {
                const len = e.currentTarget.value.length;
                e.currentTarget.setSelectionRange(len, len);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="event-start">Début</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-end">Fin</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-notes">Notes</Label>
            <Textarea
              id="event-notes"
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
          <Button type="button" size="lg" disabled={!canSave || createEvent.isPending} onClick={handleSave}>
            Planifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
