// Édition EN LIGNE du tableau des tâches d'équipe : chaque cellule ouvre un
// petit panneau dédié à SA donnée (nom, projet, durée, catégorie), comme
// l'échéance et l'état. La grande fiche reste au clic sur le reste de la ligne.

import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { TeamTask } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { formatDuration, projectColor } from './team-projects.helpers';

const cellBtn = 'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 max-w-full text-left transition-colors hover:bg-[rgb(var(--color-hover))] disabled:cursor-not-allowed disabled:hover:bg-transparent';
const panel = 'w-64 p-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg';
const optionCls = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]';
const inputCls = 'w-full rounded-md border border-[rgb(var(--color-border))] bg-transparent px-2 py-1.5 text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]';

interface InlineShellProps {
  label: string;
  disabledReason?: string;
  trigger: ReactNode;
  triggerClassName?: string;
  children: (close: () => void) => ReactNode;
}

/** Déclencheur + panneau : un seul gabarit pour toutes les cellules. */
const InlineShell = ({ label, disabledReason, trigger, triggerClassName = '', children }: InlineShellProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={!!disabledReason} title={disabledReason} aria-label={label} className={`${cellBtn} ${triggerClassName}`}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className={panel} onClick={(e) => e.stopPropagation()}>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
};

interface OptionListProps {
  options: readonly { id: string | null; label: string; dot?: string }[];
  current: string | null | undefined;
  onPick: (id: string | null) => void;
}

const OptionList = ({ options, current, onPick }: OptionListProps) => (
  <div className="max-h-72 overflow-y-auto" role="listbox">
    {options.map((o) => (
      <button key={o.id ?? '∅'} type="button" role="option" aria-selected={o.id === (current ?? null)} className={optionCls} onClick={() => onPick(o.id)}>
        {o.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${o.dot}`} aria-hidden="true" />}
        <span className="truncate">{o.label}</span>
        {o.id === (current ?? null) && <Check size={14} className="ml-auto shrink-0" aria-hidden="true" />}
      </button>
    ))}
  </div>
);

export const NameCell = ({ task, disabledReason, onSave }: { task: TeamTask; disabledReason?: string; onSave: (name: string) => void }) => {
  const { t } = useT('portfolio');
  const [draft, setDraft] = useState(task.name);
  return (
    <InlineShell
      label={t('taskTable.editNameAria', { name: task.name })}
      disabledReason={disabledReason}
      triggerClassName="min-w-0"
      trigger={<span className="truncate" title={task.name}>{task.name}</span>}
    >
      {(close) => (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = draft.trim();
            if (name && name !== task.name) onSave(name);
            close();
          }}
        >
          {/* Monté à l'ouverture : le brouillon repart du nom courant. */}
          <input autoFocus defaultValue={task.name} onChange={(e) => setDraft(e.target.value)} maxLength={200} className={inputCls} aria-label={t('taskTable.nameLabel')} />
          <button type="submit" className="self-end rounded-md px-3 py-1 text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]">
            {t('taskTable.save')}
          </button>
        </form>
      )}
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
          onPick={(id) => { close(); if (id && id !== task.projectId) onPick(id); }}
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
        <OptionList
          options={[{ id: null, label: t('taskTable.noCategory') }, ...categories]}
          current={task.categoryId ?? null}
          onPick={(id) => { close(); if (id !== (task.categoryId ?? null)) onPick(id); }}
        />
      )}
    </InlineShell>
  );
};

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];

export const DurationCell = ({ task, disabledReason, onPick }: { task: TeamTask; disabledReason?: string; onPick: (minutes: number) => void }) => {
  const { t } = useT('portfolio');
  const current = task.estimatedTime ?? 0;
  const [draft, setDraft] = useState(String(current || ''));
  const pick = (m: number, close: () => void) => { close(); if (m !== current) onPick(m); };
  return (
    <InlineShell
      label={t('taskTable.editDurationAria', { name: task.name })}
      disabledReason={disabledReason}
      triggerClassName="text-base font-medium text-[rgb(var(--color-text-primary))]"
      trigger={formatDuration(current)}
    >
      {(close) => (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-1">
            {DURATION_PRESETS.map((m) => (
              <button key={m} type="button" onClick={() => pick(m, close)}
                className={`rounded-md px-1 py-1.5 text-xs font-semibold transition-colors ${m === current ? 'bg-[rgb(var(--color-accent)/0.15)] text-[rgb(var(--color-accent))]' : 'hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]'}`}>
                {formatDuration(m)}
              </button>
            ))}
          </div>
          <form className="flex items-center gap-2" onSubmit={(e) => {
            e.preventDefault();
            const m = Math.round(Number(draft));
            if (Number.isFinite(m) && m >= 0 && m <= 10080) pick(m, close);
          }}>
            <input type="number" min={0} max={10080} step={5} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputCls} aria-label={t('taskTable.durationMinutes')} />
            <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">min</span>
            <button type="submit" className="rounded-md px-2 py-1 text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]">OK</button>
          </form>
        </div>
      )}
    </InlineShell>
  );
};
