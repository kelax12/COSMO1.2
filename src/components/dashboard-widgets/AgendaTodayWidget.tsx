import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useEvents, expandRecurringEvents } from '@/modules/events';
import { formatTime } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { DashboardCardSkeleton } from '@/components/skeletons';

const DEFAULT_COLOR = '#3B82F6';

/**
 * Agenda du jour (widget du tableau de bord perso, 2026-10-21) : les
 * rendez-vous d'aujourd'hui dans l'ordre, récurrences comprises. Ceux déjà
 * passés s'estompent, le prochain est signalé.
 */
const AgendaTodayWidget = () => {
  const { t, tp } = useT('dashboard');
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useEvents();

  const today = useMemo(() => {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    return expandRecurringEvents(events, from, to)
      .filter((e) => new Date(e.start) < to && new Date(e.end) > from)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [events]);

  if (isLoading && events.length === 0) return <DashboardCardSkeleton />;

  const now = new Date();
  const nextId = today.find((e) => new Date(e.start) >= now)?.id;
  const hm = (iso: string) => formatTime(new Date(iso), { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
      <div className="mb-3">
        <h2 className="text-headline sm:text-lg font-bold text-[rgb(var(--color-text-primary))]">{t('widgets.names.agenda')}</h2>
        <p className="text-label sm:text-sm text-[rgb(var(--color-text-secondary))]">{tp('dw.agenda.count', today.length)}</p>
      </div>

      {today.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('dw.agenda.empty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {today.map((e) => {
            const past = new Date(e.end) < now;
            const isNext = e.id === nextId;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => navigate('/agenda')}
                  className={`w-full min-h-touch flex items-center gap-3 px-2 rounded-xl text-left transition-colors hover:bg-[rgb(var(--color-hover))] ${past ? 'opacity-60' : ''}`}
                >
                  <span className="w-[5.5rem] shrink-0 text-xs tabular-nums text-[rgb(var(--color-text-secondary))]">
                    {hm(e.start)} – {hm(e.end)}
                  </span>
                  <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full" style={{ backgroundColor: e.color || DEFAULT_COLOR }} />
                  <span className={`flex-1 min-w-0 truncate text-sm font-medium text-[rgb(var(--color-text-primary))] ${past ? 'line-through' : ''}`}>
                    {e.title}
                  </span>
                  {isNext && (
                    <span className="shrink-0 rounded-full bg-[rgb(var(--color-accent)/0.12)] px-2 py-0.5 text-xs font-semibold text-[rgb(var(--color-accent))]">
                      {t('dw.agenda.next')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AgendaTodayWidget;
