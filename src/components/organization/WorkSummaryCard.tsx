import type { ReactNode } from 'react';
import { useT } from '@/i18n/useT';

interface WorkSummaryCardProps {
  /** Titre principal, ex. « 20 tâches · 90 j » ou « Mes 12 tâches assignées ». */
  title: string;
  completed: number;
  inProgress: number;
  overdue: number;
  /* ⚠️ `completionRate` a été RETIRÉ (maquette 106) : le sous-titre dit
     maintenant « X terminée(s) sur N », qui se dérive de `completed` et du
     total. Garder un pourcentage en prop, c'était garder deux définitions du
     même chiffre. */
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
  title, completed, inProgress, overdue, aside, emptyLabel,
}: WorkSummaryCardProps) => {
  const { t, tp } = useT('org');
  const total = completed + inProgress + overdue;
  const barLabel = t('summary.barLabel', { completed, inProgress, overdue });

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 sm:gap-6 items-center">
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3.5">
          <span className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{title}</span>
          {/* « 0 terminée sur 3 » plutôt que « 0 % terminées » : sur trois
              éléments, le pourcentage est une précision que personne n'a
              demandée, et il efface le nombre qu'on cherchait. */}
          {total > 0 && (
            <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0 tabular-nums">{tp('summary.completedOf', completed, { total })}</span>
          )}
        </div>

        {total === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">{emptyLabel ?? t('summary.empty')}</p>
        ) : (
          <>
            {/* ── Maquette 106 : une barre d'avancement montre l'avancement ──
                La barre était SEGMENTÉE (terminées / en cours / en retard) et
                remplissait donc toute sa largeur en permanence. Mesuré le
                2026-09-20 sur l'onglet Aperçu : « Mes 3 tâches assignées ·
                0 % terminées » s'illustrait d'une barre PLEINE, grise puis
                rouge. Une barre pleine se lit comme un avancement ; celle-ci
                était pleine alors que rien n'était fait, et sa légende disait
                le contraire d'elle.

                Elle ne porte plus que la part TERMINÉE, sur une piste neutre.
                À 0 %, elle est vide, et c'est exactement l'information.
                « En cours » et « en retard » sont des ÉTATS, pas des portions
                d'avancement : ils restent dans la légende, où le rouge garde
                son sens.

                ❌ Ne pas y remettre de segment : le jour où les trois couleurs
                reviennent dans la barre, « 0 % » redevient illisible. */}
            <div className="h-3 rounded-full overflow-hidden bg-[rgb(var(--color-border))]" role="img" aria-label={barLabel}>
              <Segment ratio={completed / total} colorClass="bg-emerald-500" />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3.5">
              <LegendDot colorClass="bg-emerald-500" label={t('summary.legendCompleted')} value={completed} />
              <LegendDot colorClass="bg-[rgb(var(--color-text-muted))]" label={t('summary.legendInProgress')} value={inProgress} />
              <LegendDot colorClass="bg-red-500" label={t('summary.legendOverdue')} value={overdue} valueClass="text-red-500" />
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
