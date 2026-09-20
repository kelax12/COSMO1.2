import { useT } from '@/i18n/useT';
import { formatTimeShort } from './format';

interface PeriodSummaryCardProps {
  /** Totaux des quatre plages fixes, en minutes. */
  fixedStats: { today: number; week: number; month: number; year: number };
  /** Couleur de la section active — la barre la reprend. */
  sectionColor: string;
}

/**
 * Synthèse « temps investi » sur quatre plages fixes.
 *
 * ── Maquette 91 : la valeur d'abord, sur mobile ──────────────────────────
 *
 * Le bloc rendait quatre rangées « libellé · barre · valeur », empilées. Le
 * NOMBRE y arrivait en dernier, après une barre qui ne compare que ces quatre
 * plages entre elles : une information de second ordre servie avant la donnée
 * qu'on vient chercher.
 *
 * Sous `md`, chaque plage devient une tuile de grille : valeur en `text-title`,
 * libellé en dessous, barre en pied. Au-delà, la rangée d'origine est rendue à
 * l'identique — la largeur y rend la comparaison lisible.
 *
 * Extrait de `StatisticsPage` le 2026-09-21 : la page était à 596 lignes pour
 * un plafond de 600 (`architecture.guard`), et ce bloc est une dérivation
 * autonome, avec ses propres données et son propre rendu. Un budget se respecte
 * en déplaçant, jamais en relevant la borne.
 */
const PeriodSummaryCard = ({ fixedStats, sectionColor }: PeriodSummaryCardProps) => {
  const { t } = useT('statistics');

  // Libellés courts : la colonne fait 84-120 px sur desktop, et
  // « 365 derniers jours » y était tronqué en « 365 derniers jo… ».
  const rows = [
    { label: t('summary.today'), val: fixedStats.today },
    { label: t('summary.days7'), val: fixedStats.week },
    { label: t('summary.days30'), val: fixedStats.month },
    { label: t('summary.days365'), val: fixedStats.year },
  ];
  const max = Math.max(...rows.map((r) => r.val));

  return (
    // Le filet de séparation ne vaut qu'en PILE : en grille il dessinerait des
    // traits au milieu de nulle part, d'où `[&>div]:!border-b-0` sous `md`.
    <div className="card p-4 md:p-6 mb-4 md:mb-8 grid grid-cols-2 gap-x-4 gap-y-1 [&>div]:!border-b-0 md:block md:gap-0">
      {rows.map((r, idx) => {
        const pct = max > 0 ? (r.val / max) * 100 : 0;
        const width = r.val > 0 ? Math.max(pct, 2) : 0;
        return (
          <div
            key={r.label}
            className="py-3 md:grid md:grid-cols-[minmax(84px,120px)_1fr_auto] md:items-center md:gap-4"
            style={idx < rows.length - 1 ? { borderBottom: '1px solid rgb(var(--color-border-muted))' } : undefined}
          >
            <span className="hidden md:block text-sm truncate" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              {r.label}
            </span>
            <span className="md:hidden block text-title font-bold tabular-nums tracking-tight" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {formatTimeShort(r.val)}
            </span>
            <span className="md:hidden block text-caption mt-0.5" style={{ color: 'rgb(var(--color-text-muted))' }}>
              {r.label}
            </span>
            {/* ── Barres retirées du MOBILE, arbitrage d'Axel le 2026-09-21 ──
                Elles ne comparaient que ces quatre plages ENTRE ELLES, et
                « 365 jours » écrase toujours tout : « Aujourd'hui » y rendait
                un trait de deux pixels, quelle que soit la journée. Une barre
                dont une seule valeur est jamais visible ne mesure rien.
                Elle reste sous `md`, où la rangée est large et où les quatre
                plages se lisent côte à côte. */}
            <span aria-hidden="true" className="hidden md:block h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
              <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${width}%`, backgroundColor: sectionColor }} />
            </span>
            <span className="hidden md:block text-sm font-semibold tabular-nums text-right tracking-tight" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {formatTimeShort(r.val)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default PeriodSummaryCard;
