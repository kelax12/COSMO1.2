import React from 'react';
import { useT } from '@/i18n/useT';
import TrackAnchors from '@/pages/landing/TrackAnchors';
import EnterpriseHero from './EnterpriseHero';
import ProblemSection from './ProblemSection';
import PyramidSection from './PyramidSection';
import ProjectsSection from './ProjectsSection';
import ExecutionSection from './ExecutionSection';
import OkrSection from './OkrSection';
import ProgressSection from './ProgressSection';
import SecuritySection from './SecuritySection';
import PricingSection from './PricingSection';
import EnterpriseFaqSection from './EnterpriseFaqSection';
import EnterpriseCta from './EnterpriseCta';

interface EnterpriseTrackProps {
  onDemo: () => void;
  /** Ouvre la démo puis la fiche du membre réel, sur l'onglet demandé — cf. `PyramidSection`. */
  onMemberDemo: (demoUserId: string, tab: 'tasks' | 'agenda' | 'contribution') => void;
  onRegister: () => void;
}

/**
 * Le parcours entreprise, de bout en bout.
 *
 * La page EST l'onboarding. Après le constat, elle suit les cinq étapes de
 * mise en place réelles, dans l'ordre où on les fait : inviter et structurer
 * (1), créer des projets et les attribuer (2), suivre leur exécution — statuts,
 * dépendances, chemin critique (3), poser les OKR (4), suivre la progression
 * (5). Le visiteur qui l'a lue sait déjà quoi faire en arrivant dans le
 * produit, et retrouve les mêmes écrans.
 *
 * Vient ensuite ce qu'un décideur demande une fois convaincu : la sécurité,
 * puis le prix. Les tarifs arrivent en avant-dernier, une fois seulement que
 * la valeur a été montrée.
 *
 * La direction artistique — graphite `#08090C`, cyan, or réservé à l'argent —
 * est portée ici, à la racine du track : les sections héritent du fond et ne
 * repeignent que leurs propres surfaces.
 */
const EnterpriseTrack: React.FC<EnterpriseTrackProps> = ({ onDemo, onMemberDemo, onRegister }) => {
  const { t } = useT('landing');

  return (
    <div className="bg-[#08090C] text-white">
      {/* Sommaire du parcours : accès direct aux tarifs pour le visiteur pressé. */}
      <TrackAnchors track="entreprise" label={t('enterprise.gateway.entreprise.title')} />

      <EnterpriseHero onDemo={onDemo} />

      <ProblemSection />

      {/* Les cinq étapes de mise en place, dans l'ordre où on les fait. */}
      <PyramidSection onMemberDemo={onMemberDemo} />
      <ProjectsSection />
      <ExecutionSection />
      <OkrSection />
      <ProgressSection />
      <SecuritySection />
      <PricingSection onRegister={onRegister} />
      <EnterpriseFaqSection />
      <EnterpriseCta onDemo={onDemo} onRegister={onRegister} />
    </div>
  );
};

export default EnterpriseTrack;
