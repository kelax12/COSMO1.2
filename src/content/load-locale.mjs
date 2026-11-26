// Contenu éditorial (blog, cas d'usage) des langues chargées à part : le fr et
// les cas d'usage en vivent dans `use-cases.mjs`, les articles en dans `blog/en.mjs`,
// le croate dans `blog/hr.mjs` et `use-cases.hr.mjs` : chacun ne part que chez
// les visiteurs de sa langue (budget du chunk `blog`). L'app l'attend avant d'afficher ces pages (src/App.tsx) ; le
// prérendu importe `all-locales.mjs`, qui l'enregistre d'office.
// 🔴 Tout import ici reste DYNAMIQUE : App.tsx importe ce fichier, un import
// statique mettrait le blog entier dans le chemin critique.
const LOADERS = {
  en: async () => {
    const [blog, blogEn] = await Promise.all([import('./blog/index.mjs'), import('./blog/en.mjs')]);
    blog.registerArticleLocale('en', blogEn.EN);
  },
  hr: async () => {
    const [blog, blogHr, useCases, useCasesHr] = await Promise.all([
      import('./blog/index.mjs'), import('./blog/hr.mjs'),
      import('./use-cases.mjs'), import('./use-cases.hr.mjs'),
    ]);
    blog.registerArticleLocale('hr', blogHr.HR);
    useCases.registerUseCaseLocale('hr', useCasesHr.HR);
  },
};

/** Charge et enregistre le contenu d'une langue (sans effet pour fr). */
export async function loadContentLocale(locale) {
  await LOADERS[locale]?.();
}
