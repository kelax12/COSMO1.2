import { Check } from 'lucide-react';
import { useT } from '@/i18n/useT';

/**
 * Case de sélection d'une tâche en mode « actions groupées ». Carrée, là où la
 * case de complétion est ronde : les deux gestes ne doivent jamais se confondre.
 */
const TaskSelectCheckbox = ({ name, checked, onToggle }: { name: string; checked: boolean; onToggle: () => void }) => {
  const { t } = useT('org');
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={t('projects.selectTask', { name })}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
        checked
          ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
          : 'border-[rgb(var(--color-border-strong))] hover:border-[rgb(var(--color-accent))]'
      }`}
    >
      {checked && <Check size={12} strokeWidth={3} aria-hidden="true" />}
    </button>
  );
};

export default TaskSelectCheckbox;
