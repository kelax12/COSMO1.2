import { format } from 'date-fns';
import { Target } from 'lucide-react';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { placeOrgEvents, type OrgEvent, type OrgEventUrgency, type PlacedOrgEvent } from './org-events.helpers';

interface OrgEventsTimelineProps {
  events: OrgEvent[];
}

/** Couleur d'une pastille : uniquement la distance à aujourd'hui. */
const TONE: Record<OrgEventUrgency, { text: string; dot: string; ring: string }> = {
  now: {
    text: 'text-[rgb(var(--color-error))]',
    dot: 'bg-[rgb(var(--color-error))]',
    ring: 'border-[rgb(var(--color-error))]',
  },
  soon: {
    text: 'text-[rgb(var(--color-accent))]',
    dot: 'bg-[rgb(var(--color-accent))]',
    ring: 'border-[rgb(var(--color-accent))]',
  },
  later: {
    text: 'text-[rgb(var(--color-text-muted))]',
    dot: 'bg-[rgb(var(--color-border-strong))]',
    ring: 'border-[rgb(var(--color-border-strong))]',
  },
};

const dayLabel = (d: Date) => format(d, 'd MMM', { locale: getDateLocale() });

/** Pastille : pleine pour une tâche, creuse pour un OKR. */
const Dot = ({ event }: { event: PlacedOrgEvent }) => {
  const tone = TONE[event.urgency];
  return event.kind === 'okr' ? (
    <span
      className={`w-3 h-3 rounded-full border-2 bg-[rgb(var(--color-surface))] ${tone.ring}`}
      aria-hidden="true"
    />
  ) : (
    <span className={`w-3 h-3 rounded-full ${tone.dot}`} aria-hidden="true" />
  );
};

/**
 * Prochains événements de l'entreprise, en rail chronologique vertical.
 *
 * Aucune position ne dépend d'une animation : `prefers-reduced-motion` ne
 * change rien au rendu (cf. garde-fou « position finale d'une animation »).
 */
const OrgEventsTimeline = ({ events }: OrgEventsTimelineProps) => {
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  const placed = placeOrgEvents(events);
  if (placed.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{tOrgAdmin('myWork.orgEvents')}</h3>
        <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
          {tpOrgAdmin('myWork.orgEventsCount', placed.length)}
        </span>
      </div>

      {/* Rail vertical à toutes les largeurs (maquette 9 A, 2026-10-02) : la
          carte vit désormais dans une demi-colonne, où la frise horizontale
          faisait se chevaucher ses libellés comme sur un téléphone. */}
      <ul className="mt-3 ml-1.5 pl-3 border-l border-[rgb(var(--color-border-strong))] space-y-3">
        {placed.map((e) => (
          <li key={e.id} className="flex items-start gap-2.5 -ml-[19px]">
            <span className="mt-1 shrink-0">
              <Dot event={e} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className={`text-caption font-semibold shrink-0 ${TONE[e.urgency].text}`}>{dayLabel(e.date)}</span>
                <span className="text-sm text-[rgb(var(--color-text-primary))] truncate">{e.name}</span>
              </div>
              {e.kind === 'okr' ? (
                <span className="inline-flex items-center gap-1 text-caption font-semibold text-[rgb(var(--color-text-muted))]">
                  <Target size={10} aria-hidden="true" /> OKR
                </span>
              ) : e.projectName ? (
                <span className="text-caption text-[rgb(var(--color-text-muted))]">{e.projectName}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OrgEventsTimeline;
