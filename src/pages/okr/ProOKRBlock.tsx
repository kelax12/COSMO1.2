import React from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useActiveOrganization } from '@/modules/organizations/ActiveOrgContext';
import { useTeamOKRsAcrossOrgs } from '@/modules/team-okrs';
import { useT } from '@/i18n/useT';
import ProOKRSection from './ProOKRSection';
import { myProOkrs } from './pro-okrs';

/**
 * Les OKR d'entreprise dont je porte un KR, au-dessus des OKR perso (05ddf746),
 * avec le titre qui sépare les deux listes quand les deux existent.
 *
 * Chargé à la demande par `OKRPage` (2026-10-02) : la section lit TOUTES mes
 * organisations et tire les aides du mode entreprise (progression, liens
 * profonds). Dans la page, elle la poussait à 617 lignes (budget 600,
 * `architecture.guard`) et son chunk au-dessus de son cliquet (`check:bundle`).
 */
const ProOKRBlock: React.FC<{ hasPersonal: boolean }> = ({ hasPersonal }) => {
  const { t } = useT('okr');
  const { user } = useAuth();
  // Toutes mes organisations, pas seulement l'active.
  const { organizations, setActiveOrgId } = useActiveOrganization();
  const teamOkrs = useTeamOKRsAcrossOrgs(organizations.map((o) => o.id));
  if (!user) return null;
  const proOkrs = myProOkrs(teamOkrs, user.id);
  const orgNames = Object.fromEntries(organizations.map((o) => [o.id, o.name]));

  return (
    <>
      <ProOKRSection okrs={proOkrs} orgNames={orgNames} userId={user.id} onSelectOrg={setActiveOrgId} />
      {proOkrs.length > 0 && hasPersonal && (
        <h2 className="text-lg font-bold mb-4 text-[rgb(var(--color-text-primary))]">{t('pro.personalSectionTitle')}</h2>
      )}
    </>
  );
};

export default ProOKRBlock;
