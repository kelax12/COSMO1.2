// ═══════════════════════════════════════════════════════════════════
// Glisser-déposer de la pyramide + mode réorganisation
//
// FRONTIÈRE : ce hook porte le GESTE (saisir une carte, la suivre au
// pointeur, choisir une destination, la valider, l'annuler). `PyramidTab`
// porte l'ÉCRAN (recherche, vue par équipe, sheets, mise en page).
//
// Les deux étaient mêlés dans le même fichier : quatorze `useRef`, six
// `useState` et onze fonctions dont aucune n'était lisible sans les autres.
// La séparation est réelle — ce fichier ne rend rien et ne connaît ni les
// équipes, ni la recherche, ni les fiches membre.
//
// Le journal de session (`sessionMovesRef`) reste ici avec le geste, et pas
// à côté : c'est le déplacement lui-même qui l'alimente, et c'est ce qui
// permet à « Annuler » de rétablir dans l'ordre inverse.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { showUndoToast } from '@/lib/undo-toast';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import {
  isManagerOf,
  subtreeOf,
  useSetMemberManager,
  type OrgMember,
} from '@/modules/organizations';
import { UNPLACED_DROP_ID, isValidDestination } from './pyramid.helpers';
import type { DragState } from './PyramidNodeCard';
import { useT } from '@/i18n/useT';

interface Params {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
}

export function usePyramidDnd({ orgId, members, currentUserId, isAdmin }: Params) {
  const { t, tp } = useT('org');
  const isMobile = useIsMobile();
  const setManager = useSetMemberManager();

  const [dragging, setDragging] = useState<OrgMember | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [hoverDropId, setHoverDropId] = useState<string | null>(null);
  // Annonce lecteur d'écran après un déplacement (aria-live).
  const [announcement, setAnnouncement] = useState('');
  // Mode réorganisation : toutes les cartes déplaçables sont draggables ;
  // les déplacements de la session sont journalisés pour pouvoir tout annuler.
  const [editMode, setEditMode] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  // Carte brièvement surlignée après un déplacement réussi (l'œil la retrouve).
  const [flashId, setFlashId] = useState<string | null>(null);

  const sessionMovesRef = useRef<{ userId: string; prevManagerId: string | null }[]>([]);
  const editModeRef = useRef(false);
  editModeRef.current = editMode;
  // Refs pour les listeners window (évite les closures périmées).
  const draggingRef = useRef<OrgMember | null>(null);
  draggingRef.current = dragging;
  const dropGuardRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Auto-scroll pendant le glisser : position du pointeur + boucle rAF.
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
        moves.length > 1 ? tp('pyramid.undoConfirm', moves.length) : tp('pyramid.undoConfirm', 1),
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

  return {
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
  };
}
