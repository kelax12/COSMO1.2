// Créer / Modifier un OKR d'équipe — Sheet latéral droit (calqué sur
// OKRModalSheet de la page OKR perso), enrichi du rattachement à des équipes
// (cloisonnement). Un OKR ne s'assigne PAS à une personne (#10) : le travail
// individuel passe par les tâches de projet.
import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Building2 } from 'lucide-react';
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
  useCreateTeamOKR,
  useEditTeamOKR,
  type TeamOKR,
  type CreateTeamKRInput,
  type SyncTeamKRInput,
} from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import OKRCategoryPicker from './OKRCategoryPicker';

interface TeamOKRModalProps {
  orgId: string;
  /** OKR à modifier — absent = création. */
  editingOKR?: TeamOKR | null;
  onClose: () => void;
}

interface KRDraft {
  id?: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  weight: number;
}

const newKR = (): KRDraft => ({
  title: '',
  currentValue: 0,
  targetValue: 100,
  unit: '%',
  weight: 1,
});

export default function TeamOKRModal({ orgId, editingOKR, onClose }: TeamOKRModalProps) {
  const isEdit = !!editingOKR;
  const { data: teams = [] } = useOrgTeams(orgId);
  const createOKR = useCreateTeamOKR(orgId);
  const editOKR = useEditTeamOKR(orgId);

  // Monté fermé puis ouvert au tick suivant : la transition false→true permet à
  // Radix de jouer le slide-in (un Sheet monté déjà ouvert reste hors-écran
  // sous prefers-reduced-motion — l'animation d'entrée ne se déclenche pas).
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(true); }, []);
  const [title, setTitle] = useState(editingOKR?.title ?? '');
  const [description, setDescription] = useState(editingOKR?.description ?? '');
  const [category, setCategory] = useState(editingOKR?.category ?? '');
  const [endDate, setEndDate] = useState(editingOKR?.endDate ? editingOKR.endDate.slice(0, 10) : '');
  const [teamIds, setTeamIds] = useState<string[]>(editingOKR?.teamIds ?? []);
  const [keyResults, setKeyResults] = useState<KRDraft[]>(
    editingOKR && editingOKR.keyResults.length > 0
      ? editingOKR.keyResults.map((k) => ({
          id: k.id,
          title: k.title,
          currentValue: k.currentValue,
          targetValue: k.targetValue,
          unit: k.unit ?? '',
          weight: k.weight ?? 1,
        }))
      : [newKR()],
  );

  const isPending = createOKR.isPending || editOKR.isPending;

  const setKR = (idx: number, patch: Partial<KRDraft>) =>
    setKeyResults((prev) => prev.map((k, i) => (i === idx ? { ...k, ...patch } : k)));

  const toggleTeam = (teamId: string) =>
    setTeamIds((prev) => (prev.includes(teamId) ? prev.filter((t) => t !== teamId) : [...prev, teamId]));

  // Un objectif sans résultat clé mesurable n'est pas valide : ≥ 1 KR nommé + cible > 0.
  const hasKeyResult = keyResults.some((k) => k.title.trim() && Number(k.targetValue) > 0);
  const canSave = title.trim().length > 0 && hasKeyResult;

  // Fermeture animée (slide-out) puis démontage par le parent.
  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 200);
  };

  const handleSave = () => {
    if (!canSave) return;
    const valid = keyResults.filter((k) => k.title.trim() && Number(k.targetValue) > 0);

    if (isEdit && editingOKR) {
      const krs: SyncTeamKRInput[] = valid.map((k) => ({
        id: k.id,
        title: k.title.trim(),
        targetValue: Number(k.targetValue),
        currentValue: Number(k.currentValue) || 0,
        unit: k.unit.trim() || undefined,
        weight: Math.min(10, Math.max(1, Math.round(Number(k.weight) || 1))),
      }));
      editOKR.mutate(
        {
          okrId: editingOKR.id,
          meta: {
            title: title.trim(),
            category: category.trim(),
            description: description.trim(),
            endDate: endDate || undefined,
            teamIds,
          },
          keyResults: krs,
        },
        { onSuccess: handleClose },
      );
      return;
    }

    const krs: CreateTeamKRInput[] = valid.map((k) => ({
      title: k.title.trim(),
      targetValue: Number(k.targetValue),
      currentValue: Number(k.currentValue) || 0,
      unit: k.unit.trim() || undefined,
      weight: Math.min(10, Math.max(1, Math.round(Number(k.weight) || 1))),
    }));
    createOKR.mutate(
      {
        title: title.trim(),
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        endDate: endDate || undefined,
        teamIds,
        keyResults: krs,
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg rounded-l-2xl border-l-0 overflow-hidden">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier l'objectif" : "Nouvel objectif d'équipe"}</SheetTitle>
          <SheetDescription>Définis un objectif d'équipe et ses résultats clés mesurables.</SheetDescription>
        </SheetHeader>

        {/* min-h-0 : sans lui, l'enfant flex-1 garde sa hauteur de contenu et le
            viewport Radix ne scrolle jamais (flexbox min-height:auto). */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="grid gap-4 px-4 pb-4">
            <div className="grid gap-2">
              <Label htmlFor="tokr-title">Objectif</Label>
              <Input id="tokr-title" value={title} autoFocus placeholder="Ex. Réussir le lancement produit" onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tokr-end">Échéance</Label>
              <Input id="tokr-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            {/* Catégorie — vrai système partagé (parité mode perso, #C) */}
            <div className="grid gap-2">
              <Label>Catégorie</Label>
              <OKRCategoryPicker orgId={orgId} value={category} onChange={setCategory} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tokr-desc">Description</Label>
              <Textarea id="tokr-desc" rows={2} value={description} placeholder="Facultatif…" onChange={(e) => setDescription(e.target.value)} />
            </div>

            {/* Rattachement d'équipes (cloisonnement de visibilité) */}
            <div className="grid gap-2">
              <Label>Visibilité</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTeamIds([])}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    teamIds.length === 0
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-border text-muted-foreground hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  <Building2 size={13} aria-hidden="true" /> Toute l'entreprise
                </button>
                {teams.map((team) => {
                  const active = teamIds.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleTeam(team.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-border text-muted-foreground hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                    >
                      <Users size={13} aria-hidden="true" /> {team.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                {teamIds.length === 0
                  ? "Objectif visible par tous les membres de l'entreprise."
                  : 'Visible uniquement par les équipes sélectionnées et les admins.'}
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label>Résultats clés</Label>
              <Button
                type="button"
                size="sm"
                onClick={() => setKeyResults((p) => (p.length < 10 ? [...p, newKR()] : p))}
                disabled={keyResults.length >= 10}
                className="bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                <Plus aria-hidden="true" /> Ajouter
              </Button>
            </div>

            <div className="grid gap-3">
              {keyResults.map((kr, idx) => (
                <div key={kr.id ?? idx} className="border-border grid gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input value={kr.title} placeholder="Résultat clé mesurable" className="h-8" onChange={(e) => setKR(idx, { title: e.target.value })} />
                    {keyResults.length > 1 && (
                      <Button type="button" variant="destructive" size="icon-sm" aria-label="Retirer" onClick={() => setKeyResults((p) => p.filter((_, i) => i !== idx))}>
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
                      onValueChange={(v) => setKR(idx, { currentValue: v[0] })}
                      className="[&_[data-slot=slider-track]]:bg-blue-200 dark:[&_[data-slot=slider-track]]:bg-blue-900/40 [&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:border-blue-500 [&_[data-slot=slider-thumb]]:bg-blue-500"
                    />
                  </div>
                  {/* Durée retirée : un OKR d'équipe est à l'échelle équipe /
                      entreprise, la notion de temps de réalisation n'a pas de sens. */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs">Cible</Label>
                      <Input type="number" className="h-8" value={kr.targetValue} onChange={(e) => setKR(idx, { targetValue: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs">Unité</Label>
                      <Input className="h-8" value={kr.unit} placeholder="%" onChange={(e) => setKR(idx, { unit: e.target.value })} />
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
                        onChange={(e) => setKR(idx, { weight: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  {/* #10 : un OKR ne s'assigne pas à une personne — il se
                      rattache à des équipes ; le travail individuel passe par
                      les tâches de projet. */}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row items-center justify-end gap-2 border-t">
          {!hasKeyResult && (
            <span className="text-xs text-amber-600 dark:text-amber-400 mr-auto" role="status">
              Ajoute au moins 1 résultat clé mesurable.
            </span>
          )}
          <Button type="button" variant="outline" onClick={handleClose}>Annuler</Button>
          <Button
            type="button"
            disabled={!canSave || isPending}
            onClick={handleSave}
            className={`!text-white !border-0 ${
              !canSave
                ? '!bg-blue-300 dark:!bg-blue-900/60 !opacity-100'
                : '!bg-blue-600 hover:!bg-blue-700'
            }`}
          >
            {isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
