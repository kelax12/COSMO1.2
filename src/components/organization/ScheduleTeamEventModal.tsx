// Planifier une tâche d'équipe dans MON agenda perso — pendant de
// ScheduleEventModal (tâches perso), pour l'action « Assigner l'événement »
// du menu ⋯ de TeamTasksTab. `CalendarEvent.taskId` référence uniquement la
// table `tasks` (personnelle) : un événement créé ici n'est donc PAS lié en
// base à la tâche d'équipe (pas de FK team_tasks), juste pré-rempli à partir
// d'elle. Lier réellement les deux tables demanderait une migration — hors
// périmètre de ce simple raccourci de planification.
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
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { projectColorHex } from './team-projects.helpers';
import { useT } from '@/i18n/useT';

interface ScheduleTeamEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TeamTask | null;
  project?: TeamProject;
}

export default function ScheduleTeamEventModal({ open, onOpenChange, task, project }: ScheduleTeamEventModalProps) {
  const { t } = useT('eventModal');
  const createEvent = useCreateEvent();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(task?.name ?? '');
    setDate('');
    setStartTime('');
    setEndTime('');
    setNotes(project ? project.name : '');
  }, [open, task, project]);

  const canSave = title.trim().length > 0 && !!date && !!startTime && !!endTime;

  const handleSave = () => {
    if (!canSave) return;
    const payload: CreateEventInput = {
      title: title.trim(),
      start: new Date(`${date}T${startTime}`).toISOString(),
      end: new Date(`${date}T${endTime}`).toISOString(),
      notes: notes.trim() || undefined,
      color: projectColorHex(project?.color ?? 'blue'),
      isPrivate: true,
    };
    createEvent.mutate(payload, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('schedule.title')}</DialogTitle>
          <DialogDescription>{t('schedule.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="team-schedule-title">{t('schedule.titleLabel')}</Label>
            <Input id="team-schedule-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team-schedule-date">{t('schedule.date')}</Label>
            <Input id="team-schedule-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="team-schedule-start">{t('schedule.startTime')}</Label>
              <Input id="team-schedule-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="team-schedule-end">{t('schedule.endTime')}</Label>
              <Input id="team-schedule-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team-schedule-notes">{t('schedule.notes')}</Label>
            <Textarea id="team-schedule-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            className={`!border-0 ${
              !canSave || createEvent.isPending
                ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))] !opacity-40'
                : '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))]'
            }`}
          >
            Planifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
