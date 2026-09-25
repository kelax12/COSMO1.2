import type { PositionChange } from './pyramid.helpers';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useT } from '@/i18n/useT';

export type PyramidPending =
  | { kind: 'undo'; count: number }
  | { kind: 'position'; dropId: string; change: PositionChange; memberName: string };

interface PyramidPendingConfirmProps {
  pending: PyramidPending | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Les deux confirmations de la pyramide (audit du 2026-09-24).
 *
 * - Annuler une réorganisation : remplace un `window.confirm`.
 * - Un déplacement qui change une POSITION : « manager » est dérivé de la
 *   pyramide, et le passage manager → membre se faisait en silence. La
 *   personne concernée est aussi prévenue par notification (mig. 164).
 */
const PyramidPendingConfirm = ({ pending, onConfirm, onCancel }: PyramidPendingConfirmProps) => {
  const { t, tp } = useT('org');
  if (!pending) return null;

  if (pending.kind === 'undo') {
    return (
      <OrgConfirmDialog
        title={t('pyramid.undoTitle')}
        description={tp('pyramid.undoConfirm', pending.count)}
        confirmLabel={t('pyramid.undoAction')}
        tone="accent"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }

  const { losesManagerRole, becomesManager } = pending.change;
  const impact = [
    ...(losesManagerRole ? [t('pyramid.positionLoses', { name: losesManagerRole.displayName })] : []),
    ...(becomesManager ? [t('pyramid.positionGains', { name: becomesManager.displayName })] : []),
  ];
  return (
    <OrgConfirmDialog
      title={t('pyramid.positionTitle', { name: pending.memberName })}
      description={t('pyramid.positionBody')}
      impact={impact}
      confirmLabel={t('pyramid.positionConfirm')}
      tone="accent"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

export default PyramidPendingConfirm;
