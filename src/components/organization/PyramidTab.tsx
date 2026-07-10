import { useState } from 'react';
import { UserPlus, ChevronDown, ChevronRight, Move, Users } from 'lucide-react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import {
  buildOrgTree,
  isManagerOf,
  type OrgMember,
  type OrgTreeNode,
} from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import MemberPlacementSheet from './MemberPlacementSheet';

interface PyramidTabProps {
  orgId: string;
  ownerId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
}

/** Peut-on déplacer `target` ? Admin : tous (sauf soi). Manager : son sous-arbre. */
function canManage(target: OrgMember, members: OrgMember[], currentUserId: string | undefined, isAdmin: boolean): boolean {
  if (!currentUserId || target.userId === currentUserId) return false;
  if (isAdmin) return true;
  // Manager : la cible doit être dans mon sous-arbre.
  let frontier = [currentUserId];
  for (let depth = 0; depth < 50 && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const m of members) {
      if (m.managerId && frontier.includes(m.managerId)) {
        if (m.userId === target.userId) return true;
        next.push(m.userId);
      }
    }
    frontier = next;
  }
  return false;
}

interface NodeCardProps {
  node: OrgTreeNode;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  onMove: (m: OrgMember) => void;
  /** Profondeur (mobile : indentation ; desktop : sans objet). */
  depth: number;
  mobile: boolean;
}

const NodeCard = ({ node, members, currentUserId, isAdmin, onMove, depth, mobile }: NodeCardProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const m = node.member;
  const manager = isManagerOf(members, m.userId);
  const movable = canManage(m, members, currentUserId, isAdmin);

  const card = (
    <div
      className={`inline-flex items-center gap-2.5 rounded-2xl border bg-[rgb(var(--color-surface))] px-3 py-2 ${
        m.role === 'admin'
          ? 'border-indigo-400/60'
          : manager
            ? 'border-blue-400/50'
            : 'border-[rgb(var(--color-border))]'
      }`}
    >
      {node.children.length > 0 && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
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
      {movable && (
        <button
          type="button"
          onClick={() => onMove(m)}
          aria-label={`Déplacer ${m.displayName} dans la pyramide`}
          title="Déplacer"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] shrink-0"
        >
          <Move size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  if (mobile) {
    return (
      <div style={{ marginLeft: depth * 16 }} className="space-y-2">
        <div className={depth > 0 ? 'border-l-2 border-[rgb(var(--color-border))] pl-3' : ''}>{card}</div>
        {!collapsed && node.children.map((c) => (
          <NodeCard key={c.member.userId} node={c} members={members} currentUserId={currentUserId} isAdmin={isAdmin} onMove={onMove} depth={depth + 1} mobile />
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
                <NodeCard node={c} members={members} currentUserId={currentUserId} isAdmin={isAdmin} onMove={onMove} depth={depth + 1} mobile={false} />
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
 * indentée. Section « Non placés » (managerId null sans subordonnés) avec CTA
 * de placement. Le bouton « + » par personne arrive au lot 1c (invitations).
 */
const PyramidTab = ({ orgId, ownerId, members, currentUserId, isAdmin }: PyramidTabProps) => {
  const isMobile = useIsMobile();
  const [moving, setMoving] = useState<OrgMember | null>(null);

  const { roots, unplaced } = buildOrgTree(members, ownerId);

  return (
    <div className="space-y-6">
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
                    onClick={() => setMoving(m)}
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
                onMove={setMoving}
                depth={0}
                mobile={isMobile}
              />
            ))}
          </div>
        </div>
      )}

      {moving && (
        <MemberPlacementSheet
          orgId={orgId}
          target={moving}
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  );
};

export default PyramidTab;
