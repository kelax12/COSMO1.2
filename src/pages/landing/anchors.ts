import type { KeyOf } from '@/i18n/catalog';
import type { LandingTrack } from './use-landing-track';
import { ENTERPRISE_PRICES_SHOWN } from './entreprise/free-offer';

/** Une entrée du sommaire d'un parcours. */
export interface TrackAnchor {
  href: string;
  labelKey: KeyOf<'landing'>;
  /** Sous-menu ouvert au survol (ex. « Fonctionnalités » en entreprise). */
  children?: TrackAnchor[];
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
  // « Fonctionnalités » regroupe les sections produit, dans l'ordre de mise
  // en place : le sous-menu se lit comme la marche à suivre.
  entreprise: [
    {
      href: '#equipes',
      labelKey: 'nav.features',
      children: [
        { href: '#equipes', labelKey: 'enterprise.nav.teams' },
        { href: '#execution', labelKey: 'enterprise.nav.execution' },
        { href: '#projets', labelKey: 'enterprise.nav.projects' },
        { href: '#okr', labelKey: 'enterprise.nav.okr' },
        { href: '#statistiques', labelKey: 'enterprise.nav.progress' },
        { href: '#fonctionnalites', labelKey: 'enterprise.nav.more' },
      ],
    },
    { href: '#securite', labelKey: 'enterprise.nav.security' },
    // Retirée du sommaire tant que les prix sont masqués : elle viserait une
    // section absente (`PRICES_VISIBLE`).
    ...(ENTERPRISE_PRICES_SHOWN
      ? [{ href: '#tarifs', labelKey: 'enterprise.nav.pricing' } as TrackAnchor]
      : []),
  ],
};

/** Ancres à plat (sous-menus dépliés), pour le suivi de lecture et le burger. */
export const flatAnchors = (track: LandingTrack): TrackAnchor[] =>
  TRACK_ANCHORS[track].flatMap((a) => a.children ?? [a]);
