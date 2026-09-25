// Créer / Modifier un OKR d'équipe — Sheet latéral droit (calqué sur
// OKRModalSheet de la page OKR perso), enrichi du rattachement à des équipes
// (cloisonnement). Un OKR ne s'assigne PAS à une personne (#10) : le travail
// individuel passe par les tâches de projet.
//
// Audit des popups du 2026-09-25 : cycle, objectif parent et projets reliés
// aux KR (mig. 160) arrivent ici ; la création d'équipe en est RETIRÉE. Elle
// faisait de cette fiche un point d'entrée de plus pour les équipes, sans
// responsable ni membres : l'équipe naissait vide.
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
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateTeamOKR,
  useEditTeamOKR,
  useTeamOKRs,
  useKRProjects,
  useSetKRProjects,
  teamOkrKeys,
  type TeamOKR,
  type CreateTeamKRInput,
  type SyncTeamKRInput,
} from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import { useTeamProjects } from '@/modules/team-projects';
import { useMyOrgPermissions } from '@/modules/organizations';
import TeamCategoryTreeSelect from './TeamCategoryTreeSelect';
import { OkrCycleField, OkrParentField, KRProjectsField } from './TeamOKRLinkFields';
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
  /** Projets reliés (mig. 160), écrits après l'enregistrement de l'OKR. */
  projectIds: string[];
  byTasks: boolean;
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
  projectIds: [],
  byTasks: false,
});

export default function TeamOKRModal({ orgId, editingOKR, onClose }: TeamOKRModalProps) {
  const { t } = useT('org');
  const isEdit = !!editingOKR;
  const { data: teams = [] } = useOrgTeams(orgId);
  const createOKR = useCreateTeamOKR(orgId);
  const editOKR = useEditTeamOKR(orgId);
  const { data: allOkrs = [] } = useTeamOKRs(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const activeProjects = projects.filter((p) => !p.archivedAt);
  const { data: krLinks = [], isSuccess: krLinksLoaded } = useKRProjects(orgId);
  const setKRProjects = useSetKRProjects(orgId);
  const { can } = useMyOrgPermissions(orgId);
  const queryClient = useQueryClient();

  // Monté fermé puis ouvert au tick suivant : la transition false→true permet à
  // Radix de jouer le slide-in (un Sheet monté déjà ouvert reste hors-écran
  // sous prefers-reduced-motion — l'animation d'entrée ne se déclenche pas).
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(true); }, []);
  const [title, setTitle] = useState(editingOKR?.title ?? '');
  const [description, setDescription] = useState(editingOKR?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(editingOKR?.categoryId ?? null);
  const [endDate, setEndDate] = useState(editingOKR?.endDate ? editingOKR.endDate.slice(0, 10) : '');
  const [teamIds, setTeamIds] = useState<string[]>(editingOKR?.teamIds ?? []);
  const [cycleId, setCycleId] = useState<string | null>(editingOKR?.cycleId ?? null);
  const [parentOkrId, setParentOkrId] = useState<string | null>(editingOKR?.parentOkrId ?? null);
  const [keyResults, setKeyResults] = useState<KRDraft[]>(
    editingOKR && editingOKR.keyResults.length > 0
      ? editingOKR.keyResults.map((k) => ({
          id: k.id,
          title: k.title,
          currentValue: k.currentValue,
          targetValue: k.targetValue,
          unit: k.unit ?? '',
          weight: k.weight ?? 1,
          projectIds: krLinks.filter((l) => l.krId === k.id).map((l) => l.projectId),
          byTasks: k.progressMode === 'tasks',
        }))
      : [newKR()],
  );

  // Les liens KR ↔ projet arrivent APRÈS le montage : on les reporte une fois
  // dans le brouillon, sans écraser ce que l'utilisateur aurait déjà coché.
  const [linksSynced, setLinksSynced] = useState(!isEdit);
  useEffect(() => {
    if (linksSynced || !krLinksLoaded) return;
    setKeyResults((prev) => prev.map((k) => (k.id && k.projectIds.length === 0
      ? { ...k, projectIds: krLinks.filter((l) => l.krId === k.id).map((l) => l.projectId) }
      : k)));
    setLinksSynced(true);
  }, [linksSynced, krLinksLoaded, krLinks]);

  const [saving, setSaving] = useState(false);
  const isPending = createOKR.isPending || editOKR.isPending || saving;

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

  const krFields = (k: KRDraft): CreateTeamKRInput => ({
    title: k.title.trim(),
    targetValue: Number(k.targetValue),
    currentValue: Number(k.currentValue) || 0,
    unit: k.unit.trim() || undefined,
    weight: Math.min(10, Math.max(1, Math.round(Number(k.weight) || 1))),
    // Avancer « par les tâches » n'a de sens qu'avec au moins un projet relié.
    progressMode: k.byTasks && k.projectIds.length > 0 ? 'tasks' : 'manual',
  });

  /** Écrit les liens KR ↔ projet qui ont changé (une écriture par KR touché). */
  const writeLinks = async (pairs: { krId: string; projectIds: string[] }[]) => {
    const changed = pairs.filter(({ krId, projectIds }) => {
      const before = krLinks.filter((l) => l.krId === krId).map((l) => l.projectId);
      return before.length !== projectIds.length || before.some((id) => !projectIds.includes(id));
    });
    await Promise.all(changed.map((pair) => setKRProjects.mutateAsync(pair)));
  };

  const handleSave = async () => {
    if (!canSave || isPending) return;
    const valid = keyResults.filter((k) => k.title.trim() && Number(k.targetValue) > 0);
    const meta = {
      title: title.trim(),
      categoryId,
      endDate: endDate || undefined,
      teamIds,
      cycleId,
      parentOkrId,
    };
    setSaving(true);
    try {
      if (isEdit && editingOKR) {
        const krs: SyncTeamKRInput[] = valid.map((k) => ({ id: k.id, ...krFields(k) }));
        await editOKR.mutateAsync({ okrId: editingOKR.id, meta: { ...meta, description: description.trim() }, keyResults: krs });
        const pairs = valid.filter((k) => k.id).map((k) => ({ krId: k.id as string, projectIds: k.projectIds }));
        // Un KR ajouté ici n'a son id qu'après la synchronisation : on relit
        // l'objectif et on le retrouve par son titre parmi les nouveaux.
        const fresh = valid.filter((k) => !k.id && k.projectIds.length > 0);
        if (fresh.length > 0) {
          await queryClient.refetchQueries({ queryKey: teamOkrKeys.list(orgId) });
          const saved = queryClient.getQueryData<TeamOKR[]>(teamOkrKeys.list(orgId))?.find((o) => o.id === editingOKR.id);
          const known = new Set(valid.map((k) => k.id).filter(Boolean));
          for (const k of fresh) {
            const match = saved?.keyResults.find((kr) => !known.has(kr.id) && kr.title === k.title.trim());
            if (match) { known.add(match.id); pairs.push({ krId: match.id, projectIds: k.projectIds }); }
          }
        }
        await writeLinks(pairs);
      } else {
        const created = await createOKR.mutateAsync({
          ...meta,
          description: description.trim() || undefined,
          keyResults: valid.map(krFields),
        });
        // La création rend les KR dans l'ordre de saisie.
        await writeLinks(valid.map((k, i) => ({ krId: created.keyResults[i]?.id ?? '', projectIds: k.projectIds })).filter((p) => p.krId && p.projectIds.length > 0));
      }
      handleClose();
    } catch {
      // Déjà dit par le hook (toast) ; la fiche reste ouverte pour corriger.
    } finally {
      setSaving(false);
    }
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

            {/* Cycle et objectif parent (mig. 160) : sans eux, un OKR d'équipe
                ne se rattachait ni à une période ni à l'objectif qu'il sert. */}
            <OkrCycleField orgId={orgId} value={cycleId} onChange={setCycleId} canCreate={can['okr.create']} />
            <OkrParentField okrs={allOkrs} selfId={editingOKR?.id} value={parentOkrId} onChange={setParentOkrId} />

            {/* Catégorie — vrai système partagé (parité mode perso, #C) */}
            <div className="grid gap-2">
              <Label>{t('okrModal.category')}</Label>
              <TeamCategoryTreeSelect orgId={orgId} value={categoryId} onChange={setCategoryId} />
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
              </div>

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
                  <KRProjectsField
                    projects={activeProjects}
                    value={kr.projectIds}
                    onChange={(projectIds) => setKR(idx, { projectIds })}
                    byTasks={kr.byTasks}
                    onByTasksChange={(byTasks) => setKR(idx, { byTasks })}
                  />
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
