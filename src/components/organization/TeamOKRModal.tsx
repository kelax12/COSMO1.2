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
import { Plus, Trash2, Building2 } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useOrgMembers } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';
import KRContributorsField from './KRContributorsField';
import TeamCategoryTreeSelect from './TeamCategoryTreeSelect';
import { OkrParentField, KRProjectsField } from './TeamOKRLinkFields';
import { useT } from '@/i18n/useT';
import TeamColorDot from './TeamColorDot';

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
  /** Contributeurs (mig. 160, `contributor_ids`). */
  contributorIds: string[];
  /**
   * Responsable et durée par unité : la fiche ne les montre pas, mais la
   * synchronisation écrit TOUS les champs du KR. Sans les reporter, modifier
   * un objectif remettait `assignee_id` à NULL et la durée à 30 min sur
   * chacun de ses KR (constaté le 2026-09-26).
   */
  assigneeId?: string | null;
  estimatedTime?: number;
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
  contributorIds: [],
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
  const { data: members = [] } = useOrgMembers(orgId);
  const { user } = useAuth();
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
          contributorIds: k.contributorIds ?? [],
          assigneeId: k.assigneeId ?? null,
          estimatedTime: k.estimatedTime,
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
    contributorIds: k.contributorIds,
    assigneeId: k.assigneeId ?? null,
    estimatedTime: k.estimatedTime,
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

  // Visibilité : « Équipes » reste ouvert même tant qu'aucune équipe n'est
  // cochée, sinon le segment se refermerait sous le premier clic.
  const [visMode, setVisMode] = useState<'org' | 'teams'>(teamIds.length > 0 ? 'teams' : 'org');
  const chooseVisMode = (mode: 'org' | 'teams') => {
    setVisMode(mode);
    if (mode === 'org') setTeamIds([]);
  };

  // Progression pondérée des KR valides, affichée en pied de fiche.
  const weighted = (() => {
    const valid = keyResults.filter((k) => k.title.trim() && Number(k.targetValue) > 0);
    const total = valid.reduce((sum, k) => sum + (Number(k.weight) || 1), 0);
    if (total === 0) return 0;
    const done = valid.reduce(
      (sum, k) => sum + (Number(k.weight) || 1) * Math.min(1, Math.max(0, Number(k.currentValue) / Number(k.targetValue))),
      0,
    );
    return Math.round((done / total) * 100);
  })();

  const segClass = (on: boolean) =>
    `flex-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
      on
        ? 'bg-[rgb(var(--color-surface))] font-semibold text-[rgb(var(--color-text-primary))] shadow-sm'
        : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
    }`;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg md:max-w-5xl xl:max-w-6xl rounded-l-2xl border-l-0 overflow-hidden">
        <SheetHeader className="border-b border-[rgb(var(--color-border-muted))]">
          <span className="font-data text-[10px] uppercase tracking-[0.08em] text-[rgb(var(--color-text-muted))]">{t('okrModal.eyebrow')}</span>
          <SheetTitle>{isEdit ? t('okrModal.edit') : t('okrModal.new')}</SheetTitle>
          <SheetDescription className="sr-only">{t('okrModal.description')}</SheetDescription>
        </SheetHeader>

        {/* min-h-0 : sans lui, l'enfant flex-1 garde sa hauteur de contenu et le
            viewport Radix ne scrolle jamais (flexbox min-height:auto). */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="grid md:grid-cols-[1fr_1.2fr]">
            {/* Colonne gauche : le cadre de l'objectif. */}
            <div className="grid content-start gap-4 p-4 md:border-r md:border-[rgb(var(--color-border-muted))]">
              <div className="grid gap-2">
                <Label htmlFor="tokr-title">{t('okrModal.objective')}</Label>
                <Input id="tokr-title" value={title} autoFocus placeholder={t('okrModal.objectivePlaceholder')} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="tokr-end">{t('okrModal.deadline')}</Label>
                  {/* LE calendrier de l'app (Popover + Calendar), pas l'input
                      natif. Icône teintée en accent via `[&_svg]`. */}
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    className="w-full min-h-11 rounded-xl font-data [&_svg]:text-[rgb(var(--color-accent))]"
                  />
                </div>
                {/* Catégorie — vrai système partagé (parité mode perso, #C) */}
                <div className="grid gap-2">
                  <Label>{t('okrModal.category')}</Label>
                  <TeamCategoryTreeSelect orgId={orgId} value={categoryId} onChange={setCategoryId} />
                </div>
              </div>

              {/* Objectif parent (mig. 160) : l'objectif que cet OKR sert. */}
              <OkrParentField okrs={allOkrs} selfId={editingOKR?.id} value={parentOkrId} onChange={setParentOkrId} />

              <div className="grid gap-2">
                <Label htmlFor="tokr-desc">{t('okrModal.descriptionLabel')}</Label>
                <Textarea id="tokr-desc" rows={2} value={description} placeholder={t('okrModal.descPlaceholder')} onChange={(e) => setDescription(e.target.value)} />
              </div>

              {/* Rattachement d'équipes (cloisonnement de visibilité) */}
              <div className="grid gap-2">
                <Label id="tokr-vis">{t('okrModal.visibility')}</Label>
                <div role="radiogroup" aria-labelledby="tokr-vis" className="flex gap-1 rounded-xl bg-[rgb(var(--color-border-muted))] p-1">
                  <button type="button" role="radio" aria-checked={visMode === 'org'} onClick={() => chooseVisMode('org')} className={segClass(visMode === 'org')}>
                    <Building2 size={12} className="mr-1 inline" aria-hidden="true" />{t('okrModal.wholeOrg')}
                  </button>
                  <button type="button" role="radio" aria-checked={visMode === 'teams'} onClick={() => chooseVisMode('teams')} className={segClass(visMode === 'teams')}>
                    {t('okrModal.teamsOption')}
                  </button>
                </div>
                {visMode === 'teams' && (
                  <div className="flex flex-wrap gap-1.5">
                    {teams.map((team) => {
                      const active = teamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleTeam(team.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            active
                              ? 'border-[rgb(var(--color-accent)/0.35)] bg-[rgb(var(--color-accent)/0.1)] font-semibold text-[rgb(var(--color-accent))]'
                              : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))]'
                          }`}
                        >
                          <TeamColorDot color={team.color} /> {team.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-muted-foreground text-xs">
                  {teamIds.length === 0
                    ? t('okrModal.visibilityWholeOrg')
                    : t('okrModal.visibilityTeams')}
                </p>
              </div>
            </div>

            {/* Colonne droite : les résultats clés. */}
            <div className="grid content-start gap-3 bg-[rgb(var(--color-background))] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>{t('okrModal.keyResults')}</Label>
                  <span className="font-data rounded-full bg-[rgb(var(--color-accent)/0.1)] px-2 py-px text-[10px] text-[rgb(var(--color-accent))]">
                    {String(keyResults.length).padStart(2, '0')}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setKeyResults((p) => (p.length < 10 ? [...p, newKR()] : p))}
                  disabled={keyResults.length >= 10}
                  className="h-7 border-[rgb(var(--color-accent)/0.35)] text-xs font-semibold text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent)/0.08)]"
                >
                  <Plus aria-hidden="true" /> {t('common.add')}
                </Button>
              </div>

              {keyResults.map((kr, idx) => {
                const pct = kr.targetValue > 0 ? Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100)) : 0;
                return (
                  // Détails (actuel, cible, unité, coef., projets, contributeurs)
                  // montrés au survol ET au focus : le survol n'existe ni au
                  // clavier ni au doigt, et un champ ne doit pas disparaître
                  // pendant qu'on le remplit. Sans pointeur fin : toujours ouverts.
                  <div
                    key={kr.id ?? idx}
                    className="group rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3 transition-shadow hover:border-[rgb(var(--color-accent)/0.35)] hover:shadow-md focus-within:border-[rgb(var(--color-accent)/0.35)] focus-within:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={kr.title}
                        aria-label={t('okrModal.krPlaceholder')}
                        placeholder={t('okrModal.krPlaceholder')}
                        className="h-8 border-transparent px-1 font-semibold shadow-none hover:border-[rgb(var(--color-border))] focus-visible:border-[rgb(var(--color-border))]"
                        onChange={(e) => setKR(idx, { title: e.target.value })}
                      />
                      <span className="font-data shrink-0 text-base text-[rgb(var(--color-accent))] tabular-nums">
                        {kr.currentValue}
                        <span className="text-xs text-[rgb(var(--color-text-muted))]"> / {kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--color-border-muted))]">
                      <div className="h-full rounded-full bg-[rgb(var(--color-accent))] transition-[width]" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="hidden gap-3 pt-3 group-hover:grid group-focus-within:grid [@media(hover:none)]:grid">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="grid gap-1">
                          <Label className="text-muted-foreground text-[10px] uppercase tracking-wide">{t('okrModal.current')}</Label>
                          <Input type="number" min={0} className="h-8 font-data" value={kr.currentValue} onChange={(e) => setKR(idx, { currentValue: Number(e.target.value) })} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-muted-foreground text-[10px] uppercase tracking-wide">{t('okrModal.target')}</Label>
                          <Input type="number" className="h-8 font-data" value={kr.targetValue} onChange={(e) => setKR(idx, { targetValue: Number(e.target.value) })} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-muted-foreground text-[10px] uppercase tracking-wide">{t('okrModal.unit')}</Label>
                          <Input className="h-8" value={kr.unit} placeholder="%" onChange={(e) => setKR(idx, { unit: e.target.value })} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-muted-foreground text-[10px] uppercase tracking-wide" title={t('okrModal.weightHint')}>{t('okrModal.weight')}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            step={1}
                            className="h-8 font-data"
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
                      {/* #10 : un OKR ne s'assigne pas à une personne, il se
                          rattache à des équipes. Ses KR, eux, ont des
                          contributeurs (mig. 160, audit du 2026-09-24). */}
                      <KRContributorsField
                        orgId={orgId}
                        members={members}
                        value={kr.contributorIds}
                        onChange={(contributorIds) => setKR(idx, { contributorIds })}
                        currentUserId={user?.id}
                      />
                      {keyResults.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="justify-self-end text-destructive" onClick={() => setKeyResults((p) => p.filter((_, i) => i !== idx))}>
                          <Trash2 aria-hidden="true" /> {t('common.removeKr')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row items-center justify-end gap-2 border-t">
          {!hasKeyResult ? (
            <span className="text-xs text-amber-600 dark:text-amber-400 mr-auto" role="status">
              {t('okrModal.needOneKr')}
            </span>
          ) : (
            <span className="font-data mr-auto text-[11px] text-[rgb(var(--color-text-muted))]">
              {t('okrModal.weightedProgress', { pct: weighted })}
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
