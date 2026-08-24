import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import type { TeamTask } from '@/modules/team-projects';
import MemberAvatar from './MemberAvatar';
import { MemberAgendaBody } from './MemberAgendaBody';
import { useT } from '@/i18n/useT';

/** Sans accents/casse — même normalisation que MemberDirectory. */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface AssignEventDialogProps {
  /** Tâche ciblée par « Assigner l'événement » — null = dialog fermé. */
  task: TeamTask | null;
  /**
   * Agendas consultables par l'utilisateur courant (soi + son sous-arbre, ou
   * toute l'organisation pour un admin) — même périmètre que `canSeeAgenda`
   * dans MemberSheet/MemberDirectory, calculé par l'appelant.
   */
  members: OrgMember[];
  currentUserId?: string;
  onClose: () => void;
}

/**
 * « Assigner l'événement » — MÊME corps d'agenda que la fiche membre
 * (MemberAgendaBody, réutilisé tel quel : calendrier, tâches à planifier par
 * glisser-déposer, création/édition d'événement), avec un panneau de droite
 * pour choisir DE QUI on regarde l'agenda. La personne sélectionnée dans la
 * liste est celle à qui appartient l'agenda affiché à gauche — il n'y a pas
 * de second état à synchroniser.
 */
const AssignEventDialog = ({ task, members, currentUserId, onClose }: AssignEventDialogProps) => {
  const { t } = useT('org');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // `task` change à chaque ouverture (nouvelle tâche ciblée) — resynchronise
  // la personne présélectionnée sans dépendre d'un useEffect (même pattern
  // que AssignMembersDialog).
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (task && task.id !== openedFor) {
    setOpenedFor(task.id);
    setQuery('');
    // Préselection : le 1er assigné de la tâche dont l'agenda est consultable,
    // sinon soi-même (toujours en tête de `members`, cf. l'appelant).
    const defaultId = task.assigneeIds.find((id) => members.some((m) => m.userId === id))
      ?? members[0]?.userId
      ?? null;
    setSelectedId(defaultId);
  }

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return members;
    return members.filter(
      (m) => normalize(m.displayName).includes(q) || (m.email ? normalize(m.email).includes(q) : false),
    );
  }, [members, query]);

  const selectedMember = members.find((m) => m.userId === selectedId) ?? null;

  if (!task) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] w-full shadow-2xl flex flex-col rounded-t-[24px] sm:rounded-2xl h-[92dvh] sm:h-[90vh] sm:max-w-[79.2rem]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${t('projects.tasksTabScheduleAction')} — ${task.name}`}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[rgb(var(--color-border))] shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {t('projects.tasksTabScheduleAction')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[rgb(var(--color-hover))] shrink-0"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Corps : agenda de la personne sélectionnée + panneau de choix */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {selectedMember ? (
              // `key` force un remontage complet à chaque changement de
              // personne : MemberAgendaBody a été conçu pour un montage par
              // personne (fiche membre, cf. son commentaire d'en-tête sur la
              // mesure du conteneur FullCalendar), jamais pour rester monté
              // en changeant seulement sa prop `member` — sans ce `key`, son
              // état interne (fenêtre chargée, vue, instance FullCalendar)
              // restait celui de la première personne sélectionnée.
              <MemberAgendaBody key={selectedMember.userId} member={selectedMember} onlyTaskId={task.id} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-center px-6" style={{ color: 'rgb(var(--color-text-muted))' }}>
                {t('assign.pickPersonAgenda')}
              </div>
            )}
          </div>

          <aside className="w-56 sm:w-72 shrink-0 border-l border-[rgb(var(--color-border))] flex flex-col">
            <div className="p-3 border-b border-[rgb(var(--color-border))] shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(var(--color-text-muted))' }} aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('directory.searchPlaceholder')}
                  aria-label={t('directory.searchAria')}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                  style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-background))', color: 'rgb(var(--color-text-primary))' }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
              {filtered.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  {t('directory.noMatch', { query })}
                </p>
              ) : (
                filtered.map((m) => {
                  const active = m.userId === selectedId;
                  const isSelf = m.userId === currentUserId;
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => setSelectedId(m.userId)}
                      aria-pressed={active}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        active ? 'bg-indigo-500/10' : 'hover:bg-[rgb(var(--color-hover))]'
                      }`}
                    >
                      <MemberAvatar avatar={m.avatar} name={m.displayName} size={30} />
                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-sm font-medium truncate"
                          style={{ color: active ? 'rgb(var(--color-accent))' : 'rgb(var(--color-text-primary))' }}
                        >
                          {/* Pas de suffixe redondant si le nom affiché est déjà
                              le placeholder « Vous »/« You » (fixtures démo). */}
                          {m.displayName}{isSelf && m.displayName !== t('common.youBadge') ? ` (${t('common.youBadge')})` : ''}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AssignEventDialog;
