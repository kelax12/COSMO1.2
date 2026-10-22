import React from 'react';

// ═══════════════════════════════════════════════════════════════════
// Texte des deux accueils (perso et entreprise)
//
// Un titre d'accueil porte UN mot appuyé, écrit `<em>…</em>` dans le
// catalogue : la phrase reste entière et traduisible d'un bloc (« une clé =
// une phrase complète », src/i18n/CLAUDE.md), et c'est la langue qui décide
// quel mot porte l'accent, pas le composant.
//
// Rendu en nœuds React, jamais en `dangerouslySetInnerHTML` : un nom
// d'entreprise interpolé dans le titre (« Nova Studio est prête ») est une
// donnée saisie par quelqu'un, il ne doit jamais devenir du balisage.
// ═══════════════════════════════════════════════════════════════════

/**
 * Le mot appuyé d'un titre d'accueil : Instrument Serif italique, au milieu
 * d'un titre en Inter demi-gras. `1.1em` compense l'œil plus petit et la
 * chasse plus étroite de la sérif (mesuré le 2026-10-04 une fois la police
 * réellement servie : à taille égale, le mot paraissait plus petit que ses
 * voisins). Relatif au titre, donc juste à toutes les tailles de l'échelle.
 */
export const EMPHASIS_CLASS = 'font-display font-normal italic text-[1.1em] leading-none tracking-[-0.01em]';

const EMPHASIS = /(<em>.*?<\/em>)/g;
const EMPHASIS_ONLY = /^<em>(.*)<\/em>$/;

/** Découpe une phrase traduite autour de ses `<em>…</em>`. */
export const withEmphasis = (text: string, emClassName: string): React.ReactNode =>
  text.split(EMPHASIS).map((part, i) => {
    const m = part.match(EMPHASIS_ONLY);
    return m ? (
      <em key={i} className={emClassName}>
        {m[1]}
      </em>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    );
  });

/** La même phrase sans balise, pour un nom accessible ou un `title`. */
export const plainText = (text: string): string => text.replace(/<\/?em>/g, '');
