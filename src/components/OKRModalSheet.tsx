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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Category } from '@/modules/categories';
import type { KeyResult } from '@/modules/okrs';
import { getProgress, type Objective } from '@/pages/okr/okr-page-logic';

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
  unit: '%',
  estimatedTime: 0,
  completed: false,
  weight: 1,
});

const todayIso = () => new Date().toISOString();
const plusDaysIso = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };
const toDateInput = (iso: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const fromDateInput = (v: string) => (v ? new Date(v + 'T00:00:00').toISOString() : '');

export default function OKRModalSheet({ isOpen, onClose, categories, editingObjective, onSubmit }: OKRModalSheetProps) {
  const isEdit = !!editingObjective;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyResults, setKeyResults] = useState<KRDraft[]>([newKR()]);
  const [showColorSettings, setShowColorSettings] = useState(false);

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
    } else {
      setTitle('');
      setDescription('');
      setCategory(categories[0]?.id ?? '');
      setEndDate(toDateInput(plusDaysIso(90)));
      setKeyResults([newKR()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        progress: getProgress(krs),
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
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg rounded-l-2xl border-l-0 overflow-hidden">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier l'objectif" : 'Nouvel objectif'}</SheetTitle>
          <SheetDescription>Définis un objectif et ses résultats clés mesurables.</SheetDescription>
        </SheetHeader>

        {/* min-h-0 : sans lui, l'enfant flex-1 garde sa hauteur de contenu et le
            viewport Radix ne scrolle jamais (flexbox min-height:auto). */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="grid gap-4 px-4 pb-4">
            <div className="grid gap-2">
              <Label htmlFor="okr-title">Objectif</Label>
              <Input id="okr-title" value={title} autoFocus placeholder="Ex. Lancer la v2 du produit" onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="okr-cat">Catégorie</Label>
                  {/* Créer une catégorie sans quitter le modal (pattern unifié). */}
                  <AddCategoryButton onClick={() => setShowColorSettings(true)} />
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="okr-cat" className="w-full">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Échéance</Label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  displayFormat="d MMMM yyyy"
                  allowClear={false}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="okr-desc">Description</Label>
              <Textarea id="okr-desc" rows={2} value={description} placeholder="Facultatif…" onChange={(e) => setDescription(e.target.value)} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label>Résultats clés</Label>
              <Button
                type="button"
                size="sm"
                onClick={() => setKeyResults((p) => [...p, newKR()])}
                className="bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] border-0"
              >
                <Plus aria-hidden="true" /> Ajouter
              </Button>
            </div>

            <div className="grid gap-3">
              {keyResults.map((kr, index) => (
                <div key={kr.id} className="border-border grid gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input value={kr.title} placeholder="Résultat clé mesurable" className="h-8 min-w-0" onChange={(e) => setKR(kr.id, { title: e.target.value })} />
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Faire remonter le résultat clé"
                        title="Faire remonter"
                        onClick={() => moveKR(index, index - 1)}
                      >
                        <ArrowUpDown aria-hidden="true" />
                      </Button>
                    )}
                    {keyResults.length > 1 && (
                      <Button type="button" variant="destructive" size="icon-sm" aria-label="Retirer" onClick={() => setKeyResults((p) => p.filter((k) => k.id !== kr.id))}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                      <span>Avancement</span>
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs">Cible</Label>
                      <Input type="number" className="h-8" value={kr.targetValue} onChange={(e) => setKR(kr.id, { targetValue: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs">Unité</Label>
                      <Input className="h-8" value={kr.unit} placeholder="%" onChange={(e) => setKR(kr.id, { unit: e.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs whitespace-nowrap">Durée <span className="normal-case font-normal opacity-70">(Facultatif)</span></Label>
                      <Input
                        type="number"
                        className="h-8"
                        placeholder="0"
                        value={kr.estimatedTime === 0 ? '' : kr.estimatedTime}
                        onChange={(e) => setKR(kr.id, { estimatedTime: e.target.value === '' ? 0 : Number(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs" title="Importance du KR dans la progression globale">Coef. (1–10)</Label>
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
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row items-center justify-end gap-2 border-t">
          {!hasKeyResult && (
            <span className="text-xs text-amber-600 dark:text-amber-400 mr-auto" role="status">
              Ajoute au moins 1 résultat clé pour créer l'objectif.
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className={`!text-white !border-0 ${
              !canSave
                ? '!bg-blue-300 dark:!bg-blue-900/60 !opacity-100'
                : '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))]'
            }`}
          >
            {isEdit ? 'Enregistrer' : 'Créer'}
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
