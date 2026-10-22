// Surcouches de /entreprise chargées à la demande, en UNE entrée paresseuse :
// chaque `import()` de la page ajoute son nom de fichier et ses dépendances à la
// table de préchargement du chunk `OrganizationPage`, qui a un cliquet.
//
//   · le glossaire (bouton d'en-tête) ;
//   · les liens profonds (`?task=`, `?member=`, `?project=`, `?okr=`, `?team=`).
import type { OrgMember } from '@/modules/organizations';
import OrgDeepLinkHost from './OrgDeepLinkHost';
import OrgGlossarySheet from './OrgGlossarySheet';

interface OrgPageOverlaysProps {
  glossaryOpen: boolean;
  onCloseGlossary: () => void;
  /** Présent seulement quand l'URL adresse un objet. */
  deepLink: {
    orgId: string;
    section: string;
    members: OrgMember[];
    currentUserId?: string;
    isAdmin: boolean;
    isManager: boolean;
  } | null;
}

const OrgPageOverlays = ({ glossaryOpen, onCloseGlossary, deepLink }: OrgPageOverlaysProps) => (
  <>
    {glossaryOpen && <OrgGlossarySheet onClose={onCloseGlossary} />}
    {deepLink && <OrgDeepLinkHost {...deepLink} />}
  </>
);

export default OrgPageOverlays;
