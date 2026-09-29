import { useMemo, useState } from 'react';
import { Check, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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

type Step = 0 | 1 | 2;

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
 * Assistant en trois étapes (maquette 1 du 2026-09-29) : Qui, Quand, Détails.
 * « Quand » lit les agendas des participants sur dix jours ouvrés et propose
 * les premiers moments où personne n'est pris ; « Autre heure » ouvre la
 * saisie libre.
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
  const [step, setStep] = useState<Step>(0);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('10:00');
  const [customTime, setCustomTime] = useState(false);
  const [slotPicked, setSlotPicked] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);
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

  const toggle = (id: string) => {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickSlot = (s: Slot) => {
    setDate(format(s.start, 'yyyy-MM-dd'));
    setTime(format(s.start, 'HH:mm'));
    setCustomTime(false);
    setSlotPicked(true);
    setError(null);
  };

  const visible = eligible.filter((m) => !query || normalize(m.displayName).includes(normalize(query)));

  const startDate = () => {
    const start = new Date(`${date}T${time}`);
    return Number.isNaN(start.getTime()) ? null : start;
  };

  const goTo = (s: Step) => {
    setError(null);
    setStep(s);
  };

  // Chaque étape valide ce qu'elle demande : l'erreur s'affiche là où elle se corrige.
  const next = () => {
    if (step === 0 && selected.size === 0) return setError(t('ui.event.errorPeople'));
    if (step === 1 && !slotPicked && !customTime) return setError(t('ui.event.errorSlot'));
    if (step === 1 && !startDate()) return setError(t('ui.event.errorDate'));
    if (step === 1 && !(duration >= 5 && duration <= 720)) return setError(t('ui.event.errorDuration'));
    goTo(step === 0 ? 1 : 2);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Entrée dans un champ des deux premières étapes avance, elle ne crée pas.
    if (step < 2) return next();
    if (!title.trim()) return setError(t('ui.event.errorTitle'));
    if (selected.size === 0) { setStep(0); return setError(t('ui.event.errorPeople')); }
    const start = startDate();
    if (!start) { setStep(1); return setError(t('ui.event.errorDate')); }
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
  const accentOn = 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent-solid)/0.1)] text-[rgb(var(--color-accent-solid))]';
  const durationLabel = (d: number) => (d < 60 ? t('ui.event.minutes', { count: d }) : t('ui.event.hours', { count: formatNumber(d / 60) }));
  const steps = [
    { label: t('ui.event.stepWho'), hint: selectedCount > 0 ? formatNumber(selectedCount) : null },
    { label: t('ui.event.stepWhen'), hint: null },
    { label: t('ui.event.stepDetails'), hint: null },
  ];
  const chosen = startDate();
  const showCustom = customTime;
  const chosenMembers = eligible.filter((m) => selected.has(m.userId));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[39rem] max-h-[90vh] sm:max-h-[83vh] sm:[zoom:1.08] overflow-y-auto" aria-describedby={undefined}>
        <DialogTitle>{t('ui.event.title')}</DialogTitle>

        <ol className="flex items-center gap-2" aria-label={t('ui.event.stepOf', { step: step + 1, total: steps.length })}>
          {steps.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.label} className="flex items-center gap-2 flex-1 last:flex-none" aria-current={current ? 'step' : undefined}>
                <button
                  type="button"
                  onClick={() => done && goTo(i as Step)}
                  disabled={!done}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                    current || done ? accentOn : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]'
                  } ${done ? 'cursor-pointer hover:bg-[rgb(var(--color-accent-solid)/0.18)]' : 'cursor-default'}`}
                >
                  {done ? <Check size={12} aria-hidden="true" /> : <span aria-hidden="true">{i + 1}</span>}
                  {s.label}
                  {done && s.hint ? <span className="tabular-nums">· {s.hint}</span> : null}
                </button>
                {i < steps.length - 1 && (
                  <span aria-hidden="true" className={`h-px flex-1 ${done ? 'bg-[rgb(var(--color-accent-solid))]' : 'bg-[rgb(var(--color-border))]'}`} />
                )}
              </li>
            );
          })}
        </ol>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {step === 0 && (
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
                  autoFocus
                />
              </div>
              <ul className="max-h-72 overflow-y-auto rounded-xl border border-[rgb(var(--color-border))] divide-y divide-[rgb(var(--color-border))]">
                {visible.map((m) => (
                  <li key={m.userId}>
                    <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[rgb(var(--color-hover))]">
                      <span className="relative inline-flex shrink-0">
                        <input
                          type="checkbox"
                          checked={selected.has(m.userId)}
                          onChange={() => toggle(m.userId)}
                          className="peer appearance-none w-[18px] h-[18px] rounded-full border-2 border-[rgb(var(--color-border))] checked:border-[rgb(var(--color-accent-solid))] checked:bg-[rgb(var(--color-accent-solid))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--color-accent-solid))] cursor-pointer"
                        />
                        <Check size={12} strokeWidth={3} aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto hidden peer-checked:block text-[rgb(var(--color-accent-solid-foreground))]" />
                      </span>
                      <MemberAvatar avatar={m.avatar} name={m.displayName} size={24} />
                      <span className="text-sm text-[rgb(var(--color-text-primary))] truncate">
                        {m.displayName}{m.userId === currentUserId ? ` ${t('ui.event.you')}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {skipped > 0 && (
                <p className="mt-1.5 text-caption text-[rgb(var(--color-text-muted))]">{tp('ui.event.skipped', skipped)}</p>
              )}
            </fieldset>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[rgb(var(--color-text-secondary))]">{t('ui.event.duration')}</span>
                <div className="inline-flex rounded-xl border border-[rgb(var(--color-border))] p-0.5" role="group" aria-label={t('ui.event.duration')}>
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={!customDuration && duration === d}
                      onClick={() => { setCustomDuration(false); setDuration(d); setError(null); }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                        !customDuration && duration === d
                          ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                          : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                      }`}
                    >
                      {durationLabel(d)}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={customDuration}
                    onClick={() => setCustomDuration(true)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                      customDuration
                        ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                        : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                    }`}
                  >
                    {t('ui.event.customDuration')}
                  </button>
                </div>
                {customDuration && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-secondary))]">
                    <input
                      type="number"
                      min={5}
                      max={720}
                      step={5}
                      value={duration}
                      onChange={(e) => { setDuration(Number(e.target.value)); setError(null); }}
                      aria-label={t('ui.event.durationMinutes')}
                      className="w-20 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2 py-1.5 text-sm text-[rgb(var(--color-text-primary))] tabular-nums"
                      autoFocus
                    />
                    {t('ui.event.minutesUnit')}
                  </label>
                )}
              </div>

              <section aria-labelledby="team-event-slots">
                <h3 id="team-event-slots" className="text-xs font-bold text-[rgb(var(--color-text-primary))] mb-2">
                  {t('ui.event.slotsTitle')}
                </h3>
                {isLoading ? (
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('ui.event.slotsLoading')}</p>
                ) : (
                  <>
                    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {slots.map((s) => {
                        const active = slotPicked && !customTime && format(s.start, 'yyyy-MM-dd') === date && format(s.start, 'HH:mm') === time;
                        return (
                          <li key={s.start.toISOString()}>
                            <button
                              type="button"
                              onClick={() => pickSlot(s)}
                              aria-pressed={active}
                              className={`w-full h-full rounded-xl border px-3 py-2 text-left ${
                                active
                                  ? accentOn
                                  : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent-solid)/0.6)]'
                              }`}
                            >
                              <span className="block text-xs font-semibold capitalize">{formatDate(s.start, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                              <span className="block text-xs tabular-nums">
                                {formatTime(s.start, { hour: '2-digit', minute: '2-digit' })} · {formatTime(s.end, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      <li>
                        <button
                          type="button"
                          onClick={() => { setCustomTime(true); setError(null); }}
                          aria-pressed={showCustom}
                          className={`w-full h-full min-h-[3rem] rounded-xl border border-dashed px-3 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                            showCustom
                              ? 'border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid))]'
                              : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                          }`}
                        >
                          <Clock size={13} aria-hidden="true" /> {t('ui.event.otherTime')}
                        </button>
                      </li>
                    </ul>
                    {slots.length === 0 && (
                      <p className="mt-2 text-xs text-[rgb(var(--color-text-muted))]">{t('ui.event.slotsNone', { days: SEARCH_DAYS })}</p>
                    )}
                  </>
                )}
              </section>

              {showCustom && (
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
                    <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(null); }} step={900} className={fieldClass} />
                  </label>
                </div>
              )}

              {failed > 0 && (
                <p className="text-caption text-[rgb(var(--color-text-muted))]">{tp('ui.event.slotsUnread', failed)}</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <ul className="flex flex-wrap items-center gap-1.5">
                {chosen && (
                  <li className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--color-hover))] px-3 py-1.5 text-xs text-[rgb(var(--color-text-secondary))]">
                    <Clock size={13} aria-hidden="true" />
                    {t('ui.event.summary', {
                      date: formatDate(chosen, { weekday: 'long', day: 'numeric', month: 'long' }),
                      time: formatTime(chosen, { hour: '2-digit', minute: '2-digit' }),
                      duration: durationLabel(duration),
                    })}
                  </li>
                )}
                {chosenMembers.map((m) => (
                  <li key={m.userId} className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-hover))] py-1 pl-1 pr-2.5 text-xs text-[rgb(var(--color-text-secondary))]">
                    <MemberAvatar avatar={m.avatar} name={m.displayName} size={20} />
                    {m.userId === currentUserId ? t('ui.event.me') : m.displayName}
                  </li>
                ))}
              </ul>
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
              <label className="block">
                <span className={labelClass}>{t('ui.event.description')}</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className={fieldClass} />
              </label>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={step === 0 ? onClose : () => goTo(step === 2 ? 1 : 0)}
              className="h-10 px-4 rounded-xl text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
            >
              {step === 0 ? t('ui.event.cancel') : t('ui.event.back')}
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="h-10 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-60"
            >
              {step < 2 ? t('ui.event.next') : create.isPending ? t('ui.event.creating') : tp('ui.event.submit', selectedCount)}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TeamEventDialog;
