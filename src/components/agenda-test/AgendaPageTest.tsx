// Agenda — refonte « test » shadcn AUDACIEUSE (desktop). Grille semaine custom
// (sans FullCalendar) : clic sur un créneau → carte de création inline ;
// clic sur un event → dialog d'édition. Réutilise le module events (mêmes
// hooks) — aucune logique métier nouvelle. AgendaPage d'origine inchangée.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  expandRecurringEvents,
  getMasterId,
  type CalendarEvent,
} from '@/modules/events';
import { useCategories } from '@/modules/categories';
import {
  HOUR_HEIGHT,
  weekDays,
  startOfWeek,
  sameDay,
  minutesSinceMidnight,
  weekLabel,
  WEEKDAY_LABELS,
  QUICK_DURATIONS,
  formatHour,
  formatTimeRange,
  isoAt,
  DEFAULT_EVENT_COLOR,
} from './helpers';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const isoToLocal = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localToIso = (v: string) => (v ? new Date(v).toISOString() : '');

interface Placed {
  id: string;
  masterId: string;
  title: string;
  color: string;
  startIso: string;
  endIso: string;
  dayIndex: number;
  top: number;
  height: number;
  recurring: boolean;
}

interface QuickDraft {
  dayIndex: number;
  startIso: string;
  durationMin: number;
}

export default function AgendaPageTest() {
  const { data: events = [] } = useEvents();
  const { data: categories = [] } = useCategories();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [refDate, setRefDate] = useState(() => new Date());
  const [quick, setQuick] = useState<QuickDraft | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCat, setQuickCat] = useState('');
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => weekDays(refDate), [refDate]);
  const today = new Date();

  // Scroll au matin au montage.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, []);

  const catColor = (id: string) => categories.find((c) => c.id === id)?.color;

  // Events de la semaine visible (récurrences étendues), positionnés.
  const placed = useMemo<Placed[]>(() => {
    const from = startOfWeek(refDate);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    const expanded = expandRecurringEvents(events, from, to);
    const out: Placed[] = [];
    for (const ev of expanded) {
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      const dayIndex = days.findIndex((d) => sameDay(d, s));
      if (dayIndex === -1) continue;
      const top = (minutesSinceMidnight(s) / 60) * HOUR_HEIGHT;
      const durMin = Math.max((e.getTime() - s.getTime()) / 60000, 15);
      out.push({
        id: ev.id,
        masterId: getMasterId(ev.id),
        title: ev.title,
        color: ev.color || DEFAULT_EVENT_COLOR,
        startIso: ev.start,
        endIso: ev.end,
        dayIndex,
        top,
        height: Math.max((durMin / 60) * HOUR_HEIGHT, 20),
        recurring: ev.id.includes('::'),
      });
    }
    return out;
  }, [events, refDate, days]);

  const nowTop = (minutesSinceMidnight(today) / 60) * HOUR_HEIGHT;
  const todayIndex = days.findIndex((d) => sameDay(d, today));

  const shiftWeek = (delta: number) => {
    const d = new Date(refDate);
    d.setDate(d.getDate() + delta * 7);
    setRefDate(d);
    setQuick(null);
  };

  const openQuick = (dayIndex: number, clientYInCol: number) => {
    const totalMin = Math.round((clientYInCol / HOUR_HEIGHT) * 60 / 15) * 15;
    const hour = Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    if (hour < 0 || hour > 23) return;
    setQuickTitle('');
    setQuickCat(categories[0]?.id ?? '');
    setQuick({ dayIndex, startIso: isoAt(days[dayIndex], hour, minute), durationMin: 60 });
  };

  const submitQuick = () => {
    if (!quick || !quickTitle.trim()) return;
    const start = new Date(quick.startIso);
    const end = new Date(start.getTime() + quick.durationMin * 60000);
    createEvent.mutate(
      {
        title: quickTitle.trim(),
        start: quick.startIso,
        end: end.toISOString(),
        color: catColor(quickCat) || DEFAULT_EVENT_COLOR,
      },
      { onSuccess: () => setQuick(null) }
    );
  };

  const openEvent = (p: Placed) => {
    const master = events.find((e) => e.id === p.masterId);
    if (master) setEditing(master);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-6 py-6">
      {/* En-tête */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-muted-foreground mb-1 inline-flex items-center gap-1.5 text-xs font-medium">
            <FlaskConical className="size-3.5" aria-hidden="true" /> Mode test
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="lg" onClick={() => setRefDate(new Date())}>
            Aujourd'hui
          </Button>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon-lg" aria-label="Semaine précédente" onClick={() => shiftWeek(-1)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button type="button" variant="outline" size="icon-lg" aria-label="Semaine suivante" onClick={() => shiftWeek(1)}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <span className="min-w-44 text-sm font-medium">{weekLabel(refDate)}</span>
        </div>
      </div>

      {/* Grille */}
      <div className="border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
        {/* En-tête jours */}
        <div className="border-border flex border-b">
          <div className="w-14 shrink-0" />
          {days.map((d, i) => {
            const isToday = sameDay(d, today);
            return (
              <div key={i} className="flex-1 px-2 py-2 text-center">
                <div className="text-muted-foreground text-xs font-medium">{WEEKDAY_LABELS[i]}</div>
                <div
                  className={cn(
                    'mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                    isToday && 'bg-primary text-primary-foreground'
                  )}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Corps scrollable */}
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
          <div className="flex" style={{ height: HOUR_HEIGHT * 24 }}>
            {/* Gouttière heures */}
            <div className="w-14 shrink-0">
              {HOURS.map((h) => (
                <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="text-muted-foreground absolute -top-2 right-2 text-[10px]">{h === 0 ? '' : formatHour(h)}</span>
                </div>
              ))}
            </div>

            {/* Colonnes jours */}
            {days.map((_day, dayIndex) => (
              <div
                key={dayIndex}
                className="border-border relative flex-1 border-l"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  openQuick(dayIndex, e.clientY - rect.top);
                }}
              >
                {/* Lignes horaires */}
                {HOURS.map((h) => (
                  <div key={h} className="border-border/60 border-b" style={{ height: HOUR_HEIGHT }} />
                ))}

                {/* Indicateur "maintenant" */}
                {todayIndex === dayIndex && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                    <div className="relative">
                      <div className="absolute -left-1 -top-1 size-2 rounded-full bg-red-500" />
                      <div className="h-px w-full bg-red-500" />
                    </div>
                  </div>
                )}

                {/* Events */}
                {placed
                  .filter((p) => p.dayIndex === dayIndex)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEvent(p); }}
                      className="absolute inset-x-1 z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-white shadow-sm ring-1 ring-black/10 transition hover:brightness-110"
                      style={{ top: p.top, height: p.height, backgroundColor: p.color }}
                    >
                      <div className="truncate text-xs font-semibold leading-tight">{p.title}</div>
                      {p.height > 32 && (
                        <div className="truncate text-[10px] opacity-90">{formatTimeRange(p.startIso, p.endIso)}</div>
                      )}
                    </button>
                  ))}

                {/* Carte de création inline */}
                {quick && quick.dayIndex === dayIndex && (
                  <QuickCreateCard
                    quick={quick}
                    title={quickTitle}
                    onTitle={setQuickTitle}
                    cat={quickCat}
                    onCat={setQuickCat}
                    onDuration={(m) => setQuick({ ...quick, durationMin: m })}
                    categories={categories}
                    onCancel={() => setQuick(null)}
                    onSubmit={submitQuick}
                    alignRight={dayIndex >= 4}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dialog édition */}
      {editing && (
        <EventEditDialog
          event={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={(updates) => {
            updateEvent.mutate({ id: editing.id, updates });
            setEditing(null);
          }}
          onDelete={() => {
            deleteEvent.mutate(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ── Carte de création inline (positionnée dans la colonne) ──────────────────
function QuickCreateCard({
  quick,
  title,
  onTitle,
  cat,
  onCat,
  onDuration,
  categories,
  onCancel,
  onSubmit,
  alignRight,
}: {
  quick: QuickDraft;
  title: string;
  onTitle: (v: string) => void;
  cat: string;
  onCat: (v: string) => void;
  onDuration: (m: number) => void;
  categories: { id: string; name: string; color: string }[];
  onCancel: () => void;
  onSubmit: () => void;
  alignRight: boolean;
}) {
  const start = new Date(quick.startIso);
  const top = (minutesSinceMidnight(start) / 60) * HOUR_HEIGHT;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'bg-popover text-popover-foreground border-border absolute z-30 w-60 rounded-lg border p-3 shadow-xl',
        alignRight ? 'right-1' : 'left-1'
      )}
      style={{ top: Math.max(top - 4, 4) }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })} ·{' '}
          {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <button type="button" aria-label="Fermer" className="text-muted-foreground hover:text-foreground" onClick={onCancel}>
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <Input
        autoFocus
        value={title}
        placeholder="Titre de l'événement"
        className="mb-2 h-8"
        onChange={(e) => onTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="mb-2 flex flex-wrap gap-1">
        {QUICK_DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onDuration(m)}
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs transition-colors',
              quick.durationMin === m ? 'bg-primary text-primary-foreground border-transparent' : 'border-border hover:bg-muted'
            )}
          >
            {m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}`}
          </button>
        ))}
      </div>
      {categories.length > 0 && (
        <Select value={cat} onValueChange={onCat}>
          <SelectTrigger className="mb-2 h-8 w-full">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" size="sm" disabled={!title.trim()} onClick={onSubmit}>
          Créer
        </Button>
      </div>
    </div>
  );
}

// ── Dialog édition d'un événement ───────────────────────────────────────────
function EventEditDialog({
  event,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  event: CalendarEvent;
  categories: { id: string; name: string; color: string }[];
  onClose: () => void;
  onSave: (updates: Partial<CalendarEvent>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [start, setStart] = useState(isoToLocal(event.start));
  const [end, setEnd] = useState(isoToLocal(event.end));
  const [color, setColor] = useState(event.color || DEFAULT_EVENT_COLOR);
  const [notes, setNotes] = useState(event.notes ?? '');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier l'événement</DialogTitle>
          <DialogDescription>
            {(event.recurrence ?? 'none') !== 'none' ? 'Série récurrente — la modification s\'applique à toute la série.' : 'Mets à jour cet événement.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ev-title">Titre</Label>
            <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ev-start">Début</Label>
              <Input id="ev-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-end">Fin</Label>
              <Input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {categories.length > 0 && (
            <div className="grid gap-2">
              <Label>Couleur (catégorie)</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={c.name}
                    onClick={() => setColor(c.color)}
                    className={cn('size-7 rounded-full border-2 transition', color === c.color ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c.color }}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="ev-notes">Notes</Label>
            <Textarea id="ev-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="destructive" size="lg" onClick={onDelete}>
            <Trash2 aria-hidden="true" /> Supprimer
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={!title.trim() || !start || !end}
              onClick={() => onSave({ title: title.trim(), start: localToIso(start), end: localToIso(end), color, notes: notes.trim() || undefined })}
            >
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
