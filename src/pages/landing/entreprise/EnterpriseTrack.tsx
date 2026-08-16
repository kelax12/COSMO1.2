import React from 'react';
import { useT } from '@/i18n/useT';
import TrackAnchors from '../TrackAnchors';
import EnterpriseHero from './EnterpriseHero';
import ProblemSection from './ProblemSection';
import PyramidSection from './PyramidSection';
import CockpitSection from './CockpitSection';
import OkrSection from './OkrSection';
import SecuritySection from './SecuritySection';
import PricingSection from './PricingSection';
import EnterpriseFaqSection from './EnterpriseFaqSection';
import EnterpriseCta from './EnterpriseCta';

interface EnterpriseTrackProps {
  onDemo: () => void;
  onRegister: () => void;
}

/**
 * Le parcours entreprise, de bout en bout.
 *
 * Ordre de lecture assumé : on constate (le problème), on comprend (la
 * pyramide), on voit (le cockpit, les OKR), on se rassure (la sécurité), puis
 * on regarde le prix. Les tarifs arrivent en avant-dernier, une fois seulement
 * que la valeur a été montrée.
 *
 * La direction artistique — graphite `#08090C`, cyan, or réservé à l'argent —
 * est portée ici, à la racine du track : les sections héritent du fond et ne
 * repeignent que leurs propres surfaces.
 */
const EnterpriseTrack: React.FC<EnterpriseTrackProps> = ({ onDemo, onRegister }) => {
  const { t } = useT('landing');

  return (
    <div className="bg-[#08090C] text-white">
      {/* Sommaire du parcours : accès direct aux tarifs pour le visiteur pressé. */}
      <TrackAnchors track="entreprise" label={t('enterprise.gateway.entreprise.title')} />

      <EnterpriseHero onDemo={onDemo} />

      <ProblemSection />
      <PyramidSection />
      <CockpitSection />
      <OkrSection />
      <SecuritySection />
      <PricingSection onRegister={onRegister} />
      <EnterpriseFaqSection />
      <EnterpriseCta onDemo={onDemo} onRegister={onRegister} />
    </div>
  );
};

export default EnterpriseTrack;
