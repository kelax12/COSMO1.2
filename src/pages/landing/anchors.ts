import type { KeyOf } from '@/i18n/catalog';
import type { LandingTrack } from './use-landing-track';

/** Une entrée du sommaire d'un parcours. */
export interface TrackAnchor {
  href: string;
  labelKey: KeyOf<'landing'>;
}

/**
 * Sommaire de chaque parcours.
 *
 * Le sélecteur de parcours occupe désormais le centre du header, où vivaient
 * les ancres de la landing. Elles ne sont pas perdues pour autant : chaque
 * parcours affiche les siennes dans une barre collée sous le header. C'est
 * aussi ce qui permet aux deux tracks d'avoir des sommaires différents sans
 * qu'un lien pointe jamais vers une section absente du parcours affiché.
 */
export const TRACK_ANCHORS: Record<LandingTrack, TrackAnchor[]> = {
  perso: [
    { href: '#features', labelKey: 'nav.features' },
    { href: '#solutions', labelKey: 'nav.solutions' },
    { href: '#faq', labelKey: 'nav.faq' },
    { href: '/guide', labelKey: 'nav.guide' },
  ],
  // Les quatre premières ancres SONT les quatre étapes de mise en place, dans
  // l'ordre : le sommaire doit se lire comme la marche à suivre.
  entreprise: [
    { href: '#equipes', labelKey: 'enterprise.nav.teams' },
    { href: '#projets', labelKey: 'enterprise.nav.projects' },
    { href: '#okr', labelKey: 'enterprise.nav.okr' },
    { href: '#statistiques', labelKey: 'enterprise.nav.progress' },
    { href: '#securite', labelKey: 'enterprise.nav.security' },
    { href: '#tarifs', labelKey: 'enterprise.nav.pricing' },
  ],
};
