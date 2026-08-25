import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  UserPlus,
  ChevronDown,
  Move,
  Users,
  ArrowUpFromLine,
  GripVertical,
  Search,
  X,
  Pencil,
  Check,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { showUndoToast } from '@/lib/undo-toast';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useOrgTeams, useOrgTeamMembers, useCreateOrgTeam, useAddTeamMember, type OrgTeam } from '@/modules/org-teams';
import CreateTeamModal from './CreateTeamModal';
import {
  buildOrgTree,
  isManagerOf,
  subtreeOf,
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
  isValidDestination,
} from './pyramid.helpers';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
import { NodeCard, PyramidSkeleton, type DragState } from './PyramidNodeCard';

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
  const { t, tp } = useT('org');
  const isMobile = useIsMobile();
  const [dragging, setDragging] = useState<OrgMember | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [hoverDropId, setHoverDropId] = useState<string | null>(null);
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
  // Annonce lecteur d'écran après un déplacement (aria-live).
  const [announcement, setAnnouncement] = useState('');
  // Mode réorganisation : toutes les cartes déplaçables sont draggables ;
  // les déplacements de la session sont journalisés pour pouvoir tout annuler.
  const [editMode, setEditMode] = useState(false);

  // ─── Calque de charge (item #28) ────────────────────────────────────
  // Désactivé par défaut : la pyramide sert d'abord à lire l'organisation, et
  // une barre sur chaque carte en permanence brouillerait cette lecture.
  const [showWorkload, setShowWorkload] = useState(false);
  const { data: workloadTasks = [] } = useTeamTasks(showWorkload ? orgId : undefined);
  const workloadByUser = useMemo(() => {
    if (!showWorkload) return undefined;
    return new Map(memberWorkload(workloadTasks, members).map((w) => [w.userId, w]));
  }, [showWorkload, workloadTasks, members]);
  const [moveCount, setMoveCount] = useState(0);
  const sessionMovesRef = useRef<{ userId: string; prevManagerId: string | null }[]>([]);
  const editModeRef = useRef(false);
  editModeRef.current = editMode;
  // Carte brièvement surlignée après un déplacement réussi (l'œil la retrouve).
  const [flashId, setFlashId] = useState<string | null>(null);
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


  // Refs pour les listeners window (évite les closures périmées).
  const draggingRef = useRef<OrgMember | null>(null);
  draggingRef.current = dragging;
  const dropGuardRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Auto-scroll pendant le glisser : position du pointeur + boucle rAF.
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const { roots, unplaced } = buildOrgTree(visibleMembers, ownerId);
  const selfMember = members.find((m) => m.userId === currentUserId) ?? null;

  // Pan : glisser le fond de la pyramide pour se déplacer (desktop).
  const onBackgroundPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile || dragging) return;
    if ((e.target as HTMLElement).closest('[data-card],button,input')) return;
    const c = scrollContainerRef.current;
    if (!c) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = c.scrollLeft;
    const startTop = window.scrollY;
    const onMove = (ev: PointerEvent) => {
      c.scrollLeft = startLeft - (ev.clientX - startX);
      window.scrollTo(0, startTop - (ev.clientY - startY));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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

  // Destinations valides : pas soi-même, pas son sous-arbre (cycle), pas son
  // manager actuel ; un non-admin ne dépose que sur lui-même ou son sous-arbre.
  const validDropIds = useMemo(() => {
    if (!dragging) return new Set<string>();
    const targetSubtree = subtreeOf(members, dragging.userId);
    const mySubtree = currentUserId ? subtreeOf(members, currentUserId) : new Set<string>();
    return new Set(
      members
        .filter((m) => {
          if (m.userId === dragging.userId) return false;
          if (targetSubtree.has(m.userId)) return false;
          if (m.userId === dragging.managerId) return false;
          if (!isAdmin && m.userId !== currentUserId && !mySubtree.has(m.userId)) return false;
          return true;
        })
        .map((m) => m.userId),
    );
  }, [dragging, members, currentUserId, isAdmin]);

  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDragging(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging]);

  // Nettoyage au démontage : boucle d'auto-scroll + timer de flash.
  useEffect(
    () => () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const flashCard = (userId: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashId(userId);
    flashTimerRef.current = setTimeout(() => setFlashId(null), 1600);
  };

  const drop = (dropId: string) => {
    const target = draggingRef.current;
    if (!target || dropGuardRef.current) return;
    dropGuardRef.current = true;
    const previousManagerId = target.managerId ?? null;
    setManager.mutate(
      { orgId, userId: target.userId, managerId: dropId === UNPLACED_DROP_ID ? null : dropId, silent: true },
      {
        onSettled: () => {
          dropGuardRef.current = false;
        },
        onSuccess: () => {
          setDragging(null);
          flashCard(target.userId);
          navigator.vibrate?.(30);
          const destName =
            dropId === UNPLACED_DROP_ID ? null : members.find((u) => u.userId === dropId)?.displayName;
          setAnnouncement(
            destName
              ? t('pyramid.nowUnder', { name: target.displayName, manager: destName })
              : t('pyramid.detached', { name: target.displayName }),
          );
          if (editModeRef.current) {
            // Mode réorganisation : on journalise pour « Annuler », pas de toast.
            sessionMovesRef.current.push({ userId: target.userId, prevManagerId: previousManagerId });
            setMoveCount(sessionMovesRef.current.length);
          } else {
            showUndoToast(t('pyramid.moved', { name: target.displayName }), () => {
              setManager.mutate({ orgId, userId: target.userId, managerId: previousManagerId });
              flashCard(target.userId);
            });
          }
        },
      },
    );
  };

  const findDropId = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-drop-id]');
    return el instanceof HTMLElement ? (el.dataset.dropId ?? null) : null;
  };

  /**
   * Auto-scroll pendant le glisser : boucle rAF tant que le pointeur est
   * enfoncé — fenêtre verticalement, conteneur pyramide horizontalement,
   * quand le pointeur approche des bords (zone de 56 px, vitesse dégressive).
   */
  const stopAutoScroll = () => {
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = null;
    pointerPosRef.current = null;
  };

  const startAutoScroll = () => {
    if (scrollRafRef.current !== null) return;
    const EDGE = 56;
    const SPEED = 14;
    const step = () => {
      const p = pointerPosRef.current;
      if (!p) {
        scrollRafRef.current = null;
        return;
      }
      // Vertical : fenêtre.
      if (p.y < EDGE) window.scrollBy(0, -SPEED * (1 - p.y / EDGE));
      else if (p.y > window.innerHeight - EDGE) window.scrollBy(0, SPEED * (1 - (window.innerHeight - p.y) / EDGE));
      // Horizontal : conteneur scrollable de la pyramide.
      const c = scrollContainerRef.current;
      if (c) {
        const r = c.getBoundingClientRect();
        if (p.x < r.left + EDGE) c.scrollLeft -= SPEED * (1 - (p.x - r.left) / EDGE);
        else if (p.x > r.right - EDGE) c.scrollLeft += SPEED * (1 - (r.right - p.x) / EDGE);
      }
      scrollRafRef.current = requestAnimationFrame(step);
    };
    scrollRafRef.current = requestAnimationFrame(step);
  };

  /** Suivi pointeur d'un glisser en cours (fantôme + survol cible + auto-scroll). */
  const startPointerTracking = (e: { clientX: number; clientY: number }) => {
    setGhost({ x: e.clientX, y: e.clientY });
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
    startAutoScroll();
    const onMove = (ev: PointerEvent) => {
      setGhost({ x: ev.clientX, y: ev.clientY });
      pointerPosRef.current = { x: ev.clientX, y: ev.clientY };
      setHoverDropId(findDropId(ev.clientX, ev.clientY));
    };
    const endDrag = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      stopAutoScroll();
      setGhost(null);
      setHoverDropId(null);
    };
    const onUp = (ev: PointerEvent) => {
      let id = findDropId(ev.clientX, ev.clientY);
      if (!id) {
        // Secours : drag plus rapide que le re-render (data-drop-id pas encore
        // posé) — on valide la destination par les données, pas par le DOM.
        const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-node-id]');
        const nodeId = el instanceof HTMLElement ? el.dataset.nodeId : undefined;
        const target = draggingRef.current;
        if (nodeId && target && isValidDestination(target, nodeId, members, currentUserId, isAdmin)) {
          id = nodeId;
        }
      }
      endDrag();
      if (id) drop(id);
    };
    const onCancel = () => endDrag();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const onSourcePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    startPointerTracking(e);
  };

  /** Saisie directe (poignée grip / long-press / mode réorganisation). */
  const grabMember = (m: OrgMember, e: { clientX: number; clientY: number }) => {
    draggingRef.current = m;
    setDragging(m);
    navigator.vibrate?.(20);
    startPointerTracking(e);
  };

  // ── Mode réorganisation (Modifier / Annuler) ───────────────────────
  const canEdit = isAdmin || (!!currentUserId && isManagerOf(members, currentUserId));

  const startEdit = () => {
    sessionMovesRef.current = [];
    setMoveCount(0);
    setEditMode(true);
  };

  const resetEditState = () => {
    sessionMovesRef.current = [];
    setMoveCount(0);
    setEditMode(false);
    setDragging(null);
  };

  const finishEdit = () => {
    if (sessionMovesRef.current.length > 0) toast.success(t('pyramid.reorgSaved'));
    resetEditState();
  };

  const cancelEdit = async () => {
    const moves = sessionMovesRef.current;
    if (moves.length > 0) {
      const ok = window.confirm(
        moves.length > 1
          ? tp('pyramid.undoConfirm', moves.length)
          : tp('pyramid.undoConfirm', 1),
      );
      if (!ok) return;
      // Rétablissement dans l'ordre inverse (évite les faux cycles serveur).
      for (const mv of [...moves].reverse()) {
        try {
          await setManager.mutateAsync({ orgId, userId: mv.userId, managerId: mv.prevManagerId, silent: true });
        } catch {
          break; // l'erreur est déjà remontée par le toast du hook
        }
      }
      toast.success(t('pyramid.undone'));
    }
    resetEditState();
  };

  const drag: DragState | null = dragging
    ? {
        member: dragging,
        validDropIds,
        hoverDropId,
        pointerActive: ghost !== null,
        onSourcePointerDown,
        onDrop: drop,
      }
    : null;

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
      {unplaced.length > 0 && (isMobile || roots.length === 0) && (
        <section className="rounded-2xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1 inline-flex items-center gap-1.5">
            <UserPlus size={15} aria-hidden="true" /> {t('pyramid.unplaced', { count: unplaced.length })}
          </h3>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
            {isAdmin ? t('pyramid.unplacedHintAdmin') : t('pyramid.unplacedHintMember')}
          </p>
          <div className="flex flex-wrap gap-2">
            {unplaced.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2">
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={30} />
                <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{m.displayName}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setPlacing(m)}
                    className="ml-1 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                  >
                    {t('pyramid.place')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
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
          <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('pyramid.searchPlaceholder')}
                  aria-label={t('pyramid.searchAria')}
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-indigo-400 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t('pyramid.clearSearch')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
              {query.trim() && (
                <span className="text-xs text-[rgb(var(--color-text-muted))]" aria-live="polite">
                  {tp('pyramid.results', matchIds.size)}
                </span>
              )}
              {orgTeams.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t('pyramid.chooseView')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      activeTeam
                        ? 'border-transparent text-white'
                        : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                    }`}
                    style={activeTeam ? { backgroundColor: activeTeam.color } : undefined}
                  >
                    {activeTeam ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-white/80 shrink-0" aria-hidden="true" />
                        {activeTeam.name}
                      </>
                    ) : (
                      <>
                        <Users size={14} aria-hidden="true" /> {t('pyramid.wholeOrg')}
                      </>
                    )}
                    <ChevronDown size={13} aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
                    <DropdownMenuLabel>{t('pyramid.display')}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setViewTeamId(null)}>
                      <Users size={14} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                      {t('pyramid.wholeOrg')}
                      {!viewTeamId && <Check size={14} className="ml-auto text-indigo-500" aria-hidden="true" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{t('pyramid.byTeam')}</DropdownMenuLabel>
                    {orgTeams.map((t) => (
                      <DropdownMenuItem key={t.id} onClick={() => setViewTeamId(t.id)}>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} aria-hidden="true" />
                        <span className="truncate">{t.name}</span>
                        {viewTeamId === t.id && <Check size={14} className="ml-auto text-indigo-500 shrink-0" aria-hidden="true" />}
                      </DropdownMenuItem>
                    ))}
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        {/* Même endroit d'où l'on regarde « par équipe » que
                            celui où on en crée une — évite l'aller-retour vers
                            l'onglet Membres pour la première équipe. */}
                        <DropdownMenuItem onClick={() => setShowNewTeam(true)} className="text-blue-600 dark:text-blue-400">
                          <Plus size={14} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
                          {t('team.add')}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {showNewTeam && (
                <CreateTeamModal
                  members={members}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onSubmit={handleCreateTeamFull}
                  onClose={() => setShowNewTeam(false)}
                />
              )}
              {canEdit && (
                <div className="ml-auto flex items-center gap-2">
                  {editMode && moveCount > 0 && (
                    <span className="text-xs font-semibold text-indigo-500 tabular-nums">
                      {moveCount} modification{moveCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {!editMode && selfMember && canEdit && (
                    <button
                      type="button"
                      onClick={() => setAddingUnder(selfMember)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
                    >
                      <UserPlus size={14} aria-hidden="true" /> {t('pyramid.add')}
                    </button>
                  )}
                  {editMode && (
                    <button
                      type="button"
                      onClick={finishEdit}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                    >
                      <Check size={15} aria-hidden="true" /> {t('pyramid.done')}
                    </button>
                  )}
                  {/* Calque de charge — masqué en mode réorganisation : deux
                      lectures simultanées de la même carte se gêneraient. */}
                  {!editMode && (
                    <button
                      type="button"
                      onClick={() => setShowWorkload((v) => !v)}
                      aria-pressed={showWorkload}
                      title={t('pyramid.overlayHint')}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        showWorkload
                          ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-text-primary))] bg-[rgb(var(--color-hover))]'
                          : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]'
                      }`}
                    >
                      <TrendingUp size={14} aria-hidden="true" /> {t('pyramid.overlayToggle')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={editMode ? cancelEdit : startEdit}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      editMode
                        ? 'border border-red-400/60 text-red-500 hover:bg-red-500/10'
                        : 'text-white bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {editMode ? (
                      <>
                        <X size={15} aria-hidden="true" /> {t('common.cancel')}
                      </>
                    ) : (
                      <>
                        <Pencil size={14} aria-hidden="true" /> {t('pyramid.edit')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

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
        {!isMobile && unplaced.length > 0 && (
          <aside
            className="w-60 shrink-0 sticky top-4 rounded-2xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-900/10 p-4"
            aria-label={t('pyramid.toPlaceAria')}
          >
            <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1 inline-flex items-center gap-1.5">
              <UserPlus size={15} aria-hidden="true" /> {t('pyramid.toPlace', { count: unplaced.length })}
            </h3>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
              {isAdmin
                ? t('pyramid.dragEachHint')
                : t('pyramid.unplacedHintMember')}
            </p>
            <ul className="space-y-2">
              {unplaced.map((m) => {
                const isBeingDragged = dragging?.userId === m.userId;
                return (
                  <li key={m.userId}>
                    <div
                      onPointerDown={
                        isAdmin
                          ? (e) => {
                              if (e.pointerType === 'mouse' && e.button !== 0) return;
                              if ((e.target as HTMLElement).closest('button')) return;
                              e.preventDefault();
                              grabMember(m, e);
                            }
                          : undefined
                      }
                      style={isAdmin ? { touchAction: 'none' } : undefined}
                      title={isAdmin ? t('pyramid.dragHint', { name: m.displayName }) : undefined}
                      className={`flex items-center gap-2 rounded-xl border bg-[rgb(var(--color-surface))] px-2.5 py-2 transition-colors ${
                        isBeingDragged
                          ? 'border-indigo-400 ring-2 ring-indigo-400/30 opacity-40'
                          : 'border-[rgb(var(--color-border))]'
                      } ${isAdmin ? 'cursor-grab select-none' : ''} ${isAdmin && !dragging ? 'animate-wiggle' : ''}`}
                    >
                      {isAdmin && (
                        <GripVertical size={12} className="text-[rgb(var(--color-text-muted))]/50 shrink-0" aria-hidden="true" />
                      )}
                      <MemberAvatar avatar={m.avatar} name={m.displayName} size={28} />
                      <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate flex-1">
                        {m.displayName}
                      </span>
                      {isAdmin && !dragging && (
                        <button
                          type="button"
                          onClick={() => setPlacing(m)}
                          className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-600 transition-colors shrink-0"
                        >
                          {t('pyramid.place')}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
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
