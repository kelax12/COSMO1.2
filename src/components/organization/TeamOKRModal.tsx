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
  useKRProjects,
  useSetKRProjects,
  teamOkrKeys,
  type TeamOKR,
  type TeamOKRAudience,
  type CreateTeamKRInput,
  type SyncTeamKRInput,
} from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import { useOrgMembers } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';
import TeamCategoryTreeSelect from './TeamCategoryTreeSelect';
import { useT } from '@/i18n/useT';
import MemberPickList from './MemberPickList';
import TeamPickList from './TeamPickList';

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
  const { t: tOrgAdmin } = useT('orgAdmin');
  const isEdit = !!editingOKR;
  const { data: teams = [] } = useOrgTeams(orgId);
  const createOKR = useCreateTeamOKR(orgId);
  const editOKR = useEditTeamOKR(orgId);
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
  // Le champ « Contribue à l'objectif » est retiré de la fiche (2026-10-01) ;
  // le lien existant est conservé tel quel à l'enregistrement.
  const parentOkrId = editingOKR?.parentOkrId ?? null;
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
      // « Toute l'entreprise » ne garde aucun lien ; seules les personnes
      // d'un OKR « Personnaliser » sont écrites (mig. 205).
      teamIds: visMode === 'org' ? [] : teamIds,
      audience: visMode,
      memberIds: visMode === 'custom' ? memberIds : [],
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
  const [visMode, setVisMode] = useState<TeamOKRAudience>(
    editingOKR?.audience ?? (teamIds.length > 0 ? 'teams' : 'org'),
  );
  // Personnes nommées d'un OKR « Personnaliser » (mig. 205).
  const [memberIds, setMemberIds] = useState<string[]>(editingOKR?.memberIds ?? []);
  const chooseVisMode = (mode: TeamOKRAudience) => {
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
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg md:max-w-[863px] xl:max-w-[971px] rounded-l-2xl border-l-0 overflow-hidden">
        <SheetHeader className="border-b border-[rgb(var(--color-border-muted))]">
          <span className="font-data text-caption uppercase tracking-[0.08em] text-[rgb(var(--color-text-muted))]">{tOrgAdmin('okrModal.eyebrow')}</span>
          <SheetTitle>{isEdit ? tOrgAdmin('okrModal.edit') : tOrgAdmin('okrModal.new')}</SheetTitle>
          <SheetDescription className="sr-only">{tOrgAdmin('okrModal.description')}</SheetDescription>
        </SheetHeader>

        {/* min-h-0 : sans lui, l'enfant flex-1 garde sa hauteur de contenu et le
            viewport Radix ne scrolle jamais (flexbox min-height:auto). */}
        <ScrollArea className="flex-1 min-h-0">
          {/* Tous les champs sur fond surface (blanc en thème clair), y compris
              les déclencheurs de listes (date, catégorie, objectif parent). */}
          <div className="grid md:grid-cols-[0.923fr_1fr] [&_input]:!bg-[rgb(var(--color-surface))] [&_textarea]:!bg-[rgb(var(--color-surface))] [&_select]:!bg-[rgb(var(--color-surface))] [&_button[aria-haspopup]]:!bg-[rgb(var(--color-surface))]">
            {/* Colonne gauche : le cadre de l'objectif. */}
            <div className="grid content-start gap-4 p-4 md:border-r md:border-[rgb(var(--color-border-muted))]">
              <div className="grid gap-2">
                <Label htmlFor="tokr-title">{tOrgAdmin('okrModal.objective')}</Label>
                <Input id="tokr-title" value={title} autoFocus className="h-11 rounded-xl" placeholder={tOrgAdmin('okrModal.objectivePlaceholder')} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="tokr-end">{tOrgAdmin('okrModal.deadline')}</Label>
                  {/* LE calendrier de l'app (Popover + Calendar), pas l'input
                      natif. Icône teintée en accent via `[&_svg]`. Police du
                      texte courant, comme les autres champs (pas `font-data`). */}
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    className="w-full min-h-11 rounded-xl font-sans [&_svg]:text-[rgb(var(--color-accent))]"
                  />
                </div>
                {/* Catégorie — vrai système partagé (parité mode perso, #C) */}
                <div className="grid gap-2">
                  <Label>{tOrgAdmin('okrModal.category')}</Label>
                  <TeamCategoryTreeSelect orgId={orgId} value={categoryId} onChange={setCategoryId} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tokr-desc">{tOrgAdmin('okrModal.descriptionLabel')}</Label>
                <Textarea id="tokr-desc" rows={2} value={description} placeholder={tOrgAdmin('okrModal.descPlaceholder')} onChange={(e) => setDescription(e.target.value)} />
              </div>

              {/* Rattachement d'équipes (cloisonnement de visibilité) */}
              <div className="grid gap-2">
                <Label id="tokr-vis">{tOrgAdmin('okrModal.visibility')}</Label>
                <div role="radiogroup" aria-labelledby="tokr-vis" className="flex gap-1 rounded-xl bg-[rgb(var(--color-border-muted))] p-1">
                  <button type="button" role="radio" aria-checked={visMode === 'org'} onClick={() => chooseVisMode('org')} className={segClass(visMode === 'org')}>
                    <Building2 size={12} className="mr-1 inline" aria-hidden="true" />{tOrgAdmin('okrModal.wholeOrg')}
                  </button>
                  <button type="button" role="radio" aria-checked={visMode === 'teams'} onClick={() => chooseVisMode('teams')} className={segClass(visMode === 'teams')}>
                    {tOrgAdmin('okrModal.teamsOption')}
                  </button>
                  <button type="button" role="radio" aria-checked={visMode === 'custom'} onClick={() => chooseVisMode('custom')} className={segClass(visMode === 'custom')}>
                    {tOrgAdmin('okrModal.customOption')}
                  </button>
                </div>
                {visMode !== 'org' && teams.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-[rgb(var(--color-border))]">
                    <TeamPickList teams={teams} value={teamIds} onChange={setTeamIds} label={tOrgAdmin('okrModal.teamsOption')} />
                  </div>
                )}
                {visMode === 'custom' && (
                  <div className="grid gap-1.5">
                    <span className="font-data text-caption uppercase tracking-[0.06em] text-[rgb(var(--color-text-muted))]">{tOrgAdmin('okrModal.customPeople')}</span>
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-[rgb(var(--color-border))]">
                      <MemberPickList
                        members={members}
                        value={memberIds}
                        onChange={(next) => setMemberIds(next.slice(0, 50))}
                        currentUserId={user?.id}
                        label={tOrgAdmin('okrModal.customPeople')}
                        alwaysSearchable
                      />
                    </div>
                  </div>
                )}
                <p className="text-muted-foreground text-xs">
                  {visMode === 'org'
                    ? tOrgAdmin('okrModal.visibilityWholeOrg')
                    : visMode === 'custom'
                      ? tOrgAdmin('okrModal.visibilityCustom')
                      : teamIds.length > 0
                        ? tOrgAdmin('okrModal.visibilityTeams')
                        : tOrgAdmin('okrModal.visibilityNoneChosen')}
                </p>
              </div>
            </div>

            {/* Colonne droite : les résultats clés. */}
            <div className="grid content-start gap-3 bg-[rgb(var(--color-background))] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>{tOrgAdmin('okrModal.keyResults')}</Label>
                  <span className="rounded-full bg-[rgb(var(--color-accent)/0.1)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[rgb(var(--color-accent))]">
                    {keyResults.length}
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
                // Les quatre valeurs (actuel, cible, unité, coef.) sont repliées et
                // se déplient au SURVOL de la carte, même avec un seul KR (gain de
                // place, 2026-10-01). Le focus ne garde ouvert que s'il est DANS
                // ces valeurs (clavier, ou saisie en cours). Sans pointeur fin,
                // toujours ouvert. Animation coupée sous mouvement réduit. Projets
                // reliés et contributeurs ne sont plus montrés ici : la fiche les
                // conserve tels quels à l'enregistrement.
                const compact = keyResults.length > 1;
                const pct = kr.targetValue > 0 ? Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100)) : 0;
                return (
                  <div
                    key={kr.id ?? idx}
                    className="group rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3 transition-shadow hover:border-[rgb(var(--color-accent)/0.35)] hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={kr.title}
                        aria-label={tOrgAdmin('okrModal.krPlaceholder')}
                        placeholder={tOrgAdmin('okrModal.krPlaceholder')}
                        className="h-9 border-transparent px-1 text-sm font-medium shadow-none hover:border-[rgb(var(--color-border))] focus-visible:border-[rgb(var(--color-border))]"
                        onChange={(e) => setKR(idx, { title: e.target.value })}
                      />
                      <span className="shrink-0 text-sm font-semibold text-[rgb(var(--color-accent))] tabular-nums">
                        {kr.currentValue}
                        <span className="text-xs text-[rgb(var(--color-text-muted))]"> / {kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}</span>
                      </span>
                      {compact && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('common.removeKr')}
                          className="shrink-0 text-[rgb(var(--color-text-muted))] hover:text-destructive"
                          onClick={() => setKeyResults((p) => p.filter((_, i) => i !== idx))}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--color-border-muted))]">
                      <div className="h-full rounded-full bg-[rgb(var(--color-accent))] transition-[width]" style={{ width: `${pct}%` }} />
                    </div>

                    <div
                      className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none group-hover:grid-rows-[1fr] group-hover:opacity-100 focus-within:grid-rows-[1fr] focus-within:opacity-100 [@media(hover:none)]:grid-rows-[1fr] [@media(hover:none)]:opacity-100"
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="grid grid-cols-4 gap-2 pt-3">
                          <div className="grid gap-1">
                            <Label className="text-xs font-medium text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('okrModal.current')}</Label>
                            <Input type="number" min={0} className="h-9 tabular-nums" value={kr.currentValue} onChange={(e) => setKR(idx, { currentValue: Number(e.target.value) })} />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs font-medium text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('okrModal.target')}</Label>
                            <Input type="number" className="h-9 tabular-nums" value={kr.targetValue} onChange={(e) => setKR(idx, { targetValue: Number(e.target.value) })} />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs font-medium text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('okrModal.unit')}</Label>
                            <Input className="h-9" value={kr.unit} placeholder="%" onChange={(e) => setKR(idx, { unit: e.target.value })} />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs font-medium text-[rgb(var(--color-text-secondary))]" title={tOrgAdmin('okrModal.weightHint')}>{tOrgAdmin('okrModal.weight')}</Label>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              step={1}
                              className="h-9 tabular-nums"
                              value={kr.weight}
                              onChange={(e) => setKR(idx, { weight: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                      </div>
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
              {tOrgAdmin('okrModal.needOneKr')}
            </span>
          ) : (
            <span className="font-data mr-auto text-caption text-[rgb(var(--color-text-muted))]">
              {tOrgAdmin('okrModal.weightedProgress', { pct: weighted })}
            </span>
          )}
          <Button type="button" variant="outline" onClick={handleClose}>{tOrgAdmin('okrModal.cancel')}</Button>
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
            {isPending ? tOrgAdmin('okrModal.saving') : isEdit ? tOrgAdmin('okrModal.save') : tOrgAdmin('okrModal.create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
