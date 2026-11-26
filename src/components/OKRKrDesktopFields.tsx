import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/useT';

interface KrFields { currentValue: number; targetValue: number; unit: string; estimatedTime: number; weight: number }

/**
 * Détails d'un résultat clé : avancement (curseur), puis cible, unité, durée
 * et coefficient (sm+). Sur desktop, repliés tant que la carte n'est pas
 * survolée ou que le focus n'y est pas, comme `TeamOKRModal` ; toujours
 * ouverts sans pointeur fin. Extrait d'`OKRModalSheet` (plafond de longueur).
 */
export default function KrDetails({ kr, isEdit, onChange }: { kr: KrFields; isEdit: boolean; onChange: (patch: Partial<KrFields>) => void }) {
  const { t } = useT('okr');
  return (
    <div className="grid sm:grid-rows-[0fr] sm:opacity-0 sm:[transition:grid-template-rows_420ms_cubic-bezier(0.22,1,0.36,1),opacity_200ms_ease-out] sm:group-hover:grid-rows-[1fr] sm:group-hover:opacity-100 sm:focus-within:grid-rows-[1fr] sm:focus-within:opacity-100 [@media(hover:none)]:!grid-rows-[1fr] [@media(hover:none)]:!opacity-100">
    <div className="min-h-0 overflow-hidden grid gap-3">
      {/* Maquette 340 : à la création, on part de 0 ; pas de curseur sur mobile. */}
      <div className={`grid gap-1.5 ${isEdit ? '' : 'max-sm:hidden'}`}>
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>{t('modal.progress')}</span>
          <span className="tabular-nums">{kr.currentValue} / {kr.targetValue} {kr.unit}</span>
        </div>
        <Slider
          min={0}
          max={Math.max(kr.targetValue, 1)}
          step={1}
          value={[Math.min(kr.currentValue, kr.targetValue)]}
          onValueChange={(v) => onChange({ currentValue: v[0] })}
          className="[&_[data-slot=slider-track]]:bg-blue-200 dark:[&_[data-slot=slider-track]]:bg-blue-900/40 [&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:border-blue-500 [&_[data-slot=slider-thumb]]:bg-blue-500"
        />
      </div>
    <div className="hidden sm:grid sm:grid-cols-4 gap-2">
      <div className="grid gap-1">
        <Label className="text-muted-foreground text-xs">{t('modal.target')}</Label>
        <Input type="number" className="h-8" value={kr.targetValue} onChange={(e) => onChange({ targetValue: Number(e.target.value) })} />
      </div>
      <div className="grid gap-1">
        <Label className="text-muted-foreground text-xs">{t('modal.unit')}</Label>
        <Input className="h-8" value={kr.unit} placeholder="%" onChange={(e) => onChange({ unit: e.target.value })} />
      </div>
      <div className="grid gap-1">
        <Label className="text-muted-foreground text-xs whitespace-nowrap">{t('modal.duration')} <span className="normal-case font-normal opacity-70">{t('modal.optional')}</span></Label>
        <Input
          type="number"
          className="h-8"
          placeholder="0"
          value={kr.estimatedTime === 0 ? '' : kr.estimatedTime}
          onChange={(e) => onChange({ estimatedTime: e.target.value === '' ? 0 : Number(e.target.value) })}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-muted-foreground text-xs" title={t('modal.weightHint')}>{t('modal.weight')}</Label>
        <Input
          type="number"
          min={1}
          max={10}
          step={1}
          className="h-8"
          value={kr.weight}
          onChange={(e) => onChange({ weight: Number(e.target.value) })}
        />
      </div>
    </div>
    </div>
    </div>
  );
}
