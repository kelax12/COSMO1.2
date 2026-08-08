import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Link as LinkIcon, UserRound, ListTodo, TrendingUp, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { isManagerOf, type OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import MemberAvatar from './MemberAvatar';
import { useT } from '@/i18n/useT';
import { buildOrgLink } from './deep-link.helpers';
import {
  MEMBER_TAB_PARAM,
  resolveMemberTab,
  visibleMemberTabs,
  type MemberTab,
} from './member-sheet.helpers';
import { MemberProfileBody } from './MemberProfileBody';
import { MemberTasksBody, MemberContributionBody } from './MemberInsightsBodies';
import { MemberAgendaBody } from './MemberAgendaBody';

interface MemberSheetProps {
  orgId: string;
  member: OrgMember;
  members: OrgMember[];
  /** Équipes transverses du membre. */
  teams: OrgTeam[];
  currentUserId?: string;
  /** Le membre peut-il être déplacé par l'utilisateur courant ? */
  canMove: boolean;
  /** Peut-on ajouter un collaborateur sous ce membre ? */
  canAddUnder: boolean;
  /** Supérieur hiérarchique : onglets Tâches et Contribution. */
  canSeeInsights: boolean;
  /** Agenda éditable — droit distinct (mig. 077, agenda manager). */
  canSeeAgenda: boolean;
  /** Onglet demandé par l'URL (`?memberTab=`) — validé contre les droits. */
  initialTab?: string | null;
  onClose: () => void;
  onMove: (m: OrgMember) => void;
  onAddUnder: (m: OrgMember) => void;
}

const TAB_META: Record<MemberTab, { labelKey: 'member.tabProfile' | 'member.tabTasks' | 'member.tabContribution' | 'member.tabAgenda'; Icon: typeof UserRound }> = {
  profile: { labelKey: 'member.tabProfile', Icon: UserRound },
  tasks: { labelKey: 'member.tabTasks', Icon: ListTodo },
  contribution: { labelKey: 'member.tabContribution', Icon: TrendingUp },
  agenda: { labelKey: 'member.tabAgenda', Icon: CalendarDays },
};

/**
 * Fiche membre unifiée (item #18) — une seule vue à onglets pour tout ce qu'on
 * peut savoir d'une personne : profil, tâches, contribution, agenda.
 *
 * Avant, trois sheets distincts montraient la même personne depuis trois
 * entrées de menu différentes : un manager devait choisir À L'AVANCE lequel
 * ouvrir, et rouvrir un menu pour passer de l'un à l'autre.
 *
 * Cet hôte possède TOUT le chrome (portal, overlay, en-tête, barre d'onglets)
 * et ne monte que le corps de l'onglet actif. Il ne décide rien lui-même : les
 * onglets visibles viennent de `visibleMemberTabs`, testé à part.
 */
const MemberSheet = ({
  orgId, member, members, teams, currentUserId,
  canMove, canAddUnder, canSeeInsights, canSeeAgenda,
  initialTab, onClose, onMove, onAddUnder,
}: MemberSheetProps) => {
  const { t } = useT('org');

  const tabs = useMemo(
    () => visibleMemberTabs({ canSeeInsights, canSeeAgenda }),
    [canSeeInsights, canSeeAgenda],
  );
  const [tab, setTab] = useState<MemberTab>(() => resolveMemberTab(initialTab, tabs));

  // Les droits peuvent rétrécir pendant que la fiche est ouverte (un membre
  // sort du sous-arbre après un déplacement dans la pyramide) : on ne laisse
  // pas un onglet devenu interdit affiché.
  useEffect(() => {
    setTab((current) => resolveMemberTab(current, tabs));
  }, [tabs]);

  // Échapper ferme la fiche — les trois sheets d'origine ne le faisaient pas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /**
   * URL absolue : le lien part dans une conversation, un chemin relatif n'y
   * serait pas cliquable. Il embarque l'onglet courant — partager « sa
   * contribution » et devoir dire « puis clique sur Contribution » annulerait
   * l'intérêt du lien. `writeText` peut échouer (permission refusée, page non
   * sécurisée) : on ne prétend pas avoir copié dans ce cas.
   */
  const copyProfileLink = async () => {
    const path = buildOrgLink('pyramid', { member: member.userId }, { [MEMBER_TAB_PARAM]: tab });
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast.success(t('member.copyLinkDone'));
    } catch {
      toast.error(t('member.copyLink'));
    }
  };

  const isMe = member.userId === currentUserId;
  const roleLabel = member.role === 'admin'
    ? t('pyramid.roleAdmin')
    : isManagerOf(members, member.userId)
      ? t('pyramid.roleManager')
      : t('pyramid.roleMember');

  // L'agenda est un calendrier plein écran, pas une carte : FullCalendar ne
  // sait se dimensionner que dans un conteneur à hauteur DÉFINIE. Le panneau
  // s'agrandit donc pour cet onglet — sans quoi la grille se rend écrasée.
  const wide = tab === 'agenda';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] w-full shadow-2xl flex flex-col rounded-t-[24px] sm:rounded-2xl ${
          wide ? 'h-[92dvh] sm:h-[90vh] sm:max-w-6xl' : 'max-h-[85vh] sm:max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('member.sheetAria', { name: member.displayName })}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <MemberAvatar avatar={member.avatar} name={member.displayName} size={44} />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate">
                {isMe ? t('pyramid.you') : member.displayName}
              </h2>
              <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
                {roleLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={copyProfileLink}
              aria-label={t('member.copyLink')}
              title={t('member.copyLink')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
            >
              <LinkIcon size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Barre d'onglets — inutile pour un pair, qui ne voit que le profil. */}
        {tabs.length > 1 && (
          <div
            role="tablist"
            aria-label={t('member.tabsAria')}
            className="flex gap-1 px-3 overflow-x-auto border-b border-[rgb(var(--color-border))] shrink-0"
          >
            {tabs.map((id) => {
              const { labelKey, Icon } = TAB_META[id];
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                    active
                      ? 'border-indigo-500 text-[rgb(var(--color-text-primary))]'
                      : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                  }`}
                >
                  <Icon size={15} aria-hidden="true" /> {t(labelKey)}
                </button>
              );
            })}
          </div>
        )}

        {/* Corps — un seul onglet monté à la fois (cf. FullCalendar ci-dessus). */}
        <div
          role="tabpanel"
          className={wide ? 'flex-1 min-h-0 flex flex-col' : 'flex-1 min-h-0 overflow-y-auto p-5 pt-4'}
        >
          {tab === 'profile' && (
            <MemberProfileBody
              member={member}
              members={members}
              teams={teams}
              currentUserId={currentUserId}
              canMove={canMove}
              canAddUnder={canAddUnder}
              onClose={onClose}
              onMove={onMove}
              onAddUnder={onAddUnder}
            />
          )}
          {tab === 'tasks' && <MemberTasksBody orgId={orgId} member={member} canEdit={canSeeInsights} />}
          {tab === 'contribution' && <MemberContributionBody orgId={orgId} member={member} />}
          {tab === 'agenda' && <MemberAgendaBody member={member} />}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MemberSheet;
