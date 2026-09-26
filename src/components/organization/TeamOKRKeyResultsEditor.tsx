import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { KRProgressMode } from '@/modules/team-okrs';
import type { TeamProject } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

export interface KRDraft {
  id?: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  weight: number;
  /** Mig. 160 : saisi à la main, ou calculé par les tâches des projets reliés. */
  progressMode: KRProgressMode;
  projectIds: string[];
}

export const newKR = (): KRDraft => ({
  title: '',
  currentValue: 0,
  targetValue: 100,
  // Pas d'unité par défaut : « % » n'a de sens que pour une partie des KR
  // (taux, pourcentages) ; les autres (nombre, montant, durée) hériteraient
  // sinon d'un symbole faux tant que l'utilisateur ne l'efface pas lui-même.
  unit: '',
  weight: 1,
  progressMode: 'manual',
  projectIds: [],
});

interface TeamOKRKeyResultsEditorProps {
  keyResults: KRDraft[];
  onChange: (next: KRDraft[]) => void;
  projects: TeamProject[];
}

/**
 * Éditeur des résultats clés d'un objectif d'entreprise.
 *
 * Deux façons de mesurer un KR (M9) : une valeur saisie à la main, ou la part
 * de tâches terminées dans des projets reliés. La seconde rattache l'objectif
 * au travail réel, et ne demande plus à personne de recopier un chiffre.
 *
 * Pas de responsable par KR : un OKR d'équipe se rattache à des équipes, le
 * travail individuel passe par les tâches de projet (décision produit #10).
 */
const TeamOKRKeyResultsEditor = ({ keyResults, onChange, projects }: TeamOKRKeyResultsEditorProps) => {
  const { t } = useT('org');
  const setKR = (idx: number, patch: Partial<KRDraft>) =>
    onChange(keyResults.map((k, i) => (i === idx ? { ...k, ...patch } : k)));

  return (
    <>
      <div className="flex items-center justify-between">
        <Label>{t('okrModal.keyResults')}</Label>
        <Button
          type="button"
          size="sm"
          onClick={() => onChange(keyResults.length < 10 ? [...keyResults, newKR()] : keyResults)}
          disabled={keyResults.length >= 10}
          className="bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] border-0"
        >
          <Plus aria-hidden="true" /> {t('common.add')}
        </Button>
      </div>

      <div className="grid gap-3">
        {keyResults.map((kr, idx) => (
          <div key={kr.id ?? idx} className="border-border grid gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input value={kr.title} placeholder={t('okrModal.krPlaceholder')} className="h-8" onChange={(e) => setKR(idx, { title: e.target.value })} />
              {keyResults.length > 1 && (
                <Button type="button" variant="destructive" size="icon-sm" aria-label={t('common.removeKr')} onClick={() => onChange(keyResults.filter((_, i) => i !== idx))}>
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>

            <div className="inline-flex rounded-lg border border-border p-0.5 w-fit" role="group" aria-label={t('okrExec.progressModeLabel')}>
              {(['manual', 'tasks'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={kr.progressMode === mode}
                  onClick={() => setKR(idx, { progressMode: mode })}
                  className={`min-h-8 px-2.5 rounded-md text-xs ${
                    kr.progressMode === mode
                      ? 'bg-[rgb(var(--color-hover))] font-semibold text-[rgb(var(--color-text-primary))]'
                      : 'text-[rgb(var(--color-text-muted))]'
                  }`}
                >
                  {mode === 'manual' ? t('okrExec.modeManual') : t('okrExec.modeTasks')}
                </button>
              ))}
            </div>

            {kr.progressMode === 'tasks' ? (
              <div className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">{t('okrExec.linkedProjects')}</span>
                {projects.length === 0 ? (
                  <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('okrExec.noProjectToLink')}</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {projects.map((p) => {
                      const on = kr.projectIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setKR(idx, {
                            projectIds: on ? kr.projectIds.filter((x) => x !== p.id) : [...kr.projectIds, p.id],
                          })}
                          className={`min-h-8 px-2.5 rounded-full text-xs border ${
                            on
                              ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <span className="text-muted-foreground text-xs">{t('okrExec.modeTasksHint')}</span>
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>{t('okrModal.progress')}</span>
                    <span className="tabular-nums">{kr.currentValue} / {kr.targetValue} {kr.unit}</span>
                  </div>
                  <Slider
                    min={0}
                    max={Math.max(kr.targetValue, 1)}
                    step={1}
                    value={[Math.min(kr.currentValue, kr.targetValue)]}
                    onValueChange={(v) => setKR(idx, { currentValue: v[0] })}
                    className="[&_[data-slot=slider-track]]:bg-blue-200 dark:[&_[data-slot=slider-track]]:bg-blue-900/40 [&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:border-blue-500 [&_[data-slot=slider-thumb]]:bg-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label className="text-muted-foreground text-xs">{t('okrModal.target')}</Label>
                    <Input type="number" className="h-8" value={kr.targetValue} onChange={(e) => setKR(idx, { targetValue: Number(e.target.value) })} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-muted-foreground text-xs">{t('okrModal.unit')}</Label>
                    <Input className="h-8" value={kr.unit} placeholder="%" onChange={(e) => setKR(idx, { unit: e.target.value })} />
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-1 w-32">
              <Label className="text-muted-foreground text-xs" title={t('okrModal.weightHint')}>{t('okrModal.weight')}</Label>
              <Input
                type="number"
                min={1}
                max={10}
                step={1}
                className="h-8"
                value={kr.weight}
                onChange={(e) => setKR(idx, { weight: Number(e.target.value) })}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default TeamOKRKeyResultsEditor;
