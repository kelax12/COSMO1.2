import { useMemo, useState } from 'react';
import { CalendarPlus, Clock, Search, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useCreateGroupEvent, useGroupEventsWindow } from '@/modules/events';
import { isMemberActive, type OrgMember } from '@/modules/organizations';
import { toast } from '@/lib/toast';
import { formatDate, formatNumber, formatTime } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import MemberAvatar from './MemberAvatar';
import { canManage } from './pyramid.helpers';
import { busyFromEvents, findCommonSlots, type Slot } from './common-slots.helpers';

interface TeamEventDialogProps {
  open: boolean;
  onClose: () => void;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  /** Participants cochés à l'ouverture (ex. les membres d'une équipe). */
  defaultParticipantIds?: string[];
  /** Couleur de l'événement (celle de l'équipe, sinon l'accent). */
  color?: string;
}

const DURATIONS = [30, 60, 90, 120] as const;
const SEARCH_DAYS = 10;

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Créer un événement d'équipe (reco UI n° 30, demande d'Axel du 2026-09-29).
 *
 * Un événement d'équipe est posé dans l'agenda de CHAQUE participant (une
 * ligne chacun, cf. `useCreateGroupEvent`). On ne peut inviter que soi et les
 * personnes qu'on encadre : c'est la règle d'écriture de la RLS (mig. 128),
 * l'écran ne propose donc que celles-là.
 *
 * « Créneaux communs » lit les agendas des participants sur dix jours ouvrés
 * et propose les premiers moments où personne n'est pris.
 */
const TeamEventDialog = ({
  open, onClose, members, currentUserId, isAdmin, defaultParticipantIds = [], color = '#6366f1',
}: TeamEventDialogProps) => {
  const { t, tp } = useT('orgAdmin');
  const eligible = useMemo(
    () => members
      .filter((m) => isMemberActive(m) && (m.userId === currentUserId || canManage(m, members, currentUserId, isAdmin)))
      .sort((a, b) => Number(b.userId === currentUserId) - Number(a.userId === currentUserId) || a.displayName.localeCompare(b.displayName)),
    [members, currentUserId, isAdmin],
  );
  const eligibleIds = useMemo(() => new Set(eligible.map((m) => m.userId)), [eligible]);

  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = defaultParticipantIds.filter((id) => eligibleIds.has(id));
    if (currentUserId && eligibleIds.has(currentUserId)) initial.push(currentUserId);
    return new Set(initial);
  });
  const skipped = defaultParticipantIds.filter((id) => !eligibleIds.has(id)).length;
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('10:00');
  const [error, setError] = useState<string | null>(null);

  // Fenêtre de recherche figée pour la durée de la modale : une clé de cache
  // qui change à chaque rendu relirait les agendas en boucle.
  const [range] = useState(() => {
    const from = new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + SEARCH_DAYS + 4);
    return { from, to, startISO: from.toISOString(), endISO: to.toISOString() };
  });
  const participantIds = useMemo(() => [...selected], [selected]);
  const { eventsByUser, isLoading, failed } = useGroupEventsWindow(participantIds, currentUserId, range.startISO, range.endISO);
  const slots = useMemo<Slot[]>(() => {
    if (participantIds.length === 0 || isLoading) return [];
    const busy = eventsByUser.map((events) => busyFromEvents(events, range.from, range.to));
    return findCommonSlots(busy, { from: range.from, days: SEARCH_DAYS, durationMin: duration });
  }, [eventsByUser, isLoading, participantIds.length, range, duration]);

  const create = useCreateGroupEvent();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pickSlot = (s: Slot) => {
    setDate(format(s.start, 'yyyy-MM-dd'));
    setTime(format(s.start, 'HH:mm'));
  };

  const visible = eligible.filter((m) => !query || normalize(m.displayName).includes(normalize(query)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(t('ui.event.errorTitle'));
    if (selected.size === 0) return setError(t('ui.event.errorPeople'));
    const start = new Date(`${date}T${time}`);
    if (Number.isNaN(start.getTime())) return setError(t('ui.event.errorDate'));
    setError(null);
    const end = new Date(start.getTime() + duration * 60_000);
    create.mutate(
      {
        userIds: participantIds,
        selfId: currentUserId,
        input: {
          title: title.trim(),
          description: description.trim() || undefined,
          start: start.toISOString(),
          end: end.toISOString(),
          color,
        },
      },
      {
        onSuccess: ({ created, failed: ko }) => {
          if (ko > 0) toast.warning(t('ui.event.partial', { created, failed: ko }));
          else toast.success(tp('ui.event.created', created));
          onClose();
        },
      },
    );
  };

  const selectedCount = selected.size;
  const fieldClass = 'w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]';
  const labelClass = 'block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          <CalendarPlus size={18} aria-hidden="true" /> {t('ui.event.title')}
        </DialogTitle>
        <DialogDescription>{t('ui.event.help')}</DialogDescription>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <label className="block">
            <span className={labelClass}>{t('ui.event.name')}</span>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null); }}
              placeholder={t('ui.event.namePlaceholder')}
              maxLength={200}
              className={fieldClass}
              autoFocus
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className={labelClass}>{tp('ui.event.participants', selectedCount)}</legend>
              <div className="relative mb-2">
                <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('ui.event.search')}
                  aria-label={t('ui.event.search')}
                  className={`${fieldClass} pl-8`}
                />
              </div>
              <ul className="max-h-52 overflow-y-auto rounded-xl border border-[rgb(var(--color-border))] divide-y divide-[rgb(var(--color-border))]">
                {visible.map((m) => (
                  <li key={m.userId}>
                    <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[rgb(var(--color-hover))]">
                      <input type="checkbox" checked={selected.has(m.userId)} onChange={() => toggle(m.userId)} className="w-4 h-4 accent-indigo-600" />
                      <MemberAvatar avatar={m.avatar} name={m.displayName} size={24} />
                      <span className="text-sm text-[rgb(var(--color-text-primary))] truncate">
                        {m.displayName}{m.userId === currentUserId ? ` ${t('ui.event.you')}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-caption text-[rgb(var(--color-text-muted))]">
                {t('ui.event.scope')}
                {skipped > 0 ? ` ${tp('ui.event.skipped', skipped)}` : ''}
              </p>
            </fieldset>

            <div className="space-y-3 min-w-0">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="team-event-date" className={labelClass}>{t('ui.event.date')}</label>
                  <DatePicker
                    id="team-event-date"
                    value={date}
                    onChange={(d) => d && setDate(d)}
                    allowClear={false}
                    minDate={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <label className="block">
                  <span className={labelClass}>{t('ui.event.time')}</span>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={900} className={fieldClass} />
                </label>
              </div>
              <div>
                <span className={labelClass}>{t('ui.event.duration')}</span>
                <div className="inline-flex rounded-xl border border-[rgb(var(--color-border))] p-0.5" role="group" aria-label={t('ui.event.duration')}>
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={duration === d}
                      onClick={() => setDuration(d)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                        duration === d
                          ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                          : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                      }`}
                    >
                      {d < 60 ? t('ui.event.minutes', { count: d }) : t('ui.event.hours', { count: formatNumber(d / 60) })}
                    </button>
                  ))}
                </div>
              </div>

              <section aria-labelledby="team-event-slots" className="rounded-xl bg-[rgb(var(--color-hover))] p-3">
                <h3 id="team-event-slots" className="flex items-center gap-1.5 text-xs font-bold text-[rgb(var(--color-text-primary))]">
                  <Sparkles size={13} aria-hidden="true" /> {t('ui.event.slotsTitle')}
                </h3>
                {selectedCount === 0 ? (
                  <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{t('ui.event.slotsNeedPeople')}</p>
                ) : isLoading ? (
                  <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{t('ui.event.slotsLoading')}</p>
                ) : slots.length === 0 ? (
                  <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{t('ui.event.slotsNone', { days: SEARCH_DAYS })}</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {slots.map((s) => {
                      const active = format(s.start, 'yyyy-MM-dd') === date && format(s.start, 'HH:mm') === time;
                      return (
                        <li key={s.start.toISOString()}>
                          <button
                            type="button"
                            onClick={() => pickSlot(s)}
                            aria-pressed={active}
                            className={`w-full flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                              active
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:border-emerald-500/60'
                            }`}
                          >
                            <Clock size={12} aria-hidden="true" />
                            <span className="font-semibold">{formatDate(s.start, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            <span className="tabular-nums">
                              {formatTime(s.start, { hour: '2-digit', minute: '2-digit' })} · {formatTime(s.end, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-2 text-caption text-[rgb(var(--color-text-muted))]">
                  {t('ui.event.slotsPrivacy')}
                  {failed > 0 ? ` ${tp('ui.event.slotsUnread', failed)}` : ''}
                </p>
              </section>
            </div>
          </div>

          <label className="block">
            <span className={labelClass}>{t('ui.event.description')}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} className={fieldClass} />
          </label>

          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]">
              {t('ui.event.cancel')}
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="h-10 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-60"
            >
              {create.isPending ? t('ui.event.creating') : tp('ui.event.submit', selectedCount)}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TeamEventDialog;
