// Gardes du HTML servi : le build échoue plutôt que de laisser partir une page
// avec deux <h1> ou un guide tronqué (régressions que seul un `curl` sur la
// production avait vues).
//
// ❌ Ne pas relever le plancher du guide pour faire passer un build : un guide
// plus court dans le HTML dit qu'une section a disparu de la copie.
import { bodyWords, countH1 } from '../scripts/prerender-h1.mjs';

/** Plancher de mots du <body>, par chemin de route canonique. */
export const MOTS_MIN: Record<string, number> = { '/guide': 1500 };

export function verifierPage(page: string, path: string, routePath: string): void {
  const h1 = countH1(page);
  if (h1 > 1) throw new Error(`prerender: ${path} sert ${h1} <h1>, un seul est permis (cf. scripts/prerender-h1.mjs)`);
  const min = MOTS_MIN[routePath];
  if (min) {
    const mots = bodyWords(page);
    if (mots < min) throw new Error(`prerender: ${path} sert ${mots} mots dans le <body>, plancher ${min} (la copie du guide a perdu une section ?)`);
  }
}
