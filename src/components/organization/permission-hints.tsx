// ═══════════════════════════════════════════════════════════════════
// Droits : toujours `can[…]`, et un geste interdit se GRISE en disant pourquoi
//
// Cohérence globale (2026-09-25) : selon l'écran, un geste interdit était
// masqué (on ne savait pas qu'il existait), ou affiché puis refusé par le
// serveur (on ne savait pas pourquoi). Règle : le bouton reste là, grisé, et
// son explication nomme le droit qui manque et qui peut l'accorder.
//
// ❌ Ne jamais recalculer un droit ici : tout vient de `useMyOrgPermissions`.
// ═══════════════════════════════════════════════════════════════════

import { cloneElement, type ReactElement } from 'react';
import { useMyOrgPermissions, type OrgPermissionKey } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

interface TaskLike {
  createdBy?: string | null;
  assigneeIds: readonly string[];
}

/** Droits + la phrase qui explique un refus (`undefined` = autorisé). */
export const usePermissionHints = (orgId: string | undefined) => {
  const perms = useMyOrgPermissions(orgId);
  const { t } = useT('org');
  const rightName = (key: OrgPermissionKey) => t(`permissions.key.${key}` as 'permissions.key.task.create');
  return {
    ...perms,
    /** Raison d'un refus sur un droit réglable, ou `undefined`. */
    deniedReason: (key: OrgPermissionKey): string | undefined =>
      perms.can[key] ? undefined : t('permissions.denied', { right: rightName(key) }),
    /** Raison d'un refus de modifier CETTE tâche (miroir de `team_tasks_update`). */
    taskEditReason: (task: TaskLike): string | undefined =>
      perms.canEditTask(task) ? undefined : t('permissions.deniedTaskEdit', { right: rightName('task.editAny') }),
    /** Raison d'un refus de supprimer CETTE tâche (miroir de `delete_team_task`). */
    taskDeleteReason: (task: TaskLike): string | undefined =>
      perms.canDeleteTask(task) ? undefined : t('permissions.deniedTaskDelete', { right: rightName('task.deleteAny') }),
  };
};

/**
 * Enveloppe un bouton : autorisé, il passe tel quel ; interdit, il est grisé et
 * l'enveloppe porte l'explication (infobulle au survol, lue au clavier : un
 * bouton `disabled` ne reçoit ni le focus ni le survol dans tous les navigateurs).
 */
export const PermissionGate = ({ reason, children, className = '' }: { reason: string | undefined; children: ReactElement; className?: string }) => {
  if (!reason) return children;
  return (
    <span className={`inline-flex cursor-not-allowed ${className}`} title={reason} tabIndex={0} role="note" aria-label={reason}>
      {cloneElement(children as ReactElement<{ disabled?: boolean; 'aria-disabled'?: boolean; className?: string }>, {
        disabled: true,
        'aria-disabled': true,
        // Le survol doit atteindre l'enveloppe, qui porte l'infobulle.
        className: `${(children.props as { className?: string }).className ?? ''} pointer-events-none opacity-50`,
      })}
    </span>
  );
};
