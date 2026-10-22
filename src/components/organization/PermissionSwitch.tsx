/**
 * Interrupteur de permission, partagé par la fiche individuelle
 * (`MemberPermissionsSheet`) et l'éditeur de rôle (`RoleEditorSheet`, mig. 219).
 * Aucune position ne dépend d'une animation de transform : sous mouvement
 * réduit, la pastille est déjà à sa place (`left`, pas `translate`).
 */
const PermissionSwitch = ({
  checked, disabled = false, label, onToggle,
}: { checked: boolean; disabled?: boolean; label: string; onToggle: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onToggle}
    className={`relative shrink-0 w-[44px] h-[26px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed ${
      checked ? 'bg-[rgb(var(--color-accent-solid))]' : 'bg-gray-200 dark:bg-gray-700'
    }`}
  >
    <span
      className="absolute top-[2px] w-[22px] h-[22px] rounded-full bg-white shadow-md transition-all duration-200"
      style={{ left: checked ? 'calc(100% - 24px)' : '2px' }}
    />
  </button>
);

export default PermissionSwitch;
