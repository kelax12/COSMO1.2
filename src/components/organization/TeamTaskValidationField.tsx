import { useId } from 'react';
import { isMemberActive, type OrgMember } from '@/modules/organizations';
import type { TeamTask } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

interface Props {
  members: OrgMember[];
  /** Tâche existante, absente à la création. */
  task?: TeamTask | null;
  /** Moi : validateur proposé quand on coche la case. */
  me?: string;
  /** null = aucune validation (défaut) : cochée, la tâche est terminée. */
  value: string | null;
  onChange: (validatorId: string | null) => void;
}

/**
 * « Nécessite une validation » : décochée par défaut. Cochée, un menu choisit
 * qui validera ; terminée par quelqu'un d'autre, la tâche lui revient « à
 * valider » au lieu d'être close.
 */
const TeamTaskValidationField = ({ members: all, task, me, value, onChange }: Props) => {
  const { t } = useT('org');
  // Le serveur refuse un validateur hors des membres actifs (mig. 233).
  const members = all.filter((m) => isMemberActive(m));
  // Sur une tâche existante, seuls le créateur, le validateur et un admin le changent.
  const disabled = !!task && !!me && me !== task.createdBy && me !== task.validatorId
    && all.find((m) => m.userId === me)?.role !== 'admin';
  const checkId = useId();
  const selectId = useId();
  const enabled = value !== null;

  return (
    <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'rgb(var(--color-border))' }}>
      <label htmlFor={checkId} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'rgb(var(--color-text-primary))' }}>
        <input
          id={checkId}
          type="checkbox"
          className="h-4 w-4 accent-[rgb(var(--color-accent-solid))]"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? (me ?? members[0]?.userId ?? null) : null)}
        />
        {t('taskModal.validation.required')}
      </label>
      {enabled && (
        <div className="mt-3">
          <label htmlFor={selectId} className="block text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {t('taskModal.validation.validator')}
          </label>
          <select
            id={selectId}
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full min-h-11 rounded-lg border px-3 text-sm bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] border-[rgb(var(--color-border))]"
          >
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.displayName}</option>
            ))}
          </select>
          <p className="mt-1 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
            {t('taskModal.validation.hint')}
          </p>
        </div>
      )}
    </div>
  );
};

export default TeamTaskValidationField;
