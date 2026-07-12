// Créer / Éditer un OKR — Sheet latéral shadcn (repris de la version test).
// Props alignées sur l'ancien OKRModal (isOpen / onClose) pour un remplacement
// transparent dans OKRPage. Réutilise getProgress ; aucune logique métier nouvelle.
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ColorSettingsModal from './ColorSettingsModal';
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyResults, setKeyResults] = useState<KRDraft[]>([newKR()]);
  const [showColorSettings, setShowColorSettings] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingObjective) {
      setTitle(editingObjective.title);
      setDescription(editingObjective.description ?? '');
      setCategory(editingObjective.category ?? '');
      setStartDate(toDateInput(editingObjective.startDate));
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
      setStartDate(toDateInput(todayIso()));
      setEndDate(toDateInput(plusDaysIso(90)));
      setKeyResults([newKR()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingObjective]);

  const setKR = (id: string, patch: Partial<KRDraft>) =>
    setKeyResults((prev) => prev.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  // Un objectif sans résultat clé n'est pas mesurable : au moins 1 KR nommé requis.
  const hasKeyResult = keyResults.some((k) => k.title.trim().length > 0);
  // Cohérence temporelle : la date de début ne peut pas dépasser l'échéance.
  // (comparaison lexicographique valide sur YYYY-MM-DD)
  const datesInvalid = Boolean(startDate && endDate && startDate > endDate);
  const canSave = title.trim().length > 0 && hasKeyResult && !datesInvalid;

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
        startDate: fromDateInput(startDate) || todayIso(),
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
                  {/* Créer une catégorie sans quitter le modal (parité OKRModal). */}
                  <button
                    type="button"
                    onClick={() => setShowColorSettings(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
                  >
                    <Plus size={12} aria-hidden="true" />
                    Ajouter
                  </button>
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
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="okr-start">Début</Label>
                  <Input id="okr-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="okr-end">Échéance</Label>
                  <Input
                    id="okr-end"
                    type="date"
                    value={endDate}
                    aria-invalid={datesInvalid}
                    className={datesInvalid ? 'border-red-500 focus-visible:ring-red-500/30' : undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {datesInvalid && (
              <p className="text-xs text-red-500" role="alert">
                La date de début doit être antérieure à l'échéance.
              </p>
            )}

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
                className="bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                <Plus aria-hidden="true" /> Ajouter
              </Button>
            </div>

            <div className="grid gap-3">
              {keyResults.map((kr) => (
                <div key={kr.id} className="border-border grid gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input value={kr.title} placeholder="Résultat clé mesurable" className="h-8" onChange={(e) => setKR(kr.id, { title: e.target.value })} />
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
                      <Label className="text-muted-foreground text-xs">Durée (min)</Label>
                      <Input type="number" className="h-8" value={kr.estimatedTime} onChange={(e) => setKR(kr.id, { estimatedTime: Number(e.target.value) })} />
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
                : '!bg-blue-600 hover:!bg-blue-700'
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
