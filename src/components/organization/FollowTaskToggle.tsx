import { Bell, BellOff } from 'lucide-react';
import { useMyFollows, useToggleFollow } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { TAP_AREA_44_Y } from '@/components/mobile/tap-area';

/**
 * « Suivre cette tâche » (M14, mig. 162). Les abonnés reçoivent
 * `status_changed` ; l'assigné et le créateur sont prévenus sans s'abonner.
 */
const FollowTaskToggle = ({ orgId, taskId }: { orgId: string; taskId: string }) => {
  const { t } = useT('org');
  const { data: follows } = useMyFollows(orgId);
  const toggle = useToggleFollow(orgId);
  const followed = follows?.taskIds.includes(taskId) ?? false;
  return (
    <button
      type="button"
      aria-pressed={followed}
      onClick={() => toggle.mutate({ target: 'task', id: taskId, follow: !followed })}
      // `TAP_AREA_44_Y` (C-57, 2026-10-01) : mesure 149 x 36 px en CI. Assez
      // large, trop bas de 8 px, et seul sur sa rangee (`space-y-4` au-dessus,
      // fin de section dessous) : le debord vertical ne couvre aucun voisin.
      className={`${TAP_AREA_44_Y} inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg text-xs font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors`}
    >
      {followed ? <BellOff size={13} aria-hidden="true" /> : <Bell size={13} aria-hidden="true" />}
      {t(followed ? 'follow.unfollowTask' : 'follow.followTask')}
    </button>
  );
};

export default FollowTaskToggle;
