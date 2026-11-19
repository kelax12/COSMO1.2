// Case « Créer automatiquement une tâche les jours concernés » de `HabitModal`
// (mig. 265). L'état vit dans `useHabitAutoTask` (module habits).
export const HabitAutoTaskCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className: string;
}> = ({ checked, onChange, label, className }) => (
  <label className={`flex items-center cursor-pointer text-[rgb(var(--color-text-primary))] ${className}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded accent-[rgb(var(--color-accent-solid))] cursor-pointer"
    />
    <span>{label}</span>
  </label>
);
