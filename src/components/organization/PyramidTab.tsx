import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Move, Users, ArrowUpFromLine, UserPlus } from 'lucide-react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useOrgTeams, useOrgTeamMembers, useCreateOrgTeam, useAddTeamMember, type OrgTeam } from '@/modules/org-teams';
import CreateTeamModal from './CreateTeamModal';
import {
  buildOrgTree,
  useSetMemberManager,
  useRemoveMember,
  type OrgMember,
} from '@/modules/organizations';
import {
  UNPLACED_DROP_ID,
  collapsedStorageKey,
  normalize,
  readCollapsedIds,
  canManage,
} from './pyramid.helpers';
import { usePyramidDnd } from './usePyramidDnd';
import PyramidToolbar from './PyramidToolbar';
import UnplacedMembersPanel from './UnplacedMembersPanel';
import { useTeamTasks } from '@/modules/team-projects';
import { readEntityParam } from './deep-link.helpers';
import { memberWorkload } from './team-stats.helpers';
import MemberAvatar from './MemberAvatar';
import MemberPlacementSheet from './MemberPlacementSheet';
import AddUnderSheet from './AddUnderSheet';
import MemberSheet from './MemberSheet';
import { MEMBER_TAB_PARAM } from './member-sheet.helpers';
import ReassignManagerSheet from './ReassignManagerSheet';
import ConfirmRemoveMemberDialog from './ConfirmRemoveMemberDialog';
import { useT } from '@/i18n/useT';
import RichText from '@/components/ui/rich-text';
import { NodeCard, PyramidSkeleton } from './PyramidNodeCard';

interface PyramidTabProps {
  orgId: string;
  ownerId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  /** Chargement initial des membres — affiche le skeleton pyramide. */
  loading?: boolean;
}

// Logique pure extraite dans `pyramid.helpers.ts` (audit archi 2026-08-07, M1) :
// ce sont les seules fonctions de ce fichier qui DÉCIDENT quelque chose
// (autorisation de déplacement, interdiction des cycles, recherche), donc les
// seules qui méritaient des tests. Elles y sont couvertes.
const EMPTY_SET = new Set<string>();



/**
 * Onglet Pyramide — org-chart N+1. Desktop : arbre centré ; mobile : liste
 * indentée. Chaque carte a un menu « ⋯ » : ajouter un collaborateur (sheet
 * invitation/déplacement) ou déplacer par drag & drop — la carte se glisse
 * sur son nouveau responsable (pointer events, souris + tactile), avec
 * cibles valides surlignées et zone « Détacher » pour les admins.
 */
const PyramidTab = ({ orgId, ownerId, members, currentUserId, isAdmin, loading }: PyramidTabProps) => {
  const { t } = useT('org');
  const isMobile = useIsMobile();
  // Le GESTE (saisir une carte, la suivre au pointeur, valider ou annuler un
  // déplacement) vit dans `usePyramidDnd` : il ne connaît ni la recherche, ni
  // les vues par équipe, ni les fiches membre. Cet écran garde tout le reste.
  const {
    dragging,
    setDragging,
    ghost,
    hoverDropId,
    flashId,
    announcement,
    editMode,
    moveCount,
    canEdit,
    startEdit,
    finishEdit,
    cancelEdit,
    grabMember,
    drop,
    drag,
    scrollContainerRef,
    onBackgroundPointerDown,
  } = usePyramidDnd({ orgId, members, currentUserId, isAdmin });
  const [placing, setPlacing] = useState<OrgMember | null>(null);
  const [addingUnder, setAddingUnder] = useState<OrgMember | null>(null);
  // Fiche membre unifiée (item #18) : profil, tâches, contribution, agenda —
  // un seul sheet, ouvert sur l'onglet demandé. `tab` reste une chaîne brute
  // ici : seul `MemberSheet` connaît les onglets AUTORISÉS pour ce membre, et
  // c'est lui qui valide (une URL forgée ne doit pas ouvrir un onglet interdit).
  const [sheet, setSheet] = useState<{ member: OrgMember; tab: string | null } | null>(null);

  // ─── Deep-link `?member=<id>&memberTab=<tab>` ───────────────────────
  // Le helper `readEntityParam` accepte 'member' depuis la vague 1 mais rien ne
  // le consommait : une fiche membre n'était donc pas partageable.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepMemberId = readEntityParam(searchParams, 'member');
  const deepMemberTab = searchParams.get(MEMBER_TAB_PARAM);

  useEffect(() => {
    if (!deepMemberId) return;
    const target = members.find((m) => m.userId === deepMemberId);
    // Les membres arrivent en asynchrone : tant qu'ils ne sont pas là, on garde
    // le paramètre et l'effet se rejoue au chargement suivant.
    if (!target) return;
    setSheet({ member: target, tab: deepMemberTab });
    // Nettoyage : sans lui, refermer la fiche la rouvrirait au rendu suivant,
    // l'URL restant la source de vérité.
    const next = new URLSearchParams(searchParams);
    next.delete('member');
    next.delete(MEMBER_TAB_PARAM);
    setSearchParams(next, { replace: true });
  }, [deepMemberId, deepMemberTab, members, searchParams, setSearchParams]);
  // Retrait d'un membre AVEC subordonnés : on choisit d'abord leur nouveau manager.
  const [reassigning, setReassigning] = useState<OrgMember | null>(null);
  // Retrait d'un membre SANS subordonné : modal de confirmation (#3).
  const [removing, setRemoving] = useState<OrgMember | null>(null);

  // ─── Calque de charge (item #28) ────────────────────────────────────
  // Désactivé par défaut : la pyramide sert d'abord à lire l'organisation, et
  // une barre sur chaque carte en permanence brouillerait cette lecture.
  const [showWorkload, setShowWorkload] = useState(false);
  const { data: workloadTasks = [] } = useTeamTasks(showWorkload ? orgId : undefined);
  const workloadByUser = useMemo(() => {
    if (!showWorkload) return undefined;
    return new Map(memberWorkload(workloadTasks, members).map((w) => [w.userId, w]));
  }, [showWorkload, workloadTasks, members]);
  // Recherche de membre (surligne + déplie + scrolle jusqu'au premier résultat).
  const [query, setQuery] = useState('');
  // Nœuds repliés — persistés par organisation (l'org est mémorisée pour ne
  // pas écraser le storage d'une autre org lors d'un changement d'org active).
  const [collapsed, setCollapsed] = useState<{ org: string; ids: Set<string> }>(() => ({
    org: orgId,
    ids: readCollapsedIds(orgId),
  }));
  // Fades de scroll horizontal (desktop) : y a-t-il du contenu hors-champ ?
  const [scrollShadow, setScrollShadow] = useState({ left: false, right: false });
  // Vue : null = toute l'entreprise ; sinon id d'équipe (membres de l'équipe +
  // leur chaîne hiérarchique jusqu'à l'admin).
  const [viewTeamId, setViewTeamId] = useState<string | null>(null);
  const setManager = useSetMemberManager();
  const removeMember = useRemoveMember();
  const { data: orgTeams = [] } = useOrgTeams(orgId);
  const { data: orgTeamMembers = [] } = useOrgTeamMembers(orgId);
  const createTeam = useCreateOrgTeam(orgId);
  const addTeamMember = useAddTeamMember(orgId);
  const [showNewTeam, setShowNewTeam] = useState(false);

  // Crée l'équipe PUIS y ajoute les membres choisis — même séquence que
  // TeamsSection.handleCreateFull, seul point d'entrée dupliqué ici parce que
  // le sélecteur de vue de la pyramide est un second endroit légitime pour
  // créer une équipe (on y regarde déjà « par équipe »).
  const handleCreateTeamFull = async (input: { name: string; color: string }, memberIds: string[]) => {
    const team = await createTeam.mutateAsync(input);
    for (const userId of memberIds) {
      await addTeamMember.mutateAsync({ teamId: team.id, userId });
    }
    setViewTeamId(team.id);
  };

  // Membres visibles selon la vue. Vue équipe : chaque membre de l'équipe + ses
  // ancêtres jusqu'à la racine (les liens managerId restent donc intacts).
  const visibleMembers = useMemo(() => {
    if (!viewTeamId) return members;
    const teamIds = new Set(
      orgTeamMembers.filter((tm) => tm.teamId === viewTeamId).map((tm) => tm.userId),
    );
    const byId = new Map(members.map((m) => [m.userId, m]));
    const keep = new Set<string>();
    for (const uid of teamIds) {
      let cur: string | null | undefined = uid;
      for (let i = 0; i < 50 && cur && !keep.has(cur); i++) {
        keep.add(cur);
        cur = byId.get(cur)?.managerId ?? null;
      }
    }
    return members.filter((m) => keep.has(m.userId));
  }, [viewTeamId, orgTeamMembers, members]);

  // L'équipe sélectionnée n'existe plus (supprimée) → retour à la vue globale.
  const activeTeam = viewTeamId ? orgTeams.find((t) => t.id === viewTeamId) ?? null : null;
  useEffect(() => {
    if (viewTeamId && orgTeams.length > 0 && !orgTeams.some((t) => t.id === viewTeamId)) {
      setViewTeamId(null);
    }
  }, [viewTeamId, orgTeams]);

  // Retrait d'un membre (admin). Sans subordonné direct : modal de
  // confirmation (#3). Avec subordonnés : d'abord le choix de leur nouveau
  // responsable (ReassignManagerSheet).
  const handleRemove = (m: OrgMember) => {
    const hasReports = members.some((x) => x.managerId === m.userId);
    if (hasReports) setReassigning(m);
    else setRemoving(m);
  };

  // Réassigne les subordonnés directs de `member` à `newManagerId` (null =
  // détacher), puis retire `member`. La hiérarchie SOUS ces subordonnés est
  // préservée (on ne touche qu'à leur rattachement de premier niveau).
  const performRemoveWithReassign = async (member: OrgMember, newManagerId: string | null) => {
    const directs = members.filter((x) => x.managerId === member.userId);
    for (const c of directs) {
      await setManager.mutateAsync({ orgId, userId: c.userId, managerId: newManagerId, silent: true });
    }
    await removeMember.mutateAsync({ orgId, userId: member.userId });
    setReassigning(null);
  };

  // Équipes transverses par membre (pastilles couleur sur les cartes).
  const teamsByUser = useMemo(() => {
    const byId = new Map(orgTeams.map((t) => [t.id, t]));
    const map = new Map<string, OrgTeam[]>();
    for (const tm of orgTeamMembers) {
      const team = byId.get(tm.teamId);
      if (!team) continue;
      const arr = map.get(tm.userId) ?? [];
      arr.push(team);
      map.set(tm.userId, arr);
    }
    return map;
  }, [orgTeams, orgTeamMembers]);


  const { roots, unplaced } = buildOrgTree(visibleMembers, ownerId);
  const selfMember = members.find((m) => m.userId === currentUserId) ?? null;

  // ── Replier/déplier (persisté par org) ─────────────────────────────
  useEffect(() => {
    if (collapsed.org !== orgId) setCollapsed({ org: orgId, ids: readCollapsedIds(orgId) });
  }, [orgId, collapsed.org]);

  useEffect(() => {
    if (collapsed.org !== orgId) return;
    try {
      localStorage.setItem(collapsedStorageKey(orgId), JSON.stringify([...collapsed.ids]));
    } catch {
      // Quota localStorage plein : l'état replié n'est simplement pas persisté.
    }
  }, [collapsed, orgId]);

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const ids = new Set(prev.ids);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return { org: prev.org, ids };
    });

  // ── Recherche ──────────────────────────────────────────────────────
  const matchIds = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return EMPTY_SET;
    return new Set(visibleMembers.filter((m) => normalize(m.displayName).includes(q)).map((m) => m.userId));
  }, [query, visibleMembers]);

  // Pendant une recherche, tout est déplié pour que les résultats soient visibles.
  const effectiveCollapsedIds = matchIds.size > 0 || query.trim() ? EMPTY_SET : collapsed.ids;

  // Scroll doux vers le premier résultat quand la recherche change.
  useEffect(() => {
    if (matchIds.size === 0) return;
    const t = setTimeout(() => {
      document
        .querySelector('[data-match]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 120);
    return () => clearTimeout(t);
  }, [matchIds]);

  // ── Fades de scroll horizontal (desktop) ───────────────────────────
  const updateScrollShadow = () => {
    const c = scrollContainerRef.current;
    if (!c) return;
    setScrollShadow((prev) => {
      const left = c.scrollLeft > 4;
      const right = c.scrollLeft + c.clientWidth < c.scrollWidth - 4;
      return prev.left === left && prev.right === right ? prev : { left, right };
    });
  };

  useEffect(() => {
    updateScrollShadow();
    window.addEventListener('resize', updateScrollShadow);
    return () => window.removeEventListener('resize', updateScrollShadow);
  }, [members, isMobile, loading]);

  if (loading) return <PyramidSkeleton />;

  return (
    <div className="space-y-6">
      {/* Bandeau mode déplacement — sticky pour rester visible en scrollant */}
      {dragging && (
        <div className="sticky top-2 z-30 flex items-center justify-between gap-3 rounded-2xl border border-indigo-400/60 bg-indigo-50/95 dark:bg-indigo-950/90 backdrop-blur px-4 py-3 shadow-lg">
          <p className="text-sm text-[rgb(var(--color-text-primary))] inline-flex items-center gap-2 min-w-0">
            <Move size={15} className="text-indigo-500 shrink-0" aria-hidden="true" />
            <span className="truncate">
              <RichText strongClassName="font-semibold">{t('pyramid.dragBanner', { name: dragging.displayName })}</RichText>
            </span>
          </p>
          <button
            type="button"
            onClick={() => setDragging(null)}
            className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] px-3 py-1.5 rounded-lg border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] shrink-0 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* Zone « Détacher » pendant un déplacement (admin) */}
      {dragging && isAdmin && dragging.managerId !== null && (
        <button
          type="button"
          data-drop-id={UNPLACED_DROP_ID}
          onClick={() => drop(UNPLACED_DROP_ID)}
          aria-label={t('pyramid.detachAria', { name: dragging.displayName })}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm transition-colors ${
            hoverDropId === UNPLACED_DROP_ID
              ? 'border-amber-500 ring-2 ring-amber-500/40 text-amber-600 dark:text-amber-400'
              : 'border-amber-400/60 text-[rgb(var(--color-text-muted))] hover:border-amber-500'
          }`}
        >
          <ArrowUpFromLine size={15} aria-hidden="true" /> {t('pyramid.detach')}
        </button>
      )}

      {/* Non placés — mobile (et pyramide vide) : section en haut. Desktop : barre latérale droite. */}
      {(isMobile || roots.length === 0) && (
        <UnplacedMembersPanel
          variant="section"
          members={unplaced}
          isAdmin={isAdmin}
          onPlace={setPlacing}
        />
      )}

      {/* Pyramide */}
      {roots.length === 0 && !viewTeamId ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-4">
            <Users size={26} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1.5">
            {t('pyramid.emptyTitle')}
          </p>
          <p className="text-sm text-[rgb(var(--color-text-muted))] max-w-sm mb-5">
            {t('pyramid.intro')}
          </p>
          {selfMember && canEdit && (
            <button
              type="button"
              onClick={() => setAddingUnder(selfMember)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              <UserPlus size={16} aria-hidden="true" /> {t('pyramid.inviteFirst')}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Recherche + bouton Modifier/Annuler (toujours visible) */}
          <PyramidToolbar
            query={query}
            onQueryChange={setQuery}
            matchCount={matchIds.size}
            teams={orgTeams}
            activeTeam={activeTeam}
            viewTeamId={viewTeamId}
            onViewTeamChange={setViewTeamId}
            isAdmin={isAdmin}
            onCreateTeam={() => setShowNewTeam(true)}
            canEdit={canEdit}
            editMode={editMode}
            moveCount={moveCount}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onFinishEdit={finishEdit}
            canAddUnderSelf={selfMember !== null}
            onAddUnderSelf={() => selfMember && setAddingUnder(selfMember)}
            showWorkload={showWorkload}
            onToggleWorkload={() => setShowWorkload((v) => !v)}
          />
          {showNewTeam && (
            <CreateTeamModal
              members={members}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onSubmit={handleCreateTeamFull}
              onClose={() => setShowNewTeam(false)}
            />
          )}

          {/* Bandeau mode réorganisation */}
          {editMode && !dragging && (
            <div className="flex items-center gap-2 rounded-2xl border border-indigo-400/60 bg-indigo-50/60 dark:bg-indigo-900/15 px-4 py-3 mb-3">
              <Move size={15} className="text-indigo-500 shrink-0" aria-hidden="true" />
              <p className="text-sm text-[rgb(var(--color-text-primary))]">
                {t('pyramid.reorgBanner')}
              </p>
            </div>
          )}
          {/* Légende des équipes transverses */}
          {orgTeams.length > 0 && !dragging && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
              {orgTeams.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1.5 text-[11px] text-[rgb(var(--color-text-muted))]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} aria-hidden="true" />
                  {t.name}
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            {/* Fades : signalent du contenu hors-champ à gauche/droite (desktop) */}
            {!isMobile && scrollShadow.left && (
              <div className="pointer-events-none absolute inset-y-0 left-0 w-10 z-10 bg-gradient-to-r from-[rgb(var(--color-background))] to-transparent" aria-hidden="true" />
            )}
            {!isMobile && scrollShadow.right && (
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-[rgb(var(--color-background))] to-transparent" aria-hidden="true" />
            )}
            <div
              ref={scrollContainerRef}
              onScroll={updateScrollShadow}
              onPointerDown={onBackgroundPointerDown}
              className={isMobile ? 'space-y-3' : 'overflow-x-auto pb-4'}
            >
          {roots.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                {t('pyramid.noMemberInTeam')}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
                {t('pyramid.addMembersHint')}
              </p>
            </div>
          ) : (
          <div className={isMobile ? 'space-y-3' : 'flex flex-col items-center gap-8 min-w-fit mx-auto'}>
            {roots.map((root) => (
              <NodeCard
                key={root.member.userId}
                workloadByUser={workloadByUser}
                node={root}
                members={members}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onStartDrag={setDragging}
                onAddUnder={setAddingUnder}
                onRemove={handleRemove}
                onGrab={grabMember}
                drag={drag}
                flashId={flashId}
                collapsedIds={effectiveCollapsedIds}
                onToggleCollapse={toggleCollapse}
                matchIds={matchIds}
                teamsByUser={teamsByUser}
                onOpenMember={(mem, tab) => setSheet({ member: mem, tab })}
                editMode={editMode}
                depth={0}
                mobile={isMobile}
              />
            ))}
            </div>
          )}
          </div>
          </div>
        </div>

        {/* Barre latérale droite : personnes à placer (desktop) */}
        {!isMobile && (
          <UnplacedMembersPanel
            variant="sidebar"
            members={unplaced}
            isAdmin={isAdmin}
            onPlace={setPlacing}
            onGrab={grabMember}
            draggingId={dragging?.userId ?? null}
            isDragging={dragging !== null}
          />
        )}
        </div>
      )}

      {/* Fantôme qui suit le pointeur pendant le glisser */}
      {dragging && ghost && (
        <div
          className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: ghost.x, top: ghost.y }}
          aria-hidden="true"
        >
          <div className="flex items-center gap-2 rounded-xl border border-indigo-400 bg-[rgb(var(--color-surface))] px-3 py-2 shadow-2xl">
            <MemberAvatar avatar={dragging.avatar} name={dragging.displayName} size={26} />
            <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{dragging.displayName}</span>
          </div>
        </div>
      )}

      {placing && (
        <MemberPlacementSheet
          orgId={orgId}
          target={placing}
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setPlacing(null)}
        />
      )}

      {/* Annonce lecteur d'écran après un déplacement */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {sheet && (
        <MemberSheet
          orgId={orgId}
          member={sheet.member}
          members={members}
          teams={teamsByUser.get(sheet.member.userId) ?? []}
          currentUserId={currentUserId}
          canMove={canManage(sheet.member, members, currentUserId, isAdmin)}
          canAddUnder={isAdmin || sheet.member.userId === currentUserId || canManage(sheet.member, members, currentUserId, isAdmin)}
          // Mêmes droits que l'ancien menu ⋯ : supérieur hiérarchique
          // uniquement (admin partout, manager sur son sous-arbre), jamais soi.
          canSeeInsights={canManage(sheet.member, members, currentUserId, isAdmin)}
          canSeeAgenda={canManage(sheet.member, members, currentUserId, isAdmin)}
          initialTab={sheet.tab}
          onClose={() => setSheet(null)}
          onMove={setDragging}
          onAddUnder={setAddingUnder}
        />
      )}

      {removing && (
        <ConfirmRemoveMemberDialog
          member={removing}
          pending={removeMember.isPending}
          onConfirm={() =>
            removeMember.mutate(
              { orgId, userId: removing.userId },
              { onSettled: () => setRemoving(null) },
            )
          }
          onCancel={() => setRemoving(null)}
        />
      )}

      {reassigning && (
        <ReassignManagerSheet
          member={reassigning}
          members={members}
          ownerId={ownerId}
          currentUserId={currentUserId}
          onConfirm={(newManagerId) => performRemoveWithReassign(reassigning, newManagerId)}
          onCancel={() => setReassigning(null)}
        />
      )}

      {addingUnder && (
        <AddUnderSheet
          orgId={orgId}
          under={addingUnder}
          currentUserId={currentUserId}
          onClose={() => setAddingUnder(null)}
        />
      )}
    </div>
  );
};

export default PyramidTab;
