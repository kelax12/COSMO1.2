// Créer / Éditer un OKR — Sheet latéral shadcn (repris de la version test).
// Props alignées sur l'ancien OKRModal (isOpen / onClose) pour un remplacement
// transparent dans OKRPage. Réutilise getProgress ; aucune logique métier nouvelle.
import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUpDown } from 'lucide-react';
import ColorSettingsModal from './ColorSettingsModal';
import AddCategoryButton from './AddCategoryButton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import CategoryTreeSelect from '@/components/category/CategoryTreeSelect';
import { SectionCard, CellSeparator, Cell } from '@/components/task-modal/primitives';
import type { Category } from '@/modules/categories';
import type { KeyResult } from '@/modules/okrs';
import { getProgress, type Objective } from '@/pages/okr/okr-page-logic';
import { useT } from '@/i18n/useT';

interface OKRModalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  editingObjective: Objective | null;
  onSubmit: (data: Omit<Objective, 'id'>, isEditing: boolean) => void;
}

interface KRDraft {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  estimatedTime: number;
  completed: boolean;
  completedAt?: string | null;
  weight: number;
}

const newKR = (): KRDraft => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `kr-${Date.now()}-${Math.random()}`,
  title: '',
  currentValue: 0,
  targetValue: 100,
  // Pas d'unité par défaut (cf. TeamOKRModal, même raison) — « % » n'a de
  // sens que pour une partie des KR.
  unit: '',
  estimatedTime: 0,
  completed: false,
  weight: 1,
});

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

const todayIso = () => new Date().toISOString();
const plusDaysIso = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };
const toDateInput = (iso: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const fromDateInput = (v: string) => (v ? new Date(v + 'T00:00:00').toISOString() : '');

export default function OKRModalSheet({ isOpen, onClose, categories, editingObjective, onSubmit }: OKRModalSheetProps) {
  const { t, tp } = useT('okr');
  const { t: tCommon } = useT('common');
  const isEdit = !!editingObjective;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyResults, setKeyResults] = useState<KRDraft[]>([newKR()]);
  const [showColorSettings, setShowColorSettings] = useState(false);
  // Repli mobile de la description (redesign 2026-09-19, cf. TaskModalMobileBody) :
  // masquée tant qu'elle est vide, auto-affichée si l'objectif édité en a déjà
  // une. Desktop inchangé (toujours visible).
  const [showDescriptionMobile, setShowDescriptionMobile] = useState(false);
  // Repli mobile de Durée/Coef. par KR (redesign 2026-09-19) derrière
  // « Fonctionnalité avancée » — un Set plutôt qu'un booléen unique : chaque
  // résultat clé garde son propre état de repli. Desktop inchangé (toujours
  // visibles dans la grille à 4 colonnes).
  const [advancedKrIds, setAdvancedKrIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    if (editingObjective) {
      setTitle(editingObjective.title);
      setDescription(editingObjective.description ?? '');
      setCategory(editingObjective.category ?? '');
      setEndDate(toDateInput(editingObjective.endDate));
      setKeyResults(
        editingObjective.keyResults.length
          ? editingObjective.keyResults.map((k) => ({ ...k, weight: k.weight ?? 1, completedAt: k.completedAt ?? undefined }))
          : [newKR()]
      );
      setShowDescriptionMobile(!!editingObjective.description?.trim());
    } else {
      setTitle('');
      setDescription('');
      setCategory(categories[0]?.id ?? '');
      setEndDate(toDateInput(plusDaysIso(90)));
      setKeyResults([newKR()]);
      setShowDescriptionMobile(false);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    `categories` omis : il ne sert qu a choisir une categorie PAR DEFAUT a
       la creation. L ajouter reecrirait le formulaire sous la personne a
       chaque refetch de categories, y compris apres qu elle a choisi. */
  }, [isOpen, editingObjective]);

  const setKR = (id: string, patch: Partial<KRDraft>) =>
    setKeyResults((prev) => prev.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  const moveKR = (from: number, to: number) => {
    if (to < 0 || from === to) return;
    setKeyResults((prev) => {
      if (to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  // Un objectif sans résultat clé n'est pas mesurable : au moins 1 KR nommé requis.
  const hasKeyResult = keyResults.some((k) => k.title.trim().length > 0);
  const canSave = title.trim().length > 0 && hasKeyResult;
  // Badge mobile à côté de « Résultats clés » (redesign 2026-09-19) : ne
  // compte que les KR effectivement nommés, comme `hasKeyResult`.
  const filledKrCount = keyResults.filter((k) => k.title.trim().length > 0).length;

  const handleSave = () => {
    if (!canSave) return;
    const krs: KeyResult[] = keyResults
      .filter((k) => k.title.trim())
      .map((k) => ({
        id: k.id,
        title: k.title.trim(),
        currentValue: Number(k.currentValue) || 0,
        targetValue: Number(k.targetValue) || 0,
        unit: k.unit || '',
        completed: (Number(k.currentValue) || 0) >= (Number(k.targetValue) || 0) && (Number(k.targetValue) || 0) > 0,
        estimatedTime: Number(k.estimatedTime) || 0,
        completedAt: k.completedAt ?? null,
        weight: Math.min(10, Math.max(1, Math.round(Number(k.weight) || 1))),
      }));
    onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        category,
        // `getProgress` rend volontairement une moyenne BRUTE (un KR
        // sur-atteint peut la faire dépasser 100, cf. okr-page-logic.test.ts) :
        // c'est le bon calcul pour l'AFFICHAGE, mais `updateOKRSchema` borne
        // `progress` à [0, 100] (okr.schema.ts). Sans ce clamp, sauvegarder
        // N'IMPORTE QUELLE modification d'un OKR dont un KR dépasse sa cible
        // échouait avec « La progression doit être entre 0 et 100 » — y
        // compris repousser sa deadline pour le rouvrir.
        progress: Math.min(100, getProgress(krs)),
        completed: editingObjective?.completed ?? false,
        keyResults: krs,
        // Date de début non éditable : aujourd'hui à la création, préservée en édition.
        startDate: editingObjective?.startDate || todayIso(),
        endDate: fromDateInput(endDate) || plusDaysIso(90),
      },
      isEdit
    );
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Plein écran sur mobile (redesign 2026-09-19), desktop inchangé
          (sheet latérale). Coin haut arrondi (2e retouche) — un plein écran
          à angle droit collait directement sous la barre de statut du
          téléphone, transition brutale ; même traitement que le coin
          arrondi de TaskModalMobileBody (`rounded-t-3xl`). */}
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 border-0 rounded-t-3xl sm:rounded-tr-none sm:rounded-tl-2xl sm:rounded-bl-2xl sm:max-w-lg sm:border-l-0 overflow-hidden"
        // Croix de fermeture agrandie sur mobile (2026-09-19), desktop inchangé.
        closeButtonClassName="max-sm:top-5 max-sm:right-5 max-sm:p-1"
        closeIconClassName="max-sm:size-6"
      >
        <SheetHeader>
          {/* Titre agrandi sur mobile (redesign 2026-09-19), desktop inchangé. */}
          <SheetTitle className="max-sm:text-xl">{isEdit ? t('card.editObjective') : t('page.newObjective')}</SheetTitle>
          <SheetDescription>{t('modal.description')}</SheetDescription>
        </SheetHeader>

        {/* min-h-0 : sans lui, l'enfant flex-1 garde sa hauteur de contenu et le
            viewport Radix ne scrolle jamais (flexbox min-height:auto). */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="grid gap-4 px-4 pb-4">
            <div className="grid gap-2">
              <Label htmlFor="okr-title">{t('modal.objective')}</Label>
              <Input
                id="okr-title"
                value={title}
                autoFocus
                placeholder={t('modalSheet.titlePlaceholder')}
                onChange={(e) => setTitle(e.target.value)}
                // Fond éclairci et taille agrandie sur mobile (redesign
                // 2026-09-19) : `bg-transparent` se confondait avec le fond du
                // sheet, comme l'input « Choix catégorie »
                // (`bg-[rgb(var(--color-surface))]`) juste en dessous. Desktop
                // inchangé.
                className="max-sm:!bg-[rgb(var(--color-surface))] max-sm:h-12 max-sm:text-lg"
              />
            </div>

            {/* Desktop (sm+, inchangé) : grille de deux champs encadrés. */}
            <div className="hidden sm:grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>{t('modal.category')}</Label>
                  {/* Créer une catégorie sans quitter le modal (pattern unifié). */}
                  <AddCategoryButton onClick={() => setShowColorSettings(true)} />
                </div>
                <CategoryTreeSelect value={category} onChange={setCategory} categories={categories} />
              </div>
              <div className="grid gap-2">
                <Label>{t('modal.deadline')}</Label>
                <DatePicker value={endDate} onChange={setEndDate} displayFormat="d MMMM yyyy" allowClear={false} />
              </div>
            </div>

            {/* Mobile (redesign 2026-09-19) : catégorie + échéance en lignes
                « cellule » dans une carte, pattern repris de
                TaskModalMobileBody (task-modal/primitives) — remplace la
                grille de deux champs encadrés. Desktop inchangé ci-dessus. */}
            {/* Espacement resserré (2026-09-19, 2e passe) : `pt-2` au lieu de
                `pt-5` (moins d'écart avec le champ Objectif au-dessus), et la
                carte juste en dessous colle à cette ligne (`-mt-4` annule le
                `gap-4` du parent — ne reste que le `pb-1` de la ligne). */}
            <div className="sm:hidden flex items-center justify-between px-4 pb-1 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                {t('modal.detailsSection')}
              </span>
              <AddCategoryButton onClick={() => setShowColorSettings(true)} />
            </div>
            <SectionCard className="sm:hidden max-sm:-mt-4">
              <CategoryTreeSelect
                value={category}
                onChange={setCategory}
                categories={categories}
                cellLabel={t('modal.category')}
              />
              <CellSeparator />
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                displayFormat="d MMMM yyyy"
                allowClear={false}
                cellLabel={t('modal.deadline')}
              />
            </SectionCard>

            {/* Desktop (sm+, inchangé) : champ toujours visible. */}
            <div className="hidden sm:grid gap-2">
              <Label htmlFor="okr-desc">{t('modal.descriptionLabel')}</Label>
              <Textarea
                id="okr-desc"
                rows={2}
                value={description}
                placeholder="Facultatif…"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Mobile (redesign 2026-09-19, resserré) : même carte « cellule »
                que Catégorie/Échéance ci-dessus — repliée derrière un lien
                tant qu'elle est vide, comme TaskModalMobileBody. Label
                propre (pas `SectionTitle`, dont le `pt-5` intégré double
                l'écart déjà posé par le `-mt-2` ci-dessous) pour resserrer
                l'espace avec la carte Catégorie/Échéance au-dessus. */}
            <div className="sm:hidden max-sm:-mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-1">
                {t('modal.descriptionLabel')}
              </p>
              <SectionCard>
                {showDescriptionMobile ? (
                  <div className="px-4 py-3">
                    <Textarea
                      id="okr-desc-mobile"
                      rows={2}
                      autoFocus={!description}
                      value={description}
                      placeholder="Facultatif…"
                      onChange={(e) => setDescription(e.target.value)}
                      // `no-input-chrome` (index.css) : classe dédiée aux
                      // champs imbriqués dans un conteneur déjà bordé (ici la
                      // `SectionCard`) — sans elle, le style global focus
                      // `input/textarea:focus` (plus spécifique, en
                      // `!important`) continue de poser sa bordure + son
                      // ring bleus malgré des classes `!border-0`/`!ring-0`
                      // locales (mesuré). Même classe que DescriptionField.
                      className="no-input-chrome resize-none bg-transparent p-0"
                    />
                  </div>
                ) : (
                  <Cell
                    label={
                      <span className="flex items-center gap-1.5 font-semibold text-[rgb(var(--color-accent-solid))]">
                        <Plus size={16} aria-hidden="true" />
                        {t('modal.addDescription')}
                      </span>
                    }
                    onTap={() => setShowDescriptionMobile(true)}
                    showChevron={false}
                  />
                )}
              </SectionCard>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>{t('modal.keyResults')}</Label>
                {/* Repère mobile (redesign 2026-09-19) : combien de KR sont
                    déjà nommés, utile dès qu'on en empile plusieurs — remplace
                    en partie le message d'erreur qui n'apparaît qu'au pied du
                    formulaire. Desktop inchangé. */}
                {filledKrCount > 0 && (
                  <span className="sm:hidden text-[11px] font-bold px-2 py-0.5 rounded-full bg-[rgb(var(--color-accent-solid))]/10 text-[rgb(var(--color-accent-solid))]">
                    {tp('modal.krCount', filledKrCount)}
                  </span>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setKeyResults((p) => [...p, newKR()])}
                className="bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] border-0"
              >
                <Plus aria-hidden="true" /> {tCommon('actions.add')}
              </Button>
            </div>

            <div className="grid gap-3">
              {keyResults.map((kr, index) => (
                <div key={kr.id} className="border-border grid gap-3 rounded-lg border p-3">
                  {/* Desktop (sm+, inchangé) : nom seul sur sa ligne. */}
                  <div className="hidden sm:flex items-end gap-2">
                    <Input value={kr.title} placeholder={t('modal.keyResultPlaceholder')} className="h-8 min-w-0" onChange={(e) => setKR(kr.id, { title: e.target.value })} />
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t('modal.moveUp')}
                        title="Faire remonter"
                        onClick={() => moveKR(index, index - 1)}
                      >
                        <ArrowUpDown aria-hidden="true" />
                      </Button>
                    )}
                    {keyResults.length > 1 && (
                      <Button type="button" variant="destructive" size="icon-sm" aria-label={tCommon('actions.remove')} onClick={() => setKeyResults((p) => p.filter((k) => k.id !== kr.id))}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>

                  {/* Mobile (redesign 2026-09-19) : nom (80%) + cible/unité
                      fusionnés dans un seul champ (20%) sur la même ligne —
                      Cible et Unité n'ont plus de ligne à elles. */}
                  <div className="flex sm:hidden items-end gap-2">
                    <div className="flex-[4] min-w-0 grid gap-1">
                      <Label className="text-muted-foreground text-xs">{t('modal.keyResultName')}</Label>
                      <Input value={kr.title} placeholder={t('modal.keyResultPlaceholder')} className="h-8 min-w-0 !bg-[rgb(var(--color-surface))]" onChange={(e) => setKR(kr.id, { title: e.target.value })} />
                    </div>
                    <div className="flex-1 min-w-0 grid gap-1">
                      <Label className="text-muted-foreground text-xs">{t('modal.target')}</Label>
                      <div className="h-8 flex items-center rounded-md border border-[rgb(var(--color-border))] !bg-[rgb(var(--color-surface))] overflow-hidden">
                        <input
                          type="number"
                          aria-label={t('modal.target')}
                          value={kr.targetValue}
                          onChange={(e) => setKR(kr.id, { targetValue: Number(e.target.value) })}
                          className="min-w-0 flex-1 h-full bg-transparent px-1 text-sm text-center outline-none text-[rgb(var(--color-text-primary))]"
                        />
                        <input
                          type="text"
                          aria-label={t('modal.unit')}
                          value={kr.unit}
                          placeholder="%"
                          onChange={(e) => setKR(kr.id, { unit: e.target.value })}
                          className="w-6 shrink-0 h-full bg-transparent px-0.5 text-xs text-center outline-none border-l border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]"
                        />
                      </div>
                    </div>
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t('modal.moveUp')}
                        title="Faire remonter"
                        onClick={() => moveKR(index, index - 1)}
                      >
                        <ArrowUpDown aria-hidden="true" />
                      </Button>
                    )}
                    {keyResults.length > 1 && (
                      <Button type="button" variant="destructive" size="icon-sm" aria-label={tCommon('actions.remove')} onClick={() => setKeyResults((p) => p.filter((k) => k.id !== kr.id))}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-1.5">
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                      <span>{t('modal.progress')}</span>
                      <span className="tabular-nums">{kr.currentValue} / {kr.targetValue} {kr.unit}</span>
                    </div>
                    <Slider
                      min={0}
                      max={Math.max(kr.targetValue, 1)}
                      step={1}
                      value={[Math.min(kr.currentValue, kr.targetValue)]}
                      onValueChange={(v) => setKR(kr.id, { currentValue: v[0] })}
                      className="[&_[data-slot=slider-track]]:bg-blue-200 dark:[&_[data-slot=slider-track]]:bg-blue-900/40 [&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:border-blue-500 [&_[data-slot=slider-thumb]]:bg-blue-500"
                    />
                  </div>

                  {/* Desktop (sm+, inchangé) : grille à 4 colonnes complète. */}
                  <div className="hidden sm:grid sm:grid-cols-4 gap-2">
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs">{t('modal.target')}</Label>
                      <Input type="number" className="h-8" value={kr.targetValue} onChange={(e) => setKR(kr.id, { targetValue: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs">{t('modal.unit')}</Label>
                      <Input className="h-8" value={kr.unit} placeholder="%" onChange={(e) => setKR(kr.id, { unit: e.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs whitespace-nowrap">{t('modal.duration')} <span className="normal-case font-normal opacity-70">{t('modal.optional')}</span></Label>
                      <Input
                        type="number"
                        className="h-8"
                        placeholder="0"
                        value={kr.estimatedTime === 0 ? '' : kr.estimatedTime}
                        onChange={(e) => setKR(kr.id, { estimatedTime: e.target.value === '' ? 0 : Number(e.target.value) })}
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
                        onChange={(e) => setKR(kr.id, { weight: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Mobile (redesign 2026-09-19) : Durée + Coef. repliés
                      derrière « Fonctionnalité avancée », sous la barre de
                      progression — réglages secondaires, sortis du parcours
                      par défaut. Desktop inchangé (toujours visibles ci-dessus). */}
                  <div className="sm:hidden">
                    {advancedKrIds.has(kr.id) ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1">
                          <Label className="text-muted-foreground text-xs whitespace-nowrap">{t('modal.duration')} <span className="normal-case font-normal opacity-70">{t('modal.optional')}</span></Label>
                          <input
                            type="time"
                            aria-label={`${t('modal.duration')} (${t('modal.optional')})`}
                            value={minutesToTimeValue(kr.estimatedTime)}
                            onChange={(e) => setKR(kr.id, { estimatedTime: timeValueToMinutes(e.target.value) })}
                            className="h-8 w-full min-w-0 rounded-md border px-2 text-sm border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:border-[rgb(var(--color-accent))] focus:ring-1 focus:ring-[rgb(var(--color-accent))] !bg-[rgb(var(--color-surface))]"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-muted-foreground text-xs" title={t('modal.weightHint')}>{t('modal.weight')}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            step={1}
                            className="h-8 !bg-[rgb(var(--color-surface))]"
                            value={kr.weight}
                            onChange={(e) => setKR(kr.id, { weight: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAdvancedKrIds((prev) => new Set(prev).add(kr.id))}
                        className="text-sm font-semibold text-[rgb(var(--color-accent-solid))]"
                      >
                        {t('modal.advancedFeature')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row items-center justify-end gap-2 border-t">
          {!hasKeyResult && (
            <span className="text-xs text-amber-600 dark:text-amber-400 mr-auto" role="status">
              {t('modal.needOneKr')}
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>{t('modal.cancel')}</Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            // `!text-white` sur un fond --color-accent-solid était blanc sur
            // blanc en thème Noir (l'accent plein y vaut 240,240,240). Le duo
            // correct est accent-solid / accent-solid-foreground.
            className={`!border-0 ${
              !canSave
                ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))] !opacity-40'
                : '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))]'
            }`}
          >
            {isEdit ? t('modal.save') : t('modal.create')}
          </Button>
        </SheetFooter>

        {/* Création de catégorie sans quitter le sheet (parité avec l'ancien
            OKRModal). Rendu DANS SheetContent : le focus-trap du Dialog Radix
            englobe ainsi le modal imbriqué (sinon impossible de taper dedans)
            et le clic n'est pas traité comme « interaction extérieure ». */}
        <ColorSettingsModal
          isOpen={showColorSettings}
          onClose={() => setShowColorSettings(false)}
          isNested
        />
      </SheetContent>
    </Sheet>
  );
}
