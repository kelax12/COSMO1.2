// Édition EN LIGNE du tableau des tâches d'équipe : chaque cellule ouvre un
// petit panneau dédié à SA donnée (nom, projet, durée, catégorie), comme
// l'échéance et l'état. Briques communes : `@/components/ui/inline-edit`.

import type { TeamTask } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { InlineShell, OptionList, TextEditor, DurationEditor } from '@/components/ui/inline-edit';
import { formatDuration, projectColor } from './team-projects.helpers';

export const NameCell = ({ task, disabledReason, onSave }: { task: TeamTask; disabledReason?: string; onSave: (name: string) => void }) => {
  const { t } = useT('portfolio');
  return (
    <InlineShell
      label={t('taskTable.editNameAria', { name: task.name })}
      disabledReason={disabledReason}
      triggerClassName="min-w-0"
      trigger={<span className="truncate" title={task.name}>{task.name}</span>}
    >
      {(close) => <TextEditor value={task.name} label={t('taskTable.nameLabel')} saveLabel={t('taskTable.save')} onSave={onSave} close={close} />}
    </InlineShell>
  );
};

export const ProjectCell = ({ task, projects, disabledReason, onPick }: {
  task: TeamTask; projects: readonly { id: string; name: string; color: string }[]; disabledReason?: string; onPick: (projectId: string) => void;
}) => {
  const { t } = useT('portfolio');
  const current = projects.find((p) => p.id === task.projectId);
  return (
    <InlineShell
      label={t('taskTable.editProjectAria', { name: task.name })}
      disabledReason={disabledReason}
      triggerClassName="text-sm text-[rgb(var(--color-text-secondary))]"
      trigger={<span className="truncate">{current?.name ?? '—'}</span>}
    >
      {(close) => (
        <OptionList
          options={projects.map((p) => ({ id: p.id, label: p.name, dot: projectColor(p.color).dot }))}
          current={task.projectId}
          onPick={(id) => { close(); if (id !== task.projectId) onPick(id); }}
        />
      )}
    </InlineShell>
  );
};

export const CategoryCell = ({ task, categoryName, categories, disabledReason, onPick }: {
  task: TeamTask; categoryName?: string; categories: readonly { id: string; label: string }[]; disabledReason?: string; onPick: (id: string | null) => void;
}) => {
  const { t } = useT('portfolio');
  return (
    <InlineShell
      label={t('taskTable.editCategoryAria', { name: task.name })}
      disabledReason={disabledReason}
      triggerClassName="text-sm text-[rgb(var(--color-text-secondary))] max-w-[160px]"
      trigger={<span className="truncate" title={categoryName}>{categoryName ?? '—'}</span>}
    >
      {(close) => (
        <OptionList<string | null>
          options={[{ id: null, label: t('taskTable.noCategory') }, ...categories]}
          current={task.categoryId ?? null}
          onPick={(id) => { close(); if (id !== (task.categoryId ?? null)) onPick(id); }}
        />
      )}
    </InlineShell>
  );
};

export const DurationCell = ({ task, disabledReason, onPick }: { task: TeamTask; disabledReason?: string; onPick: (minutes: number) => void }) => {
  const { t } = useT('portfolio');
  const current = task.estimatedTime ?? 0;
  return (
    <InlineShell
      label={t('taskTable.editDurationAria', { name: task.name })}
      disabledReason={disabledReason}
      triggerClassName="text-base font-medium text-[rgb(var(--color-text-primary))]"
      trigger={formatDuration(current)}
    >
      {(close) => <DurationEditor value={current} label={t('taskTable.durationMinutes')} format={formatDuration} onPick={onPick} close={close} />}
    </InlineShell>
  );
};
