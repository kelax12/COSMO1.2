import { useEffect, useState } from 'react';
import { Users, Building2 } from 'lucide-react';
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
import {
  useCreateTeamOKR,
  useEditTeamOKR,
  type TeamOKR,
  type CreateTeamKRInput,
  type SyncTeamKRInput,
} from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import { useTeamProjects } from '@/modules/team-projects';
import { useKRProjects, useOkrCycles, useSetKRProjects } from '@/modules/team-okrs/execution.hooks';
import TeamCategoryTreeSelect from './TeamCategoryTreeSelect';
import TeamOKRKeyResultsEditor, { newKR, type KRDraft } from './TeamOKRKeyResultsEditor';
import { currentCycle, parentCandidates } from './okr-execution.helpers';
import { useT } from '@/i18n/useT';

interface TeamOKRModalProps {
  orgId: string;
  /** OKR à modifier. Absent = création. */
  editingOKR?: TeamOKR | null;
  /** Objectifs visibles : candidats au rôle de parent (M9). */
  allOkrs?: TeamOKR[];
  onClose: () => void;
}

const clampWeight = (w: number) => Math.min(10, Math.max(1, Math.round(Number(w) || 1)));

/**
 * Créer ou modifier un objectif d'entreprise.
 *
 * Audit 2026-09-23 :
 *   · M9 : cycle, objectif parent, KR calculés à partir de projets reliés ;
 *   · étape 3 : la création d'équipe intégrée est RETIRÉE. Une équipe créée
 *     depuis un formulaire d'objectif naissait sans membre ni responsable ;
 *     elle se crée dans la section Équipes.
 */
export default function TeamOKRModal({ orgId, editingOKR, allOkrs = [], onClose }: TeamOKRModalProps) {
  const { t } = useT('org');
  const isEdit = !!editingOKR;
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: cycles = [] } = useOkrCycles(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: links = [] } = useKRProjects(orgId);
  const createOKR = useCreateTeamOKR(orgId);
  const editOKR = useEditTeamOKR(orgId);
  const setKRProjects = useSetKRProjects(orgId);
  const activeProjects = projects.filter((p) => !p.archivedAt);

  // Monté fermé puis ouvert au tick suivant : la transition false→true permet à
  // Radix de jouer le slide-in (un Sheet monté déjà ouvert reste hors-écran
  // sous prefers-reduced-motion : l'animation d'entrée ne se déclenche pas).
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(true); }, []);
  const [title, setTitle] = useState(editingOKR?.title ?? '');
  const [description, setDescription] = useState(editingOKR?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(editingOKR?.categoryId ?? null);
  const [endDate, setEndDate] = useState(editingOKR?.endDate ? editingOKR.endDate.slice(0, 10) : '');
  const [teamIds, setTeamIds] = useState<string[]>(editingOKR?.teamIds ?? []);
  const [cycleId, setCycleId] = useState<string>(editingOKR?.cycleId ?? '');
  const [parentOkrId, setParentOkrId] = useState<string>(editingOKR?.parentOkrId ?? '');
  const [keyResults, setKeyResults] = useState<KRDraft[]>(
    editingOKR && editingOKR.keyResults.length > 0
      ? editingOKR.keyResults.map((k) => ({
          id: k.id,
          title: k.title,
          currentValue: k.currentValue,
          targetValue: k.targetValue,
          unit: k.unit ?? '',
          weight: k.weight ?? 1,
          progressMode: k.progressMode ?? 'manual',
          projectIds: [],
        }))
      : [newKR()],
  );

  // Un nouvel objectif se range par défaut dans le cycle en cours.
  const [cycleDefaulted, setCycleDefaulted] = useState(isEdit);
  useEffect(() => {
    if (cycleDefaulted || cycles.length === 0) return;
    setCycleId(currentCycle(cycles)?.id ?? '');
    setCycleDefaulted(true);
  }, [cycles, cycleDefaulted]);

  // Les liens KR ↔ projets arrivent après le premier rendu : recopiés une fois.
  const [linksCopied, setLinksCopied] = useState(!isEdit);
  useEffect(() => {
    if (linksCopied || links.length === 0) return;
    setKeyResults((prev) => prev.map((k) =>
      k.id ? { ...k, projectIds: links.filter((l) => l.krId === k.id).map((l) => l.projectId) } : k,
    ));
    setLinksCopied(true);
  }, [links, linksCopied]);

  const parents = parentCandidates(allOkrs, editingOKR?.id);
  const isPending = createOKR.isPending || editOKR.isPending || setKRProjects.isPending;
  const toggleTeam = (teamId: string) =>
    setTeamIds((prev) => (prev.includes(teamId) ? prev.filter((x) => x !== teamId) : [...prev, teamId]));

  // Un objectif sans résultat clé mesurable n'est pas valide : ≥ 1 KR nommé + cible > 0.
  const hasKeyResult = keyResults.some((k) => k.title.trim() && Number(k.targetValue) > 0);
  const canSave = title.trim().length > 0 && hasKeyResult;

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 200);
  };

  /** Projets reliés de chaque KR, remplacés APRÈS l'enregistrement (il faut leur id). */
  const syncProjectLinks = async (ids: string[], drafts: KRDraft[]) => {
    for (let i = 0; i < ids.length; i++) {
      const draft = drafts[i];
      if (!draft) continue;
      const wanted = draft.progressMode === 'tasks' ? draft.projectIds : [];
      const had = links.filter((l) => l.krId === ids[i]).map((l) => l.projectId);
      if (wanted.length === 0 && had.length === 0) continue;
      await setKRProjects.mutateAsync({ krId: ids[i], projectIds: wanted });
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    const valid = keyResults.filter((k) => k.title.trim() && Number(k.targetValue) > 0);
    const meta = {
      title: title.trim(),
      categoryId,
      endDate: endDate || undefined,
      teamIds,
      cycleId: cycleId || null,
      parentOkrId: parentOkrId || null,
    };

    if (isEdit && editingOKR) {
      const krs: SyncTeamKRInput[] = valid.map((k) => ({
        id: k.id,
        title: k.title.trim(),
        targetValue: Number(k.targetValue),
        currentValue: Number(k.currentValue) || 0,
        unit: k.unit.trim() || undefined,
        weight: clampWeight(k.weight),
        progressMode: k.progressMode,
      }));
      editOKR.mutate(
        { okrId: editingOKR.id, meta: { ...meta, description: description.trim() }, keyResults: krs },
        { onSuccess: async (ids) => { await syncProjectLinks(ids, valid); handleClose(); } },
      );
      return;
    }

    const krs: CreateTeamKRInput[] = valid.map((k) => ({
      title: k.title.trim(),
      targetValue: Number(k.targetValue),
      currentValue: Number(k.currentValue) || 0,
      unit: k.unit.trim() || undefined,
      weight: clampWeight(k.weight),
      progressMode: k.progressMode,
    }));
    createOKR.mutate(
      { ...meta, description: description.trim() || undefined, keyResults: krs },
      {
        onSuccess: async (created) => {
          await syncProjectLinks(created.keyResults.map((k) => k.id), valid);
          handleClose();
        },
      },
    );
  };

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
      active
        ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
        : 'border-border text-muted-foreground hover:border-[rgb(var(--color-accent))] hover:text-blue-600 dark:hover:text-blue-400'
    }`;

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="tokr-cycle">{t('okrExec.cycleLabel')}</Label>
                <select
                  id="tokr-cycle"
                  value={cycleId}
                  onChange={(e) => setCycleId(e.target.value)}
                  className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                >
                  <option value="">{t('okrExec.noCycle')}</option>
                  {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tokr-end">{t('okrModal.deadline')}</Label>
                <DatePicker
                  id="tokr-end"
                  value={endDate}
                  onChange={setEndDate}
                  className="w-full [&_svg]:text-[rgb(var(--color-accent))]"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tokr-parent">{t('okrExec.parentLabel')}</Label>
              <select
                id="tokr-parent"
                value={parentOkrId}
                onChange={(e) => setParentOkrId(e.target.value)}
                className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
              >
                <option value="">{t('okrExec.noParent')}</option>
                {parents.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
              <p className="text-muted-foreground text-xs">{t('okrExec.parentHint')}</p>
            </div>

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
                <button type="button" onClick={() => setTeamIds([])} className={chip(teamIds.length === 0)}>
                  <Building2 size={13} aria-hidden="true" /> {t('okrModal.wholeOrg')}
                </button>
                {teams.map((team) => (
                  <button key={team.id} type="button" onClick={() => toggleTeam(team.id)} className={chip(teamIds.includes(team.id))}>
                    <Users size={13} aria-hidden="true" /> {team.name}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {teamIds.length === 0 ? t('okrModal.visibilityWholeOrg') : t('okrModal.visibilityTeams')}
              </p>
            </div>

            <Separator />

            <TeamOKRKeyResultsEditor keyResults={keyResults} onChange={setKeyResults} projects={activeProjects} />
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
