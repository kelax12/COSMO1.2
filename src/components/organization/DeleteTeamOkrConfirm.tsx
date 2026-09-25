import { useKRProjects } from '@/modules/team-okrs/execution.hooks';
import type { TeamOKR } from '@/modules/team-okrs';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useT } from '@/i18n/useT';

interface DeleteTeamOkrConfirmProps {
  orgId: string;
  okr: TeamOKR;
  /** Tous les OKR visibles : sert à compter ceux qui CONTRIBUENT à celui-ci. */
  okrs: TeamOKR[];
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Suppression d'un OKR d'équipe (audit du 2026-09-24, étape 3).
 *
 * Remplace un `window.confirm` qui ne disait rien de l'impact : les résultats
 * clés et leurs points d'étape partent avec l'objectif, les liens vers des
 * projets aussi, et les objectifs qui y contribuaient perdent leur parent.
 * Un OKR supprimé ne revient pas : pas de corbeille pour lui, donc la saisie
 * du titre est exigée comme pour la suppression d'entreprise.
 */
const DeleteTeamOkrConfirm = ({ orgId, okr, okrs, pending, onConfirm, onCancel }: DeleteTeamOkrConfirmProps) => {
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const { data: links = [] } = useKRProjects(orgId);
  const krIds = new Set(okr.keyResults.map((kr) => kr.id));
  const linkedProjects = new Set(links.filter((l) => krIds.has(l.krId)).map((l) => l.projectId)).size;
  const children = okrs.filter((o) => o.parentOkrId === okr.id).length;

  const impact = [
    ...(okr.keyResults.length > 0 ? [tpa('okrDelete.impactKrs', okr.keyResults.length)] : []),
    ...(linkedProjects > 0 ? [tpa('okrDelete.impactProjects', linkedProjects)] : []),
    ...(children > 0 ? [tpa('okrDelete.impactChildren', children)] : []),
    ta('okrDelete.impactIrreversible'),
  ];

  return (
    <OrgConfirmDialog
      title={ta('okrDelete.title', { title: okr.title })}
      impact={impact}
      confirmLabel={ta('okrDelete.confirm')}
      pending={pending}
      requireText={okr.title}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

export default DeleteTeamOkrConfirm;
