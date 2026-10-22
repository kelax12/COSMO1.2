import React from 'react';

/**
 * Cible du lien d'évitement global, portée par le `<main>` de `Layout`.
 * Une constante partagée plutôt qu'une chaîne recopiée : un `id` et son
 * `href` qui divergent donnent un lien qui a l'air de marcher et ne déplace
 * rien.
 */
export const MAIN_CONTENT_ID = 'main-content';

interface SkipLinkProps {
  /** `id` de la cible, qui DOIT porter `tabIndex={-1}` pour recevoir le focus. */
  targetId: string;
  /** Libellé visible une fois le lien focalisé. Vient d'un catalogue i18n. */
  label: string;
  /** Classes supplémentaires — sert à masquer le lien sur un viewport donné. */
  className?: string;
}

/**
 * Lien d'évitement (WCAG 2.4.1 « Contourner des blocs »).
 *
 * Invisible tant qu'il n'a pas le focus, il devient le PREMIER arrêt de
 * tabulation de son bloc et pose le focus sur `targetId`.
 *
 * ⚠️ Le clic est intercepté (`preventDefault`) et le focus posé à la main
 * plutôt que laissé au saut d'ancre natif, pour deux raisons :
 *   1. le `basename` du routeur porte le préfixe de locale — écrire un hash
 *      dans l'URL n'est jamais neutre dans cette application (cf. la règle
 *      « ne jamais écrire un slug localisé en dur » de CLAUDE.md) ;
 *   2. le saut d'ancre natif fait DÉFILER sans DÉPLACER le focus quand la
 *      cible n'est pas focalisable — c'est le mode d'échec silencieux
 *      classique du lien d'évitement, celui qui donne une garde verte et un
 *      clavier toujours coincé.
 * L'attribut `href` reste posé : c'est lui qui donne le rôle « lien » et rend
 * le contrôle atteignable au clavier sans `tabIndex` explicite.
 *
 * ❌ Aucune animation de `transform` ici : `MotionConfig reducedMotion="user"`
 * laisserait la valeur `initial` appliquée et le lien focalisé resterait hors
 * de l'écran (cf. garde-fou « Animations » de CLAUDE.md).
 */
const SkipLink: React.FC<SkipLinkProps> = ({ targetId, label, className = '' }) => (
  <a
    href={`#${targetId}`}
    onClick={(e) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (!target) return;
      target.focus();
      // `focus()` ne fait défiler que si la cible est hors écran ; le
      // `scrollIntoView` explicite couvre le cas d'un conteneur scrollable
      // interne (le `<main>` de Layout, la colonne du calendrier).
      target.scrollIntoView({ block: 'start' });
    }}
    className={`sr-only focus:not-sr-only focus:fixed focus:z-[300] focus:left-3 focus:top-3 focus:px-4 focus:py-2 focus:rounded-lg focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] border border-[rgb(var(--color-border))] ${className}`}
  >
    {label}
  </a>
);

export default SkipLink;
