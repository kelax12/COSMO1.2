import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, X } from 'lucide-react';
import {
  useAddTaskToTeamList, useCreateTeamList, useRemoveTaskFromTeamList, useTeamLists,
} from '@/modules/team-lists';
import { resolveListColor } from '@/pages/tasks/list-colors';
import { InlineForm } from '@/components/add-to-list/shared';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

interface TeamBulkAddToListDialogProps {
  orgId: string;
  /** Tâches sélectionnées dans la barre d'actions groupées. */
  taskIds: string[];
  onClose: () => void;
}

/**
 * « Ajouter à une liste » de la sélection multiple d'entreprise (2026-10-30),
 * même UX que son homologue de la page Tâches perso (`BulkAddToListModal`) :
 * une liste qui contient déjà TOUTE la sélection est cochée, et la toucher
 * retire la sélection ; sinon elle l'y ajoute. Créer une liste ici l'ajoute à
 * l'organisation puis y range la sélection.
 */
const TeamBulkAddToListDialog = ({ orgId, taskIds, onClose }: TeamBulkAddToListDialogProps) => {
  const { t } = useT('org');
  const { data: allLists = [] } = useTeamLists(orgId);
  const lists = allLists.filter((l) => l.type !== 'smart');
  const addTask = useAddTaskToTeamList(orgId);
  const removeTask = useRemoveTaskFromTeamList(orgId);
  const createList = useCreateTeamList(orgId);
  const [creating, setCreating] = useState(false);

  // Échap à étages : le sous-formulaire de création se ferme d'abord.
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => (creating ? setCreating(false) : onClose()),
    labelledBy: 'team-bulk-add-to-list-title',
  });

  const containsAll = (list: { taskIds: string[] }) => taskIds.length > 0 && taskIds.every((id) => list.taskIds.includes(id));

  const pick = (list: { id: string; taskIds: string[] }) => {
    if (containsAll(list)) taskIds.forEach((taskId) => removeTask.mutate({ listId: list.id, taskId }));
    else taskIds.filter((id) => !list.taskIds.includes(id)).forEach((taskId) => addTask.mutate({ listId: list.id, taskId }));
    onClose();
  };

  const handleCreate = (name: string, color: string) => {
    createList.mutate({ name, color }, {
      onSuccess: (list) => taskIds.forEach((taskId) => addTask.mutate({ listId: list.id, taskId })),
    });
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      {...dialogProps}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] bg-[rgb(var(--color-surface))]"
      >
        <div className="px-6 pt-6 pb-4 border-b border-[rgb(var(--color-border))] shrink-0 flex items-center justify-between gap-3">
          <div>
            <h2 id="team-bulk-add-to-list-title" className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
              {t('teamLists.addToList')}
            </h2>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t('teamLists.pickerCount', { count: taskIds.length })}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
            <div className="border-t border-[rgb(var(--color-border))] mt-2 divide-y divide-[rgb(var(--color-border))]">
              {lists.map((list) => {
                const on = containsAll(list);
                const hex = resolveListColor(list.color);
                return (
                  <button
                    key={list.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(list)}
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
      </div>
    </div>,
    document.body,
  );
};

export default TeamBulkAddToListDialog;
