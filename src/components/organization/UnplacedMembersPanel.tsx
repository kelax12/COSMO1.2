// ═══════════════════════════════════════════════════════════════════
// Les personnes qui ne sont rattachées à personne
//
// FRONTIÈRE : ce composant reçoit une LISTE de membres et deux rappels. Il
// ne connaît ni l'arbre, ni qui est le manager de qui, ni ce qu'un
// déplacement veut dire — c'est `PyramidTab` qui décide si quelqu'un est
// « non placé », et `usePyramidDnd` qui sait ce que « saisir » déclenche.
//
// Deux variantes parce qu'il y a deux emplacements, pas deux composants :
// `section` (mobile, ou pyramide vide) ouvre la page ; `sidebar` (desktop)
// est la colonne de droite d'où l'on glisse les cartes. Les rendre séparément
// avait produit deux copies du même bloc, divergentes sur le libellé.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { UserPlus, GripVertical } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import { useT } from '@/i18n/useT';

interface UnplacedMembersPanelProps {
  members: OrgMember[];
  isAdmin: boolean;
  /** Emplacement : bandeau en haut de page, ou colonne de droite (desktop). */
  variant: 'section' | 'sidebar';
  /** Ouvre la feuille de placement pour ce membre. */
  onPlace: (member: OrgMember) => void;
  /** Saisie au pointeur — `sidebar` seulement (on ne glisse pas sur mobile). */
  onGrab?: (member: OrgMember, e: { clientX: number; clientY: number }) => void;
  /** Membre actuellement glissé, pour l'estomper dans la liste. */
  draggingId?: string | null;
  /** Un glisser est en cours : on masque les actions qui gêneraient le geste. */
  isDragging?: boolean;
}

const UnplacedMembersPanel = ({
  members,
  isAdmin,
  variant,
  onPlace,
  onGrab,
  draggingId,
  isDragging = false,
}: UnplacedMembersPanelProps) => {
  const { t } = useT('org');

  if (members.length === 0) return null;

  if (variant === 'section') {
    return (
      <section className="rounded-2xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-900/10 p-4">
        <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1 inline-flex items-center gap-1.5">
          <UserPlus size={15} aria-hidden="true" /> {t('pyramid.unplaced', { count: members.length })}
        </h3>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
          {isAdmin ? t('pyramid.unplacedHintAdmin') : t('pyramid.unplacedHintMember')}
        </p>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2">
              <MemberAvatar avatar={m.avatar} name={m.displayName} size={30} />
              <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{m.displayName}</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onPlace(m)}
                  className="ml-1 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  {t('pyramid.place')}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <aside
      className="w-60 shrink-0 sticky top-4 rounded-2xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-900/10 p-4"
      aria-label={t('pyramid.toPlaceAria')}
    >
      <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1 inline-flex items-center gap-1.5">
        <UserPlus size={15} aria-hidden="true" /> {t('pyramid.toPlace', { count: members.length })}
      </h3>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
        {isAdmin ? t('pyramid.dragEachHint') : t('pyramid.unplacedHintMember')}
      </p>
      <ul className="space-y-2">
        {members.map((m) => {
          const isBeingDragged = draggingId === m.userId;
          return (
            <li key={m.userId}>
              <div
                onPointerDown={
                  isAdmin && onGrab
                    ? (e) => {
                        if (e.pointerType === 'mouse' && e.button !== 0) return;
                        if ((e.target as HTMLElement).closest('button')) return;
                        e.preventDefault();
                        onGrab(m, e);
                      }
                    : undefined
                }
                style={isAdmin ? { touchAction: 'none' } : undefined}
                title={isAdmin ? t('pyramid.dragHint', { name: m.displayName }) : undefined}
                className={`flex items-center gap-2 rounded-xl border bg-[rgb(var(--color-surface))] px-2.5 py-2 transition-colors ${
                  isBeingDragged
                    ? 'border-indigo-400 ring-2 ring-indigo-400/30 opacity-40'
                    : 'border-[rgb(var(--color-border))]'
                } ${isAdmin ? 'cursor-grab select-none' : ''} ${isAdmin && !isDragging ? 'animate-wiggle' : ''}`}
              >
                {isAdmin && (
                  <GripVertical size={12} className="text-[rgb(var(--color-text-muted))]/50 shrink-0" aria-hidden="true" />
                )}
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={28} />
                <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate flex-1">
                  {m.displayName}
                </span>
                {isAdmin && !isDragging && (
                  <button
                    type="button"
                    onClick={() => onPlace(m)}
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
  );
};

export default UnplacedMembersPanel;
