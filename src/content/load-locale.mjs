// Contenu éditorial (blog, cas d'usage) des langues chargées à part : le fr et
// l'en vivent dans les articles, le croate dans `blog/hr.mjs` et
// `use-cases.hr.mjs`, pour ne partir que chez les visiteurs `hr` (budget du
// chunk `blog`). L'app l'attend avant d'afficher ces pages (src/App.tsx) ; le
// prérendu importe `all-locales.mjs`, qui l'enregistre d'office.
// 🔴 Tout import ici reste DYNAMIQUE : App.tsx importe ce fichier, un import
// statique mettrait le blog entier dans le chemin critique.
const LOADERS = {
  hr: () => Promise.all([
    import('./blog/index.mjs'), import('./blog/hr.mjs'),
    import('./use-cases.mjs'), import('./use-cases.hr.mjs'),
  ]),
};

/** Charge et enregistre le contenu d'une langue (sans effet pour fr et en). */
export async function loadContentLocale(locale) {
  const load = LOADERS[locale];
  if (!load) return;
  const [blog, blogHr, useCases, useCasesHr] = await load();
  blog.registerArticleLocale(locale, blogHr.HR);
  useCases.registerUseCaseLocale(locale, useCasesHr.HR);
}
