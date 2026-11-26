// Édition EN LIGNE du tableau des tâches perso (desktop) : nom, catégorie,
// priorité, échéance et durée s'éditent depuis leur cellule, dans un panneau
// dédié, comme l'état. Même gabarit que le tableau entreprise.

import { useCategories, type Category } from '@/modules/categories';
import { useUpdateTask, type Task } from '@/modules/tasks';
import { DateCalendarPanel, DATE_PANEL_CLASS } from '@/components/ui/date-picker';
import { InlineShell, OptionList, TextEditor, DurationEditor } from '@/components/ui/inline-edit';
import { NO_CATEGORY_COLOR } from '@/lib/category-colors';
import { useT } from '@/i18n/useT';
import { formatDeadlineSmart, formatDuration, isTaskOverdue } from './helpers';

type Updates = Partial<Pick<Task, 'name' | 'category' | 'priority' | 'deadline' | 'estimatedTime'>>;

const useSave = (task: Task) => {
  const { mutate } = useUpdateTask();
  return (updates: Updates) => mutate({ id: task.id, updates });
};

export const PersoNameCell = ({ task }: { task: Task }) => {
  const { t } = useT('tasks');
  const save = useSave(task);
  return (
    <InlineShell label={t('card.inlineRenameAria', { name: task.name })} triggerClassName="min-w-0"
      trigger={<span className="truncate" title={task.name}>{task.name}</span>}>
      {(close) => <TextEditor value={task.name} label={t('card.inlineNameLabel')} saveLabel={t('card.inlineSave')} onSave={(name) => save({ name })} close={close} />}
    </InlineShell>
  );
};

export const PersoCategoryCell = ({ task, category }: { task: Task; category?: Category }) => {
  const { t } = useT('tasks');
  const save = useSave(task);
  const { data: categories = [] } = useCategories();
  return (
    <InlineShell label={t('card.inlineCategoryAria', { name: task.name })} triggerClassName="text-sm text-[rgb(var(--color-text-secondary))]"
      trigger={<>
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: category?.color || NO_CATEGORY_COLOR }} />
        <span className="truncate">{category?.name ?? '—'}</span>
      </>}>
      {(close) => (
        <OptionList
          options={categories.map((c) => ({ id: c.id, label: c.name, color: c.color || NO_CATEGORY_COLOR }))}
          current={task.category}
          onPick={(id) => { close(); if (id !== task.category) save({ category: id }); }}
        />
      )}
    </InlineShell>
  );
};

export const PersoPriorityCell = ({ task }: { task: Task }) => {
  const { t } = useT('tasks');
  const save = useSave(task);
  return (
    <InlineShell label={t('card.inlinePriorityAria', { name: task.name })} triggerClassName="!p-0 rounded-full" panelClassName="w-48 p-1.5 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg"
      trigger={task.priority === 0
        ? <span className="inline-flex justify-center items-center w-8 h-8 text-base font-medium text-[rgb(var(--color-text-muted))]">—</span>
        : <span className={`inline-flex justify-center items-center w-8 h-8 rounded-full task-priority-${task.priority} text-base font-bold`}>{task.priority}</span>}>
      {(close) => (
        <OptionList
          options={[1, 2, 3, 4, 5, 0].map((p) => ({ id: p, label: p === 0 ? t('card.noPriority') : String(p), dot: p === 0 ? undefined : `task-priority-${p}` }))}
          current={task.priority}
          onPick={(p) => { close(); if (p !== task.priority) save({ priority: p }); }}
        />
      )}
    </InlineShell>
  );
};

export const PersoDeadlineCell = ({ task }: { task: Task }) => {
  const { t } = useT('tasks');
  const save = useSave(task);
  const overdue = isTaskOverdue(task.deadline, task.completed);
  return (
    <InlineShell label={t('card.inlineDeadlineAria', { name: task.name })} triggerClassName="text-base font-medium" panelClassName={DATE_PANEL_CLASS}
      trigger={task.deadline
        ? <time dateTime={task.deadline} className={overdue ? 'text-[rgb(var(--color-danger-text))] font-semibold' : ''}>{formatDeadlineSmart(task.deadline)}</time>
        : <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('card.noDeadline')}</span>}>
      {(close) => (
        <DateCalendarPanel value={task.deadline} onSelect={(d) => { close(); if (d !== (task.deadline ?? '')) save({ deadline: d }); }} />
      )}
    </InlineShell>
  );
};

export const PersoDurationCell = ({ task }: { task: Task }) => {
  const { t } = useT('tasks');
  const save = useSave(task);
  return (
    <InlineShell label={t('card.inlineDurationAria', { name: task.name })} triggerClassName="text-base font-medium text-[rgb(var(--color-text-primary))]"
      trigger={formatDuration(task.estimatedTime)}>
      {(close) => <DurationEditor value={task.estimatedTime ?? 0} label={t('card.inlineDurationMinutes')} format={formatDuration} onPick={(m) => save({ estimatedTime: m })} close={close} />}
    </InlineShell>
  );
};
