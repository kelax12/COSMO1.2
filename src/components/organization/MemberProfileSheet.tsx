import { createPortal } from 'react-dom';
import { X, Mail, Users, Move, UserRoundPlus, Network } from 'lucide-react';
import { subtreeOf, isManagerOf, type OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import MemberAvatar from './MemberAvatar';

interface MemberProfileSheetProps {
  member: OrgMember;
  members: OrgMember[];
  /** Équipes transverses du membre. */
  teams: OrgTeam[];
  currentUserId?: string;
  /** Le membre peut-il être déplacé par l'utilisateur courant ? */
  canMove: boolean;
  /** Peut-on ajouter un collaborateur sous ce membre ? */
  canAddUnder: boolean;
  onClose: () => void;
  onMove: (m: OrgMember) => void;
  onAddUnder: (m: OrgMember) => void;
}

/**
 * Fiche membre (clic sur une carte de la pyramide) : identité, rattachement,
 * effectifs, équipes transverses et actions rapides (déplacer / ajouter).
 */
const MemberProfileSheet = ({ member, members, teams, currentUserId, canMove, canAddUnder, onClose, onMove, onAddUnder }: MemberProfileSheetProps) => {
  const m = member;
  const isMe = m.userId === currentUserId;
  const managerMember = m.managerId ? members.find((x) => x.userId === m.managerId) : null;
  const directs = members.filter((x) => x.managerId === m.userId).length;
  const total = directs > 0 ? subtreeOf(members, m.userId).size : 0;
  const roleLabel = m.role === 'admin' ? 'Admin' : isManagerOf(members, m.userId) ? 'Manager' : 'Membre';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-sm max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Profil de ${m.displayName}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <MemberAvatar avatar={m.avatar} name={m.displayName} size={52} />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))] truncate">
                {isMe ? 'Vous' : m.displayName}
              </h2>
              <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
                {roleLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <dl className="space-y-3 mb-5">
          {m.email && (
            <div className="flex items-center gap-2.5 text-sm">
              <Mail size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
              <dd className="text-[rgb(var(--color-text-secondary))] truncate">{m.email}</dd>
            </div>
          )}
          <div className="flex items-center gap-2.5 text-sm">
            <Network size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
            <dd className="text-[rgb(var(--color-text-secondary))]">
              {managerMember
                ? <>Rattaché(e) à <strong className="text-[rgb(var(--color-text-primary))]">{managerMember.userId === currentUserId ? 'vous' : managerMember.displayName}</strong></>
                : 'Sans responsable (sommet ou non placé)'}
            </dd>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Users size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
            <dd className="text-[rgb(var(--color-text-secondary))]">
              {directs === 0
                ? 'Aucun subordonné direct'
                : `${directs} direct${directs > 1 ? 's' : ''}${total > directs ? ` · ${total} au total` : ''}`}
            </dd>
          </div>
        </dl>

        {teams.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
              Équipes transverses
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {teams.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--color-border))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--color-text-secondary))]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} aria-hidden="true" />
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {(canMove || canAddUnder) && (
          <div className="flex gap-2">
            {canAddUnder && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddUnder(m);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                <UserRoundPlus size={15} aria-hidden="true" /> Ajouter
              </button>
            )}
            {canMove && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onMove(m);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
              >
                <Move size={15} aria-hidden="true" /> Déplacer
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default MemberProfileSheet;
