// Un seul <h1> par page prérendue (2026-11-06).
//
// Le HTML servi porte deux rendus du même titre : le texte SEO (#seo-fallback,
// dans #root) et la copie peinte avant React (#lp-hero). Depuis 66f76355
// (2026-10-24) la copie portait son propre <h1> : chaque page de contenu en
// avait deux (trois pour l'entreprise, dont les deux vues bureau et mobile).
// La copie est inerte et décorative, relevée par la page React : c'est elle qui
// rend ses titres en <div>, de mêmes classes (le preflight de Tailwind ne donne
// déjà aucun style propre au <h1>). Le <h1> du texte SEO reste le seul.
//
// Module Node brut, partagé par prerender.mjs (qui fait échouer le build) et
// par src/prerender-h1.guard.test.ts.

/** Le fragment, ses <h1> rendus en <div> (mêmes attributs). */
export const demoteH1 = (fragment) => fragment.replace(/<h1(?=[\s>])/g, '<div').replace(/<\/h1>/g, '</div>');

/** Nombre de <h1> d'une page HTML complète. */
export const countH1 = (html) => (html.match(/<h1(?=[\s>])/g) ?? []).length;

/** Mots du <body>, scripts et styles retirés (la mesure des audits SEO). */
export function bodyWords(html) {
  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}
