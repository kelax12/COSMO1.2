import { useT } from '@/i18n/useT';
import { formatDurationMinutes } from '@/lib/duration';
import { periodDelta } from './period-delta';

interface Props {
  /** Minutes de la période choisie (Jour, 7, 30 ou 365 jours glissants). */
  current: number;
  /** Minutes de la période précédente, de même longueur. */
  previous: number;
  /** « 7 derniers jours », etc. */
  periodLabel: string;
}

/**
 * Maquette 194 (2026-10-10), MOBILE : un grand nombre pour la période choisie,
 * et son écart à la période précédente.
 *
 * Avant : une grille 2 × 2 (aujourd'hui, 7 j, 30 j, 365 j) au-dessus d'un
 * sélecteur Jour / Semaine / Mois / Année qui disait la même chose. Le
 * sélecteur commande maintenant ce nombre ; la grille reste sur desktop
 * (`PeriodSummaryCard`).
 */
const MobilePeriodTotal = ({ current, previous, periodLabel }: Props) => {
  const { t } = useT('statistics');
  const delta = periodDelta(current, previous);
  return (
    <div className="md:hidden mb-2">
      <p className="flex items-baseline gap-2">
        <span className="text-display font-bold tabular-nums tracking-tight text-[rgb(var(--color-text-primary))]">
          {formatDurationMinutes(current)}
        </span>
        <span className="text-label text-[rgb(var(--color-text-secondary))]">{periodLabel}</span>
      </p>
      <p className="text-label text-[rgb(var(--color-text-muted))]">
        {delta.kind === 'none'
          ? t('delta.noBase')
          : delta.kind === 'same'
            ? t('delta.same')
            : t(delta.kind === 'up' ? 'delta.up' : 'delta.down', { pct: delta.pct })}
      </p>
    </div>
  );
};

export default MobilePeriodTotal;
