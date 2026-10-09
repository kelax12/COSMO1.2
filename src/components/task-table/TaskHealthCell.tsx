import { HEALTH_DOT } from '@/components/organization/health-state.helpers';
import type { TeamProjectHealth } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

// Cellule « État » du tableau desktop : pastille + libellé, tiret si aucun
// état n'a été déclaré. Partagée par les lignes perso et d'équipe.
const TaskHealthCell = ({ health }: { health: TeamProjectHealth | null | undefined }) => {
  const { t } = useT('tasks');
  if (!health) {
    return <span className="text-sm" style={{ color: 'rgb(var(--color-text-muted))' }} title={t('board.health.unset')}>—</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${HEALTH_DOT[health]}`} aria-hidden="true" />
      <span className="truncate">{t(`board.health.${health}`)}</span>
    </span>
  );
};

export default TaskHealthCell;
