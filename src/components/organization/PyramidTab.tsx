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
  LocateFixed,
  GripVertical,
  Search,
  X,
  ChevronsDownUp,
  ChevronsUpDown,
  Minimize2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Scan,
  Printer,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { showUndoToast } from '@/lib/undo-toast';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useOrgTeams, useOrgTeamMembers, type OrgTeam } from '@/modules/org-teams';
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
import MemberProfileSheet from './MemberProfileSheet';

interface PyramidTabProps {
  orgId: string;
  ownerId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  /** Chargement initial des membres — affiche le skeleton pyramide. */
  loading?: boolean;
}

/** Zone de dépôt « détacher » (managerId → null). */
const UNPLACED_DROP_ID = '__unplaced__';

/** Clé localStorage de l'état replié de la pyramide (par organisation). */
const collapsedStorageKey = (orgId: string) => `cosmo_pyramid_collapsed_${orgId}`;

/** Lecture sûre de l'état replié (B14 — jamais de JSON.parse nu). */
function readCollapsedIds(orgId: string): Set<string> {
  try {
    const raw = localStorage.getItem(collapsedStorageKey(orgId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Normalisation pour la recherche : minuscules, sans accents (diacritiques combinants). */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const EMPTY_SET = new Set<string>();

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
  /** Saisie directe (poignée grip / long-press) : active le mode et démarre le glisser. */
  onGrab: (m: OrgMember, pos: { clientX: number; clientY: number }) => void;
  drag: DragState | null;
  /** Membre à surligner brièvement après un déplacement réussi. */
  flashId: string | null;
  /** Nœuds repliés (état remonté, persisté par organisation). */
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  /** Membres correspondant à la recherche en cours (surlignés). */
  matchIds: Set<string>;
  /** Équipes transverses par membre (pastilles couleur). */
  teamsByUser: Map<string, OrgTeam[]>;
  /** Ouvre la fiche membre (clic ou Entrée sur une carte hors mode déplacement). */
  onOpenProfile: (m: OrgMember) => void;
  /** Mode compact : avatars seuls, nom au survol. */
  compact: boolean;
  /** Profondeur (mobile : indentation ; desktop : sans objet). */
  depth: number;
  mobile: boolean;
}

const NodeCard = ({ node, members, currentUserId, isAdmin, onStartDrag, onAddUnder, onGrab, drag, flashId, collapsedIds, onToggleCollapse, matchIds, teamsByUser, onOpenProfile, compact, depth, mobile }: NodeCardProps) => {
  const collapsed = collapsedIds.has(node.member.userId);
  // Long-press mobile : timer + position initiale (annulé si le doigt bouge).
  const longPressRef = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const cancelLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  };
  const m = node.member;
  const manager = isManagerOf(members, m.userId);
  const movable = canManage(m, members, currentUserId, isAdmin);
  const isMe = m.userId === currentUserId;
  // Effectif total du sous-arbre (au-delà des directs) — affiché quand il diffère.
  const totalReports = node.children.length > 0 ? subtreeOf(members, m.userId).size : 0;
  // « Ajouter un collaborateur » : admin partout ; sinon sous soi-même ou
  // son sous-arbre (miroir de la policy INSERT org_invite_links).
  const canAddUnder =
    isAdmin || m.userId === currentUserId || canManage(m, members, currentUserId, isAdmin);

  const isDragSource = drag?.member.userId === m.userId;
  const isDropTarget = !!drag && drag.validDropIds.has(m.userId);
  const isDropHover = isDropTarget && drag.hoverDropId === m.userId;
  const isMatch = matchIds.has(m.userId);

  const borderClass = flashId === m.userId
    ? 'border-emerald-500 ring-2 ring-emerald-500/50'
    : isDropHover
    ? 'border-indigo-500 ring-2 ring-indigo-500/40'
    : isDropTarget
      ? 'border-dashed border-indigo-400/70'
      : isDragSource
        ? 'border-indigo-400 ring-2 ring-indigo-400/30'
        : isMatch
          ? 'border-amber-400 ring-2 ring-amber-400/30'
          : isMe
            ? 'border-indigo-400/70 ring-2 ring-indigo-400/20'
            : m.role === 'admin'
              ? 'border-indigo-400/60'
              : manager
                ? 'border-blue-400/50'
                : 'border-[rgb(var(--color-border))]';

  const myTeams = teamsByUser.get(m.userId) ?? [];

  const card = (
    <motion.div
      layoutId={`pyr-${m.userId}`}
      layout
      data-drop-id={isDropTarget ? m.userId : undefined}
      data-me={isMe ? 'true' : undefined}
      data-match={isMatch ? 'true' : undefined}
      onPointerDown={(e) => {
        if (isDragSource) {
          drag.onSourcePointerDown(e);
          return;
        }
        // Long-press (mobile) : saisir la carte sans passer par le menu.
        if (!mobile || drag || !movable) return;
        if ((e.target as HTMLElement).closest('button')) return;
        const { clientX, clientY } = e;
        cancelLongPress();
        longPressRef.current = {
          timer: setTimeout(() => {
            longPressRef.current = null;
            onGrab(m, { clientX, clientY });
          }, 450),
          x: clientX,
          y: clientY,
        };
      }}
      onPointerMove={(e) => {
        const lp = longPressRef.current;
        if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) cancelLongPress();
      }}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClick={(e) => {
        if (isDropTarget) {
          drag.onDrop(m.userId);
          return;
        }
        if (drag) return; // en mode déplacement, seules les cibles réagissent
        const t = e.target as HTMLElement;
        if (t.closest('button') || t.closest('[data-grip]')) return;
        onOpenProfile(m);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target !== e.currentTarget) return; // boutons internes
          e.preventDefault();
          if (isDropTarget) drag.onDrop(m.userId);
          else if (!drag) onOpenProfile(m);
          return;
        }
        // Navigation clavier : flèches = parent / enfant / frère précédent-suivant.
        if (!e.key.startsWith('Arrow') || e.target !== e.currentTarget) return;
        e.preventDefault();
        const focusNode = (id?: string | null) => {
          if (!id) return;
          (document.querySelector(`[data-node-id="${id}"]`) as HTMLElement | null)?.focus();
        };
        if (e.key === 'ArrowDown') focusNode(node.children[0]?.member.userId);
        else if (e.key === 'ArrowUp') focusNode(m.managerId);
        else {
          const siblings = members
            .filter((x) => (x.managerId ?? null) === (m.managerId ?? null))
            .map((x) => x.userId);
          const i = siblings.indexOf(m.userId);
          focusNode(e.key === 'ArrowRight' ? siblings[i + 1] : siblings[i - 1]);
        }
      }}
      role="button"
      tabIndex={0}
      data-node-id={m.userId}
      data-card="true"
      aria-label={
        isDropTarget
          ? `Placer ${drag.member.displayName} sous ${m.displayName}`
          : `${isMe ? 'Vous' : m.displayName}, ${m.role === 'admin' ? 'admin' : manager ? 'manager' : 'membre'}${
              node.children.length > 0 ? `, ${node.children.length} subordonné${node.children.length > 1 ? 's' : ''} direct${node.children.length > 1 ? 's' : ''}` : ''
            }`
      }
      style={isDragSource ? { touchAction: 'none' } : undefined}
      title={compact ? `${isMe ? 'Vous' : m.displayName} — ${m.role === 'admin' ? 'Admin' : manager ? 'Manager' : 'Membre'}` : undefined}
      className={`inline-flex items-center rounded-2xl border bg-[rgb(var(--color-surface))] transition-colors ${
        compact ? 'gap-1 px-1.5 py-1.5' : isDropTarget && mobile ? 'gap-2.5 px-3 py-3.5' : 'gap-2.5 px-3 py-2'
      } ${borderClass} ${
        isDragSource ? `cursor-grab select-none ${drag.pointerActive ? 'opacity-40' : ''}` : ''
      } ${isDropTarget ? 'cursor-pointer' : ''}`}
    >
      {!compact && !mobile && movable && !drag && (
        <span
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            onGrab(m, e);
          }}
          title={`Glisser pour déplacer ${m.displayName}`}
          data-grip="true"
          className="cursor-grab text-[rgb(var(--color-text-muted))]/50 hover:text-indigo-500 -ml-1 shrink-0 touch-none"
          aria-hidden="true"
        >
          <GripVertical size={13} />
        </span>
      )}
      {node.children.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(m.userId);
          }}
          aria-label={collapsed ? `Déplier l'équipe de ${m.displayName}` : `Replier l'équipe de ${m.displayName}`}
          aria-expanded={!collapsed}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
        >
          {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      )}
      <MemberAvatar avatar={m.avatar} name={m.displayName} size={compact ? 28 : 34} />
      {!compact && (
        <div className="min-w-0">
          <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate max-w-[140px]">
            {isMe ? 'Vous' : m.displayName}
          </p>
          <p
            className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] inline-flex items-center gap-1.5"
            title={
              totalReports > node.children.length
                ? `${node.children.length} direct${node.children.length > 1 ? 's' : ''} · ${totalReports} au total`
                : undefined
            }
          >
            <span>
              {m.role === 'admin' ? 'Admin' : manager ? 'Manager' : 'Membre'}
              {node.children.length > 0 ? ` · ${node.children.length}` : ''}
              {totalReports > node.children.length ? ` · ${totalReports} au total` : ''}
            </span>
            {myTeams.length > 0 && (
              <span className="inline-flex items-center gap-1 shrink-0">
                {myTeams.slice(0, 3).map((t) => (
                  <span
                    key={t.id}
                    title={t.name}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                ))}
              </span>
            )}
          </p>
        </div>
      )}
      {!compact && !drag && (movable || canAddUnder) && (
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
    </motion.div>
  );

  if (mobile) {
    return (
      <div style={{ marginLeft: depth * 16 }} className="space-y-2">
        <div className={depth > 0 ? 'border-l-2 border-[rgb(var(--color-border))] pl-3' : ''}>{card}</div>
        {!collapsed && node.children.map((c) => (
          <NodeCard key={c.member.userId} node={c} members={members} currentUserId={currentUserId} isAdmin={isAdmin} onStartDrag={onStartDrag} onAddUnder={onAddUnder} onGrab={onGrab} drag={drag} flashId={flashId} collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse} matchIds={matchIds} teamsByUser={teamsByUser} onOpenProfile={onOpenProfile} compact={compact} depth={depth + 1} mobile />
        ))}
      </div>
    );
  }

  // Desktop : arbre vertical centré, connecteurs en L continus (org-chart).
  return (
    <div className="flex flex-col items-center">
      {card}
      {!collapsed && node.children.length > 0 && (
        <>
          <div className="w-px h-4 bg-[rgb(var(--color-border))]" aria-hidden="true" />
          <div className="flex items-start relative">
            {node.children.map((c, i) => {
              const first = i === 0;
              const last = i === node.children.length - 1;
              return (
                <div key={c.member.userId} className="relative flex flex-col items-center px-3">
                  {/* Segment horizontal du connecteur en L (couvre le padding) */}
                  {node.children.length > 1 && (
                    <div
                      className={`absolute top-0 h-px bg-[rgb(var(--color-border))] ${
                        first ? 'left-1/2 right-0' : last ? 'left-0 right-1/2' : 'left-0 right-0'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <div className="w-px h-3 bg-[rgb(var(--color-border))]" aria-hidden="true" />
                  <NodeCard node={c} members={members} currentUserId={currentUserId} isAdmin={isAdmin} onStartDrag={onStartDrag} onAddUnder={onAddUnder} onGrab={onGrab} drag={drag} flashId={flashId} collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse} matchIds={matchIds} teamsByUser={teamsByUser} onOpenProfile={onOpenProfile} compact={compact} depth={depth + 1} mobile={false} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/** Skeleton en forme de pyramide (1-2-3 cartes fantômes) pendant le chargement. */
const PyramidSkeleton = () => (
  <div className="flex flex-col items-center gap-6 py-8" aria-hidden="true">
    {[1, 2, 3].map((count) => (
      <div key={count} className="flex items-center gap-6">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="w-44 h-[52px] rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] animate-pulse"
          />
        ))}
      </div>
    ))}
  </div>
);

/**
 * Onglet Pyramide — org-chart N+1. Desktop : arbre centré ; mobile : liste
 * indentée. Chaque carte a un menu « ⋯ » : ajouter un collaborateur (sheet
 * invitation/déplacement) ou déplacer par drag & drop — la carte se glisse
 * sur son nouveau responsable (pointer events, souris + tactile), avec
 * cibles valides surlignées et zone « Détacher » pour les admins.
 */
const PyramidTab = ({ orgId, ownerId, members, currentUserId, isAdmin, loading }: PyramidTabProps) => {
  const isMobile = useIsMobile();
  const [dragging, setDragging] = useState<OrgMember | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [hoverDropId, setHoverDropId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<OrgMember | null>(null);
  const [addingUnder, setAddingUnder] = useState<OrgMember | null>(null);
  const [profile, setProfile] = useState<OrgMember | null>(null);
  // Zoom desktop (propriété CSS `zoom` : le layout suit, le scroll reste juste).
  const [zoomLevel, setZoomLevel] = useState(1);
  // Annonce lecteur d'écran après un déplacement (aria-live).
  const [announcement, setAnnouncement] = useState('');
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
  // Mode compact (avatars seuls) — persisté globalement.
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem('cosmo_pyramid_compact') === '1';
    } catch {
      return false;
    }
  });
  const setManager = useSetMemberManager();
  const { data: orgTeams = [] } = useOrgTeams(orgId);
  const { data: orgTeamMembers = [] } = useOrgTeamMembers(orgId);

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

  const toggleCompact = () => {
    setCompact((c) => {
      try {
        localStorage.setItem('cosmo_pyramid_compact', c ? '0' : '1');
      } catch {
        // Persistance best-effort.
      }
      return !c;
    });
  };

  // Refs pour les listeners window (évite les closures périmées).
  const draggingRef = useRef<OrgMember | null>(null);
  draggingRef.current = dragging;
  const dropGuardRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Auto-scroll pendant le glisser : position du pointeur + boucle rAF.
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const { roots, unplaced } = buildOrgTree(members, ownerId);
  const selfMember = members.find((m) => m.userId === currentUserId) ?? null;

  const locateMe = () => {
    document
      .querySelector('[data-me]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  };

  // ── Zoom & fit (desktop) ───────────────────────────────────────────
  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 1.5;
  const zoomBy = (delta: number) =>
    setZoomLevel((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 10) / 10)));

  const zoomFit = () => {
    const c = scrollContainerRef.current;
    if (!c) return;
    const naturalWidth = c.scrollWidth / zoomLevel;
    setZoomLevel(Math.min(1, Math.max(ZOOM_MIN, Math.floor((c.clientWidth / naturalWidth) * 100) / 100)));
  };

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

  // ── Export : fenêtre imprimable (l'utilisateur peut « Enregistrer en PDF ») ──
  const exportChart = () => {
    const esc = (s: string) =>
      s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
    const roleOf = (m: OrgMember) =>
      m.role === 'admin' ? 'Admin' : isManagerOf(members, m.userId) ? 'Manager' : 'Membre';
    const rows: string[] = [];
    const walk = (n: OrgTreeNode, d: number) => {
      rows.push(
        `<div class="row" style="margin-left:${d * 28}px"><span class="name">${esc(n.member.displayName)}</span><span class="role">${roleOf(n.member)}</span></div>`,
      );
      n.children.forEach((c) => walk(c, d + 1));
    };
    roots.forEach((r) => walk(r, 0));
    const unplacedHtml =
      unplaced.length > 0
        ? `<h2>Non placés</h2>${unplaced.map((m) => `<div class="row"><span class="name">${esc(m.displayName)}</span></div>`).join('')}`
        : '';
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Organigramme</title><style>
      body{font-family:system-ui,sans-serif;padding:32px;color:#111}
      h1{font-size:20px;margin:0 0 4px}p.date{color:#666;font-size:12px;margin:0 0 24px}
      .row{display:flex;align-items:baseline;gap:10px;padding:5px 0;border-bottom:1px solid #eee}
      .name{font-weight:600;font-size:14px}.role{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.04em}
      h2{font-size:14px;margin:24px 0 8px;color:#b45309}
    </style></head><body><h1>Organigramme</h1><p class="date">${new Date().toLocaleDateString('fr-FR')} · ${members.length} membre${members.length > 1 ? 's' : ''}</p>${rows.join('')}${unplacedHtml}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
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

  const collapseAll = () =>
    setCollapsed((prev) => ({
      org: prev.org,
      ids: new Set(members.filter((m) => isManagerOf(members, m.userId)).map((m) => m.userId)),
    }));

  const expandAll = () => setCollapsed((prev) => ({ org: prev.org, ids: new Set() }));

  // ── Recherche ──────────────────────────────────────────────────────
  const matchIds = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return EMPTY_SET;
    return new Set(members.filter((m) => normalize(m.displayName).includes(q)).map((m) => m.userId));
  }, [query, members]);

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
  }, [members, isMobile, loading, zoomLevel]);

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
              ? `${target.displayName} est maintenant rattaché(e) à ${destName}`
              : `${target.displayName} est détaché(e) de la pyramide`,
          );
          showUndoToast(`${target.displayName} déplacé(e)`, () => {
            setManager.mutate({ orgId, userId: target.userId, managerId: previousManagerId });
            flashCard(target.userId);
          });
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
      const id = findDropId(ev.clientX, ev.clientY);
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

  /** Saisie directe (poignée grip / long-press) : active le mode ET démarre le glisser. */
  const grabMember = (m: OrgMember, e: { clientX: number; clientY: number }) => {
    draggingRef.current = m;
    setDragging(m);
    navigator.vibrate?.(20);
    startPointerTracking(e);
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
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={30} />
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
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-4">
            <Users size={26} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1.5">
            Votre pyramide est vide
          </p>
          <p className="text-sm text-[rgb(var(--color-text-muted))] max-w-sm mb-5">
            La pyramide représente qui travaille avec qui : chaque membre est rattaché à un
            responsable direct (N+1). Invitez vos collaborateurs pour la construire.
          </p>
          {selfMember && (
            <button
              type="button"
              onClick={() => setAddingUnder(selfMember)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              <UserPlus size={16} aria-hidden="true" /> Inviter votre premier collaborateur
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Barre d'outils pyramide : recherche, replier/déplier, me situer */}
          {!dragging && (
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
                  placeholder="Rechercher un membre…"
                  aria-label="Rechercher un membre dans la pyramide"
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-indigo-400 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Effacer la recherche"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
              {query.trim() && (
                <span className="text-xs text-[rgb(var(--color-text-muted))]" aria-live="polite">
                  {matchIds.size} résultat{matchIds.size > 1 ? 's' : ''}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {!isMobile && (
                  <>
                    <button
                      type="button"
                      onClick={() => zoomBy(-0.1)}
                      disabled={zoomLevel <= ZOOM_MIN}
                      title="Zoom arrière"
                      aria-label="Zoom arrière"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] disabled:opacity-40 transition-colors"
                    >
                      <ZoomOut size={15} aria-hidden="true" />
                    </button>
                    <span className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] w-9 text-center tabular-nums">
                      {Math.round(zoomLevel * 100)} %
                    </span>
                    <button
                      type="button"
                      onClick={() => zoomBy(0.1)}
                      disabled={zoomLevel >= ZOOM_MAX}
                      title="Zoom avant"
                      aria-label="Zoom avant"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] disabled:opacity-40 transition-colors"
                    >
                      <ZoomIn size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={zoomFit}
                      title="Ajuster à l'écran"
                      aria-label="Ajuster la pyramide à l'écran"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] transition-colors"
                    >
                      <Scan size={14} aria-hidden="true" />
                    </button>
                    <span className="w-px h-4 bg-[rgb(var(--color-border))] mx-0.5" aria-hidden="true" />
                  </>
                )}
                <button
                  type="button"
                  onClick={exportChart}
                  title="Exporter / imprimer l'organigramme"
                  aria-label="Exporter ou imprimer l'organigramme"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] transition-colors"
                >
                  <Printer size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={toggleCompact}
                  title={compact ? 'Mode détaillé' : 'Mode compact'}
                  aria-label={compact ? 'Passer en mode détaillé' : 'Passer en mode compact'}
                  aria-pressed={compact}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgb(var(--color-hover))] ${
                    compact ? 'text-indigo-500' : 'text-[rgb(var(--color-text-muted))] hover:text-indigo-500'
                  }`}
                >
                  {compact ? <Maximize2 size={14} aria-hidden="true" /> : <Minimize2 size={14} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  title="Tout replier"
                  aria-label="Replier toutes les équipes"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] transition-colors"
                >
                  <ChevronsDownUp size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={expandAll}
                  title="Tout déplier"
                  aria-label="Déplier toutes les équipes"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] transition-colors"
                >
                  <ChevronsUpDown size={15} aria-hidden="true" />
                </button>
                {selfMember && (
                  <button
                    type="button"
                    onClick={locateMe}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-indigo-500 px-2.5 py-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                  >
                    <LocateFixed size={13} aria-hidden="true" /> Me situer
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Légende des équipes transverses */}
          {orgTeams.length > 0 && !dragging && !compact && (
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
          <div
            className={isMobile ? 'space-y-3' : 'flex flex-col items-center gap-8 min-w-fit mx-auto'}
            style={!isMobile && zoomLevel !== 1 ? ({ zoom: zoomLevel } as React.CSSProperties) : undefined}
          >
            {roots.map((root) => (
              <NodeCard
                key={root.member.userId}
                node={root}
                members={members}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onStartDrag={setDragging}
                onAddUnder={setAddingUnder}
                onGrab={grabMember}
                drag={drag}
                flashId={flashId}
                collapsedIds={effectiveCollapsedIds}
                onToggleCollapse={toggleCollapse}
                matchIds={matchIds}
                teamsByUser={teamsByUser}
                onOpenProfile={setProfile}
                compact={compact}
                depth={0}
                mobile={isMobile}
              />
            ))}
            </div>
          </div>
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

      {profile && (
        <MemberProfileSheet
          member={profile}
          members={members}
          teams={teamsByUser.get(profile.userId) ?? []}
          currentUserId={currentUserId}
          canMove={canManage(profile, members, currentUserId, isAdmin)}
          canAddUnder={isAdmin || profile.userId === currentUserId || canManage(profile, members, currentUserId, isAdmin)}
          onClose={() => setProfile(null)}
          onMove={setDragging}
          onAddUnder={setAddingUnder}
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
