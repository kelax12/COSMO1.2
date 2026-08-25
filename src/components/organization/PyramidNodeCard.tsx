// ═══════════════════════════════════════════════════════════════════
// PyramidNodeCard — une carte de l'organigramme, et l'état de glissement
// qu'elle reçoit.
//
// Extrait de `PyramidTab.tsx` le 2026-08-24. Ce n'est pas un rangement :
// `PyramidTab` était à 1 506 lignes, le plus gros fichier du dépôt et de très
// loin le premier de la liste `KNOWN_OVERSIZED` du cliquet
// (`src/architecture.guard.test.ts`). Un god component ne se répare jamais
// « plus tard » : il grossit de 50 lignes par vague de features, et chaque
// intervention coûte plus cher à charger en contexte.
//
// La coupe suit une frontière réelle, pas un compte de lignes : d'un côté le
// RENDU D'UNE CARTE (récursif — une carte rend ses subordonnées), de l'autre
// l'ORCHESTRATION de l'arbre (recherche, repli, glisser-déposer, sheets).
// Aucune logique n'a changé.
//
// `DragState` vit ici parce que c'est le contrat que la carte REÇOIT : le
// parent le construit, la carte s'en sert. Le mettre ailleurs obligerait les
// deux fichiers à importer un troisième.
// ═══════════════════════════════════════════════════════════════════
import { useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Move,
  MoreHorizontal,
  UserRoundPlus,
  GripVertical,
  Trash2,
  ListTodo,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { type OrgTeam } from '@/modules/org-teams';
import {
  isManagerOf,
  subtreeOf,
  type OrgMember,
  type OrgTreeNode,
} from '@/modules/organizations';
import {
  canManage,
} from './pyramid.helpers';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { workloadTone, type MemberWorkload } from './team-stats.helpers';
import { formatDuration } from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';
import { type MemberTab } from './member-sheet.helpers';
import { useT } from '@/i18n/useT';

// Logique pure extraite dans `pyramid.helpers.ts` (audit archi 2026-08-07, M1) :
// ce sont les seules fonctions de ce fichier qui DÉCIDENT quelque chose
// (autorisation de déplacement, interdiction des cycles, recherche), donc les
// seules qui méritaient des tests. Elles y sont couvertes.

/** État du déplacement en cours, distribué aux cartes de l'arbre. */
export interface DragState {
  member: OrgMember;
  validDropIds: Set<string>;
  hoverDropId: string | null;
  /** true pendant que la carte est physiquement glissée (pointeur enfoncé). */
  pointerActive: boolean;
  onSourcePointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onDrop: (dropId: string) => void;
}

export interface NodeCardProps {
  /**
   * Calque de charge (item #28) — absent = calque désactivé.
   *
   * Une Map plutôt qu'une prop par métrique : la signature de NodeCard porte
   * déjà 18 paramètres, et chaque métrique future s'ajouterait ici sans
   * toucher aux 3 sites d'appel.
   */
  workloadByUser?: Map<string, MemberWorkload>;
  node: OrgTreeNode;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  onStartDrag: (m: OrgMember) => void;
  onAddUnder: (m: OrgMember) => void;
  /** Retire un membre de l'entreprise (admin — avec confirmation dans le parent). */
  onRemove: (m: OrgMember) => void;
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
  /**
   * Ouvre la fiche membre unifiée sur un onglet (item #18). Le clic sur la
   * carte ouvre le profil ; les entrées du menu ⋯ ouvrent la même fiche
   * directement sur l'onglet demandé.
   */
  onOpenMember: (m: OrgMember, tab: MemberTab) => void;
  /** Mode réorganisation : toutes les cartes déplaçables sont draggables. */
  editMode: boolean;
  /** Profondeur (mobile : indentation ; desktop : sans objet). */
  depth: number;
  mobile: boolean;
}

export const NodeCard = ({ node, members, currentUserId, isAdmin, onStartDrag, onAddUnder, onRemove, onGrab, drag, flashId, collapsedIds, onToggleCollapse, matchIds, teamsByUser, onOpenMember, editMode, depth, mobile, workloadByUser }: NodeCardProps) => {
  const { t, tp } = useT('org');
  const collapsed = collapsedIds.has(node.member.userId);
  // Radix ferme le menu sur pointerup PUIS le navigateur émet un `click` sur
  // l'élément sous le pointeur (la carte) → sinon la fiche s'ouvrait en plus de
  // l'action choisie. On horodate l'action du menu pour ignorer ce click fantôme.
  const menuActionAtRef = useRef(0);
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
  // « Ajouter un collaborateur » : admin partout ; sinon MANAGER (au moins un
  // subordonné) sous soi-même ou son sous-arbre.
  //
  // AUD-02 — la condition `m.userId === currentUserId` seule reproduisait la
  // policy vulnérable de la mig. 067 : tout membre, même sans subordonné,
  // pouvait générer un lien et faire entrer un externe dans l'entreprise sans
  // validation admin. La mig. 084 exige désormais `has_reports` côté serveur ;
  // on aligne l'UI pour ne pas afficher un bouton qui renverrait 403.
  const canAddUnder =
    isAdmin ||
    (!!currentUserId &&
      isManagerOf(members, currentUserId) &&
      (m.userId === currentUserId || canManage(m, members, currentUserId, isAdmin)));
  // « Retirer de l'entreprise » : réservé aux admins (RPC remove_member exige
  // is_org_admin), sur une autre personne que soi (sous soi dans la pyramide).
  const canRemove = isAdmin && !isMe;
  // Infos membre (tâches / agenda / contribution) : réservées aux supérieurs
  // hiérarchiques (admin partout ; manager sur son sous-arbre) — jamais soi.
  const canSeeInsights = movable;

  const isDragSource = drag?.member.userId === m.userId;
  const isDropTarget = !!drag && drag.validDropIds.has(m.userId);
  const isDropHover = isDropTarget && drag.hoverDropId === m.userId;
  const isMatch = matchIds.has(m.userId);
  // Mode réorganisation : la carte se saisit directement (et gigote).
  const editDraggable = editMode && movable && !drag;

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
                ? 'border-[rgb(var(--color-accent-solid))]/50'
                : 'border-[rgb(var(--color-border))]';

  const myTeams = teamsByUser.get(m.userId) ?? [];
  const myWorkload = workloadByUser?.get(m.userId);

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
        // Mode réorganisation : saisie directe de n'importe quelle carte déplaçable.
        if (editDraggable) {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          if ((e.target as HTMLElement).closest('button,[data-grip]')) return;
          e.preventDefault();
          onGrab(m, e);
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
        if (drag || editMode) return; // en mode déplacement/réorganisation, pas de fiche
        // Ignore le click fantôme émis juste après la fermeture du menu (Radix).
        if (Date.now() - menuActionAtRef.current < 500) return;
        const t = e.target as HTMLElement;
        if (t.closest('button') || t.closest('[data-grip]')) return;
        onOpenMember(m, 'profile');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target !== e.currentTarget) return; // boutons internes
          e.preventDefault();
          if (isDropTarget) drag.onDrop(m.userId);
          else if (!drag) onOpenMember(m, 'profile');
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
          ? t('pyramid.placeUnder', { member: drag.member.displayName, target: m.displayName })
          : t('pyramid.cardAria', {
              name: isMe ? t('pyramid.you') : m.displayName,
              role: m.role === 'admin' ? t('pyramid.roleAdmin') : manager ? t('pyramid.roleManager') : t('pyramid.roleMember'),
              reports: node.children.length > 0 ? tp('pyramid.directReports', node.children.length) : '',
            })
      }
      style={isDragSource || editDraggable ? { touchAction: 'none' } : undefined}
      className={`inline-flex items-center rounded-2xl border bg-[rgb(var(--color-surface))] transition-colors ${
        isDropTarget && mobile ? 'gap-2.5 px-3 py-3.5' : 'gap-2.5 px-3 py-2'
      } ${borderClass} ${
        isDragSource ? `cursor-grab select-none ${drag.pointerActive ? 'opacity-40' : ''}` : ''
      } ${isDropTarget ? 'cursor-pointer animate-wiggle' : ''} ${
        editDraggable ? 'cursor-grab select-none animate-wiggle' : ''
      }`}
    >
      {!mobile && movable && !drag && (
        <span
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            onGrab(m, e);
          }}
          title={t('pyramid.dragToMove', { name: m.displayName })}
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
          aria-label={collapsed ? t('pyramid.expandTeam', { name: m.displayName }) : t('pyramid.collapseTeam', { name: m.displayName })}
          aria-expanded={!collapsed}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
        >
          {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
      )}
      <MemberAvatar avatar={m.avatar} name={m.displayName} size={34} />
      <div className="min-w-0">
          <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate max-w-[140px]">
            {isMe ? t('pyramid.you') : m.displayName}
          </p>
          {/* Calque de charge : voir l'organisation ET sa santé sur le même
              écran. Rendu seulement si la personne a des tâches ouvertes —
              une barre vide n'apprend rien. */}
          {myWorkload && myWorkload.open > 0 && (
            <span
              className="flex items-center gap-1 mt-0.5"
              title={
                myWorkload.overdue > 0
                  ? tp('pyramid.workloadTitleOverdue', myWorkload.open, {
                      duration: formatDuration(myWorkload.estimatedMinutes),
                      overdue: myWorkload.overdue,
                    })
                  : tp('pyramid.workloadTitle', myWorkload.open, {
                      duration: formatDuration(myWorkload.estimatedMinutes),
                    })
              }
            >
              <span className="w-10 h-1 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden shrink-0">
                <span
                  className={`block h-full rounded-full ${
                    workloadTone(myWorkload.loadRatio) === 'over'
                      ? 'bg-red-500'
                      : workloadTone(myWorkload.loadRatio) === 'under'
                        ? 'bg-[rgb(var(--color-text-muted))]'
                        : 'bg-[rgb(var(--color-accent))]'
                  }`}
                  style={{ width: `${Math.min(100, Math.round(myWorkload.loadRatio * 66))}%` }}
                />
              </span>
              {/* Format x/y : x = tâches ouvertes non en retard, y = en
                  retard. Le "/" est un séparateur littéral, pas un symbole
                  de division. */}
              <span className="text-caption tabular-nums" style={{ color: 'rgb(var(--color-text-muted))' }}>
                {myWorkload.open - myWorkload.overdue}
                <span className={myWorkload.overdue > 0 ? 'font-bold text-red-500' : ''}>
                  /{myWorkload.overdue}
                </span>
              </span>
            </span>
          )}
          <p
            className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] inline-flex items-center gap-1.5"
            title={
              totalReports > node.children.length
                ? tp('pyramid.directCount', node.children.length) + t('pyramid.totalSuffix', { count: totalReports })
                : undefined
            }
          >
            <span>
              {m.role === 'admin' ? t('pyramid.badgeAdmin') : manager ? t('pyramid.badgeManager') : t('pyramid.badgeMember')}
              {node.children.length > 0 ? ` · ${node.children.length}` : ''}
              {totalReports > node.children.length ? t('pyramid.totalSuffix', { count: totalReports }) : ''}
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
      {!drag && (movable || canAddUnder || canRemove) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('common.actionsFor', { name: m.displayName })}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] shrink-0"
          >
            <MoreHorizontal size={15} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
            onClick={() => {
              menuActionAtRef.current = Date.now();
            }}
          >
            {/* Icônes SANS classe de couleur : DropdownMenuItem applique déjà
                `text-muted-foreground` à tout svg qui n'en porte pas — même
                style neutre que le menu d'actions de TaskTable. */}
            {canAddUnder && (
              <DropdownMenuItem onClick={() => onAddUnder(m)}>
                <UserRoundPlus size={14} aria-hidden="true" />
                {t('common.addCollaborator')}
              </DropdownMenuItem>
            )}
            {movable && (
              <DropdownMenuItem onClick={() => onStartDrag(m)}>
                <Move size={14} aria-hidden="true" />
                {t('pyramid.move')}
              </DropdownMenuItem>
            )}
            {canSeeInsights && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onOpenMember(m, 'tasks')}>
                  <ListTodo size={14} aria-hidden="true" />
                  {t('pyramid.seeTasksAction')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenMember(m, 'agenda')}>
                  <CalendarDays size={14} aria-hidden="true" />
                  {t('common.seeAgenda')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenMember(m, 'contribution')}>
                  <TrendingUp size={14} aria-hidden="true" />
                  {t('common.seeContribution')}
                </DropdownMenuItem>
              </>
            )}
            {canRemove && (
              <>
                <DropdownMenuSeparator />
                {/* `!text-red-500` explicite : le sélecteur Tailwind
                    `data-[variant=destructive]:*:[svg]:!text-destructive`
                    du composant ne colore pas l'icône (constaté), même
                    override que TaskTable pour « Supprimer ». */}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onRemove(m)}
                  className="!text-red-500 focus:!text-red-500"
                >
                  <Trash2 className="!text-red-500" size={14} aria-hidden="true" />
                  {t('common.removeFromOrg')}
                </DropdownMenuItem>
              </>
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
          <NodeCard key={c.member.userId} node={c} members={members} currentUserId={currentUserId} isAdmin={isAdmin} onStartDrag={onStartDrag} onAddUnder={onAddUnder} onRemove={onRemove} onGrab={onGrab} drag={drag} flashId={flashId} collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse} matchIds={matchIds} teamsByUser={teamsByUser} onOpenMember={onOpenMember} workloadByUser={workloadByUser} editMode={editMode} depth={depth + 1} mobile />
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
                  <NodeCard node={c} members={members} currentUserId={currentUserId} isAdmin={isAdmin} onStartDrag={onStartDrag} onAddUnder={onAddUnder} onRemove={onRemove} onGrab={onGrab} drag={drag} flashId={flashId} collapsedIds={collapsedIds} onToggleCollapse={onToggleCollapse} matchIds={matchIds} teamsByUser={teamsByUser} onOpenMember={onOpenMember} workloadByUser={workloadByUser} editMode={editMode} depth={depth + 1} mobile={false} />
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
export const PyramidSkeleton = () => (
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
