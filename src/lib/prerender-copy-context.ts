import { createContext } from 'react';

/**
 * Vrai pendant le rendu SERVEUR de la copie d'une page de contenu
 * (`src/prerender/content-copy.tsx`), faux dans le navigateur. Une page peut y
 * alléger ce que la copie n'affiche jamais : elle ne montre que le premier
 * écran, puis React la relève.
 */
export const PrerenderCopyContext = createContext(false);
