// Créer / Modifier un OKR d'équipe — Sheet latéral droit (calqué sur
// OKRModalSheet de la page OKR perso), enrichi du rattachement à des équipes
// (cloisonnement). Un OKR ne s'assigne PAS à une personne (#10) : le travail
// individuel passe par les tâches de projet.
import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Building2, X } from 'lucide-react';
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
  useCreateTeamOKR,
  useEditTeamOKR,
  type TeamOKR,
  type CreateTeamKRInput,
  type SyncTeamKRInput,
} from '@/modules/team-okrs';
import { useOrgTeams, useCreateOrgTeam } from '@/modules/org-teams';
import OKRCategoryPicker from './OKRCategoryPicker';
import { TEAM_COLORS } from './CreateTeamModal';
import { useT } from '@/i18n/useT';

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
  // Pas d'unité par défaut — « % » n'a de sens que pour une partie des KR
  // (taux, pourcentages) ; les autres (nombre, montant, durée) hériteraient
  // sinon d'un symbole faux tant que l'utilisateur ne l'efface pas lui-même.
  unit: '',
  weight: 1,
});

export default function TeamOKRModal({ orgId, editingOKR, onClose }: TeamOKRModalProps) {
  const { t } = useT('org');
  const isEdit = !!editingOKR;
  const { data: teams = [] } = useOrgTeams(orgId);
  const createOKR = useCreateTeamOKR(orgId);
  const editOKR = useEditTeamOKR(orgId);
  const createTeam = useCreateOrgTeam(orgId);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState<string>(TEAM_COLORS[0].value);

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

  // Même geste que « + Nouvelle catégorie » (OKRCategoryPicker) : créer sans
  // quitter le modal, puis sélectionner immédiatement la nouvelle équipe.
  const handleCreateTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;
    createTeam.mutate(
      { name, color: newTeamColor },
      {
        onSuccess: (team) => {
          setTeamIds((prev) => [...prev, team.id]);
          setNewTeamName('');
          setNewTeamColor(TEAM_COLORS[0].value);
          setCreatingTeam(false);
        },
      },
    );
  };

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
          <SheetTitle>{isEdit ? t('okrModal.edit') : t('okrModal.new')}</SheetTitle>
          <SheetDescription>{t('okrModal.description')}</SheetDescription>
        </SheetHeader>

        {/* min-h-0 : sans lui, l'enfant flex-1 garde sa hauteur de contenu et le
            viewport Radix ne scrolle jamais (flexbox min-height:auto). */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="grid gap-4 px-4 pb-4">
            <div className="grid gap-2">
              <Label htmlFor="tokr-title">{t('okrModal.objective')}</Label>
              <Input id="tokr-title" value={title} autoFocus placeholder={t('okrModal.objectivePlaceholder')} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tokr-end">{t('okrModal.deadline')}</Label>
              {/* Même composant que la page Tâches perso (DesktopDetailsStep) et
                  que OKRModalSheet (OKR perso) : Popover + Calendar, pas l'input
                  natif du navigateur — c'est LE calendrier de l'app, pas une
                  variante entreprise. Icône teintée en accent via `[&_svg]`
                  (le composant partagé n'expose pas de prop dédiée). */}
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                className="w-full [&_svg]:text-[rgb(var(--color-accent))]"
              />
            </div>

            {/* Catégorie — vrai système partagé (parité mode perso, #C) */}
            <div className="grid gap-2">
              <Label>{t('okrModal.category')}</Label>
              <OKRCategoryPicker orgId={orgId} value={category} onChange={setCategory} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tokr-desc">{t('okrModal.descriptionLabel')}</Label>
              <Textarea id="tokr-desc" rows={2} value={description} placeholder={t('okrModal.descPlaceholder')} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {/* Rattachement d'équipes (cloisonnement de visibilité) */}
            <div className="grid gap-2">
              <Label>{t('okrModal.visibility')}</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTeamIds([])}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    teamIds.length === 0
                      ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                      : 'border-border text-muted-foreground hover:border-[rgb(var(--color-accent))] hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  <Building2 size={13} aria-hidden="true" /> {t('okrModal.wholeOrg')}
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
                          ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                          : 'border-border text-muted-foreground hover:border-[rgb(var(--color-accent))] hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                    >
                      <Users size={13} aria-hidden="true" /> {team.name}
                    </button>
                  );
                })}
                {!creatingTeam && (
                  <button
                    type="button"
                    onClick={() => setCreatingTeam(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:border-[rgb(var(--color-accent-solid-hover))] transition-colors"
                  >
                    <Plus size={12} aria-hidden="true" /> {t('team.newTeam')}
                  </button>
                )}
              </div>

              {creatingTeam && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--color-border))] p-2">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCreateTeam(); }
                      if (e.key === 'Escape') setCreatingTeam(false);
                    }}
                    placeholder={t('team.namePlaceholder')}
                    autoFocus
                    maxLength={80}
                    className="flex-1 min-w-[140px] h-8 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <div className="flex items-center gap-1">
                    {TEAM_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        aria-label={t('team.colorNamed', { name: t(c.labelKey) })}
                        aria-pressed={newTeamColor === c.value}
                        onClick={() => setNewTeamColor(c.value)}
                        className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${newTeamColor === c.value ? 'ring-2 ring-offset-1 ring-offset-[rgb(var(--color-surface))] ring-blue-500' : ''}`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateTeam}
                    disabled={!newTeamName.trim() || createTeam.isPending}
                    className="h-8 px-3 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50 text-[rgb(var(--color-accent-solid-foreground))] text-xs font-semibold"
                  >
                    {t('team.create')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingTeam(false)}
                    aria-label={t('common.cancel')}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              )}

              <p className="text-muted-foreground text-xs">
                {teamIds.length === 0
                  ? t('okrModal.visibilityWholeOrg')
                  : t('okrModal.visibilityTeams')}
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label>{t('okrModal.keyResults')}</Label>
              <Button
                type="button"
                size="sm"
                onClick={() => setKeyResults((p) => (p.length < 10 ? [...p, newKR()] : p))}
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
                      <Button type="button" variant="destructive" size="icon-sm" aria-label={t('common.removeKr')} onClick={() => setKeyResults((p) => p.filter((_, i) => i !== idx))}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
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
                  {/* Durée retirée : un OKR d'équipe est à l'échelle équipe /
                      entreprise, la notion de temps de réalisation n'a pas de sens. */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs">{t('okrModal.target')}</Label>
                      <Input type="number" className="h-8" value={kr.targetValue} onChange={(e) => setKR(idx, { targetValue: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-muted-foreground text-xs">{t('okrModal.unit')}</Label>
                      <Input className="h-8" value={kr.unit} placeholder="%" onChange={(e) => setKR(idx, { unit: e.target.value })} />
                    </div>
                    <div className="grid gap-1">
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
              {t('okrModal.needOneKr')}
            </span>
          )}
          <Button type="button" variant="outline" onClick={handleClose}>{t('okrModal.cancel')}</Button>
          <Button
            type="button"
            disabled={!canSave || isPending}
            onClick={handleSave}
            className={`!border-0 ${
              !canSave
                ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))] !opacity-40'
                : '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))]'
            }`}
          >
            {isPending ? t('okrModal.saving') : isEdit ? t('okrModal.save') : t('okrModal.create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
