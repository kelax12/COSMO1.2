import { useState } from 'react';
import { Check, FolderKanban, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import type { TeamOKR } from '@/modules/team-okrs';
import type { TeamProject } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { parentCandidates } from './okr-links.helpers';
import MenuSelect from '@/components/organization/MenuSelect';

// ═══════════════════════════════════════════════════════════════════
// Rattachements d'un OKR d'équipe (mig. 160, M3) : objectif parent,
// projets reliés à un KR. La base les portait depuis la mig. 160, aucun
// écran ne les montrait (audit des popups, 2026-09-25).
// ═══════════════════════════════════════════════════════════════════

const selectClass =
  'w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm text-[rgb(var(--color-text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]';

interface ParentFieldProps {
  okrs: TeamOKR[];
  selfId?: string;
  value: string | null;
  onChange: (id: string | null) => void;
}

export const OkrParentField = ({ okrs, selfId, value, onChange }: ParentFieldProps) => {
  const { t } = useT('org');
  const options = parentCandidates(okrs, selfId);
  return (
    <div className="grid gap-2">
      <Label htmlFor="tokr-parent">{t('popups.okr.parent')}</Label>
      <MenuSelect id="tokr-parent" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={selectClass}>
        <option value="">{t('popups.okr.noParent')}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.title}</option>
        ))}
      </MenuSelect>
      <p className="text-muted-foreground text-xs">{t('popups.okr.parentHint')}</p>
    </div>
  );
};

interface KRProjectsFieldProps {
  projects: TeamProject[];
  value: string[];
  onChange: (next: string[]) => void;
  /** `tasks` : le KR avance avec les tâches terminées de ces projets. */
  byTasks: boolean;
  onByTasksChange: (v: boolean) => void;
}

export const KRProjectsField = ({ projects, value, onChange, byTasks, onByTasksChange }: KRProjectsFieldProps) => {
  const { t } = useT('org');
  const [open, setOpen] = useState(value.length > 0);
  const linked = projects.filter((p) => value.includes(p.id));
  if (projects.length === 0) return null;

  return (
    <div className="grid gap-1.5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-accent))] w-fit min-h-8">
        <FolderKanban size={13} aria-hidden="true" />
        {linked.length > 0 ? t('popups.okr.projectsLinked', { count: linked.length }) : t('popups.okr.linkProjects')}
      </button>
      {open && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {projects.map((p) => {
              const on = value.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? value.filter((id) => id !== p.id) : [...value, p.id])}
                  className={`inline-flex items-center gap-1 min-h-8 px-2.5 rounded-full text-xs font-medium border transition-colors ${
                    on ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]' : 'border-border text-muted-foreground hover:border-[rgb(var(--color-accent))]'
                  }`}
                >
                  {on ? <Check size={11} aria-hidden="true" /> : <X size={11} className="rotate-45" aria-hidden="true" />}
                  {p.name}
                </button>
              );
            })}
          </div>
          {value.length > 0 && (
            <label className="flex items-start gap-2 text-xs text-[rgb(var(--color-text-secondary))] cursor-pointer">
              <input type="checkbox" checked={byTasks} onChange={(e) => onByTasksChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[rgb(var(--color-accent-solid))]" />
              <span>{t('popups.okr.progressByTasks')}</span>
            </label>
          )}
        </>
      )}
    </div>
  );
};
