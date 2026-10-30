import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ListChecks, Plus, X } from 'lucide-react';
import { useCreateTeamList, useTeamLists } from '@/modules/team-lists';
import { resolveListColor } from '@/pages/tasks/list-colors';
import { InlineForm } from '@/components/add-to-list/shared';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

interface TeamTaskListsFieldProps {
  orgId: string;
  /** Listes choisies DANS LA FICHE : écrites à l'enregistrement, pas au clic. */
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * Listes d'une tâche d'équipe (mig. 203), onglet « Avancé » de la fiche.
 * Refait le 2026-10-30 sur le modèle de la popup « Ajouter à une liste » du
 * mode personnel (`DesktopAddToList`) : un bouton ouvre toutes les listes, on
 * coche, et les listes cochées s'affichent en pastilles sous le titre.
 *
 * Seules les listes MANUELLES se cochent : une liste intelligente est un
 * filtre, on n'y range rien. La sélection reste un état de la fiche (elle
 * compte dans « modifications non enregistrées ») ; créer une liste l'ajoute
 * à l'organisation tout de suite, et la coche.
 */
const TeamTaskListsField = ({ orgId, value, onChange }: TeamTaskListsFieldProps) => {
  const { t } = useT('org');
  const { data: allLists = [], isLoading } = useTeamLists(orgId);
  const lists = allLists.filter((l) => l.type !== 'smart');
  const createList = useCreateTeamList(orgId);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const close = () => { setOpen(false); setCreating(false); };

  // C-53 : la popup s'empile sur la fiche ; seule la dernière surface réagit à Échap.
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: () => (creating ? setCreating(false) : close()),
    labelledBy: 'team-add-to-list-title',
  });

  const handleCreate = (name: string, color: string) => {
    createList.mutate({ name, color }, { onSuccess: (list) => onChange([...value, list.id]) });
    setCreating(false);
  };

  // Pendant le chargement, rien : « aucune liste » serait affirmé sans savoir (C-40).
  if (isLoading) return null;

  const chosen = lists.filter((l) => value.includes(l.id));

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-secondary))]">
          <ListChecks size={12} className="inline-block mr-1 align-[-1px]" aria-hidden="true" />
          {t('teamLists.fieldTitle')}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 min-h-9 px-2.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
        >
          <Plus size={13} aria-hidden="true" /> {t('teamLists.addToList')}
        </button>
      </div>

      {chosen.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((list) => {
            const hex = resolveListColor(list.color);
            return (
              <span
                key={list.id}
                className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-full text-xs font-semibold text-[rgb(var(--color-text-primary))]"
                style={{ backgroundColor: `${hex}22`, boxShadow: `inset 0 0 0 1.5px ${hex}` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} aria-hidden="true" />
                {list.name}
                <button
                  type="button"
                  onClick={() => toggle(list.id)}
                  aria-label={t('teamLists.removeFromList', { name: list.name })}
                  className="w-6 h-6 rounded-full inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      ) : lists.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('teamLists.empty')}</p>
      ) : null}

      {open && createPortal(
        <div
          ref={ref}
          {...dialogProps}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] bg-[rgb(var(--color-surface))]"
          >
            <div className="px-6 pt-6 pb-4 border-b border-[rgb(var(--color-border))] shrink-0 flex items-center justify-between gap-3">
              <div>
                <h2 id="team-add-to-list-title" className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
                  {t('teamLists.addToList')}
                </h2>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t('teamLists.pickerCount', { count: value.length })}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={t('common.close')}
                className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
              {creating ? (
                <InlineForm onSave={handleCreate} onCancel={() => setCreating(false)} saveLabel={t('teamLists.create')} />
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                >
                  <Plus size={16} className="shrink-0" aria-hidden="true" />
                  {t('teamLists.newList')}
                </button>
              )}

              {lists.length === 0 && !creating && (
                <p className="py-8 text-center text-sm text-[rgb(var(--color-text-muted))]">{t('teamLists.empty')}</p>
              )}

              {lists.length > 0 && (
                <div className="border-t border-[rgb(var(--color-border))] mt-2 divide-y divide-[rgb(var(--color-border))]" role="group" aria-label={t('teamLists.fieldTitle')}>
                  {lists.map((list) => {
                    const on = value.includes(list.id);
                    const hex = resolveListColor(list.color);
                    return (
                      <button
                        key={list.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(list.id)}
                        className="w-full flex items-center gap-3 px-1 py-3.5 text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} aria-hidden="true" />
                        <span className="flex-1 min-w-0 text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">{list.name}</span>
                        {on && (
                          <span className="w-5 h-5 rounded-full flex items-center justify-center mr-1 shrink-0" style={{ backgroundColor: hex }} aria-hidden="true">
                            <Check size={11} className="text-white" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 pt-3 pb-5 border-t border-[rgb(var(--color-border))] shrink-0">
              <button
                type="button"
                onClick={close}
                className="w-full min-h-10 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] transition-colors"
              >
                {t('teamLists.pickerDone')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default TeamTaskListsField;
