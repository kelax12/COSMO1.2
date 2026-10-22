// Priorité choisie SUR PLACE dans la fiche mobile (maquette 157, 2026-10-10).
//
// La ligne ouvrait une sous-feuille pour un chiffre de 1 à 5. Cinq cases de
// 44 px tiennent dans la ligne. La priorité reste facultative : retoucher le
// cran choisi l'efface. Seuls P1 et P2 se teintent (maquette 145).
import React from 'react';
import { useT } from '@/i18n/useT';

const LEVELS = [1, 2, 3, 4, 5] as const;

interface Props {
  value: number;
  invalid: boolean;
  onChange: (level: number) => void;
}

const TaskPrioritySegmented: React.FC<Props> = ({ value, invalid, onChange }) => {
  const { t } = useT('taskModal');
  return (
    <div className="flex items-center justify-between gap-3 px-4 min-h-11">
      <span className={`text-body ${invalid ? 'text-red-500' : 'text-[rgb(var(--color-text-primary))]'}`}>
        {t('fields.priority')}
      </span>
      <div role="radiogroup" aria-label={t('fields.priority')} className="flex gap-0.5 rounded-lg bg-[rgb(var(--color-background))] p-0.5">
        {LEVELS.map((level) => {
          const active = value === level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t(`fields.priority${level}`)}
              onClick={() => onChange(active ? 0 : level)}
              className={`w-11 h-11 rounded-md text-label font-semibold transition-colors ${
                active
                  ? level <= 2 ? `task-priority-${level}` : 'bg-[rgb(var(--color-active))] text-[rgb(var(--color-text-primary))]'
                  : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              {level}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TaskPrioritySegmented;
