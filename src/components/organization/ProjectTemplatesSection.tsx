// Modèles de projet de l'entreprise (mig. 153, M2) : repliés sous la liste,
// jamais mêlés aux projets en cours. Un modèle n'a pas de vraies tâches, son
// contenu vit dans `templatePayload`.

import { useState } from 'react';
import { ChevronDown, ChevronRight, LayoutTemplate } from 'lucide-react';
import type { TeamProject } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

interface ProjectTemplatesSectionProps {
  templates: TeamProject[];
  /** `project.create` : partir d'un modèle crée un projet. */
  canUse: boolean;
  /** `project.delete` : retirer un modèle, c'est l'archiver. */
  canRemove: boolean;
  onUse: (templateId: string) => void;
  onRemove: (template: TeamProject) => void;
}

const ProjectTemplatesSection = ({ templates, canUse, canRemove, onUse, onRemove }: ProjectTemplatesSectionProps) => {
  const { t, tp } = useT('org');
  const [open, setOpen] = useState(false);
  if (templates.length === 0) return null;

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-1 py-1 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
      >
        {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        {t('portfolio.templates.section', { count: templates.length })}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {templates.map((tpl) => (
            <li key={tpl.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
              <LayoutTemplate size={14} className="shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{tpl.name}</span>
              <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                {tp('portfolio.templates.taskCount', tpl.templatePayload?.tasks.length ?? 0)}
              </span>
              {canUse && (
                <button type="button" onClick={() => onUse(tpl.id)} className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 shrink-0">
                  {t('portfolio.templates.use')}
                </button>
              )}
              {canRemove && (
                <button type="button" onClick={() => onRemove(tpl)} className="text-xs text-[rgb(var(--color-text-muted))] hover:text-red-500 shrink-0">
                  {t('portfolio.templates.archive')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProjectTemplatesSection;
