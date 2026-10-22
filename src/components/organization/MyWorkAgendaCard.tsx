import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import type { CalendarEvent } from '@/modules/events';
import { useT } from '@/i18n/useT';
import { dayTimeline, groupEventsByDay } from './agenda-events.helpers';

// Sorti de `MyWorkTab` le 2026-10-20 : rendu par le widget « Mon agenda »,
// il vit dans le chunk paresseux `MyWorkSections` et plus dans
// `OrganizationPage` (plafond C-85 dépassé de 1,1 ko).

/**
 * Frise de la journée (maquette 5 B, 2026-10-02) : mes rendez-vous du jour
 * posés sur une règle horaire, « maintenant » en trait rouge. On voit d'un
 * coup d'œil où sont les trous pour travailler.
 */
const DayTimelineStrip = ({ events }: { events: CalendarEvent[] }) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const { fromHour, toHour, blocks, now } = dayTimeline(events);
  const mid = Math.round((fromHour + toHour) / 2);
  return (
    <div>
      <div className="relative h-12 rounded-lg bg-[rgb(var(--color-hover))]">
        <ul aria-label={tOrgAdmin('myWork.agendaToday')}>
          {blocks.map(({ event, left, width }) => (
            <li
              key={event.id}
              className="absolute top-1.5 bottom-1.5 min-w-0 rounded-md px-1.5 flex items-center overflow-hidden text-[11px] font-semibold text-white"
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: event.color || 'rgb(var(--color-accent))' }}
              title={`${format(parseISO(event.start), 'HH:mm')} · ${event.title}`}
            >
              <span className="truncate">{event.title}</span>
            </li>
          ))}
        </ul>
        {now !== null && (
          <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-red-500" style={{ left: `${now}%` }} aria-hidden="true" />
        )}
      </div>
      <div className="flex justify-between mt-1 text-caption tabular-nums text-[rgb(var(--color-text-muted))]" aria-hidden="true">
        <span>{fromHour} h</span><span>{mid} h</span><span>{toHour} h</span>
      </div>
    </div>
  );
};

/**
 * Mon agenda — événements à venir de MON calendrier personnel (module
 * `events`), pas les échéances de tâches d'équipe : celles-ci vivent dans le
 * rail « Prochains événements d'entreprise » plus bas.
 *
 * Aujourd'hui en frise horaire (maquette 5 B), les jours suivants en liste
 * groupée par jour sous la frise : la frise ne sait montrer qu'une journée.
 */
export const AgendaEventsCard = ({ events }: { events: CalendarEvent[] }) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const allGroups = groupEventsByDay(events);
  const today = allGroups.find((g) => g.isToday);
  const groups = allGroups.filter((g) => !g.isToday);
  return (
    // `min-w-0` : second enfant de la même grille que « Mes tâches », donc
    // même borne `min-width: auto` à lever (cf. maquette 105 juste en dessous).
    <div data-testid="org-agenda-card" className="min-w-0 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:py-2">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
        {tOrgAdmin('myWork.agendaSection')}
      </h3>
      <p className="text-label font-semibold mb-1.5 text-[rgb(var(--color-text-secondary))]">
        {tOrgAdmin('myWork.agendaToday')}
      </p>
      {today ? (
        <>
          {/* Maquette 232 : sur mobile, une liste ; la frise 8 h – 20 h
              tronquait l'événement du soir en « S… ». Desktop garde la frise. */}
          <div className="hidden md:block"><DayTimelineStrip events={today.events} /></div>
          <ul className="md:hidden">
            {today.events.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 min-h-touch border-b last:border-b-0 border-[rgb(var(--color-border))]">
                <span className="w-11 shrink-0 text-label tabular-nums text-[rgb(var(--color-text-secondary))]">{format(parseISO(e.start), 'HH:mm', { locale: getDateLocale() })}</span>
                <span className="h-4 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: e.color || 'rgb(var(--color-accent))' }} aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-body text-[rgb(var(--color-text-primary))]">{e.title}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-2">{tOrgAdmin('apercu.agendaFreeToday')}</p>
      )}
      {groups.length === 0 ? (
        !today && <p className="text-xs text-[rgb(var(--color-text-muted))] pt-1">{tOrgAdmin('myWork.agendaEmpty')}</p>
      ) : (
        <div className="space-y-3 mt-3">
          {groups.map((group) => (
            <div key={group.dayKey}>
              <div className="text-label font-semibold mb-1.5 text-[rgb(var(--color-text-secondary))]">
                {group.isToday ? (
                  tOrgAdmin('myWork.agendaToday')
                ) : (
                  // Maquette 233 : « dim. 18 oct. ». `capitalize` mettait une capitale à
                  // CHAQUE mot (« Dimanche 18 Oct. »).
                  <span>{format(group.date, 'EEE d MMM', { locale: getDateLocale() })}</span>
                )}
              </div>
              <ul className="space-y-1">
                {group.events.map((e) => {
                  const start = parseISO(e.start);
                  return (
                    <li key={e.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-[rgb(var(--color-hover))]">
                      <span className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] w-11 shrink-0">
                        {format(start, 'HH:mm', { locale: getDateLocale() })}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: e.color || 'rgb(var(--color-accent))' }}
                        aria-hidden="true"
                      />
                      <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{e.title}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

