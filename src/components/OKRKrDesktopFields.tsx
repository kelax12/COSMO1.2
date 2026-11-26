import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/useT';

interface KrFields { targetValue: number; unit: string; estimatedTime: number; weight: number }

/**
 * Cible, unité, durée et coefficient d'un résultat clé, sur desktop (sm+).
 * Extrait d'`OKRModalSheet` (plafond de longueur de fonction) ; le mobile a
 * son propre repli, `KrAdvancedMobile`.
 */
export default function KrDesktopFields({ kr, onChange }: { kr: KrFields; onChange: (patch: Partial<KrFields>) => void }) {
  const { t } = useT('okr');
  return (
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
  );
}
