import { useEffect, useMemo, useRef, useState } from 'react';
import {
  UserPlus,
  ChevronDown,
  ChevronRight,
  Move,
  Users,
  MoreHorizontal,
  UserRoundPlus,
  ArrowUpFromLine,
} from 'lucide-react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import {
  buildOrgTree,
  isManagerOf,
  subtreeOf,
  useSetMemberManager,
  type OrgMember,
  type OrgTreeNode,
} from '@/modules/organizations';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import MemberAvatar from './MemberAvatar';
import MemberPlacementSheet from './MemberPlacementSheet';
import AddUnderSheet from './AddUnderSheet';

interface PyramidTabProps {
  orgId: string;
  ownerId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
}

/** Zone de dépôt « détacher » (managerId → null). */
const UNPLACED_DROP_ID = '__unplaced__';

/** Peut-on déplacer `target` ? Admin : tous (sauf soi). Manager : son sous-arbre. */
function canManage(target: OrgMember, members: OrgMember[], currentUserId: string | undefined, isAdmin: boolean): boolean {
  if (!currentUserId || target.userId === currentUserId) return false;
  if (isAdmin) return true;
  return subtreeOf(members, currentUserId).has(target.userId);
}

/** État du déplacement en cours, distribué aux cartes de l'arbre. */
interface DragState {
  member: OrgMember;
  validDropIds: Set<string>;
  hoverDropId: string | null;
  /** true pendant que la carte est physiquement glissée (pointeur enfoncé). */
  pointerActive: boolean;
  onSourcePointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onDrop: (dropId: string) => void;
}

interface NodeCardProps {
  node: OrgTreeNode;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  onStartDrag: (m: OrgMember) => void;
  onAddUnder: (m: OrgMember) => void;
  drag: DragState | null;
  /** Profondeur (mobile : indentation ; desktop : sans objet). */
  depth: number;
  mobile: boolean;
}

const NodeCard = ({ node, members, currentUserId, isAdmin, onStartDrag, onAddUnder, drag, depth, mobile }: NodeCardProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const m = node.member;
  const manager = isManagerOf(members, m.userId);
  const movable = canManage(m, members, currentUserId, isAdmin);
  // « Ajouter un collaborateur » : admin partout ; sinon sous soi-même ou
  // son sous-arbre (miroir de la policy INSERT org_invite_links).
  const canAddUnder =
    isAdmin || m.userId === currentUserId || canManage(m, members, currentUserId, isAdmin);

  const isDragSource = drag?.member.userId === m.userId;
  const isDropTarget = !!drag && drag.validDropIds.has(m.userId);
  const isDropHover = isDropTarget && drag.hoverDropId === m.userId;

  const borderClass = isDropHover
    ? 'border-indigo-500 ring-2 ring-indigo-500/40'
    : isDropTarget
      ? 'border-dashed border-indigo-400/70'
      : isDragSource
        ? 'border-indigo-400 ring-2 ring-indigo-400/30'
        : m.role === 'admin'
          ? 'border-indigo-400/60'
          : manager
            ? 'border-blue-400/50'
            : 'border-[rgb(var(--color-border))]';

  const card = (
    <div
      data-drop-id={isDropTarget ? m.userId : undefined}
      onPointerDown={isDragSource ? drag.onSourcePointerDown : undefined}
      onClick={isDropTarget ? () => drag.onDrop(m.userId) : undefined}
      onKeyDown={
        isDropTarget
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                drag.onDrop(m.userId);
              }
            }
          : undefined
      }
      role={isDropTarget ? 'button' : undefined}
      tabIndex={isDropTarget ? 0 : undefined}
      aria-label={isDropTarget ? `Placer ${drag.member.displayName} sous ${m.displayName}` : undefined}
      style={isDragSource ? { touchAction: 'none' } : undefined}
      className={`inline-flex items-center gap-2.5 rounded-2xl border bg-[rgb(var(--color-surface))] px-3 py-2 transition-colors ${borderClass} ${
        isDragSource ? `cursor-grab select-none ${drag.pointerActive ? 'opacity-40' : ''}` : ''
      } ${isDropTarget ? 'cursor-pointer' : ''}`}
    >
      {node.children.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((c) => !c);
          }}
          aria-label={collapsed ? `Déplier l'équipe de ${m.displayName}` : `Replier l'équipe de ${m.displayName}`}
          aria-expanded={!collapsed}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
        >
          {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      )}
      <MemberAvatar avatar={m.avatar} size={34} />
      <div className="min-w-0">
        <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate max-w-[140px]">
          {m.userId === currentUserId ? 'Vous' : m.displayName}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          {m.role === 'admin' ? 'Admin' : manager ? 'Manager' : 'Membre'}
          {node.children.length > 0 ? ` · ${node.children.length}` : ''}
        </p>
      </div>
      {!drag && (movable || canAddUnder) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions pour ${m.displayName}`}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] shrink-0"
          >
            <MoreHorizontal size={15} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canAddUnder && (
              <DropdownMenuItem onClick={() => onAddUnder(m)}>
                <UserRoundPlus size={14} className="text-green-500" aria-hidden="true" />
                Ajouter un collaborateur
              </DropdownMenuItem>
            )}
            {movable && (
              <DropdownMenuItem onClick={() => onStartDrag(m)}>
                <Move size={14} className="text-indigo-500" aria-hidden="true" />
                Déplacer
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  if (mobile) {
    return (
      <div style={{ marginLeft: depth * 16 }} className="space-y-2">
        <div className={depth > 0 ? 'border-l-2 border-[rgb(var(--color-border))] pl-3' : ''}>{card}</div>
        {!collapsed && node.children.map((c) => (
          <NodeCard key={c.member.userId} node={c} members={members} currentUserId={currentUserId} isAdmin={isAdmin} onStartDrag={onStartDrag} onAddUnder={onAddUnder} drag={drag} depth={depth + 1} mobile />
        ))}
      </div>
    );
  }

  // Desktop : arbre vertical centré, connecteurs simples.
  return (
    <div className="flex flex-col items-center">
      {card}
      {!collapsed && node.children.length > 0 && (
        <>
          <div className="w-px h-4 bg-[rgb(var(--color-border))]" aria-hidden="true" />
          <div className="flex items-start gap-6 pt-0 relative">
            {node.children.map((c) => (
              <div key={c.member.userId} className="flex flex-col items-center relative">
                <div className="w-px h-3 bg-[rgb(var(--color-border))]" aria-hidden="true" />
                <NodeCard node={c} members={members} currentUserId={currentUserId} isAdmin={isAdmin} onStartDrag={onStartDrag} onAddUnder={onAddUnder} drag={drag} depth={depth + 1} mobile={false} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Onglet Pyramide — org-chart N+1. Desktop : arbre centré ; mobile : liste
 * indentée. Chaque carte a un menu « ⋯ » : ajouter un collaborateur (sheet
 * invitation/déplacement) ou déplacer par drag & drop — la carte se glisse
 * sur son nouveau responsable (pointer events, souris + tactile), avec
 * cibles valides surlignées et zone « Détacher » pour les admins.
 */
const PyramidTab = ({ orgId, ownerId, members, currentUserId, isAdmin }: PyramidTabProps) => {
  const isMobile = useIsMobile();
  const [dragging, setDragging] = useState<OrgMember | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [hoverDropId, setHoverDropId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<OrgMember | null>(null);
  const [addingUnder, setAddingUnder] = useState<OrgMember | null>(null);
  const setManager = useSetMemberManager();

  // Refs pour les listeners window (évite les closures périmées).
  const draggingRef = useRef<OrgMember | null>(null);
  draggingRef.current = dragging;
  const dropGuardRef = useRef(false);

  const { roots, unplaced } = buildOrgTree(members, ownerId);

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

  const drop = (dropId: string) => {
    const target = draggingRef.current;
    if (!target || dropGuardRef.current) return;
    dropGuardRef.current = true;
    setManager.mutate(
      { orgId, userId: target.userId, managerId: dropId === UNPLACED_DROP_ID ? null : dropId },
      {
        onSettled: () => {
          dropGuardRef.current = false;
        },
        onSuccess: () => setDragging(null),
      },
    );
  };

  const findDropId = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-drop-id]');
    return el instanceof HTMLElement ? (el.dataset.dropId ?? null) : null;
  };

  const onSourcePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    setGhost({ x: e.clientX, y: e.clientY });
    const onMove = (ev: PointerEvent) => {
      setGhost({ x: ev.clientX, y: ev.clientY });
      setHoverDropId(findDropId(ev.clientX, ev.clientY));
    };
    const endDrag = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      setGhost(null);
      setHoverDropId(null);
    };
    const onUp = (ev: PointerEvent) => {
      const id = findDropId(ev.clientX, ev.clientY);
      endDrag();
      if (id) drop(id);
    };
    const onCancel = () => endDrag();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
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

  return (
    <div className="space-y-6">
      {/* Bandeau mode déplacement */}
      {dragging && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-400/60 bg-indigo-50/60 dark:bg-indigo-900/15 px-4 py-3">
          <p className="text-sm text-[rgb(var(--color-text-primary))] inline-flex items-center gap-2 min-w-0">
            <Move size={15} className="text-indigo-500 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Glissez <strong>{dragging.displayName}</strong> sur son nouveau responsable, ou touchez une carte surlignée.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setDragging(null)}
            className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] px-3 py-1.5 rounded-lg border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] shrink-0 transition-colors"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Zone « Détacher » pendant un déplacement (admin) */}
      {dragging && isAdmin && dragging.managerId !== null && (
        <button
          type="button"
          data-drop-id={UNPLACED_DROP_ID}
          onClick={() => drop(UNPLACED_DROP_ID)}
          aria-label={`Détacher ${dragging.displayName} (non placé)`}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm transition-colors ${
            hoverDropId === UNPLACED_DROP_ID
              ? 'border-amber-500 ring-2 ring-amber-500/40 text-amber-600 dark:text-amber-400'
              : 'border-amber-400/60 text-[rgb(var(--color-text-muted))] hover:border-amber-500'
          }`}
        >
          <ArrowUpFromLine size={15} aria-hidden="true" /> Détacher (non placé)
        </button>
      )}

      {/* Non placés — à rattacher par un admin */}
      {unplaced.length > 0 && (
        <section className="rounded-2xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1 inline-flex items-center gap-1.5">
            <UserPlus size={15} aria-hidden="true" /> Non placés ({unplaced.length})
          </h3>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
            Ces membres ne sont rattachés à personne. {isAdmin ? 'Placez-les dans la pyramide.' : 'Un administrateur doit les placer.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {unplaced.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2">
                <MemberAvatar avatar={m.avatar} size={30} />
                <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{m.displayName}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setPlacing(m)}
                    className="ml-1 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                  >
                    Placer
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pyramide */}
      {roots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <Users size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Pyramide vide</p>
        </div>
      ) : (
        <div className={isMobile ? 'space-y-3' : 'overflow-x-auto pb-4'}>
          <div className={isMobile ? 'space-y-3' : 'flex flex-col items-center gap-8 min-w-fit mx-auto'}>
            {roots.map((root) => (
              <NodeCard
                key={root.member.userId}
                node={root}
                members={members}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onStartDrag={setDragging}
                onAddUnder={setAddingUnder}
                drag={drag}
                depth={0}
                mobile={isMobile}
              />
            ))}
          </div>
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
            <MemberAvatar avatar={dragging.avatar} size={26} />
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

      {addingUnder && (
        <AddUnderSheet
          orgId={orgId}
          under={addingUnder}
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setAddingUnder(null)}
        />
      )}
    </div>
  );
};

export default PyramidTab;
