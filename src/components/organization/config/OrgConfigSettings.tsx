import type { OrgMember } from '@/modules/organizations';
import { useTeamProjects } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import OrgGeneralSettingsCard from './OrgGeneralSettingsCard';
import OrgSecurityCard from './OrgSecurityCard';
import OrgIntegrationsCard from './OrgIntegrationsCard';
import AutomationsEditor from './AutomationsEditor';
import { CARD, TITLE, HINT } from './config-ui';

interface Props {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  /** Rubrique affichée : la page Paramètres n'en montre qu'une à la fois. */
  part: OrgConfigPart;
}

export type OrgConfigPart = 'general' | 'security' | 'automations' | 'integrations';

/**
 * Rubriques de configuration de Paramètres (audit du 2026-09-24) : réglages
 * propres à l'organisation, Sécurité (M13), automatisations
 * d'entreprise, intégrations. Mig. 195 à 199.
 */
const OrgConfigSettings = ({ orgId, members, currentUserId, isAdmin, part }: Props) => {
  if (part === 'general') return <OrgGeneralSettingsCard orgId={orgId} isAdmin={isAdmin} />;
  if (part === 'security') return isAdmin ? <OrgSecurityCard orgId={orgId} /> : null;
  if (part === 'integrations') {
    return <OrgIntegrationsCard orgId={orgId} members={members} currentUserId={currentUserId} isAdmin={isAdmin} />;
  }
  if (!isAdmin) return null;
  return <OrgAutomationsPart orgId={orgId} members={members} />;
};

// Les projets ne se chargent que pour la rubrique qui en a besoin.
const OrgAutomationsPart = ({ orgId, members }: { orgId: string; members: OrgMember[] }) => {
  const { t } = useT('orgConfig');
  const { data: projects = [] } = useTeamProjects(orgId);
  const active = projects.filter((p) => !p.archivedAt);
  return (
    <section className={CARD} aria-labelledby="org-automations-title">
      <h2 id="org-automations-title" className={TITLE}>{t('automations.title')}</h2>
      <p className={`${HINT} mb-3`}>{t('automations.hint')}</p>
      <AutomationsEditor orgId={orgId} members={members} projects={active} canEdit />
    </section>
  );
};

export default OrgConfigSettings;
