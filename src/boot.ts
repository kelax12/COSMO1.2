// Point d'entrée d'`index.html`. Il ne fait qu'une chose : décider QUAND
// charger l'application (`main.tsx`).
//
// 🔴 POURQUOI UN POINT D'ENTRÉE SÉPARÉ (2026-10-15, LCP mobile).
// Depuis C-116, l'élément LCP des pages prérendues est le texte du prérendu,
// peint avant React. Mais Lighthouse mobile (simulation Lantern) le mesurait
// toujours à 3,26-3,40 s sur les 8 URLs, avec 2,9 s de « Render Delay » pour un
// HTML reçu à 0,47 s. Lantern range dans le chemin du LCP toute requête TERMINÉE
// avant la peinture observée : avec `main.tsx` en entrée, ses ~300 ko gzip de
// JS (`modulepreload`) et ses ~40 ko de CSS bloquante l'étaient tous, alors que
// le prérendu n'en a pas besoin pour s'afficher. Sur un vrai réseau lent, c'est
// la même chose en vrai : ce JS se disputait la bande passante avec la CSS.
//
// Ici, sur une page PRÉRENDUE, l'application n'est demandée qu'APRÈS la
// première peinture : ni son JS ni sa CSS ne sont plus sur le chemin du LCP.
// Sa CSS n'est plus bloquante non plus : Vite la charge avec le chunk, et
// React ne monte qu'une fois qu'elle est là, donc aucun flash sans style.
// La coquille `app.html` (routes de l'app) n'a rien à peindre : elle charge
// tout de suite.
//
// ❌ Ne rien importer STATIQUEMENT ici d'autre que `after-first-paint` : tout
// import statique repasse sur le chemin du LCP. `check:bundle` compte le chunk
// de `main.tsx` et ses dépendances dans le chemin critique (il lit la liste de
// préchargement de ce point d'entrée), le budget ne perd donc rien de vue.
import { afterFirstPaint } from './lib/after-first-paint';
import { applyRouterBootstrap } from './i18n/apply-bootstrap';
import { dropPrerenderHeroIfLocaleDiffers } from './lib/prerender-hero';

// `<html lang>` et l'URL canonique (`/fr/x` → `/x`, `/` → `/en/` selon la
// préférence) AVANT la première peinture, comme quand `main.tsx` était
// l'entrée : charger l'app après la peinture les avait retardés après `load`.
const { locale } = applyRouterBootstrap();
// La copie du hero peinte par le prérendu de la home est écrite dans UNE
// langue : si l'amorçage en a choisi une autre, elle ne doit pas s'afficher.
dropPrerenderHeroIfLocaleDiffers(locale);

const charger = () => {
  void import('./main');
};

// 🔴 PAGE PRÉRENDUE : les bibliothèques d'abord, chacune dans sa tâche, puis
// `main` (2026-10-22, TBT mobile de `/`). `import('./main')` seul évaluait tout
// le graphe de l'application en UN bloc, au premier arrivé de ses chunks : la
// plus longue tâche du chargement (221 ms en simulation mobile, 171 ms des
// 316 de TBT de `/` dans le Lighthouse CI de `263154b6`). Un `import()` par
// chunk vendor, lancés ensemble : chacun est évalué dans sa propre tâche à son
// arrivée, et `main` n'évalue plus que son propre code.
// Le prix : `main` part une fois les bibliothèques évaluées, soit un aller-retour
// de plus avant le montage. Sans effet sur le LCP (la page prérendue est déjà
// peinte), et réservé à ces pages : la coquille `app.html` charge comme avant.
// Les `.then(({ x }) => x)` ne sont pas décoratifs : un espace de noms non
// déstructuré garderait TOUTES les exportations du paquet dans son chunk.
// ❌ Ne jamais importer ici un module de l'application : il sortirait du chunk
// `main` pour devenir un chunk à part.
const chargerParEtapes = () => {
  void Promise.allSettled([
    import('react-dom/client').then(({ createRoot }) => createRoot),
    import('clsx').then(({ clsx }) => clsx),
    import('@supabase/supabase-js').then(({ createClient }) => createClient),
    import('@tanstack/react-query').then(({ QueryClient }) => QueryClient),
    import('react-router').then(({ BrowserRouter }) => BrowserRouter),
    import('framer-motion').then(({ motion }) => motion),
  ]).then(charger);
};

if (document.documentElement.hasAttribute('data-prerendered')) afterFirstPaint(chargerParEtapes);
else charger();
