// Jalons d'un projet (mig. 153, M2) — une étape datée à tenir, sans être une
// tâche : « Maquettes validées », « Mise en ligne ». La frise les dessine en
// losanges sur la ligne du projet.

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Flag, Check, Trash2, Plus } from 'lucide-react';
import { getDateLocale } from '@/i18n/format';
import { DatePicker } from '@/components/ui/date-picker';
import {
  useCreateProjectMilestone, useUpdateProjectMilestone, useDeleteProjectMilestone,
  type TeamProjectMilestone,
} from '@/modules/team-projects';
import { todayLocal } from './portfolio.helpers';
import { useT } from '@/i18n/useT';

interface ProjectMilestonesSectionProps {
  orgId: string;
  projectId: string;
  milestones: TeamProjectMilestone[];
  /** `project.edit` ou responsable : sinon la section est en lecture seule. */
  canEdit: boolean;
}

const ProjectMilestonesSection = ({ orgId, projectId, milestones, canEdit }: ProjectMilestonesSectionProps) => {
  const { t } = useT('org');
  const create = useCreateProjectMilestone(orgId);
  const update = useUpdateProjectMilestone(orgId);
  const remove = useDeleteProjectMilestone(orgId);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const today = todayLocal();

  const add = () => {
    const n = name.trim();
    if (!n || !date) return;
    create.mutate({ projectId, name: n, dueDate: date }, { onSuccess: () => { setName(''); setDate(''); } });
  };

  const sorted = [...milestones].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <section aria-labelledby={`milestones-${projectId}`} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 id={`milestones-${projectId}`} className="flex items-center gap-1.5 text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
        <Flag size={14} aria-hidden="true" /> {t('portfolio.milestones.title')}
      </h3>

      {sorted.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">{t('portfolio.milestones.empty')}</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {sorted.map((m) => {
            const reached = !!m.completedAt;
            const missed = !reached && m.dueDate < today;
            return (
              <li key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))]/60">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => update.mutate({ milestoneId: m.id, input: { completed: !reached } })}
                  aria-pressed={reached}
                  aria-label={reached ? t('portfolio.milestones.markUndone', { name: m.name }) : t('portfolio.milestones.markDone', { name: m.name })}
                  className={`w-5 h-5 rotate-45 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-colors disabled:cursor-default ${
                    reached ? 'bg-emerald-500 border-emerald-500 text-white' : missed ? 'border-red-500' : 'border-[rgb(var(--color-text-muted))]'
                  }`}
                >
                  {reached && <Check size={11} className="-rotate-45" aria-hidden="true" />}
                </button>
                <span className={`flex-1 min-w-0 truncate text-sm ${reached ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
                  {m.name}
                </span>
                {missed && <span className="text-caption font-bold text-red-500">{t('portfolio.milestones.overdue')}</span>}
                {reached && <span className="text-caption font-semibold text-emerald-600 dark:text-emerald-400">{t('portfolio.milestones.reached')}</span>}
                <time dateTime={m.dueDate} className="text-xs tabular-nums text-[rgb(var(--color-text-muted))] shrink-0">
                  {format(parseISO(m.dueDate), 'd MMM yyyy', { locale: getDateLocale() })}
                </time>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(m.id)}
                    aria-label={t('portfolio.milestones.remove', { name: m.name })}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 shrink-0"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); add(); }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder={t('portfolio.milestones.namePlaceholder')}
            aria-label={t('portfolio.milestones.nameAria')}
            className="flex-1 min-w-[160px] h-10 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:border-[rgb(var(--color-accent-solid))]"
          />
          <div className="w-40">
            <DatePicker value={date} onChange={setDate} className="h-10" id={`milestone-date-${projectId}`} placeholder={t('portfolio.milestones.dateAria')} />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || !date || create.isPending}
            className="h-10 px-3 rounded-lg inline-flex items-center gap-1 text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40"
          >
            <Plus size={14} aria-hidden="true" /> {t('portfolio.milestones.add')}
          </button>
        </form>
      )}
    </section>
  );
};

export default ProjectMilestonesSection;
