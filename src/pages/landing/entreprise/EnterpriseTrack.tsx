import React from 'react';
import EnterpriseHero from './EnterpriseHero';
import ProblemSection from './ProblemSection';
import PyramidSection from './PyramidSection';
import ProjectsSection from './ProjectsSection';
import ExecutionSection from './ExecutionSection';
import OkrSection from './OkrSection';
import ProgressSection from './ProgressSection';
import MoreFeaturesSection from './MoreFeaturesSection';
import SecuritySection from './SecuritySection';
import PricingSection from './PricingSection';
import EnterpriseFaqSection from './EnterpriseFaqSection';
import EnterpriseCta from './EnterpriseCta';

interface EnterpriseTrackProps {
  onDemo: () => void;
  onRegister: () => void;
  /** Rangée des CTA du hero, cf. `PersoTrack`. */
  onHeroCtaRef?: (el: HTMLElement | null) => void;
}

/**
 * Le parcours entreprise, de bout en bout.
 *
 * La page EST l'onboarding. Après le constat, elle suit les cinq étapes de
 * mise en place réelles, dans l'ordre où on les fait : inviter et structurer
 * (1), suivre l'exécution des tâches : statuts, dépendances (2), regrouper le
 * travail en projets et les attribuer (3), poser les OKR (4), suivre la
 * progression (5). Tâches avant Projets depuis le 2026-10-02 : la tâche est
 * l'unité que chacun manipule tous les jours, le projet vient la ranger. Le visiteur qui l'a lue sait déjà quoi faire en arrivant dans le
 * produit, et retrouve les mêmes écrans.
 *
 * Vingt fonctionnalités du quotidien suivent, hors numérotation des étapes
 * (`MoreFeaturesSection`). Vient ensuite ce qu'un décideur demande une fois
 * convaincu : la sécurité, puis le prix. Les tarifs arrivent en avant-dernier, une fois seulement que
 * la valeur a été montrée.
 *
 * La direction artistique — graphite `#08090C`, cyan, or réservé à l'argent —
 * est portée ici, à la racine du track : les sections héritent du fond et ne
 * repeignent que leurs propres surfaces.
 */
const EnterpriseTrack: React.FC<EnterpriseTrackProps> = ({ onDemo, onRegister, onHeroCtaRef }) => {
  return (
    <div className="bg-[#08090C] text-white">
      {/* Le sommaire du parcours vit dans le header de `LandingPage`. */}
      <EnterpriseHero onDemo={onDemo} onCtaRef={onHeroCtaRef} />

      <ProblemSection />

      {/* Les cinq étapes de mise en place, dans l'ordre où on les fait. */}
      <PyramidSection />
      <ExecutionSection />
      <ProjectsSection />
      <OkrSection />
      <ProgressSection />
      <MoreFeaturesSection />
      <SecuritySection />
      <PricingSection onRegister={onRegister} />
      <EnterpriseFaqSection />
      <EnterpriseCta onDemo={onDemo} onRegister={onRegister} />
    </div>
  );
};

export default EnterpriseTrack;
