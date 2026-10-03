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
