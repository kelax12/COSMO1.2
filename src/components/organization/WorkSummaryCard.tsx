import type { ReactNode } from 'react';

interface WorkSummaryCardProps {
  /** Titre principal, ex. « 20 tâches · 90 j » ou « Mes 12 tâches assignées ». */
  title: string;
  completed: number;
  inProgress: number;
  overdue: number;
  /** Taux de complétion 0..100 → sous-titre « X% terminées ». */
  completionRate: number;
  /** Colonne de droite : anneau OKR (Statistiques) ou prochaine échéance (Aperçu). */
  aside: ReactNode;
  /** Message affiché quand il n'y a aucune tâche. */
  emptyLabel?: string;
}

const clamp = (r: number) => Math.max(0, Math.min(1, r));

/** Un segment de la barre : largeur proportionnelle, couleur dédiée. */
const Segment = ({ ratio, colorClass }: { ratio: number; colorClass: string }) =>
  ratio > 0 ? <span className={colorClass} style={{ width: `${clamp(ratio) * 100}%` }} /> : null;

/** Pastille de légende + libellé + valeur. */
const LegendDot = ({ colorClass, label, value, valueClass }: {
  colorClass: string; label: string; value: number; valueClass?: string;
}) => (
  <div className="flex items-center gap-1.5">
    <span className={`w-2.5 h-2.5 rounded-[3px] shrink-0 ${colorClass}`} aria-hidden="true" />
    <span className="text-xs text-[rgb(var(--color-text-secondary))]">
      <span className={`font-semibold ${valueClass ?? 'text-[rgb(var(--color-text-primary))]'}`}>{value}</span>{' '}
      {label}
    </span>
  </div>
);

/**
 * Anneau de progression (0..100), pattern repris d'OKRCard : track neutre +
 * arc en couleur d'accent. Valeur centrée.
 */
export const ProgressRing = ({ value, label }: { value: number; label: string }) => {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[72px] h-[72px]">
        <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} stroke="rgb(var(--color-border-muted))" strokeWidth="8" fill="none" />
          <circle
            cx="40" cy="40" r={r} stroke="rgb(var(--color-accent))" strokeWidth="8" fill="none"
            strokeLinecap="round" strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - pct / 100)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold text-[rgb(var(--color-text-primary))] tabular-nums">{pct}%</span>
        </div>
      </div>
      <span className="text-xs text-[rgb(var(--color-text-secondary))] mt-1.5">{label}</span>
    </div>
  );
};

/**
 * Carte de synthèse « progress-first » (concept 3) — barre segmentée
 * terminées / en cours / en retard comme élément héros, flanquée d'un
 * indicateur latéral (`aside`). Purement présentational : toutes les valeurs
 * sont calculées par l'appelant. Partagée entre les onglets Aperçu et
 * Statistiques du mode entreprise.
 */
const WorkSummaryCard = ({
  title, completed, inProgress, overdue, completionRate, aside, emptyLabel,
}: WorkSummaryCardProps) => {
  const total = completed + inProgress + overdue;
  const barLabel = `${completed} terminée${completed > 1 ? 's' : ''}, ${inProgress} en cours, ${overdue} en retard`;

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 sm:gap-6 items-center">
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3.5">
          <span className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{title}</span>
          {total > 0 && (
            <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0 tabular-nums">{completionRate}% terminées</span>
          )}
        </div>

        {total === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">{emptyLabel ?? 'Aucune donnée.'}</p>
        ) : (
          <>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5" role="img" aria-label={barLabel}>
              <Segment ratio={completed / total} colorClass="bg-emerald-500" />
              <Segment ratio={inProgress / total} colorClass="bg-[rgb(var(--color-text-muted))]" />
              <Segment ratio={overdue / total} colorClass="bg-red-500" />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3.5">
              <LegendDot colorClass="bg-emerald-500" label="terminées" value={completed} />
              <LegendDot colorClass="bg-[rgb(var(--color-text-muted))]" label="en cours" value={inProgress} />
              <LegendDot colorClass="bg-red-500" label="en retard" value={overdue} valueClass="text-red-500" />
            </div>
          </>
        )}
      </div>

      <div className="border-t sm:border-t-0 sm:border-l border-[rgb(var(--color-border))] pt-4 sm:pt-0 sm:pl-6 flex justify-center">
        {aside}
      </div>
    </div>
  );
};

export default WorkSummaryCard;
