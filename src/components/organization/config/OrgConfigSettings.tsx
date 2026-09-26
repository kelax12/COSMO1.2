import type { OrgMember } from '@/modules/organizations';
import { useTeamProjects } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import OrgGeneralSettingsCard from './OrgGeneralSettingsCard';
import OrgSecurityCard from './OrgSecurityCard';
import OrgIntegrationsCard from './OrgIntegrationsCard';
import CustomFieldsEditor from './CustomFieldsEditor';
import AutomationsEditor from './AutomationsEditor';
import { CARD, TITLE, HINT } from './config-ui';

interface Props {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
}

/**
 * Rubriques de configuration de Paramètres (audit du 2026-09-24) : réglages
 * propres à l'organisation, Sécurité (M13), champs personnalisés et
 * automatisations d'entreprise, intégrations. Mig. 195 à 199.
 */
const OrgConfigSettings = ({ orgId, members, currentUserId, isAdmin }: Props) => {
  const { t } = useT('orgConfig');
  const { data: projects = [] } = useTeamProjects(orgId);
  const active = projects.filter((p) => !p.archivedAt);
  return (
    <>
      <OrgGeneralSettingsCard orgId={orgId} isAdmin={isAdmin} />
      {isAdmin && <OrgSecurityCard orgId={orgId} />}
      {isAdmin && (
        <section className={CARD} aria-labelledby="org-fields-title">
          <h2 id="org-fields-title" className={TITLE}>{t('fields.title')}</h2>
          <p className={`${HINT} mb-3`}>{t('fields.hint')}</p>
          <CustomFieldsEditor orgId={orgId} projectId={null} canEdit />
        </section>
      )}
      {isAdmin && (
        <section className={CARD} aria-labelledby="org-automations-title">
          <h2 id="org-automations-title" className={TITLE}>{t('automations.title')}</h2>
          <p className={`${HINT} mb-3`}>{t('automations.hint')}</p>
          <AutomationsEditor orgId={orgId} members={members} projects={active} canEdit />
        </section>
      )}
      <OrgIntegrationsCard orgId={orgId} members={members} currentUserId={currentUserId} isAdmin={isAdmin} />
    </>
  );
};

export default OrgConfigSettings;
