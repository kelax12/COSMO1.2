import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { KeyResult } from '@/modules/okrs';
import { useT } from '@/i18n/useT';

/**
 * Tête mobile de la création d'objectif (maquette 335, 2026-10-11) : la même
 * que la fiche tâche, « Annuler · Nouvel objectif · Créer ». Pas de poignée :
 * la feuille Radix ne se glisse pas, et une poignée promettrait un geste (C-07).
 */
const OKRSheetMobileBar = ({ cancelLabel, submitLabel, canSubmit, onCancel, onSubmit }: {
  cancelLabel: string;
  submitLabel: string;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) => (
  <div className="sm:hidden flex items-center justify-between px-4 h-14 border-b border-[rgb(var(--color-border))]">
    <button type="button" onClick={onCancel} className="min-w-16 min-h-11 text-left text-body text-[rgb(var(--color-accent))]">
      {cancelLabel}
    </button>
    <button
      type="button"
      onClick={onSubmit}
      aria-disabled={!canSubmit}
      className={`min-w-16 min-h-11 text-right text-body font-semibold ${canSubmit ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))]'}`}
    >
      {submitLabel}
    </button>
  </div>
);

/** Minutes → `HH:MM` pour l'input natif `type="time"` (roue OS sur mobile,
 *  même pattern que TaskModalMobileBody / HabitModal). */
const minutesToTimeValue = (minutes: number | string): string => {
  const total = typeof minutes === 'number' ? minutes : Number(minutes) || 0;
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const timeValueToMinutes = (value: string): number => {
  const [h, m] = value.split(':').map((n) => Number(n) || 0);
  return h * 60 + m;
};

/**
 * Mobile (redesign 2026-09-19) : Durée + Coef. repliés derrière « Plus
 * d'options » (maquette 342), sous le résultat clé : réglages secondaires,
 * sortis du parcours par défaut. Desktop inchangé (toujours visibles).
 */
export const KrAdvancedMobile = ({ kr, open, onOpenChange, onChange }: {
  kr: KeyResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<KeyResult>) => void;
}) => {
  const { t } = useT('okr');
  return (
    <div className="sm:hidden">
      {open ? (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-muted-foreground text-xs whitespace-nowrap">{t('modal.duration')} <span className="normal-case font-normal opacity-70">{t('modal.optional')}</span></Label>
              <input
                type="time"
                aria-label={`${t('modal.duration')} (${t('modal.optional')})`}
                value={minutesToTimeValue(kr.estimatedTime)}
                onChange={(e) => onChange({ estimatedTime: timeValueToMinutes(e.target.value) })}
                className="h-8 w-3/5 min-w-0 rounded-md border px-2 text-sm border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:border-[rgb(var(--color-accent))] focus:ring-1 focus:ring-[rgb(var(--color-accent))] !bg-[rgb(var(--color-surface))]"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-muted-foreground text-xs" title={t('modal.weightHint')}>{t('modal.weight')}</Label>
              <Input
                type="number"
                min={1}
                max={10}
                step={1}
                className="h-8 w-3/5 !bg-[rgb(var(--color-surface))]"
                value={kr.weight}
                onChange={(e) => onChange({ weight: Number(e.target.value) })}
              />
            </div>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
            {t('modal.advancedFeatureHide')}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => onOpenChange(true)} className="text-sm font-semibold text-[rgb(var(--color-accent-solid))]">
          {t('modal.advancedFeature')}
        </button>
      )}
    </div>
  );
};

export default OKRSheetMobileBar;
