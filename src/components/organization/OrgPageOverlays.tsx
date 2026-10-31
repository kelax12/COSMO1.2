// Surcouches de /entreprise chargées à la demande, en UNE entrée paresseuse :
// chaque `import()` de la page ajoute son nom de fichier et ses dépendances à la
// table de préchargement du chunk `OrganizationPage`, qui a un cliquet.
//
//   · les liens profonds (`?task=`, `?member=`, `?project=`, `?okr=`, `?team=`).
import type { OrgMember } from '@/modules/organizations';
import OrgDeepLinkHost from './OrgDeepLinkHost';

interface OrgPageOverlaysProps {
  /** Présent seulement quand l'URL adresse un objet. */
  deepLink: {
    orgId: string;
    section: string;
    members: OrgMember[];
    currentUserId?: string;
    isAdmin: boolean;
    canEditDependencies: boolean;
  } | null;
}

const OrgPageOverlays = ({ deepLink }: OrgPageOverlaysProps) => (
  <>
    {deepLink && <OrgDeepLinkHost {...deepLink} />}
  </>
);

export default OrgPageOverlays;
