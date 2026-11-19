// Case « Créer automatiquement une tâche les jours concernés » de `HabitModal`
// (mig. 265) : état, relecture à l'ouverture, enregistrement après la sauvegarde.
// Le réglage vit dans sa propre table, hors du formulaire d'habitude.
import { useEffect, useState } from 'react';
import { useHabitAutoTasks, useSetHabitAutoTask, type Habit } from '@/modules/habits';
import { useT } from '@/i18n/useT';

export function useHabitAutoTask(isOpen: boolean, habit: Habit | undefined) {
  const { data: autoTasks = [] } = useHabitAutoTasks();
  const setMutation = useSetHabitAutoTask();
  const setting = habit ? autoTasks.find((a) => a.habitId === habit.id) : undefined;
  const [checked, setChecked] = useState(false);

  // Relu à l'ouverture seulement : un rafraîchissement de la liste ne doit pas
  // défaire une case cochée pendant la saisie.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `setting` omis : relu à l'ouverture (isOpen, habit.id), le suivre écraserait la saisie en cours
  useEffect(() => { if (isOpen) setChecked(!!setting); }, [isOpen, habit?.id]);

  /** À appeler après la sauvegarde de l'habitude, avec son identifiant. */
  const save = (habitId: string, selectedCategory: string | undefined) => {
    const category = selectedCategory ?? null;
    if (!checked && !setting) return;
    if (checked && setting?.category === category) return;
    setMutation.mutate({ habitId, enabled: checked, category });
  };

  const withDirty = (formDirty: boolean) => formDirty || checked !== !!setting;
  return { checked, setChecked, withDirty, savedCategory: setting?.category ?? null, save };
}

export const HabitAutoTaskCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  className: string;
}> = ({ checked, onChange, className }) => {
  const { t } = useT('habits');
  return (
    <label className={`flex items-center cursor-pointer text-[rgb(var(--color-text-primary))] ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-[rgb(var(--color-accent-solid))] cursor-pointer"
      />
      <span>{t('modal.autoTask')}</span>
    </label>
  );
};
